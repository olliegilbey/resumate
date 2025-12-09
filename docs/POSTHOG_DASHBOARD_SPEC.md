# PostHog Analytics Specification

**Purpose:** Unified analytics architecture answering "Who wants to hire me, for what roles, at what salary, and where?"

**Version:** 2.1 (Unified Pipeline)
**Date:** 2025-12-08

---

## Table of Contents

1. [Architecture Decisions](#architecture-decisions)
2. [Environment Tracking](#environment-tracking)
3. [Explorer Analytics](#explorer-analytics)
4. [Unified Download Pipeline](#unified-download-pipeline)
5. [Unified Error System](#unified-error-system)
6. [Complete Event Schema](#complete-event-schema)
7. [Dashboard Insights](#dashboard-insights)
8. [Implementation Checklist](#implementation-checklist)

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Historical data | **Ignore** | Current data is test; fresh start with production schema |
| Event naming | **Unified** | `resume_prepared` with `generation_method` discriminator |
| Field naming | **snake_case** | Consistent queries across client/server |
| Environment tracking | **All events** | Filter by local/preview/production |
| Duplicate events | **Keep both** | Different purposes: GeoIP (client) vs n8n (server) |
| Type safety | **Registry pattern** | Single source of truth for event names and schemas |
| Download pipeline | **Unified stages** | Common flow for resume (AI/heuristic) and vCard |
| Error format | **Rust-style** | Clear, debuggable, unified across all download types |
| Currency format | **ISO 4217** | Consistent salary data (GBP, USD, EUR, not £/$) |
| AI prompt tracking | **Hash + user prompt** | Full user prompt with `[SYSTEM_PROMPT:hash]` placeholder. Enables prompt improvement analysis without storing static system prompt repeatedly. |

---

## Environment Tracking

### Context Fields (All Events)

Every event MUST include these fields:

```typescript
interface EnvironmentContext {
  env: 'development' | 'production' | 'test'     // NODE_ENV
  source: 'local' | 'preview' | 'production'     // Deployment target
  is_server: boolean                              // Client vs server origin
}
```

### Implementation

**Server-side** (already partially implemented in `captureEvent`):
```typescript
{
  env: process.env.NODE_ENV,
  source: process.env.VERCEL_ENV || 'local',
  is_server: true,
}
```

**Client-side** (MISSING - needs implementation):
```typescript
{
  env: process.env.NODE_ENV,                           // Build-time
  source: process.env.NEXT_PUBLIC_VERCEL_ENV || 'local',
  is_server: false,
}
```

### Filtering Examples

```sql
-- Production only
WHERE properties.source = 'production'

-- Exclude local dev
WHERE properties.source != 'local'

-- Server events only
WHERE properties.is_server = true

-- Client events in preview
WHERE properties.is_server = false AND properties.source = 'preview'
```

---

## Explorer Analytics

**Purpose:** Track user interest when browsing the full experience compendium on `/explore`.

**Separate from downloads:** These events capture behavioral data about what users find interesting, NOT download flow.

### Events

#### `tag_filter_changed` (Client)
Fired when user changes tag filters (debounced 1s).

```typescript
{
  env: string
  source: string
  is_server: false

  tags: string[]           // Currently selected tag names
  tag_count: number        // Number of tags selected
  result_count: number     // Bullets matching filter
}
```

#### `search_performed` (Client)
Fired when user completes a search (on blur).

```typescript
{
  env: string
  source: string
  is_server: false

  query: string            // Search query text
  result_count: number     // Matching bullets
}
```

### Dashboard Insight: Most Explored Tags

```sql
SELECT
  arrayJoin(properties.tags) AS tag,
  COUNT(*) AS filter_count
FROM events
WHERE event = 'tag_filter_changed'
  AND properties.source = 'production'
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY tag
ORDER BY filter_count DESC
LIMIT 20
```

---

## Unified Download Pipeline

### Overview

All three download types share a common flow with consistent stages:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED DOWNLOAD FLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   STAGE 1: INITIATED                                                     │
│   ├── User clicks download button                                        │
│   ├── download_type: 'resume_ai' | 'resume_heuristic' | 'vcard'         │
│   └── Turnstile widget displayed                                         │
│                              │                                           │
│                              ▼                                           │
│   STAGE 2: VERIFIED                                                      │
│   ├── Turnstile token validated                                          │
│   ├── turnstile_duration_ms tracked                                      │
│   └── Server request initiated                                           │
│                              │                                           │
│                              ▼                                           │
│   STAGE 3: PREPARED (Server)                                             │
│   ├── Server prepares content                                            │
│   │   ├── vCard: Generate .vcf file                                      │
│   │   ├── Resume (heuristic): Run bullet selection algorithm             │
│   │   └── Resume (AI): Call AI provider, score bullets                   │
│   └── Returns data to client                                             │
│                              │                                           │
│                              ▼                                           │
│   STAGE 4: COMPILED (Resume only)                                        │
│   ├── WASM loads (if not cached)                                         │
│   ├── Typst compiles PDF                                                 │
│   ├── wasm_load_ms, generation_ms tracked                                │
│   └── PDF bytes ready                                                    │
│                              │                                           │
│                              ▼                                           │
│   STAGE 5: DOWNLOADED                                                    │
│   ├── File downloaded to user's device                                   │
│   ├── total_duration_ms tracked                                          │
│   └── Success event fired                                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Download Types

| Type | Event Prefix | Server Event | Has WASM Step |
|------|--------------|--------------|---------------|
| Resume (AI) | `resume_*` | `resume_prepared` (generation_method='ai') | Yes |
| Resume (Heuristic) | `resume_*` | `resume_prepared` (generation_method='heuristic') | Yes |
| vCard | `contact_card_*` | `contact_card_served` | No |

### Common Fields (All Download Events)

```typescript
interface DownloadEventBase {
  // Environment
  env: string
  source: string
  is_server: boolean

  // Download identification
  download_type: 'resume_ai' | 'resume_heuristic' | 'vcard'

  // Timing (varies by stage)
  duration_ms?: number
  turnstile_duration_ms?: number
  total_duration_ms?: number
}
```

### Stage-by-Stage Events

#### Resume Downloads

| Stage | Client Event | Server Event |
|-------|--------------|--------------|
| 1. Initiated | `resume_initiated` | - |
| 2. Verified | `resume_verified` | - |
| 3. Prepared | - | `resume_prepared` |
| 4. Compiled | `resume_compiled` | - |
| 5. Downloaded | `resume_downloaded` | `resume_download_notified` |
| Error | `resume_error` | `resume_failed` |
| Cancel | `resume_cancelled` | - |

#### vCard Downloads

| Stage | Client Event | Server Event |
|-------|--------------|--------------|
| 1. Initiated | `contact_card_initiated` | - |
| 2. Verified | `contact_card_verified` | - |
| 3-5. Served | `contact_card_downloaded` | `contact_card_served` |
| Error | `contact_card_error` | - |
| Cancel | `contact_card_cancelled` | - |

**Note:** vCard combines stages 3-5 because server generates and returns file in one step.

---

## Unified Error System

### Design Principles

Errors follow Rust compiler style for clarity and debuggability:

1. **Error code** - Unique identifier (e.g., `DL_001`)
2. **Category** - High-level classification
3. **Stage** - Where in pipeline error occurred
4. **Message** - Human-readable description
5. **Detail** - Extended context for debugging
6. **Suggestion** - What user/system can do

### Error Code Schema

```typescript
// Error code format: {CATEGORY}_{NUMBER}
// Categories: DL (download), TN (turnstile), WM (wasm), AI, NT (network), VL (validation)

type DownloadErrorCode =
  // Turnstile errors
  | 'TN_001'  // Turnstile expired
  | 'TN_002'  // Turnstile failed
  | 'TN_003'  // Turnstile timeout
  // WASM errors
  | 'WM_001'  // WASM load failed
  | 'WM_002'  // WASM timeout
  | 'WM_003'  // WASM memory error
  // PDF generation errors
  | 'PDF_001' // PDF generation failed
  | 'PDF_002' // PDF too large
  | 'PDF_003' // Font loading failed
  // AI errors (existing codes in lib/ai/errors.ts)
  | 'AI_001'  // Provider error
  | 'AI_002'  // Response parse failed
  | 'AI_003'  // Invalid response format
  | 'AI_004'  // Provider timeout
  | 'AI_005'  // Provider rate limited
  // Network errors
  | 'NT_001'  // Network timeout
  | 'NT_002'  // Server unreachable
  | 'NT_003'  // Response error
  // Validation errors
  | 'VL_001'  // Invalid input
  | 'VL_002'  // Missing required field
  | 'VL_003'  // Data integrity error
```

### Error Event Schema

```typescript
interface DownloadError {
  // Environment
  env: string
  source: string
  is_server: boolean
  client_ip?: string         // Server only

  // Download context
  download_type: 'resume_ai' | 'resume_heuristic' | 'vcard'
  session_id?: string

  // Error identification
  error_code: DownloadErrorCode
  error_category: 'turnstile' | 'wasm' | 'pdf' | 'ai' | 'network' | 'validation'
  error_stage: ErrorStage

  // Human-readable
  error_message: string      // Brief description
  error_detail?: string      // Extended context

  // Technical
  error_stack?: string       // Development only

  // Timing
  duration_ms: number        // Time before error occurred

  // Recovery hints
  is_retryable: boolean
  suggested_action?: string
}
```

### Error Formatting (Rust-style)

Already implemented in `lib/ai/errors.ts` - extend to all download errors:

```
error[WM_001]: WASM module failed to load

  The WebAssembly module for PDF generation could not be initialized.

  This may be caused by:
  - Browser blocking WASM execution
  - Insufficient memory
  - Network interruption during load

  --> stage: wasm_load
   |
   | duration: 5234ms
   | cached: false
   | ~~~~~~~~~~~~

  suggestion: Try refreshing the page or using a different browser.
```

### Mapping Existing Error Stages

Align client and server error stages:

| Current Client | Current Server | Unified |
|----------------|----------------|---------|
| `turnstile` | - | `turnstile` |
| `selection` | `bullet_selection` | `bullet_selection` |
| `ai_selection` | - | `ai_selection` |
| `wasm_load` | `wasm_load` | `wasm_load` |
| `compilation` | `pdf_generation` | `pdf_generation` |
| - | `network` | `network` |

---

## AI Currency Requirement (ISO 4217)

### Problem

AI may return inconsistent currency formats:
- Symbols: `$`, `£`, `€`
- Variations: `gb`, `uk`, `british`, `pounds`
- Mixed: `$USD`, `£GBP`

### Solution

Update AI prompts to explicitly require ISO 4217 codes.

### Implementation

#### 1. Update `lib/ai/prompts/system-prompt.ts`

Add to salary section (around line 81-86):

```typescript
- **salary**: Extract salary information if mentioned anywhere in the description
  - Parse ranges like "$120k - $150k" into min/max numbers
  - Convert "k" notation to full numbers (120k → 120000)
  - **CRITICAL: Use ISO 4217 currency codes only:**
    - USD (not $, dollars, US dollars)
    - GBP (not £, pounds, sterling)
    - EUR (not €, euros)
    - JPY, CAD, AUD, CHF, etc.
  - Determine period from context (annual, monthly, hourly, daily, weekly)
  - Return \`null\` if no salary information is found
```

#### 2. Update `lib/ai/prompts/user-template.ts`

Update example (line 70):

```typescript
"salary": {"min": 120000, "max": 150000, "currency": "USD", "period": "annual"}

Notes:
- Include at least ${minBullets} scored bullets
- job_title: extract from JD, or null if not found
- salary: extract from JD using ISO 4217 currency codes (USD, GBP, EUR), or null if not mentioned
```

#### 3. Update `lib/ai/output-parser.ts`

Add ISO 4217 validation (around line 96-99):

```typescript
// Validate currency is ISO 4217
const iso4217Codes = ['USD', 'GBP', 'EUR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'NZD', 'SGD', 'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'ILS', 'MXN', 'BRL', 'ZAR', 'AED', 'THB', 'KRW', 'TWD', 'MYR', 'PHP', 'IDR', 'VND']
if (typeof s.currency !== 'string' || !iso4217Codes.includes(s.currency.toUpperCase())) {
  return { valid: false, error: `salary.currency must be ISO 4217 code (e.g., USD, GBP, EUR). Got: ${s.currency}` }
}
// Normalize to uppercase
s.currency = s.currency.toUpperCase()
```

---

## Complete Event Schema

### GeoIP Implementation

**Server Events:** Pass client IP as top-level `$ip` parameter:

```typescript
client.capture({
  distinctId,
  event,
  properties: { ... },
  ...(ip && { $ip: ip }),  // Top-level for PostHog GeoIP enrichment
})
```

**Client Events:** PostHog JS SDK handles automatically.

---

### Type Registry (`lib/analytics/events.ts`)

```typescript
// Event name constants - single source of truth
export const ANALYTICS_EVENTS = {
  // Explorer (behavioral, not download)
  TAG_FILTER_CHANGED: 'tag_filter_changed',
  SEARCH_PERFORMED: 'search_performed',

  // Contact Card (vCard)
  CONTACT_CARD_INITIATED: 'contact_card_initiated',
  CONTACT_CARD_VERIFIED: 'contact_card_verified',
  CONTACT_CARD_DOWNLOADED: 'contact_card_downloaded',
  CONTACT_CARD_ERROR: 'contact_card_error',
  CONTACT_CARD_CANCELLED: 'contact_card_cancelled',
  CONTACT_CARD_SERVED: 'contact_card_served',

  // Resume
  RESUME_INITIATED: 'resume_initiated',
  RESUME_VERIFIED: 'resume_verified',
  RESUME_COMPILED: 'resume_compiled',
  RESUME_DOWNLOADED: 'resume_downloaded',
  RESUME_ERROR: 'resume_error',
  RESUME_CANCELLED: 'resume_cancelled',
  RESUME_PREPARED: 'resume_prepared',
  RESUME_GENERATED: 'resume_generated',
  RESUME_DOWNLOAD_NOTIFIED: 'resume_download_notified',
  RESUME_FAILED: 'resume_failed',
} as const

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS]
export type DownloadType = 'resume_ai' | 'resume_heuristic' | 'vcard'
export type GenerationMethod = 'ai' | 'heuristic'
export type AIProvider = 'cerebras-gpt' | 'cerebras-llama' | 'claude-sonnet' | 'claude-haiku'
export type ErrorStage = 'turnstile' | 'bullet_selection' | 'ai_selection' | 'wasm_load' | 'pdf_generation' | 'network'
export type ErrorCategory = 'turnstile' | 'wasm' | 'pdf' | 'ai' | 'network' | 'validation'
export type CancelStage = 'turnstile' | 'verified' | 'compiling' | 'ai_analyzing'
```

---

### Contact Card Events

#### `contact_card_initiated` (Client)
```typescript
{
  env: string
  source: string
  is_server: false
  download_type: 'vcard'

  timestamp: number
}
```

#### `contact_card_verified` (Client)
```typescript
{
  env: string
  source: string
  is_server: false
  download_type: 'vcard'

  turnstile_duration_ms: number
}
```

#### `contact_card_downloaded` (Client)
```typescript
{
  env: string
  source: string
  is_server: false
  download_type: 'vcard'

  total_duration_ms: number
}
```

#### `contact_card_error` (Client)
```typescript
{
  env: string
  source: string
  is_server: false
  download_type: 'vcard'

  error_code: DownloadErrorCode
  error_category: ErrorCategory
  error_stage: 'turnstile' | 'network'
  error_message: string
  error_detail?: string
  duration_ms: number
  is_retryable: boolean
}
```

#### `contact_card_cancelled` (Client)
```typescript
{
  env: string
  source: string
  is_server: false
  download_type: 'vcard'

  stage: 'turnstile' | 'verified'
  duration_ms: number
}
```

#### `contact_card_served` (Server)
```typescript
{
  env: string
  source: string
  is_server: true
  client_ip: string
  download_type: 'vcard'

  filename: string
  full_name: string
  email_count: number
  vcard_size: number
  has_linkedin: boolean
  has_github: boolean
  has_location: boolean
}
```

---

### Resume Events - Client

#### `resume_initiated` (Client)

```typescript
// Base (both modes)
{
  env: string
  source: string
  is_server: false
  download_type: 'resume_ai' | 'resume_heuristic'
  generation_method: GenerationMethod
}

// Heuristic mode additions
{
  download_type: 'resume_heuristic'
  generation_method: 'heuristic'
  role_profile_id: string
  role_profile_name: string
}

// AI mode additions
{
  download_type: 'resume_ai'
  generation_method: 'ai'
  ai_provider: AIProvider
  job_description_length: number
  job_title?: string | null
  extracted_salary_min?: number | null
  extracted_salary_max?: number | null
  salary_currency?: string | null  // ISO 4217
}
```

#### `resume_verified` (Client)
```typescript
{
  env: string
  source: string
  is_server: false
  download_type: 'resume_ai' | 'resume_heuristic'

  generation_method: GenerationMethod
  role_profile_id?: string           // heuristic
  ai_provider?: AIProvider           // ai
  turnstile_duration_ms: number
}
```

#### `resume_compiled` (Client)
```typescript
{
  env: string
  source: string
  is_server: false
  download_type: 'resume_ai' | 'resume_heuristic'

  generation_method: GenerationMethod
  role_profile_id?: string
  ai_provider?: AIProvider
  bullet_count: number
  wasm_load_ms: number
  wasm_cached: boolean
  generation_ms: number
  pdf_size_bytes: number
  ai_response_ms?: number            // ai only
  retry_count?: number               // ai only
}
```

#### `resume_downloaded` (Client)
```typescript
{
  env: string
  source: string
  is_server: false
  download_type: 'resume_ai' | 'resume_heuristic'

  generation_method: GenerationMethod
  role_profile_id?: string
  role_profile_name?: string
  ai_provider?: AIProvider
  job_title?: string | null
  bullet_count: number
  total_duration_ms: number

  // Auto-populated by PostHog:
  // $geoip_city_name, $geoip_country_code, etc.
}
```

#### `resume_error` (Client)
```typescript
{
  env: string
  source: string
  is_server: false
  download_type: 'resume_ai' | 'resume_heuristic'

  generation_method: GenerationMethod
  role_profile_id?: string
  ai_provider?: AIProvider

  // Unified error fields
  error_code: DownloadErrorCode
  error_category: ErrorCategory
  error_stage: ErrorStage
  error_message: string
  error_detail?: string
  duration_ms: number
  is_retryable: boolean
}
```

#### `resume_cancelled` (Client)
```typescript
{
  env: string
  source: string
  is_server: false
  download_type: 'resume_ai' | 'resume_heuristic'

  generation_method: GenerationMethod
  role_profile_id?: string
  ai_provider?: AIProvider
  stage: CancelStage
  duration_ms: number
}
```

---

### Resume Events - Server

#### `resume_prepared` (Server) - UNIFIED

```typescript
// Common fields
{
  env: string
  source: string
  is_server: true
  client_ip: string
  download_type: 'resume_ai' | 'resume_heuristic'

  generation_method: GenerationMethod  // DISCRIMINATOR
  session_id?: string
  email?: string
  linkedin?: string
  bullet_ids: string[]
  bullet_count: number
  bullets_by_company: Record<string, number>
  bullets_by_tag: Record<string, number>
  config: {
    max_bullets: number
    max_per_company: number
    max_per_position: number
  }
}

// Heuristic mode additions
{
  generation_method: 'heuristic'
  download_type: 'resume_heuristic'
  role_profile_id: string
  role_profile_name: string
  selection_duration_ms: number
}

// AI mode additions
{
  generation_method: 'ai'
  download_type: 'resume_ai'
  ai_provider: AIProvider
  job_description: string
  job_description_length: number
  job_title?: string | null
  extracted_salary_min?: number | null
  extracted_salary_max?: number | null
  salary_currency?: string | null      // ISO 4217
  salary_period?: 'annual' | 'monthly' | 'hourly' | 'daily' | null
  ai_response_ms: number
  tokens_used?: number
  reasoning?: string
  ai_prompt: string                    // Full prompt with [SYSTEM_PROMPT:hash] placeholder
  ai_attempt_count: number             // 1 = success first try, >1 = retries needed
}
```

#### `resume_generated` (Server via /api/resume/log)
```typescript
{
  env: string
  source: string
  is_server: true
  client_ip: string
  download_type: 'resume_ai' | 'resume_heuristic'

  generation_method: GenerationMethod
  session_id: string
  role_profile_id?: string
  role_profile_name?: string
  ai_provider?: AIProvider
  job_title?: string | null
  bullet_count: number
  pdf_size: number
  wasm_load_ms: number
  generation_ms: number
  total_duration_ms: number
  wasm_cached: boolean
}
```

#### `resume_download_notified` (Server via /api/resume/log)
```typescript
{
  env: string
  source: string
  is_server: true
  client_ip: string
  download_type: 'resume_ai' | 'resume_heuristic'

  generation_method: GenerationMethod
  session_id: string
  email?: string
  linkedin?: string
  bullet_count: number
  bullets: SelectedBullet[]          // Full content for n8n
  pdf_size: number
  filename: string

  // Heuristic mode
  role_profile_id?: string
  role_profile_name?: string

  // AI mode
  ai_provider?: AIProvider
  job_title?: string | null
  extracted_salary_min?: number | null
  extracted_salary_max?: number | null
  salary_currency?: string | null    // ISO 4217
  reasoning?: string
}
```

#### `resume_failed` (Server via /api/resume/log)
```typescript
{
  env: string
  source: string
  is_server: true
  client_ip: string
  download_type: 'resume_ai' | 'resume_heuristic'

  generation_method: GenerationMethod
  session_id: string

  // Unified error fields
  error_code: DownloadErrorCode
  error_category: ErrorCategory
  error_stage: ErrorStage
  error_message: string
  error_detail?: string
  error_stack?: string               // development only

  role_profile_id?: string
  ai_provider?: AIProvider
  bullet_count?: number
  is_retryable: boolean
}
```

---

## Dashboard Insights

### Layout Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. DOWNLOADS OVER TIME (All Types)                                     │
│  Line chart: [AI ━━━] [Heuristic ━━━] [vCard ━━━]                       │
├─────────────────────────────────────────────────────────────────────────┤
│  2. ROLE DEMAND (Combined AI + Heuristic)                               │
│  Horizontal bar: job_title + role_profile_name with color distinction   │
├─────────────────────────────────────────────────────────────────────────┤
│  3. SALARY RANGES TABLE                                                 │
│  job_title │ salary_min │ salary_max │ currency │ timestamp             │
├─────────────────────────────────────────────────────────────────────────┤
│  4. AVG SALARY BY TITLE                                                 │
│  Bar chart: which roles pay best                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  5. TOP CITIES                                                          │
│  Table: city │ region │ country │ downloads                             │
├─────────────────────────────────────────────────────────────────────────┤
│  6. RECENT ACTIVITY LOG                                                 │
│  timestamp │ method │ title │ city │ salary │ email │ linkedin          │
├─────────────────────────────────────────────────────────────────────────┤
│  7. UNIFIED DOWNLOAD FUNNEL                                             │
│  initiated → verified → prepared → compiled → downloaded                │
│  Breakdown by download_type (AI/Heuristic/vCard)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  8. ERROR BREAKDOWN (All Downloads)                                     │
│  Table: download_type │ error_stage │ error_code │ count                │
├─────────────────────────────────────────────────────────────────────────┤
│  9. MOST EXPLORED TAGS                                                  │
│  Bar chart: which tags users filter by most                             │
├─────────────────────────────────────────────────────────────────────────┤
│  10. TECHNICAL MONITORING                                               │
│  AI Response Time │ PDF Performance │ Provider Usage                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Insight Queries

All queries include production filter: `AND properties.source = 'production'`

#### 1. Downloads Over Time
```sql
-- Three series on same chart
-- Series 1: AI downloads
SELECT count() FROM events
WHERE event = 'resume_downloaded'
  AND properties.generation_method = 'ai'
  AND properties.source = 'production'

-- Series 2: Heuristic downloads
SELECT count() FROM events
WHERE event = 'resume_downloaded'
  AND properties.generation_method = 'heuristic'
  AND properties.source = 'production'

-- Series 3: vCard downloads
SELECT count() FROM events
WHERE event = 'contact_card_downloaded'
  AND properties.source = 'production'
```

#### 2. Role Demand (Combined)
```sql
SELECT
  COALESCE(
    properties.job_title,
    properties.role_profile_name
  ) AS role_title,
  properties.generation_method AS method,
  COUNT(*) AS count
FROM events
WHERE event = 'resume_prepared'
  AND properties.source = 'production'
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY role_title, method
ORDER BY count DESC
LIMIT 20
```

#### 3. Salary Ranges Table
```sql
SELECT
  formatDateTime(timestamp, '%Y-%m-%d %H:%i') AS time,
  properties.job_title AS job_title,
  properties.extracted_salary_min AS salary_min,
  properties.extracted_salary_max AS salary_max,
  properties.salary_currency AS currency
FROM events
WHERE event = 'resume_prepared'
  AND properties.generation_method = 'ai'
  AND properties.extracted_salary_min IS NOT NULL
  AND properties.source = 'production'
ORDER BY timestamp DESC
LIMIT 50
```

#### 4. Average Salary by Title
```sql
SELECT
  properties.job_title AS title,
  avg(properties.extracted_salary_min) AS avg_salary_min,
  avg(properties.extracted_salary_max) AS avg_salary_max,
  count() AS sample_size
FROM events
WHERE event = 'resume_prepared'
  AND properties.generation_method = 'ai'
  AND properties.extracted_salary_min IS NOT NULL
  AND properties.source = 'production'
GROUP BY title
HAVING sample_size >= 2
ORDER BY avg_salary_min DESC
```

#### 5. Top Cities
```sql
SELECT
  properties.$geoip_city_name AS city,
  properties.$geoip_subdivision_1_name AS region,
  properties.$geoip_country_code AS country,
  COUNT(*) AS downloads
FROM events
WHERE event IN ('resume_downloaded', 'contact_card_downloaded')
  AND properties.source = 'production'
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY city, region, country
ORDER BY downloads DESC
LIMIT 20
```

#### 6. Recent Activity Log
```sql
SELECT
  formatDateTime(timestamp, '%Y-%m-%d %H:%i') AS time,
  properties.generation_method AS method,
  COALESCE(properties.job_title, properties.role_profile_name) AS role,
  properties.$geoip_city_name AS city,
  properties.extracted_salary_min AS salary_min,
  properties.extracted_salary_max AS salary_max,
  properties.email AS email,
  properties.linkedin AS linkedin
FROM events
WHERE event = 'resume_prepared'
  AND properties.source = 'production'
ORDER BY timestamp DESC
LIMIT 25
```

#### 7. Unified Download Funnel

```sql
-- Funnel visualization (PostHog FunnelsQuery)
-- Steps for Resume:
1. resume_initiated OR contact_card_initiated
2. resume_verified OR contact_card_verified
3. resume_compiled OR contact_card_downloaded  -- vCard has no compile step
4. resume_downloaded

-- Filter: properties.source = 'production'
-- Breakdown by: properties.download_type
```

#### 8. Error Breakdown (All Downloads)
```sql
SELECT
  properties.download_type AS download_type,
  properties.error_stage AS stage,
  properties.error_code AS error_code,
  properties.error_message AS message,
  COUNT(*) AS count
FROM events
WHERE event IN ('resume_error', 'resume_failed', 'contact_card_error')
  AND properties.source = 'production'
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY download_type, stage, error_code, message
ORDER BY count DESC
LIMIT 50
```

#### 9. Most Explored Tags
```sql
SELECT
  arrayJoin(properties.tags) AS tag,
  COUNT(*) AS filter_count
FROM events
WHERE event = 'tag_filter_changed'
  AND properties.source = 'production'
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY tag
ORDER BY filter_count DESC
LIMIT 20
```

---

## Implementation Checklist

### Phase 1: Type Registry (~20 min)

- [ ] **Create `lib/analytics/events.ts`**
  - Export ANALYTICS_EVENTS constant (all event names)
  - Export type definitions (GenerationMethod, AIProvider, ErrorStage, ErrorCategory, etc.)
  - Export EnvironmentContext interface
  - Export DownloadType type
  - Export getEnvironmentContext() helper for client/server

- [ ] **Create `lib/analytics/types.ts`**
  - Export all event property interfaces
  - Export DownloadError interface
  - Use discriminated unions for download_type and generation_method

- [ ] **Create `lib/analytics/errors.ts`**
  - Export DownloadErrorCode type
  - Export createDownloadError() helper
  - Export formatRustStyleDownloadError() (extend existing AI error format)

### Phase 2: Update Client Analytics (~30 min)

- [ ] **Update `lib/posthog-client.tsx`**
  - Import from new type registry
  - Add environment context to useTrackEvent()
  - Add environment context to usePostHogResume()
  - Inject: env, source, is_server: false
  - Add download_type to all download events

- [ ] **Update client event property interfaces**
  - Add download_type field
  - Add unified error fields (error_code, error_category, etc.)
  - Ensure all use snake_case
  - Add environment fields to all interfaces

### Phase 3: Update Server Analytics (~30 min)

- [ ] **Update `lib/posthog-server.ts`**
  - Import from new type registry
  - Add typed captureResumeEvent() function
  - Add download_type to all events
  - Ensure env, source, is_server: true added to all events
  - Keep $ip at top level for GeoIP

- [ ] **Update `app/api/resume/select/route.ts`**
  - Add generation_method: 'heuristic'
  - Add download_type: 'resume_heuristic'
  - Convert all fields to snake_case
  - Use ANALYTICS_EVENTS.RESUME_PREPARED constant

- [ ] **Update `app/api/resume/ai-select/route.ts`**
  - Change event name: 'resume_ai_prepared' → 'resume_prepared'
  - Add generation_method: 'ai'
  - Add download_type: 'resume_ai'
  - Convert all fields to snake_case
  - Use ANALYTICS_EVENTS.RESUME_PREPARED constant

- [ ] **Update `app/api/resume/log/route.ts`**
  - Accept generation_method from client
  - Accept download_type from client
  - Accept AI fields (job_title, salary_*, ai_provider) for passthrough
  - Accept unified error fields
  - Convert all fields to snake_case
  - Add environment context
  - Use ANALYTICS_EVENTS constants

- [ ] **Update `app/api/contact-card/route.ts`**
  - Add download_type: 'vcard'
  - Convert camelCase → snake_case
  - Use ANALYTICS_EVENTS.CONTACT_CARD_SERVED constant

### Phase 4: Update Components (~20 min)

- [ ] **Update `components/data/ResumeDownload.tsx`**
  - Add download_type to all events
  - Pass generation_method + AI fields when calling /api/resume/log
  - Use unified error format
  - Import event names from registry

- [ ] **Update `components/data/DataExplorer.tsx`**
  - Import event names from registry

- [ ] **Update `app/page.tsx`**
  - Add download_type: 'vcard' to contact card events
  - Use unified error format
  - Import event names from registry

### Phase 5: Align Error System (~15 min)

- [ ] **Extend `lib/ai/errors.ts` or create `lib/analytics/errors.ts`**
  - Add DownloadErrorCode type with all codes
  - Add formatRustStyleDownloadError() function
  - Map existing AI errors to new unified format

- [ ] **Update ResumeDownload.tsx error handling**
  - Use unified error_code, error_category, error_stage
  - Map: 'selection' → 'bullet_selection', 'compilation' → 'pdf_generation'
  - Add is_retryable field

- [ ] **Update page.tsx (contact card) error handling**
  - Use unified error format for contact_card_error

### Phase 6: ISO 4217 Currency (~10 min)

- [ ] **Update `lib/ai/prompts/system-prompt.ts`**
  - Add ISO 4217 requirement to salary section
  - Add examples: USD, GBP, EUR

- [ ] **Update `lib/ai/prompts/user-template.ts`**
  - Update example to show ISO 4217
  - Add note about currency format

- [ ] **Update `lib/ai/output-parser.ts`**
  - Add ISO 4217 validation
  - Normalize to uppercase
  - List of valid codes

### Phase 7: Dashboard Build (~45 min)

- [ ] Create/update PostHog dashboard with insights from spec
- [ ] Add production filter to all insights
- [ ] Add unified funnel insight (7)
- [ ] Add error breakdown insight (8)
- [ ] Add explored tags insight (9)
- [ ] Verify queries return expected data
- [ ] Arrange insights in specified order

---

## File Change Summary

| File | Changes |
|------|---------|
| `lib/analytics/events.ts` | **NEW** - Event registry |
| `lib/analytics/types.ts` | **NEW** - Type definitions |
| `lib/analytics/errors.ts` | **NEW** - Unified error system |
| `lib/posthog-client.tsx` | Add env context, download_type, import from registry |
| `lib/posthog-server.ts` | Add typed function, download_type, import from registry |
| `lib/ai/prompts/system-prompt.ts` | Add ISO 4217 requirement |
| `lib/ai/prompts/user-template.ts` | Add ISO 4217 in example |
| `lib/ai/output-parser.ts` | Add ISO 4217 validation |
| `app/api/resume/select/route.ts` | Add generation_method, download_type, snake_case |
| `app/api/resume/ai-select/route.ts` | Rename event, add download_type, snake_case |
| `app/api/resume/log/route.ts` | Accept new fields, unified errors, snake_case |
| `app/api/contact-card/route.ts` | Add download_type, snake_case |
| `components/data/ResumeDownload.tsx` | Add download_type, unified errors, import registry |
| `components/data/DataExplorer.tsx` | Import from registry |
| `app/page.tsx` | Add download_type, unified errors, import registry |

---

## Validation Checklist

After implementation, verify:

- [ ] All events include `env`, `source`, `is_server`
- [ ] All download events include `download_type`
- [ ] Server events have `client_ip` and `$ip` for GeoIP
- [ ] `resume_prepared` works for both AI and heuristic (check `generation_method`)
- [ ] No camelCase fields in event properties
- [ ] Error events use unified format (error_code, error_category, error_stage)
- [ ] AI returns ISO 4217 currency codes
- [ ] Dashboard queries return data with production filter
- [ ] Unified funnel shows all three download types
- [ ] Error breakdown shows all download types
- [ ] Local development events filtered out of production dashboard

---

## Event Count Summary

| Category | Count | Events |
|----------|-------|--------|
| Explorer | 2 | tag_filter_changed, search_performed |
| Contact Card | 6 | initiated, verified, downloaded, error, cancelled, served |
| Resume Client | 6 | initiated, verified, compiled, downloaded, error, cancelled |
| Resume Server | 4 | prepared, generated, download_notified, failed |
| **Total** | **18** | |

---

*This specification is complete and ready for implementation.*
