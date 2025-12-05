import { describe, it, expect } from 'vitest'
import {
  parseAIOutput,
  extractJSON,
  buildBulletHierarchy,
  extractAllBulletIds,
  type BulletHierarchy,
  type SelectionConfig,
} from '../output-parser'
import { formatRustStyleError, formatSimplifiedError } from '../errors'

// Test fixtures
const validBulletIds = new Set([
  'company-a-pos-1-bullet-1',
  'company-a-pos-1-bullet-2',
  'company-a-pos-2-bullet-1',
  'company-b-pos-1-bullet-1',
  'company-b-pos-1-bullet-2',
  'company-b-pos-1-bullet-3',
])

const hierarchy: BulletHierarchy = {
  'company-a-pos-1-bullet-1': { companyId: 'company-a', positionId: 'pos-1' },
  'company-a-pos-1-bullet-2': { companyId: 'company-a', positionId: 'pos-1' },
  'company-a-pos-2-bullet-1': { companyId: 'company-a', positionId: 'pos-2' },
  'company-b-pos-1-bullet-1': { companyId: 'company-b', positionId: 'pos-1' },
  'company-b-pos-1-bullet-2': { companyId: 'company-b', positionId: 'pos-1' },
  'company-b-pos-1-bullet-3': { companyId: 'company-b', positionId: 'pos-1' },
}

const defaultConfig: SelectionConfig = {
  maxBullets: 24, // Target for server-side selection
  minBullets: 3, // Minimum AI must return for tests
  maxPerCompany: 6, // For server-side diversity (not validated in parser)
  maxPerPosition: 4, // For server-side diversity (not validated in parser)
}

// Helper to create bullets with scores
const b = (id: string, score = 0.9) => ({ id, score })

describe('extractJSON', () => {
  it('extracts JSON from markdown code block', () => {
    const raw = `Here's the selection:
\`\`\`json
{"bullets": [{"id": "a", "score": 0.9}], "reasoning": "test"}
\`\`\`
`
    const result = extractJSON(raw)
    expect(result).toBe('{"bullets": [{"id": "a", "score": 0.9}], "reasoning": "test"}')
  })

  it('extracts JSON from code block without language tag', () => {
    const raw = `\`\`\`
{"bullets": [{"id": "a", "score": 0.9}]}
\`\`\``
    const result = extractJSON(raw)
    expect(result).toBe('{"bullets": [{"id": "a", "score": 0.9}]}')
  })

  it('extracts raw JSON with bullets array (new format)', () => {
    const raw = 'Some text {"bullets": [{"id": "a", "score": 0.9}]} more text'
    const result = extractJSON(raw)
    expect(result).toBe('{"bullets": [{"id": "a", "score": 0.9}]}')
  })

  it('extracts raw JSON with bullet_ids (legacy format)', () => {
    const raw = 'Some text {"bullet_ids": ["a", "b"]} more text'
    const result = extractJSON(raw)
    expect(result).toBe('{"bullet_ids": ["a", "b"]}')
  })

  it('extracts any JSON object as fallback', () => {
    const raw = 'Response: {"items": [1, 2, 3]}'
    const result = extractJSON(raw)
    expect(result).toBe('{"items": [1, 2, 3]}')
  })

  it('returns null when no JSON found', () => {
    const raw = 'No JSON here, just plain text'
    const result = extractJSON(raw)
    expect(result).toBeNull()
  })
})

