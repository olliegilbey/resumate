import { NextRequest, NextResponse } from 'next/server'
import { generateVCard } from '@/lib/vcard'
import resumeData from '@/data/resume-data.json'

/**
 * Server-side vCard generation with Turnstile protection
 * Phone and email NEVER sent to client - only in this API response
 * Sensitive data stored in environment variables (.env.local)
 */

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
}

// In-memory store for used tokens (prevents replay attacks)
// TODO: In production with multiple instances, use Redis or similar distributed store
const usedTokens = new Set<string>()
const TOKEN_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

// Clean up expired tokens periodically
setInterval(() => {
  if (usedTokens.size > 1000) {
    usedTokens.clear() // Simple cleanup - in production use timestamps
  }
}, TOKEN_EXPIRY_MS)

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
 * Shared function to generate and return vCard after token verification
 */
async function generateContactCardResponse(token: string): Promise<NextResponse> {
  // Check if token was already used (replay attack prevention)
  if (usedTokens.has(token)) {
    console.warn('Token replay attack detected:', token.substring(0, 20) + '...')
    return new NextResponse('Token already used', { status: 403 })
  }

  // Verify Turnstile token with Cloudflare
  const isValid = await verifyTurnstileToken(token)

  if (!isValid) {
    return new NextResponse('Verification failed', { status: 403 })
  }

  // Mark token as used (one-time use only)
  usedTokens.add(token)

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
  const nameParts = resumeData.personal.fullName.trim().split(/\s+/).filter(Boolean)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

  // Generate vCard content on server
  const vcardContent = generateVCard({
    firstName,
    lastName,
    fullName: resumeData.personal.fullName,
    nickname: resumeData.personal.nickname,
    email: emails, // Pass array of emails (personal first, then professional)
    phone,
    linkedin: resumeData.personal.linkedin,
    github: resumeData.personal.github,
    address: {
      city: resumeData.personal.location,
    },
    title: 'Developer Relations Lead',
    note: 'Developer Relations professional with expertise in blockchain technology, AI, and developer communities.',
  })

  // Return as downloadable file
  return new NextResponse(vcardContent, {
    headers: {
      'Content-Type': 'text/vcard;charset=utf-8',
      'Content-Disposition': `attachment; filename="${resumeData.personal.fullName.replace(/\s+/g, '-').toLowerCase()}-contact.vcf"`,
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

    return await generateContactCardResponse(token)
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

    return await generateContactCardResponse(token)
  } catch (error) {
    console.error('Contact card POST error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

// Disable static optimization for this route
export const dynamic = 'force-dynamic'
