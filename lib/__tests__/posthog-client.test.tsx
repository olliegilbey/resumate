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

    expect(mockCapture).toHaveBeenCalledWith('tag_filter_changed', expect.objectContaining({
      tags: ['leadership', 'blockchain'],
      tag_count: 2,
      result_count: 15,
    }))
  })

  it('should track search_performed event with correct properties', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('search_performed', {
      query: 'machine learning',
      result_count: 8,
    })

    expect(mockCapture).toHaveBeenCalledWith('search_performed', expect.objectContaining({
      query: 'machine learning',
      result_count: 8,
    }))
  })

  it('should track empty tag selection', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('tag_filter_changed', {
      tags: [],
      tag_count: 0,
      result_count: 50,
    })

    expect(mockCapture).toHaveBeenCalledWith('tag_filter_changed', expect.objectContaining({
      tags: [],
      tag_count: 0,
      result_count: 50,
    }))
  })

  it('should track empty search query', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('search_performed', {
      query: '',
      result_count: 50,
    })

    expect(mockCapture).toHaveBeenCalledWith('search_performed', expect.objectContaining({
      query: '',
      result_count: 50,
    }))
  })

  // Contact card tracking tests
  it('should track contact_card_initiated with download_type', () => {
    const { result } = renderHook(() => useTrackEvent())
    const timestamp = Date.now()

    result.current('contact_card_initiated', {
      download_type: 'vcard',
      timestamp,
    })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_initiated', expect.objectContaining({
      download_type: 'vcard',
      timestamp,
    }))
  })

  it('should track contact_card_verified with download_type and duration', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_verified', {
      download_type: 'vcard',
      turnstile_duration_ms: 2500,
    })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_verified', expect.objectContaining({
      download_type: 'vcard',
      turnstile_duration_ms: 2500,
    }))
  })

  it('should track contact_card_downloaded with download_type and total duration', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_downloaded', {
      download_type: 'vcard',
      total_duration_ms: 3200,
    })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_downloaded', expect.objectContaining({
      download_type: 'vcard',
      total_duration_ms: 3200,
    }))
  })

  it('should track contact_card_error with unified error format', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_error', {
      download_type: 'vcard',
      error_code: 'TN_001',
      error_category: 'turnstile',
      error_stage: 'turnstile',
      error_message: 'Turnstile verification failed',
      is_retryable: true,
      duration_ms: 5000,
    })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_error', expect.objectContaining({
      download_type: 'vcard',
      error_code: 'TN_001',
      error_category: 'turnstile',
      error_stage: 'turnstile',
      error_message: 'Turnstile verification failed',
      is_retryable: true,
      duration_ms: 5000,
    }))
  })

  it('should track contact_card_error with expired error', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_error', {
      download_type: 'vcard',
      error_code: 'TN_002',
      error_category: 'turnstile',
      error_stage: 'turnstile',
      error_message: 'Turnstile verification expired',
      is_retryable: true,
      duration_ms: 120000,
    })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_error', expect.objectContaining({
      download_type: 'vcard',
      error_code: 'TN_002',
      error_message: 'Turnstile verification expired',
      is_retryable: true,
    }))
  })

  it('should track contact_card_cancelled at turnstile stage', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_cancelled', {
      download_type: 'vcard',
      stage: 'turnstile',
      duration_ms: 1500,
    })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_cancelled', expect.objectContaining({
      download_type: 'vcard',
      stage: 'turnstile',
      duration_ms: 1500,
    }))
  })

  it('should track contact_card_cancelled at verified stage', () => {
    const { result } = renderHook(() => useTrackEvent())

    result.current('contact_card_cancelled', {
      download_type: 'vcard',
      stage: 'verified',
      duration_ms: 4000,
    })

    expect(mockCapture).toHaveBeenCalledWith('contact_card_cancelled', expect.objectContaining({
      download_type: 'vcard',
      stage: 'verified',
      duration_ms: 4000,
    }))
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

  it('should track resume_initiated with role profile and download_type', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.initiated({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      role_profile_name: 'Developer Relations Lead',
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_initiated', expect.objectContaining({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      role_profile_name: 'Developer Relations Lead',
    }))
  })

  it('should track resume_verified with download_type and turnstile duration', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.verified({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      turnstile_duration_ms: 2500,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_verified', expect.objectContaining({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      turnstile_duration_ms: 2500,
    }))
  })

  it('should track resume_compiled with download_type and WASM metrics', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.compiled({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      bullet_count: 18,
      wasm_load_ms: 450,
      wasm_cached: false,
      generation_ms: 120,
      pdf_size_bytes: 52480,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_compiled', expect.objectContaining({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      bullet_count: 18,
      wasm_load_ms: 450,
      wasm_cached: false,
      generation_ms: 120,
      pdf_size_bytes: 52480,
    }))
  })

  it('should track resume_compiled with cached WASM (faster load)', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.compiled({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      bullet_count: 18,
      wasm_load_ms: 5, // Much faster when cached
      wasm_cached: true,
      generation_ms: 110,
      pdf_size_bytes: 52480,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_compiled', expect.objectContaining({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      wasm_load_ms: 5,
      wasm_cached: true,
    }))
  })

  it('should track resume_downloaded with download_type and total duration', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.downloaded({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      role_profile_name: 'Developer Relations Lead',
      bullet_count: 18,
      total_duration_ms: 3200,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_downloaded', expect.objectContaining({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      role_profile_name: 'Developer Relations Lead',
      bullet_count: 18,
      total_duration_ms: 3200,
    }))
  })

  it('should track resume_error with unified error format at ai_selection stage', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.error({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      error_code: 'AI_001',
      error_category: 'ai',
      error_stage: 'ai_selection',
      error_message: 'Rate limit exceeded',
      is_retryable: true,
      duration_ms: 1500,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_error', expect.objectContaining({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      error_code: 'AI_001',
      error_category: 'ai',
      error_stage: 'ai_selection',
      error_message: 'Rate limit exceeded',
      is_retryable: true,
    }))
  })

  it('should track resume_error at wasm_load stage', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.error({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      error_code: 'WM_001',
      error_category: 'wasm',
      error_stage: 'wasm_load',
      error_message: 'Failed to fetch WASM module',
      is_retryable: true,
      duration_ms: 5000,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_error', expect.objectContaining({
      error_code: 'WM_001',
      error_category: 'wasm',
      error_stage: 'wasm_load',
      error_message: 'Failed to fetch WASM module',
    }))
  })

  it('should track resume_error at pdf_generation stage', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.error({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      error_code: 'PDF_001',
      error_category: 'pdf',
      error_stage: 'pdf_generation',
      error_message: 'Typst compilation failed',
      is_retryable: false,
      duration_ms: 2000,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_error', expect.objectContaining({
      error_code: 'PDF_001',
      error_stage: 'pdf_generation',
      is_retryable: false,
    }))
  })

  it('should track resume_cancelled with download_type at turnstile stage', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.cancelled({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      stage: 'turnstile',
      duration_ms: 3000,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_cancelled', expect.objectContaining({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      stage: 'turnstile',
      duration_ms: 3000,
    }))
  })

  it('should track resume_cancelled while compiling', () => {
    const { result } = renderHook(() => usePostHogResume())

    result.current.cancelled({
      generation_method: 'heuristic',
      download_type: 'resume_heuristic',
      role_profile_id: 'developer-relations',
      stage: 'compiling',
      duration_ms: 1500,
    })

    expect(mockCapture).toHaveBeenCalledWith('resume_cancelled', expect.objectContaining({
      download_type: 'resume_heuristic',
      stage: 'compiling',
      duration_ms: 1500,
    }))
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
      result.current.initiated({
        generation_method: 'heuristic',
        download_type: 'resume_heuristic',
        role_profile_id: 'test',
        role_profile_name: 'Test',
      })
      result.current.verified({
        generation_method: 'heuristic',
        download_type: 'resume_heuristic',
        role_profile_id: 'test',
        turnstile_duration_ms: 1000,
      })
      result.current.compiled({
        generation_method: 'heuristic',
        download_type: 'resume_heuristic',
        role_profile_id: 'test',
        bullet_count: 10,
        wasm_load_ms: 100,
        wasm_cached: true,
        generation_ms: 50,
        pdf_size_bytes: 10000,
      })
      result.current.downloaded({
        generation_method: 'heuristic',
        download_type: 'resume_heuristic',
        role_profile_id: 'test',
        role_profile_name: 'Test',
        bullet_count: 10,
        total_duration_ms: 1500,
      })
      result.current.error({
        generation_method: 'heuristic',
        download_type: 'resume_heuristic',
        role_profile_id: 'test',
        error_code: 'AI_001',
        error_category: 'ai',
        error_stage: 'ai_selection',
        error_message: 'Test error',
        is_retryable: true,
        duration_ms: 500,
      })
      result.current.cancelled({
        generation_method: 'heuristic',
        download_type: 'resume_heuristic',
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