describe('parseAIOutput', () => {
  it('parses valid JSON with all fields', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1', 0.95),
        b('company-b-pos-1-bullet-1', 0.88),
        b('company-a-pos-2-bullet-1', 0.82),
      ],
      reasoning: 'Selected based on relevance to job requirements',
      job_title: 'Senior Software Engineer',
      salary: {
        min: 120000,
        max: 150000,
        currency: 'USD',
        period: 'annual',
      },
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(true)
    expect(result.data?.bullets).toHaveLength(3)
    expect(result.data?.bullets[0]).toEqual({ id: 'company-a-pos-1-bullet-1', score: 0.95 })
    expect(result.data?.reasoning).toBe(
      'Selected based on relevance to job requirements'
    )
    expect(result.data?.jobTitle).toBe('Senior Software Engineer')
    expect(result.data?.salary).toEqual({
      min: 120000,
      max: 150000,
      currency: 'USD',
      period: 'annual',
    })
  })

  it('handles null job_title gracefully', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1'),
        b('company-b-pos-1-bullet-1'),
        b('company-a-pos-2-bullet-1'),
      ],
      reasoning: 'Test reasoning',
      job_title: null,
      salary: null,
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(true)
    expect(result.data?.jobTitle).toBeNull()
  })

  it('handles null salary gracefully', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1'),
        b('company-b-pos-1-bullet-1'),
        b('company-a-pos-2-bullet-1'),
      ],
      reasoning: 'Test reasoning',
      job_title: 'Engineer',
      salary: null,
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(true)
    expect(result.data?.salary).toBeNull()
  })

  it('handles missing salary field gracefully', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1'),
        b('company-b-pos-1-bullet-1'),
        b('company-a-pos-2-bullet-1'),
      ],
      reasoning: 'Test reasoning',
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(true)
    expect(result.data?.salary).toBeNull()
    expect(result.data?.jobTitle).toBeNull()
  })

  it('validates salary structure - invalid currency', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1'),
        b('company-b-pos-1-bullet-1'),
        b('company-a-pos-2-bullet-1'),
      ],
      reasoning: 'Test reasoning',
      salary: { min: 100000, period: 'annual' }, // Missing currency
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    // Should succeed but with null salary (salary errors are warnings)
    expect(result.success).toBe(true)
    expect(result.data?.salary).toBeNull()
  })

  it('validates salary structure - invalid period', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1'),
        b('company-b-pos-1-bullet-1'),
        b('company-a-pos-2-bullet-1'),
      ],
      reasoning: 'Test reasoning',
      salary: { min: 100000, currency: 'USD', period: 'biweekly' }, // Invalid period
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(true)
    expect(result.data?.salary).toBeNull()
  })

  it('returns E001 when no JSON found', () => {
    const raw = 'Just some text without any JSON'

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('E001_NO_JSON_FOUND')
  })

  it('returns E002 for malformed JSON', () => {
    // Valid-looking JSON structure that fails parse (invalid escape sequence)
    const raw = '{"bullets": [{"id": "test\\x"}], "reasoning": "test"}'

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('E002_INVALID_JSON')
  })

  it('returns E003 when bullets array missing', () => {
    const raw = JSON.stringify({
      reasoning: 'Test',
      selections: ['a', 'b'], // Wrong key
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('E003_MISSING_BULLET_IDS')
  })

  it('returns E004 for insufficient bullet count', () => {
    const raw = JSON.stringify({
      bullets: [b('company-a-pos-1-bullet-1'), b('company-b-pos-1-bullet-1')], // Only 2, min is 3
      reasoning: 'Test',
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('E004_WRONG_BULLET_COUNT')
    expect(result.error?.message).toContain('Expected at least 3 bullets, got 2')
  })

  it('returns E005 for invalid bullet IDs', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1'),
        b('nonexistent-bullet'),
        b('also-fake'),
      ],
      reasoning: 'Test',
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('E005_INVALID_BULLET_ID')
    expect(result.error?.message).toContain('2 invalid')
  })

  it('returns E006 for duplicate bullet IDs', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1'),
        b('company-a-pos-1-bullet-1'), // Duplicate
        b('company-b-pos-1-bullet-1'),
      ],
      reasoning: 'Test',
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('E006_DUPLICATE_BULLET_ID')
  })

  // E007 diversity validation removed - server handles constraints
  // AI just scores bullets, server applies maxPerCompany/maxPerPosition

  it('returns E008 when reasoning is missing', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1'),
        b('company-b-pos-1-bullet-1'),
        b('company-a-pos-2-bullet-1'),
      ],
      // No reasoning field
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('E008_MISSING_REASONING')
  })

  it('returns E008 when reasoning is empty string', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1'),
        b('company-b-pos-1-bullet-1'),
        b('company-a-pos-2-bullet-1'),
      ],
      reasoning: '',
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('E008_MISSING_REASONING')
  })

  it('returns E009 for invalid score (out of range)', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1', 1.5), // Score > 1.0
        b('company-b-pos-1-bullet-1'),
        b('company-a-pos-2-bullet-1'),
      ],
      reasoning: 'Test',
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('E009_INVALID_SCORE')
  })

  it('returns E009 for invalid score (negative)', () => {
    const raw = JSON.stringify({
      bullets: [
        b('company-a-pos-1-bullet-1', -0.5), // Negative score
        b('company-b-pos-1-bullet-1'),
        b('company-a-pos-2-bullet-1'),
      ],
      reasoning: 'Test',
    })

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('E009_INVALID_SCORE')
  })

  it('extracts JSON from markdown code blocks in full response', () => {
    const raw = `Based on the job description, I've selected the following bullets:

\`\`\`json
{
  "bullets": [
    {"id": "company-a-pos-1-bullet-1", "score": 0.95},
    {"id": "company-b-pos-1-bullet-1", "score": 0.88},
    {"id": "company-a-pos-2-bullet-1", "score": 0.82}
  ],
  "reasoning": "Selected technical leadership experience",
  "job_title": "Tech Lead",
  "salary": null
}
\`\`\`

These bullets best match the requirements.`

    const result = parseAIOutput(raw, validBulletIds, hierarchy, defaultConfig)

    expect(result.success).toBe(true)
    expect(result.data?.bullets).toHaveLength(3)
    expect(result.data?.jobTitle).toBe('Tech Lead')
  })
})

