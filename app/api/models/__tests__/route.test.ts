/**
 * API Route Tests: /api/models
 *
 * Tests the model availability endpoint that proxies
 * Cerebras /v1/models to determine which AI models are live.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '../route'

// Mock Cerebras API response
const mockCerebrasModels = {
  object: 'list',
  data: [
    { id: 'qwen-3-235b-a22b-instruct-2507', object: 'model', created: 1700000000, owned_by: 'Alibaba' },
    { id: 'llama3.1-8b', object: 'model', created: 1721692800, owned_by: 'Meta' },
  ],
}

let originalFetch: typeof global.fetch
let originalEnv: string | undefined

describe('GET /api/models', () => {
  beforeEach(() => {
    originalFetch = global.fetch
    originalEnv = process.env.CEREBRAS_API_KEY
    process.env.CEREBRAS_API_KEY = 'test-key'
    // Clear module-level cache by re-importing (cache is module-scoped)
    vi.resetModules()
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.CEREBRAS_API_KEY = originalEnv
  })

  it('returns available models from Cerebras', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCerebrasModels),
    }) as unknown as typeof fetch

    // Re-import to get fresh cache
    const { GET: freshGET } = await import('../route')
    const response = await freshGET()
    const body = await response.json()

    expect(body.models).toBeDefined()
    expect(Array.isArray(body.models)).toBe(true)

    // Cerebras models should be available
    const cerebrasGpt = body.models.find((m: { id: string }) => m.id === 'cerebras-gpt')
    expect(cerebrasGpt).toBeDefined()
    expect(cerebrasGpt.available).toBe(true)

    const cerebrasLlama = body.models.find((m: { id: string }) => m.id === 'cerebras-llama')
    expect(cerebrasLlama).toBeDefined()
    expect(cerebrasLlama.available).toBe(true)

    // Claude models should be unavailable (not wired up)
    const claudeSonnet = body.models.find((m: { id: string }) => m.id === 'claude-sonnet')
    expect(claudeSonnet).toBeDefined()
    expect(claudeSonnet.available).toBe(false)
    expect(claudeSonnet.reason).toBe('Coming soon')

    const claudeHaiku = body.models.find((m: { id: string }) => m.id === 'claude-haiku')
    expect(claudeHaiku).toBeDefined()
    expect(claudeHaiku.available).toBe(false)
  })

  it('marks Cerebras models unavailable when model not in API response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        object: 'list',
        data: [
          { id: 'llama3.1-8b', object: 'model', created: 1721692800, owned_by: 'Meta' },
          // qwen model NOT in list
        ],
      }),
    }) as unknown as typeof fetch

    const { GET: freshGET } = await import('../route')
    const response = await freshGET()
    const body = await response.json()

    const cerebrasGpt = body.models.find((m: { id: string }) => m.id === 'cerebras-gpt')
    expect(cerebrasGpt.available).toBe(false)
    expect(cerebrasGpt.reason).toBe('Model not available on provider')

    const cerebrasLlama = body.models.find((m: { id: string }) => m.id === 'cerebras-llama')
    expect(cerebrasLlama.available).toBe(true)
  })

  it('marks all Cerebras models unavailable when API key missing', async () => {
    delete process.env.CEREBRAS_API_KEY

    const { GET: freshGET } = await import('../route')
    const response = await freshGET()
    const body = await response.json()

    const cerebrasGpt = body.models.find((m: { id: string }) => m.id === 'cerebras-gpt')
    expect(cerebrasGpt.available).toBe(false)
    expect(cerebrasGpt.reason).toBe('API key not configured')
  })

  it('assumes Cerebras models available when API fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch

    const { GET: freshGET } = await import('../route')
    const response = await freshGET()
    const body = await response.json()

    // Should assume available on fetch failure (optimistic)
    const cerebrasGpt = body.models.find((m: { id: string }) => m.id === 'cerebras-gpt')
    expect(cerebrasGpt.available).toBe(true)
  })

  it('includes label and cost for all models', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCerebrasModels),
    }) as unknown as typeof fetch

    const { GET: freshGET } = await import('../route')
    const response = await freshGET()
    const body = await response.json()

    for (const model of body.models) {
      expect(model.label).toBeDefined()
      expect(typeof model.label).toBe('string')
      expect(['free', 'paid']).toContain(model.cost)
    }
  })
})
