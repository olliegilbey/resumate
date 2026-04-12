import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyTurnstileToken } from "@/lib/turnstile";
import {
  mockTurnstileSuccess,
  mockTurnstileFailure,
  mockTurnstileNetworkError,
  restoreFetch,
} from "./helpers/mock-fetch";
import { setMockEnv, restoreMockEnv } from "./helpers/mock-env";

describe("verifyTurnstileToken", () => {
  afterEach(() => {
    restoreFetch();
    restoreMockEnv();
    delete process.env.ENABLE_TURNSTILE_DEV_BYPASS;
  });

  describe("dev bypass", () => {
    it("returns true when NODE_ENV=development AND ENABLE_TURNSTILE_DEV_BYPASS=true", async () => {
      setMockEnv({ nodeEnv: "development" });
      process.env.ENABLE_TURNSTILE_DEV_BYPASS = "true";
      const fetchMock = mockTurnstileSuccess();

      const ok = await verifyTurnstileToken("any-token");

      expect(ok).toBe(true);
      // Bypass must short-circuit without hitting Cloudflare.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does NOT bypass when only NODE_ENV=development (flag unset)", async () => {
      setMockEnv({ nodeEnv: "development" });
      const fetchMock = mockTurnstileSuccess();

      const ok = await verifyTurnstileToken("any-token");

      expect(ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("does NOT bypass when only ENABLE_TURNSTILE_DEV_BYPASS=true (production)", async () => {
      setMockEnv({ nodeEnv: "production" });
      process.env.ENABLE_TURNSTILE_DEV_BYPASS = "true";
      const fetchMock = mockTurnstileSuccess();

      const ok = await verifyTurnstileToken("any-token");

      expect(ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("does NOT bypass on preview-like env (NODE_ENV=production + flag=true)", async () => {
      // Simulates the Vercel preview deploy hazard: a coarse NODE_ENV !== "production"
      // check would have bypassed here; the dual-flag gate must not.
      setMockEnv({ nodeEnv: "production" });
      process.env.ENABLE_TURNSTILE_DEV_BYPASS = "true";
      const fetchMock = mockTurnstileFailure();

      const ok = await verifyTurnstileToken("any-token");

      expect(ok).toBe(false);
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  describe("real verification", () => {
    beforeEach(() => {
      setMockEnv({ nodeEnv: "test" });
    });

    it("returns true on Cloudflare success", async () => {
      mockTurnstileSuccess();
      await expect(verifyTurnstileToken("good-token")).resolves.toBe(true);
    });

    it("returns false on Cloudflare rejection", async () => {
      mockTurnstileFailure();
      await expect(verifyTurnstileToken("bad-token")).resolves.toBe(false);
    });

    it("returns false when TURNSTILE_SECRET_KEY is missing", async () => {
      setMockEnv({ turnstileSecret: undefined, nodeEnv: "test" });
      delete process.env.TURNSTILE_SECRET_KEY;
      const fetchMock = mockTurnstileSuccess();

      const ok = await verifyTurnstileToken("any-token");

      expect(ok).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns false on network error", async () => {
      mockTurnstileNetworkError();
      await expect(verifyTurnstileToken("any-token")).resolves.toBe(false);
    });

    it("sends secret + response in the POST body", async () => {
      const fetchMock = mockTurnstileSuccess();

      await verifyTurnstileToken("the-token");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("the-token"),
        }),
      );
    });
  });
});
