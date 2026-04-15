/**
 * User-message prompt builder for AI bullet scoring.
 *
 * Fills template placeholders with the job description, compendium bullets,
 * and (optionally) retry-error context. Extracted from `prompts/prompt.ts` to
 * keep each module under the `max-lines` guardrail.
 *
 * @module lib/ai/prompts/user-prompt
 */

import type { ResumeData } from "@/lib/types/generated-resume";
import type { SelectionConfig } from "../output-parser";
import { formatBulletsForPrompt } from "./formatting";

/**
 * Buffer added to maxBullets for AI scoring.
 * AI scores maxBullets + buffer; server picks top N with diversity constraints.
 */
export const AI_BULLET_BUFFER = 10;

/**
 * Configuration for {@link buildUserPrompt}.
 */
export interface PromptConfig extends SelectionConfig {
  /** Error context from a previous failed attempt; prepended to the user prompt. */
  retryContext?: string;
}

const USER_PROMPT_TEMPLATE = `{{RETRY_CONTEXT}}## YOUR TASK

Score the most relevant bullets from the candidate's experience for this job.

**Requirements:**
- Score AT LEAST {{MIN_BULLETS}} bullets (more is better)
- Use scores 0.0-1.0 (1.0 = perfect match, 0.0 = irrelevant)
- Only use IDs exactly as shown in brackets [like-this]

The server will apply diversity constraints and select the final set. Your job is to score relevance accurately.

---

## Job Description

{{JOB_DESCRIPTION}}

---

## Available Bullets

Each bullet shows: [ID] Description (tags | priority)

{{BULLETS}}

---

## Response Format

Return ONLY a JSON object:
{
  "bullets": [
    {"id": "bullet-id", "score": 0.95},
    {"id": "another-id", "score": 0.82}
  ],
  "reasoning": "Brief explanation of scoring criteria",
  "job_title": "Senior Software Engineer",
  "salary": {"min": 120000, "max": 150000, "currency": "USD", "period": "annual"}
}

Notes:
- Include at least {{MIN_BULLETS}} scored bullets
- job_title: extract from JD, or null if not found
- salary: extract from JD, or null if not mentioned

NO markdown, NO code blocks, NO extra text.`;

const RETRY_CONTEXT_TEMPLATE = `## PREVIOUS RESPONSE HAD ERRORS

{{ERROR_CONTEXT}}

Please fix the issues above. Score more bullets if needed, and ensure all IDs exist.

---

`;

/**
 * Build the complete user prompt by filling placeholders.
 *
 * @param jobDescription - Raw JD text from the user.
 * @param compendium - Full resume data, formatted into bullet list.
 * @param config - Prompt configuration (maxBullets, optional retryContext).
 * @returns Ready-to-send user message content.
 */
export function buildUserPrompt(
  jobDescription: string,
  compendium: ResumeData,
  config: PromptConfig,
): string {
  const minBullets = getMinBullets(config.maxBullets || 24);
  const bullets = formatBulletsForPrompt(compendium);
  const retryContext = config.retryContext
    ? RETRY_CONTEXT_TEMPLATE.replace("{{ERROR_CONTEXT}}", config.retryContext)
    : "";

  return USER_PROMPT_TEMPLATE.replace("{{RETRY_CONTEXT}}", retryContext)
    .replace(/\{\{MIN_BULLETS\}\}/g, String(minBullets))
    .replace("{{JOB_DESCRIPTION}}", jobDescription)
    .replace("{{BULLETS}}", bullets);
}

/**
 * Calculate the minimum number of bullets the AI should score.
 *
 * @param maxBullets - Target number of bullets for the final resume.
 * @returns `maxBullets + AI_BULLET_BUFFER` so the server has selection headroom.
 */
export function getMinBullets(maxBullets: number): number {
  return maxBullets + AI_BULLET_BUFFER;
}
