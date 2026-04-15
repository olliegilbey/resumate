import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { captureEvent, flushEvents } from "@/lib/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { loadResumeData, selectBullets } from "./scoring";

// In-memory store for used tokens (prevents replay attacks within function instance lifetime)
// Note: In serverless, each function instance is stateless and short-lived
// TODO: For production with multiple instances, use Redis or similar distributed store
const usedTokens = new Set<string>();

/**
 * POST /api/resume/select
 *
 * Selects bullets for a specific role profile using the bullet selection algorithm.
 *
 * Request body:
 * - roleProfileId: string (e.g., "developer-relations-lead")
 * - turnstileToken: string
 * - config?: { maxBullets?: number, maxPerCompany?: number, maxPerPosition?: number }
 *
 * Returns:
 * - selected bullets with scores
 * - company/position metadata
 *
 * Rate limit: 10 requests per hour per IP
 */
type SelectRequestBody = {
  roleProfileId?: string;
  turnstileToken?: string;
  config?: { maxBullets?: number; maxPerCompany?: number; maxPerPosition?: number };
  email?: string;
  linkedin?: string;
  sessionId?: string;
};

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = (await request.json()) as SelectRequestBody;
    const { roleProfileId, turnstileToken, config, email, linkedin, sessionId } = body;

    if (!roleProfileId || !turnstileToken) {
      return NextResponse.json(
        { error: "Missing required fields: roleProfileId, turnstileToken" },
        { status: 400 },
      );
    }

    // Prepare response headers
    const headers = new Headers();

    // Rate limit check
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(clientIP, {
      limit: 10,
      window: 60 * 60 * 1000, // 1 hour
    });

    headers.set("X-RateLimit-Limit", rateLimit.limit.toString());
    headers.set("X-RateLimit-Remaining", rateLimit.remaining.toString());
    headers.set("X-RateLimit-Reset", new Date(rateLimit.reset).toISOString());

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Maximum 10 requests per hour. Please try again later.",
          resetAt: rateLimit.reset,
        },
        { status: 429, headers },
      );
    }

    // Check token replay (one-time use enforcement)
    if (usedTokens.has(turnstileToken)) {
      console.warn("Duplicate Turnstile token blocked");
      return NextResponse.json({ error: "Token already used" }, { status: 403 });
    }

    // Verify Turnstile token
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (!turnstileSecret) {
      console.error("TURNSTILE_SECRET_KEY not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const turnstileResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: turnstileToken,
        }),
      },
    );

    const turnstileData = (await turnstileResponse.json()) as { success?: boolean };

    if (!turnstileData.success) {
      return NextResponse.json({ error: "Turnstile verification failed" }, { status: 403 });
    }

    // Mark token as used (replay prevention)
    usedTokens.add(turnstileToken);

    // Load resume data
    const resumeData = await loadResumeData();
    if (!resumeData) {
      return NextResponse.json({ error: "Resume data not available" }, { status: 500 });
    }

    // Find role profile
    const roleProfile = resumeData.roleProfiles?.find((p) => p.id === roleProfileId);

    if (!roleProfile) {
      return NextResponse.json(
        { error: `Role profile not found: ${roleProfileId}` },
        { status: 404 },
      );
    }

    // Run bullet selection algorithm (TypeScript version until WASM is ready)
    const selectionConfig = {
      maxBullets: config?.maxBullets ?? 28, // Ceiling - may select fewer based on content
      maxPerCompany: config?.maxPerCompany ?? 6,
      maxPerPosition: config?.maxPerPosition ?? 4,
    };

    const startTime = Date.now();
    const selected = selectBullets(resumeData, roleProfile, selectionConfig);
    const selectionDuration = Date.now() - startTime;

    // Track resume_prepared event (snake_case per spec)
    const bullet_ids = selected.map((s) => s.bullet.id);
    const bullets_by_company: Record<string, number> = {};
    const bullets_by_tag: Record<string, number> = {};

    for (const item of selected) {
      bullets_by_company[item.companyId] = (bullets_by_company[item.companyId] || 0) + 1;
      for (const tag of item.bullet.tags || []) {
        bullets_by_tag[tag] = (bullets_by_tag[tag] || 0) + 1;
      }
    }

    await captureEvent(
      sessionId || clientIP,
      ANALYTICS_EVENTS.RESUME_PREPARED,
      {
        session_id: sessionId,
        email,
        linkedin,
        generation_method: "heuristic",
        download_type: "resume_heuristic",
        role_profile_id: roleProfile.id,
        role_profile_name: roleProfile.name,
        bullet_ids,
        bullet_count: selected.length,
        bullets_by_company,
        bullets_by_tag,
        config: {
          max_bullets: selectionConfig.maxBullets,
          max_per_company: selectionConfig.maxPerCompany,
          max_per_position: selectionConfig.maxPerPosition,
        },
        selection_duration_ms: selectionDuration,
        client_ip: clientIP,
      },
      clientIP, // Pass IP for GeoIP lookup
    );

    // Flush events before serverless function exits
    await flushEvents();

    // Return results
    return NextResponse.json(
      {
        success: true,
        roleProfile: {
          id: roleProfile.id,
          name: roleProfile.name,
          description: roleProfile.description,
        },
        config: selectionConfig,
        selected,
        count: selected.length,
        timestamp: Date.now(),
      },
      { headers },
    );
  } catch (error) {
    console.error("Error in /api/resume/select:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
