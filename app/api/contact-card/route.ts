import { NextRequest, NextResponse } from "next/server";
import { generateVCard } from "@/lib/vcard";
import type { ResumeData } from "@/types/resume";
import { captureEvent, flushEvents } from "@/lib/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

/**
 * Server-side vCard generation with Turnstile protection
 * Phone and email NEVER sent to client - only in this API response
 * Sensitive data stored in environment variables (.env.local)
 */

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

// In-memory store for used tokens (prevents replay attacks within function instance lifetime)
// Note: In serverless, each function instance is stateless and short-lived
// The Set is garbage collected when the instance terminates, so no cleanup interval needed
// TODO: For production with multiple instances, use Redis or similar distributed store
const usedTokens = new Set<string>();

async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    console.error("TURNSTILE_SECRET_KEY not configured");
    return false;
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    const data = (await response.json()) as TurnstileResponse;
    return data.success;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}

/**
 * Load resume data from build cache
 */
async function loadResumeData(): Promise<ResumeData | null> {
  try {
    const data = await import("@/data/resume-data.json");
    return (data.default || data) as unknown as ResumeData;
  } catch (error) {
    console.error("Failed to load resume data:", error);
    return null;
  }
}

/**
 * Merge rate-limit (and any other) seed headers into a fresh Headers object.
 * Callers then set response-specific headers on top.
 */
function seededHeaders(seed?: Headers): Headers {
  const headers = new Headers();
  if (seed) {
    seed.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

/**
 * Shared function to generate and return vCard after token verification.
 *
 * @param token - Turnstile token previously issued by /api/resume/prepare
 * @param request - The incoming Next.js request (used for IP/GeoIP analytics)
 * @param extraHeaders - Optional seed headers to include on every response
 *   this helper returns (used by callers to thread X-RateLimit-* headers
 *   through success, 4xx, and 5xx branches).
 */
async function generateContactCardResponse(
  token: string,
  request: NextRequest,
  extraHeaders?: Headers,
): Promise<NextResponse> {
  // Check if token was already used (replay attack prevention)
  if (usedTokens.has(token)) {
    console.warn("Duplicate Turnstile token blocked");
    return new NextResponse("Token already used", { status: 403, headers: seededHeaders(extraHeaders) });
  }

  // Verify Turnstile token with Cloudflare
  const isValid = await verifyTurnstileToken(token);

  if (!isValid) {
    return new NextResponse("Verification failed", { status: 403, headers: seededHeaders(extraHeaders) });
  }

  // Mark token as used (one-time use only)
  usedTokens.add(token);

  // Load resume data
  const resumeData = await loadResumeData();
  if (!resumeData) {
    return new NextResponse("Resume data not available", { status: 500, headers: seededHeaders(extraHeaders) });
  }

  // Get sensitive data from environment variables (never exposed to client)
  const emailPersonal = process.env.CONTACT_EMAIL_PERSONAL;
  const emailProfessional = process.env.CONTACT_EMAIL_PROFESSIONAL;
  const phone = process.env.CONTACT_PHONE;

  // Require at least one email and phone
  if ((!emailPersonal && !emailProfessional) || !phone) {
    console.error("Contact information not configured in environment variables");
    return new NextResponse("Server configuration error", { status: 500, headers: seededHeaders(extraHeaders) });
  }

  // Build email array (personal first if available, otherwise professional)
  const emails: string[] = [];
  if (emailPersonal) {
    emails.push(emailPersonal);
    if (emailProfessional) {
      emails.push(emailProfessional);
    }
  } else if (emailProfessional) {
    emails.push(emailProfessional);
  }

  // Parse name (handle edge cases: single names, multiple spaces)
  const fullName = resumeData.personal.name || "";
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  // Get most recent job title from first company's first position
  const mostRecentTitle = resumeData.experience[0]?.children[0]?.name || "Professional";

  // Generate vCard content on server
  const vcardContent = generateVCard({
    firstName,
    lastName,
    fullName,
    nickname: resumeData.personal.nickname ?? undefined,
    email: emails, // Pass array of emails (personal first, then professional)
    phone,
    linkedin: resumeData.personal.linkedin ?? undefined,
    github: resumeData.personal.github ?? undefined,
    address: {
      city: resumeData.personal.location ?? undefined,
    },
    title: mostRecentTitle,
    note: resumeData.summary ?? undefined,
  });

  // Capture contact card served event (authoritative delivery confirmation + geoIP)
  // Distinct from client-side contact_card_downloaded which tracks timing/funnel
  // Uses "server:contact_card" as distinctId since we don't have client session
  // GeoIP still works via $ip property
  const clientIP = getClientIP(request);
  const filename = `${fullName.replace(/\s+/g, "-").toLowerCase()}-contact.vcf`;

  await captureEvent(
    "server:contact_card",
    ANALYTICS_EVENTS.CONTACT_CARD_SERVED,
    {
      download_type: "vcard",
      filename,
      full_name: fullName,
      has_linkedin: !!resumeData.personal.linkedin,
      has_github: !!resumeData.personal.github,
      has_location: !!resumeData.personal.location,
      email_count: emails.length,
      client_ip: clientIP,
      vcard_size: vcardContent.length,
    },
    clientIP, // Pass IP for GeoIP lookup
  );

  // Flush events before serverless function exits
  await flushEvents();

  // Return as downloadable file (seeded with any caller-provided headers, e.g. X-RateLimit-*)
  const responseHeaders = seededHeaders(extraHeaders);
  responseHeaders.set("Content-Type", "text/vcard;charset=utf-8");
  responseHeaders.set("Content-Disposition", `attachment; filename="${filename}"`);
  responseHeaders.set("Cache-Control", "no-store, must-revalidate");
  responseHeaders.set("X-Robots-Tag", "noindex, nofollow");

  return new NextResponse(vcardContent, { headers: responseHeaders });
}

/**
 * Build a Headers object populated with X-RateLimit-* values.
 *
 * @param result - Result returned by checkRateLimit
 * @returns Headers carrying Limit / Remaining / Reset (ISO) entries
 */
function buildRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  reset: number;
}): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", result.limit.toString());
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set("X-RateLimit-Reset", new Date(result.reset).toISOString());
  return headers;
}

