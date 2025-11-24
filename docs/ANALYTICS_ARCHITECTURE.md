# Analytics & Notification Architecture

**Status:** ✅ Phase 1 Complete (OLL-70) | 🚧 Phase 2 Pending (OLL-71)
**Last Updated:** 2025-01-21

## Overview

Full-stack analytics system tracking resume download funnel with PostHog + n8n + ntfy.sh notifications.

**Phase 1 Complete:**
- ✅ Server-side event: `resume_prepared`
- ✅ Client-side events: `resume_downloaded`, `resume_generated`, `resume_failed`
- ✅ Contact info collection (email, LinkedIn - optional)
- ✅ Session tracking via sessionStorage UUID
- ✅ Performance metrics (WASM load, generation, total duration)
- ✅ Error stage tracking (bullet_selection, wasm_load, pdf_generation)
- ✅ N8N webhook integration (ready, workflow pending)
- ✅ Tests coverage for all events

**Phase 2 Pending:**
- 🚧 N8N workflow setup
- 🚧 ntfy.sh notification configuration
- 🚧 Production deployment verification

---

## Event Schema

### 1. `resume_prepared` (Server-side)
Captured when bullet selection completes on `/api/resume/select`.

```typescript
{
  distinctId: string          // sessionId or IP hash
  sessionId: string           // Client sessionStorage UUID
  email?: string              // Optional user email
  linkedin?: string           // Optional LinkedIn profile
  roleProfileId: string       // "developer-relations-lead"
  roleProfileName: string     // "Developer Relations Lead"
  bulletIds: string[]         // Selected bullet IDs
  bulletCount: number         // Total bullets selected
  bulletsByCompany: Record<string, number>  // Distribution per company
  bulletsByTag: Record<string, number>      // Distribution per tag
  config: SelectionConfig     // maxBullets, maxPerCompany, maxPerPosition
  selectionDuration: number   // ms to run algorithm
  clientIP: string            // For debugging
  environment: string         // dev/production
  timestamp: string           // ISO 8601
}
```

### 2. `resume_downloaded` (Client-side → Server)
Captured when PDF successfully downloads via `/api/resume/log`.

```typescript
{
  distinctId: string          // sessionId
  sessionId: string
  email?: string
  linkedin?: string
  roleProfileId: string
  roleProfileName: string
  bulletCount: number
  bullets: ScoredBullet[]     // Full bullet content for analysis
  pdfSize: number             // bytes
  filename: string            // Generated filename
  clientIP: string
  timestamp: string
}
```

**Triggers:**
- PostHog event capture
- n8n webhook → ntfy.sh notification

### 3. `resume_generated` (Client-side → Server)
Captured when PDF generation succeeds (before download).

```typescript
{
  distinctId: string
  sessionId: string
  roleProfileId: string
  roleProfileName: string
  bulletCount: number
  pdfSize: number
  wasmLoadDuration: number    // ms
  generationDuration: number  // ms
  totalDuration: number       // ms
  wasmCached: boolean         // Was WASM already loaded?
  clientIP: string
  timestamp: string
}
```

### 4. `resume_failed` (Client-side → Server)
Captured when PDF generation fails.

```typescript
{
  distinctId: string
  sessionId: string
  roleProfileId: string
  roleProfileName: string
  errorMessage: string
  errorStage: 'wasm_load' | 'bullet_selection' | 'pdf_generation'
  errorStack?: string         // Only in development
  bulletCount?: number
  clientIP: string
  timestamp: string
}
```

**Triggers:**
- PostHog event capture
- n8n webhook for serious errors (wasm_load, pdf_generation)

---

## Architecture Flow

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │
         │ (1) User clicks "Download PDF"
         │     Modal: Email (optional) + LinkedIn (optional)
         │     Turnstile verification
         │
         ├─► POST /api/resume/select
         │        • Validates Turnstile token
         │        • Runs bullet selection algorithm
         │        • Tracks resume_prepared event to PostHog
         │        • Returns selected bullets
         │
         │ (2) Client loads WASM + generates PDF
         │     (sessionStorage.resumate_session for tracking)
         │
         │ (3) Success path:
         ├─► POST /api/resume/log { event: 'resume_downloaded' }
         │        • Tracks to PostHog
         │        • Triggers n8n webhook (async, non-blocking)
         │             └─► N8N workflow
         │                   └─► ntfy.sh push notification
         │
         │ (4) Failure path:
         └─► POST /api/resume/log { event: 'resume_failed' }
                  • Tracks to PostHog
                  • Triggers n8n webhook for serious errors
