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

  // Get IP from trusted sources only (prevents header spoofing)
  // Priority: x-vercel-forwarded-for (Vercel-set) > x-real-ip
  // NEVER trust x-forwarded-for directly as clients can spoof it
  const trustedIp =
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip')?.split(',')[0].trim()

  // In dev without proxy headers, use fallback (in production, Vercel always sets headers)
  const ipAddress = trustedIp || 'dev-local'

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

  // Content Security Policy with 'unsafe-inline' for theme script
  // NOTE: The theme initialization script MUST run before React hydration to prevent
  // flash of unstyled content. Next.js Script component doesn't support this timing.
  // Alternative approaches attempted but failed:
  // 1. External script with Script component - doesn't execute before hydration
  // 2. Script hash - would break on any code change
  // This is a calculated tradeoff: XSS risk from inline script vs FOUC user experience
  // 'wasm-unsafe-eval' is required for WebAssembly.instantiateStreaming() (PDF generation)
  const isDev = process.env.NODE_ENV !== 'production'
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://va.vercel-scripts.com"
    : "'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://va.vercel-scripts.com"

  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    `script-src ${scriptSrc}; ` +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://challenges.cloudflare.com https://vitals.vercel-insights.com; " +
    "frame-src https://challenges.cloudflare.com; " +
    "worker-src 'self' blob:; " +
    "child-src https://challenges.cloudflare.com;"
  )

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Strict-Transport-Security (HSTS) - force HTTPS for 1 year
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  // Permissions-Policy - restrict browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()'
  )

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
     * - public files (images, scripts, and WASM modules)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.js$|.*\\.wasm$).*)',
  ],
}
