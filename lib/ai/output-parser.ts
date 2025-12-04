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
  maxBullets: number
  maxPerCompany?: number
  maxPerPosition?: number
}

export interface ParsedAIResponse {
  bulletIds: string[]
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

  // Try to find raw JSON object with bullet_ids
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

/**
 * Validate diversity constraints (max per company, max per position)
 */
function validateDiversity(
  bulletIds: string[],
  hierarchy: BulletHierarchy,
  config: SelectionConfig
): ParseError | null {
  const { maxPerCompany, maxPerPosition } = config

  if (!maxPerCompany && !maxPerPosition) {
    return null
  }

  const companyCount: Record<string, number> = {}
  const positionCount: Record<string, number> = {}

  for (const id of bulletIds) {
    const info = hierarchy[id]
    if (!info) continue // Invalid ID handled elsewhere

    companyCount[info.companyId] = (companyCount[info.companyId] || 0) + 1
    positionCount[info.positionId] = (positionCount[info.positionId] || 0) + 1
  }

  // Check company limits
  if (maxPerCompany) {
    const violations = Object.entries(companyCount).filter(
      ([, count]) => count > maxPerCompany
    )
    if (violations.length > 0) {
      const details = violations
        .map(([company, count]) => `${company}: ${count}`)
        .join(', ')
      return createParseError(
        'E007_DIVERSITY_VIOLATION',
        `Company limit exceeded (max ${maxPerCompany} per company)`,
        `The following companies have too many bullets selected:\n\n  ${details}\n\nPlease redistribute selections across more companies.`
      )
    }
  }

  // Check position limits
  if (maxPerPosition) {
    const violations = Object.entries(positionCount).filter(
      ([, count]) => count > maxPerPosition
    )
    if (violations.length > 0) {
      const details = violations
        .map(([position, count]) => `${position}: ${count}`)
        .join(', ')
      return createParseError(
        'E007_DIVERSITY_VIOLATION',
        `Position limit exceeded (max ${maxPerPosition} per position)`,
        `The following positions have too many bullets selected:\n\n  ${details}\n\nPlease redistribute selections across more positions.`
      )
    }
  }

  return null
}

/**
 * Parse and validate AI output
 *
 * @param raw - Raw AI response text
 * @param validBulletIds - Set of valid bullet IDs from compendium
 * @param hierarchy - Mapping of bullet IDs to company/position for diversity
 * @param config - Selection configuration (maxBullets, maxPerCompany, etc.)
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

  // Step 3: Validate bullet_ids exists and is array
  if (!parsed.bullet_ids || !Array.isArray(parsed.bullet_ids)) {
    return {
      success: false,
      error: createParseError(
        'E003_MISSING_BULLET_IDS',
        'Response missing "bullet_ids" array',
        `The AI response must contain a "bullet_ids" array.

Got keys: ${Object.keys(parsed).join(', ')}

Expected: bullet_ids, reasoning, job_title, salary`
      ),
    }
  }

  const bulletIds = parsed.bullet_ids as string[]

  // Step 4: Validate all IDs are strings
  const nonStrings = bulletIds.filter((id) => typeof id !== 'string')
  if (nonStrings.length > 0) {
    return {
      success: false,
      error: createParseError(
        'E005_INVALID_BULLET_ID',
        `${nonStrings.length} bullet ID(s) are not strings`,
        `All bullet_ids must be strings.

Invalid values: ${JSON.stringify(nonStrings.slice(0, 5))}`
      ),
    }
  }

  // Step 5: Validate count
  const expected = config.maxBullets
  const actual = bulletIds.length
  if (actual !== expected) {
    return {
      success: false,
      error: createParseError(
        'E004_WRONG_BULLET_COUNT',
        `Expected ${expected} bullets, got ${actual}`,
        `The AI must select exactly ${expected} bullets.

Received ${actual} bullet IDs:
${bulletIds.slice(0, 10).join(', ')}${actual > 10 ? '...' : ''}

${actual < expected ? `Missing ${expected - actual} bullets.` : `Remove ${actual - expected} bullets.`}`
      ),
    }
  }

  // Step 6: Validate each ID exists in compendium
  const invalid = bulletIds.filter((id) => !validBulletIds.has(id))
  if (invalid.length > 0) {
    const sampleValid = Array.from(validBulletIds).slice(0, 5)
    return {
      success: false,
      error: createParseError(
        'E005_INVALID_BULLET_ID',
        `${invalid.length} invalid bullet ID(s) found`,
        `These IDs do not exist in the compendium:

${invalid.map((id) => `  - "${id}"`).join('\n')}

Valid IDs look like:
${sampleValid.map((id) => `  - "${id}"`).join('\n')}...`
      ),
    }
  }

  // Step 7: Check for duplicates
  const seen = new Set<string>()
  const dupes: string[] = []
  for (const id of bulletIds) {
    if (seen.has(id)) dupes.push(id)
    seen.add(id)
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

  // Step 8: Validate diversity constraints
  const diversityError = validateDiversity(bulletIds, hierarchy, config)
  if (diversityError) {
    return { success: false, error: diversityError }
  }

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
      bulletIds,
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
