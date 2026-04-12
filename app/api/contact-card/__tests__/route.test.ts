import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { setMockEnv, restoreMockEnv, clearEnvVar } from "@/lib/__tests__/helpers/mock-env";
import {
  mockTurnstileSuccess,
  mockTurnstileFailure,
  restoreFetch,
} from "@/lib/__tests__/helpers/mock-fetch";
import { setupRateLimitCleanup } from "@/lib/__tests__/helpers/rate-limit-helper";

/**
 * Tests for /api/contact-card (GET and POST)
 *
 * Security-critical endpoint that:
 * - Verifies Cloudflare Turnstile tokens
 * - Prevents token replay attacks
 * - Never exposes contact info to client (server-only)
 * - Generates vCard files with env var data
 */
describe("/api/contact-card", () => {
  setupRateLimitCleanup();

  // Token counter to ensure unique tokens per test (token replay protection)
  let tokenCounter = 0;

  beforeEach(() => {
    setMockEnv();
    tokenCounter++;
  });

  /** Build a unique IP per test so rate-limit buckets do not leak across tests. */
  function testIP(): string {
    // tokenCounter increments per test; wrap within 254 to stay in a valid range
    return `10.0.0.${(tokenCounter % 254) + 1}`;
  }

  afterEach(() => {
    restoreMockEnv();
    restoreFetch();
  });

  function getUniqueToken(): string {
    return `test-token-${tokenCounter}-${Math.random().toString(36).substring(7)}`;
  }

  describe("GET Route", () => {
    it("returns vCard with valid token", async () => {
      mockTurnstileSuccess();

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), {
        method: "GET",
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/vcard;charset=utf-8");
      expect(response.headers.get("Content-Disposition")).toContain("attachment");
      expect(response.headers.get("Content-Disposition")).toContain(".vcf");
    });

    it("returns 400 if token is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/contact-card", {
        method: "GET",
      });

      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(400);
      expect(text).toBe("Missing verification token");
    });

    it("returns 403 if turnstile verification fails", async () => {
      mockTurnstileFailure();

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), {
        method: "GET",
      });

      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(403);
      expect(text).toBe("Verification failed");
    });

    it("includes cache-control headers", async () => {
      mockTurnstileSuccess();

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), { method: "GET" });
      const response = await GET(request);

      expect(response.headers.get("Cache-Control")).toBe("no-store, must-revalidate");
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    });
  });

  describe("POST Route - JSON", () => {
    it("returns vCard with valid token in JSON body", async () => {
      mockTurnstileSuccess();

      const request = new NextRequest("http://localhost:3000/api/contact-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: getUniqueToken() }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/vcard;charset=utf-8");
    });

    it("returns 400 if token is missing in JSON body", async () => {
      const request = new NextRequest("http://localhost:3000/api/contact-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const text = await response.text();

      expect(response.status).toBe(400);
      expect(text).toBe("Missing verification token");
    });
  });

  describe("POST Route - Form Data", () => {
    it("returns vCard with valid token in form data", async () => {
      mockTurnstileSuccess();

      const formData = new URLSearchParams();
      formData.append("token", getUniqueToken());

      const request = new NextRequest("http://localhost:3000/api/contact-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/vcard;charset=utf-8");
    });

    it("returns 400 if token is missing in form data", async () => {
      const formData = new URLSearchParams();

      const request = new NextRequest("http://localhost:3000/api/contact-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const response = await POST(request);
      const text = await response.text();

      expect(response.status).toBe(400);
      expect(text).toBe("Missing verification token");
    });
  });

  describe("vCard Content", () => {
    it("generates valid vCard structure", async () => {
      mockTurnstileSuccess();

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), { method: "GET" });
      const response = await GET(request);
      const vcard = await response.text();

      expect(vcard).toContain("BEGIN:VCARD");
      expect(vcard).toContain("VERSION:3.0");
      expect(vcard).toContain("END:VCARD");
      expect(vcard).toContain("FN:"); // Full name
      expect(vcard).toContain("N:"); // Name components
    });

    it("includes contact info from env vars", async () => {
      mockTurnstileSuccess();

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), { method: "GET" });
      const response = await GET(request);
      const vcard = await response.text();

      // Should contain email and phone from mock env
      expect(vcard).toContain("test@example.com");
      expect(vcard).toContain("+1234567890");
    });

    it("handles personal and professional emails", async () => {
      setMockEnv({
        contactEmailPersonal: "personal@example.com",
        contactEmailProfessional: "work@example.com",
      });
      mockTurnstileSuccess();

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), { method: "GET" });
      const response = await GET(request);
      const vcard = await response.text();

      expect(vcard).toContain("personal@example.com");
      expect(vcard).toContain("work@example.com");
    });
  });

  describe("Environment Variable Validation", () => {
    it("returns 500 if no email is configured", async () => {
      mockTurnstileSuccess();
      clearEnvVar("CONTACT_EMAIL_PERSONAL");
      clearEnvVar("CONTACT_EMAIL_PROFESSIONAL");

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), { method: "GET" });
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(text).toBe("Server configuration error");
    });

    it("returns 500 if phone is missing", async () => {
      mockTurnstileSuccess();
      clearEnvVar("CONTACT_PHONE");

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), { method: "GET" });
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(text).toBe("Server configuration error");
    });

    it("works with only personal email", async () => {
      setMockEnv({
        contactEmailPersonal: "personal@example.com",
        contactEmailProfessional: undefined,
      });
      mockTurnstileSuccess();

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), { method: "GET" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("works with only professional email", async () => {
      setMockEnv({
        contactEmailPersonal: undefined,
        contactEmailProfessional: "work@example.com",
      });
      mockTurnstileSuccess();

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), { method: "GET" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Error Handling", () => {
    it("handles malformed JSON gracefully", async () => {
      const request = new NextRequest("http://localhost:3000/api/contact-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "not-valid-json",
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it("returns 500 on internal errors", async () => {
      mockTurnstileSuccess();

      // Break env to cause error during vCard generation
      clearEnvVar("CONTACT_EMAIL_PERSONAL");
      clearEnvVar("CONTACT_EMAIL_PROFESSIONAL");
      clearEnvVar("CONTACT_PHONE");

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), { method: "GET" });
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });

  describe("Rate Limiting", () => {
    it("includes rate limit headers in successful GET response", async () => {
      mockTurnstileSuccess();

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), {
        method: "GET",
        headers: { "x-forwarded-for": testIP() },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("20");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("19");
      const reset = response.headers.get("X-RateLimit-Reset");
      expect(reset).toBeDefined();
      expect(Number.isNaN(Date.parse(reset!))).toBe(false);
    });

    it("blocks GET after 20 requests from same IP within the minute window", async () => {
      mockTurnstileSuccess();
      const ip = testIP();

      // Make 20 successful GETs
      for (let i = 0; i < 20; i++) {
        const url = new URL("http://localhost:3000/api/contact-card");
        url.searchParams.set("token", getUniqueToken());
        const request = new NextRequest(url.toString(), {
          method: "GET",
          headers: { "x-forwarded-for": ip },
        });
        const response = await GET(request);
        expect(response.status).toBe(200);
      }

      // 21st must be rate limited
      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());
      const blocked = await GET(
        new NextRequest(url.toString(), {
          method: "GET",
          headers: { "x-forwarded-for": ip },
        }),
      );

      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("X-RateLimit-Limit")).toBe("20");
      expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(blocked.headers.get("X-RateLimit-Reset")).toBeDefined();
      const body = (await blocked.json()) as {
        error: string;
        message: string;
        resetAt: number;
      };
      expect(body.error).toBe("Rate limit exceeded");
      expect(body.message).toContain("20 requests per minute");
      expect(typeof body.resetAt).toBe("number");
    });

    it("includes rate limit headers in successful POST response", async () => {
      mockTurnstileSuccess();

      const request = new NextRequest("http://localhost:3000/api/contact-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": testIP(),
        },
        body: JSON.stringify({ token: getUniqueToken() }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("9");
      expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
    });

    it("blocks POST after 10 requests from same IP within the minute window", async () => {
      mockTurnstileSuccess();
      const ip = testIP();

      for (let i = 0; i < 10; i++) {
        const request = new NextRequest("http://localhost:3000/api/contact-card", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({ token: getUniqueToken() }),
        });
        const response = await POST(request);
        expect(response.status).toBe(200);
      }

      const blocked = await POST(
        new NextRequest("http://localhost:3000/api/contact-card", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({ token: getUniqueToken() }),
        }),
      );

      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
      const body = (await blocked.json()) as {
        error: string;
        message: string;
        resetAt: number;
      };
      expect(body.error).toBe("Rate limit exceeded");
      expect(body.message).toContain("10 requests per minute");
      expect(typeof body.resetAt).toBe("number");
    });

    it("uses independent rate limit buckets for GET and POST", async () => {
      mockTurnstileSuccess();
      const ip = testIP();

      // Exhaust the GET bucket
      for (let i = 0; i < 20; i++) {
        const url = new URL("http://localhost:3000/api/contact-card");
        url.searchParams.set("token", getUniqueToken());
        await GET(
          new NextRequest(url.toString(), {
            method: "GET",
            headers: { "x-forwarded-for": ip },
          }),
        );
      }

      const getBlocked = await GET(
        new NextRequest(
          `http://localhost:3000/api/contact-card?token=${getUniqueToken()}`,
          { method: "GET", headers: { "x-forwarded-for": ip } },
        ),
      );
      expect(getBlocked.status).toBe(429);

      // POST from same IP should still succeed (independent bucket)
      const postResponse = await POST(
        new NextRequest("http://localhost:3000/api/contact-card", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({ token: getUniqueToken() }),
        }),
      );
      expect(postResponse.status).toBe(200);
      expect(postResponse.headers.get("X-RateLimit-Remaining")).toBe("9");
    });
  });

  describe("Content-Disposition Header", () => {
    it("generates filename from user name", async () => {
      mockTurnstileSuccess();

      const url = new URL("http://localhost:3000/api/contact-card");
      url.searchParams.set("token", getUniqueToken());

      const request = new NextRequest(url.toString(), { method: "GET" });
      const response = await GET(request);

      const disposition = response.headers.get("Content-Disposition");
      expect(disposition).toContain("attachment");
      expect(disposition).toContain("-contact.vcf");
      expect(disposition).toContain("filename="); // Has filename parameter
    });
  });
});
