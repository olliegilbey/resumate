/**
 * API Route Tests: /api/models
 *
 * Tests the model availability endpoint that proxies
 * Cerebras /v1/models to determine which AI models are live.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { setupRateLimitCleanup } from "@/lib/__tests__/helpers/rate-limit-helper";

// Mock Cerebras API response
const mockCerebrasModels = {
  object: "list",
  data: [
    {
      id: "qwen-3-235b-a22b-instruct-2507",
      object: "model",
      created: 1700000000,
      owned_by: "Alibaba",
    },
    { id: "llama3.1-8b", object: "model", created: 1721692800, owned_by: "Meta" },
  ],
};

let originalFetch: typeof global.fetch;
let originalCerebrasKey: string | undefined;
let originalAnthropicKey: string | undefined;

describe("GET /api/models", () => {
  setupRateLimitCleanup();

  /** Build a NextRequest with a specific IP for per-test rate-limit isolation. */
  function makeRequest(ip: string): NextRequest {
    return new NextRequest("http://localhost:3000/api/models", {
      method: "GET",
      headers: { "x-forwarded-for": ip },
    });
  }

  beforeEach(() => {
    originalFetch = global.fetch;
    originalCerebrasKey = process.env.CEREBRAS_API_KEY;
    originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
    process.env.CEREBRAS_API_KEY = "test-key";
    delete process.env.ANTHROPIC_API_KEY;
    // Clear module-level cache by re-importing (cache is module-scoped)
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.CEREBRAS_API_KEY = originalCerebrasKey;
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  });

  it("returns available models from Cerebras", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCerebrasModels),
    }) as unknown as typeof fetch;

    // Re-import to get fresh cache
    const { GET: freshGET } = await import("../route");
    const response = await freshGET();
    const body = (await response.json()) as any;

    expect(body.models).toBeDefined();
    expect(Array.isArray(body.models)).toBe(true);

    // Cerebras models should be available
    const cerebrasGpt = body.models.find((m: { id: string }) => m.id === "cerebras-gpt");
    expect(cerebrasGpt).toBeDefined();
    expect(cerebrasGpt.available).toBe(true);

    const cerebrasLlama = body.models.find((m: { id: string }) => m.id === "cerebras-llama");
    expect(cerebrasLlama).toBeDefined();
    expect(cerebrasLlama.available).toBe(true);

    // Claude models should be unavailable (no ANTHROPIC_API_KEY set)
    const claudeSonnet = body.models.find((m: { id: string }) => m.id === "claude-sonnet");
    expect(claudeSonnet).toBeDefined();
    expect(claudeSonnet.available).toBe(false);
    expect(claudeSonnet.reason).toBe("Coming soon");

    const claudeHaiku = body.models.find((m: { id: string }) => m.id === "claude-haiku");
    expect(claudeHaiku).toBeDefined();
    expect(claudeHaiku.available).toBe(false);
  });

  it("marks Anthropic models available when API key is set", async () => {
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCerebrasModels),
    }) as unknown as typeof fetch;

    const { GET: freshGET } = await import("../route");
    const response = await freshGET();
    const body = (await response.json()) as any;

    const claudeSonnet = body.models.find((m: { id: string }) => m.id === "claude-sonnet");
    expect(claudeSonnet.available).toBe(true);
    expect(claudeSonnet.reason).toBeUndefined();

    const claudeHaiku = body.models.find((m: { id: string }) => m.id === "claude-haiku");
    expect(claudeHaiku.available).toBe(true);
  });

  it("marks Cerebras models unavailable when model not in API response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          object: "list",
          data: [
            { id: "llama3.1-8b", object: "model", created: 1721692800, owned_by: "Meta" },
            // qwen model NOT in list
          ],
        }),
    }) as unknown as typeof fetch;

    const { GET: freshGET } = await import("../route");
    const response = await freshGET();
    const body = (await response.json()) as any;

    const cerebrasGpt = body.models.find((m: { id: string }) => m.id === "cerebras-gpt");
    expect(cerebrasGpt.available).toBe(false);
    expect(cerebrasGpt.reason).toBe("Model not available on provider");

    const cerebrasLlama = body.models.find((m: { id: string }) => m.id === "cerebras-llama");
    expect(cerebrasLlama.available).toBe(true);
  });

  it("marks all Cerebras models unavailable when API key missing", async () => {
    delete process.env.CEREBRAS_API_KEY;

    const { GET: freshGET } = await import("../route");
    const response = await freshGET();
    const body = (await response.json()) as any;

    const cerebrasGpt = body.models.find((m: { id: string }) => m.id === "cerebras-gpt");
    expect(cerebrasGpt.available).toBe(false);
    expect(cerebrasGpt.reason).toBe("API key not configured");
  });

  it("assumes Cerebras models available when API fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error")) as unknown as typeof fetch;

    const { GET: freshGET } = await import("../route");
    const response = await freshGET();
    const body = (await response.json()) as any;

    // Should assume available on fetch failure (optimistic)
    const cerebrasGpt = body.models.find((m: { id: string }) => m.id === "cerebras-gpt");
    expect(cerebrasGpt.available).toBe(true);
  });

  it("includes label and cost for all models", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCerebrasModels),
    }) as unknown as typeof fetch;

    const { GET: freshGET } = await import("../route");
    const response = await freshGET();
    const body = (await response.json()) as any;

    for (const model of body.models) {
      expect(model.label).toBeDefined();
      expect(typeof model.label).toBe("string");
      expect(["free", "paid"]).toContain(model.cost);
    }
  });

  describe("Rate Limiting", () => {
    it("includes rate limit headers in successful response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCerebrasModels),
      }) as unknown as typeof fetch;

      const { GET: freshGET } = await import("../route");
      const response = await freshGET(makeRequest("10.1.0.1"));

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("30");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("29");
      const reset = response.headers.get("X-RateLimit-Reset");
      expect(reset).toBeDefined();
      expect(Number.isNaN(Date.parse(reset!))).toBe(false);
    });

    it("blocks 31st request from same IP within the minute window", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCerebrasModels),
      }) as unknown as typeof fetch;

      const { GET: freshGET } = await import("../route");
      const ip = "10.1.0.2";

      // Make 30 successful requests (subsequent ones hit the in-memory cache,
      // but rate-limit counting runs before cache lookup)
      for (let i = 0; i < 30; i++) {
        const response = await freshGET(makeRequest(ip));
        expect(response.status).toBe(200);
      }

      const blocked = await freshGET(makeRequest(ip));

      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("X-RateLimit-Limit")).toBe("30");
      expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(blocked.headers.get("X-RateLimit-Reset")).toBeDefined();

      const body = (await blocked.json()) as {
        error: string;
        message: string;
        resetAt: number;
      };
      expect(body.error).toBe("Rate limit exceeded");
      expect(body.message).toContain("30 requests per minute");
      expect(typeof body.resetAt).toBe("number");
    });

    it("uses independent buckets per IP", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCerebrasModels),
      }) as unknown as typeof fetch;

      const { GET: freshGET } = await import("../route");

      // Exhaust IP A
      for (let i = 0; i < 30; i++) {
        await freshGET(makeRequest("10.1.0.3"));
      }
      const blockedA = await freshGET(makeRequest("10.1.0.3"));
      expect(blockedA.status).toBe(429);

      // IP B is still fresh
      const okB = await freshGET(makeRequest("10.1.0.4"));
      expect(okB.status).toBe(200);
      expect(okB.headers.get("X-RateLimit-Remaining")).toBe("29");
    });
  });
});