```

---

## Contact Info Collection

**UI:** Modal before Turnstile verification

**Fields:**
- Email (optional)
- LinkedIn (optional)

**Message:**
> "I'd love to know who's interested! Feel free to share your contact info (optional)."

**Privacy:**
- All fields optional
- Data stored in PostHog (not in database)
- Not shared with third parties
- Used for follow-up and analytics only

---

## Session Tracking

**Generation:**
```typescript
const sessionId = sessionStorage.getItem('resumate_session') || crypto.randomUUID()
sessionStorage.setItem('resumate_session', sessionId)
```

**Persistence:** Across page reloads in same browser session

**Linking:**
- All events use same `sessionId`
- Server events also include `clientIP`
- PostHog queries can reconstruct full funnel

---

## N8N Webhook Integration

### Configuration
```env
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/resume-downloads
N8N_WEBHOOK_SECRET=your-random-secret-here
```

### Authentication
```http
POST https://your-n8n-instance.com/webhook/resume-downloads
Authorization: Bearer <N8N_WEBHOOK_SECRET>
Content-Type: application/json
```

### Payload (resume_downloaded)
```json
{
  "event": "resume_downloaded",
  "sessionId": "uuid-here",
  "email": "recruiter@company.com",
  "linkedin": "linkedin.com/in/recruiter",
  "roleProfileId": "developer-relations-lead",
  "roleProfileName": "Developer Relations Lead",
  "bulletCount": 24,
  "bullets": [ /* full bullet content */ ],
  "pdfSize": 102400,
  "clientIP": "203.0.113.45",
  "timestamp": "2025-01-21T14:32:00.000Z"
}
```

### Payload (resume_failed)
```json
{
  "event": "resume_failed",
  "sessionId": "uuid-here",
  "email": "user@example.com",
  "linkedin": "linkedin.com/in/user",
  "roleProfileId": "backend-engineer",
  "roleProfileName": "Backend Engineer",
  "errorMessage": "WASM failed to load",
  "errorStage": "wasm_load",
  "clientIP": "203.0.113.45",
  "timestamp": "2025-01-21T14:35:00.000Z"
}
```

### Error Handling
- Non-blocking: Webhook failures don't affect user experience
- Logged to console for debugging
- PostHog events still captured even if webhook fails

---

## N8N Workflow Setup (Phase 2 - OLL-71)

### Workflow Steps

1. **Webhook Trigger**
   - HTTP endpoint
   - Bearer token authentication
   - Receives `resume_downloaded` or `resume_failed` events

2. **Extract Data**
   - Parse JSON payload
   - Extract contact info, role, bullet details

3. **Format Notification**
   ```
   🎉 Resume Downloaded!

   Contact:
   • Email: recruiter@company.com
   • LinkedIn: linkedin.com/in/recruiter
   • IP: 203.0.113.45

   Role: Developer Relations Lead (24 bullets)

   Top Content:
   • Warp Terminal (8)
   • GitHub (6)
   • AWS (5)

   Performance: 2.3s (WASM cached)
   Time: 2025-01-21 14:32 UTC
   ```

4. **Send to ntfy.sh**
   - POST https://ntfy.sh/your-topic
   - Title: "Resume Downloaded!" or "Resume Generation Failed"
   - Priority: 3 (default) or 4 (high for failures)
   - Tags: `tada` for success, `warning` for failure

### Testing
```bash
# Test webhook manually
curl -X POST https://your-n8n-instance.com/webhook/resume-downloads \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -d '{"event":"resume_downloaded","roleProfileName":"Test Role","bulletCount":10}'
```

---

## Analytics Queries (PostHog)

### Conversion Funnel
```sql
SELECT
  COUNT(DISTINCT CASE WHEN event = 'resume_prepared' THEN sessionId END) as prepared,
  COUNT(DISTINCT CASE WHEN event = 'resume_downloaded' THEN sessionId END) as downloaded,
  (downloaded::float / prepared * 100) as conversion_rate
FROM events
WHERE timestamp > NOW() - INTERVAL '7 days'
```

### Most Requested Roles
```sql
SELECT
  properties->>'roleProfileName' as role,
  COUNT(*) as downloads
FROM events
WHERE event = 'resume_downloaded'
GROUP BY role
ORDER BY downloads DESC
```

### Bullet Popularity
```sql
SELECT
  bullet->>'companyName' as company,
  COUNT(*) as selections
FROM events,
  jsonb_array_elements(properties->'bullets') as bullet
