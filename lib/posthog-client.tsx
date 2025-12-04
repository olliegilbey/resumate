'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect, useCallback } from 'react'
import type { AIProvider } from '@/lib/ai/providers/types'

// Generation method discriminator
export type GenerationMethod = 'ai' | 'heuristic'

// Client-side event types (direct to PostHog via proxy)
export type ClientAnalyticsEvent =
  | 'tag_filter_changed'
  | 'search_performed'
  | 'contact_card_initiated'
  | 'contact_card_verified'
  | 'contact_card_downloaded'
  | 'contact_card_error'
  | 'contact_card_cancelled'
  | 'resume_initiated'
  | 'resume_verified'
  | 'resume_compiled'
  | 'resume_downloaded'
  | 'resume_error'
  | 'resume_cancelled'

export interface TagFilterChangedProperties {
  tags: string[]
  tag_count: number
  result_count: number
}

export interface SearchPerformedProperties {
  query: string
  result_count: number
}

// Contact card flow tracking
export interface ContactCardInitiatedProperties {
  timestamp: number
}

export interface ContactCardVerifiedProperties {
  turnstile_duration_ms: number
}

export interface ContactCardDownloadedProperties {
  total_duration_ms: number
}

export interface ContactCardErrorProperties {
  error_type: 'failed' | 'expired'
  duration_ms: number
}

export interface ContactCardCancelledProperties {
  stage: 'turnstile' | 'verified'
  duration_ms: number
}

// Resume download flow tracking (client-side for accurate GeoIP)
// Supports both heuristic (role profile) and AI (job description) modes

// Base properties shared across modes
interface ResumeBaseProperties {
  generation_method: GenerationMethod
}

// Heuristic mode properties (role profile selection)
interface HeuristicModeProperties extends ResumeBaseProperties {
  generation_method: 'heuristic'
  role_profile_id: string
  role_profile_name: string
}

// AI mode properties (job description analysis)
interface AIModeProperties extends ResumeBaseProperties {
  generation_method: 'ai'
  ai_provider: AIProvider
  job_description_length: number
  job_title?: string | null
  extracted_salary_min?: number | null
  extracted_salary_max?: number | null
  salary_currency?: string | null
}

export type ResumeInitiatedProperties = HeuristicModeProperties | AIModeProperties

export interface ResumeVerifiedProperties {
  generation_method: GenerationMethod
  role_profile_id?: string          // heuristic mode
  ai_provider?: AIProvider          // ai mode
  turnstile_duration_ms: number
}

export interface ResumeCompiledProperties {
  generation_method: GenerationMethod
  role_profile_id?: string          // heuristic mode
  ai_provider?: AIProvider          // ai mode
  bullet_count: number
  wasm_load_ms: number
  wasm_cached: boolean
  generation_ms: number
  pdf_size_bytes: number
  ai_response_ms?: number           // ai mode only
  retry_count?: number              // ai mode only
}

export interface ResumeDownloadedProperties {
  generation_method: GenerationMethod
  role_profile_id?: string
  role_profile_name?: string
  ai_provider?: AIProvider
  job_title?: string | null
  bullet_count: number
  total_duration_ms: number
}

export interface ResumeErrorProperties {
  generation_method: GenerationMethod
  role_profile_id?: string
  ai_provider?: AIProvider
  error_stage: 'turnstile' | 'selection' | 'ai_selection' | 'wasm_load' | 'compilation'
  error_message: string
  duration_ms: number
}

export interface ResumeCancelledProperties {
  generation_method: GenerationMethod
  role_profile_id?: string
  ai_provider?: AIProvider
  stage: 'turnstile' | 'verified' | 'compiling' | 'ai_analyzing'
  duration_ms: number
}

type EventProperties = {
  tag_filter_changed: TagFilterChangedProperties
  search_performed: SearchPerformedProperties
  contact_card_initiated: ContactCardInitiatedProperties
  contact_card_verified: ContactCardVerifiedProperties
  contact_card_downloaded: ContactCardDownloadedProperties
  contact_card_error: ContactCardErrorProperties
  contact_card_cancelled: ContactCardCancelledProperties
  resume_initiated: ResumeInitiatedProperties
  resume_verified: ResumeVerifiedProperties
  resume_compiled: ResumeCompiledProperties
  resume_downloaded: ResumeDownloadedProperties
  resume_error: ResumeErrorProperties
  resume_cancelled: ResumeCancelledProperties
}

/**
 * Hook for tracking client-side analytics events.
 * Events go direct to PostHog via Next.js proxy (/api/_lib).
 * Gracefully handles missing PostHog (dev without key).
 */
export function useTrackEvent() {
  const posthogClient = usePostHog()

  return useCallback(
    <E extends ClientAnalyticsEvent>(event: E, properties: EventProperties[E]) => {
      posthogClient?.capture(event, properties)
    },
    [posthogClient]
  )
}

/**
 * Hook for tracking resume download funnel.
 * Client-side for accurate GeoIP (server-side gives inaccurate location).
 *
 * Funnel: initiated → verified → compiled → downloaded
 * Supports both heuristic (role profile) and AI (job description) modes.
 * Error/cancelled events for drop-off analysis.
 */
export function usePostHogResume() {
  const posthogClient = usePostHog()

  const track = useCallback(
    <E extends Extract<ClientAnalyticsEvent, `resume_${string}`>>(
      event: E,
      properties: EventProperties[E]
    ) => {
      posthogClient?.capture(event, properties)
    },
    [posthogClient]
  )

  return {
    /** Track download button click (before Turnstile) */
    initiated: useCallback(
      (props: ResumeInitiatedProperties) => track('resume_initiated', props),
      [track]
    ),
    /** Track Turnstile verification complete */
    verified: useCallback(
      (props: ResumeVerifiedProperties) => track('resume_verified', props),
      [track]
    ),
    /** Track WASM compilation complete with timing metrics */
    compiled: useCallback(
      (props: ResumeCompiledProperties) => track('resume_compiled', props),
      [track]
    ),
    /** Track successful download trigger */
    downloaded: useCallback(
      (props: ResumeDownloadedProperties) => track('resume_downloaded', props),
      [track]
    ),
    /** Track any error in the flow */
    error: useCallback(
      (props: ResumeErrorProperties) => track('resume_error', props),
      [track]
    ),
    /** Track user cancellation */
    cancelled: useCallback(
      (props: ResumeCancelledProperties) => track('resume_cancelled', props),
      [track]
    ),
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

  useEffect(() => {
    // Guard: Skip init if key is missing (local/dev envs)
    if (!posthogKey) {
      console.log('[PostHog] Key missing, analytics disabled')
      return
    }

    try {
      posthog.init(posthogKey, {
        api_host: '/api/_lib',
        ui_host: 'https://eu.posthog.com',
        person_profiles: 'identified_only',
        defaults: '2025-05-24',
        autocapture: false, // Explicit events only - no input/click noise
        capture_pageview: true,
        capture_pageleave: true,
        debug: process.env.NODE_ENV === 'development',
      })
    } catch (error) {
      console.error('[PostHog] Init failed:', error)
    }
  }, [posthogKey])

  // Skip provider wrapper if key is missing
  if (!posthogKey) {
    return <>{children}</>
  }

  return <PHProvider client={posthog}>{children}</PHProvider>
}
