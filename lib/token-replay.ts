/**
 * In-memory TTL-based token replay guard.
 *
 * Prevents Turnstile token replay within the lifetime of a serverless function
 * instance. Entries older than the TTL (default 5 minutes, matching Turnstile
 * token validity) are swept on every access so the underlying `Map` cannot grow
 * unbounded on a warm instance.
 *
 * The atomic `beginVerification` / `markVerified` / `cancelVerification` trio
 * closes the TOCTOU (mark-then-verify) window: a token is reserved *before* the
 * async Cloudflare call, promoted to "used" on success, or released on failure
 * so a user can retry after a transient error.
 *
 * Limitations: module-scoped state lives only in a single serverless instance.
 * A distributed deployment at scale would need Redis/KV with the same TTL
 * semantics. Acceptable for the current single-instance deployment.
 */

/** Default TTL — matches Cloudflare Turnstile token validity window. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface UsedEntry {
  seenAt: number;
}

/**
 * Guards against Turnstile token replay with atomic reservation semantics.
 *
 * @example
 * ```ts
 * const replayGuard = new TokenReplayGuard();
 *
 * if (!replayGuard.beginVerification(token)) {
 *   return NextResponse.json({ error: "Token already used" }, { status: 403 });
 * }
 * const ok = await verifyTurnstileToken(token);
 * if (!ok) {
 *   replayGuard.cancelVerification(token);
 *   return NextResponse.json({ error: "Verification failed" }, { status: 403 });
 * }
 * replayGuard.markVerified(token);
 * ```
 */
export class TokenReplayGuard {
  private readonly used = new Map<string, UsedEntry>();
  private readonly pending = new Set<string>();
  private readonly ttlMs: number;

  /**
   * @param ttlMs - How long a used token is remembered, in milliseconds.
   *                Defaults to 5 minutes (Turnstile's own validity window).
   */
  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Drop used entries whose age exceeds the TTL. Called implicitly by all
   * public methods — callers do not need to invoke this directly.
   */
  private sweep(now: number = Date.now()): void {
    const cutoff = now - this.ttlMs;
    for (const [token, entry] of this.used) {
      if (entry.seenAt <= cutoff) {
        this.used.delete(token);
      }
    }
  }

  /**
   * Check whether a token has already been verified (and not yet expired).
   *
   * @param token - The token to check.
   * @returns `true` if the token was previously marked verified within the TTL.
   *
   * @example
   * ```ts
   * guard.mark("abc");
   * guard.has("abc"); // true
   * ```
   */
  has(token: string): boolean {
    this.sweep();
    return this.used.has(token);
  }

  /**
   * Atomically reserve a token for verification. Returns `false` if the token
   * is already used or already pending — the caller must short-circuit.
   *
   * Pair with `markVerified` on success or `cancelVerification` on failure.
   *
   * @param token - The token to reserve.
   * @returns `true` if the reservation succeeded, `false` if the token was
   *          already used or pending.
   *
   * @example
   * ```ts
   * if (!guard.beginVerification(token)) {
   *   return denyResponse();
   * }
   * ```
   */
  beginVerification(token: string): boolean {
    this.sweep();
    if (this.used.has(token) || this.pending.has(token)) {
      return false;
    }
    this.pending.add(token);
    return true;
  }

  /**
   * Promote a pending reservation to a verified entry. Idempotent: safe to
   * call even if the token is no longer pending (e.g. double-call in error
   * handling paths).
   *
   * @param token - The token whose verification just succeeded.
   *
   * @example
   * ```ts
   * guard.beginVerification(token);
   * if (await verify(token)) guard.markVerified(token);
   * ```
   */
  markVerified(token: string): void {
    this.pending.delete(token);
    this.used.set(token, { seenAt: Date.now() });
  }

  /**
   * Release a pending reservation without marking it used. Call this after a
   * verification failure (network error, Cloudflare 5xx, rejected token) so a
   * legitimate user can retry without a transient error permanently burning
   * their token.
   *
   * @param token - The token whose verification failed.
   *
   * @example
   * ```ts
   * guard.beginVerification(token);
   * if (!(await verify(token))) guard.cancelVerification(token);
   * ```
   */
  cancelVerification(token: string): void {
    this.pending.delete(token);
  }

  /**
   * Directly mark a token as used without going through the pending phase.
   * Useful when the caller has no async verification step to wrap.
   *
   * @param token - The token to record.
   *
   * @example
   * ```ts
   * guard.mark(generationToken);
   * ```
   */
  mark(token: string): void {
    this.sweep();
    this.used.set(token, { seenAt: Date.now() });
  }
}
