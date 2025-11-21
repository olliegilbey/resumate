import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import type { ResumeData, Company, Position, Bullet, RoleProfile } from '@/types/resume'
import { captureEvent } from '@/lib/posthog-server'

/**
 * POST /api/resume/select
 *
 * Selects bullets for a specific role profile using the bullet selection algorithm.
 *
 * Request body:
 * - roleProfileId: string (e.g., "developer-relations-lead")
 * - turnstileToken: string
 * - config?: { maxBullets?: number, maxPerCompany?: number, maxPerPosition?: number }
 *
 * Returns:
 * - selected bullets with scores
 * - company/position metadata
 *
 * Rate limit: 10 requests per hour per IP
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { roleProfileId, turnstileToken, config, email, linkedin, sessionId } = body

    if (!roleProfileId || !turnstileToken) {
      return NextResponse.json(
        { error: 'Missing required fields: roleProfileId, turnstileToken' },
        { status: 400 }
      )
    }

    // Check if in development mode (skip rate limit and Turnstile in dev)
    const isDevelopment = process.env.NODE_ENV === 'development'

    // Prepare response headers
    const headers = new Headers()

    // Rate limit check (skip in development)
    if (!isDevelopment) {
      const clientIP = getClientIP(request)
      const rateLimit = checkRateLimit(clientIP, {
        limit: 10,
        window: 60 * 60 * 1000, // 1 hour
      })

      headers.set('X-RateLimit-Limit', rateLimit.limit.toString())
      headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString())
      headers.set('X-RateLimit-Reset', new Date(rateLimit.reset).toISOString())

      if (!rateLimit.success) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: 'Maximum 10 requests per hour. Please try again later.',
            resetAt: rateLimit.reset,
          },
          { status: 429, headers }
        )
      }
    }

    // Verify Turnstile token (skip in development mode)

    if (!isDevelopment) {
      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
      if (!turnstileSecret) {
        console.error('TURNSTILE_SECRET_KEY not configured')
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        )
      }

      const turnstileResponse = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            secret: turnstileSecret,
            response: turnstileToken,
          }),
        }
      )

      const turnstileData = await turnstileResponse.json()

      if (!turnstileData.success) {
        return NextResponse.json(
          { error: 'Turnstile verification failed' },
          { status: 403 }
        )
      }
    } else {
      console.log(
        '⚠️  Development mode: Skipping Turnstile verification'
      )
    }

    // Load resume data
    const resumeData = await loadResumeData()
    if (!resumeData) {
      return NextResponse.json(
        { error: 'Resume data not available' },
        { status: 500 }
      )
    }

    // Find role profile
    const roleProfile = resumeData.roleProfiles?.find(
      (p) => p.id === roleProfileId
    )

    if (!roleProfile) {
      return NextResponse.json(
        { error: `Role profile not found: ${roleProfileId}` },
        { status: 404 }
      )
    }

    // Run bullet selection algorithm (TypeScript version until WASM is ready)
    const selectionConfig = {
      maxBullets: config?.maxBullets ?? 28,  // Ceiling - may select fewer based on content
      maxPerCompany: config?.maxPerCompany ?? 6,
      maxPerPosition: config?.maxPerPosition ?? 4,
    }

    const startTime = Date.now()
    const selected = selectBullets(resumeData, roleProfile, selectionConfig)
    const selectionDuration = Date.now() - startTime

    // Track resume_prepared event with contact info
    const clientIP = getClientIP(request)
    const bulletIds = selected.map(s => s.bullet.id)
    const bulletsByCompany: Record<string, number> = {}
    const bulletsByTag: Record<string, number> = {}

    for (const item of selected) {
      bulletsByCompany[item.companyId] = (bulletsByCompany[item.companyId] || 0) + 1
      for (const tag of item.bullet.tags || []) {
        bulletsByTag[tag] = (bulletsByTag[tag] || 0) + 1
      }
    }

    await captureEvent(sessionId || clientIP, 'resume_prepared', {
      sessionId,
      email,
      linkedin,
      roleProfileId: roleProfile.id,
      roleProfileName: roleProfile.name,
      bulletIds,
      bulletCount: selected.length,
      bulletsByCompany,
      bulletsByTag,
      config: selectionConfig,
      selectionDuration,
      clientIP,
    })

    // Return results
    return NextResponse.json(
      {
        success: true,
        roleProfile: {
          id: roleProfile.id,
          name: roleProfile.name,
          description: roleProfile.description,
        },
        config: selectionConfig,
        selected,
        count: selected.length,
        timestamp: Date.now(),
      },
      { headers }
    )
  } catch (error) {
    console.error('Error in /api/resume/select:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Load resume data from build cache
 */
async function loadResumeData(): Promise<ResumeData | null> {
  try {
    const data = await import('@/data/resume-data.json')
    return (data.default || data) as unknown as ResumeData
  } catch (error) {
    console.error('Failed to load resume data:', error)
    return null
  }
}

interface SelectionConfig {
  maxBullets: number
  maxPerCompany?: number
  maxPerPosition?: number
}

interface ScoredBullet {
  bullet: Bullet | { id: string; description: string; tags: string[]; priority: number }
  score: number
  companyId: string
  companyName: string | null | undefined
  companyDescription: string | null | undefined
  companyLink: string | null | undefined
  companyDateStart: string
  companyDateEnd: string | null | undefined
  companyLocation: string | null | undefined
  positionId: string
  positionName: string
  positionDescription: string | null | undefined
  positionDateStart: string
  positionDateEnd: string | null | undefined
}

