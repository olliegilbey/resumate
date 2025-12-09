/**
 * PostHog Analytics Event Registry
 *
 * Single source of truth for all event names and core types.
 * Import from here instead of hardcoding event strings.
 */

// ============================================================================
// EVENT NAME CONSTANTS
// ============================================================================

export const ANALYTICS_EVENTS = {
  // Explorer (behavioral, not download)
  TAG_FILTER_CHANGED: 'tag_filter_changed',
  SEARCH_PERFORMED: 'search_performed',

  // Contact Card (vCard)
  CONTACT_CARD_INITIATED: 'contact_card_initiated',
  CONTACT_CARD_VERIFIED: 'contact_card_verified',
  CONTACT_CARD_DOWNLOADED: 'contact_card_downloaded',
  CONTACT_CARD_ERROR: 'contact_card_error',
  CONTACT_CARD_CANCELLED: 'contact_card_cancelled',
  CONTACT_CARD_SERVED: 'contact_card_served',

  // Resume - Client
  RESUME_INITIATED: 'resume_initiated',
  RESUME_VERIFIED: 'resume_verified',
  RESUME_COMPILED: 'resume_compiled',
  RESUME_DOWNLOADED: 'resume_downloaded',
  RESUME_ERROR: 'resume_error',
  RESUME_CANCELLED: 'resume_cancelled',

  // Resume - Server
  RESUME_PREPARED: 'resume_prepared',
  RESUME_GENERATED: 'resume_generated',
  RESUME_DOWNLOAD_NOTIFIED: 'resume_download_notified',
  RESUME_FAILED: 'resume_failed',
} as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

// ============================================================================
// CORE TYPES
// ============================================================================

export type DownloadType = 'resume_ai' | 'resume_heuristic' | 'vcard'
export type GenerationMethod = 'ai' | 'heuristic'
export type AIProvider =
  | 'cerebras-gpt'
  | 'cerebras-llama'
  | 'claude-sonnet'
  | 'claude-haiku'

// Error stages - unified across client/server
export type ErrorStage =
  | 'turnstile'
  | 'bullet_selection'
  | 'ai_selection'
  | 'wasm_load'
  | 'pdf_generation'
  | 'network'

// Error categories for classification
export type ErrorCategory =
  | 'turnstile'
  | 'wasm'
  | 'pdf'
  | 'ai'
  | 'network'
  | 'validation'

// Cancel stages - where user can abort
export type CancelStage = 'turnstile' | 'verified' | 'compiling' | 'ai_analyzing'

// Salary period for AI extraction
export type SalaryPeriod = 'annual' | 'monthly' | 'hourly' | 'daily' | 'weekly'

// ============================================================================
// ENVIRONMENT CONTEXT
// ============================================================================

export type EnvType = 'development' | 'production' | 'test'
export type SourceType = 'local' | 'preview' | 'production'

export interface EnvironmentContext {
  env: EnvType
  source: SourceType
  is_server: boolean
}

/**
 * Get environment context for analytics events.
 * Call from client or server - auto-detects is_server.
 */
export function getEnvironmentContext(isServer: boolean): EnvironmentContext {
  const env = (process.env.NODE_ENV || 'development') as EnvType

  // Server uses VERCEL_ENV, client uses NEXT_PUBLIC_VERCEL_ENV
  const vercelEnv = isServer
    ? process.env.VERCEL_ENV
    : process.env.NEXT_PUBLIC_VERCEL_ENV

  const source: SourceType =
    vercelEnv === 'production'
      ? 'production'
      : vercelEnv === 'preview'
        ? 'preview'
        : 'local'

  return { env, source, is_server: isServer }
}

/**
 * Server-side environment context helper
 */
export function getServerEnvironmentContext(): EnvironmentContext {
  return getEnvironmentContext(true)
}

/**
 * Client-side environment context helper
 */
export function getClientEnvironmentContext(): EnvironmentContext {
  return getEnvironmentContext(false)
}
