import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TokenReplayGuard } from "@/lib/token-replay";

describe("TokenReplayGuard", () => {
  describe("basic mark + has", () => {
    it("mark then has returns true", () => {
      const guard = new TokenReplayGuard();
      expect(guard.has("abc")).toBe(false);
      guard.mark("abc");
      expect(guard.has("abc")).toBe(true);
    });

    it("unknown tokens are not reported as used", () => {
      const guard = new TokenReplayGuard();
      expect(guard.has("never-seen")).toBe(false);
    });
  });

  describe("TTL expiry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("sweeps entries older than the TTL (default 5 min)", () => {
      const guard = new TokenReplayGuard();
      guard.mark("token");
      expect(guard.has("token")).toBe(true);

      // Advance past the 5-minute Turnstile validity window.
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      expect(guard.has("token")).toBe(false);
    });

    it("retains entries still within the TTL", () => {
      const guard = new TokenReplayGuard();
      guard.mark("token");

      vi.advanceTimersByTime(4 * 60 * 1000); // 4 min

      expect(guard.has("token")).toBe(true);
    });

    it("honors a custom TTL", () => {
      const guard = new TokenReplayGuard(1000); // 1 second
      guard.mark("token");
      expect(guard.has("token")).toBe(true);

      vi.advanceTimersByTime(1001);

      expect(guard.has("token")).toBe(false);
    });
  });

  describe("atomic pending → used", () => {
    it("beginVerification reserves a token so a concurrent begin fails", () => {
      const guard = new TokenReplayGuard();
      expect(guard.beginVerification("t")).toBe(true);
      // Second attempt with the same token must be rejected while pending.
      expect(guard.beginVerification("t")).toBe(false);
    });

    it("markVerified promotes pending → used (future begins rejected)", () => {
      const guard = new TokenReplayGuard();
      guard.beginVerification("t");
      guard.markVerified("t");

      expect(guard.has("t")).toBe(true);
      expect(guard.beginVerification("t")).toBe(false);
    });

    it("cancelVerification releases the reservation so retry is allowed", () => {
      const guard = new TokenReplayGuard();
      guard.beginVerification("t");
      guard.cancelVerification("t");

      expect(guard.has("t")).toBe(false);
      // After cancel, the token is eligible for a fresh verification attempt.
      expect(guard.beginVerification("t")).toBe(true);
    });

    it("prevents the mark-then-verify race: two concurrent verifies cannot both pass", () => {
      // Models the #16 race: two requests arrive simultaneously with the same
      // token. With atomic reservation, only the first gets to run verify.
      const guard = new TokenReplayGuard();

      const firstReserved = guard.beginVerification("race-token");
      const secondReserved = guard.beginVerification("race-token");

      expect(firstReserved).toBe(true);
      expect(secondReserved).toBe(false);

      // First request succeeds → marked used. Late duplicates still blocked.
      guard.markVerified("race-token");
      expect(guard.beginVerification("race-token")).toBe(false);
    });

    it("cancelVerification is a no-op for unknown tokens (idempotent)", () => {
      const guard = new TokenReplayGuard();
      expect(() => guard.cancelVerification("never-reserved")).not.toThrow();
      expect(guard.has("never-reserved")).toBe(false);
    });

    it("markVerified without a prior beginVerification still records usage", () => {
      const guard = new TokenReplayGuard();
      guard.markVerified("t");
      expect(guard.has("t")).toBe(true);
    });
  });
});
