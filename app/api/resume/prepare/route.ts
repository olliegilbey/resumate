import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

/**
 * POST /api/resume/prepare
 *
 * Prepares resume generation by:
 * 1. Rate limiting (5 requests per hour per IP)
 * 2. Verifying Cloudflare Turnstile token
 * 3. Loading resume data from server-side cache
 * 4. Returning data + generation token
 *
 * Rate limit: 5 requests per hour per IP
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit first (before any processing)
    const clientIP = getClientIP(request)
    const rateLimit = checkRateLimit(clientIP, {
      limit: 5,
      window: 60 * 60 * 1000, // 1 hour in milliseconds
    })

    // Add rate limit headers
    const headers = new Headers()
    headers.set('X-RateLimit-Limit', rateLimit.limit.toString())
    headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString())
    headers.set('X-RateLimit-Reset', new Date(rateLimit.reset).toISOString())

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Maximum 5 requests per hour. Please try again later.',
          resetAt: rateLimit.reset,
        },
        { status: 429, headers }
      )
    }

    // Parse request body
    const body = await request.json()
    const { turnstileToken } = body

    if (!turnstileToken) {
      return NextResponse.json(
        { error: 'Missing Turnstile token' },
        { status: 400 }
      )
    }

    // Verify Turnstile token
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

    // Load resume data from server-side (built into .next during build)
    // This keeps the data secure and validates structure
    const resumeData = await loadResumeData()

    if (!resumeData) {
      return NextResponse.json(
        { error: 'Resume data not available' },
        { status: 500 }
      )
    }

    // Generate one-time token for this session
    const generationToken = generateToken()

    // Return resume data + token (with rate limit headers)
    return NextResponse.json(
      {
        success: true,
        data: resumeData,
        token: generationToken,
        timestamp: Date.now(),
      },
      { headers }
    )
  } catch (error) {
    console.error('Error in /api/resume/prepare:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Load resume data from build cache
 * Data is loaded during build via prebuild script
 */
async function loadResumeData() {
  try {
    // Import from data directory (gitignored but available at build time)
    const data = await import('@/data/resume-data.json')
    return data.default || data
  } catch (error) {
    console.error('Failed to load resume data:', error)
    return null
  }
}

/**
 * Generate a one-time token for resume generation
 * Format: timestamp-random
 */
function generateToken(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${random}`
}
