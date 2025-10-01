import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiting (for development/small sites)
// For production with multiple instances, consider Redis or similar
const rateLimit = new Map<string, { count: number; resetTime: number }>()

// Bot detection patterns
const BOT_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /scrape/i,
  /scan/i,
  /curl/i,
  /wget/i,
  /python/i,
  /java(?!script)/i, // Match "java" but not "javascript"
  /go-http-client/i,
  /httpclient/i,
  /axios/i, // Often used by scrapers
]

// Legitimate bots we want to allow (SEO, etc.)
const ALLOWED_BOTS = [
  /googlebot/i,
  /bingbot/i,
  /slackbot/i,
  /twitterbot/i,
  /facebookexternalhit/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegram/i,
]

function isBot(userAgent: string): boolean {
  // Check if it's an allowed bot first
  if (ALLOWED_BOTS.some(pattern => pattern.test(userAgent))) {
    return false
  }
  
  // Check if it matches bot patterns
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent))
}

function checkRateLimit(ip: string, maxRequests: number = 30, windowMs: number = 60000): boolean {
  const now = Date.now()
  const record = rateLimit.get(ip)

  // Clean up old entries periodically
  if (rateLimit.size > 10000) {
    const cutoff = now - windowMs * 2
    for (const [key, value] of rateLimit.entries()) {
      if (value.resetTime < cutoff) {
        rateLimit.delete(key)
      }
    }
  }

  if (!record || now > record.resetTime) {
    // New window
    rateLimit.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    // Rate limit exceeded
    return false
  }

  // Increment count
  // NOTE: This has a check-then-act race condition in concurrent Edge Runtime
  // For production with multiple instances, use Redis with atomic INCR/EXPIRE
  record.count++
  return true
}

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || ''

  // Get IP from headers (Next.js doesn't expose request.ip in all environments)
  // SECURITY NOTE: x-forwarded-for and x-real-ip headers can be spoofed by clients.
  // Ensure your deployment platform (Vercel, Cloudflare, etc.) strips client-provided
  // proxy headers and only trusts headers set by your infrastructure.
  // On Vercel: x-forwarded-for is automatically sanitized by their edge network.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
            request.headers.get('x-real-ip')

  // For production: reject requests without IP headers to prevent 'unknown' bucket abuse
  // Currently allowing 'unknown' for development/testing with higher monitoring
  if (!ip) {
    console.warn('Request received without IP headers - falling back to unknown bucket')
  }
  const ipAddress = ip || 'unknown'

  // 1. Bot detection
  if (isBot(userAgent)) {
    console.log(`Potential bot detected: ${userAgent} from ${ipAddress}`)

    // Return a 403 for obvious bots (but allow crawling of static content)
    if (request.nextUrl.pathname.startsWith('/api') ||
        request.nextUrl.pathname.includes('/resume/view')) {
      return new NextResponse('Forbidden', {
        status: 403,
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
        }
      })
    }
  }

  // 2. Rate limiting - apply to all requests from same IP
  const maxRequests = /googlebot/i.test(userAgent) ? 100 : 30 // Be generous with Google (case-insensitive)
  if (!checkRateLimit(ipAddress, maxRequests, 60000)) {
    console.log(`Rate limit exceeded for ${ipAddress}`)
    return new NextResponse('Too Many Requests', { 
      status: 429,
      headers: {
        'Retry-After': '60',
      }
    })
  }

  // 3. Add security headers
  const response = NextResponse.next()
  
  // Prevent embedding in iframes (clickjacking protection)
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Content Security Policy (X-XSS-Protection is deprecated)
  // Note: This is a permissive CSP suitable for Next.js with Turbopack and Cloudflare Turnstile
  // For production, consider tightening these directives and using nonces
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://challenges.cloudflare.com; " +
    "frame-src https://challenges.cloudflare.com;"
  )

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$).*)',
  ],
}