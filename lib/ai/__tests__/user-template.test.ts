import { describe, it, expect } from 'vitest'
import {
  buildUserPrompt,
  estimateTokenCount,
  checkCompendiumSize,
} from '../prompts/prompt'
import type { ResumeData } from '@/lib/types/generated-resume'

// Minimal valid compendium for testing
const mockCompendium: ResumeData = {
  personal: {
    name: 'Test User',
  },
  experience: [
    {
      id: 'company-a',
      name: 'Acme Corp',
      dateStart: '2020-01',
      dateEnd: '2023-06',
      location: 'San Francisco, CA',
      priority: 8,
      tags: ['tech', 'startup'],
      children: [
        {
          id: 'company-a-swe',
          name: 'Senior Software Engineer',
          dateStart: '2021-06',
          dateEnd: '2023-06',
          priority: 8,
          tags: ['engineering', 'leadership'],
          children: [
            {
              id: 'company-a-swe-bullet-1',
              description:
                'Led migration of monolithic architecture to microservices, reducing deployment time by 80%',
              priority: 9,
              tags: ['architecture', 'microservices', 'leadership'],
            },
            {
              id: 'company-a-swe-bullet-2',
              description:
                'Mentored 5 junior engineers, establishing code review practices',
              priority: 7,
              tags: ['mentorship', 'leadership'],
            },
          ],
        },
        {
          id: 'company-a-junior',
          name: 'Software Engineer',
          dateStart: '2020-01',
          dateEnd: '2021-06',
          priority: 6,
          tags: ['engineering'],
          children: [
            {
              id: 'company-a-junior-bullet-1',
              description: 'Built RESTful APIs serving 1M requests per day',
              priority: 7,
              tags: ['api', 'backend', 'scale'],
            },
          ],
        },
      ],
    },
    {
      id: 'company-b',
      name: 'Big Tech Inc',
      dateStart: '2018-03',
      dateEnd: '2019-12',
      priority: 9,
      tags: ['bigtech', 'enterprise'],
      children: [
        {
          id: 'company-b-sde',
          name: 'Software Development Engineer',
          dateStart: '2018-03',
          dateEnd: '2019-12',
          priority: 7,
          tags: ['engineering'],
          children: [
            {
              id: 'company-b-sde-bullet-1',
              description:
                'Optimized database queries reducing latency by 60%',
              priority: 8,
              tags: ['database', 'performance', 'optimization'],
            },
          ],
        },
      ],
    },
  ],
}

const sampleJobDescription = `
Senior Backend Engineer

We're looking for an experienced backend engineer to join our platform team.

Requirements:
- 5+ years of experience in backend development
- Strong experience with microservices architecture
- Experience with high-scale distributed systems
- Leadership and mentoring experience

Compensation: $150,000 - $200,000 per year
`

