/**
 * Download error types + metadata shape.
 *
 * Extracted from the original `lib/analytics/errors.ts` so the error module is
 * easier to navigate and stays under the `max-lines` guardrail.
 *
 * @module lib/analytics/errors/types
 */

import type { ErrorCategory, ErrorStage } from "../events";

// Re-export for consumers who previously pulled these from `errors.ts`.
export type { ErrorStage, ErrorCategory };

/**
 * Download error codes following format: `{CATEGORY}_{NUMBER}`.
 *
 * Categories:
 * - `TN`: Turnstile (verification)
 * - `WM`: WASM (WebAssembly)
 * - `PDF`: PDF generation
 * - `AI`: AI provider
 * - `NT`: Network
 * - `VL`: Validation
 */
export type DownloadErrorCode =
  // Turnstile errors
  | "TN_001" // Turnstile expired
  | "TN_002" // Turnstile failed
  | "TN_003" // Turnstile timeout
  // WASM errors
  | "WM_001" // WASM load failed
  | "WM_002" // WASM timeout
  | "WM_003" // WASM memory error
  // PDF generation errors
  | "PDF_001" // PDF generation failed
  | "PDF_002" // PDF too large
  | "PDF_003" // Font loading failed
  // AI errors
  | "AI_001" // Provider error
  | "AI_002" // Response parse failed
  | "AI_003" // Invalid response format
  | "AI_004" // Provider timeout
  | "AI_005" // Provider rate limited
  // Network errors
  | "NT_001" // Network timeout
  | "NT_002" // Server unreachable
  | "NT_003" // Response error
  // Validation errors
  | "VL_001" // Invalid input
  | "VL_002" // Missing required field
  | "VL_003"; // Data integrity error
