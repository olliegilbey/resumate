import { describe, it, expect } from 'vitest'
import { checkRateLimit, getClientIP, type RateLimitConfig } from '../rate-limit'

describe('Rate Limiting', () => {
  describe('checkRateLimit', () => {
    const config: RateLimitConfig = {
      limit: 5,
      window: 60000, // 1 minute
    }

    it('allows first request', () => {
      const result = checkRateLimit('test-id', config)

      expect(result.success).toBe(true)
      expect(result.limit).toBe(5)
      expect(result.remaining).toBe(4)
      expect(result.reset).toBeGreaterThan(Date.now())
    })

    it('tracks requests within window', () => {
      const identifier = `test-${Date.now()}`

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(identifier, config)
        expect(result.success).toBe(true)
        expect(result.remaining).toBe(4 - i)
      }
    })

    it('blocks requests after limit exceeded', () => {
      const identifier = `test-${Date.now()}`

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        checkRateLimit(identifier, config)
      }

      // Next request should be blocked
      const result = checkRateLimit(identifier, config)

      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('resets after window expires', async () => {
      const identifier = `reset-${Date.now()}-${Math.random()}`
      const shortConfig: RateLimitConfig = {
        limit: 2,
        window: 100, // 100ms
      }

      // Use up requests
      checkRateLimit(identifier, shortConfig)
      checkRateLimit(identifier, shortConfig)

      // Should be blocked
      let result = checkRateLimit(identifier, shortConfig)
      expect(result.success).toBe(false)

      // Wait for window to expire (add buffer for test reliability)
      await new Promise(resolve => setTimeout(resolve, 200))

      // Should allow new request
      result = checkRateLimit(identifier, shortConfig)
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(1) // Back to limit - 1
    })

    it('tracks different identifiers separately', () => {
      const id1 = `test-1-${Date.now()}`
      const id2 = `test-2-${Date.now()}`

      // Use up requests for id1
      for (let i = 0; i < 5; i++) {
        checkRateLimit(id1, config)
      }

      // id1 should be blocked
      expect(checkRateLimit(id1, config).success).toBe(false)

      // id2 should still work
      expect(checkRateLimit(id2, config).success).toBe(true)
    })

    it('returns correct reset timestamp', () => {
      const identifier = `test-${Date.now()}`
      const now = Date.now()

      const result = checkRateLimit(identifier, config)

      // Reset should be ~1 minute in the future
      expect(result.reset).toBeGreaterThanOrEqual(now + config.window - 100)
      expect(result.reset).toBeLessThanOrEqual(now + config.window + 100)
    })

    it('maintains same reset timestamp within window', () => {
      const identifier = `test-${Date.now()}`

      const result1 = checkRateLimit(identifier, config)
      const result2 = checkRateLimit(identifier, config)

      expect(result1.reset).toBe(result2.reset)
    })

    it('handles concurrent requests correctly', () => {
      const identifier = `concurrent-${Date.now()}-${Math.random()}`

      // Simulate multiple concurrent requests
      const results = []
      for (let i = 0; i < 10; i++) {
        results.push(checkRateLimit(identifier, config))
      }

      // First 5 should succeed
      const successful = results.filter(r => r.success)
      const blocked = results.filter(r => !r.success)

      expect(successful.length).toBe(5)
      expect(blocked.length).toBe(5)
    })

    it('handles zero remaining correctly', () => {
      const identifier = `test-${Date.now()}`

      // Use exactly limit requests
      for (let i = 0; i < config.limit; i++) {
        checkRateLimit(identifier, config)
      }

      // Next request should show 0 remaining
      const result = checkRateLimit(identifier, config)
      expect(result.remaining).toBe(0)
    })

    it('handles custom limits', () => {
      const identifier = `custom-${Date.now()}-${Math.random()}`
      const customConfig: RateLimitConfig = {
        limit: 1,
        window: 60000,
      }

      const result1 = checkRateLimit(identifier, customConfig)
      expect(result1.success).toBe(true)
      expect(result1.remaining).toBe(0)

      const result2 = checkRateLimit(identifier, customConfig)
      expect(result2.success).toBe(false)
    })

    it('handles large limits', () => {
      const identifier = `large-${Date.now()}-${Math.random()}`
      const largeConfig: RateLimitConfig = {
        limit: 1000,
        window: 60000,
      }

      const result = checkRateLimit(identifier, largeConfig)
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(999)
    })

    it('handles very short windows', async () => {
      const identifier = `short-window-${Date.now()}-${Math.random()}`
      const shortConfig: RateLimitConfig = {
        limit: 2,
        window: 50, // 50ms
      }

      checkRateLimit(identifier, shortConfig)
      checkRateLimit(identifier, shortConfig)

      // Should be blocked
      expect(checkRateLimit(identifier, shortConfig).success).toBe(false)

      // Wait for window (add buffer)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should work again
      expect(checkRateLimit(identifier, shortConfig).success).toBe(true)
    })
  })

  describe('getClientIP', () => {
    it('extracts IP from cf-connecting-ip (Cloudflare)', () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
        },
      })

      const ip = getClientIP(request)
      expect(ip).toBe('1.2.3.4')
    })

    it('extracts IP from x-real-ip (Vercel)', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-real-ip': '5.6.7.8',
        },
      })

      const ip = getClientIP(request)
      expect(ip).toBe('5.6.7.8')
    })

    it('extracts IP from x-forwarded-for', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '9.10.11.12',
        },
      })

      const ip = getClientIP(request)
      expect(ip).toBe('9.10.11.12')
    })

    it('takes first IP from x-forwarded-for chain', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12',
        },
      })

      const ip = getClientIP(request)
      expect(ip).toBe('1.2.3.4')
    })

    it('trims whitespace from x-forwarded-for', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '  1.2.3.4  ',
        },
      })

      const ip = getClientIP(request)
      expect(ip).toBe('1.2.3.4')
    })

    it('prioritizes cf-connecting-ip over x-real-ip', () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'x-real-ip': '5.6.7.8',
        },
      })

      const ip = getClientIP(request)
      expect(ip).toBe('1.2.3.4')
    })

    it('prioritizes x-real-ip over x-forwarded-for', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-real-ip': '5.6.7.8',
          'x-forwarded-for': '9.10.11.12',
        },
      })

      const ip = getClientIP(request)
      expect(ip).toBe('5.6.7.8')
    })

    it('returns "unknown" when no IP headers present', () => {
      const request = new Request('https://example.com')

      const ip = getClientIP(request)
      expect(ip).toBe('unknown')
    })

    it('handles IPv6 addresses', () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        },
      })

      const ip = getClientIP(request)
      expect(ip).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
    })

    it('handles localhost addresses', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-real-ip': '127.0.0.1',
        },
      })

      const ip = getClientIP(request)
      expect(ip).toBe('127.0.0.1')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty identifier', () => {
      const config: RateLimitConfig = { limit: 5, window: 60000 }
      const result = checkRateLimit('', config)

      expect(result.success).toBe(true)
    })

    it('handles very long identifiers', () => {
      const longId = 'a'.repeat(10000)
      const config: RateLimitConfig = { limit: 5, window: 60000 }
      const result = checkRateLimit(longId, config)

      expect(result.success).toBe(true)
    })

    it('handles special characters in identifier', () => {
      const specialId = 'user@#$%^&*()_+-=[]{}|;:,.<>?'
      const config: RateLimitConfig = { limit: 5, window: 60000 }
      const result = checkRateLimit(specialId, config)

      expect(result.success).toBe(true)
    })

    it('handles rapid sequential requests', () => {
      const identifier = `test-${Date.now()}`
      const config: RateLimitConfig = { limit: 100, window: 60000 }

      // Make 50 rapid requests
      for (let i = 0; i < 50; i++) {
        const result = checkRateLimit(identifier, config)
        expect(result.success).toBe(true)
      }
    })

    it('maintains state across multiple checks', async () => {
      const identifier = `test-${Date.now()}`
      const config: RateLimitConfig = { limit: 3, window: 1000 }

      // First batch
      checkRateLimit(identifier, config)
      checkRateLimit(identifier, config)

      // Wait a bit (but not enough to reset)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should still have only 1 remaining
      const result = checkRateLimit(identifier, config)
      expect(result.remaining).toBe(0)
    })
  })

  describe('Integration Scenarios', () => {
    it('simulates multiple users hitting rate limit', () => {
      const config: RateLimitConfig = { limit: 3, window: 60000 }

      // User 1 uses all requests
      for (let i = 0; i < 3; i++) {
        checkRateLimit('user1', config)
      }

      // User 2 uses all requests
      for (let i = 0; i < 3; i++) {
        checkRateLimit('user2', config)
      }

      // Both should be blocked
      expect(checkRateLimit('user1', config).success).toBe(false)
      expect(checkRateLimit('user2', config).success).toBe(false)

      // User 3 should still work
      expect(checkRateLimit('user3', config).success).toBe(true)
    })

    it('simulates rate limit recovery', async () => {
      const identifier = `test-${Date.now()}`
      const config: RateLimitConfig = { limit: 2, window: 100 }

      // Hit limit
      checkRateLimit(identifier, config)
      checkRateLimit(identifier, config)
      expect(checkRateLimit(identifier, config).success).toBe(false)

      // Wait for reset
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should work again
      expect(checkRateLimit(identifier, config).success).toBe(true)
      expect(checkRateLimit(identifier, config).success).toBe(true)
      expect(checkRateLimit(identifier, config).success).toBe(false)
    })

    it('simulates different rate limits for different endpoints', () => {
      const identifier = `test-${Date.now()}`
      const strictConfig: RateLimitConfig = { limit: 1, window: 60000 }
      const lenientConfig: RateLimitConfig = { limit: 100, window: 60000 }

      // Use up strict limit
      checkRateLimit(identifier, strictConfig)
      expect(checkRateLimit(identifier, strictConfig).success).toBe(false)

      // Lenient should still work (different rate limit)
      expect(checkRateLimit(identifier, lenientConfig).success).toBe(true)
    })
  })
})
