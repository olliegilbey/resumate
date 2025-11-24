import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'
import * as posthogServer from '@/lib/posthog-server'

// Mock PostHog server
vi.mock('@/lib/posthog-server', () => ({
  captureEvent: vi.fn(),
}))

describe('/api/resume/log', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    originalFetch = global.fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('logs resume_downloaded event with contact info', async () => {
    const mockCaptureEvent = vi.spyOn(posthogServer, 'captureEvent')

    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'resume_downloaded',
        sessionId: 'test-session-123',
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
      'test-session-123',
      'resume_downloaded',
      expect.objectContaining({
        sessionId: 'test-session-123',
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

    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'resume_generated',
        sessionId: 'test-session-456',
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
      'test-session-456',
      'resume_generated',
      expect.objectContaining({
        sessionId: 'test-session-456',
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

    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'resume_failed',
        sessionId: 'test-session-789',
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
      'test-session-789',
      'resume_failed',
      expect.objectContaining({
        sessionId: 'test-session-789',
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

    const request = new NextRequest('http://localhost:3000/api/resume/log', {
      method: 'POST',
      body: JSON.stringify({
        event: 'resume_downloaded',
        sessionId: 'test-session-999',
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
})
