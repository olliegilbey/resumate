/**
 * POST /api/resume/ai-select
 *
 * AI-powered bullet selection from job description.
 * Uses LLM to score bullets, then applies diversity constraints server-side.
 *
 * Rate limit: 5 requests per hour per IP (stricter due to AI costs)
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { selectBulletsWithAI, FALLBACK_ORDER } from '@/lib/ai/providers'
import type { AIProvider } from '@/lib/ai/providers/types'
import { AISelectionError } from '@/lib/ai/errors'
import { captureEvent, flushEvents } from '@/lib/posthog-server'
import type { ResumeData } from '@/types/resume'
import {
  selectBulletsWithConstraints,
  reorderByCompanyChronology,
  DEFAULT_SELECTION_CONFIG,
  type SelectedBullet,
} from '@/lib/ai/selection'

// In-memory token replay prevention (per function instance)
const usedTokens = new Set<string>()

// Rate limit config: 5 requests per hour (stricter for AI)
const AI_RATE_LIMIT = {
  limit: 5,
  window: 60 * 60 * 1000, // 1 hour
}

// Minimum job description length
const MIN_JOB_DESCRIPTION_LENGTH = 50

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
        signal: AbortSignal.timeout(5000), // 5s timeout
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

    // Selection config with defaults (matches Rust SelectionConfig)
    const selectionConfig = {
      maxBullets: config?.maxBullets ?? DEFAULT_SELECTION_CONFIG.maxBullets,
      maxPerCompany: config?.maxPerCompany ?? DEFAULT_SELECTION_CONFIG.maxPerCompany,
      maxPerPosition: config?.maxPerPosition ?? DEFAULT_SELECTION_CONFIG.maxPerPosition,
      minPerCompany: config?.minPerCompany ?? DEFAULT_SELECTION_CONFIG.minPerCompany,
    }

    // Call AI provider with retry + fallback
    // AI scores many bullets, server applies diversity constraints
    const startTime = Date.now()
    const result = await selectBulletsWithAI(
      {
        jobDescription,
        compendium: resumeData,
        maxBullets: selectionConfig.maxBullets, // Passed to AI for context
      },
      provider as AIProvider
    )
    const aiDuration = Date.now() - startTime

    // Build score map from AI response
    const scoreMap = new Map<string, number>()
    for (const b of result.bullets) {
      scoreMap.set(b.id, b.score)
    }

    // Apply diversity constraints server-side (ported from Rust)
    const selectedRaw = selectBulletsWithConstraints(resumeData, scoreMap, selectionConfig)

    // Reorder to maintain company chronology (companies in resume order, bullets by score)
    const selected = reorderByCompanyChronology(selectedRaw, resumeData)

    // Build analytics data
    const bulletsByCompany: Record<string, number> = {}
    const bulletsByTag: Record<string, number> = {}
    const bulletIds: string[] = []

    for (const item of selected) {
      bulletIds.push(item.bullet.id)
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
        bulletIds,
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

// Selection logic moved to lib/ai/selection.ts
// Uses selectBulletsWithConstraints + reorderByCompanyChronology
