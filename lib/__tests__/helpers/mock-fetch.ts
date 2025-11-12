import { vi } from 'vitest'

/**
 * Mock fetch for Turnstile API verification
 * Cloudflare Turnstile endpoint: https://challenges.cloudflare.com/turnstile/v0/siteverify
 */

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
}

// Store original fetch to restore later
const originalFetch = global.fetch

/**
 * Mock successful Turnstile verification
 */
export function mockTurnstileSuccess() {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async (): Promise<TurnstileResponse> => ({
      success: true,
      challenge_ts: new Date().toISOString(),
      hostname: 'localhost',
    }),
  })

  global.fetch = mockFetch as any
  return mockFetch
}

/**
 * Mock failed Turnstile verification
 */
export function mockTurnstileFailure(errorCodes: string[] = ['invalid-input-response']) {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async (): Promise<TurnstileResponse> => ({
      success: false,
      'error-codes': errorCodes,
    }),
  })

  global.fetch = mockFetch as any
  return mockFetch
}

/**
 * Mock Turnstile API network error
 */
export function mockTurnstileNetworkError() {
  const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))

  global.fetch = mockFetch as any
  return mockFetch
}

/**
 * Mock custom fetch response
 * Useful for testing edge cases
 */
export function mockFetch(response: Partial<Response> & { json?: () => Promise<any> }) {
  const mockFetch = vi.fn().mockResolvedValue(response)
  global.fetch = mockFetch as any
  return mockFetch
}

/**
 * Restore original fetch
 * Use in afterEach cleanup
 */
export function restoreFetch() {
  global.fetch = originalFetch
  vi.restoreAllMocks()
}
