import { NextRequest, NextResponse } from "next/server";
import { captureEvent, flushEvents } from "@/lib/posthog-server";
import { getClientIP, checkRateLimit } from "@/lib/rate-limit";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { triggerN8nWebhook } from "./n8n-webhook";
import { normalizeRequestBody, type LogRequestBody, type NormalizedLogBody } from "./request-body";

/**
 * POST /api/resume/log
 *
 * Server-side event logging endpoint for PDF generation events.
 * Captures resume_generated, resume_failed, resume_download_notified events.
 * Triggers n8n webhook for download notifications.
 *
 * Note: resume_download_notified (server) differs from resume_downloaded (client).
 * Server events are for n8n/notifications, client events have accurate GeoIP.
 *
 * Rate limit: 30 requests/hour per IP
 */

const ALLOWED_EVENTS = [
  ANALYTICS_EVENTS.RESUME_GENERATED,
  ANALYTICS_EVENTS.RESUME_FAILED,
  ANALYTICS_EVENTS.RESUME_DOWNLOAD_NOTIFIED,
];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Build the PostHog event property bag from a normalized body + client IP. */
function buildEventProperties(body: NormalizedLogBody, clientIP: string): Record<string, unknown> {
  const generation_method = body.generation_method || "heuristic";
  const download_type =
    body.download_type || (generation_method === "ai" ? "resume_ai" : "resume_heuristic");

  const base: Record<string, unknown> = {
    session_id: body.session_id,
    generation_method,
    download_type,
    client_ip: clientIP,
    email: body.email,
    linkedin: body.linkedin,
    role_profile_id: body.role_profile_id,
    role_profile_name: body.role_profile_name,
    ai_provider: body.ai_provider,
    job_title: body.job_title,
    extracted_salary_min: body.extracted_salary_min,
    extracted_salary_max: body.extracted_salary_max,
    salary_currency: body.salary_currency,
    reasoning: body.reasoning,
  };

  if (body.event === ANALYTICS_EVENTS.RESUME_DOWNLOAD_NOTIFIED) {
    base.bullet_count = body.bullet_count;
    base.bullets = body.bullets;
    base.pdf_size = body.pdf_size;
    base.filename = body.filename;
  } else if (body.event === ANALYTICS_EVENTS.RESUME_GENERATED) {
    base.bullet_count = body.bullet_count;
    base.pdf_size = body.pdf_size;
    base.wasm_load_ms = body.wasm_load_ms;
    base.generation_ms = body.generation_ms;
    base.total_duration_ms = body.total_duration_ms;
    base.wasm_cached = body.wasm_cached;
  } else if (body.event === ANALYTICS_EVENTS.RESUME_FAILED) {
    base.error_code = body.error_code;
    base.error_category = body.error_category;
    base.error_stage = body.error_stage;
    base.error_message = body.error_message;
    base.error_detail = body.error_detail;
    base.error_stack = process.env.NODE_ENV === "development" ? body.error_stack : undefined;
    base.is_retryable = body.is_retryable;
    base.bullet_count = body.bullet_count;
  }

  return base;
}

/** Fire n8n webhooks for events that should notify downstream systems. */
function dispatchN8nIfNeeded(body: NormalizedLogBody, clientIP: string): void {
  const generation_method = body.generation_method || "heuristic";
  const download_type =
    body.download_type || (generation_method === "ai" ? "resume_ai" : "resume_heuristic");

  if (body.event === ANALYTICS_EVENTS.RESUME_DOWNLOAD_NOTIFIED) {
    triggerN8nWebhook({
      event: ANALYTICS_EVENTS.RESUME_DOWNLOAD_NOTIFIED,
      session_id: body.session_id!,
      generation_method,
      download_type,
      email: body.email,
      linkedin: body.linkedin,
      role_profile_id: body.role_profile_id,
      role_profile_name: body.role_profile_name,
      ai_provider: body.ai_provider,
      job_title: body.job_title,
      extracted_salary_min: body.extracted_salary_min,
      extracted_salary_max: body.extracted_salary_max,
      salary_currency: body.salary_currency,
      bullet_count: body.bullet_count,
      bullets: body.bullets,
      pdf_size: body.pdf_size,
      client_ip: clientIP,
      timestamp: new Date().toISOString(),
    }).catch((err) => console.error("Failed to trigger n8n webhook:", err));
    return;
  }

  if (
    body.event === ANALYTICS_EVENTS.RESUME_FAILED &&
    (body.error_stage === "wasm_load" || body.error_stage === "pdf_generation")
  ) {
    triggerN8nWebhook({
      event: ANALYTICS_EVENTS.RESUME_FAILED,
      session_id: body.session_id!,
      generation_method,
      download_type,
      email: body.email,
      linkedin: body.linkedin,
      role_profile_id: body.role_profile_id,
      role_profile_name: body.role_profile_name,
      ai_provider: body.ai_provider,
      error_code: body.error_code,
      error_category: body.error_category,
      error_stage: body.error_stage,
      error_message: body.error_message,
      client_ip: clientIP,
      timestamp: new Date().toISOString(),
    }).catch((err) => console.error("Failed to trigger n8n webhook:", err));
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = (await request.json()) as LogRequestBody;
    const body = normalizeRequestBody(raw);

    if (!body.event || !body.session_id) {
      return NextResponse.json(
        { error: "Missing required fields: event, session_id" },
        { status: 400 },
      );
    }
    if (!ALLOWED_EVENTS.includes(body.event)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }
    if (!UUID_REGEX.test(body.session_id)) {
      return NextResponse.json({ error: "Invalid session_id format" }, { status: 400 });
    }

    const clientIP = getClientIP(request);

    const rateLimit = checkRateLimit(clientIP, {
      limit: 30,
      window: 60 * 60 * 1000,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimit.limit.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateLimit.reset).toISOString(),
          },
        },
      );
    }

    const eventProperties = buildEventProperties(body, clientIP);
    dispatchN8nIfNeeded(body, clientIP);

    await captureEvent(body.session_id, body.event, eventProperties, clientIP);
    await flushEvents();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in /api/resume/log:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
