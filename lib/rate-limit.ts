/**
 * Simple in-memory rate limiter
 * For production with multiple instances, consider Redis
 */

interface RateLimitRecord {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitRecord>()

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 10 * 60 * 1000)

export interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number
  /** Window duration in milliseconds */
  window: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Check rate limit for a given identifier (usually IP address)
 *
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const record = rateLimitStore.get(identifier)

  // No record or expired window - allow and create new record
  if (!record || record.resetAt < now) {
    const resetAt = now + config.window
    rateLimitStore.set(identifier, { count: 1, resetAt })

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: resetAt,
    }
  }

  // Within window - check if limit exceeded
  if (record.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: record.resetAt,
    }
  }

  // Increment count
  record.count++
  rateLimitStore.set(identifier, record)

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - record.count,
    reset: record.resetAt,
  }
}

/**
 * Get client IP address from request
 * Handles Vercel/CloudFlare proxies
 *
 * @param request - Next.js request object
 * @returns IP address or 'unknown'
 */
export function getClientIP(request: Request): string {
  // Try various headers in order of preference
  const headers = request.headers

  // Cloudflare
  const cfConnectingIP = headers.get('cf-connecting-ip')
  if (cfConnectingIP) return cfConnectingIP

  // Vercel
  const xRealIP = headers.get('x-real-ip')
  if (xRealIP) return xRealIP

  // Standard forwarded-for (take first IP)
  const xForwardedFor = headers.get('x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }

  return 'unknown'
}
