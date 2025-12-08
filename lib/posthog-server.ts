import { PostHog } from 'posthog-node'

// Import from analytics registry
import {
  ANALYTICS_EVENTS,
  getServerEnvironmentContext,
  type GenerationMethod,
  type AIProvider,
} from '@/lib/analytics/events'

// Re-export types for consumers
export type { GenerationMethod, AIProvider }

/**
 * Server-side PostHog client for analytics and event tracking
 * Singleton pattern ensures single instance across API routes
 */

// Server-side event property types (snake_case per spec)
export interface ResumeAIPreparedProperties {
  session_id?: string
  email?: string
  linkedin?: string
  generation_method: 'ai'
  download_type: 'resume_ai'
  ai_provider: AIProvider
  job_description: string // Full JD for n8n analysis
  job_description_length: number
  job_title?: string | null
  extracted_salary_min?: number | null
  extracted_salary_max?: number | null
  salary_currency?: string | null // ISO 4217
  salary_period?: string | null
  bullet_ids: string[]
  bullet_count: number
  bullets_by_company: Record<string, number>
  bullets_by_tag: Record<string, number>
  config: {
    max_bullets: number
    max_per_company: number
    max_per_position: number
  }
  ai_response_ms: number
  tokens_used?: number
  reasoning?: string
  client_ip?: string
}

export interface ResumeHeuristicPreparedProperties {
  session_id?: string
  email?: string
  linkedin?: string
  generation_method: 'heuristic'
  download_type: 'resume_heuristic'
  role_profile_id: string
  role_profile_name: string
  bullet_ids: string[]
  bullet_count: number
  bullets_by_company: Record<string, number>
  bullets_by_tag: Record<string, number>
  config: {
    max_bullets: number
    max_per_company: number
    max_per_position: number
  }
  selection_duration_ms: number
  client_ip?: string
}

export type ResumePreparedProperties = ResumeAIPreparedProperties | ResumeHeuristicPreparedProperties

let posthogInstance: PostHog | null = null

export function getPostHogClient(): PostHog | null {
  // Skip in development unless explicitly enabled
  const isDev = process.env.NODE_ENV === 'development'
  const enableInDev = process.env.POSTHOG_ENABLE_DEV === 'true'

  if (isDev && !enableInDev) {
    console.log('[PostHog] Disabled in development (set POSTHOG_ENABLE_DEV=true to enable)')
    return null
  }

  // Return existing instance if available
  if (posthogInstance) {
    return posthogInstance
  }

  // Validate API key
  const apiKey = process.env.POSTHOG_API_KEY
  if (!apiKey) {
    console.warn('[PostHog] POSTHOG_API_KEY not set, analytics disabled')
    return null
  }

  // Initialize client
  try {
    posthogInstance = new PostHog(apiKey, {
      host: 'https://eu.i.posthog.com',
      // Serverless requires immediate flush - no batching
      // https://posthog.com/docs/libraries/node#serverless-environments
      flushAt: 1,
      flushInterval: 0,
    })

    console.log('[PostHog] Server client initialized')
    return posthogInstance
  } catch (error) {
    console.error('[PostHog] Failed to initialize:', error)
    return null
  }
}

/**
 * Safely capture event without throwing on failure.
 * Automatically injects environment context (env, source, is_server: true).
 *
 * @param distinctId - Unique identifier (session_id or client_ip)
 * @param event - Event name (use ANALYTICS_EVENTS constants)
 * @param properties - Event properties (snake_case)
 * @param ip - Optional client IP for GeoIP lookup (recommended for location tracking)
 */
export async function captureEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
  ip?: string
): Promise<void> {
  const client = getPostHogClient()
  if (!client) return

  const envContext = getServerEnvironmentContext()

  try {
    client.capture({
      distinctId,
      event,
      properties: {
        ...envContext,
        ...properties,
        timestamp: new Date().toISOString(),
      },
      // $ip must be top-level for PostHog GeoIP lookup (not inside properties)
      ...(ip && { $ip: ip }),
    })
    console.log(`[PostHog] Event captured: ${event} for ${distinctId}${ip ? ` from ${ip}` : ''}`)
  } catch (error) {
    console.error('[PostHog] Failed to capture event:', event, error)
  }
}

/**
 * Type-safe event capture for resume events.
 * Uses ANALYTICS_EVENTS constants and proper typing.
 */
export async function captureResumeEvent(
  distinctId: string,
  event: (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS],
  properties: Record<string, unknown>,
  ip?: string
): Promise<void> {
  return captureEvent(distinctId, event, properties, ip)
}

/**
 * Shutdown client and flush pending events (call before serverless function exits)
 * Uses shutdown() instead of flush() for reliable completion in serverless
 * https://posthog.com/docs/libraries/node#serverless-environments
 */
export async function flushEvents(): Promise<void> {
  if (!posthogInstance) return

  try {
    console.log('[PostHog] Shutting down...')
    await posthogInstance.shutdown()
    console.log('[PostHog] Shutdown complete')
  } catch (error) {
    // Best-effort: log but don't throw - analytics shouldn't break core functionality
    console.error('[PostHog] Failed to shutdown:', error)
  } finally {
    // Reset singleton so next request creates fresh instance
    posthogInstance = null
  }
}
