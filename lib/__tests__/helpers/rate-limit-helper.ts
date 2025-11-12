import { beforeEach, afterEach } from 'vitest'
import { clearRateLimitStore } from '@/lib/rate-limit'

/**
 * Helper to reset rate limit store between tests
 * Ensures tests are isolated and don't affect each other
 */

/**
 * Setup rate limit cleanup hooks
 * Call this in describe() block:
 *
 * @example
 * describe('My API tests', () => {
 *   setupRateLimitCleanup()
 *
 *   test('rate limiting works', () => {
 *     // Test here
 *   })
 * })
 */
export function setupRateLimitCleanup() {
  beforeEach(() => {
    clearRateLimitStore()
  })

  afterEach(() => {
    clearRateLimitStore()
  })
}

/**
 * Manually clear rate limit store
 * Use when you need explicit control
 */
export function clearRateLimits() {
  clearRateLimitStore()
}
