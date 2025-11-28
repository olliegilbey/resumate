import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTrackEvent } from '../posthog-client'

// Mock posthog-js/react
const mockCapture = vi.fn()
vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({
    capture: mockCapture,
  }),
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('useTrackEvent', () => {
  beforeEach(() => {
    mockCapture.mockClear()
  })

  it('should track tag_filter_changed event with correct properties', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('tag_filter_changed', {
      tags: ['leadership', 'blockchain'],
      tag_count: 2,
      result_count: 15,
    })

    expect(mockCapture).toHaveBeenCalledWith('tag_filter_changed', {
      tags: ['leadership', 'blockchain'],
      tag_count: 2,
      result_count: 15,
    })
  })

  it('should track search_performed event with correct properties', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('search_performed', {
      query: 'machine learning',
      result_count: 8,
    })

    expect(mockCapture).toHaveBeenCalledWith('search_performed', {
      query: 'machine learning',
      result_count: 8,
    })
  })

  it('should track empty tag selection', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('tag_filter_changed', {
      tags: [],
      tag_count: 0,
      result_count: 50,
    })

    expect(mockCapture).toHaveBeenCalledWith('tag_filter_changed', {
      tags: [],
      tag_count: 0,
      result_count: 50,
    })
  })

  it('should track empty search query', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('search_performed', {
      query: '',
      result_count: 50,
    })

    expect(mockCapture).toHaveBeenCalledWith('search_performed', {
      query: '',
      result_count: 50,
    })
  })

  // Contact card tracking tests
  it('should track contact_card_initiated', () => {
    const { result } = renderHook(() => useTrackEvent())
    const timestamp = Date.now()

    result.current('contact_card_initiated', { timestamp })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_initiated', { timestamp })
  })

  it('should track contact_card_verified with duration', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_verified', { turnstile_duration_ms: 2500 })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_verified', {
      turnstile_duration_ms: 2500,
    })
  })

  it('should track contact_card_downloaded with total duration', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_downloaded', { total_duration_ms: 3200 })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_downloaded', {
      total_duration_ms: 3200,
    })
  })

  it('should track contact_card_error with error type', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_error', { error_type: 'failed', duration_ms: 5000 })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_error', {
      error_type: 'failed',
      duration_ms: 5000,
    })
  })

  it('should track contact_card_error with expired type', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_error', { error_type: 'expired', duration_ms: 120000 })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_error', {
      error_type: 'expired',
      duration_ms: 120000,
    })
  })

  it('should track contact_card_cancelled at turnstile stage', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_cancelled', { stage: 'turnstile', duration_ms: 1500 })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_cancelled', {
      stage: 'turnstile',
      duration_ms: 1500,
    })
  })

  it('should track contact_card_cancelled at verified stage', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_cancelled', { stage: 'verified', duration_ms: 4000 })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_cancelled', {
      stage: 'verified',
      duration_ms: 4000,
    })
  })
})

describe('useTrackEvent with missing PostHog', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should not throw when PostHog client is undefined', async () => {
    // Re-mock with undefined client
    vi.doMock('posthog-js/react', () => ({
      usePostHog: () => undefined,
      PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
    }))

    // Re-import to get fresh module with new mock
    const { useTrackEvent: useTrackEventFresh } = await import('../posthog-client')
    const { renderHook: renderHookFresh } = await import('@testing-library/react')

    const { result } = renderHookFresh(() => useTrackEventFresh())

    // Should not throw
    expect(() => {
      result.current('tag_filter_changed', {
        tags: ['test'],
        tag_count: 1,
        result_count: 10,
      })
    }).not.toThrow()
  })
})
