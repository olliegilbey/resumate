'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

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