describe('formatRustStyleError', () => {
  it('formats error with code, message, and help', () => {
    const error = {
      code: 'E004_WRONG_BULLET_COUNT' as const,
      message: 'Expected 28 bullets, got 25',
      help: 'The AI must select exactly 28 bullets.\n\nReceived 25 bullet IDs.',
    }

    const formatted = formatRustStyleError(error)

    expect(formatted).toContain('error[E004_WRONG_BULLET_COUNT]')
    expect(formatted).toContain('Expected 28 bullets, got 25')
    expect(formatted).toContain('Received 25 bullet IDs')
  })

  it('includes span indicator when present', () => {
    const error = {
      code: 'E002_INVALID_JSON' as const,
      message: 'JSON parse error',
      help: 'Malformed JSON',
      span: { start: 42, end: 50, content: '{"broken' },
    }

    const formatted = formatRustStyleError(error)

    expect(formatted).toContain('--> AI response:42')
    expect(formatted).toContain('{"broken')
    expect(formatted).toContain('~~~~~~~~')
  })
})

describe('formatSimplifiedError', () => {
  it('returns user-friendly message for each error code', () => {
    const codes = [
      'E000_PROVIDER_ERROR',
      'E001_NO_JSON_FOUND',
      'E002_INVALID_JSON',
      'E003_MISSING_BULLET_IDS',
      'E004_WRONG_BULLET_COUNT',
      'E005_INVALID_BULLET_ID',
      'E006_DUPLICATE_BULLET_ID',
      'E007_DIVERSITY_VIOLATION',
      'E008_MISSING_REASONING',
      'E009_INVALID_SCORE',
      'E010_INVALID_SALARY',
      'E011_PROVIDER_DOWN',
    ] as const

    for (const code of codes) {
      const error = { code, message: 'test', help: 'test' }
      const simplified = formatSimplifiedError(error)

      expect(simplified).toBeTruthy()
      expect(simplified.length).toBeGreaterThan(10)
      // Should not contain error codes
      expect(simplified).not.toContain('E00')
    }
  })
})

describe('buildBulletHierarchy', () => {
  it('builds hierarchy from experience structure', () => {
    const experience = [
      {
        id: 'company-x',
        children: [
          {
            id: 'position-1',
            children: [{ id: 'bullet-a' }, { id: 'bullet-b' }],
          },
        ],
      },
    ]

    const result = buildBulletHierarchy(experience)

    expect(result['bullet-a']).toEqual({
      companyId: 'company-x',
      positionId: 'position-1',
    })
    expect(result['bullet-b']).toEqual({
      companyId: 'company-x',
      positionId: 'position-1',
    })
  })
})

describe('extractAllBulletIds', () => {
  it('extracts all bullet IDs from experience', () => {
    const experience = [
      {
        children: [
          {
            children: [{ id: 'a' }, { id: 'b' }],
          },
          {
            children: [{ id: 'c' }],
          },
        ],
      },
      {
        children: [
          {
            children: [{ id: 'd' }],
          },
        ],
      },
    ]

    const result = extractAllBulletIds(experience)

    expect(result.size).toBe(4)
    expect(result.has('a')).toBe(true)
    expect(result.has('b')).toBe(true)
    expect(result.has('c')).toBe(true)
    expect(result.has('d')).toBe(true)
  })
})
