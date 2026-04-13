/**
 * Client-side PostHog event type definitions.
 *
 * Contains `ClientAnalyticsEvent` (the union of events fired directly from the
 * browser) and the per-event property interfaces, plus the `EventProperties`
 * map used by the `useTrackEvent`/`usePostHogResume`/`usePostHogContactCard`
 * hooks. Extracted from `lib/posthog-client.tsx` so the provider and hook
 * modules can share these types without duplication.
 *
 * Env context (`env`, `source`, `is_server`) is injected at capture time by the
 * hooks — it is not part of these property interfaces.
 *
 * @module lib/posthog-events
 */

import type {
  AIProvider,
  CancelStage,
  ErrorCategory,
  ErrorStage,
  GenerationMethod,
} from "@/lib/analytics/events";
import type { DownloadErrorCode } from "@/lib/analytics/errors/types";

/**
 * Union of client-side event names (direct to PostHog via proxy).
 */
export type ClientAnalyticsEvent =
  | "tag_filter_changed"
  | "search_performed"
  | "contact_card_initiated"
  | "contact_card_verified"
  | "contact_card_downloaded"
  | "contact_card_error"
  | "contact_card_cancelled"
  | "resume_initiated"
  | "resume_verified"
  | "resume_compiled"
  | "resume_downloaded"
  | "resume_error"
  | "resume_cancelled";

// ============================================================================
// EXPLORER EVENTS
// ============================================================================

export interface TagFilterChangedProperties {
  tags: string[];
  tag_count: number;
  result_count: number;
}

export interface SearchPerformedProperties {
  query: string;
  result_count: number;
}

// ============================================================================
// CONTACT CARD EVENTS
// ============================================================================

export interface ContactCardInitiatedProperties {
  download_type: "vcard";
  timestamp: number;
}

export interface ContactCardVerifiedProperties {
  download_type: "vcard";
  turnstile_duration_ms: number;
}

export interface ContactCardDownloadedProperties {
  download_type: "vcard";
  total_duration_ms: number;
}

export interface ContactCardErrorProperties {
  download_type: "vcard";
  error_code: DownloadErrorCode;
  error_category: ErrorCategory;
  error_stage: "turnstile" | "network";
  error_message: string;
  error_detail?: string;
  duration_ms: number;
  is_retryable: boolean;
}

export interface ContactCardCancelledProperties {
  download_type: "vcard";
  stage: "turnstile" | "verified";
  duration_ms: number;
}

// ============================================================================
// RESUME EVENTS
// ============================================================================

// Base properties shared across modes
interface ResumeBaseProperties {
  download_type: "resume_ai" | "resume_heuristic";
  generation_method: GenerationMethod;
}

// Heuristic mode properties (role profile selection)
interface HeuristicModeProperties extends ResumeBaseProperties {
  download_type: "resume_heuristic";
  generation_method: "heuristic";
  role_profile_id: string;
  role_profile_name: string;
}

// AI mode properties (job description analysis)
interface AIModeProperties extends ResumeBaseProperties {
  download_type: "resume_ai";
  generation_method: "ai";
  ai_provider: AIProvider;
  job_description_length: number;
  job_title?: string | null;
  extracted_salary_min?: number | null;
  extracted_salary_max?: number | null;
  salary_currency?: string | null; // ISO 4217
}

export type ResumeInitiatedProperties = HeuristicModeProperties | AIModeProperties;

export interface ResumeVerifiedProperties {
  download_type: "resume_ai" | "resume_heuristic";
  generation_method: GenerationMethod;
  role_profile_id?: string; // heuristic mode
  ai_provider?: AIProvider; // ai mode
  turnstile_duration_ms: number;
}

export interface ResumeCompiledProperties {
  download_type: "resume_ai" | "resume_heuristic";
  generation_method: GenerationMethod;
  role_profile_id?: string; // heuristic mode
  ai_provider?: AIProvider; // ai mode
  bullet_count: number;
  wasm_load_ms: number;
  wasm_cached: boolean;
  generation_ms: number;
  pdf_size_bytes: number;
  ai_response_ms?: number; // ai mode only
  retry_count?: number; // ai mode only
}

export interface ResumeDownloadedProperties {
  download_type: "resume_ai" | "resume_heuristic";
  generation_method: GenerationMethod;
  role_profile_id?: string;
  role_profile_name?: string;
  ai_provider?: AIProvider;
  job_title?: string | null;
  bullet_count: number;
  total_duration_ms: number;
}

export interface ResumeErrorProperties {
  download_type: "resume_ai" | "resume_heuristic";
  generation_method: GenerationMethod;
  role_profile_id?: string;
  ai_provider?: AIProvider;
  error_code: DownloadErrorCode;
  error_category: ErrorCategory;
  error_stage: ErrorStage;
  error_message: string;
  error_detail?: string;
  duration_ms: number;
  is_retryable: boolean;
}

export interface ResumeCancelledProperties {
  download_type: "resume_ai" | "resume_heuristic";
  generation_method: GenerationMethod;
  role_profile_id?: string;
  ai_provider?: AIProvider;
  stage: CancelStage;
  duration_ms: number;
}

/**
 * Map of client-side event names to their property interfaces.
 * Used for type-safe event tracking by the PostHog hooks.
 */
export type EventProperties = {
  tag_filter_changed: TagFilterChangedProperties;
  search_performed: SearchPerformedProperties;
  contact_card_initiated: ContactCardInitiatedProperties;
  contact_card_verified: ContactCardVerifiedProperties;
  contact_card_downloaded: ContactCardDownloadedProperties;
  contact_card_error: ContactCardErrorProperties;
  contact_card_cancelled: ContactCardCancelledProperties;
  resume_initiated: ResumeInitiatedProperties;
  resume_verified: ResumeVerifiedProperties;
  resume_compiled: ResumeCompiledProperties;
  resume_downloaded: ResumeDownloadedProperties;
  resume_error: ResumeErrorProperties;
  resume_cancelled: ResumeCancelledProperties;
};
