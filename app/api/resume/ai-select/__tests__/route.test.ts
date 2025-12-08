/**
 * Tests for /api/resume/ai-select
 *
 * AI-powered bullet selection endpoint tests covering:
 * - Input validation
 * - Security (Turnstile, rate limiting, token replay)
 * - AI provider integration
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'
import {
  mockTurnstileSuccess,
  mockTurnstileFailure,
  restoreFetch,
} from '@/lib/__tests__/helpers/mock-fetch'
import { clearRateLimitStore } from '@/lib/rate-limit'

// Mock the AI provider module
vi.mock('@/lib/ai/providers', () => ({
  selectBulletsWithAI: vi.fn(),
  FALLBACK_ORDER: ['cerebras-gpt', 'claude-haiku', 'cerebras-llama', 'claude-sonnet'],
}))

// Mock PostHog
vi.mock('@/lib/posthog-server', () => ({
  captureEvent: vi.fn(),
  flushEvents: vi.fn(),
}))

// Mock resume data
vi.mock('@/data/resume-data.json', () => ({
  default: {
    personal: { name: 'Test User' },
    experience: [
      {
        id: 'company1',
        name: 'Test Corp',
        dateStart: '2020-01',
        dateEnd: '2023-12',
        location: 'Remote',
        children: [
          {
            id: 'pos1',
            name: 'Senior Engineer',
            dateStart: '2020-01',
            dateEnd: '2023-12',
            children: [
              {
                id: 'bullet-1',
                description: 'Built scalable APIs',
                tags: ['backend', 'api'],
                priority: 9,
              },
              {
                id: 'bullet-2',
                description: 'Led team of 5',
                tags: ['leadership'],
                priority: 8,
              },
            ],
          },
        ],
      },
      {
        id: 'company2',
        name: 'Another Corp',
        dateStart: '2018-01',
        dateEnd: '2020-01',
        location: 'NYC',
        children: [
          {
            id: 'pos2',
            name: 'Engineer',
            dateStart: '2018-01',
            dateEnd: '2020-01',
            children: [
              {
                id: 'bullet-3',
                description: 'Developed features',
                tags: ['frontend'],
                priority: 7,
              },
            ],
          },
        ],
      },
    ],
  },
}))

import { selectBulletsWithAI } from '@/lib/ai/providers'
import { AISelectionError } from '@/lib/ai/errors'

const mockSelectBulletsWithAI = selectBulletsWithAI as ReturnType<typeof vi.fn>

// ========== Test Helpers ==========

let tokenCounter = 0

function getUniqueToken(): string {
  return `test-token-${++tokenCounter}-${Math.random().toString(36).substring(7)}`
}

function createRequest(
  body: Record<string, unknown>,
  ip: string = '1.2.3.4'
): NextRequest {
  return new NextRequest('http://localhost:3000/api/resume/ai-select', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

const validJobDescription = `
  We are looking for a Senior Software Engineer to join our team.
  You will be responsible for building scalable backend services,
  leading technical initiatives, and mentoring junior developers.
  Required: 5+ years experience, Node.js, TypeScript, AWS.
`.trim()

// ========== Tests ==========

describe('/api/resume/ai-select', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearRateLimitStore()
    process.env.TURNSTILE_SECRET_KEY = 'test-secret-key'
    tokenCounter = 0
  })

  afterEach(() => {
    restoreFetch()
    delete process.env.TURNSTILE_SECRET_KEY
  })

  // ========== Input Validation ==========

  describe('input validation', () => {
    it('returns 400 for missing jobDescription', async () => {
      mockTurnstileSuccess()

      const request = createRequest({
        turnstileToken: getUniqueToken(),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('returns 400 for missing turnstileToken', async () => {
      mockTurnstileSuccess()

      const request = createRequest({
        jobDescription: validJobDescription,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('returns 400 for job description too short', async () => {
      mockTurnstileSuccess()

      const request = createRequest({
        jobDescription: 'Short JD',
        turnstileToken: getUniqueToken(),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Job description too short')
      expect(data.received).toBe(8)
    })

    it('returns 400 for invalid provider', async () => {
      mockTurnstileSuccess()

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
        provider: 'invalid-provider',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid provider')
    })

    it('accepts valid provider options', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockResolvedValue({
        bullets: [{id: 'bullet-1', score: 0.95}, {id: 'bullet-2', score: 0.88}, {id: 'bullet-3', score: 0.82}],
        reasoning: 'Test reasoning',
        jobTitle: 'Senior Engineer',
        salary: null,
        tokensUsed: 100,
        provider: 'claude-haiku',
      })

      const validProviders = ['cerebras-gpt', 'cerebras-llama', 'claude-sonnet', 'claude-haiku']

      for (const provider of validProviders) {
        clearRateLimitStore()

        const request = createRequest({
          jobDescription: validJobDescription,
          turnstileToken: getUniqueToken(),
          provider,
        })

        const response = await POST(request)
        expect(response.status).toBe(200)
      }
    })
  })

  // ========== Security ==========

  describe('security', () => {
    it('rejects invalid Turnstile token', async () => {
      mockTurnstileFailure()

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Turnstile verification failed')
    })

    it('prevents token replay attacks', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockResolvedValue({
        bullets: [{id: 'bullet-1', score: 0.95}],
        reasoning: 'Test',
        jobTitle: null,
        salary: null,
        provider: 'cerebras-gpt',
      })

      const token = getUniqueToken()

      // First request succeeds
      const request1 = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: token,
      })
      const response1 = await POST(request1)
      expect(response1.status).toBe(200)

      // Second request with same token fails
      const request2 = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: token,
      })
      const response2 = await POST(request2)
      const data2 = await response2.json()

      expect(response2.status).toBe(403)
      expect(data2.error).toBe('Token already used')
    })

    it('returns 500 if TURNSTILE_SECRET_KEY not configured', async () => {
      delete process.env.TURNSTILE_SECRET_KEY

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Server configuration error')
    })
  })

  // ========== Rate Limiting ==========

  describe('rate limiting', () => {
    it('enforces 5 requests per hour limit', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockResolvedValue({
        bullets: [{id: 'bullet-1', score: 0.95}],
        reasoning: 'Test',
        jobTitle: null,
        salary: null,
        provider: 'cerebras-gpt',
      })

      const ip = '10.0.0.1'

      // First 5 requests should succeed
      for (let i = 0; i < 5; i++) {
        const request = createRequest(
          {
            jobDescription: validJobDescription,
            turnstileToken: getUniqueToken(),
          },
          ip
        )
        const response = await POST(request)
        expect(response.status).toBe(200)
      }

      // 6th request should be rate limited
      const request = createRequest(
        {
          jobDescription: validJobDescription,
          turnstileToken: getUniqueToken(),
        },
        ip
      )
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded')
      expect(data.message).toContain('5 AI requests per hour')
    })

    it('includes rate limit headers in response', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockResolvedValue({
        bullets: [{id: 'bullet-1', score: 0.95}],
        reasoning: 'Test',
        jobTitle: null,
        salary: null,
        provider: 'cerebras-gpt',
      })

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
      })

      const response = await POST(request)

      expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('4')
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy()
    })
  })

  // ========== AI Selection ==========

  describe('AI selection', () => {
    it('returns successful selection with full bullet data', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockResolvedValue({
        bullets: [{id: 'bullet-1', score: 0.95}, {id: 'bullet-2', score: 0.88}],
        reasoning: 'Selected backend and leadership bullets',
        jobTitle: 'Senior Software Engineer',
        salary: { min: 150000, max: 200000, currency: 'USD', period: 'annual' },
        tokensUsed: 250,
        provider: 'cerebras-gpt',
      })

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.selected).toHaveLength(2)

      // Verify bullet structure
      expect(data.selected[0].bullet.id).toBe('bullet-1')
      expect(data.selected[0].bullet.description).toBe('Built scalable APIs')
      expect(data.selected[0].companyId).toBe('company1')
      expect(data.selected[0].companyName).toBe('Test Corp')
      expect(data.selected[0].positionId).toBe('pos1')
      expect(data.selected[0].positionName).toBe('Senior Engineer')

      // Verify metadata
      expect(data.reasoning).toBe('Selected backend and leadership bullets')
      expect(data.jobTitle).toBe('Senior Software Engineer')
      expect(data.salary).toEqual({
        min: 150000,
        max: 200000,
        currency: 'USD',
        period: 'annual',
      })
      expect(data.metadata.provider).toBe('cerebras-gpt')
      expect(data.metadata.tokensUsed).toBe(250)
      expect(data.metadata.duration).toBeGreaterThanOrEqual(0)
    })

    it('uses default provider when not specified', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockResolvedValue({
        bullets: [{id: 'bullet-1', score: 0.95}],
        reasoning: 'Test',
        jobTitle: null,
        salary: null,
        provider: 'cerebras-gpt',
      })

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
      })

      await POST(request)

      expect(mockSelectBulletsWithAI).toHaveBeenCalledWith(
        expect.objectContaining({
          jobDescription: validJobDescription,
        }),
        'cerebras-gpt' // First in FALLBACK_ORDER
      )
    })

    it('passes custom config to AI selection', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockResolvedValue({
        bullets: [{id: 'bullet-1', score: 0.95}],
        reasoning: 'Test',
        jobTitle: null,
        salary: null,
        provider: 'cerebras-gpt',
      })

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
        config: {
          maxBullets: 10,
          maxPerCompany: 3,
          maxPerPosition: 2,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      // Only maxBullets passed to AI; diversity constraints applied server-side
      expect(mockSelectBulletsWithAI).toHaveBeenCalledWith(
        expect.objectContaining({
          maxBullets: 10,
        }),
        expect.any(String)
      )

      expect(data.config).toEqual({
        maxBullets: 10,
        maxPerCompany: 3,
        minPerCompany: 2, // Uses default
        maxPerPosition: 2,
      })
    })

    it('uses default config when not specified', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockResolvedValue({
        bullets: [{id: 'bullet-1', score: 0.95}],
        reasoning: 'Test',
        jobTitle: null,
        salary: null,
        provider: 'cerebras-gpt',
      })

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.config).toEqual({
        maxBullets: 24,
        maxPerCompany: 6,
        minPerCompany: 2,
        maxPerPosition: 4,
      })
    })
  })

  // ========== Error Handling ==========

  describe('error handling', () => {
    it('returns user-friendly message for AISelectionError', async () => {
      mockTurnstileSuccess()

      const aiError = new AISelectionError(
        'All providers failed',
        [
          { code: 'E011_PROVIDER_DOWN', message: 'Rate limited', help: 'Try later' },
        ],
        'cerebras-gpt',
        3
      )
      mockSelectBulletsWithAI.mockRejectedValue(aiError)

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('AI selection failed')
      expect(data.userMessage).toBeTruthy()
      expect(data.provider).toBe('cerebras-gpt')
      expect(data.retriesAttempted).toBe(3)
    })

    it('returns generic error for unexpected failures', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockRejectedValue(new Error('Unexpected error'))

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  // ========== Response Structure ==========

  describe('response structure', () => {
    it('includes all expected fields in success response', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockResolvedValue({
        bullets: [{id: 'bullet-1', score: 0.95}],
        reasoning: 'Test reasoning',
        jobTitle: 'Test Title',
        salary: { min: 100000, currency: 'USD', period: 'annual' },
        tokensUsed: 150,
        provider: 'claude-haiku',
      })

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('selected')
      expect(data).toHaveProperty('count')
      expect(data).toHaveProperty('reasoning')
      expect(data).toHaveProperty('jobTitle')
      expect(data).toHaveProperty('salary')
      expect(data).toHaveProperty('metadata')
      expect(data).toHaveProperty('config')
      expect(data).toHaveProperty('timestamp')

      expect(data.metadata).toHaveProperty('provider')
      expect(data.metadata).toHaveProperty('tokensUsed')
      expect(data.metadata).toHaveProperty('duration')
    })

    it('sorts bullets by score within each company', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockResolvedValue({
        // bullet-2 has highest score but should come after bullet-1 if same company
        // because they're sorted by score descending within company
        bullets: [
          { id: 'bullet-1', score: 0.7 },
          { id: 'bullet-2', score: 0.95 },
          { id: 'bullet-3', score: 0.5 },
        ],
        reasoning: 'Ordered by relevance',
        jobTitle: null,
        salary: null,
        provider: 'cerebras-gpt',
      })

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
        // Allow single-bullet companies (company2 has only bullet-3)
        config: { minPerCompany: 1 },
      })

      const response = await POST(request)
      const data = await response.json()

      // Bullets sorted by score within company chronological order
      // company1 (newer) bullets first: bullet-2 (0.95), bullet-1 (0.7)
      // company2 (older) bullets: bullet-3 (0.5)
      expect(data.selected[0].bullet.id).toBe('bullet-2') // score 0.95 (company1)
      expect(data.selected[1].bullet.id).toBe('bullet-1') // score 0.7 (company1)
      expect(data.selected[2].bullet.id).toBe('bullet-3') // score 0.5 (company2)
    })

    it('filters out non-existent bullet IDs gracefully', async () => {
      mockTurnstileSuccess()
      mockSelectBulletsWithAI.mockResolvedValue({
        bullets: [
          { id: 'bullet-1', score: 0.95 },
          { id: 'non-existent', score: 0.8 },
          { id: 'bullet-2', score: 0.75 },
        ],
        reasoning: 'Test',
        jobTitle: null,
        salary: null,
        provider: 'cerebras-gpt',
      })

      const request = createRequest({
        jobDescription: validJobDescription,
        turnstileToken: getUniqueToken(),
      })

      const response = await POST(request)
      const data = await response.json()

      // Should only include existing bullets, sorted by score
      expect(data.selected).toHaveLength(2)
      expect(data.selected[0].bullet.id).toBe('bullet-1') // score 0.95
      expect(data.selected[1].bullet.id).toBe('bullet-2') // score 0.75
    })
  })
})
