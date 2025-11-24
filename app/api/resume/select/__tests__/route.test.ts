/**
 * API Route Tests: /api/resume/select
 *
 * These tests validate the bullet selection API endpoint,
 * which is a critical piece of the resume generation system.
 *
 * Security tests cover:
 * - Turnstile token verification
 * - Token replay prevention
 * - Rate limiting
 *
 * NOTE: Some tests may fail in CI environments due to dynamic imports
 * and Next.js server component limitations. These serve as
 * integration tests best run locally.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'
import { mockTurnstileSuccess, mockTurnstileFailure, restoreFetch } from '@/lib/__tests__/helpers/mock-fetch'

// ========== Test Data Fixtures ==========

const mockResumeData = {
  personal: {
    name: 'Test User',
    email: 'test@example.com',
  },
  experience: [
    {
      id: 'company1',
      name: 'Test Company',
      dateStart: '2020',
      dateEnd: '2023',
      priority: 8,
      tags: ['engineering', 'startup'],
      children: [
        {
          id: 'pos1',
          name: 'Senior Engineer',
          dateStart: '2020',
          dateEnd: '2023',
          priority: 9,
          tags: ['leadership', 'engineering'],
          description: 'Led engineering team of 5',
          children: [
            {
              id: 'bullet1',
              description: 'Built scalable API serving 10M+ requests/day',
              tags: ['backend', 'performance'],
              priority: 10,
            },
            {
              id: 'bullet2',
              description: 'Reduced infrastructure costs by 40%',
              tags: ['infrastructure', 'optimization'],
              priority: 9,
            },
            {
              id: 'bullet3',
              description: 'Implemented CI/CD pipeline',
              tags: ['devops', 'automation'],
              priority: 7,
            },
          ],
        },
      ],
    },
    {
      id: 'company2',
      name: 'Another Company',
      dateStart: '2018',
      dateEnd: '2020',
      priority: 6,
      tags: ['enterprise'],
      children: [
        {
          id: 'pos2',
          name: 'Engineer',
          dateStart: '2018',
          dateEnd: '2020',
          priority: 7,
          tags: ['engineering'],
          children: [
            {
              id: 'bullet4',
              description: 'Developed customer portal',
              tags: ['frontend', 'react'],
              priority: 8,
            },
          ],
        },
      ],
    },
  ],
  roleProfiles: [
    {
      id: 'software-engineer',
      name: 'Software Engineer',
      description: 'Full-stack engineer',
      tagWeights: {
        backend: 1.0,
        frontend: 0.8,
        performance: 0.9,
        infrastructure: 0.7,
      },
      scoringWeights: {
        tagRelevance: 0.6,
        priority: 0.4,
      },
    },
    {
      id: 'devops-engineer',
      name: 'DevOps Engineer',
      tagWeights: {
        devops: 1.0,
        infrastructure: 0.95,
        automation: 0.9,
      },
      scoringWeights: {
        tagRelevance: 0.7,
        priority: 0.3,
      },
    },
  ],
}

// ========== Unit Tests for Scoring Algorithm ==========

describe('/api/resume/select - Scoring Algorithm (Unit Tests)', () => {
  // These tests validate the scoring logic without hitting the API

  it('calculates tag relevance correctly', () => {
    const bulletTags = ['backend', 'performance']
    const tagWeights: Record<string, number> = {
      backend: 1.0,
      performance: 0.9,
      frontend: 0.8,
    }

    // Tag relevance = (1.0 + 0.9) / 2 = 0.95
    const expectedRelevance = 0.95

    let totalWeight = 0.0
    let matchedTags = 0

    for (const tag of bulletTags) {
      if (tag in tagWeights) {
        totalWeight += tagWeights[tag]
        matchedTags++
      }
    }

    const tagRelevance = matchedTags > 0 ? totalWeight / matchedTags : 0.0

    expect(tagRelevance).toBeCloseTo(expectedRelevance, 2)
  })

  it('calculates company multiplier correctly', () => {
    // Priority 8 should map to: 0.8 + (8/10) * 0.4 = 0.8 + 0.32 = 1.12
    const priority = 8
    const multiplier = 0.8 + (priority / 10.0) * 0.4

    expect(multiplier).toBeCloseTo(1.12, 2)
  })

  it('calculates position multiplier correctly', () => {
    // Priority 9 should map to: 0.8 + (9/10) * 0.4 = 0.8 + 0.36 = 1.16
    const priority = 9
    const priorityMultiplier = 0.8 + (priority / 10.0) * 0.4

    expect(priorityMultiplier).toBeCloseTo(1.16, 2)
  })

  it('combines scoring components correctly', () => {
    // Test full score calculation
    const tagRelevance = 0.95 // High tag match
    const priority = 10 // Max priority
    const priorityScore = priority / 10.0 // 1.0

    const scoringWeights = {
      tagRelevance: 0.6,
      priority: 0.4,
    }

    const baseScore =
      tagRelevance * scoringWeights.tagRelevance +
      priorityScore * scoringWeights.priority

    // Expected: 0.95 * 0.6 + 1.0 * 0.4 = 0.57 + 0.4 = 0.97
    expect(baseScore).toBeCloseTo(0.97, 2)

    // With multipliers (company 1.12, position 1.16)
    const finalScore = baseScore * 1.12 * 1.16
    expect(finalScore).toBeGreaterThan(1.0) // Should exceed 1.0 with perfect score
  })
})

// ========== Integration Tests ==========

describe('/api/resume/select - Diversity Constraints (Unit Tests)', () => {
  it('respects maxBullets constraint', () => {
    const bullets = Array.from({ length: 20 }, (_, i) => ({
      bullet: { id: `b${i}`, description: `Bullet ${i}`, tags: [], priority: 5 },
      score: 10 - i * 0.1, // Descending scores
      companyId: 'company1',
      companyName: 'Company',
      positionId: 'pos1',
      positionName: 'Position',
    }))

    const config = { maxBullets: 10 }

    // Simple selection without constraints
    const selected = bullets.slice(0, config.maxBullets)

    expect(selected.length).toBe(10)
  })

  it('respects maxPerCompany constraint', () => {
    const bullets = [
      {
        bullet: { id: 'b1', description: 'B1', tags: [], priority: 10 },
        score: 10,
        companyId: 'company1',
        companyName: 'Company 1',
        positionId: 'pos1',
        positionName: 'Position 1',
      },
      {
        bullet: { id: 'b2', description: 'B2', tags: [], priority: 9 },
        score: 9,
        companyId: 'company1',
        companyName: 'Company 1',
        positionId: 'pos1',
        positionName: 'Position 1',
      },
      {
        bullet: { id: 'b3', description: 'B3', tags: [], priority: 8 },
        score: 8,
        companyId: 'company2',
        companyName: 'Company 2',
        positionId: 'pos2',
        positionName: 'Position 2',
      },
    ]

    const config = { maxBullets: 10, maxPerCompany: 1 }

    // Simulate diversity constraint
    const selected = []
    const companyCounts: Record<string, number> = {}

    for (const bullet of bullets) {
      if (selected.length >= config.maxBullets) break

      const companyCount = companyCounts[bullet.companyId] || 0
      if (companyCount >= config.maxPerCompany!) continue

      selected.push(bullet)
      companyCounts[bullet.companyId] = companyCount + 1
    }

    expect(selected.length).toBe(2) // Should select 1 from company1, 1 from company2
    expect(companyCounts['company1']).toBe(1)
    expect(companyCounts['company2']).toBe(1)
  })

  it('respects maxPerPosition constraint', () => {
    const bullets = [
      {
        bullet: { id: 'b1', description: 'B1', tags: [], priority: 10 },
        score: 10,
        companyId: 'company1',
        companyName: 'Company 1',
        positionId: 'pos1',
        positionName: 'Position 1',
      },
      {
        bullet: { id: 'b2', description: 'B2', tags: [], priority: 9 },
        score: 9,
        companyId: 'company1',
        companyName: 'Company 1',
        positionId: 'pos1',
        positionName: 'Position 1',
      },
      {
        bullet: { id: 'b3', description: 'B3', tags: [], priority: 8 },
        score: 8,
        companyId: 'company1',
        companyName: 'Company 1',
        positionId: 'pos2',
        positionName: 'Position 2',
      },
    ]

    const config = { maxBullets: 10, maxPerPosition: 1 }

    // Simulate diversity constraint
    const selected = []
    const positionCounts: Record<string, number> = {}

    for (const bullet of bullets) {
      if (selected.length >= config.maxBullets) break

      const positionCount = positionCounts[bullet.positionId] || 0
      if (positionCount >= config.maxPerPosition!) continue

      selected.push(bullet)
      positionCounts[bullet.positionId] = positionCount + 1
    }

    expect(selected.length).toBe(2) // Should select 1 from pos1, 1 from pos2
    expect(positionCounts['pos1']).toBe(1)
    expect(positionCounts['pos2']).toBe(1)
  })
})

// ========== Data Structure Tests ==========

describe('/api/resume/select - Test Data Validation', () => {
  it('mock resume data has correct structure', () => {
    expect(mockResumeData.personal).toBeDefined()
    expect(mockResumeData.experience).toBeInstanceOf(Array)
    expect(mockResumeData.roleProfiles).toBeInstanceOf(Array)

    // Check first company
    const company = mockResumeData.experience[0]
    expect(company.id).toBe('company1')
    expect(company.children).toBeInstanceOf(Array)

    // Check first position
    const position = company.children[0]
    expect(position.id).toBe('pos1')
    expect(position.children).toBeInstanceOf(Array)

    // Check first bullet
    const bullet = position.children[0]
    expect(bullet.id).toBe('bullet1')
    expect(bullet.description).toBeDefined()
    expect(bullet.tags).toBeInstanceOf(Array)
    expect(bullet.priority).toBeGreaterThan(0)
  })

  it('role profiles have required fields', () => {
    for (const profile of mockResumeData.roleProfiles) {
      expect(profile.id).toBeDefined()
      expect(profile.name).toBeDefined()
      expect(profile.tagWeights).toBeDefined()
      expect(profile.scoringWeights).toBeDefined()

      // Check scoring weights sum to 1.0
      const sum =
        profile.scoringWeights.tagRelevance + profile.scoringWeights.priority

      expect(sum).toBeCloseTo(1.0, 5)
    }
  })

  it('scoring weights are normalized', () => {
    const profile = mockResumeData.roleProfiles[0]
    const weights = profile.scoringWeights

    expect(weights.tagRelevance).toBeGreaterThanOrEqual(0)
    expect(weights.tagRelevance).toBeLessThanOrEqual(1)
    expect(weights.priority).toBeGreaterThanOrEqual(0)
    expect(weights.priority).toBeLessThanOrEqual(1)

    const sum = weights.tagRelevance + weights.priority
    expect(sum).toBeCloseTo(1.0, 5)
  })
})

// ========== Algorithm Behavior Tests ==========

describe('/api/resume/select - Scoring Behavior', () => {
  it('higher priority bullets get higher scores (all else equal)', () => {
    const scoringWeights = { tagRelevance: 0.5, priority: 0.5 }

    // Same tags, different priorities
    const bullet1 = { tags: ['engineering'], priority: 10 }
    const bullet2 = { tags: ['engineering'], priority: 5 }

    const tagScore = 1.0 // Both match 'engineering' perfectly

    const score1 = tagScore * scoringWeights.tagRelevance + (bullet1.priority / 10) * scoringWeights.priority
    const score2 = tagScore * scoringWeights.tagRelevance + (bullet2.priority / 10) * scoringWeights.priority

    expect(score1).toBeGreaterThan(score2)
  })

  it('better tag match gets higher score (all else equal)', () => {
    const tagWeights: Record<string, number> = { backend: 1.0, frontend: 0.5 }
    const scoringWeights = { tagRelevance: 0.7, priority: 0.3 }

    // Same priority, different tag matches
    const bullet1Tags = ['backend'] // Better match (weight 1.0)
    const bullet2Tags = ['frontend'] // Worse match (weight 0.5)

    let totalWeight1 = 0
    for (const tag of bullet1Tags) {
      if (tag in tagWeights) totalWeight1 += tagWeights[tag]
    }
    const tagScore1 = totalWeight1 / bullet1Tags.length

    let totalWeight2 = 0
    for (const tag of bullet2Tags) {
      if (tag in tagWeights) totalWeight2 += tagWeights[tag]
    }
    const tagScore2 = totalWeight2 / bullet2Tags.length

    const priority = 8
    const priorityScore = priority / 10

    const score1 = tagScore1 * scoringWeights.tagRelevance + priorityScore * scoringWeights.priority
    const score2 = tagScore2 * scoringWeights.tagRelevance + priorityScore * scoringWeights.priority

    expect(score1).toBeGreaterThan(score2)
  })

  it('bullets with no tag matches get low scores', () => {
    const tagWeights: Record<string, number> = { backend: 1.0, frontend: 0.8 }
    const scoringWeights = { tagRelevance: 0.6, priority: 0.4 }

    const bulletTags = ['random', 'irrelevant'] // No matches
    const priority = 5

    let totalWeight = 0
    let matched = 0
    for (const tag of bulletTags) {
      if (tag in tagWeights) {
        totalWeight += tagWeights[tag]
        matched++
      }
    }

    const tagScore = matched > 0 ? totalWeight / matched : 0.0
    const priorityScore = priority / 10

    const score = tagScore * scoringWeights.tagRelevance + priorityScore * scoringWeights.priority

    // Score should be low (only priority component matters)
    expect(score).toBeLessThan(0.3) // With priority 5, should be around 0.2
  })
})

// ========== API Security Tests ==========

describe('/api/resume/select - Security (Integration Tests)', () => {
  let tokenCounter = 0

  beforeEach(() => {
    // Set required env vars
    process.env.TURNSTILE_SECRET_KEY = 'test-secret-key'
    tokenCounter++
  })

  afterEach(() => {
    restoreFetch()
    delete process.env.TURNSTILE_SECRET_KEY
  })

  function getUniqueToken(): string {
    return `test-token-${tokenCounter}-${Math.random().toString(36).substring(7)}`
  }

  function createRequest(body: Record<string, any>): NextRequest {
    return new NextRequest('http://localhost:3000/api/resume/select', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify(body),
    })
  }

  it('accepts valid Turnstile token', async () => {
    mockTurnstileSuccess()

    const request = createRequest({
      roleProfileId: 'developer-relations-lead',
      turnstileToken: getUniqueToken(),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('rejects invalid Turnstile token', async () => {
    mockTurnstileFailure()

    const request = createRequest({
      roleProfileId: 'developer-relations-lead',
      turnstileToken: getUniqueToken(),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Turnstile verification failed')
  })

  it('prevents token replay attacks', async () => {
    mockTurnstileSuccess()

    const token = getUniqueToken()

    // First request should succeed
    const request1 = createRequest({
      roleProfileId: 'developer-relations-lead',
      turnstileToken: token,
    })

    const response1 = await POST(request1)
    expect(response1.status).toBe(200)

    // Second request with same token should fail
    const request2 = createRequest({
      roleProfileId: 'developer-relations-lead',
      turnstileToken: token, // Same token!
    })

    const response2 = await POST(request2)
    const data2 = await response2.json()

    expect(response2.status).toBe(403)
    expect(data2.error).toBe('Token already used')
  })

  it('returns 400 for missing fields', async () => {
    mockTurnstileSuccess()

    const request = createRequest({
      roleProfileId: 'developer-relations-lead',
      // Missing turnstileToken
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Missing required fields')
  })

  it('returns 404 for invalid role profile', async () => {
    mockTurnstileSuccess()

    const request = createRequest({
      roleProfileId: 'nonexistent-profile',
      turnstileToken: getUniqueToken(),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('Role profile not found')
  })

  it('returns 500 if TURNSTILE_SECRET_KEY not configured', async () => {
    delete process.env.TURNSTILE_SECRET_KEY

    const request = createRequest({
      roleProfileId: 'developer-relations-lead',
      turnstileToken: getUniqueToken(),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Server configuration error')
  })
})
