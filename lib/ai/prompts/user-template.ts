/**
 * User Prompt Template Builder
 *
 * Formats the job description and compendium into a structured prompt.
 */

import type { ResumeData } from '@/lib/types/generated-resume'
import type { SelectionConfig } from '../output-parser'

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
    {"id": "another-id", "score": 0.82},
    ... at least ${minBullets} scored bullets
  ],
  "reasoning": "Brief explanation of scoring criteria",
  "job_title": "Title from JD" or null,
  "salary": {"min": N, "max": N, "currency": "USD", "period": "annual"} or null
}

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
 * Calculate minimum bullets to request from AI
 */
export function getMinBullets(targetBullets: number): number {
  return Math.max(30, targetBullets + 10)
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
 * Load system prompt from markdown file
 */
export async function loadSystemPrompt(): Promise<string> {
  // In Node.js environment, read from file
  // In edge/browser, use embedded string
  if (typeof window === 'undefined') {
    const fs = await import('fs/promises')
    const path = await import('path')
    const promptPath = path.join(process.cwd(), 'lib/ai/prompts/system.md')
    return fs.readFile(promptPath, 'utf-8')
  }

  // Fallback: return embedded version for edge runtime
  return getEmbeddedSystemPrompt()
}

/**
 * Embedded system prompt for edge runtime where file access isn't available
 */
function getEmbeddedSystemPrompt(): string {
  return `# Resume Bullet Scoring Expert

You are an expert resume curator. Your task is to SCORE bullet points from a candidate's experience based on relevance to a job description.

## Your Goal

Analyze the job description and score bullets based on how well they demonstrate relevant experience. The server will handle final selection and diversity constraints.

## Output Format

You MUST respond with a single JSON object:

{
  "bullets": [
    {"id": "bullet-id", "score": 0.95},
    {"id": "another-id", "score": 0.82},
    ...
  ],
  "reasoning": "Brief explanation of scoring criteria",
  "job_title": "Extracted Job Title" or null,
  "salary": { "min": number, "max": number, "currency": "USD", "period": "annual" } or null
}

## Scoring Guidelines

- 0.9-1.0: Direct skill match + quantifiable impact
- 0.7-0.9: Strong relevance to job requirements
- 0.5-0.7: Moderate relevance, transferable skills
- 0.3-0.5: Weak relevance but shows breadth
- 0.0-0.3: Minimal relevance

## Critical Rules

1. Only use bullet IDs from the provided compendium
2. Score at least 30 bullets (more is better)
3. Return valid JSON only - no markdown, no extra text`
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
