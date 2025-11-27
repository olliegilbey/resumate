import { NextRequest, NextResponse } from 'next/server'
import { generateVCard } from '@/lib/vcard'
import type { ResumeData } from '@/types/resume'
import { captureEvent, flushEvents } from '@/lib/posthog-server'
import { getClientIP } from '@/lib/rate-limit'

/**
 * Server-side vCard generation with Turnstile protection
 * Phone and email NEVER sent to client - only in this API response
 * Sensitive data stored in environment variables (.env.local)
 */

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
}

// In-memory store for used tokens (prevents replay attacks within function instance lifetime)
// Note: In serverless, each function instance is stateless and short-lived
// The Set is garbage collected when the instance terminates, so no cleanup interval needed
// TODO: For production with multiple instances, use Redis or similar distributed store
const usedTokens = new Set<string>()

async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY

  if (!secretKey) {
    console.error('TURNSTILE_SECRET_KEY not configured')
    return false
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    })

    const data: TurnstileResponse = await response.json()
    return data.success
  } catch (error) {
    console.error('Turnstile verification error:', error)
    return false
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

/**
 * Shared function to generate and return vCard after token verification
 */
async function generateContactCardResponse(token: string, request: NextRequest): Promise<NextResponse> {
  // Check if token was already used (replay attack prevention)
  if (usedTokens.has(token)) {
    console.warn('Duplicate Turnstile token blocked')
    return new NextResponse('Token already used', { status: 403 })
  }

  // Verify Turnstile token with Cloudflare
  const isValid = await verifyTurnstileToken(token)

  if (!isValid) {
    return new NextResponse('Verification failed', { status: 403 })
  }

  // Mark token as used (one-time use only)
  usedTokens.add(token)

  // Load resume data
  const resumeData = await loadResumeData()
  if (!resumeData) {
    return new NextResponse('Resume data not available', { status: 500 })
  }

  // Get sensitive data from environment variables (never exposed to client)
  const emailPersonal = process.env.CONTACT_EMAIL_PERSONAL
  const emailProfessional = process.env.CONTACT_EMAIL_PROFESSIONAL
  const phone = process.env.CONTACT_PHONE

  // Require at least one email and phone
  if ((!emailPersonal && !emailProfessional) || !phone) {
    console.error('Contact information not configured in environment variables')
    return new NextResponse('Server configuration error', { status: 500 })
  }

  // Build email array (personal first if available, otherwise professional)
  const emails: string[] = []
  if (emailPersonal) {
    emails.push(emailPersonal)
    if (emailProfessional) {
      emails.push(emailProfessional)
    }
  } else if (emailProfessional) {
    emails.push(emailProfessional)
  }

  // Parse name (handle edge cases: single names, multiple spaces)
  const fullName = resumeData.personal.name || ''
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

  // Get most recent job title from first company's first position
  const mostRecentTitle = resumeData.experience[0]?.children[0]?.name || 'Professional'

  // Generate vCard content on server
  const vcardContent = generateVCard({
    firstName,
    lastName,
    fullName,
    nickname: resumeData.personal.nickname ?? undefined,
    email: emails, // Pass array of emails (personal first, then professional)
    phone,
    linkedin: resumeData.personal.linkedin ?? undefined,
    github: resumeData.personal.github ?? undefined,
    address: {
      city: resumeData.personal.location ?? undefined,
    },
    title: mostRecentTitle,
    note: resumeData.summary ?? undefined,
  })

  // Capture contact card served event (authoritative delivery confirmation + geoIP)
  // Distinct from client-side contact_card_downloaded which tracks timing/funnel
  // Uses "server:contact_card" as distinctId since we don't have client session
  // GeoIP still works via $ip property
  const clientIP = getClientIP(request)
  const filename = `${fullName.replace(/\s+/g, '-').toLowerCase()}-contact.vcf`

  await captureEvent(
    'server:contact_card',
    'contact_card_served',
    {
      filename,
      fullName,
      hasLinkedin: !!resumeData.personal.linkedin,
      hasGithub: !!resumeData.personal.github,
      hasLocation: !!resumeData.personal.location,
      emailCount: emails.length,
      clientIP,
      vcardSize: vcardContent.length,
    },
    clientIP // Pass IP for GeoIP lookup
  )

  // Flush events before serverless function exits
  await flushEvents()

  // Return as downloadable file
  return new NextResponse(vcardContent, {
    headers: {
      'Content-Type': 'text/vcard;charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

// GET route - for direct navigation downloads (works in all browsers including Arc)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return new NextResponse('Missing verification token', { status: 400 })
    }

    return await generateContactCardResponse(token, request)
  } catch (error) {
    console.error('Contact card GET error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

// POST route - for form submissions (deprecated in favor of GET, but kept for backwards compatibility)
export async function POST(request: NextRequest) {
  try {
    // Get Turnstile token from request (handle both JSON and form data)
    const contentType = request.headers.get('content-type') || ''
    let token: string | null = null

    if (contentType.includes('application/json')) {
      const body = await request.json()
      token = body.token
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      token = formData.get('token') as string | null
    } else {
      // Try to parse as form data
      const formData = await request.formData()
      token = formData.get('token') as string | null
    }

    if (!token) {
      return new NextResponse('Missing verification token', { status: 400 })
    }

    return await generateContactCardResponse(token, request)
  } catch (error) {
    console.error('Contact card POST error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

// Disable static optimization for this route
export const dynamic = 'force-dynamic'
