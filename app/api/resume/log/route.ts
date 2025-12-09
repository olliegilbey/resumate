import { NextRequest, NextResponse } from 'next/server'
import { captureEvent, flushEvents } from '@/lib/posthog-server'
import { getClientIP, checkRateLimit } from '@/lib/rate-limit'
import { ANALYTICS_EVENTS, type GenerationMethod, type DownloadType } from '@/lib/analytics/events'
import type { DownloadErrorCode, ErrorCategory, ErrorStage } from '@/lib/analytics/errors'

/**
 * POST /api/resume/log
 *
 * Server-side event logging endpoint for PDF generation events.
 * Captures resume_generated, resume_failed, resume_download_notified events.
 * Triggers n8n webhook for download notifications.
 *
 * Note: resume_download_notified (server) differs from resume_downloaded (client).
 * Server events are for n8n/notifications, client events have accurate GeoIP.
 *
 * Rate limit: 30 requests/hour per IP
 */

const ALLOWED_EVENTS = [
  ANALYTICS_EVENTS.RESUME_GENERATED,
  ANALYTICS_EVENTS.RESUME_FAILED,
  ANALYTICS_EVENTS.RESUME_DOWNLOAD_NOTIFIED,
]
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      event,
      // Core fields (snake_case)
      session_id,
      generation_method,
      download_type,
      // Contact info
      email,
      linkedin,
      // Heuristic mode fields
      role_profile_id,
      role_profile_name,
      // AI mode fields
      ai_provider,
      job_title,
      extracted_salary_min,
      extracted_salary_max,
      salary_currency,
      reasoning,
      // Common fields
      bullet_count,
      bullets,
      pdf_size,
      filename,
      // Timing fields
      wasm_load_ms,
      generation_ms,
      total_duration_ms,
      wasm_cached,
      // Error fields (unified format)
      error_code,
      error_category,
      error_stage,
      error_message,
      error_detail,
      error_stack,
      is_retryable,
      // Legacy camelCase support (will be deprecated)
      sessionId: legacySessionId,
      roleProfileId: legacyRoleProfileId,
      roleProfileName: legacyRoleProfileName,
      bulletCount: legacyBulletCount,
      pdfSize: legacyPdfSize,
      wasmLoadDuration: legacyWasmLoadDuration,
      generationDuration: legacyGenerationDuration,
      totalDuration: legacyTotalDuration,
      wasmCached: legacyWasmCached,
      errorMessage: legacyErrorMessage,
      errorStage: legacyErrorStage,
      errorStack: legacyErrorStack,
    } = body

    // Support both snake_case and legacy camelCase (prefer snake_case)
    const _session_id = session_id || legacySessionId
    const _role_profile_id = role_profile_id || legacyRoleProfileId
    const _role_profile_name = role_profile_name || legacyRoleProfileName
    const _bullet_count = bullet_count ?? legacyBulletCount
    const _pdf_size = pdf_size ?? legacyPdfSize
    const _wasm_load_ms = wasm_load_ms ?? legacyWasmLoadDuration
    const _generation_ms = generation_ms ?? legacyGenerationDuration
    const _total_duration_ms = total_duration_ms ?? legacyTotalDuration
    const _wasm_cached = wasm_cached ?? legacyWasmCached
    const _error_message = error_message ?? legacyErrorMessage
    const _error_stage = error_stage ?? legacyErrorStage
    const _error_stack = error_stack ?? legacyErrorStack

    // Validate required fields
    if (!event || !_session_id) {
      return NextResponse.json(
        { error: 'Missing required fields: event, session_id' },
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

    // Validate session_id format (UUIDv4)
    if (!UUID_REGEX.test(_session_id)) {
      return NextResponse.json(
        { error: 'Invalid session_id format' },
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

    // Build event properties (snake_case per spec)
    const eventProperties: Record<string, unknown> = {
      session_id: _session_id,
      generation_method: generation_method || 'heuristic',
      download_type: download_type || (generation_method === 'ai' ? 'resume_ai' : 'resume_heuristic'),
      client_ip: clientIP,
      // Contact info
      email,
      linkedin,
      // Heuristic mode
      role_profile_id: _role_profile_id,
      role_profile_name: _role_profile_name,
      // AI mode
      ai_provider,
      job_title,
      extracted_salary_min,
      extracted_salary_max,
      salary_currency,
      reasoning,
    }

    if (event === ANALYTICS_EVENTS.RESUME_DOWNLOAD_NOTIFIED) {
      eventProperties.bullet_count = _bullet_count
      eventProperties.bullets = bullets // Full bullet content for analysis
      eventProperties.pdf_size = _pdf_size
      eventProperties.filename = filename

      // Trigger n8n webhook for download notification
      triggerN8nWebhook({
        event: ANALYTICS_EVENTS.RESUME_DOWNLOAD_NOTIFIED,
        session_id: _session_id,
        generation_method: generation_method || 'heuristic',
        download_type: download_type || (generation_method === 'ai' ? 'resume_ai' : 'resume_heuristic'),
        email,
        linkedin,
        role_profile_id: _role_profile_id,
        role_profile_name: _role_profile_name,
        ai_provider,
        job_title,
        extracted_salary_min,
        extracted_salary_max,
        salary_currency,
        bullet_count: _bullet_count,
        bullets,
        pdf_size: _pdf_size,
        client_ip: clientIP,
        timestamp: new Date().toISOString(),
      }).catch(err => console.error('Failed to trigger n8n webhook:', err))

    } else if (event === ANALYTICS_EVENTS.RESUME_GENERATED) {
      eventProperties.bullet_count = _bullet_count
      eventProperties.pdf_size = _pdf_size
      eventProperties.wasm_load_ms = _wasm_load_ms
      eventProperties.generation_ms = _generation_ms
      eventProperties.total_duration_ms = _total_duration_ms
      eventProperties.wasm_cached = _wasm_cached

    } else if (event === ANALYTICS_EVENTS.RESUME_FAILED) {
      // Unified error fields
      eventProperties.error_code = error_code
      eventProperties.error_category = error_category
      eventProperties.error_stage = _error_stage
      eventProperties.error_message = _error_message
      eventProperties.error_detail = error_detail
      eventProperties.error_stack = process.env.NODE_ENV === 'development' ? _error_stack : undefined
      eventProperties.is_retryable = is_retryable
      eventProperties.bullet_count = _bullet_count

      // Trigger n8n webhook for failure (if serious)
      if (_error_stage === 'wasm_load' || _error_stage === 'pdf_generation') {
        triggerN8nWebhook({
          event: ANALYTICS_EVENTS.RESUME_FAILED,
          session_id: _session_id,
          generation_method: generation_method || 'heuristic',
          download_type: download_type || (generation_method === 'ai' ? 'resume_ai' : 'resume_heuristic'),
          email,
          linkedin,
          role_profile_id: _role_profile_id,
          role_profile_name: _role_profile_name,
          ai_provider,
          error_code,
          error_category,
          error_stage: _error_stage,
          error_message: _error_message,
          client_ip: clientIP,
          timestamp: new Date().toISOString(),
        }).catch(err => console.error('Failed to trigger n8n webhook:', err))
      }
    }

    await captureEvent(_session_id, event, eventProperties, clientIP)

    // Flush events before serverless function exits
    await flushEvents()

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
async function triggerN8nWebhook(payload: Record<string, unknown>): Promise<void> {
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
