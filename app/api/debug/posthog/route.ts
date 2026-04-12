import { NextResponse } from "next/server";
import { getPostHogClient, captureEvent, flushEvents } from "@/lib/posthog-server";

/**
 * GET /api/debug/posthog
 *
 * Debug probe for PostHog server-side configuration.
 *
 * Security:
 * - Returns 404 in production (NODE_ENV === "production") so the endpoint is
 *   only reachable locally / in preview builds.
 * - Never exposes the raw `POSTHOG_API_KEY` or any prefix of it. Only a
 *   boolean `posthogConfigured` flag indicates whether a key is set.
 *
 * @returns JSON diagnostics about PostHog client init and a test event capture,
 *          or `{ error: "Not found" }` with status 404 in production.
 *
 * @example
 * ```ts
 * // GET /api/debug/posthog (in dev)
 * // → { timestamp, env: { NODE_ENV, posthogConfigured, POSTHOG_ENABLE_DEV },
 * //     clientInitialized, eventCaptured, eventsFlushed }
 * ```
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      posthogConfigured: Boolean(process.env.POSTHOG_API_KEY),
      POSTHOG_ENABLE_DEV: process.env.POSTHOG_ENABLE_DEV,
    },
  };

  try {
    const client = getPostHogClient();
    diagnostics.clientInitialized = client !== null;

    if (client) {
      // Try to capture a test event
      await captureEvent("debug-endpoint", "debug_posthog_test", {
        source: "api/debug/posthog",
        timestamp: new Date().toISOString(),
      });
      diagnostics.eventCaptured = true;

      await flushEvents();
      diagnostics.eventsFlushed = true;
    }
  } catch (error) {
    diagnostics.error = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(diagnostics);
}

export const dynamic = "force-dynamic";
