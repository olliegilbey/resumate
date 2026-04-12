import { NextRequest, NextResponse } from "next/server";
import { generateVCard } from "@/lib/vcard";
import type { ResumeData } from "@/types/resume";
import { captureEvent, flushEvents } from "@/lib/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { getClientIP } from "@/lib/rate-limit";

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

/**
 * Verify a Cloudflare Turnstile token against the siteverify endpoint.
 *
 * @param token - Turnstile token from the client widget
 * @returns `true` if Cloudflare confirms the token, `false` on any error
 *   (missing secret, network failure, or invalid token — logged but not thrown)
 */
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
 * Load the compendium from the bundled `data/resume-data.json`.
 *
 * @returns The parsed `ResumeData`, or `null` if the import fails (logged, not rethrown)
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
 * Validate a Turnstile token, build a vCard from env-sourced contact data, and
 * return it as a downloadable `text/vcard` response. Shared by the GET and POST
 * handlers so both entrypoints enforce identical replay-protection and logging.
 *
 * @param token - Turnstile token; enforced as single-use via `usedTokens`
 * @param request - Original request, used to resolve the client IP for GeoIP
 * @returns 403 if the token is reused or verification fails; 500 if env vars
 *   are missing; otherwise 200 with vCard payload and `Content-Disposition`
 */
async function generateContactCardResponse(
  token: string,
  request: NextRequest,
): Promise<NextResponse> {
  // Check if token was already used (replay attack prevention)
  if (usedTokens.has(token)) {
    console.warn("Duplicate Turnstile token blocked");
    return new NextResponse("Token already used", { status: 403 });
  }

  // Verify Turnstile token with Cloudflare
  const isValid = await verifyTurnstileToken(token);

  if (!isValid) {
    return new NextResponse("Verification failed", { status: 403 });
  }

  // Mark token as used (one-time use only)
  usedTokens.add(token);

  // Load resume data
  const resumeData = await loadResumeData();
  if (!resumeData) {
    return new NextResponse("Resume data not available", { status: 500 });
  }

  // Get sensitive data from environment variables (never exposed to client)
  const emailPersonal = process.env.CONTACT_EMAIL_PERSONAL;
  const emailProfessional = process.env.CONTACT_EMAIL_PROFESSIONAL;
  const phone = process.env.CONTACT_PHONE;

  // Require at least one email and phone
  if ((!emailPersonal && !emailProfessional) || !phone) {
    console.error("Contact information not configured in environment variables");
    return new NextResponse("Server configuration error", { status: 500 });
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

  // Return as downloadable file
  return new NextResponse(vcardContent, {
    headers: {
      "Content-Type": "text/vcard;charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/**
 * GET `/api/contact-card?token=<turnstile>` — direct-navigation download.
 *
 * Used for browsers (like Arc) that block programmatic `fetch` + blob downloads.
 * The Turnstile token comes via query string; everything else (replay check,
 * verification, vCard build, analytics) is delegated to
 * `generateContactCardResponse`.
 *
 * @param request - Incoming request; the `token` search param is required
 * @returns 400 when the token is missing, otherwise the shared response
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return new NextResponse("Missing verification token", { status: 400 });
    }

    return await generateContactCardResponse(token, request);
  } catch (error) {
    console.error("Contact card GET error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

/**
 * POST `/api/contact-card` — form-submission fallback for older flows.
 *
 * Deprecated in favor of `GET` but retained for backwards compatibility. Accepts
 * the Turnstile token in a JSON body (`{ token }`) or form-encoded body; the
 * rest of the pipeline matches `GET`.
 *
 * @param request - Incoming request with `application/json` or
 *   `application/x-www-form-urlencoded` body containing `token`
 * @returns 400 when the token is missing, otherwise the shared response
 */
export async function POST(request: NextRequest) {
  try {
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
      return new NextResponse("Missing verification token", { status: 400 });
    }

    return await generateContactCardResponse(token, request);
  } catch (error) {
    console.error("Contact card POST error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

// Disable static optimization for this route
export const dynamic = "force-dynamic";
