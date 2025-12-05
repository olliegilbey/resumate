/**
 * AI Selection Error Types
 *
 * Two error formats:
 * 1. Rust-style verbose errors - for AI retry prompts (helps AI correct mistakes)
 * 2. Simplified errors - for user UI (friendly, actionable messages)
 */

export type ParseErrorCode =
  | 'E000_PROVIDER_ERROR'
  | 'E001_NO_JSON_FOUND'
  | 'E002_INVALID_JSON'
  | 'E003_MISSING_BULLET_IDS'
  | 'E004_WRONG_BULLET_COUNT'
  | 'E005_INVALID_BULLET_ID'
  | 'E006_DUPLICATE_BULLET_ID'
  | 'E007_DIVERSITY_VIOLATION'
  | 'E008_MISSING_REASONING'
  | 'E009_INVALID_SCORE'
  | 'E010_INVALID_SALARY'
  | 'E011_PROVIDER_DOWN'

export interface ParseError {
  code: ParseErrorCode
  message: string
  help: string
  span?: {
    start: number
    end: number
    content: string
  }
}

/**
 * Format error in Rust compiler style - verbose, helpful for AI retries
 *
 * Example output:
 * ```
 * error[E004_WRONG_BULLET_COUNT]: Expected 28 bullets, got 25
 *
 *   The AI must select exactly 28 bullets.
 *
 *   Received 25 bullet IDs:
 *   company-a-pos-1-bullet-1, company-a-pos-1-bullet-2, ...
 *
 *   --> AI response:42
 *    |
 *    | "bullet_ids": ["company-a-pos-1-bullet-1", ...]
 *    | ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * ```
 */
export function formatRustStyleError(error: ParseError): string {
  const lines = [`error[${error.code}]: ${error.message}`, '']

  // Add help text with indentation
  const helpLines = error.help.split('\n')
  for (const line of helpLines) {
    lines.push(`  ${line}`)
  }

  // Add span indicator if present
  if (error.span) {
    lines.push('')
    lines.push(`  --> AI response:${error.span.start}`)
    lines.push('   |')
    lines.push(`   | ${error.span.content}`)
    lines.push(`   | ${'~'.repeat(Math.min(error.span.content.length, 60))}`)
  }

  return lines.join('\n')
}

/**
 * Format error for user UI - simplified, actionable
 */
export function formatSimplifiedError(error: ParseError): string {
  const simplified: Record<ParseErrorCode, string> = {
    E000_PROVIDER_ERROR:
      'The AI service encountered an issue. Please try again.',
    E001_NO_JSON_FOUND:
      'The AI response was unclear. Retrying with a different approach...',
    E002_INVALID_JSON:
      'The AI response was malformed. Retrying with a different approach...',
    E003_MISSING_BULLET_IDS: 'The AI did not select any experience. Retrying...',
    E004_WRONG_BULLET_COUNT:
      'The AI selected the wrong number of experiences. Retrying...',
    E005_INVALID_BULLET_ID:
      'The AI referenced unknown experiences. Retrying with corrections...',
    E006_DUPLICATE_BULLET_ID:
      'The AI selected duplicate experiences. Retrying...',
    E007_DIVERSITY_VIOLATION:
      'The AI selection needs more variety. Retrying with constraints...',
    E008_MISSING_REASONING:
      'The AI did not explain its selection. Retrying...',
    E009_INVALID_SCORE:
      'The AI provided invalid relevance scores. Retrying...',
    E010_INVALID_SALARY:
      'The AI salary extraction was malformed. Continuing without salary...',
    E011_PROVIDER_DOWN:
      'The AI service is temporarily unavailable. Trying alternative...',
  }

  return simplified[error.code] || 'An unexpected error occurred. Please try again.'
}

/**
 * Aggregated error from multiple retry attempts
 */
export class AISelectionError extends Error {
  constructor(
    message: string,
    public readonly errors: ParseError[],
    public readonly provider: string,
    public readonly retriesAttempted: number = 0
  ) {
    super(message)
    this.name = 'AISelectionError'
  }

  /**
   * Get full Rust-style error log for debugging/AI retry
   */
  getVerboseLog(): string {
    return this.errors.map(formatRustStyleError).join('\n\n---\n\n')
  }

  /**
   * Get simplified message for user UI
   */
  getSimplifiedMessage(): string {
    // Use the last error's simplified message, or a generic one
    const lastError = this.errors[this.errors.length - 1]
    if (lastError) {
      return formatSimplifiedError(lastError)
    }
    return `AI selection failed after ${this.retriesAttempted} attempts. Please try again or use a different AI model.`
  }

  /**
   * Check if this is a provider-down error (should trigger fallback)
   */
  isProviderDown(): boolean {
    return this.errors.some((e) => e.code === 'E011_PROVIDER_DOWN')
  }

  /**
   * Check if this is an output format error (should retry same provider)
   */
  isOutputFormatError(): boolean {
    const formatErrors: ParseErrorCode[] = [
      'E001_NO_JSON_FOUND',
      'E002_INVALID_JSON',
      'E003_MISSING_BULLET_IDS',
      'E004_WRONG_BULLET_COUNT', // Now: insufficient bullets
      'E005_INVALID_BULLET_ID',
      'E006_DUPLICATE_BULLET_ID',
      // E007_DIVERSITY_VIOLATION removed - server handles diversity
      'E008_MISSING_REASONING',
    ]
    return this.errors.some((e) => formatErrors.includes(e.code))
  }
}

/**
 * Create a parse error with consistent structure
 */
export function createParseError(
  code: ParseErrorCode,
  message: string,
  help: string,
  span?: { start: number; end: number; content: string }
): ParseError {
  return { code, message, help, span }
}
