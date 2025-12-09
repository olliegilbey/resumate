import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getProvider,
  getFirstAvailableProvider,
  getAvailableProviders,
  selectBulletsWithAI,
} from '../../providers'
import { AnthropicProvider } from '../../providers/anthropic'
import { CerebrasProvider } from '../../providers/cerebras'
import { AISelectionError } from '../../errors'
import type { ResumeData } from '@/lib/types/generated-resume'
import type { SelectionResult } from '../../providers/types'

// Mock providers
vi.mock('../../providers/anthropic', () => ({
  AnthropicProvider: vi.fn(),
  createAnthropicProvider: vi.fn(),
}))

vi.mock('../../providers/cerebras', () => ({
  CerebrasProvider: vi.fn(),
  createCerebrasProvider: vi.fn(),
}))

const mockCompendium: ResumeData = {
  personal: { name: 'Test' },
  experience: [
    {
      id: 'company-a',
      name: 'Corp',
      dateStart: '2020-01',
      priority: 5,
      tags: [],
      children: [
        {
          id: 'pos-1',
          name: 'Eng',
          dateStart: '2020-01',
          priority: 5,
          tags: [],
          children: [
            { id: 'bullet-1', description: 'A', priority: 5, tags: [] },
            { id: 'bullet-2', description: 'B', priority: 5, tags: [] },
          ],
        },
      ],
    },
  ],
}

describe('getProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns AnthropicProvider for claude-sonnet', () => {
    getProvider('claude-sonnet')
    expect(AnthropicProvider).toHaveBeenCalledWith('claude-sonnet')
  })

  it('returns AnthropicProvider for claude-haiku', () => {
    getProvider('claude-haiku')
    expect(AnthropicProvider).toHaveBeenCalledWith('claude-haiku')
  })

  it('returns CerebrasProvider for cerebras-gpt', () => {
    getProvider('cerebras-gpt')
    expect(CerebrasProvider).toHaveBeenCalledWith('cerebras-gpt')
  })

  it('returns CerebrasProvider for cerebras-llama', () => {
    getProvider('cerebras-llama')
    expect(CerebrasProvider).toHaveBeenCalledWith('cerebras-llama')
  })

  it('throws for unknown provider', () => {
    expect(() => getProvider('unknown' as 'cerebras-gpt')).toThrow('Unknown provider')
  })
})

describe('getFirstAvailableProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns first available provider in fallback order', () => {
    // cerebras-gpt is first in FALLBACK_ORDER
    const mockIsAvailable = vi.fn().mockReturnValue(true)
    ;(CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      isAvailable: mockIsAvailable,
    }))

    const result = getFirstAvailableProvider()
    expect(result).toBe('cerebras-gpt')
  })

  it('returns null if no providers available', () => {
    const mockIsAvailable = vi.fn().mockReturnValue(false)
    ;(CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      isAvailable: mockIsAvailable,
    }))
    ;(AnthropicProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      isAvailable: mockIsAvailable,
    }))

    const result = getFirstAvailableProvider()
    expect(result).toBeNull()
  })
})

