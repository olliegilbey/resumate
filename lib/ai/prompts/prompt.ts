/**
 * AI Prompt for Resume Bullet Selection
 *
 * This file contains the complete prompt sent to the AI.
 * Edit the templates below to modify AI behavior.
 *
 * STRUCTURE:
 * 1. SYSTEM_PROMPT - Sets AI role, scoring guidelines, output format
 * 2. USER_PROMPT_TEMPLATE - Task instructions with {{placeholders}}
 * 3. Builder functions - Fill placeholders at runtime
 *
 * PLACEHOLDERS (in user prompt):
 * - {{RETRY_CONTEXT}} - Error context from previous failed attempt (optional)
 * - {{MIN_BULLETS}} - Minimum bullets AI must score (maxBullets + buffer)
 * - {{JOB_DESCRIPTION}} - User's pasted job description
 * - {{BULLETS}} - Formatted compendium bullets with [bracket-ids]
 */

import type { ResumeData } from '@/lib/types/generated-resume'
import type { SelectionConfig } from '../output-parser'

// ============================================================================
// SYSTEM PROMPT
// ============================================================================
// Sent as: { role: "system", content: SYSTEM_PROMPT }
// Sets AI role, scoring guidelines, and output format requirements.
// ============================================================================

export const SYSTEM_PROMPT = `# Resume Bullet Scoring Expert

You are an expert resume curator. Your task is to SCORE bullet points from a candidate's experience based on relevance to a job description.

## Your Goal

Analyze the job description and score bullets based on how well they demonstrate relevant experience. Score as many relevant bullets as possible - the server will handle final selection and diversity constraints.

## Analysis Process

1. **Parse the job description** to identify:
   - Required technical skills and technologies
   - Experience level expectations (years, seniority)
   - Industry context and domain knowledge
   - Key responsibilities and deliverables
   - Soft skills and leadership requirements

2. **Score each bullet** against the job requirements:
   - Direct skill matches (technologies, methodologies)
   - Transferable experience (similar problems, scale, complexity)
   - Quantifiable achievements (metrics, impact, scope)
   - Leadership and influence indicators
   - Recent vs older experience (favor recent where relevant)

## Scoring Guidelines

Use the full 0.0-1.0 range to differentiate bullets:

- **0.9-1.0**: Direct skill match + quantifiable impact relevant to role
- **0.7-0.9**: Strong relevance to job requirements
- **0.5-0.7**: Moderate relevance, transferable skills
- **0.3-0.5**: Weak relevance but shows breadth/depth
- **0.0-0.3**: Minimal relevance to this specific role

## Output Format

You MUST respond with a single JSON object. No markdown, no explanation outside the JSON.

\`\`\`json
{
  "bullets": [
    {"id": "bullet-id-1", "score": 0.95},
    {"id": "bullet-id-2", "score": 0.88},
    {"id": "bullet-id-3", "score": 0.72}
  ],
  "reasoning": "Brief explanation of your scoring strategy",
  "job_title": "Extracted Job Title",
  "salary": {
    "min": 120000,
    "max": 150000,
    "currency": "USD",
    "period": "annual"
  }
}
\`\`\`

Note: job_title and salary can be \`null\` if not found in the job description.

### Field Requirements

- **bullets**: Array of objects with id and score
  - **id**: Bullet ID from the compendium (must match exactly)
  - **score**: Relevance score from 0.0 to 1.0
  - Score the minimum bullets specified in the task (more is better - gives server selection options)

- **reasoning**: 1-3 sentences explaining your scoring criteria
  - What skills/experiences you weighted highly
  - Why certain bullets scored high

- **job_title**: Extract the job title from the description if clearly stated
  - Use the exact title if provided (e.g., "Senior Software Engineer")
  - Return \`null\` if title is unclear or not stated

- **salary**: Extract salary information if mentioned anywhere in the description
  - Parse ranges like "$120k - $150k" into min/max numbers
  - Convert "k" notation to full numbers (120k -> 120000)
  - **CRITICAL: Use ISO 4217 currency codes only:**
    - USD (not $, dollars)
    - GBP (not £, pounds, sterling)
    - EUR (not €, euros)
    - JPY, CAD, AUD, CHF, etc.
  - Determine period from context (annual, monthly, hourly, daily, weekly)
  - Return \`null\` if no salary information is found

## Critical Rules

1. **MINIMUM COUNT** - Score at least the minimum bullets specified in the task
2. **VALID IDs ONLY** - Only use bullet IDs from the provided compendium
3. **VALID SCORES** - All scores must be between 0.0 and 1.0
4. **VALID JSON** - Return JSON only, no markdown, no extra text

## Example Response

\`\`\`json
{
  "bullets": [
    {"id": "anthropic-sre-led-migration", "score": 0.98},
    {"id": "anthropic-sre-monitoring", "score": 0.92},
    {"id": "startup-cto-scaling", "score": 0.87},
    {"id": "bigco-senior-api-design", "score": 0.82},
    {"id": "startup-backend-optimization", "score": 0.75},
    {"id": "bigco-senior-performance", "score": 0.68},
    {"id": "startup-devops-ci-cd", "score": 0.62}
  ],
  "reasoning": "Prioritized infrastructure and scaling experience. Weighted leadership bullets highly for senior-level role.",
  "job_title": "Senior Site Reliability Engineer",
  "salary": {
    "min": 180000,
    "max": 220000,
    "currency": "USD",
    "period": "annual"
  }
}
\`\`\`

Note: Continue this pattern for all scored bullets. Include more bullets to give the server selection options.`

