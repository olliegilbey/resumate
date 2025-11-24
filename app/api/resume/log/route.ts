import { NextRequest, NextResponse } from 'next/server'
import { captureEvent } from '@/lib/posthog-server'
import { getClientIP, checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/resume/log
 *
 * Client-side event logging endpoint for PDF generation events.
 * Captures resume_generated, resume_failed, and resume_downloaded events.
 * Triggers n8n webhook for download notifications.
 *
 * Rate limit: 30 requests/hour per IP
 */

const ALLOWED_EVENTS = ['resume_generated', 'resume_failed', 'resume_downloaded']
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      event,
      sessionId,
      roleProfileId,
      roleProfileName,
      email,
      linkedin,
      bulletCount,
      bullets,
      pdfSize,
      filename,
      errorMessage,
      errorStage,
      errorStack,
      wasmLoadDuration,
      generationDuration,
      totalDuration,
      wasmCached,
    } = body

    // Validate required fields
    if (!event || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: event, sessionId' },
        { status: 400 }
      )
    }

    // Validate event type
    if (!ALLOWED_EVENTS.includes(event)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      )
    }

    // Validate sessionId format (UUIDv4)
    if (!UUID_REGEX.test(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid sessionId format' },
        { status: 400 }
      )
    }

    const clientIP = getClientIP(request)

    // Rate limiting: 30 requests/hour per IP (allows ~1 PDF every 2 mins)
    const rateLimit = checkRateLimit(clientIP, {
      limit: 30,
      window: 60 * 60 * 1000, // 1 hour
    })

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.reset).toISOString(),
          }
        }
      )
    }

    // Capture event to PostHog
    const eventProperties: Record<string, any> = {
      sessionId,
      roleProfileId,
      roleProfileName,
      email,
      linkedin,
      clientIP,
    }

    if (event === 'resume_downloaded') {
      eventProperties.bulletCount = bulletCount
      eventProperties.bullets = bullets // Full bullet content for analysis
      eventProperties.pdfSize = pdfSize
      eventProperties.filename = filename

      // Trigger n8n webhook for download notification
      triggerN8nWebhook({
        event: 'resume_downloaded',
        sessionId,
        email,
        linkedin,
        roleProfileId,
        roleProfileName,
        bulletCount,
        bullets,
        pdfSize,
        clientIP,
        timestamp: new Date().toISOString(),
      }).catch(err => console.error('Failed to trigger n8n webhook:', err))

    } else if (event === 'resume_generated') {
      eventProperties.bulletCount = bulletCount
      eventProperties.pdfSize = pdfSize
      eventProperties.wasmLoadDuration = wasmLoadDuration
      eventProperties.generationDuration = generationDuration
      eventProperties.totalDuration = totalDuration
      eventProperties.wasmCached = wasmCached

    } else if (event === 'resume_failed') {
      eventProperties.errorMessage = errorMessage
      eventProperties.errorStage = errorStage
      eventProperties.errorStack = process.env.NODE_ENV === 'development' ? errorStack : undefined
      eventProperties.bulletCount = bulletCount

      // Trigger n8n webhook for failure (if serious)
      if (errorStage === 'wasm_load' || errorStage === 'pdf_generation') {
        triggerN8nWebhook({
          event: 'resume_failed',
          sessionId,
          email,
          linkedin,
          roleProfileId,
          roleProfileName,
          errorMessage,
          errorStage,
          clientIP,
          timestamp: new Date().toISOString(),
        }).catch(err => console.error('Failed to trigger n8n webhook:', err))
      }
    }

    await captureEvent(sessionId, event, eventProperties, clientIP)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in /api/resume/log:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Trigger n8n webhook (async, non-blocking)
 */
async function triggerN8nWebhook(payload: Record<string, any>): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL
  const webhookAuth = process.env.N8N_WEBHOOK_SECRET

  if (!webhookUrl || !webhookAuth) {
    console.log('[n8n] Webhook not configured, skipping notification')
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${webhookAuth}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
    }

    console.log(`[n8n] Webhook triggered successfully: ${payload.event}`)
  } catch (error) {
    console.error('[n8n] Webhook error:', error)
    throw error
  }
}