/**
 * TypeScript implementation of bullet selection algorithm
 * This will be replaced with WASM in Phase 5.4+
 */
function selectBullets(resumeData: ResumeData, roleProfile: RoleProfile, config: SelectionConfig): ScoredBullet[] {
  const allBullets: ScoredBullet[] = []

  // Collect all bullets with scores
  for (const company of resumeData.experience) {
    for (const position of company.children) {
      // Score position description as bullet (if it exists)
      if (position.description) {
        const descBullet = {
          id: `${position.id}-description`,
          description: position.description,
          tags: position.tags || [],
          priority: position.priority || 5,
        }

        const descScore = scoreBullet(
          descBullet,
          position,
          company,
          roleProfile
        )

        allBullets.push({
          bullet: descBullet,
          score: descScore,
          companyId: company.id,
          companyName: company.name,
          companyDescription: company.description,
          companyLink: company.link,
          companyDateStart: company.dateStart,
          companyDateEnd: company.dateEnd,
          companyLocation: company.location,
          positionId: position.id,
          positionName: position.name,
          positionDescription: position.description,
          positionDateStart: position.dateStart,
          positionDateEnd: position.dateEnd,
        })
      }

      // Score regular bullets
      for (const bullet of position.children) {
        const score = scoreBullet(bullet, position, company, roleProfile)

        allBullets.push({
          bullet,
          score,
          companyId: company.id,
          companyName: company.name,
          companyDescription: company.description,
          companyLink: company.link,
          companyDateStart: company.dateStart,
          companyDateEnd: company.dateEnd,
          companyLocation: company.location,
          positionId: position.id,
          positionName: position.name,
          positionDescription: position.description,
          positionDateStart: position.dateStart,
          positionDateEnd: position.dateEnd,
        })
      }
    }
  }

  // Sort by score descending
  allBullets.sort((a, b) => b.score - a.score)

  // Apply diversity constraints
  return applyDiversityConstraints(allBullets, config)
}

/**
 * Score a single bullet
 */
function scoreBullet(
  bullet: Bullet | { id: string; description: string; tags: string[]; priority: number },
  position: Position,
  company: Company,
  roleProfile: RoleProfile
): number {
  const weights = roleProfile.scoringWeights

  // Tag relevance score
  const tagScore = calculateTagRelevance(bullet.tags, roleProfile.tagWeights)

  // Priority score (normalized 0-1)
  const priorityScore = bullet.priority / 10.0

  // Base score
  const baseScore =
    tagScore * weights.tagRelevance + priorityScore * weights.priority

  // Hierarchical multipliers
  const companyMultiplier = calculateCompanyMultiplier(company)
  const positionMultiplier = calculatePositionMultiplier(
    position,
    roleProfile.tagWeights
  )

  return baseScore * companyMultiplier * positionMultiplier
}

/**
 * Calculate tag relevance
 */
function calculateTagRelevance(
  bulletTags: string[],
  tagWeights: Record<string, number>
): number {
  if (!bulletTags || bulletTags.length === 0 || !tagWeights) {
    return 0.0
  }

  let totalWeight = 0.0
  let matchedTags = 0

  for (const tag of bulletTags) {
    if (tag in tagWeights) {
      totalWeight += tagWeights[tag]
      matchedTags++
    }
  }

  if (matchedTags === 0) {
    return 0.0
  }

  return totalWeight / matchedTags
}

/**
 * Calculate company multiplier
 */
function calculateCompanyMultiplier(company: Company): number {
  if (company.priority) {
    // Map 1-10 to 0.8-1.2
    return 0.8 + (company.priority / 10.0) * 0.4
  }
  return 1.0
}

/**
 * Calculate position multiplier
 */
function calculatePositionMultiplier(
  position: Position,
  tagWeights: Record<string, number>
): number {
  // Priority multiplier
  const priorityMultiplier =
    0.8 + (position.priority / 10.0) * 0.4

  // Tag relevance multiplier
  let tagMultiplier = 1.0
  if (position.tags && position.tags.length > 0) {
    const tagScore = calculateTagRelevance(position.tags, tagWeights)
    tagMultiplier = 0.9 + tagScore * 0.2 // 0.9-1.1 range
  }

  return priorityMultiplier * tagMultiplier
}

/**
 * Apply diversity constraints
 */
function applyDiversityConstraints(sortedBullets: ScoredBullet[], config: SelectionConfig): ScoredBullet[] {
  const selected = []
  const companyCounts: Record<string, number> = {}
  const positionCounts: Record<string, number> = {}

  for (const bullet of sortedBullets) {
    // Check total limit
    if (selected.length >= config.maxBullets) {
      break
    }

    // Check per-company limit
    if (config.maxPerCompany) {
      const companyCount = companyCounts[bullet.companyId] || 0
      if (companyCount >= config.maxPerCompany) {
        continue
      }
    }

    // Check per-position limit
    if (config.maxPerPosition) {
      const positionCount = positionCounts[bullet.positionId] || 0
      if (positionCount >= config.maxPerPosition) {
        continue
      }
    }

    // Add bullet and increment counters
    companyCounts[bullet.companyId] =
      (companyCounts[bullet.companyId] || 0) + 1
    positionCounts[bullet.positionId] =
      (positionCounts[bullet.positionId] || 0) + 1
    selected.push(bullet)
  }

  return selected
}
