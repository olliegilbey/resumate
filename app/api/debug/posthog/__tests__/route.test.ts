/**
 * API Route Tests: /api/debug/posthog
 *
 * Verifies the debug probe:
 * - Is gated off in production (returns 404).
 * - Reports PostHog configuration as a boolean, never leaking any portion
 *   of `POSTHOG_API_KEY`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the posthog-server module so the debug route doesn't touch real PostHog
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn(() => null),
  captureEvent: vi.fn().mockResolvedValue(undefined),
  flushEvents: vi.fn().mockResolvedValue(undefined),
}));

describe("GET /api/debug/posthog", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("POSTHOG_API_KEY", "phc_secret_key_value");

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body).toEqual({ error: "Not found" });
  });

  it("returns posthogConfigured: true when POSTHOG_API_KEY is set (dev)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("POSTHOG_API_KEY", "phc_secret_key_value");

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      env: { posthogConfigured: boolean };
    };
    expect(body.env.posthogConfigured).toBe(true);
  });

  it("returns posthogConfigured: false when POSTHOG_API_KEY is unset", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("POSTHOG_API_KEY", "");

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      env: { posthogConfigured: boolean };
    };
    expect(body.env.posthogConfigured).toBe(false);
  });

  it("never leaks any portion of POSTHOG_API_KEY in the response body", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const secret = "phc_super_secret_key_value_do_not_leak";
    vi.stubEnv("POSTHOG_API_KEY", secret);

    const { GET } = await import("../route");
    const response = await GET();

    const raw = await response.text();

    // No raw key, no prefix, and no legacy field name
    expect(raw).not.toContain(secret);
    expect(raw).not.toContain(secret.substring(0, 10));
    expect(raw).not.toContain("POSTHOG_API_KEY_PREFIX");
    expect(raw).not.toMatch(/POSTHOG_API_KEY"\s*:/);
  });
});
