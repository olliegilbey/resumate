# Analytics & Notification Architecture

**Status:** ✅ Phase 1 & 2 Complete (OLL-69, OLL-70, OLL-71)
**Last Updated:** 2026-02-04

## Overview

Full-stack analytics system tracking resume and contact card download funnels with PostHog + N8N + ntfy.sh notifications.

**Implemented:**

- ✅ Client-side events: `resume_initiated`, `resume_verified`, `resume_compiled`, `resume_downloaded`, `resume_error`, `resume_cancelled`
- ✅ Server-side events: `resume_prepared`, `resume_generated`, `resume_download_notified`, `resume_failed`
- ✅ Contact card funnel: `contact_card_initiated` → `contact_card_verified` → `contact_card_downloaded` → `contact_card_served`
- ✅ Contact info collection (email, LinkedIn - optional)
- ✅ Session tracking via sessionStorage UUID
- ✅ Performance metrics (WASM load, generation, total duration)
- ✅ Error stage tracking (6 stages: turnstile, bullet_selection, ai_selection, wasm_load, pdf_generation, network)
- ✅ N8N webhook integration (live, sends ntfy.sh notifications)
- ✅ AI selection analytics (provider, job title, salary extraction)

---

## Event Schema

### Client-Side Events (PostHog Direct)

#### 1. `resume_initiated`

Captured when user clicks "Download PDF" button.

```typescript
{
  session_id: string
  generation_method: 'ai' | 'heuristic'
  download_type: 'resume_ai' | 'resume_heuristic'
  // Heuristic mode
  role_profile_id?: string
  role_profile_name?: string
  // AI mode
  ai_provider?: 'cerebras-gpt' | 'cerebras-llama' | 'claude-sonnet' | 'claude-haiku'
  job_title?: string
}
```

#### 2. `resume_verified`

Captured after Turnstile verification succeeds.

```typescript
{
  session_id: string
  generation_method: 'ai' | 'heuristic'
  turnstile_duration_ms: number
  // Contact info (user-provided, optional)
  email?: string
  linkedin?: string
}
```

#### 3. `resume_compiled`

Captured after WASM PDF generation completes (before download).

```typescript
{
  session_id: string;
  generation_method: "ai" | "heuristic";
  bullet_count: number;
  pdf_size: number;
  wasm_load_ms: number;
  generation_ms: number;
  total_duration_ms: number;
  wasm_cached: boolean;
}
```

#### 4. `resume_downloaded`

Captured when PDF download is triggered in browser.

```typescript
{
  session_id: string;
  generation_method: "ai" | "heuristic";
  download_type: "resume_ai" | "resume_heuristic";
  bullet_count: number;
  pdf_size: number;
  filename: string;
  total_duration_ms: number;
}
```

#### 5. `resume_error`

Captured on any failure during download flow.

```typescript
{
  session_id: string;
  generation_method: "ai" | "heuristic";
  error_code: DownloadErrorCode; // e.g., 'TN_001', 'WM_001', 'AI_001'
  error_category: ErrorCategory; // 'turnstile' | 'wasm' | 'pdf' | 'ai' | 'network' | 'validation'
  error_stage: ErrorStage; // 'turnstile' | 'bullet_selection' | 'ai_selection' | 'wasm_load' | 'pdf_generation' | 'network'
  error_message: string;
  is_retryable: boolean;
}
```

#### 6. `resume_cancelled`

Captured when user cancels during any stage.

```typescript
{
  session_id: string;
  stage: "turnstile" | "verified" | "compiling" | "ai_analyzing";
  generation_method: "ai" | "heuristic";
}
```

### Server-Side Events (via /api/resume/log)

#### 1. `resume_prepared` (POST /api/resume/select)

Captured when bullet selection completes.

```typescript
{
  session_id: string
  generation_method: 'heuristic'
  role_profile_id: string
  role_profile_name: string
  bullet_ids: string[]
  bullet_count: number
  bullets_by_company: Record<string, number>
  bullets_by_tag: Record<string, number>
  config: SelectionConfig
  selection_duration_ms: number
  client_ip: string
}
```

#### 2. `resume_generated` (POST /api/resume/log)

Captured after PDF generation succeeds.

```typescript
{
  session_id: string;
  generation_method: "ai" | "heuristic";
  bullet_count: number;
  pdf_size: number;
  wasm_load_ms: number;
  generation_ms: number;
  total_duration_ms: number;
  wasm_cached: boolean;
}
```

#### 3. `resume_download_notified` (POST /api/resume/log)

Server-side notification event - triggers N8N webhook.

