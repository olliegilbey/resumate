'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: '/api/_lib',
      ui_host: 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      defaults: '2025-05-24',
      capture_pageview: true,
      capture_pageleave: true,
      debug: process.env.NODE_ENV === 'development',
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
