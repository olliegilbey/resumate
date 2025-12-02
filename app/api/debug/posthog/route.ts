import { NextResponse } from 'next/server'
import { getPostHogClient, captureEvent, flushEvents } from '@/lib/posthog-server'

/**
 * DEBUG ENDPOINT - Remove after diagnosing PostHog issue
 * GET /api/debug/posthog
 */
export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      POSTHOG_API_KEY: process.env.POSTHOG_API_KEY ? `${process.env.POSTHOG_API_KEY.substring(0, 10)}...` : 'NOT SET',
      POSTHOG_ENABLE_DEV: process.env.POSTHOG_ENABLE_DEV,
    },
  }

  try {
    const client = getPostHogClient()
    diagnostics.clientInitialized = client !== null

    if (client) {
      // Try to capture a test event
      await captureEvent('debug-endpoint', 'debug_posthog_test', {
        source: 'api/debug/posthog',
        timestamp: new Date().toISOString(),
      })
      diagnostics.eventCaptured = true

      await flushEvents()
      diagnostics.eventsFlushed = true
    }
  } catch (error) {
    diagnostics.error = error instanceof Error ? error.message : String(error)
  }

  return NextResponse.json(diagnostics)
}

export const dynamic = 'force-dynamic'
