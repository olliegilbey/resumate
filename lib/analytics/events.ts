/**
 * PostHog Analytics Event Registry
 *
 * Single source of truth for all event names and core types.
 * Import from here instead of hardcoding event strings.
 */

// ============================================================================
// EVENT NAME CONSTANTS
// ============================================================================

/**
 * Canonical PostHog event names. Import and reference via
 * `ANALYTICS_EVENTS.RESUME_PREPARED` — never hardcode event strings.
 */
export const ANALYTICS_EVENTS = {
  // Explorer (behavioral, not download)
  TAG_FILTER_CHANGED: "tag_filter_changed",
  SEARCH_PERFORMED: "search_performed",

  // Contact Card (vCard)
  CONTACT_CARD_INITIATED: "contact_card_initiated",
  CONTACT_CARD_VERIFIED: "contact_card_verified",
  CONTACT_CARD_DOWNLOADED: "contact_card_downloaded",
  CONTACT_CARD_ERROR: "contact_card_error",
  CONTACT_CARD_CANCELLED: "contact_card_cancelled",
  CONTACT_CARD_SERVED: "contact_card_served",

  // Resume - Client
  RESUME_INITIATED: "resume_initiated",
  RESUME_VERIFIED: "resume_verified",
  RESUME_COMPILED: "resume_compiled",
  RESUME_DOWNLOADED: "resume_downloaded",
  RESUME_ERROR: "resume_error",
  RESUME_CANCELLED: "resume_cancelled",

  // Resume - Server
  RESUME_PREPARED: "resume_prepared",
  RESUME_GENERATED: "resume_generated",
  RESUME_DOWNLOAD_NOTIFIED: "resume_download_notified",
  RESUME_FAILED: "resume_failed",
} as const;

/** Union of every value in `ANALYTICS_EVENTS` — used for type-safe event names. */
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// ============================================================================
// CORE TYPES
// ============================================================================

/** Artefact being downloaded — distinguishes PDF generation paths from vCard. */
export type DownloadType = "resume_ai" | "resume_heuristic" | "vcard";

/** Which bullet-selection pipeline produced the resume. */
export type GenerationMethod = "ai" | "heuristic";

/** Model identifier for AI-generated resumes (mirrors `lib/ai/providers/types.ts`). */
export type AIProvider = "cerebras-gpt" | "cerebras-llama" | "claude-sonnet" | "claude-haiku";

/** Pipeline stage at which an error was raised — unified across client and server. */
export type ErrorStage =
  | "turnstile"
  | "bullet_selection"
  | "ai_selection"
  | "wasm_load"
  | "pdf_generation"
  | "network";

/** Coarse classification bucket used to group errors in dashboards. */
export type ErrorCategory = "turnstile" | "wasm" | "pdf" | "ai" | "network" | "validation";

/** Stage where a user can abort the download flow. */
export type CancelStage = "turnstile" | "verified" | "compiling" | "ai_analyzing";

/** Salary cadence extracted by the AI from job descriptions. */
export type SalaryPeriod = "annual" | "monthly" | "hourly" | "daily" | "weekly";

// ============================================================================
// ENVIRONMENT CONTEXT
// ============================================================================

/** Build environment for the running process (`NODE_ENV`). */
export type EnvType = "development" | "production" | "test";

/** Deployment surface (`VERCEL_ENV` normalized; `local` when unset). */
export type SourceType = "local" | "preview" | "production";

/** Shared env/source/is_server context attached to every analytics event. */
export interface EnvironmentContext {
  env: EnvType;
  source: SourceType;
  is_server: boolean;
}

/**
 * Get environment context for analytics events.
 * Call from client or server - auto-detects is_server.
 */
export function getEnvironmentContext(isServer: boolean): EnvironmentContext {
  const env = (process.env.NODE_ENV || "development") as EnvType;

  // Server uses VERCEL_ENV, client uses NEXT_PUBLIC_VERCEL_ENV
  const vercelEnv = isServer ? process.env.VERCEL_ENV : process.env.NEXT_PUBLIC_VERCEL_ENV;

  const source: SourceType =
    vercelEnv === "production" ? "production" : vercelEnv === "preview" ? "preview" : "local";

  return { env, source, is_server: isServer };
}

/**
 * Server-side environment context helper
 */
export function getServerEnvironmentContext(): EnvironmentContext {
  return getEnvironmentContext(true);
}

/**
 * Client-side environment context helper
 */
export function getClientEnvironmentContext(): EnvironmentContext {
  return getEnvironmentContext(false);
}
