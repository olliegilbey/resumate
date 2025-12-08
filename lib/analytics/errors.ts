/**
 * Unified Download Error System
 *
 * Error codes and formatting for all download types (resume + vCard).
 * Extends Rust-style error format from lib/ai/errors.ts.
 */

import type { ErrorStage, ErrorCategory } from './events'

// Re-export for consumers
export type { ErrorStage, ErrorCategory }

// ============================================================================
// ERROR CODE TYPES
// ============================================================================

/**
 * Download error codes following format: {CATEGORY}_{NUMBER}
 *
 * Categories:
 * - TN: Turnstile (verification)
 * - WM: WASM (WebAssembly)
 * - PDF: PDF generation
 * - AI: AI provider
 * - NT: Network
 * - VL: Validation
 */
export type DownloadErrorCode =
  // Turnstile errors
  | 'TN_001' // Turnstile expired
  | 'TN_002' // Turnstile failed
  | 'TN_003' // Turnstile timeout
  // WASM errors
  | 'WM_001' // WASM load failed
  | 'WM_002' // WASM timeout
  | 'WM_003' // WASM memory error
  // PDF generation errors
  | 'PDF_001' // PDF generation failed
  | 'PDF_002' // PDF too large
  | 'PDF_003' // Font loading failed
  // AI errors
  | 'AI_001' // Provider error
  | 'AI_002' // Response parse failed
  | 'AI_003' // Invalid response format
  | 'AI_004' // Provider timeout
  | 'AI_005' // Provider rate limited
  // Network errors
  | 'NT_001' // Network timeout
  | 'NT_002' // Server unreachable
  | 'NT_003' // Response error
  // Validation errors
  | 'VL_001' // Invalid input
  | 'VL_002' // Missing required field
  | 'VL_003' // Data integrity error

// ============================================================================
// ERROR METADATA
// ============================================================================

interface ErrorMetadata {
  category: ErrorCategory
  stage: ErrorStage
  message: string
  suggestion: string
  retryable: boolean
}

/**
 * Error code metadata mapping
 */
