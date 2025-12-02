import { PostHog } from "posthog-node";

/**
 * Server-side PostHog client for analytics and event tracking
 * Singleton pattern ensures single instance across API routes
 */
let posthogInstance: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  // Skip in development unless explicitly enabled
  const isDev = process.env.NODE_ENV === "development";
  const enableInDev = process.env.POSTHOG_ENABLE_DEV === "true";

  if (isDev && !enableInDev) {
    console.log("[PostHog] Disabled in development (set POSTHOG_ENABLE_DEV=true to enable)");
    return null;
  }

  // Return existing instance if available
  if (posthogInstance) {
    return posthogInstance;
  }

  // Validate API key
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    console.warn("[PostHog] POSTHOG_API_KEY not set, analytics disabled");
    return null;
  }

  // Initialize client
  try {
    posthogInstance = new PostHog(apiKey, {
      host: "https://eu.i.posthog.com",
      // Serverless requires immediate flush - no batching
      // https://posthog.com/docs/libraries/node#serverless-environments
      flushAt: 1,
      flushInterval: 0,
    });

    console.log("[PostHog] Server client initialized");
    return posthogInstance;
  } catch (error) {
    console.error("[PostHog] Failed to initialize:", error);
    return null;
  }
}

/**
 * Safely capture event without throwing on failure
 * @param distinctId - Unique identifier (sessionId or clientIP)
 * @param event - Event name
 * @param properties - Event properties
 * @param ip - Optional client IP for GeoIP lookup (recommended for location tracking)
 */
export async function captureEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, any>,
  ip?: string
): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  try {
    client.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        environment: process.env.NODE_ENV,
        // Vercel env: 'production' | 'preview' | 'development', or 'local' for localhost
        source: process.env.VERCEL_ENV || "local",
        timestamp: new Date().toISOString(),
      },
      // $ip must be top-level for PostHog GeoIP lookup (not inside properties)
      ...(ip && { $ip: ip }),
    });
    console.log(`[PostHog] Event captured: ${event} for ${distinctId}${ip ? ` from ${ip}` : ''}`);
  } catch (error) {
    console.error("[PostHog] Failed to capture event:", event, error);
  }
}

/**
 * Shutdown client and flush pending events (call before serverless function exits)
 * Uses shutdown() instead of flush() for reliable completion in serverless
 * https://posthog.com/docs/libraries/node#serverless-environments
 */
export async function flushEvents(): Promise<void> {
  if (!posthogInstance) return;

  try {
    console.log("[PostHog] Shutting down...");
    await posthogInstance.shutdown();
    console.log("[PostHog] Shutdown complete");
  } catch (error) {
    // Best-effort: log but don't throw - analytics shouldn't break core functionality
    console.error("[PostHog] Failed to shutdown:", error);
  } finally {
    // Reset singleton so next request creates fresh instance
    posthogInstance = null;
  }
}