describe('selectBulletsWithAI', () => {
  const validResult: SelectionResult = {
    bullets: [{ id: 'bullet-1', score: 0.95 }, { id: 'bullet-2', score: 0.88 }],
    reasoning: 'Test',
    jobTitle: null,
    salary: null,
    provider: 'cerebras-gpt',
    promptUsed: 'test prompt',
    attemptCount: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('successful selection', () => {
    it('returns result on first attempt', async () => {
      const mockSelect = vi.fn().mockResolvedValue(validResult)
      ;(CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockSelect,
        name: 'cerebras-gpt',
      }))

      const result = await selectBulletsWithAI(
        { jobDescription: 'Test', compendium: mockCompendium, maxBullets: 2 },
        'cerebras-gpt'
      )

      expect(result).toEqual(validResult)
      expect(mockSelect).toHaveBeenCalledTimes(1)
    })
  })

  describe('retry logic', () => {
    it('retries on output format error with context', async () => {
      const formatError = new AISelectionError(
        'Wrong count',
        [{ code: 'E004_WRONG_BULLET_COUNT', message: 'Expected 2', help: 'Fix count' }],
        'cerebras-gpt'
      )

      const mockSelect = vi
        .fn()
        .mockRejectedValueOnce(formatError)
        .mockResolvedValueOnce(validResult)

      ;(CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockSelect,
        name: 'cerebras-gpt',
      }))

      const result = await selectBulletsWithAI(
        { jobDescription: 'Test', compendium: mockCompendium, maxBullets: 2 },
        'cerebras-gpt'
      )

      // Orchestrator overrides attemptCount with totalRetries (2 in this case)
      expect(result).toEqual({ ...validResult, attemptCount: 2 })
      expect(mockSelect).toHaveBeenCalledTimes(2)

      // Second call should include retry context
      const secondCall = mockSelect.mock.calls[1][0]
      expect(secondCall.retryContext).toContain('E004_WRONG_BULLET_COUNT')
    })

    it('throws after maxRetries exhausted', async () => {
      const formatError = new AISelectionError(
        'Wrong count',
        [{ code: 'E004_WRONG_BULLET_COUNT', message: 'Expected 2', help: 'Fix' }],
        'cerebras-gpt'
      )

      const mockSelect = vi.fn().mockRejectedValue(formatError)

      ;(CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockSelect,
        name: 'cerebras-gpt',
      }))
      ;(AnthropicProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => false,
        name: 'claude-haiku',
      }))

      await expect(
        selectBulletsWithAI(
          { jobDescription: 'Test', compendium: mockCompendium, maxBullets: 2 },
          'cerebras-gpt',
          { maxRetries: 2, enableFallback: false }
        )
      ).rejects.toThrow(AISelectionError)

      expect(mockSelect).toHaveBeenCalledTimes(2)
    })
  })

  describe('fallback logic', () => {
    it('falls back on provider DOWN', async () => {
      const downError = new AISelectionError(
        'Rate limited',
        [{ code: 'E011_PROVIDER_DOWN', message: 'Down', help: 'Wait' }],
        'cerebras-gpt'
      )

      const mockCerebrasSelect = vi.fn().mockRejectedValue(downError)
      const fallbackResult: SelectionResult = {
        ...validResult,
        provider: 'claude-haiku',
        promptUsed: 'test prompt',
        attemptCount: 1,
      }
      const mockAnthropicSelect = vi.fn().mockResolvedValue(fallbackResult)

      ;(CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockCerebrasSelect,
        name: 'cerebras-gpt',
      }))
      ;(AnthropicProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockAnthropicSelect,
        name: 'claude-haiku',
      }))

      const result = await selectBulletsWithAI(
        { jobDescription: 'Test', compendium: mockCompendium, maxBullets: 2 },
        'cerebras-gpt'
      )

      expect(result.provider).toBe('claude-haiku')
      expect(mockCerebrasSelect).toHaveBeenCalledTimes(1)
      expect(mockAnthropicSelect).toHaveBeenCalledTimes(1)
    })

    it('does NOT fallback on output format error (retries same provider)', async () => {
      const formatError = new AISelectionError(
        'Invalid IDs',
        [{ code: 'E005_INVALID_BULLET_ID', message: 'Bad ID', help: 'Fix' }],
        'cerebras-gpt'
      )

      const mockSelect = vi
        .fn()
        .mockRejectedValueOnce(formatError)
        .mockResolvedValueOnce(validResult)

      ;(CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockSelect,
        name: 'cerebras-gpt',
      }))

      const result = await selectBulletsWithAI(
        { jobDescription: 'Test', compendium: mockCompendium, maxBullets: 2 },
        'cerebras-gpt'
      )

      // Should have succeeded with same provider after retry
      expect(result.provider).toBe('cerebras-gpt')
      expect(mockSelect).toHaveBeenCalledTimes(2)
    })

    it('skips unavailable providers in fallback chain', async () => {
      const downError = new AISelectionError(
        'Down',
        [{ code: 'E011_PROVIDER_DOWN', message: 'Down', help: '' }],
        'cerebras-gpt'
      )

      const mockCerebrasGptSelect = vi.fn().mockRejectedValue(downError)
      const fallbackResult: SelectionResult = {
        ...validResult,
        provider: 'claude-haiku',
        promptUsed: 'test prompt',
        attemptCount: 1,
      }
      const mockAnthropicSelect = vi.fn().mockResolvedValue(fallbackResult)

      // cerebras-gpt available but DOWN, claude-haiku available
      ;(CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (model: string) => {
          if (model === 'cerebras-gpt') {
            return {
              isAvailable: () => true,
              select: mockCerebrasGptSelect,
              name: 'cerebras-gpt',
            }
          }
          // cerebras-llama not available
          return {
            isAvailable: () => false,
            name: 'cerebras-llama',
          }
        }
      )
      ;(AnthropicProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockAnthropicSelect,
        name: 'claude-haiku',
      }))

      const result = await selectBulletsWithAI(
        { jobDescription: 'Test', compendium: mockCompendium, maxBullets: 2 },
        'cerebras-gpt'
      )

      expect(result.provider).toBe('claude-haiku')
    })

    it('respects enableFallback=false', async () => {
      const downError = new AISelectionError(
        'Down',
        [{ code: 'E011_PROVIDER_DOWN', message: 'Down', help: '' }],
        'cerebras-gpt'
      )

      ;(CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: vi.fn().mockRejectedValue(downError),
        name: 'cerebras-gpt',
      }))

      await expect(
        selectBulletsWithAI(
          { jobDescription: 'Test', compendium: mockCompendium, maxBullets: 2 },
          'cerebras-gpt',
          { enableFallback: false }
        )
      ).rejects.toThrow('unavailable')
    })
  })

  describe('error aggregation', () => {
    it('aggregates errors from multiple attempts', async () => {
      const error1 = new AISelectionError(
        'Error 1',
        [{ code: 'E004_WRONG_BULLET_COUNT', message: 'Count', help: '' }],
        'cerebras-gpt'
      )
      const error2 = new AISelectionError(
        'Error 2',
        [{ code: 'E005_INVALID_BULLET_ID', message: 'ID', help: '' }],
        'cerebras-gpt'
      )

      const mockSelect = vi
        .fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)

      ;(CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockSelect,
        name: 'cerebras-gpt',
      }))
      ;(AnthropicProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => false,
        name: 'claude-haiku',
      }))

      try {
        await selectBulletsWithAI(
          { jobDescription: 'Test', compendium: mockCompendium, maxBullets: 2 },
          'cerebras-gpt',
          { maxRetries: 2, enableFallback: false }
        )
        expect.fail('Should have thrown')
      } catch (e) {
        const err = e as AISelectionError
        expect(err.errors).toHaveLength(2)
        expect(err.errors[0].code).toBe('E004_WRONG_BULLET_COUNT')
        expect(err.errors[1].code).toBe('E005_INVALID_BULLET_ID')
      }
    })
  })
})
