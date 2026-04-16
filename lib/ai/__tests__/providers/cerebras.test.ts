import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CerebrasProvider, createCerebrasProvider } from "../../providers/cerebras";
import { AISelectionError } from "../../errors";
import type { ResumeData } from "@/lib/types/generated-resume";

// Minimal compendium for testing
const mockCompendium: ResumeData = {
  personal: { name: "Test User" },
  experience: [
    {
      id: "company-a",
      name: "Test Corp",
      dateStart: "2020-01",
      priority: 5,
      tags: ["tech"],
      children: [
        {
          id: "company-a-pos",
          name: "Engineer",
          dateStart: "2020-01",
          priority: 5,
          tags: ["dev"],
          children: [
            {
              id: "bullet-1",
              description: "Built APIs",
              priority: 8,
              tags: ["api"],
            },
            {
              id: "bullet-2",
              description: "Led team",
              priority: 7,
              tags: ["leadership"],
            },
          ],
        },
      ],
    },
  ],
};

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("CerebrasProvider", () => {
  const originalEnv = process.env.CEREBRAS_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CEREBRAS_API_KEY = "test-api-key";
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.CEREBRAS_API_KEY = originalEnv;
    } else {
      delete process.env.CEREBRAS_API_KEY;
    }
  });

  describe("constructor", () => {
    it("creates gpt provider with correct config", () => {
      const provider = new CerebrasProvider("cerebras-gpt");

      expect(provider.name).toBe("cerebras-gpt");
      expect(provider.config.model).toBe("qwen-3-235b-a22b-instruct-2507");
      expect(provider.config.provider).toBe("cerebras");
      expect(provider.config.cost).toBe("free");
    });

    it("creates llama provider with correct config", () => {
      const provider = new CerebrasProvider("cerebras-llama");

      expect(provider.name).toBe("cerebras-llama");
      expect(provider.config.model).toBe("llama3.1-8b");
    });

    it("defaults to qwen-3-235b-a22b-instruct-2507", () => {
      const provider = new CerebrasProvider();

      expect(provider.name).toBe("cerebras-gpt");
    });
  });

  describe("isAvailable", () => {
    it("returns true when API key set", () => {
      process.env.CEREBRAS_API_KEY = "csk-test";
      const provider = new CerebrasProvider();

      expect(provider.isAvailable()).toBe(true);
    });

    it("returns false when API key missing", () => {
      delete process.env.CEREBRAS_API_KEY;
      const provider = new CerebrasProvider();

      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe("select", () => {
    it("throws when API key not configured", async () => {
      delete process.env.CEREBRAS_API_KEY;
      const provider = new CerebrasProvider();

      try {
        await provider.select({
          jobDescription: "Test job",
          compendium: mockCompendium,
          maxBullets: 2,
          minBullets: 2,
        });
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(AISelectionError);
        const err = e as AISelectionError;
        expect(err.errors[0]!.code).toBe("E011_PROVIDER_DOWN");
      }
    });

    it("calls API with correct parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  bullets: [
                    { id: "bullet-1", score: 0.95 },
                    { id: "bullet-2", score: 0.88 },
                  ],
                  reasoning: "Selected relevant bullets",
                  job_title: "Software Engineer",
                  salary: null,
                }),
              },
            },
          ],
          usage: { total_tokens: 150 },
        }),
      });

      const provider = new CerebrasProvider("cerebras-gpt");
      await provider.select({
        jobDescription: "We need an engineer",
        compendium: mockCompendium,
        maxBullets: 2,
        minBullets: 2,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cerebras.ai/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          },
          body: expect.stringContaining('"model":"qwen-3-235b-a22b-instruct-2507"'),
        }),
      );

      const body = JSON.parse((mockFetch.mock.calls[0] as any)[1].body) as any;
      expect(body.model).toBe("qwen-3-235b-a22b-instruct-2507");
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[1].role).toBe("user");
      expect(body.max_tokens).toBe(4096);
      expect(body.temperature).toBe(0.3);
    });

    it("parses valid AI response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  bullets: [
                    { id: "bullet-1", score: 0.95 },
                    { id: "bullet-2", score: 0.88 },
                  ],
                  reasoning: "API + leadership match job",
                  job_title: "Backend Developer",
                  salary: { min: 100000, max: 150000, currency: "USD", period: "annual" },
                }),
              },
            },
          ],
          usage: { total_tokens: 200 },
        }),
      });

      const provider = new CerebrasProvider();
      const result = await provider.select({
        jobDescription: "Backend developer needed",
        compendium: mockCompendium,
        maxBullets: 2,
        minBullets: 2,
      });

      expect(result.bullets).toEqual([
        { id: "bullet-1", score: 0.95 },
        { id: "bullet-2", score: 0.88 },
      ]);
      expect(result.reasoning).toBe("API + leadership match job");
      expect(result.jobTitle).toBe("Backend Developer");
      expect(result.salary).toEqual({
        min: 100000,
        max: 150000,
        currency: "USD",
        period: "annual",
      });
      expect(result.tokensUsed).toBe(200);
      expect(result.provider).toBe("cerebras-gpt");
    });

    it("throws on invalid bullet IDs", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  bullets: [
                    { id: "bullet-1", score: 0.95 },
                    { id: "nonexistent-bullet", score: 0.85 },
                  ],
                  reasoning: "Test",
                  job_title: null,
                  salary: null,
                }),
              },
            },
          ],
        }),
      });

      const provider = new CerebrasProvider();

      try {
        await provider.select({
          jobDescription: "Test",
          compendium: mockCompendium,
          maxBullets: 2,
          minBullets: 2,
        });
        expect.fail("Should have thrown");
      } catch (e) {
        const err = e as AISelectionError;
        expect(err.errors[0]!.code).toBe("E005_INVALID_BULLET_ID");
      }
    });

    it("throws on wrong bullet count", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  bullets: [{ id: "bullet-1", score: 0.95 }],
                  reasoning: "Test",
                  job_title: null,
                  salary: null,
                }),
              },
            },
          ],
        }),
      });

      const provider = new CerebrasProvider();

      try {
        await provider.select({
          jobDescription: "Test",
          compendium: mockCompendium,
          maxBullets: 2,
          minBullets: 2,
        });
        expect.fail("Should have thrown");
      } catch (e) {
        const err = e as AISelectionError;
        expect(err.errors[0]!.code).toBe("E004_WRONG_BULLET_COUNT");
      }
    });

    it("handles rate limit error as provider busy (not down)", async () => {
      // Cerebras free-tier Qwen often returns 429 `queue_exceeded` under
      // transient traffic. The orchestrator still stops retrying this
      // provider, but the user message should say "busy" not "unavailable".
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: "Rate limited", type: "rate_limit_error" },
        }),
      });

      const provider = new CerebrasProvider();

      try {
        await provider.select({
          jobDescription: "Test",
          compendium: mockCompendium,
          maxBullets: 2,
          minBullets: 2,
        });
        expect.fail("Should have thrown");
      } catch (e) {
        const err = e as AISelectionError;
        expect(err.errors[0]!.code).toBe("E012_PROVIDER_BUSY");
      }
    });

    it("handles 404 (model not found) as provider down", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: { message: "Model does not exist", type: "not_found_error" },
        }),
      });

      const provider = new CerebrasProvider();

      try {
        await provider.select({
          jobDescription: "Test",
          compendium: mockCompendium,
          maxBullets: 2,
          minBullets: 2,
        });
        expect.fail("Should have thrown");
      } catch (e) {
        const err = e as AISelectionError;
        expect(err.errors[0]!.code).toBe("E011_PROVIDER_DOWN");
      }
    });

    it("handles 5xx error as provider down", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: { message: "Service unavailable", type: "server_error" },
        }),
      });

      const provider = new CerebrasProvider();

      try {
        await provider.select({
          jobDescription: "Test",
          compendium: mockCompendium,
          maxBullets: 2,
          minBullets: 2,
        });
        expect.fail("Should have thrown");
      } catch (e) {
        const err = e as AISelectionError;
        expect(err.errors[0]!.code).toBe("E011_PROVIDER_DOWN");
      }
    });

    it("handles AbortSignal timeout as provider busy (not down)", async () => {
      // AbortSignal.timeout fires a DOMException with name="TimeoutError".
      // Cerebras queueing can exceed the 50s client timeout on popular free-
      // tier models, so the timeout path should yield the "busy" message and
      // not the generic "unavailable" one.
      const timeoutError = new DOMException("The operation timed out.", "TimeoutError");
      mockFetch.mockRejectedValueOnce(timeoutError);

      const provider = new CerebrasProvider();

      try {
        await provider.select({
          jobDescription: "Test",
          compendium: mockCompendium,
          maxBullets: 2,
          minBullets: 2,
        });
        expect.fail("Should have thrown");
      } catch (e) {
        const err = e as AISelectionError;
        expect(err.errors[0]!.code).toBe("E012_PROVIDER_BUSY");
      }
    });

    it("handles network error as provider down", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fetch failed"));

      const provider = new CerebrasProvider();

      try {
        await provider.select({
          jobDescription: "Test",
          compendium: mockCompendium,
          maxBullets: 2,
          minBullets: 2,
        });
        expect.fail("Should have thrown");
      } catch (e) {
        const err = e as AISelectionError;
        expect(err.errors[0]!.code).toBe("E011_PROVIDER_DOWN");
        expect(err.message).toContain("fetch failed");
      }
    });

    it("handles empty response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "" } }],
        }),
      });

      const provider = new CerebrasProvider();

      try {
        await provider.select({
          jobDescription: "Test",
          compendium: mockCompendium,
          maxBullets: 2,
          minBullets: 2,
        });
        expect.fail("Should have thrown");
      } catch (e) {
        const err = e as AISelectionError;
        expect(err.errors[0]!.code).toBe("E001_NO_JSON_FOUND");
      }
    });

    it("includes retry context in prompt when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  bullets: [
                    { id: "bullet-1", score: 0.95 },
                    { id: "bullet-2", score: 0.88 },
                  ],
                  reasoning: "Fixed the issue",
                  job_title: null,
                  salary: null,
                }),
              },
            },
          ],
        }),
      });

      const provider = new CerebrasProvider();
      await provider.select({
        jobDescription: "Test job",
        compendium: mockCompendium,
        maxBullets: 2,
        minBullets: 2,
        retryContext: "error[E004_WRONG_BULLET_COUNT]: Expected 2, got 1",
      });

      const body = JSON.parse((mockFetch.mock.calls[0] as any)[1].body) as any;
      expect(body.messages[1].content).toContain("PREVIOUS RESPONSE HAD ERRORS");
      expect(body.messages[1].content).toContain("E004_WRONG_BULLET_COUNT");
    });

    it("uses llama model when configured", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  bullets: [
                    { id: "bullet-1", score: 0.95 },
                    { id: "bullet-2", score: 0.88 },
                  ],
                  reasoning: "Test",
                  job_title: null,
                  salary: null,
                }),
              },
            },
          ],
        }),
      });

      const provider = new CerebrasProvider("cerebras-llama");
      await provider.select({
        jobDescription: "Test",
        compendium: mockCompendium,
        maxBullets: 2,
        minBullets: 2,
      });

      const body = JSON.parse((mockFetch.mock.calls[0] as any)[1].body) as any;
      expect(body.model).toBe("llama3.1-8b");
    });
  });

  describe("createCerebrasProvider", () => {
    it("creates gpt provider by default", () => {
      const provider = createCerebrasProvider();
      expect(provider.name).toBe("cerebras-gpt");
    });

    it("creates llama provider when specified", () => {
      const provider = createCerebrasProvider("cerebras-llama");
      expect(provider.name).toBe("cerebras-llama");
    });
  });
});
