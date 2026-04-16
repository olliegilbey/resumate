import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAIBullets } from "../pipeline";

/**
 * Contract tests for the pipeline's non-OK error body handling.
 *
 * Protects the UI modal from rendering raw Cloudflare/Vercel HTML error pages
 * (a regression that surfaced on iPad when the Vercel function timed out and
 * Cloudflare returned a 520 page). Before this fix, the full HTML document
 * was dumped verbatim into the error panel.
 */

const originalFetch = global.fetch;

describe("fetchAIBullets — error body sanitization", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("collapses an HTML 520 error page into a short friendly message", async () => {
    const htmlBody = `<!DOCTYPE html><html><head><title>520</title></head><body>${"x".repeat(5000)}</body></html>`;
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 520,
      statusText: "",
      headers: new Headers({ "content-type": "text/html; charset=UTF-8" }),
      json: async () => {
        throw new Error("not json");
      },
      text: async () => htmlBody,
    });

    await expect(
      fetchAIBullets({
        jobDescription: "jd",
        provider: "cerebras-gpt",
        turnstileToken: "tok",
        sessionId: "sid",
        onRetryAttempt: vi.fn(),
      }),
    ).rejects.toThrow(/HTTP 520/);

    // And critically: the thrown message must NOT contain raw HTML markup.
    try {
      await fetchAIBullets({
        jobDescription: "jd",
        provider: "cerebras-gpt",
        turnstileToken: "tok",
        sessionId: "sid",
        onRetryAttempt: vi.fn(),
      });
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("<!DOCTYPE");
      expect(msg).not.toContain("<html");
      expect(msg.length).toBeLessThan(300);
    }
  });

  it("passes through structured JSON error bodies unchanged", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        userMessage: "This AI model is busy right now. Please try a different model.",
        retriesAttempted: 1,
      }),
    });

    const onRetryAttempt = vi.fn();
    await expect(
      fetchAIBullets({
        jobDescription: "jd",
        provider: "cerebras-gpt",
        turnstileToken: "tok",
        sessionId: "sid",
        onRetryAttempt,
      }),
    ).rejects.toThrow("This AI model is busy right now. Please try a different model.");
    expect(onRetryAttempt).toHaveBeenCalledWith(1);
  });

  it("caps oversized plain-text error bodies", async () => {
    const longText = "a".repeat(2000);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: "",
      headers: new Headers({ "content-type": "text/plain" }),
      json: async () => {
        throw new Error("not json");
      },
      text: async () => longText,
    });

    try {
      await fetchAIBullets({
        jobDescription: "jd",
        provider: "cerebras-gpt",
        turnstileToken: "tok",
        sessionId: "sid",
        onRetryAttempt: vi.fn(),
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as Error).message.length).toBeLessThanOrEqual(301); // 300 + ellipsis
    }
  });
});
