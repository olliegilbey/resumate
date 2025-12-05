import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AnthropicProvider, createAnthropicProvider } from '../../providers/anthropic'
import { AISelectionError } from '../../errors'
import type { ResumeData } from '@/lib/types/generated-resume'

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
    APIError: class APIError extends Error {
      status: number
      constructor(status: number, message: string) {
        super(message)
        this.status = status
        this.name = 'APIError'
      }
    },
  }
})

// Minimal compendium for testing
const mockCompendium: ResumeData = {
  personal: { name: 'Test User' },
  experience: [
    {
      id: 'company-a',
      name: 'Test Corp',
      dateStart: '2020-01',
      priority: 5,
      tags: ['tech'],
      children: [
        {
          id: 'company-a-pos',
          name: 'Engineer',
          dateStart: '2020-01',
          priority: 5,
          tags: ['dev'],
          children: [
            {
              id: 'bullet-1',
              description: 'Built APIs',
              priority: 8,
              tags: ['api'],
            },
            {
              id: 'bullet-2',
              description: 'Led team',
              priority: 7,
              tags: ['leadership'],
            },
          ],
        },
      ],
    },
  ],
}

describe('AnthropicProvider', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    if (originalEnv) {
      process.env.ANTHROPIC_API_KEY = originalEnv
    } else {
      delete process.env.ANTHROPIC_API_KEY
    }
  })

  describe('constructor', () => {
    it('creates sonnet provider with correct config', () => {
      const provider = new AnthropicProvider('claude-sonnet')

      expect(provider.name).toBe('claude-sonnet')
      expect(provider.config.model).toBe('claude-sonnet-4-5-20250514')
      expect(provider.config.provider).toBe('anthropic')
    })

    it('creates haiku provider with correct config', () => {
      const provider = new AnthropicProvider('claude-haiku')

      expect(provider.name).toBe('claude-haiku')
      expect(provider.config.model).toBe('claude-haiku-4-5-20250514')
    })
  })

  describe('isAvailable', () => {
    it('returns true when API key set', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test'
      const provider = new AnthropicProvider('claude-sonnet')

      expect(provider.isAvailable()).toBe(true)
    })

    it('returns false when API key missing', () => {
      delete process.env.ANTHROPIC_API_KEY
      const provider = new AnthropicProvider('claude-sonnet')

      expect(provider.isAvailable()).toBe(false)
    })
  })

  describe('select', () => {
    it('throws when API key not configured', async () => {
      delete process.env.ANTHROPIC_API_KEY
      const provider = new AnthropicProvider('claude-sonnet')

      await expect(
        provider.select({
          jobDescription: 'Test job',
          compendium: mockCompendium,
          maxBullets: 2, minBullets: 2,
        })
      ).rejects.toThrow(AISelectionError)

      try {
        await provider.select({
          jobDescription: 'Test job',
          compendium: mockCompendium,
          maxBullets: 2, minBullets: 2,
        })
      } catch (e) {
        expect(e).toBeInstanceOf(AISelectionError)
        const err = e as AISelectionError
        expect(err.errors[0].code).toBe('E011_PROVIDER_DOWN')
      }
    })

    it('calls API with correct parameters', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              bullets: [{id: 'bullet-1', score: 0.95}, {id: 'bullet-2', score: 0.88}],
              reasoning: 'Selected relevant bullets',
              job_title: 'Software Engineer',
              salary: null,
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: { create: mockCreate },
      }))

      const provider = new AnthropicProvider('claude-sonnet')
      await provider.select({
        jobDescription: 'We need an engineer',
        compendium: mockCompendium,
        maxBullets: 2, minBullets: 2,
      })

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250514',
          max_tokens: 8192,
          system: expect.any(String),
          messages: [{ role: 'user', content: expect.any(String) }],
        })
      )
    })

    it('parses valid AI response', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              bullets: [{id: 'bullet-1', score: 0.95}, {id: 'bullet-2', score: 0.88}],
              reasoning: 'API + leadership match job',
              job_title: 'Backend Developer',
              salary: { min: 100000, max: 150000, currency: 'USD', period: 'annual' },
            }),
          },
        ],
        usage: { input_tokens: 200, output_tokens: 100 },
      })

      ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: { create: mockCreate },
      }))

      const provider = new AnthropicProvider('claude-sonnet')
      const result = await provider.select({
        jobDescription: 'Backend developer needed',
        compendium: mockCompendium,
        maxBullets: 2, minBullets: 2,
      })

      expect(result.bullets).toEqual([{id: 'bullet-1', score: 0.95}, {id: 'bullet-2', score: 0.88}])
      expect(result.reasoning).toBe('API + leadership match job')
      expect(result.jobTitle).toBe('Backend Developer')
      expect(result.salary).toEqual({
        min: 100000,
        max: 150000,
        currency: 'USD',
        period: 'annual',
      })
      expect(result.tokensUsed).toBe(300)
      expect(result.provider).toBe('claude-sonnet')
    })

    it('throws on invalid bullet IDs', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              bullets: [{id: 'bullet-1', score: 0.95}, {id: 'nonexistent-bullet', score: 0.85}],
              reasoning: 'Test',
              job_title: null,
              salary: null,
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: { create: mockCreate },
      }))

      const provider = new AnthropicProvider('claude-sonnet')

      await expect(
        provider.select({
          jobDescription: 'Test',
          compendium: mockCompendium,
          maxBullets: 2, minBullets: 2,
        })
      ).rejects.toThrow(AISelectionError)

      try {
        await provider.select({
          jobDescription: 'Test',
          compendium: mockCompendium,
          maxBullets: 2, minBullets: 2,
        })
      } catch (e) {
        const err = e as AISelectionError
        expect(err.errors[0].code).toBe('E005_INVALID_BULLET_ID')
      }
    })

    it('throws on wrong bullet count', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              bullets: [{id: 'bullet-1', score: 0.95}], // Only 1, expected 2
              reasoning: 'Test',
              job_title: null,
              salary: null,
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: { create: mockCreate },
      }))

      const provider = new AnthropicProvider('claude-sonnet')

      try {
        await provider.select({
          jobDescription: 'Test',
          compendium: mockCompendium,
          maxBullets: 2, minBullets: 2,
        })
      } catch (e) {
        const err = e as AISelectionError
        expect(err.errors[0].code).toBe('E004_WRONG_BULLET_COUNT')
      }
    })

    it('handles rate limit error as provider down', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      // Create mock error that mimics Anthropic.APIError
      const rateLimitError = new Error('Rate limited')
      Object.assign(rateLimitError, { status: 429, name: 'APIError' })

      const mockCreate = vi.fn().mockRejectedValue(rateLimitError)

      ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: { create: mockCreate },
      }))

      const provider = new AnthropicProvider('claude-sonnet')

      try {
        await provider.select({
          jobDescription: 'Test',
          compendium: mockCompendium,
          maxBullets: 2, minBullets: 2,
        })
        expect.fail('Should have thrown')
      } catch (e) {
        const err = e as AISelectionError
        // Check via error code, not isProviderDown() (mock doesn't inherit properly)
        expect(err.errors[0].code).toBe('E011_PROVIDER_DOWN')
      }
    })

    it('handles 5xx error as provider down', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      // Create mock error that mimics Anthropic.APIError
      const serverError = new Error('Service unavailable')
      Object.assign(serverError, { status: 503, name: 'APIError' })

      const mockCreate = vi.fn().mockRejectedValue(serverError)

      ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: { create: mockCreate },
      }))

      const provider = new AnthropicProvider('claude-sonnet')

      try {
        await provider.select({
          jobDescription: 'Test',
          compendium: mockCompendium,
          maxBullets: 2, minBullets: 2,
        })
      } catch (e) {
        const err = e as AISelectionError
        expect(err.errors[0].code).toBe('E011_PROVIDER_DOWN')
      }
    })

    it('includes retry context in prompt when provided', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              bullets: [{id: 'bullet-1', score: 0.95}, {id: 'bullet-2', score: 0.88}],
              reasoning: 'Fixed the issue',
              job_title: null,
              salary: null,
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      ;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: { create: mockCreate },
      }))

      const provider = new AnthropicProvider('claude-sonnet')
      await provider.select({
        jobDescription: 'Test job',
        compendium: mockCompendium,
        maxBullets: 2, minBullets: 2,
        retryContext: 'error[E004_WRONG_BULLET_COUNT]: Expected 2, got 1',
      })

      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.messages[0].content).toContain('PREVIOUS RESPONSE HAD ERRORS')
      expect(callArgs.messages[0].content).toContain('E004_WRONG_BULLET_COUNT')
    })
  })

  describe('createAnthropicProvider', () => {
    it('creates sonnet provider by default', () => {
      const provider = createAnthropicProvider()
      expect(provider.name).toBe('claude-sonnet')
    })

    it('creates haiku provider when specified', () => {
      const provider = createAnthropicProvider('claude-haiku')
      expect(provider.name).toBe('claude-haiku')
    })
  })
})
