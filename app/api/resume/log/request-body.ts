/**
 * `POST /api/resume/log` request body types and normalization.
 *
 * The endpoint accepts both snake_case (canonical) and camelCase (legacy) keys.
 * {@link normalizeRequestBody} collapses them into a single snake_case shape
 * the handler can consume.
 *
 * @module app/api/resume/log/request-body
 */

import type { GenerationMethod, DownloadType } from "@/lib/analytics/events";
import type { DownloadErrorCode, ErrorCategory, ErrorStage } from "@/lib/analytics/errors/types";

/** Raw POST body shape — all fields optional, validation happens downstream. */
export type LogRequestBody = Partial<{
  event: string;
  session_id: string;
  generation_method: GenerationMethod;
  download_type: DownloadType;
  email: string;
  linkedin: string;
  role_profile_id: string;
  role_profile_name: string;
  ai_provider: string;
  job_title: string;
  extracted_salary_min: number;
  extracted_salary_max: number;
  salary_currency: string;
  reasoning: string;
  bullet_count: number;
  bullets: unknown;
  pdf_size: number;
  filename: string;
  wasm_load_ms: number;
  generation_ms: number;
  total_duration_ms: number;
  wasm_cached: boolean;
  error_code: DownloadErrorCode;
  error_category: ErrorCategory;
  error_stage: ErrorStage;
  error_message: string;
  error_detail: unknown;
  error_stack: string;
  is_retryable: boolean;
  // Legacy camelCase support (will be deprecated)
  sessionId: string;
  roleProfileId: string;
  roleProfileName: string;
  bulletCount: number;
  pdfSize: number;
  wasmLoadDuration: number;
  generationDuration: number;
  totalDuration: number;
  wasmCached: boolean;
  errorMessage: string;
  errorStage: ErrorStage;
  errorStack: string;
}>;

/** Snake_case-only view of the request body after legacy keys are folded in. */
export interface NormalizedLogBody {
  event: string | undefined;
  session_id: string | undefined;
  generation_method: GenerationMethod | undefined;
  download_type: DownloadType | undefined;
  email: string | undefined;
  linkedin: string | undefined;
  role_profile_id: string | undefined;
  role_profile_name: string | undefined;
  ai_provider: string | undefined;
  job_title: string | undefined;
  extracted_salary_min: number | undefined;
  extracted_salary_max: number | undefined;
  salary_currency: string | undefined;
  reasoning: string | undefined;
  bullet_count: number | undefined;
  bullets: unknown;
  pdf_size: number | undefined;
  filename: string | undefined;
  wasm_load_ms: number | undefined;
  generation_ms: number | undefined;
  total_duration_ms: number | undefined;
  wasm_cached: boolean | undefined;
  error_code: DownloadErrorCode | undefined;
  error_category: ErrorCategory | undefined;
  error_stage: ErrorStage | undefined;
  error_message: string | undefined;
  error_detail: unknown;
  error_stack: string | undefined;
  is_retryable: boolean | undefined;
}

/**
 * Collapse snake_case + legacy camelCase fields into a single normalized body.
 *
 * Snake_case wins when both are present.
 *
 * @param body - Raw JSON decoded from the `/api/resume/log` request.
 * @returns A canonical `NormalizedLogBody` with one key per logical field.
 * @example
 * ```ts
 * normalizeRequestBody({ sessionId: "abc", wasmLoadDuration: 42 });
 * // → { session_id: "abc", wasm_load_ms: 42, ... }
 * ```
 */
export function normalizeRequestBody(body: LogRequestBody): NormalizedLogBody {
  return {
    event: body.event,
    session_id: body.session_id || body.sessionId,
    generation_method: body.generation_method,
    download_type: body.download_type,
    email: body.email,
    linkedin: body.linkedin,
    role_profile_id: body.role_profile_id || body.roleProfileId,
    role_profile_name: body.role_profile_name || body.roleProfileName,
    ai_provider: body.ai_provider,
    job_title: body.job_title,
    extracted_salary_min: body.extracted_salary_min,
    extracted_salary_max: body.extracted_salary_max,
    salary_currency: body.salary_currency,
    reasoning: body.reasoning,
    bullet_count: body.bullet_count ?? body.bulletCount,
    bullets: body.bullets,
    pdf_size: body.pdf_size ?? body.pdfSize,
    filename: body.filename,
    wasm_load_ms: body.wasm_load_ms ?? body.wasmLoadDuration,
    generation_ms: body.generation_ms ?? body.generationDuration,
    total_duration_ms: body.total_duration_ms ?? body.totalDuration,
    wasm_cached: body.wasm_cached ?? body.wasmCached,
    error_code: body.error_code,
    error_category: body.error_category,
    error_stage: body.error_stage ?? body.errorStage,
    error_message: body.error_message ?? body.errorMessage,
    error_detail: body.error_detail,
    error_stack: body.error_stack ?? body.errorStack,
    is_retryable: body.is_retryable,
  };
}
