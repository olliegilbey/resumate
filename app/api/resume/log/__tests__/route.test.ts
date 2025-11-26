import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'
import * as posthogServer from '@/lib/posthog-server'
import * as rateLimit from '@/lib/rate-limit'

// Mock PostHog server
vi.mock('@/lib/posthog-server', () => ({
  captureEvent: vi.fn(),
  flushEvents: vi.fn(),
}))

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  getClientIP: vi.fn(() => 'unknown'),
  checkRateLimit: vi.fn(() => ({
    success: true,
    limit: 30,
    remaining: 29,
    reset: Date.now() + 3600000,
  })),
}))

describe('/api/resume/log', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    originalFetch = global.fetch
    global.fetch = vi.fn()

    // Reset rate limit mock to success by default
    ;(rateLimit.checkRateLimit as any).mockReturnValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: Date.now() + 3600000,
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('logs resume_downloaded event with contact info', async () => {
    const mockCaptureEvent = vi.spyOn(posthogServer, 'captureEvent')
    const validSessionId = '550e8400-e29b-41d4-a716-446655440000'

    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'resume_downloaded',
        sessionId: validSessionId,
        roleProfileId: 'developer-relations-lead',
        roleProfileName: 'Developer Relations Lead',
        email: 'test@example.com',
        linkedin: 'linkedin.com/in/test',
        bulletCount: 24,
        bullets: [{ bullet: { id: 'test-bullet', description: 'Test', tags: [], priority: 5 }, score: 0.9 }],
        pdfSize: 100000,
        filename: 'resume.pdf',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      validSessionId,
      'resume_downloaded',
      expect.objectContaining({
        sessionId: validSessionId,
        roleProfileId: 'developer-relations-lead',
        roleProfileName: 'Developer Relations Lead',
        email: 'test@example.com',
        linkedin: 'linkedin.com/in/test',
        bulletCount: 24,
        pdfSize: 100000,
      }),
      'unknown' // clientIP from getClientIP(request)
    )
  })

  it('logs resume_generated event with performance metrics', async () => {
    const mockCaptureEvent = vi.spyOn(posthogServer, 'captureEvent')
    const validSessionId = '660e8400-e29b-41d4-a716-446655440001'

    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'resume_generated',
        sessionId: validSessionId,
        roleProfileId: 'backend-engineer',
        roleProfileName: 'Backend Engineer',
        bulletCount: 20,
        pdfSize: 95000,
        wasmLoadDuration: 500,
        generationDuration: 1200,
        totalDuration: 1700,
        wasmCached: true,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      validSessionId,
      'resume_generated',
      expect.objectContaining({
        sessionId: validSessionId,
        roleProfileId: 'backend-engineer',
        roleProfileName: 'Backend Engineer',
        bulletCount: 20,
        pdfSize: 95000,
        wasmLoadDuration: 500,
        generationDuration: 1200,
        totalDuration: 1700,
        wasmCached: true,
      }),
      'unknown'
    )
  })

  it('logs resume_failed event with contact info', async () => {
    const mockCaptureEvent = vi.spyOn(posthogServer, 'captureEvent')
    const validSessionId = '770e8400-e29b-41d4-a716-446655440002'

    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'resume_failed',
        sessionId: validSessionId,
        roleProfileId: 'frontend-engineer',
        roleProfileName: 'Frontend Engineer',
        email: 'user@example.com',
        linkedin: 'linkedin.com/in/user',
        errorMessage: 'WASM failed to load',
        errorStage: 'wasm_load',
        errorStack: 'Error stack trace...',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      validSessionId,
      'resume_failed',
      expect.objectContaining({
        sessionId: validSessionId,
        roleProfileId: 'frontend-engineer',
        roleProfileName: 'Frontend Engineer',
        email: 'user@example.com',
        linkedin: 'linkedin.com/in/user',
        errorMessage: 'WASM failed to load',
        errorStage: 'wasm_load',
      }),
      'unknown'
    )
  })

  it('returns 400 for missing required fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'resume_downloaded',
        // Missing sessionId
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Missing required fields')
  })

  it('handles n8n webhook gracefully when not configured', async () => {
    delete process.env.N8N_WEBHOOK_URL
    const validSessionId = '880e8400-e29b-41d4-a716-446655440003'

    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'resume_downloaded',
        sessionId: validSessionId,
        roleProfileId: 'test-role',
        bulletCount: 10,
        bullets: [],
        pdfSize: 50000,
        filename: 'test.pdf',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    // Should not call fetch since webhook not configured
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid event type', async () => {
    const validSessionId = '990e8400-e29b-41d4-a716-446655440004'

    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'invalid_event_type',
        sessionId: validSessionId,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid event type')
  })

  it('returns 400 for invalid sessionId format', async () => {
    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'resume_downloaded',
        sessionId: 'not-a-valid-uuid',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid sessionId format')
  })

  it('returns 429 when rate limit exceeded', async () => {
    const validSessionId = 'aa0e8400-e29b-41d4-a716-446655440005'

    // Mock rate limit as exceeded
    ;(rateLimit.checkRateLimit as any).mockReturnValue({
      success: false,
      limit: 30,
      remaining: 0,
      reset: Date.now() + 3600000,
    })

    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'resume_downloaded',
        sessionId: validSessionId,
        bulletCount: 10,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toContain('Rate limit exceeded')
    expect(response.headers.get('X-RateLimit-Limit')).toBe('30')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
  })
})