// ============================================================================
// USER PROMPT TEMPLATE
// ============================================================================
// Sent as: { role: "user", content: buildUserPrompt(...) }
// Contains the actual task with job description and available bullets.
//
// Placeholders:
//   {{RETRY_CONTEXT}} - Prepended if previous attempt had errors
//   {{MIN_BULLETS}}   - Minimum bullets to score (maxBullets + 10)
//   {{JOB_DESCRIPTION}} - The job posting text from user
//   {{BULLETS}}       - Formatted compendium (see formatBulletsForPrompt)
// ============================================================================

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

NO markdown, NO code blocks, NO extra text.`

// ============================================================================
// RETRY CONTEXT TEMPLATE
// ============================================================================
// Prepended to user prompt when previous attempt failed parsing.
// Helps AI understand and fix the error.
// ============================================================================

const RETRY_CONTEXT_TEMPLATE = `## PREVIOUS RESPONSE HAD ERRORS

{{ERROR_CONTEXT}}

Please fix the issues above. Score more bullets if needed, and ensure all IDs exist.

---

`

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Buffer added to maxBullets for AI scoring.
 * AI scores maxBullets + buffer, server picks top N with diversity constraints.
 */
export const AI_BULLET_BUFFER = 10

/**
 * Generate a short hash of the system prompt for analytics.
 * Uses first 8 chars of SHA-256 to identify prompt version without storing full text.
 */
export async function getSystemPromptHash(): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(SYSTEM_PROMPT)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex.slice(0, 8)
}

/**
 * Format a prompt for analytics storage.
 * Replaces system prompt and job description with placeholders to save storage.
 * Both are available in separate event fields.
 *
 * Output format:
 *   [SYSTEM_PROMPT:abc12345]
 *
 *   ---
 *
 *   ## YOUR TASK
 *   ...
 *   ## Job Description
 *
 *   [JOB_DESCRIPTION]
 *   ...
 */
export async function formatPromptForAnalytics(
  userPrompt: string,
  jobDescription: string
): Promise<string> {
  const hash = await getSystemPromptHash()
  const withSystemPlaceholder = `[SYSTEM_PROMPT:${hash}]\n\n---\n\n${userPrompt}`

  // Replace JD with placeholder (full text in separate job_description field)
  return withSystemPlaceholder.replace(jobDescription, '[JOB_DESCRIPTION]')
}

// ============================================================================
// BUILDER FUNCTIONS
// ============================================================================

export interface PromptConfig extends SelectionConfig {
  retryContext?: string // Error context from previous failed attempt
}

/**
 * Build the complete user prompt by filling placeholders
 */
export function buildUserPrompt(
  jobDescription: string,
  compendium: ResumeData,
  config: PromptConfig
): string {
  const minBullets = getMinBullets(config.maxBullets || 24)
  const bullets = formatBulletsForPrompt(compendium)
  const retryContext = config.retryContext
    ? RETRY_CONTEXT_TEMPLATE.replace('{{ERROR_CONTEXT}}', config.retryContext)
    : ''

  return USER_PROMPT_TEMPLATE.replace('{{RETRY_CONTEXT}}', retryContext)
    .replace(/\{\{MIN_BULLETS\}\}/g, String(minBullets))
    .replace('{{JOB_DESCRIPTION}}', jobDescription)
    .replace('{{BULLETS}}', bullets)
}

/**
 * Load system prompt (for backward compatibility)
 */
export function loadSystemPrompt(): string {
  return SYSTEM_PROMPT
}

/**
 * Calculate minimum bullets AI should score
 */
export function getMinBullets(maxBullets: number): number {
  return maxBullets + AI_BULLET_BUFFER
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format all bullets from compendium with hierarchy context
 *
 * Output format:
 *   ### Company Name (2020–2023)
 *   Location: San Francisco, CA
 *
 *   #### Position Title (2021–2023)
 *
 *   - [bullet-id] Description of achievement
 *     tags: typescript, leadership | priority: 8/10
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
 *
 * Output:
 *   - [bullet-id] Description of the achievement
 *     tags: typescript, api | priority: 8/10
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
 *
 * @param start - "YYYY" or "YYYY-MM"
 * @param end - Optional end date, or null for "Present"
 * @returns "2020–2023" or "2022–Present"
 */
function formatDateRange(start: string, end?: string | null): string {
  const startYear = start.split('-')[0]
  const endYear = end ? end.split('-')[0] : 'Present'
  return `${startYear}–${endYear}`
}

// ============================================================================
// TOKEN ESTIMATION (for context limit checks)
// ============================================================================

/**
 * Rough token estimate (~4 chars per token for English)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Check if compendium fits within context window
 */
export function checkCompendiumSize(
  compendium: ResumeData,
  contextLimit: number = 128000
): { ok: boolean; warning?: string; estimatedTokens: number } {
  const bulletList = formatBulletsForPrompt(compendium)
  const estimatedTokens = estimateTokenCount(bulletList)

  // Use max 60% of context for compendium (leave room for system prompt + response)
  const safeLimit = contextLimit * 0.6

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
