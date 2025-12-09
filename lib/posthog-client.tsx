'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect, useCallback, useMemo } from 'react'

// Import from analytics registry
import {
  ANALYTICS_EVENTS,
  getClientEnvironmentContext,
  type DownloadType,
  type GenerationMethod,
  type AIProvider,
  type ErrorStage,
  type ErrorCategory,
  type CancelStage,
} from '@/lib/analytics/events'
import type { DownloadErrorCode } from '@/lib/analytics/errors'

// Re-export types for consumers
export type { DownloadType, GenerationMethod, AIProvider, ErrorStage, ErrorCategory, CancelStage }

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

// ============================================================================
// EXPLORER EVENTS
// ============================================================================

export interface TagFilterChangedProperties {
  tags: string[]
  tag_count: number
  result_count: number
}

export interface SearchPerformedProperties {
  query: string
  result_count: number
}

// ============================================================================
// CONTACT CARD EVENTS
// ============================================================================

export interface ContactCardInitiatedProperties {
  download_type: 'vcard'
  timestamp: number
}

export interface ContactCardVerifiedProperties {
  download_type: 'vcard'
  turnstile_duration_ms: number
}

export interface ContactCardDownloadedProperties {
  download_type: 'vcard'
  total_duration_ms: number
}

export interface ContactCardErrorProperties {
  download_type: 'vcard'
  error_code: DownloadErrorCode
  error_category: ErrorCategory
  error_stage: 'turnstile' | 'network'
  error_message: string
  error_detail?: string
  duration_ms: number
  is_retryable: boolean
}

export interface ContactCardCancelledProperties {
  download_type: 'vcard'
  stage: 'turnstile' | 'verified'
  duration_ms: number
}

// ============================================================================
// RESUME EVENTS
// ============================================================================

// Base properties shared across modes
interface ResumeBaseProperties {
  download_type: 'resume_ai' | 'resume_heuristic'
  generation_method: GenerationMethod
}

// Heuristic mode properties (role profile selection)
interface HeuristicModeProperties extends ResumeBaseProperties {
  download_type: 'resume_heuristic'
  generation_method: 'heuristic'
  role_profile_id: string
  role_profile_name: string
}

// AI mode properties (job description analysis)
interface AIModeProperties extends ResumeBaseProperties {
  download_type: 'resume_ai'
  generation_method: 'ai'
  ai_provider: AIProvider
  job_description_length: number
  job_title?: string | null
  extracted_salary_min?: number | null
  extracted_salary_max?: number | null
  salary_currency?: string | null // ISO 4217
}

export type ResumeInitiatedProperties = HeuristicModeProperties | AIModeProperties

export interface ResumeVerifiedProperties {
  download_type: 'resume_ai' | 'resume_heuristic'
  generation_method: GenerationMethod
  role_profile_id?: string // heuristic mode
  ai_provider?: AIProvider // ai mode
  turnstile_duration_ms: number
}

export interface ResumeCompiledProperties {
  download_type: 'resume_ai' | 'resume_heuristic'
  generation_method: GenerationMethod
  role_profile_id?: string // heuristic mode
  ai_provider?: AIProvider // ai mode
  bullet_count: number
  wasm_load_ms: number
  wasm_cached: boolean
  generation_ms: number
  pdf_size_bytes: number
  ai_response_ms?: number // ai mode only
  retry_count?: number // ai mode only
}

export interface ResumeDownloadedProperties {
  download_type: 'resume_ai' | 'resume_heuristic'
  generation_method: GenerationMethod
  role_profile_id?: string
  role_profile_name?: string
  ai_provider?: AIProvider
  job_title?: string | null
  bullet_count: number
  total_duration_ms: number
}

export interface ResumeErrorProperties {
  download_type: 'resume_ai' | 'resume_heuristic'
  generation_method: GenerationMethod
  role_profile_id?: string
  ai_provider?: AIProvider
  error_code: DownloadErrorCode
  error_category: ErrorCategory
  error_stage: ErrorStage
  error_message: string
  error_detail?: string
  duration_ms: number
  is_retryable: boolean
}

