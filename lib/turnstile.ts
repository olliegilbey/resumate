/**
 * Shared Cloudflare Turnstile verification helper.
 *
 * Centralizes the call to `https://challenges.cloudflare.com/turnstile/v0/siteverify`
 * so every API route uses the same verification behavior, timeout, and dev-bypass rules.
 *
 * Security note: the dev bypass requires BOTH `NODE_ENV === "development"` and
 * `ENABLE_TURNSTILE_DEV_BYPASS === "true"`. A single flag is intentionally not
 * enough — `NODE_ENV` is often non-`"production"` on Vercel preview deploys, so
 * the paired opt-in flag prevents a coarse check from accidentally disabling
 * Turnstile outside of local development.
 */

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5000;

/**
 * Verify a Cloudflare Turnstile token server-side.
 *
 * Returns `true` only when Cloudflare confirms the token is valid, or when the
 * dual-flag dev bypass is active.
 *
 * @param token - The Turnstile token produced by the client-side widget.
 * @returns Promise resolving to `true` when verification succeeds, `false` otherwise
 *          (missing secret, network error, timeout, or Cloudflare rejection).
 *
 * @example
 * ```ts
 * import { verifyTurnstileToken } from "@/lib/turnstile";
 *
 * export async function POST(request: NextRequest) {
 *   const { token } = await request.json();
 *   if (!(await verifyTurnstileToken(token))) {
 *     return NextResponse.json({ error: "Verification failed" }, { status: 403 });
 *   }
 *   // ... proceed
 * }
 * ```
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  // Dev bypass: BOTH conditions required. Flag alone would also fire on Vercel
  // preview deploys, so we gate on NODE_ENV first.
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ENABLE_TURNSTILE_DEV_BYPASS === "true"
  ) {
    return true;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY not configured");
    return false;
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });

    const data = (await response.json()) as TurnstileResponse;
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}
