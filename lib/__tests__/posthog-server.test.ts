import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock posthog-node BEFORE importing the module under test
const mockCapture = vi.fn()
const mockShutdown = vi.fn().mockResolvedValue(undefined)

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: mockCapture,
    shutdown: mockShutdown,
  })),
}))

// Import after mocking
import { getPostHogClient, captureEvent, flushEvents } from '../posthog-server'
import { PostHog } from 'posthog-node'

describe('posthog-server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('getPostHogClient', () => {
    it('should return null when POSTHOG_API_KEY is not set', async () => {
      vi.stubEnv('POSTHOG_API_KEY', '')
      vi.stubEnv('NODE_ENV', 'production')

      const { getPostHogClient: freshGetClient } = await import('../posthog-server')
      const client = freshGetClient()

      expect(client).toBeNull()
    })

    it('should return null in development without POSTHOG_ENABLE_DEV', async () => {
      vi.stubEnv('POSTHOG_API_KEY', 'phc_test_key')
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('POSTHOG_ENABLE_DEV', '')

      const { getPostHogClient: freshGetClient } = await import('../posthog-server')
      const client = freshGetClient()

      expect(client).toBeNull()
    })

    it('should initialize client in development with POSTHOG_ENABLE_DEV=true', async () => {
      vi.stubEnv('POSTHOG_API_KEY', 'phc_test_key')
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('POSTHOG_ENABLE_DEV', 'true')

      const { getPostHogClient: freshGetClient } = await import('../posthog-server')
      const client = freshGetClient()

      expect(client).not.toBeNull()
      expect(PostHog).toHaveBeenCalledWith('phc_test_key', expect.objectContaining({
        host: 'https://eu.i.posthog.com',
      }))
    })

    it('should initialize client with serverless config (flushAt: 1, flushInterval: 0)', async () => {
      vi.stubEnv('POSTHOG_API_KEY', 'phc_production_key')
      vi.stubEnv('NODE_ENV', 'production')

      const { getPostHogClient: freshGetClient } = await import('../posthog-server')
      const client = freshGetClient()

      expect(client).not.toBeNull()
      expect(PostHog).toHaveBeenCalledWith('phc_production_key', expect.objectContaining({
        host: 'https://eu.i.posthog.com',
        flushAt: 1,
        flushInterval: 0,
      }))
    })
  })

  describe('captureEvent', () => {
    beforeEach(() => {
      vi.stubEnv('POSTHOG_API_KEY', 'phc_test_key')
      vi.stubEnv('NODE_ENV', 'production')
      vi.resetModules()
    })

    it('should call capture with correct distinctId and event', async () => {
      const { captureEvent: freshCapture } = await import('../posthog-server')

      await freshCapture('user-123', 'test_event', { foo: 'bar' })

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: 'user-123',
          event: 'test_event',
        })
      )
    })

    it('should include properties with env, is_server, source, and timestamp', async () => {
      const { captureEvent: freshCapture } = await import('../posthog-server')

      await freshCapture('user-123', 'test_event', { customProp: 'value' })

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            customProp: 'value',
            env: 'production',
            is_server: true,
            source: 'local', // No VERCEL_ENV set = 'local'
            timestamp: expect.any(String),
          }),
        })
      )
    })

    it('should use VERCEL_ENV for source when available', async () => {
      vi.stubEnv('VERCEL_ENV', 'production')
      vi.resetModules()

      const { captureEvent: freshCapture } = await import('../posthog-server')

      await freshCapture('user-123', 'test_event', {})

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            source: 'production',
          }),
        })
      )
    })

    /**
     * CRITICAL TEST: $ip must be at top-level for GeoIP lookup
     *
     * PostHog Node SDK requires $ip to be passed at the top level of
     * the capture() call, NOT inside the properties object.
     *
     * This test prevents regression of the bug where $ip was inside
     * properties and GeoIP lookup showed "None" for all locations.
     */
    it('should pass $ip at TOP LEVEL for GeoIP lookup (NOT inside properties)', async () => {
      const { captureEvent: freshCapture } = await import('../posthog-server')

      await freshCapture('user-123', 'test_event', { foo: 'bar' }, '203.0.113.42')

      const captureCall = mockCapture.mock.calls[0][0]

      // $ip MUST be at top level
      expect(captureCall.$ip).toBe('203.0.113.42')

      // $ip MUST NOT be inside properties (would break GeoIP)
      expect(captureCall.properties.$ip).toBeUndefined()
    })

    it('should NOT include $ip when ip parameter is undefined', async () => {
      const { captureEvent: freshCapture } = await import('../posthog-server')

      await freshCapture('user-123', 'test_event', { foo: 'bar' })

      const captureCall = mockCapture.mock.calls[0][0]

      expect(captureCall.$ip).toBeUndefined()
      expect(captureCall.properties.$ip).toBeUndefined()
    })

    it('should NOT include $ip when ip parameter is empty string', async () => {
      const { captureEvent: freshCapture } = await import('../posthog-server')

      await freshCapture('user-123', 'test_event', { foo: 'bar' }, '')

      const captureCall = mockCapture.mock.calls[0][0]

      expect(captureCall.$ip).toBeUndefined()
    })

    it('should not throw when client is null', async () => {
      vi.stubEnv('POSTHOG_API_KEY', '')
      vi.resetModules()

      const { captureEvent: freshCapture } = await import('../posthog-server')

      // Should not throw
      await expect(freshCapture('user-123', 'test_event', {})).resolves.toBeUndefined()
      expect(mockCapture).not.toHaveBeenCalled()
    })
  })

  describe('flushEvents', () => {
    beforeEach(() => {
      vi.stubEnv('POSTHOG_API_KEY', 'phc_test_key')
      vi.stubEnv('NODE_ENV', 'production')
      vi.resetModules()
    })

    it('should call shutdown on the client (not flush)', async () => {
      const { getPostHogClient: freshGetClient, flushEvents: freshFlush } = await import('../posthog-server')

      // Initialize client first
      freshGetClient()

      await freshFlush()

      expect(mockShutdown).toHaveBeenCalled()
    })

    it('should not throw when shutdown fails', async () => {
      mockShutdown.mockRejectedValueOnce(new Error('Network error'))
      vi.resetModules()

      const { getPostHogClient: freshGetClient, flushEvents: freshFlush } = await import('../posthog-server')

      freshGetClient()

      // Should not throw (best-effort analytics)
      await expect(freshFlush()).resolves.toBeUndefined()
    })

    it('should not throw when client is null', async () => {
      vi.stubEnv('POSTHOG_API_KEY', '')
      vi.resetModules()

      const { flushEvents: freshFlush } = await import('../posthog-server')

      await expect(freshFlush()).resolves.toBeUndefined()
      expect(mockShutdown).not.toHaveBeenCalled()
    })

    it('should reset singleton after shutdown', async () => {
      const { getPostHogClient: freshGetClient, flushEvents: freshFlush } = await import('../posthog-server')

      // Initialize client
      const client1 = freshGetClient()
      expect(client1).not.toBeNull()

      // Shutdown resets singleton
      await freshFlush()

      // Next call should create new instance
      const client2 = freshGetClient()
      expect(PostHog).toHaveBeenCalledTimes(2)
    })
  })

  describe('integration: captureEvent + flushEvents', () => {
    it('should capture event and shutdown in sequence', async () => {
      vi.stubEnv('POSTHOG_API_KEY', 'phc_test_key')
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('VERCEL_ENV', 'production')
      vi.resetModules()

      const { captureEvent: freshCapture, flushEvents: freshFlush } = await import('../posthog-server')

      await freshCapture('session-abc', 'resume_downloaded', {
        roleProfileId: 'developer-relations',
        bulletCount: 24,
      }, '198.51.100.1')

      await freshFlush()

      // Verify capture was called with full payload including source
      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: 'session-abc',
        event: 'resume_downloaded',
        properties: {
          roleProfileId: 'developer-relations',
          bulletCount: 24,
          env: 'production',
          is_server: true,
          source: 'production',
          timestamp: expect.any(String),
        },
        $ip: '198.51.100.1',
      })

      // Verify shutdown was called (not flush)
      expect(mockShutdown).toHaveBeenCalled()
    })
  })
})