export interface ResumeCancelledProperties {
  download_type: 'resume_ai' | 'resume_heuristic'
  generation_method: GenerationMethod
  role_profile_id?: string
  ai_provider?: AIProvider
  stage: CancelStage
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
 * Automatically injects environment context (env, source, is_server).
 * Gracefully handles missing PostHog (dev without key).
 */
export function useTrackEvent() {
  const posthogClient = usePostHog()
  const envContext = useMemo(() => getClientEnvironmentContext(), [])

  return useCallback(
    <E extends ClientAnalyticsEvent>(event: E, properties: EventProperties[E]) => {
      posthogClient?.capture(event, { ...envContext, ...properties })
    },
    [posthogClient, envContext]
  )
}

/**
 * Hook for tracking resume download funnel.
 * Client-side for accurate GeoIP (server-side gives inaccurate location).
 *
 * Funnel: initiated -> verified -> compiled -> downloaded
 * Supports both heuristic (role profile) and AI (job description) modes.
 * Error/cancelled events for drop-off analysis.
 *
 * All events include environment context (env, source, is_server: false).
 */
export function usePostHogResume() {
  const posthogClient = usePostHog()
  const envContext = useMemo(() => getClientEnvironmentContext(), [])

  const track = useCallback(
    <E extends Extract<ClientAnalyticsEvent, `resume_${string}`>>(
      event: E,
      properties: EventProperties[E]
    ) => {
      posthogClient?.capture(event, { ...envContext, ...properties })
    },
    [posthogClient, envContext]
  )

  return {
    /** Track download button click (before Turnstile) */
    initiated: useCallback(
      (props: ResumeInitiatedProperties) =>
        track(ANALYTICS_EVENTS.RESUME_INITIATED as 'resume_initiated', props),
      [track]
    ),
    /** Track Turnstile verification complete */
    verified: useCallback(
      (props: ResumeVerifiedProperties) =>
        track(ANALYTICS_EVENTS.RESUME_VERIFIED as 'resume_verified', props),
      [track]
    ),
    /** Track WASM compilation complete with timing metrics */
    compiled: useCallback(
      (props: ResumeCompiledProperties) =>
        track(ANALYTICS_EVENTS.RESUME_COMPILED as 'resume_compiled', props),
      [track]
    ),
    /** Track successful download trigger */
    downloaded: useCallback(
      (props: ResumeDownloadedProperties) =>
        track(ANALYTICS_EVENTS.RESUME_DOWNLOADED as 'resume_downloaded', props),
      [track]
    ),
    /** Track any error in the flow */
    error: useCallback(
      (props: ResumeErrorProperties) =>
        track(ANALYTICS_EVENTS.RESUME_ERROR as 'resume_error', props),
      [track]
    ),
    /** Track user cancellation */
    cancelled: useCallback(
      (props: ResumeCancelledProperties) =>
        track(ANALYTICS_EVENTS.RESUME_CANCELLED as 'resume_cancelled', props),
      [track]
    ),
  }
}

/**
 * Hook for tracking contact card download funnel.
 * All events include environment context (env, source, is_server: false).
 */
export function usePostHogContactCard() {
  const posthogClient = usePostHog()
  const envContext = useMemo(() => getClientEnvironmentContext(), [])

  const track = useCallback(
    <E extends Extract<ClientAnalyticsEvent, `contact_card_${string}`>>(
      event: E,
      properties: EventProperties[E]
    ) => {
      posthogClient?.capture(event, { ...envContext, ...properties })
    },
    [posthogClient, envContext]
  )

  return {
    /** Track download button click (before Turnstile) */
    initiated: useCallback(
      (props: ContactCardInitiatedProperties) =>
        track(ANALYTICS_EVENTS.CONTACT_CARD_INITIATED as 'contact_card_initiated', props),
      [track]
    ),
    /** Track Turnstile verification complete */
    verified: useCallback(
      (props: ContactCardVerifiedProperties) =>
        track(ANALYTICS_EVENTS.CONTACT_CARD_VERIFIED as 'contact_card_verified', props),
      [track]
    ),
    /** Track successful download */
    downloaded: useCallback(
      (props: ContactCardDownloadedProperties) =>
        track(ANALYTICS_EVENTS.CONTACT_CARD_DOWNLOADED as 'contact_card_downloaded', props),
      [track]
    ),
    /** Track any error in the flow */
    error: useCallback(
      (props: ContactCardErrorProperties) =>
        track(ANALYTICS_EVENTS.CONTACT_CARD_ERROR as 'contact_card_error', props),
      [track]
    ),
    /** Track user cancellation */
    cancelled: useCallback(
      (props: ContactCardCancelledProperties) =>
        track(ANALYTICS_EVENTS.CONTACT_CARD_CANCELLED as 'contact_card_cancelled', props),
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
