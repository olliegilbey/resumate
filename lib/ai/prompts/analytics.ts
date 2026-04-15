/**
 * Analytics helpers for AI prompts.
 *
 * Replaces verbatim prompt content with hashes/placeholders before sending to
 * PostHog so event payloads stay small and don't duplicate PII.
 *
 * @module lib/ai/prompts/analytics
 */

import { getSystemPromptHash } from "./system-prompt";

/**
 * Format a prompt for analytics storage.
 *
 * Replaces the system prompt with a hashed tag and redacts the job description
 * (full text lives in the separate `job_description` event field).
 *
 * Output format:
 * ```
 * [SYSTEM_PROMPT:abc12345]
 *
 * ---
 *
 * ## YOUR TASK
 * ...
 * ## Job Description
 *
 * [JOB_DESCRIPTION]
 * ...
 * ```
 *
 * @param userPrompt - The rendered user prompt to redact.
 * @param jobDescription - Exact JD string to replace (case-sensitive match).
 * @returns Redacted prompt ready for event capture.
 */
export async function formatPromptForAnalytics(
  userPrompt: string,
  jobDescription: string,
): Promise<string> {
  const hash = await getSystemPromptHash();
  const withSystemPlaceholder = `[SYSTEM_PROMPT:${hash}]\n\n---\n\n${userPrompt}`;

  // Replace JD with placeholder (full text in separate job_description field)
  return withSystemPlaceholder.replace(jobDescription, "[JOB_DESCRIPTION]");
}
