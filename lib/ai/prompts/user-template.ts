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
  const constraints = formatConstraints(config)
  const retrySection = config.retryContext
    ? formatRetryContext(config.retryContext)
    : ''

  return `## Job Description

${jobDescription}

---

## Available Bullets

Select from the following bullets. Each bullet shows:
- [ID] The unique identifier you must use in your response
- Description text
- Tags and priority for reference

${bulletList}

---

## Selection Requirements

${constraints}

---
${retrySection}
## Your Response

Return a JSON object with:
- "bullet_ids": Array of exactly ${config.maxBullets} bullet IDs
- "reasoning": Brief explanation of selection strategy
- "job_title": Extracted job title or null
- "salary": Extracted salary info or null

Remember: Return ONLY the JSON object, no other text.`
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
 * Format selection constraints
 */
function formatConstraints(config: PromptConfig): string {
  const lines = [`- Select exactly **${config.maxBullets}** bullets`]

  if (config.maxPerCompany) {
    lines.push(`- Maximum **${config.maxPerCompany}** bullets per company`)
  }
  if (config.maxPerPosition) {
    lines.push(`- Maximum **${config.maxPerPosition}** bullets per position`)
  }

  lines.push('- Order bullets by relevance (most relevant first)')
  lines.push('- Only use IDs from the compendium above')

  return lines.join('\n')
}

/**
 * Format retry context from previous failed attempt
 * Uses Rust-style error formatting to help AI correct mistakes
 */
function formatRetryContext(context: string): string {
  return `
## Previous Attempt Failed

${context}

Please correct the issues above and try again.

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
  return `# Resume Bullet Selection Expert

You are an expert resume curator. Your task is to select the most relevant bullet points from a candidate's experience compendium to match a specific job description.

## Your Goal

Analyze the job description and select bullets that will make the strongest resume for this specific role.

## Output Format

You MUST respond with a single JSON object:

{
  "bullet_ids": ["id-1", "id-2", ...],
  "reasoning": "Brief explanation of selection strategy",
  "job_title": "Extracted Job Title" or null,
  "salary": { "min": number, "max": number, "currency": "USD", "period": "annual" } or null
}

## Critical Rules

1. Only use bullet IDs from the provided compendium
2. Select exactly the required number of bullets
3. Respect diversity constraints (max per company/position)
4. Return valid JSON only - no markdown, no extra text
5. Include all required fields`
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
