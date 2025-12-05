/**
 * AI Output Parser
 *
 * Extracts and validates JSON from AI responses.
 * Validates bullet_ids, job_title, salary, and reasoning.
 */

import { createParseError, type ParseError } from './errors'

export interface SalaryInfo {
  min?: number
  max?: number
  currency: string
  period: 'annual' | 'monthly' | 'hourly' | 'daily' | 'weekly'
}

export interface SelectionConfig {
  maxBullets: number // Target bullets for final selection (used by route)
  minBullets?: number // Minimum bullets AI must return (default: 30)
  maxPerCompany?: number // For server-side diversity (not validated in parser)
  maxPerPosition?: number // For server-side diversity (not validated in parser)
}

export interface ScoredBulletId {
  id: string
  score: number
}

export interface ParsedAIResponse {
  bullets: ScoredBulletId[]
  reasoning: string
  jobTitle: string | null
  salary: SalaryInfo | null
}

export interface ParseResult {
  success: boolean
  data?: ParsedAIResponse
  error?: ParseError
}

// Map bullet IDs to their company/position for diversity validation
export interface BulletHierarchy {
  [bulletId: string]: {
    companyId: string
    positionId: string
  }
}

/**
 * Extract JSON object from AI response text
 * Handles markdown code blocks and raw JSON
 */
export function extractJSON(raw: string): string | null {
  // Try to find JSON in markdown code block first
  const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1]
  }

  // Try to find raw JSON object with bullets array (new format)
  const bulletsMatch = raw.match(/\{[\s\S]*"bullets"[\s\S]*\}/)
  if (bulletsMatch) {
    return bulletsMatch[0]
  }

  // Try to find raw JSON object with bullet_ids (legacy format)
  const jsonMatch = raw.match(/\{[\s\S]*"bullet_ids"[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0]
  }

  // Try any JSON object
  const anyJsonMatch = raw.match(/\{[\s\S]*\}/)
  if (anyJsonMatch) {
    return anyJsonMatch[0]
  }

  return null
}

/**
 * Validate salary structure
 */
function validateSalary(
  salary: unknown
): { valid: true; data: SalaryInfo } | { valid: false; error: string } {
  if (salary === null || salary === undefined) {
    return { valid: true, data: null as unknown as SalaryInfo }
  }

  if (typeof salary !== 'object') {
    return { valid: false, error: 'salary must be an object or null' }
  }

  const s = salary as Record<string, unknown>

  // Validate currency
  if (typeof s.currency !== 'string' || s.currency.length === 0) {
    return { valid: false, error: 'salary.currency must be a non-empty string' }
  }

  // Validate period
  const validPeriods = ['annual', 'monthly', 'hourly', 'daily', 'weekly']
  if (!validPeriods.includes(s.period as string)) {
    return {
      valid: false,
      error: `salary.period must be one of: ${validPeriods.join(', ')}`,
    }
  }

  // Validate min/max (optional but must be numbers if present)
  if (s.min !== undefined && typeof s.min !== 'number') {
    return { valid: false, error: 'salary.min must be a number' }
  }
  if (s.max !== undefined && typeof s.max !== 'number') {
    return { valid: false, error: 'salary.max must be a number' }
  }

  return {
    valid: true,
    data: {
      min: s.min as number | undefined,
      max: s.max as number | undefined,
      currency: s.currency as string,
      period: s.period as SalaryInfo['period'],
    },
  }
}

// Note: Diversity validation removed - now handled server-side in route.ts
// This allows AI to score freely, with server applying final constraints

/**
 * Parse and validate AI output
 *
 * @param raw - Raw AI response text
 * @param validBulletIds - Set of valid bullet IDs from compendium
 * @param hierarchy - Mapping of bullet IDs to company/position (for route, not used here)
 * @param config - Selection configuration (minBullets for validation)
 */
