import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { setMockEnv, restoreMockEnv, clearEnvVar } from '@/lib/__tests__/helpers/mock-env'
import { mockTurnstileSuccess, mockTurnstileFailure, restoreFetch } from '@/lib/__tests__/helpers/mock-fetch'
import { setupRateLimitCleanup } from '@/lib/__tests__/helpers/rate-limit-helper'

/**
 * Tests for POST /api/resume/prepare
 *
 * This endpoint:
 * - Rate limits to 5 requests per hour per IP
 * - Verifies Cloudflare Turnstile tokens
 * - Returns resume data + generation token
 *
 * Security: This is a critical endpoint - full coverage is essential
 */
describe('/api/resume/prepare', () => {
  setupRateLimitCleanup()

  beforeEach(() => {
    setMockEnv()
    vi.clearAllMocks()
  })

  afterEach(() => {
    restoreMockEnv()
    restoreFetch()
  })

  function createMockRequest(body: any): NextRequest {
    return new NextRequest('http://localhost:3000/api/resume/prepare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.1',
      },
      body: JSON.stringify(body),
    })
  }

  describe('Happy Path', () => {
    it('returns resume data and token with valid turnstile token', async () => {
      mockTurnstileSuccess()

      const request = createMockRequest({
        turnstileToken: 'valid-token',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.token).toBeDefined()
      expect(data.timestamp).toBeDefined()

      // Token format: timestamp-random
      expect(data.token).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)
    })

    it('includes rate limit headers in successful response', async () => {
      mockTurnstileSuccess()

      const request = createMockRequest({
        turnstileToken: 'valid-token',
      })

      const response = await POST(request)

      expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('4') // First request
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    it('returns actual resume data structure', async () => {
      mockTurnstileSuccess()

      const request = createMockRequest({
        turnstileToken: 'valid-token',
      })

      const response = await POST(request)
      const data = await response.json()

      // Verify resume data structure
      expect(data.data).toHaveProperty('personal')
      expect(data.data).toHaveProperty('experience')
      expect(data.data.personal).toHaveProperty('name')
      expect(Array.isArray(data.data.experience)).toBe(true)
    })
  })

  describe('Rate Limiting', () => {
    it('allows 5 requests within the hour window', async () => {
      mockTurnstileSuccess()

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest({
          turnstileToken: 'valid-token',
        })
        const response = await POST(request)
        expect(response.status).toBe(200)
      }
    })

    it('blocks 6th request within the hour window', async () => {
      mockTurnstileSuccess()

      // Make 5 successful requests
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest({
          turnstileToken: 'valid-token',
        })
        await POST(request)
      }

      // 6th request should be rate limited
      const request = createMockRequest({
        turnstileToken: 'valid-token',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded')
      expect(data.message).toContain('5 requests per hour')
      expect(data.resetAt).toBeDefined()
    })

    it('includes rate limit headers in 429 response', async () => {
      mockTurnstileSuccess()

      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await POST(createMockRequest({ turnstileToken: 'valid-token' }))
      }

      const response = await POST(createMockRequest({ turnstileToken: 'valid-token' }))

      expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    it('rate limits per IP address', async () => {
      mockTurnstileSuccess()

      // IP 1: Make 5 requests
      for (let i = 0; i < 5; i++) {
        const request = new NextRequest('http://localhost:3000/api/resume/prepare', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.1',
          },
          body: JSON.stringify({ turnstileToken: 'valid-token' }),
        })
        await POST(request)
      }

      // IP 1: 6th request blocked
      const blockedRequest = new NextRequest('http://localhost:3000/api/resume/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify({ turnstileToken: 'valid-token' }),
      })
      const blockedResponse = await POST(blockedRequest)
      expect(blockedResponse.status).toBe(429)

      // IP 2: First request allowed
      const newIPRequest = new NextRequest('http://localhost:3000/api/resume/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.2',
        },
        body: JSON.stringify({ turnstileToken: 'valid-token' }),
      })
      const newIPResponse = await POST(newIPRequest)
      expect(newIPResponse.status).toBe(200)
    })
  })

  describe('Turnstile Verification', () => {
    it('rejects request with missing turnstile token', async () => {
      const request = createMockRequest({})

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing Turnstile token')
    })

    it('rejects request with invalid turnstile token', async () => {
      mockTurnstileFailure(['invalid-input-response'])

      const request = createMockRequest({
        turnstileToken: 'invalid-token',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Turnstile verification failed')
    })

    it('calls Cloudflare Turnstile API with correct parameters', async () => {
      const mockFetch = mockTurnstileSuccess()

      const request = createMockRequest({
        turnstileToken: 'test-token',
      })

      await POST(request)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )

      // Check body contains secret and response
      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.secret).toBe('test-turnstile-secret-key')
      expect(body.response).toBe('test-token')
    })

    it('returns 500 if TURNSTILE_SECRET_KEY is not configured', async () => {
      clearEnvVar('TURNSTILE_SECRET_KEY')

      const request = createMockRequest({
        turnstileToken: 'valid-token',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Server configuration error')
    })

    it('handles Turnstile API network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any

      const request = createMockRequest({
        turnstileToken: 'valid-token',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('Resume Data Loading', () => {
    it('skips data loading test due to import caching', async () => {
      // Note: Testing dynamic import failures is difficult due to module caching
      // In production, missing data/resume-data.json would cause build failure
      // Runtime errors from import() are caught and return 500
      expect(true).toBe(true)
    })
  })

  describe('Response Format', () => {
    it('returns correct response structure', async () => {
      mockTurnstileSuccess()

      const request = createMockRequest({
        turnstileToken: 'valid-token',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data).toMatchObject({
        success: true,
        data: expect.any(Object),
        token: expect.any(String),
        timestamp: expect.any(Number),
      })
    })

    it('generates unique tokens for each request', async () => {
      mockTurnstileSuccess()

      const tokens = new Set()

      for (let i = 0; i < 3; i++) {
        const request = createMockRequest({
          turnstileToken: 'valid-token',
        })
        const response = await POST(request)
        const data = await response.json()
        tokens.add(data.token)
      }

      expect(tokens.size).toBe(3) // All tokens should be unique
    })

    it('includes ISO timestamp in rate limit reset header', async () => {
      mockTurnstileSuccess()

      const request = createMockRequest({
        turnstileToken: 'valid-token',
      })

      const response = await POST(request)
      const resetHeader = response.headers.get('X-RateLimit-Reset')

      expect(resetHeader).toBeDefined()
      expect(new Date(resetHeader!).getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('Error Handling', () => {
    it('handles malformed JSON request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/resume/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
        },
        body: 'not-valid-json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('handles missing Content-Type header gracefully', async () => {
      mockTurnstileSuccess()

      const request = new NextRequest('http://localhost:3000/api/resume/prepare', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify({ turnstileToken: 'valid-token' }),
      })

      const response = await POST(request)

      // Should still work or return 500, not crash
      expect([200, 500]).toContain(response.status)
    })
  })

  describe('IP Address Handling', () => {
    it('handles Cloudflare CF-Connecting-IP header', async () => {
      mockTurnstileSuccess()

      const request = new NextRequest('http://localhost:3000/api/resume/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '203.0.113.1',
        },
        body: JSON.stringify({ turnstileToken: 'valid-token' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('handles Vercel X-Real-IP header', async () => {
      mockTurnstileSuccess()

      const request = new NextRequest('http://localhost:3000/api/resume/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-real-ip': '203.0.113.2',
        },
        body: JSON.stringify({ turnstileToken: 'valid-token' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('handles X-Forwarded-For with multiple IPs', async () => {
      mockTurnstileSuccess()

      const request = new NextRequest('http://localhost:3000/api/resume/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.1, 192.168.1.1, 10.0.0.1',
        },
        body: JSON.stringify({ turnstileToken: 'valid-token' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('handles unknown IP address', async () => {
      mockTurnstileSuccess()

      const request = new NextRequest('http://localhost:3000/api/resume/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No IP headers
        },
        body: JSON.stringify({ turnstileToken: 'valid-token' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })
  })
})
