/**
 * PostHog Analytics Event Property Types
 *
 * All event property interfaces per spec docs/POSTHOG_DASHBOARD_SPEC.md Section 6.
 * Import from here for type-safe event tracking.
 */

import type {
  DownloadType,
  GenerationMethod,
  AIProvider,
  ErrorStage,
  ErrorCategory,
  CancelStage,
  SalaryPeriod,
  EnvType,
  SourceType,
} from './events'
import type { DownloadErrorCode } from './errors'

// ============================================================================
// BASE INTERFACES
// ============================================================================

/**
 * Environment context required on ALL events
 */
export interface AnalyticsBase {
  env: EnvType
  source: SourceType
  is_server: boolean
}

/**
 * Base for all download-related events (resume + contact card)
 */
export interface DownloadBase extends AnalyticsBase {
  download_type: DownloadType
}

// ============================================================================
// EXPLORER EVENTS (Not download-related)
// ============================================================================

export interface TagFilterChangedProperties extends AnalyticsBase {
  is_server: false
  tags: string[]
  tag_count: number
  result_count: number
}

export interface SearchPerformedProperties extends AnalyticsBase {
  is_server: false
  query: string
  result_count: number
}

// ============================================================================
// CONTACT CARD EVENTS
// ============================================================================

export interface ContactCardInitiatedProperties extends DownloadBase {
  is_server: false
  download_type: 'vcard'
  timestamp: number
}

export interface ContactCardVerifiedProperties extends DownloadBase {
  is_server: false
  download_type: 'vcard'
  turnstile_duration_ms: number
}

export interface ContactCardDownloadedProperties extends DownloadBase {
  is_server: false
  download_type: 'vcard'
  total_duration_ms: number
}

export interface ContactCardErrorProperties extends DownloadBase {
  is_server: false
  download_type: 'vcard'
  error_code: DownloadErrorCode
  error_category: ErrorCategory
  error_stage: 'turnstile' | 'network'
  error_message: string
  error_detail?: string
  duration_ms: number
  is_retryable: boolean
}

export interface ContactCardCancelledProperties extends DownloadBase {
  is_server: false
  download_type: 'vcard'
  stage: 'turnstile' | 'verified'
  duration_ms: number
}

export interface ContactCardServedProperties extends DownloadBase {
  is_server: true
  download_type: 'vcard'
  client_ip: string
  filename: string
  full_name: string
  email_count: number
  vcard_size: number
  has_linkedin: boolean
  has_github: boolean
  has_location: boolean
}

// ============================================================================
// RESUME EVENTS - CLIENT
// ============================================================================

// Base properties for resume events
interface ResumeClientBase extends DownloadBase {
  is_server: false
  download_type: 'resume_ai' | 'resume_heuristic'
  generation_method: GenerationMethod
}

// Heuristic mode properties
interface HeuristicModeFields {
  generation_method: 'heuristic'
  download_type: 'resume_heuristic'
  role_profile_id: string
  role_profile_name: string
}

// AI mode properties
interface AIModeFields {
  generation_method: 'ai'
  download_type: 'resume_ai'
  ai_provider: AIProvider
  job_description_length: number
  job_title?: string | null
  extracted_salary_min?: number | null
  extracted_salary_max?: number | null
  salary_currency?: string | null // ISO 4217
}

// Resume initiated - discriminated union
export type ResumeInitiatedProperties =
  | (Omit<ResumeClientBase, 'download_type' | 'generation_method'> & HeuristicModeFields)
  | (Omit<ResumeClientBase, 'download_type' | 'generation_method'> & AIModeFields)

export interface ResumeVerifiedProperties extends ResumeClientBase {
  role_profile_id?: string // heuristic
  ai_provider?: AIProvider // ai
  turnstile_duration_ms: number
}

export interface ResumeCompiledProperties extends ResumeClientBase {
  role_profile_id?: string // heuristic
  ai_provider?: AIProvider // ai
  bullet_count: number
  wasm_load_ms: number
  wasm_cached: boolean
  generation_ms: number
  pdf_size_bytes: number
  ai_response_ms?: number // ai only
  retry_count?: number // ai only
}

export interface ResumeDownloadedProperties extends ResumeClientBase {
  role_profile_id?: string
  role_profile_name?: string
  ai_provider?: AIProvider
  job_title?: string | null
  bullet_count: number
  total_duration_ms: number
}