export function parseAIOutput(
  raw: string,
  validBulletIds: Set<string>,
  hierarchy: BulletHierarchy,
  config: SelectionConfig
): ParseResult {
  // Step 1: Extract JSON from response
  const jsonStr = extractJSON(raw)
  if (!jsonStr) {
    return {
      success: false,
      error: createParseError(
        'E001_NO_JSON_FOUND',
        'No JSON object found in AI response',
        `Expected format: {"bullet_ids": [...], "reasoning": "...", "job_title": "...", "salary": {...}}

Got: ${raw.slice(0, 200)}${raw.length > 200 ? '...' : ''}`
      ),
    }
  }

  // Step 2: Parse JSON
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown parse error'
    return {
      success: false,
      error: createParseError(
        'E002_INVALID_JSON',
        `JSON parse error: ${errorMessage}`,
        `The AI returned malformed JSON.

Attempted to parse:
${jsonStr.slice(0, 300)}${jsonStr.length > 300 ? '...' : ''}`,
        { start: 0, end: jsonStr.length, content: jsonStr.slice(0, 60) }
      ),
    }
  }

  // Step 3: Validate bullets array exists (new format with scores)
  if (!parsed.bullets || !Array.isArray(parsed.bullets)) {
    return {
      success: false,
      error: createParseError(
        'E003_MISSING_BULLET_IDS',
        'Response missing "bullets" array',
        `The AI response must contain a "bullets" array with {id, score} objects.

Got keys: ${Object.keys(parsed).join(', ')}

Expected: bullets, reasoning, job_title, salary`
      ),
    }
  }

  const rawBullets = parsed.bullets as Array<unknown>

  // Step 4: Validate each bullet has id (string) and score (number 0-1)
  const bullets: ScoredBulletId[] = []
  for (let i = 0; i < rawBullets.length; i++) {
    const b = rawBullets[i] as Record<string, unknown>
    if (typeof b?.id !== 'string') {
      return {
        success: false,
        error: createParseError(
          'E005_INVALID_BULLET_ID',
          `Bullet at index ${i} missing valid "id" string`,
          `Each bullet must have an "id" string. Got: ${JSON.stringify(b)}`
        ),
      }
    }
    if (typeof b?.score !== 'number' || b.score < 0 || b.score > 1) {
      return {
        success: false,
        error: createParseError(
          'E009_INVALID_SCORE',
          `Bullet "${b.id}" has invalid score`,
          `Score must be a number between 0.0 and 1.0. Got: ${b.score}`
        ),
      }
    }
    bullets.push({ id: b.id, score: b.score })
  }

  // Step 5: Validate minimum count
  const minRequired = config.minBullets ?? 30
  const actual = bullets.length
  if (actual < minRequired) {
    return {
      success: false,
      error: createParseError(
        'E004_WRONG_BULLET_COUNT',
        `Expected at least ${minRequired} bullets, got ${actual}`,
        `The AI must score at least ${minRequired} bullets to give the server selection options.

Received only ${actual} bullets. Please score more bullets from the compendium.`
      ),
    }
  }

  // Step 6: Validate each ID exists in compendium
  const invalid = bullets.filter((b) => !validBulletIds.has(b.id))
  if (invalid.length > 0) {
    const sampleValid = Array.from(validBulletIds).slice(0, 5)
    return {
      success: false,
      error: createParseError(
        'E005_INVALID_BULLET_ID',
        `${invalid.length} invalid bullet ID(s) found`,
        `These IDs do not exist in the compendium:

${invalid.map((b) => `  - "${b.id}"`).join('\n')}

Valid IDs look like:
${sampleValid.map((id) => `  - "${id}"`).join('\n')}...`
      ),
    }
  }

  // Step 7: Check for duplicates
  const seen = new Set<string>()
  const dupes: string[] = []
  for (const b of bullets) {
    if (seen.has(b.id)) dupes.push(b.id)
    seen.add(b.id)
  }
  if (dupes.length > 0) {
    return {
      success: false,
      error: createParseError(
        'E006_DUPLICATE_BULLET_ID',
        `${dupes.length} duplicate bullet ID(s)`,
        `Each bullet can only be selected once:

Duplicates: ${dupes.join(', ')}

Remove duplicates and select unique bullets.`
      ),
    }
  }

  // Step 8: Diversity validation removed - server handles constraints

  // Step 9: Validate reasoning exists
  if (typeof parsed.reasoning !== 'string' || parsed.reasoning.length === 0) {
    return {
      success: false,
      error: createParseError(
        'E008_MISSING_REASONING',
        'Response missing "reasoning" field',
        `The AI response must include a "reasoning" string explaining the selection.

Got: ${typeof parsed.reasoning === 'string' ? '(empty string)' : typeof parsed.reasoning}`
      ),
    }
  }

  // Step 10: Validate salary (optional, but must be valid if present)
  let salary: SalaryInfo | null = null
  if (parsed.salary !== null && parsed.salary !== undefined) {
    const salaryResult = validateSalary(parsed.salary)
    if (!salaryResult.valid) {
      // Salary errors are warnings, not failures - we continue without salary
      console.warn(`[AI Parser] Invalid salary: ${salaryResult.error}`)
      salary = null
    } else {
      salary = salaryResult.data
    }
  }

  // Step 11: Extract job_title (optional)
  const jobTitle =
    typeof parsed.job_title === 'string' && parsed.job_title.length > 0
      ? parsed.job_title
      : null

  return {
    success: true,
    data: {
      bullets,
      reasoning: parsed.reasoning as string,
      jobTitle,
      salary,
    },
  }
}

/**
 * Build hierarchy map from compendium for diversity validation
 */
export function buildBulletHierarchy(
  experience: Array<{
    id: string
    children: Array<{
      id: string
      children: Array<{ id: string }>
    }>
  }>
): BulletHierarchy {
  const hierarchy: BulletHierarchy = {}

  for (const company of experience) {
    for (const position of company.children) {
      for (const bullet of position.children) {
        hierarchy[bullet.id] = {
          companyId: company.id,
          positionId: position.id,
        }
      }
    }
  }

  return hierarchy
}

/**
 * Extract all bullet IDs from compendium
 */
export function extractAllBulletIds(
  experience: Array<{
    children: Array<{
      children: Array<{ id: string }>
    }>
  }>
): Set<string> {
  const ids = new Set<string>()

  for (const company of experience) {
    for (const position of company.children) {
      for (const bullet of position.children) {
        ids.add(bullet.id)
      }
    }
  }

  return ids
}
