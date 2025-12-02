import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTrackEvent, usePostHogResume } from '../posthog-client'

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

/**
 * Resume download funnel tracking tests
 * Client-side events for accurate GeoIP and funnel analysis
 */
describe('usePostHogResume', () => {
  beforeEach(() => {
    mockCapture.mockClear()
  })

  it('should track resume_initiated with role profile', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.initiated({
      role_profile_id: 'developer-relations',
      role_profile_name: 'Developer Relations Lead',
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_initiated', {
      role_profile_id: 'developer-relations',
      role_profile_name: 'Developer Relations Lead',
    })
  })

  it('should track resume_verified with turnstile duration', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.verified({
      role_profile_id: 'developer-relations',
      turnstile_duration_ms: 2500,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_verified', {
      role_profile_id: 'developer-relations',
      turnstile_duration_ms: 2500,
    })
  })

  it('should track resume_compiled with WASM metrics', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.compiled({
      role_profile_id: 'developer-relations',
      bullet_count: 18,
      wasm_load_ms: 450,
      wasm_cached: false,
      generation_ms: 120,
      pdf_size_bytes: 52480,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_compiled', {
      role_profile_id: 'developer-relations',
      bullet_count: 18,
      wasm_load_ms: 450,
      wasm_cached: false,
      generation_ms: 120,
      pdf_size_bytes: 52480,
    })
  })

  it('should track resume_compiled with cached WASM (faster load)', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.compiled({
      role_profile_id: 'developer-relations',
      bullet_count: 18,
      wasm_load_ms: 5, // Much faster when cached
      wasm_cached: true,
      generation_ms: 110,
      pdf_size_bytes: 52480,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_compiled', {
      role_profile_id: 'developer-relations',
      bullet_count: 18,
      wasm_load_ms: 5,
      wasm_cached: true,
      generation_ms: 110,
      pdf_size_bytes: 52480,
    })
  })

  it('should track resume_downloaded with total duration', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.downloaded({
      role_profile_id: 'developer-relations',
      role_profile_name: 'Developer Relations Lead',
      bullet_count: 18,
      total_duration_ms: 3200,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_downloaded', {
      role_profile_id: 'developer-relations',
      role_profile_name: 'Developer Relations Lead',
      bullet_count: 18,
      total_duration_ms: 3200,
    })
  })

  it('should track resume_error at selection stage', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.error({
      role_profile_id: 'developer-relations',
      error_stage: 'selection',
      error_message: 'Rate limit exceeded',
      duration_ms: 1500,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_error', {
      role_profile_id: 'developer-relations',
      error_stage: 'selection',
      error_message: 'Rate limit exceeded',
      duration_ms: 1500,
    })
  })

  it('should track resume_error at wasm_load stage', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.error({
      role_profile_id: 'developer-relations',
      error_stage: 'wasm_load',
      error_message: 'Failed to fetch WASM module',
      duration_ms: 5000,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_error', {
      role_profile_id: 'developer-relations',
      error_stage: 'wasm_load',
      error_message: 'Failed to fetch WASM module',
      duration_ms: 5000,
    })
  })

  it('should track resume_error at compilation stage', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.error({
      role_profile_id: 'developer-relations',
      error_stage: 'compilation',
      error_message: 'Typst compilation failed',
      duration_ms: 2000,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_error', {
      role_profile_id: 'developer-relations',
      error_stage: 'compilation',
      error_message: 'Typst compilation failed',
      duration_ms: 2000,
    })
  })

  it('should track resume_cancelled at turnstile stage', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.cancelled({
      role_profile_id: 'developer-relations',
      stage: 'turnstile',
      duration_ms: 3000,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_cancelled', {
      role_profile_id: 'developer-relations',
      stage: 'turnstile',
      duration_ms: 3000,
    })
  })

  it('should track resume_cancelled while compiling', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.cancelled({
      role_profile_id: 'developer-relations',
      stage: 'compiling',
      duration_ms: 1500,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_cancelled', {
      role_profile_id: 'developer-relations',
      stage: 'compiling',
      duration_ms: 1500,
    })
  })

  it('should not throw when PostHog client is undefined', async () => {
    // Re-mock with undefined client
    vi.doMock('posthog-js/react', () => ({
      usePostHog: () => undefined,
      PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
    }))

    const { usePostHogResume: usePostHogResumeFresh } = await import('../posthog-client')
    const { renderHook: renderHookFresh } = await import('@testing-library/react')

    const { result } = renderHookFresh(() => usePostHogResumeFresh())

    // None should throw
    expect(() => {
      result.current.initiated({ role_profile_id: 'test', role_profile_name: 'Test' })
      result.current.verified({ role_profile_id: 'test', turnstile_duration_ms: 1000 })
      result.current.compiled({
        role_profile_id: 'test',
        bullet_count: 10,
        wasm_load_ms: 100,
        wasm_cached: true,
        generation_ms: 50,
        pdf_size_bytes: 10000,
      })
      result.current.downloaded({
        role_profile_id: 'test',
        role_profile_name: 'Test',
        bullet_count: 10,
        total_duration_ms: 1500,
      })
      result.current.error({
        role_profile_id: 'test',
        error_stage: 'selection',
        error_message: 'Test error',
        duration_ms: 500,
      })
      result.current.cancelled({
        role_profile_id: 'test',
        stage: 'turnstile',
        duration_ms: 300,
      })
    }).not.toThrow()
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