export interface ResumeErrorProperties extends ResumeClientBase {
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

export interface ResumeCancelledProperties extends ResumeClientBase {
  role_profile_id?: string
  ai_provider?: AIProvider
  stage: CancelStage
  duration_ms: number
}

// ============================================================================
// RESUME EVENTS - SERVER
// ============================================================================

interface ResumeServerBase extends DownloadBase {
  is_server: true
  download_type: 'resume_ai' | 'resume_heuristic'
  client_ip: string
  generation_method: GenerationMethod
}

// Shared fields for resume_prepared
interface ResumePreparedCommon {
  session_id?: string
  email?: string
  linkedin?: string
  bullet_ids: string[]
  bullet_count: number
  bullets_by_company: Record<string, number>
  bullets_by_tag: Record<string, number>
  config: {
    max_bullets: number
    max_per_company: number
    max_per_position: number
  }
}

// Heuristic preparation fields
interface ResumePreparedHeuristic extends ResumePreparedCommon {
  generation_method: 'heuristic'
  download_type: 'resume_heuristic'
  role_profile_id: string
  role_profile_name: string
  selection_duration_ms: number
}

// AI preparation fields
interface ResumePreparedAI extends ResumePreparedCommon {
  generation_method: 'ai'
  download_type: 'resume_ai'
  ai_provider: AIProvider
  job_description: string
  job_description_length: number
  job_title?: string | null
  extracted_salary_min?: number | null
  extracted_salary_max?: number | null
  salary_currency?: string | null // ISO 4217
  salary_period?: SalaryPeriod | null
  ai_response_ms: number
  tokens_used?: number
  reasoning?: string
}

export type ResumePreparedProperties =
  | (Omit<ResumeServerBase, 'download_type' | 'generation_method'> & ResumePreparedHeuristic)
  | (Omit<ResumeServerBase, 'download_type' | 'generation_method'> & ResumePreparedAI)

export interface ResumeGeneratedProperties extends ResumeServerBase {
  session_id: string
  role_profile_id?: string
  role_profile_name?: string
  ai_provider?: AIProvider
  job_title?: string | null
  bullet_count: number
  pdf_size: number
  wasm_load_ms: number
  generation_ms: number
  total_duration_ms: number
  wasm_cached: boolean
}

export interface ResumeDownloadNotifiedProperties extends ResumeServerBase {
  session_id: string
  email?: string
  linkedin?: string
  bullet_count: number
  bullets: Array<{
    id: string
    text: string
    tags?: string[]
  }>
  pdf_size: number
  filename: string
  // Heuristic mode
  role_profile_id?: string
  role_profile_name?: string
  // AI mode
  ai_provider?: AIProvider
  job_title?: string | null
  extracted_salary_min?: number | null
  extracted_salary_max?: number | null
  salary_currency?: string | null
  reasoning?: string
}

export interface ResumeFailedProperties extends ResumeServerBase {
  session_id: string
  error_code: DownloadErrorCode
  error_category: ErrorCategory
  error_stage: ErrorStage
  error_message: string
  error_detail?: string
  error_stack?: string // development only
  role_profile_id?: string
  ai_provider?: AIProvider
  bullet_count?: number
  is_retryable: boolean
}

// ============================================================================
// EVENT PROPERTIES MAP
// ============================================================================

/**
 * Map of event names to their property types.
 * Used for type-safe event tracking.
 */
export interface EventPropertiesMap {
  // Explorer
  tag_filter_changed: TagFilterChangedProperties
  search_performed: SearchPerformedProperties
  // Contact Card
  contact_card_initiated: ContactCardInitiatedProperties
  contact_card_verified: ContactCardVerifiedProperties
  contact_card_downloaded: ContactCardDownloadedProperties
  contact_card_error: ContactCardErrorProperties
  contact_card_cancelled: ContactCardCancelledProperties
  contact_card_served: ContactCardServedProperties
  // Resume - Client
  resume_initiated: ResumeInitiatedProperties
  resume_verified: ResumeVerifiedProperties
  resume_compiled: ResumeCompiledProperties
  resume_downloaded: ResumeDownloadedProperties
  resume_error: ResumeErrorProperties
  resume_cancelled: ResumeCancelledProperties
  // Resume - Server
  resume_prepared: ResumePreparedProperties
  resume_generated: ResumeGeneratedProperties
  resume_download_notified: ResumeDownloadNotifiedProperties
  resume_failed: ResumeFailedProperties
}
