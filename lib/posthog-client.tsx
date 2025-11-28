'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect, useCallback } from 'react'

// Client-side event types (direct to PostHog via proxy)
export type ClientAnalyticsEvent =
  | 'tag_filter_changed'
  | 'search_performed'
  | 'contact_card_initiated'
  | 'contact_card_verified'
  | 'contact_card_downloaded'
  | 'contact_card_error'
  | 'contact_card_cancelled'

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

type EventProperties = {
  tag_filter_changed: TagFilterChangedProperties
  search_performed: SearchPerformedProperties
  contact_card_initiated: ContactCardInitiatedProperties
  contact_card_verified: ContactCardVerifiedProperties
  contact_card_downloaded: ContactCardDownloadedProperties
  contact_card_error: ContactCardErrorProperties
  contact_card_cancelled: ContactCardCancelledProperties
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
