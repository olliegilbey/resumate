/**
 * Server-side PostHog event property interfaces.
 *
 * Covers contact-card served + resume preparation/generation/delivery events
 * fired from API routes. Client-side counterparts live in
 * `event-properties-client.ts`.
 *
 * @module lib/analytics/event-properties-server
 */

import type {
  AIProvider,
  ErrorCategory,
  ErrorStage,
  GenerationMethod,
  SalaryPeriod,
} from "./events";
import type { DownloadErrorCode } from "./errors/types";
import type { DownloadBase } from "./types-base";

// ============================================================================
// CONTACT CARD EVENTS (Server)
// ============================================================================

export interface ContactCardServedProperties extends DownloadBase {
  is_server: true;
  download_type: "vcard";
  client_ip: string;
  filename: string;
  full_name: string;
  email_count: number;
  vcard_size: number;
  has_linkedin: boolean;
  has_github: boolean;
  has_location: boolean;
}

// ============================================================================
// RESUME EVENTS - SERVER
// ============================================================================

interface ResumeServerBase extends DownloadBase {
  is_server: true;
  download_type: "resume_ai" | "resume_heuristic";
  client_ip: string;
  generation_method: GenerationMethod;
}

// Shared fields for resume_prepared
interface ResumePreparedCommon {
  session_id?: string;
  email?: string;
  linkedin?: string;
  bullet_ids: string[];
  bullet_count: number;
  bullets_by_company: Record<string, number>;
  bullets_by_tag: Record<string, number>;
  config: {
    max_bullets: number;
    max_per_company: number;
    max_per_position: number;
  };
}

// Heuristic preparation fields
interface ResumePreparedHeuristic extends ResumePreparedCommon {
  generation_method: "heuristic";
  download_type: "resume_heuristic";
  role_profile_id: string;
  role_profile_name: string;
  selection_duration_ms: number;
}

// AI preparation fields
interface ResumePreparedAI extends ResumePreparedCommon {
  generation_method: "ai";
  download_type: "resume_ai";
  ai_provider: AIProvider;
  job_description: string;
  job_description_length: number;
  job_title?: string | null;
  extracted_salary_min?: number | null;
  extracted_salary_max?: number | null;
  salary_currency?: string | null; // ISO 4217
  salary_period?: SalaryPeriod | null;
  ai_response_ms: number;
  tokens_used?: number;
  reasoning?: string;
}

export type ResumePreparedProperties =
  | (Omit<ResumeServerBase, "download_type" | "generation_method"> & ResumePreparedHeuristic)
  | (Omit<ResumeServerBase, "download_type" | "generation_method"> & ResumePreparedAI);

export interface ResumeGeneratedProperties extends ResumeServerBase {
  session_id: string;
  role_profile_id?: string;
  role_profile_name?: string;
  ai_provider?: AIProvider;
  job_title?: string | null;
  bullet_count: number;
  pdf_size: number;
  wasm_load_ms: number;
  generation_ms: number;
  total_duration_ms: number;
  wasm_cached: boolean;
}

export interface ResumeDownloadNotifiedProperties extends ResumeServerBase {
  session_id: string;
  email?: string;
  linkedin?: string;
  bullet_count: number;
  bullets: Array<{
    id: string;
    text: string;
    tags?: string[];
  }>;
  pdf_size: number;
  filename: string;
  // Heuristic mode
  role_profile_id?: string;
  role_profile_name?: string;
  // AI mode
  ai_provider?: AIProvider;
  job_title?: string | null;
  extracted_salary_min?: number | null;
  extracted_salary_max?: number | null;
  salary_currency?: string | null;
  reasoning?: string;
}

export interface ResumeFailedProperties extends ResumeServerBase {
  session_id: string;
  error_code: DownloadErrorCode;
  error_category: ErrorCategory;
  error_stage: ErrorStage;
  error_message: string;
  error_detail?: string;
  error_stack?: string; // development only
  role_profile_id?: string;
  ai_provider?: AIProvider;
  bullet_count?: number;
  is_retryable: boolean;
}
