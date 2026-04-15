/**
 * Client-side PostHog event property interfaces.
 *
 * Covers explorer, contact-card, and resume events fired from the browser.
 * Server-side counterparts live in `event-properties-server.ts`.
 *
 * @module lib/analytics/event-properties-client
 */

import type {
  AIProvider,
  CancelStage,
  ErrorCategory,
  ErrorStage,
  GenerationMethod,
} from "./events";
import type { DownloadErrorCode } from "./errors/types";
import type { AnalyticsBase, DownloadBase } from "./types-base";

// ============================================================================
// EXPLORER EVENTS (Not download-related)
// ============================================================================

export interface TagFilterChangedProperties extends AnalyticsBase {
  is_server: false;
  tags: string[];
  tag_count: number;
  result_count: number;
}

export interface SearchPerformedProperties extends AnalyticsBase {
  is_server: false;
  query: string;
  result_count: number;
}

// ============================================================================
// CONTACT CARD EVENTS (Client)
// ============================================================================

export interface ContactCardInitiatedProperties extends DownloadBase {
  is_server: false;
  download_type: "vcard";
  timestamp: number;
}

export interface ContactCardVerifiedProperties extends DownloadBase {
  is_server: false;
  download_type: "vcard";
  turnstile_duration_ms: number;
}

export interface ContactCardDownloadedProperties extends DownloadBase {
  is_server: false;
  download_type: "vcard";
  total_duration_ms: number;
}

export interface ContactCardErrorProperties extends DownloadBase {
  is_server: false;
  download_type: "vcard";
  error_code: DownloadErrorCode;
  error_category: ErrorCategory;
  error_stage: "turnstile" | "network";
  error_message: string;
  error_detail?: string;
  duration_ms: number;
  is_retryable: boolean;
}

export interface ContactCardCancelledProperties extends DownloadBase {
  is_server: false;
  download_type: "vcard";
  stage: "turnstile" | "verified";
  duration_ms: number;
}

// ============================================================================
// RESUME EVENTS - CLIENT
// ============================================================================

// Base properties for resume events
interface ResumeClientBase extends DownloadBase {
  is_server: false;
  download_type: "resume_ai" | "resume_heuristic";
  generation_method: GenerationMethod;
}

// Heuristic mode properties
interface HeuristicModeFields {
  generation_method: "heuristic";
  download_type: "resume_heuristic";
  role_profile_id: string;
  role_profile_name: string;
}

// AI mode properties
interface AIModeFields {
  generation_method: "ai";
  download_type: "resume_ai";
  ai_provider: AIProvider;
  job_description_length: number;
  job_title?: string | null;
  extracted_salary_min?: number | null;
  extracted_salary_max?: number | null;
  salary_currency?: string | null; // ISO 4217
}

// Resume initiated - discriminated union
export type ResumeInitiatedProperties =
  | (Omit<ResumeClientBase, "download_type" | "generation_method"> & HeuristicModeFields)
  | (Omit<ResumeClientBase, "download_type" | "generation_method"> & AIModeFields);

export interface ResumeVerifiedProperties extends ResumeClientBase {
  role_profile_id?: string; // heuristic
  ai_provider?: AIProvider; // ai
  turnstile_duration_ms: number;
}

export interface ResumeCompiledProperties extends ResumeClientBase {
  role_profile_id?: string; // heuristic
  ai_provider?: AIProvider; // ai
  bullet_count: number;
  wasm_load_ms: number;
  wasm_cached: boolean;
  generation_ms: number;
  pdf_size_bytes: number;
  ai_response_ms?: number; // ai only
  retry_count?: number; // ai only
}

export interface ResumeDownloadedProperties extends ResumeClientBase {
  role_profile_id?: string;
  role_profile_name?: string;
  ai_provider?: AIProvider;
  job_title?: string | null;
  bullet_count: number;
  total_duration_ms: number;
}

export interface ResumeErrorProperties extends ResumeClientBase {
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

export interface ResumeCancelledProperties extends ResumeClientBase {
  role_profile_id?: string;
  ai_provider?: AIProvider;
  stage: CancelStage;
  duration_ms: number;
}
