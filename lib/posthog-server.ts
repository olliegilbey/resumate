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
      // Disable in dev for faster builds
      flushAt: isDev ? 1 : 20,
      flushInterval: isDev ? 1000 : 10000,
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
        timestamp: new Date().toISOString(),
        // Include IP for PostHog GeoIP lookup (if provided)
        ...(ip && { $ip: ip }),
      },
    });
    console.log(`[PostHog] Event captured: ${event} for ${distinctId}${ip ? ` from ${ip}` : ''}`);
  } catch (error) {
    console.error("[PostHog] Failed to capture event:", event, error);
  }
}

/**
 * Flush pending events (call before serverless function exits)
 */
export async function flushEvents(): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  try {
    console.log("[PostHog] Flushing events...");
    await client.flush();
    console.log("[PostHog] Events flushed successfully");
  } catch (error) {
    console.error("[PostHog] Failed to flush events:", error);
    throw error; // Propagate error for debugging
  }
}
