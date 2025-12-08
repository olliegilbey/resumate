/**
 * User Prompt Template Builder
 *
 * Formats the job description and compendium into a structured prompt.
 */

import type { ResumeData } from '@/lib/types/generated-resume'
import type { SelectionConfig } from '../output-parser'
import { SYSTEM_PROMPT } from './system-prompt'

export interface PromptConfig extends SelectionConfig {
  retryContext?: string // Error context from previous failed attempt
}

/**
 * Build the user prompt for AI bullet selection
 */
export function buildUserPrompt(
  jobDescription: string,
  compendium: ResumeData,
  config: PromptConfig
): string {
  const bulletList = formatBulletsForPrompt(compendium)

  // Put retry context FIRST if present (most important)
  const retrySection = config.retryContext
    ? formatRetryContext(config.retryContext)
    : ''

  // Minimum bullets to score - give buffer for server-side filtering
  const minBullets = getMinBullets(config.maxBullets || 24)

  return `${retrySection}## YOUR TASK

Score the most relevant bullets from the candidate's experience for this job.

**Requirements:**
- Score AT LEAST ${minBullets} bullets (more is better)
- Use scores 0.0-1.0 (1.0 = perfect match, 0.0 = irrelevant)
- Only use IDs exactly as shown in brackets [like-this]

The server will apply diversity constraints and select the final set. Your job is to score relevance accurately.

---

## Job Description

${jobDescription}

---

## Available Bullets

Each bullet shows: [ID] Description (tags | priority)

${bulletList}

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
- Include at least ${minBullets} scored bullets
- job_title: extract from JD, or null if not found
- salary: extract from JD, or null if not mentioned

NO markdown, NO code blocks, NO extra text.`
}

/**
 * Format all bullets from compendium with hierarchy context
 */
function formatBulletsForPrompt(compendium: ResumeData): string {
  const lines: string[] = []

  for (const company of compendium.experience) {
    const companyName = company.name || company.id
    const dateRange = formatDateRange(company.dateStart, company.dateEnd)
    lines.push(`### ${companyName} (${dateRange})`)
    if (company.location) {
      lines.push(`Location: ${company.location}`)
    }
    lines.push('')

    for (const position of company.children) {
      const posDateRange = formatDateRange(position.dateStart, position.dateEnd)
      lines.push(`#### ${position.name} (${posDateRange})`)
      lines.push('')

      for (const bullet of position.children) {
        lines.push(formatBullet(bullet))
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Format a single bullet with ID, description, tags, and priority
 */
function formatBullet(bullet: {
  id: string
  description: string
  tags: string[]
  priority: number
  name?: string | null
}): string {
  const idLine = `- [${bullet.id}]`
  const desc = bullet.description
  const meta = `  tags: ${bullet.tags.join(', ')} | priority: ${bullet.priority}/10`

  return `${idLine} ${desc}\n${meta}`
}

/**
 * Format date range for display
 */
function formatDateRange(start: string, end?: string | null): string {
  const startYear = start.split('-')[0]
  const endYear = end ? end.split('-')[0] : 'Present'
  return `${startYear}–${endYear}`
}

/**
 * Buffer for AI to score extra bullets (server picks top N with diversity)
 */
export const AI_BULLET_BUFFER = 10

/**
 * Calculate minimum bullets to request from AI
 * Returns maxBullets + buffer to give server diversity options
 */
export function getMinBullets(maxBullets: number): number {
  return maxBullets + AI_BULLET_BUFFER
}

/**
 * Format retry context from previous failed attempt
 */
function formatRetryContext(context: string): string {
  return `## 🛑 PREVIOUS RESPONSE HAD ERRORS

${context}

Please fix the issues above. Score more bullets if needed, and ensure all IDs exist.

---

`
}

/**
 * Load system prompt - now returns TypeScript constant (no file I/O)
 *
 * Previously read from system.md but Vercel serverless couldn't bundle it.
 * Converted to system-prompt.ts for reliable bundling.
 */
export function loadSystemPrompt(): string {
  return SYSTEM_PROMPT
}

/**
 * Estimate token count for prompt (rough approximation)
 * Used to check if compendium fits within context limits
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4)
}

/**
 * Check if compendium is too large for context window
 * Returns warning message if approaching limits
 */
export function checkCompendiumSize(
  compendium: ResumeData,
  contextLimit: number = 128000
): { ok: boolean; warning?: string; estimatedTokens: number } {
  const bulletList = formatBulletsForPrompt(compendium)
  const estimatedTokens = estimateTokenCount(bulletList)

  // Leave room for system prompt, job description, and response
  const safeLimit = contextLimit * 0.6 // Use max 60% for compendium

  if (estimatedTokens > safeLimit) {
    return {
      ok: false,
      warning: `Compendium too large: ~${estimatedTokens} tokens (limit: ${Math.floor(safeLimit)})`,
      estimatedTokens,
    }
  }

  if (estimatedTokens > safeLimit * 0.8) {
    return {
      ok: true,
      warning: `Compendium approaching limit: ~${estimatedTokens} tokens`,
      estimatedTokens,
    }
  }

  return { ok: true, estimatedTokens }
}