const ERROR_METADATA: Record<DownloadErrorCode, ErrorMetadata> = {
  // Turnstile
  TN_001: {
    category: 'turnstile',
    stage: 'turnstile',
    message: 'Verification challenge expired',
    suggestion: 'Please refresh the page and try again.',
    retryable: true,
  },
  TN_002: {
    category: 'turnstile',
    stage: 'turnstile',
    message: 'Verification challenge failed',
    suggestion: 'Please try again or use a different browser.',
    retryable: true,
  },
  TN_003: {
    category: 'turnstile',
    stage: 'turnstile',
    message: 'Verification challenge timed out',
    suggestion: 'Please check your connection and try again.',
    retryable: true,
  },
  // WASM
  WM_001: {
    category: 'wasm',
    stage: 'wasm_load',
    message: 'WASM module failed to load',
    suggestion: 'Try refreshing the page or using a different browser.',
    retryable: true,
  },
  WM_002: {
    category: 'wasm',
    stage: 'wasm_load',
    message: 'WASM module load timed out',
    suggestion: 'Check your connection speed and try again.',
    retryable: true,
  },
  WM_003: {
    category: 'wasm',
    stage: 'wasm_load',
    message: 'WASM memory allocation failed',
    suggestion: 'Close other tabs and try again.',
    retryable: true,
  },
  // PDF
  PDF_001: {
    category: 'pdf',
    stage: 'pdf_generation',
    message: 'PDF generation failed',
    suggestion: 'Please try again. If the issue persists, contact support.',
    retryable: true,
  },
  PDF_002: {
    category: 'pdf',
    stage: 'pdf_generation',
    message: 'PDF file size exceeded limit',
    suggestion: 'Try selecting fewer bullet points.',
    retryable: false,
  },
  PDF_003: {
    category: 'pdf',
    stage: 'pdf_generation',
    message: 'Font loading failed',
    suggestion: 'Try refreshing the page.',
    retryable: true,
  },
  // AI
  AI_001: {
    category: 'ai',
    stage: 'ai_selection',
    message: 'AI provider error',
    suggestion: 'Please try again or use a different AI model.',
    retryable: true,
  },
  AI_002: {
    category: 'ai',
    stage: 'ai_selection',
    message: 'AI response could not be parsed',
    suggestion: 'Retrying with a different approach...',
    retryable: true,
  },
  AI_003: {
    category: 'ai',
    stage: 'ai_selection',
    message: 'AI returned invalid response format',
    suggestion: 'Retrying with corrections...',
    retryable: true,
  },
  AI_004: {
    category: 'ai',
    stage: 'ai_selection',
    message: 'AI provider timed out',
    suggestion: 'Please try again.',
    retryable: true,
  },
  AI_005: {
    category: 'ai',
    stage: 'ai_selection',
    message: 'AI provider rate limit exceeded',
    suggestion: 'Please wait a few minutes and try again.',
    retryable: false,
  },
  // Network
  NT_001: {
    category: 'network',
    stage: 'network',
    message: 'Request timed out',
    suggestion: 'Check your connection and try again.',
    retryable: true,
  },
  NT_002: {
    category: 'network',
    stage: 'network',
    message: 'Server unreachable',
    suggestion: 'Please try again later.',
    retryable: true,
  },
  NT_003: {
    category: 'network',
    stage: 'network',
    message: 'Server returned an error',
    suggestion: 'Please try again.',
    retryable: true,
  },
  // Validation
  VL_001: {
    category: 'validation',
    stage: 'bullet_selection',
    message: 'Invalid input provided',
    suggestion: 'Please check your input and try again.',
    retryable: false,
  },
  VL_002: {
    category: 'validation',
    stage: 'bullet_selection',
    message: 'Missing required field',
    suggestion: 'Please fill in all required fields.',
    retryable: false,
  },
  VL_003: {
    category: 'validation',
    stage: 'bullet_selection',
    message: 'Data integrity error',
    suggestion: 'Please refresh the page and try again.',
    retryable: true,
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get error category from code
 */
export function getErrorCategory(code: DownloadErrorCode): ErrorCategory {
  return ERROR_METADATA[code].category
}

/**
 * Get error stage from code
 */
export function getErrorStage(code: DownloadErrorCode): ErrorStage {
  return ERROR_METADATA[code].stage
}

/**
 * Check if error is retryable
 */
export function isRetryable(code: DownloadErrorCode): boolean {
  return ERROR_METADATA[code].retryable
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(code: DownloadErrorCode): string {
  return ERROR_METADATA[code].message
}

/**
 * Get error suggestion
 */
export function getErrorSuggestion(code: DownloadErrorCode): string {
  return ERROR_METADATA[code].suggestion
}

// ============================================================================
// ERROR CREATION
// ============================================================================

export interface DownloadError {
  code: DownloadErrorCode
  category: ErrorCategory
  stage: ErrorStage
  message: string
  detail?: string
  suggestion: string
  retryable: boolean
  duration_ms?: number
  stack?: string
}

/**
 * Create a download error with all metadata populated from code
 */
export function createDownloadError(
  code: DownloadErrorCode,
  detail?: string,
  duration_ms?: number,
  stack?: string
): DownloadError {
  const meta = ERROR_METADATA[code]
  return {
    code,
    category: meta.category,
    stage: meta.stage,
    message: meta.message,
    detail,
    suggestion: meta.suggestion,
    retryable: meta.retryable,
    duration_ms,
    stack: process.env.NODE_ENV === 'development' ? stack : undefined,
  }
}

// ============================================================================
// RUST-STYLE ERROR FORMATTING
// ============================================================================

/**
 * Format download error in Rust compiler style.
 * Clear, debuggable, unified across all download types.
 *
 * Example output:
 * ```
 * error[WM_001]: WASM module failed to load
 *
 *   The WebAssembly module for PDF generation could not be initialized.
 *
 *   This may be caused by:
 *   - Browser blocking WASM execution
 *   - Insufficient memory
 *   - Network interruption during load
 *
 *   --> stage: wasm_load
 *    |
 *    | duration: 5234ms
 *    | cached: false
 *    | ~~~~~~~~~~~~
 *
 *   suggestion: Try refreshing the page or using a different browser.
 * ```
 */
export function formatRustStyleDownloadError(
  error: DownloadError,
  context?: Record<string, unknown>
): string {
  const lines = [`error[${error.code}]: ${error.message}`, '']

  // Add detail if present
  if (error.detail) {
    const detailLines = error.detail.split('\n')
    for (const line of detailLines) {
      lines.push(`  ${line}`)
    }
    lines.push('')
  }

  // Add stage and context
  lines.push(`  --> stage: ${error.stage}`)
  lines.push('   |')

  // Add duration if present
  if (error.duration_ms !== undefined) {
    lines.push(`   | duration: ${error.duration_ms}ms`)
  }

  // Add any additional context
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      lines.push(`   | ${key}: ${JSON.stringify(value)}`)
    }
  }

  lines.push(`   | ${'~'.repeat(40)}`)

  // Add suggestion
  lines.push('')
  lines.push(`  suggestion: ${error.suggestion}`)

  return lines.join('\n')
}

// ============================================================================
// ERROR CODE INFERENCE
// ============================================================================

/**
 * Infer error code from error message/type (for legacy error migration)
 */
export function inferErrorCode(
  errorType: string,
  stage?: string,
  message?: string
): DownloadErrorCode {
  // Turnstile errors
  if (stage === 'turnstile' || errorType.includes('turnstile')) {
    if (message?.includes('expired')) return 'TN_001'
    if (message?.includes('timeout')) return 'TN_003'
    return 'TN_002'
  }

  // WASM errors
  if (stage === 'wasm_load' || errorType.includes('wasm')) {
    if (message?.includes('timeout')) return 'WM_002'
    if (message?.includes('memory')) return 'WM_003'
    return 'WM_001'
  }

  // PDF/compilation errors
  if (stage === 'pdf_generation' || stage === 'compilation' || errorType.includes('pdf')) {
    if (message?.includes('size') || message?.includes('large')) return 'PDF_002'
    if (message?.includes('font')) return 'PDF_003'
    return 'PDF_001'
  }

  // AI errors
  if (stage === 'ai_selection' || errorType.includes('ai')) {
    if (message?.includes('timeout')) return 'AI_004'
    if (message?.includes('rate')) return 'AI_005'
    if (message?.includes('parse')) return 'AI_002'
    if (message?.includes('format') || message?.includes('invalid')) return 'AI_003'
    return 'AI_001'
  }

  // Network errors
  if (stage === 'network' || errorType.includes('network') || errorType.includes('fetch')) {
    if (message?.includes('timeout')) return 'NT_001'
    if (message?.includes('unreachable') || message?.includes('failed to fetch')) return 'NT_002'
    return 'NT_003'
  }

  // Selection/validation errors
  if (stage === 'bullet_selection' || stage === 'selection') {
    if (message?.includes('missing')) return 'VL_002'
    if (message?.includes('integrity')) return 'VL_003'
    return 'VL_001'
  }

  // Default to network error for unknown
  return 'NT_003'
}