**Note:** This differs from client-side `resume_downloaded`. Server event is for N8N/notifications; client event has accurate browser context.

```typescript
{
  session_id: string
  generation_method: 'ai' | 'heuristic'
  download_type: 'resume_ai' | 'resume_heuristic'
  email?: string
  linkedin?: string
  // Heuristic mode
  role_profile_id?: string
  role_profile_name?: string
  // AI mode
  ai_provider?: string
  job_title?: string
  extracted_salary_min?: number
  extracted_salary_max?: number
  salary_currency?: string
  // Common
  bullet_count: number
  bullets: ScoredBullet[]  // Full content for analysis
  pdf_size: number
  filename: string
  client_ip: string
}
```

**Triggers:** N8N webhook → ntfy.sh push notification

#### 4. `resume_failed` (POST /api/resume/log)

Captured on server when generation fails.

```typescript
{
  session_id: string
  generation_method: 'ai' | 'heuristic'
  error_code: DownloadErrorCode
  error_category: ErrorCategory
  error_stage: ErrorStage
  error_message: string
  error_detail?: string
  is_retryable: boolean
  client_ip: string
}
```

**Triggers:** N8N webhook for serious errors (wasm_load, pdf_generation)

---

## Architecture Flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          User Browser                                │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
    (1) User clicks "Download PDF"
        ├─► resume_initiated (PostHog direct)
        │
    (2) Modal: Email + LinkedIn (optional) + Turnstile
        │
    (3) Turnstile verification
        ├─► resume_verified (PostHog direct)
        │
    (4a) Heuristic Mode:
        ├─► POST /api/resume/select
        │        • Validates Turnstile token
        │        • Runs bullet selection algorithm
        │        • resume_prepared (server → PostHog)
        │        • Returns selected bullets
        │
    (4b) AI Mode:
        ├─► POST /api/resume/ai-select
        │        • Validates Turnstile token
        │        • Sends JD to AI provider
        │        • AI selects relevant bullets
        │        • Returns selected bullets + reasoning
        │
    (5) Client loads WASM + generates PDF
        ├─► resume_compiled (PostHog direct)
        │
    (6) Success path:
        ├─► resume_downloaded (PostHog direct)
        ├─► POST /api/resume/log { event: 'resume_download_notified' }
        │        • resume_download_notified (server → PostHog)
        │        • Triggers N8N webhook (async)
        │             └─► N8N workflow
        │                   └─► ntfy.sh push notification
        │
    (7) Failure path:
        ├─► resume_error (PostHog direct)
        └─► POST /api/resume/log { event: 'resume_failed' }
                 • resume_failed (server → PostHog)
                 • Triggers N8N webhook for serious errors
```

---

## Error Stages

Six error stages for precise failure tracking:

| Stage              | Description                   | Error Codes                            |
| ------------------ | ----------------------------- | -------------------------------------- |
| `turnstile`        | Turnstile verification failed | TN_001, TN_002, TN_003                 |
| `bullet_selection` | Heuristic selection failed    | VL_001, VL_002, VL_003                 |
| `ai_selection`     | AI provider error             | AI_001, AI_002, AI_003, AI_004, AI_005 |
| `wasm_load`        | WASM module failed to load    | WM_001, WM_002, WM_003                 |
| `pdf_generation`   | PDF/Typst compilation failed  | PDF_001, PDF_002, PDF_003              |
| `network`          | Network/fetch error           | NT_001, NT_002, NT_003                 |

---

## Contact Card Analytics

Separate funnel for vCard downloads:

```text
contact_card_initiated
    ↓
contact_card_verified (Turnstile)
    ↓
contact_card_downloaded
    ↓