// Rate limit: 20 GET / 10 POST per minute per IP. GET is a lightweight vCard
// fetch; POST also parses request bodies (JSON + form-data) and is tuned lower.
// Identifiers are namespaced per method so the two handlers use independent buckets.
const GET_RATE_LIMIT = { limit: 20, window: 60 * 1000 } as const;
const POST_RATE_LIMIT = { limit: 10, window: 60 * 1000 } as const;

// GET route - for direct navigation downloads (works in all browsers including Arc)
export async function GET(request: NextRequest) {
  try {
    // Rate limit check first (before any processing)
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(`contact-card:get:${clientIP}`, GET_RATE_LIMIT);
    const rateLimitHeaders = buildRateLimitHeaders(rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Maximum ${GET_RATE_LIMIT.limit} requests per minute. Please try again later.`,
          resetAt: rateLimit.reset,
        },
        { status: 429, headers: rateLimitHeaders },
      );
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return new NextResponse("Missing verification token", {
        status: 400,
        headers: rateLimitHeaders,
      });
    }

    return await generateContactCardResponse(token, request, rateLimitHeaders);
  } catch (error) {
    console.error("Contact card GET error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

// POST route - for form submissions (deprecated in favor of GET, but kept for backwards compatibility)
export async function POST(request: NextRequest) {
  try {
    // Rate limit check first (before any processing)
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(`contact-card:post:${clientIP}`, POST_RATE_LIMIT);
    const rateLimitHeaders = buildRateLimitHeaders(rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Maximum ${POST_RATE_LIMIT.limit} requests per minute. Please try again later.`,
          resetAt: rateLimit.reset,
        },
        { status: 429, headers: rateLimitHeaders },
      );
    }

    // Get Turnstile token from request (handle both JSON and form data)
    const contentType = request.headers.get("content-type") || "";
    let token: string | null = null;

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { token?: string };
      token = body.token ?? null;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      token = formData.get("token") as string | null;
    } else {
      // Try to parse as form data
      const formData = await request.formData();
      token = formData.get("token") as string | null;
    }

    if (!token) {
      return new NextResponse("Missing verification token", {
        status: 400,
        headers: rateLimitHeaders,
      });
    }

    return await generateContactCardResponse(token, request, rateLimitHeaders);
  } catch (error) {
    console.error("Contact card POST error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

// Disable static optimization for this route
export const dynamic = "force-dynamic";