WHERE event = 'resume_downloaded'
GROUP BY company
ORDER BY selections DESC
```

---

## Performance Monitoring

### Key Metrics
- Bullet selection duration (server-side)
- WASM load time (client-side)
- PDF generation time (client-side)
- Total time to download

### Dashboards
- **Conversion funnel:** prepared → generated → downloaded
- **Role demand:** downloads per role profile
- **Performance trends:** generation time over time
- **Error rates:** failures by stage

---

## Privacy & Security

### Data Handling
✅ **Tracked:**
- IP hash (distinctId)
- Optional contact info (user-provided)
- Bullet IDs and content (for analysis)
- Performance metrics
- Error messages (sanitized)

❌ **NOT tracked:**
- Browser fingerprinting
- User location (beyond IP)
- Sensitive personal data
- Third-party cookies

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
- resume_downloaded event tracking
- resume_generated event tracking
- resume_failed event tracking
- Missing field validation
- Webhook graceful degradation

### Manual Testing
1. Visit http://localhost:3002/resume
2. Click "Download PDF"
3. Enter email/LinkedIn (optional)
4. Complete Turnstile
5. Check PostHog events dashboard
6. Check n8n workflow execution (Phase 2)
7. Check ntfy.sh notification (Phase 2)

---

## Files Changed

### New Files
- `app/api/resume/log/route.ts` - Client event logging endpoint
- `app/api/resume/log/__tests__/route.test.ts` - Tests
- `docs/ANALYTICS_ARCHITECTURE.md` - This file

### Modified Files
- `components/data/ResumeDownload.tsx` - Email/LinkedIn fields, sessionId tracking
- `app/api/resume/select/route.ts` - resume_prepared event tracking
- `.env.example` - N8N configuration docs

### Environment Variables
```env
# PostHog (already configured)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
POSTHOG_API_KEY=phc_...
POSTHOG_ENABLE_DEV=true

# N8N (Phase 2)
N8N_WEBHOOK_URL=https://...
N8N_WEBHOOK_SECRET=...
```

---

## Next Steps (OLL-71)

1. **Set up n8n instance**
   - Self-hosted or n8n.cloud
   - Create webhook trigger
   - Generate Bearer token

2. **Build workflow**
   - Parse webhook payload
   - Format notification message
   - Send to ntfy.sh topic

3. **Configure environment**
   - Add N8N_WEBHOOK_URL to `.env.local`
   - Add N8N_WEBHOOK_SECRET to `.env.local`
   - Test with curl

4. **End-to-end test**
   - Download PDF from dev server
   - Verify PostHog events
   - Verify n8n execution
   - Verify ntfy.sh notification on phone

5. **Deploy to production**
   - Add env vars to Vercel
   - Test production webhook
   - Monitor notifications

---

## Troubleshooting

### Webhook not firing
- Check N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET in `.env.local`
- Check n8n workflow is active
- Check n8n logs for incoming requests
- Test with curl manually

### PostHog events not showing
- Check POSTHOG_ENABLE_DEV=true in dev
- Check PostHog dashboard filters
- Check browser console for PostHog errors
- Wait 1-2 minutes for event processing

### ntfy.sh not receiving
- Check ntfy.sh topic name
- Check ntfy.sh app subscription
- Check n8n workflow execution logs
- Test with curl to ntfy.sh directly

---

## Implementation Notes (Phase 1 Completion)

### Files Modified
**`components/data/ResumeDownload.tsx`:**
- Added timing tracking for WASM load and PDF generation
- Implemented `resume_generated` event with performance metrics
- Implemented `resume_failed` event with error stage detection
- Tracks wasmCached, wasmLoadDuration, generationDuration, totalDuration

**`app/api/resume/log/__tests__/route.test.ts`:**
- Updated tests for `resume_generated` with full performance metrics
- Updated tests for `resume_failed` with contact info and error stages

### Event Flow (Complete)
1. **User clicks "Download PDF"** → Turnstile verification
2. **POST /api/resume/select** → `resume_prepared` event (server-side)
3. **Client loads WASM + generates PDF** → Timing tracked
4. **Success path:**
   - `resume_generated` event (before download)
   - PDF downloads
   - `resume_downloaded` event → triggers N8N webhook
5. **Failure path:**
   - `resume_failed` event → triggers N8N webhook (for serious errors)

### Performance Metrics Tracked
- **WASM Load Duration:** Time to initialize WASM module
- **Generation Duration:** Time to generate PDF with Typst
- **Total Duration:** End-to-end time from start to PDF ready
- **WASM Cached:** Boolean indicating if WASM was already loaded

### Error Stages
- `bullet_selection`: Error during server-side bullet selection
- `wasm_load`: WASM module failed to load
- `pdf_generation`: PDF generation failed (Typst error)

---

**Last Updated:** 2025-01-21
**Status:** ✅ Phase 1 Complete | 🚧 Phase 2 Pending