contact_card_served (server-side)
```

Error events: `contact_card_error`, `contact_card_cancelled`

---

## AI Selection Events

When using AI mode (job description analysis):

**Additional properties tracked:**

- `ai_provider`: Which model was used
- `job_title`: Extracted from job description
- `extracted_salary_min` / `extracted_salary_max`: If found in JD
- `salary_currency`: USD, GBP, EUR, etc.
- `reasoning`: AI's explanation of bullet selection (truncated for analytics)

**Providers:**

- `cerebras-gpt` / `cerebras-llama`: Fast inference
- `claude-sonnet` / `claude-haiku`: Anthropic models

---

## N8N Webhook Integration

### Configuration

```env
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/resume-downloads
N8N_WEBHOOK_SECRET=your-random-secret-here
```

### Trigger Conditions

- **Always:** `resume_download_notified` events
- **Serious errors only:** `resume_failed` where `error_stage` is `wasm_load` or `pdf_generation`

### Authentication

```http
POST https://your-n8n-instance.com/webhook/resume-downloads
Authorization: Bearer <N8N_WEBHOOK_SECRET>
Content-Type: application/json
```

### Payload (resume_download_notified)

```json
{
  "event": "resume_download_notified",
  "session_id": "uuid-here",
  "generation_method": "ai",
  "download_type": "resume_ai",
  "email": "recruiter@company.com",
  "linkedin": "linkedin.com/in/recruiter",
  "ai_provider": "cerebras-llama",
  "job_title": "Senior Developer",
  "bullet_count": 24,
  "bullets": [
    /* full bullet content */
  ],
  "pdf_size": 102400,
  "client_ip": "203.0.113.45",
  "timestamp": "2026-02-04T14:32:00.000Z"
}
```

### N8N Workflow

1. **Webhook Trigger** - Receives event payload
2. **Extract Data** - Parse JSON, extract key fields
3. **Format Notification** - Build readable message
4. **Send to ntfy.sh** - Push notification to phone

### Error Handling

- Non-blocking: Webhook failures don't affect user experience
- Logged to console for debugging
- PostHog events captured even if webhook fails

---

## Session Tracking

**Generation:**

```typescript
const sessionId = sessionStorage.getItem("resumate_session") || crypto.randomUUID();
sessionStorage.setItem("resumate_session", sessionId);
```

**Persistence:** Across page reloads in same browser session

**Linking:**

- All events use same `session_id`
- Server events include `client_ip`
- PostHog queries can reconstruct full funnel

---

## Analytics Queries (PostHog)

### Conversion Funnel

```sql
SELECT
  COUNT(DISTINCT CASE WHEN event = 'resume_initiated' THEN session_id END) as initiated,
  COUNT(DISTINCT CASE WHEN event = 'resume_verified' THEN session_id END) as verified,
  COUNT(DISTINCT CASE WHEN event = 'resume_downloaded' THEN session_id END) as downloaded
FROM events
WHERE timestamp > NOW() - INTERVAL '7 days'
```

### AI vs Heuristic Downloads

```sql
SELECT
  properties->>'generation_method' as method,
  COUNT(*) as downloads
FROM events
WHERE event = 'resume_downloaded'
GROUP BY method
```

### Error Rate by Stage

```sql
SELECT
  properties->>'error_stage' as stage,
  COUNT(*) as failures
FROM events
WHERE event IN ('resume_error', 'resume_failed')
GROUP BY stage
ORDER BY failures DESC
```

---

## Privacy & Security

### Data Handling

✅ **Tracked:**

- Session ID (UUID, not fingerprint)
- Optional contact info (user-provided consent)
- Bullet IDs and content (for analysis)
- Performance metrics
- Error messages (sanitized)
- Client IP (server-side only)

❌ **NOT tracked:**

- Browser fingerprinting
- User location beyond IP
- Third-party cookies
- Error stacks in production

### GDPR Compliance

- Contact info optional (explicit consent)
- Data used for analytics and follow-up only
- No sharing with third parties
- PostHog data retention: 90 days (configurable)

---

## Testing

### Unit Tests

```bash
just test-ts  # Run all TypeScript tests
```

**Coverage:**

- All client-side event tracking
- Server-side `/api/resume/log` endpoint
- Error stage classification
- N8N webhook graceful degradation
- AI selection event properties

### Manual Testing

1. Visit http://localhost:3002/resume
2. Click "Download PDF"
3. Enter email/LinkedIn (optional)
4. Complete Turnstile
5. Check PostHog events dashboard
6. Check N8N workflow execution
7. Check ntfy.sh notification on phone

---

## Files Reference

### Event Definitions

- `lib/analytics/events.ts` - Event names and core types
- `lib/analytics/types.ts` - Full event property types
- `lib/analytics/errors.ts` - Error codes and metadata

### Client-Side

- `lib/posthog-client.tsx` - PostHog client wrapper
- `components/data/ResumeDownload.tsx` - Download flow with analytics

### Server-Side

- `lib/posthog-server.ts` - PostHog server capture
- `app/api/resume/log/route.ts` - Event logging endpoint
- `app/api/resume/select/route.ts` - Bullet selection with `resume_prepared`

### Environment Variables

```env
# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_API_KEY=phc_...
POSTHOG_ENABLE_DEV=true

# N8N
N8N_WEBHOOK_URL=https://...
N8N_WEBHOOK_SECRET=...
```

---

**Last Updated:** 2026-02-04
**Status:** ✅ Fully Implemented