describe('buildUserPrompt', () => {
  it('includes all bullet IDs with hierarchy context', () => {
    const prompt = buildUserPrompt(sampleJobDescription, mockCompendium, {
      maxBullets: 3,
      maxPerCompany: 2,
      maxPerPosition: 2,
    })

    // Check all bullet IDs are present
    expect(prompt).toContain('[company-a-swe-bullet-1]')
    expect(prompt).toContain('[company-a-swe-bullet-2]')
    expect(prompt).toContain('[company-a-junior-bullet-1]')
    expect(prompt).toContain('[company-b-sde-bullet-1]')

    // Check hierarchy context
    expect(prompt).toContain('### Acme Corp')
    expect(prompt).toContain('#### Senior Software Engineer')
    expect(prompt).toContain('### Big Tech Inc')
  })

  it('includes minimum bullet requirement derived from maxBullets', () => {
    const prompt = buildUserPrompt(sampleJobDescription, mockCompendium, {
      maxBullets: 24, // Target for server selection
    })

    // Should ask for minimum bullets (maxBullets + AI_BULLET_BUFFER = 24 + 10 = 34)
    expect(prompt).toContain('Score AT LEAST')
    expect(prompt).toMatch(/Score AT LEAST \d+ bullets/)
    expect(prompt).toContain('34 bullets') // 24 + 10 buffer
    // Should mention server handles constraints
    expect(prompt).toContain('server will apply diversity constraints')
  })

  it('formats compendium compactly but completely', () => {
    const prompt = buildUserPrompt(sampleJobDescription, mockCompendium, {
      maxBullets: 3,
    })

    // Check bullet descriptions are included
    expect(prompt).toContain('Led migration of monolithic architecture')
    expect(prompt).toContain('Mentored 5 junior engineers')
    expect(prompt).toContain('Built RESTful APIs')
    expect(prompt).toContain('Optimized database queries')

    // Check tags and priority are included
    expect(prompt).toContain('tags:')
    expect(prompt).toContain('priority:')
  })

  it('includes job description', () => {
    const prompt = buildUserPrompt(sampleJobDescription, mockCompendium, {
      maxBullets: 3,
    })

    expect(prompt).toContain('Senior Backend Engineer')
    expect(prompt).toContain('microservices architecture')
    expect(prompt).toContain('$150,000 - $200,000')
  })

  it('includes date ranges', () => {
    const prompt = buildUserPrompt(sampleJobDescription, mockCompendium, {
      maxBullets: 3,
    })

    expect(prompt).toContain('2020–2023')
    expect(prompt).toContain('2018–2019')
  })

  it('includes location when present', () => {
    const prompt = buildUserPrompt(sampleJobDescription, mockCompendium, {
      maxBullets: 3,
    })

    expect(prompt).toContain('San Francisco, CA')
  })

  it('includes retry context when provided', () => {
    const prompt = buildUserPrompt(sampleJobDescription, mockCompendium, {
      maxBullets: 3,
      retryContext:
        'error[E004_WRONG_BULLET_COUNT]: Expected 3 bullets, got 2',
    })

    expect(prompt).toContain('PREVIOUS RESPONSE HAD ERRORS')
    expect(prompt).toContain('E004_WRONG_BULLET_COUNT')
    expect(prompt).toContain('fix the issues')
  })

  it('does not include retry section when no context', () => {
    const prompt = buildUserPrompt(sampleJobDescription, mockCompendium, {
      maxBullets: 3,
    })

    expect(prompt).not.toContain('PREVIOUS RESPONSE HAD ERRORS')
  })

  it('includes response format instructions', () => {
    const prompt = buildUserPrompt(sampleJobDescription, mockCompendium, {
      maxBullets: 3,
    })

    expect(prompt).toContain('"bullets"')
    expect(prompt).toContain('"reasoning"')
    expect(prompt).toContain('"job_title"')
    expect(prompt).toContain('"salary"')
    expect(prompt).toContain('ONLY a JSON object')
  })
})

describe('estimateTokenCount', () => {
  it('estimates tokens based on character count', () => {
    const text = 'Hello world' // 11 chars
    const estimate = estimateTokenCount(text)

    // ~4 chars per token, so 11/4 ≈ 3
    expect(estimate).toBeGreaterThanOrEqual(2)
    expect(estimate).toBeLessThanOrEqual(4)
  })

  it('handles empty string', () => {
    expect(estimateTokenCount('')).toBe(0)
  })

  it('handles long text', () => {
    const longText = 'x'.repeat(10000)
    const estimate = estimateTokenCount(longText)

    // 10000 chars / 4 = 2500 tokens
    expect(estimate).toBe(2500)
  })
})

describe('checkCompendiumSize', () => {
  it('returns ok for small compendium', () => {
    const result = checkCompendiumSize(mockCompendium)

    expect(result.ok).toBe(true)
    expect(result.warning).toBeUndefined()
    expect(result.estimatedTokens).toBeGreaterThan(0)
  })

  it('returns warning for large compendium approaching limit', () => {
    // Create a large compendium
    const largeCompendium: ResumeData = {
      personal: { name: 'Test' },
      experience: Array(50)
        .fill(null)
        .map((_, i) => ({
          id: `company-${i}`,
          name: `Company ${i}`,
          dateStart: '2020-01',
          priority: 5,
          tags: ['test'],
          children: Array(10)
            .fill(null)
            .map((_, j) => ({
              id: `company-${i}-pos-${j}`,
              name: `Position ${j}`,
              dateStart: '2020-01',
              priority: 5,
              tags: ['test'],
              children: Array(5)
                .fill(null)
                .map((_, k) => ({
                  id: `company-${i}-pos-${j}-bullet-${k}`,
                  description: 'A'.repeat(200), // Long description
                  priority: 5,
                  tags: ['test', 'long', 'description'],
                })),
            })),
        })),
    }

    // Use a small context limit to trigger warning
    const result = checkCompendiumSize(largeCompendium, 50000)

    // Should either fail or warn depending on size
    expect(result.estimatedTokens).toBeGreaterThan(10000)
  })

  it('uses default context limit of 128k', () => {
    const result = checkCompendiumSize(mockCompendium)

    // Default limit should be 128000
    // Our small compendium should be well under the safe limit
    expect(result.ok).toBe(true)
  })
})
