/**
 * POST /api/resume/ai-select
 *
 * AI-powered bullet selection from job description.
 * Uses LLM to analyze job description and select relevant bullets.
 *
 * Rate limit: 5 requests per hour per IP (stricter due to AI costs)
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { selectBulletsWithAI, FALLBACK_ORDER } from '@/lib/ai/providers'
import type { AIProvider } from '@/lib/ai/providers/types'
import { AISelectionError } from '@/lib/ai/errors'
import { captureEvent, flushEvents } from '@/lib/posthog-server'
import type { ResumeData, Company, Position, Bullet } from '@/types/resume'

// In-memory token replay prevention (per function instance)
const usedTokens = new Set<string>()

// Rate limit config: 5 requests per hour (stricter for AI)
const AI_RATE_LIMIT = {
  limit: 5,
  window: 60 * 60 * 1000, // 1 hour
}

// Selection config defaults
const DEFAULT_CONFIG = {
  maxBullets: 28,
  maxPerCompany: 6,
  maxPerPosition: 4,
}

// Minimum job description length
const MIN_JOB_DESCRIPTION_LENGTH = 50

/**
 * Selected bullet with full context
 */
interface SelectedBullet {
  bullet: Bullet
  companyId: string
  companyName: string | null | undefined
  companyDateStart: string
  companyDateEnd: string | null | undefined
  companyLocation: string | null | undefined
  positionId: string
  positionName: string
  positionDateStart: string
  positionDateEnd: string | null | undefined
}

export async function POST(request: NextRequest) {
  const headers = new Headers()
  const clientIP = getClientIP(request)

  try {
    // Parse request body
    const body = await request.json()
    const {
      jobDescription,
      turnstileToken,
      provider = FALLBACK_ORDER[0], // Default to first in fallback order
      config,
      email,
      linkedin,
      sessionId,
    } = body

    // Validate required fields
    if (!jobDescription || !turnstileToken) {
      return NextResponse.json(
        { error: 'Missing required fields: jobDescription, turnstileToken' },
        { status: 400 }
      )
    }

    // Validate job description length
    if (jobDescription.length < MIN_JOB_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        {
          error: `Job description too short (minimum ${MIN_JOB_DESCRIPTION_LENGTH} characters)`,
          received: jobDescription.length,
        },
        { status: 400 }
      )
    }

    // Validate provider
    const validProviders: AIProvider[] = [
      'cerebras-gpt',
      'cerebras-llama',
      'claude-sonnet',
      'claude-haiku',
    ]
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    // Rate limit check
    const rateLimit = checkRateLimit(clientIP, AI_RATE_LIMIT)

    headers.set('X-RateLimit-Limit', rateLimit.limit.toString())
    headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString())
    headers.set('X-RateLimit-Reset', new Date(rateLimit.reset).toISOString())

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum 5 AI requests per hour. Please try again later.',
          resetAt: rateLimit.reset,
        },
        { status: 429, headers }
      )
    }

    // Token replay check
    if (usedTokens.has(turnstileToken)) {
      console.warn('[AI Select] Duplicate Turnstile token blocked')
      return NextResponse.json({ error: 'Token already used' }, { status: 403 })
    }

    // Turnstile verification
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
    if (!turnstileSecret) {
      console.error('[AI Select] TURNSTILE_SECRET_KEY not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const turnstileResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: turnstileToken,
        }),
      }
    )

    const turnstileData = await turnstileResponse.json()
    if (!turnstileData.success) {
      return NextResponse.json({ error: 'Turnstile verification failed' }, { status: 403 })
    }

    // Mark token as used
    usedTokens.add(turnstileToken)

    // Load resume data
    const resumeData = await loadResumeData()
    if (!resumeData) {
      return NextResponse.json({ error: 'Resume data not available' }, { status: 500 })
    }

    // Selection config with defaults
    const selectionConfig = {
      maxBullets: config?.maxBullets ?? DEFAULT_CONFIG.maxBullets,
      maxPerCompany: config?.maxPerCompany ?? DEFAULT_CONFIG.maxPerCompany,
      maxPerPosition: config?.maxPerPosition ?? DEFAULT_CONFIG.maxPerPosition,
    }

    // Call AI provider with retry + fallback
    const startTime = Date.now()
    const result = await selectBulletsWithAI(
      {
        jobDescription,
        compendium: resumeData,
        ...selectionConfig,
      },
      provider as AIProvider
    )
    const aiDuration = Date.now() - startTime

    // Look up full bullet data from IDs
    const selected = lookupBullets(resumeData, result.bulletIds)

    // Build analytics data
    const bulletsByCompany: Record<string, number> = {}
    const bulletsByTag: Record<string, number> = {}

    for (const item of selected) {
      bulletsByCompany[item.companyId] = (bulletsByCompany[item.companyId] || 0) + 1
      for (const tag of item.bullet.tags || []) {
        bulletsByTag[tag] = (bulletsByTag[tag] || 0) + 1
      }
    }

    // Track resume_ai_prepared event
    await captureEvent(
      sessionId || clientIP,
      'resume_ai_prepared',
      {
        sessionId,
        email,
        linkedin,
        generation_method: 'ai',
        ai_provider: result.provider,
        job_description: jobDescription, // Full JD for n8n
        job_description_length: jobDescription.length,
        job_title: result.jobTitle,
        extracted_salary_min: result.salary?.min,
        extracted_salary_max: result.salary?.max,
        salary_currency: result.salary?.currency,
        salary_period: result.salary?.period,
        bulletIds: result.bulletIds,
        bulletCount: selected.length,
        bulletsByCompany,
        bulletsByTag,
        config: selectionConfig,
        ai_response_ms: aiDuration,
        tokens_used: result.tokensUsed,
        reasoning: result.reasoning,
        clientIP,
      },
      clientIP
    )

    await flushEvents()

    return NextResponse.json(
      {
        success: true,
        selected,
        count: selected.length,
        reasoning: result.reasoning,
        jobTitle: result.jobTitle,
        salary: result.salary,
        metadata: {
          provider: result.provider,
          tokensUsed: result.tokensUsed,
          duration: aiDuration,
        },
        config: selectionConfig,
        timestamp: Date.now(),
      },
      { headers }
    )
  } catch (error) {
    console.error('[AI Select] Error:', error)

    // Handle AI-specific errors with user-friendly message
    if (error instanceof AISelectionError) {
      return NextResponse.json(
        {
          error: 'AI selection failed',
          userMessage: error.getSimplifiedMessage(),
          provider: error.provider,
          retriesAttempted: error.retriesAttempted,
        },
        { status: 500, headers }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
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
    console.error('[AI Select] Failed to load resume data:', error)
    return null
  }
}

/**
 * Look up full bullet data from IDs
 * Returns bullets with company/position context
 */
function lookupBullets(resumeData: ResumeData, bulletIds: string[]): SelectedBullet[] {
  const bulletMap = new Map<string, SelectedBullet>()

  // Build map of all bullets with context
  for (const company of resumeData.experience) {
    for (const position of company.children) {
      for (const bullet of position.children) {
        bulletMap.set(bullet.id, {
          bullet,
          companyId: company.id,
          companyName: company.name,
          companyDateStart: company.dateStart,
          companyDateEnd: company.dateEnd,
          companyLocation: company.location,
          positionId: position.id,
          positionName: position.name,
          positionDateStart: position.dateStart,
          positionDateEnd: position.dateEnd,
        })
      }
    }
  }

  // Return bullets in the order specified by AI (relevance order)
  return bulletIds
    .map((id) => bulletMap.get(id))
    .filter((b): b is SelectedBullet => b !== undefined)
}
