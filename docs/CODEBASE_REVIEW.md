# Resumate Codebase Review

**Purpose:** Comprehensive analysis of verified technical debt, security gaps, and architectural inconsistencies.

**Methodology:** Systematic code inspection, build analysis, and cross-reference validation against actual behavior.

**Status:** Some findings resolved; remaining issues tracked in Linear.

**Last Review:** 2025-11-19
**Updated:** 2026-02-04 (Documentation remediation)

---

## Table of Contents

1. [Critical Security Issues (P0)](#critical-security-issues-p0)
2. [Architectural Debt (P1)](#architectural-debt-p1)
3. [Code Quality Issues (P2)](#code-quality-issues-p2)
4. [Recommended Prioritization](#recommended-prioritization)

---

## Critical Security Issues (P0)

### 🔴 P0-1: Personal Data Exposed in Client & Server Bundles

**Severity:** Critical - Undermines documented privacy guarantees

**Issue:** Email and phone number embedded in JavaScript bundles despite documentation claiming "email and phone never exposed to client-side code".

**Evidence:**
```bash
# Verified in actual build output
.next/static/chunks/1169fd66759ebccd.js contains:
"email":"[REDACTED_EMAIL]","phone":"[REDACTED_PHONE]"

.next/server/app/resume/view.rsc contains:
Full resume JSON with all PII fields
```

**Affected Files:**
- `data/resume-data.json:15-16` - Contains `"email":"[REDACTED_EMAIL]","phone":"[REDACTED_PHONE]"`
- `app/page.tsx:9` - Client component: `import resumeData from "@/data/resume-data.json"`
- `app/resume/page.tsx:6` - Same import (no 'use client' but used by client component)
- `components/ui/Navbar.tsx:8` - Client component with import
- `app/resume/view/page.tsx:3` - Server component but passes to client DataExplorer
- `README.md:41` - Claims "Protected Contact Info - Email and phone never exposed"

**Root Cause:**

Next.js bundles any imported JSON into the component that imports it. Server components that import JSON and pass it as props to client components cause the JSON to be serialized in the RSC payload (`.rsc` files) which is sent to the browser.

**Discovery Commands:**
```bash
# Build and check bundles
just build
rg "[REDACTED_EMAIL]" .next/static/
rg "[REDACTED_PHONE]" .next/server/

# Find all import sites
rg 'import.*resume-data\.json' app/ components/ -n
```

**Solution Approaches:**

**Option A: Server-Only Data Access (Recommended)**
```typescript
// Remove all client-side imports
// ❌ DELETE from app/page.tsx, components/ui/Navbar.tsx, etc.

// Create server-only data loader
// lib/data/resume-server.ts
import 'server-only'
import resumeData from '@/data/resume-data.json'

export function getPublicResumeData() {
  return {
    ...resumeData,
    personal: {
      name: resumeData.personal.name,
      nickname: resumeData.personal.nickname,
      location: resumeData.personal.location,
      // Omit email, phone, calendar
      linkedin: resumeData.personal.linkedin,
      github: resumeData.personal.github,
      website: resumeData.personal.website,
    }
  }
}

// Server component usage
export default function ServerComponent() {
  const data = getPublicResumeData()
  return <ClientComponent data={data} />
}
```

**Option B: Move PII to Environment Variables**
```typescript
// 1. Remove from resume-data.json
// data/resume-data.json - delete email, phone fields

// 2. Add to env vars
// .env.local
CONTACT_EMAIL_PERSONAL=[REDACTED_EMAIL]
CONTACT_PHONE=[REDACTED_PHONE]

// 3. Update Rust schema (remove email/phone)
// crates/shared-types/src/lib.rs
pub struct PersonalInfo {
    pub name: String,
    // Remove: pub email: Option<String>
    // Remove: pub phone: Option<String>
}

// 4. Regenerate types
just types-sync

// 5. Server-side only access
// app/api/contact-card/route.ts already does this correctly
```

**Considerations:**
- README.md, SECURITY.md must be updated to reflect actual behavior
- Gist sync scripts may need modification
- Test fixtures need updating
- CI check to prevent re-introduction:
  ```yaml
  - name: Check for PII in bundles
    run: |
      bun run build
      if rg -q "@gmail\.com|\+44" .next/static/; then
        echo "::error::PII found in client bundle"
        exit 1
      fi
  ```

---

### 🔴 P0-2: In-Memory Rate Limiting Ineffective in Serverless

**Severity:** Critical - Rate limiting can be bypassed

**Issue:** Rate limits use in-memory `Map`/`Set` that don't persist across Vercel lambda instances.

**Evidence:**
```bash
# Verified in code
proxy.ts:6: const rateLimit = new Map<string, { count: number; resetTime: number }>()
lib/rate-limit.ts:11: const rateLimitStore = new Map<string, RateLimitRecord>()
app/api/contact-card/route.ts:20: const usedTokens = new Set<string>()
```

**Affected Files:**
- `proxy.ts:6-76` - In-memory Map for proxy-level rate limiting
- `lib/rate-limit.ts:11-46` - In-memory Map for API route rate limiting
- `app/api/contact-card/route.ts:20-71` - In-memory Set for Turnstile replay protection
- All API routes using `checkRateLimit()`: `/api/resume/select`, `/api/resume/prepare`

**How Vercel Serverless Works:**
```
Request 1 → Lambda Instance A (rateLimitStore = { "ip1": 1 })
Request 2 → Lambda Instance B (rateLimitStore = {})  ← Separate memory!
Request 3 → Lambda Instance A (rateLimitStore = { "ip1": 2 })
```

Result: User can make N × (instance count) requests instead of N total.

**Discovery Commands:**
```bash
# Find in-memory storage
rg "new Map|new Set" lib/rate-limit.ts proxy.ts app/api/contact-card/

# Check rate limit calls
rg "checkRateLimit" app/api/
```

**Solution Approaches:**

**Option A: Vercel KV (Redis)**
```typescript
// Install @vercel/kv
// bun add @vercel/kv

// lib/rate-limit-redis.ts
import { kv } from '@vercel/kv'

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`

  // Atomic increment
  const count = await kv.incr(key)

  if (count === 1) {
    await kv.pexpire(key, config.window)
  }

  const ttl = await kv.pttl(key)

  return {
    success: count <= config.limit,
    limit: config.limit,
    remaining: Math.max(0, config.limit - count),
    reset: Date.now() + ttl,
  }
}

// Turnstile replay protection
export async function isTokenUsed(token: string): Promise<boolean> {
  const key = `turnstile:${token}`
  const exists = await kv.exists(key)
  if (exists) return true

  await kv.set(key, '1', { ex: 3600 })
  return false
}
```

**Option B: Document Limitation**
```markdown
// SECURITY.md
## Rate Limiting

⚠️ **Known Limitation:**
Rate limits are per-serverless-instance, not globally enforced.
Actual limit in production ≈ documented limit × concurrent instances.
Primary bot protection is Cloudflare Turnstile.

Future: Distributed rate limiting with Redis/KV.
```

**Option C: Rely on Turnstile Only**
```typescript
// Remove rate limiting code, rely solely on Turnstile
// Document that Turnstile is the primary protection
// Simpler but less defense-in-depth
```

**Recommended:** Option A (Redis) - proper distributed rate limiting

**Cost:** Vercel KV free tier: 10K requests/day, 256MB storage

---

### 🔴 P0-3: Race Condition in Proxy Rate Limiting

**Severity:** High - Can allow rate limit bypass within single instance

**Issue:** Check-then-act pattern allows concurrent requests to both pass limit check.

**Evidence:**
```typescript
// proxy.ts:66-75 (verified in code)
if (record.count >= maxRequests) {
  // Rate limit exceeded
  return false
}

// Increment count
// NOTE: This has a check-then-act race condition in concurrent Edge Runtime
// For production with multiple instances, use Redis with atomic INCR/EXPIRE
record.count++
return true
```

**Classic TOCTOU (Time-Of-Check-Time-Of-Use) vulnerability:**
```
Thread A: read count = 9 (< 10)
Thread B: read count = 9 (< 10)  ← Both read before either writes
Thread A: write count = 10
Thread B: write count = 10  ← Both succeed, allowing 11th request
```

**Impact:**
Combined with P0-2, this is lower priority since in-memory limits don't work across instances anyway. But must be fixed if moving to Redis.

**Solution:**

Redis atomic operations solve both P0-2 and P0-3:
```typescript
// Atomic increment - no race condition possible
const count = await kv.incr(key)  // Read and increment in single atomic operation
const success = count <= config.limit
```

**Discovery:**
```bash
rg "check-then-act|race condition" proxy.ts -B 5 -A 5
```

---

## Architectural Debt (P1)

### 🟡 P1-1: Schema vs Data Drift (Type System Violation)

**Severity:** High - Violates "Rust as source of truth" principle

**Issue:** PersonalInfo schema missing 4 fields present in actual data, and has 2 fields not in data.

**Evidence:**
```bash
# Rust PersonalInfo fields (verified in code)
crates/shared-types/src/lib.rs:557-617:
name, nickname, tagline, email, phone, location, linkedin, github, website, twitter

# JSON data fields (verified in data)
data/resume-data.json personal object:
calendar, citizenship, email, fullName, github, linkedin, location, name, nickname, phone, tags, website

# Missing in Rust: fullName, citizenship, calendar, tags
# Missing in JSON: tagline, twitter
```

**Affected Files:**
- `crates/shared-types/src/lib.rs:557-617` - PersonalInfo struct
- `data/resume-data.json:3-18` - Has extra fields not in schema
- `schemas/resume.schema.json` - Generated, doesn't enforce strict validation
- `scripts/validate-compendium.mjs` - Doesn't catch drift (allows additionalProperties)

**Root Cause:**

JSON Schema validation has `additionalProperties: true` (implicit default), so extra fields pass validation silently.

**Discovery Commands:**
```bash
# Compare fields
jq '.personal | keys' data/resume-data.json | jq -r '.[]' | sort
rg "pub \w+:" crates/shared-types/src/lib.rs | grep -A 30 "PersonalInfo" | grep "pub"

# Check schema strictness
jq '.definitions.PersonalInfo.additionalProperties' schemas/resume.schema.json
```

**Solution Approaches:**

**Option A: Add Missing Fields to Rust**
```rust
// crates/shared-types/src/lib.rs
pub struct PersonalInfo {
    pub name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_name: Option<String>,  // ← ADD

    #[serde(skip_serializing_if = "Option::is_none")]
    pub nickname: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub citizenship: Option<Vec<String>>,  // ← ADD

    #[serde(skip_serializing_if = "Option::is_none")]
    pub calendar: Option<String>,  // ← ADD

    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,  // ← ADD

    // ... rest of fields
}

// Remove unused fields if not in data
// Remove: tagline, twitter (unless adding to data)

// Regenerate
just types-sync
```

**Option B: Strict Schema Validation**
```typescript
// scripts/make-schema-strict.ts
import fs from 'fs'

const schema = JSON.parse(fs.readFileSync('schemas/resume.schema.json', 'utf-8'))

function enforceStrict(obj: any) {
  if (obj.type === 'object' && obj.properties) {
    obj.additionalProperties = false  // Reject unknown fields
    Object.values(obj.properties).forEach(enforceStrict)
  }
}

enforceStrict(schema)
fs.writeFileSync('schemas/resume.schema.json', JSON.stringify(schema, null, 2))

// Add to types-sync workflow
// justfile:
// types-schema:
//   cargo run --bin generate_schema
//   bun scripts/make-schema-strict.ts
```

**Option C: CI Drift Detection**
```yaml
# .github/workflows/schema-check.yml
- name: Detect schema drift
  run: |
    just types-sync
    if ! git diff --exit-code schemas/ lib/types/; then
      echo "::error::Schema drift detected"
      exit 1
    fi
```

**Recommended:** Option A + Option B + Option C (full type safety)

---

### 🟡 P1-2: Dead `/api/resume/prepare` Endpoint

**Severity:** Medium - 141 LOC unused code

**Issue:** Fully implemented API endpoint never called by client.

**Evidence:**
```bash
# Endpoint exists
app/api/resume/prepare/route.ts: 141 lines
15:export async function POST(request: NextRequest)

# No callers found
rg "/api/resume/prepare" components/ app/ lib/
# (No results except endpoint definition)

# Client calls /select directly
components/data/ResumeDownload.tsx:92:
const selectResponse = await fetch('/api/resume/select', ...)
```

**Affected Files:**
- `app/api/resume/prepare/route.ts:1-141` - Unused endpoint
- `components/data/ResumeDownload.tsx:92` - Calls `/select` directly, not `/prepare`

**Why It Exists:**

Originally planned two-step flow:
```
Client → /prepare → get token → /select with token → results
```

Actual implementation:
```
Client → /select with turnstileToken → results
```

**Solution Approaches:**

**Option A: Remove Dead Code**
```bash
rm -rf app/api/resume/prepare/
# Update docs to remove prepare references
```

**Option B: Implement Intended Flow**
```typescript
// If two-step flow is desired for Phase 6 (Claude API)
// components/data/ResumeDownload.tsx

// Step 1: Prepare
const prepareRes = await fetch('/api/resume/prepare', {
  method: 'POST',
  body: JSON.stringify({ turnstileToken }),
})
const { token, resumeData } = await prepareRes.json()

// Step 2: Select with one-time token
const selectRes = await fetch('/api/resume/select', {
  method: 'POST',
  body: JSON.stringify({ roleProfileId, generationToken: token }),
})
```

**Recommendation:** Check git history and roadmap docs first:
```bash
git log --all --oneline -- app/api/resume/prepare/
rg "prepare|Phase 6" docs/CURRENT_PHASE.md
```

---

### 🟡 ~P1-3: Typst Template File Never Loaded~ → **RESOLVED**

**Status:** ✅ RESOLVED (2026-02-04)

**Original Issue:** Claimed template file unused, `render_template` builds via string concatenation.

**Resolution:** Template IS loaded via `include_str!()` macro at compile-time. The template is embedded directly into the binary, which is the correct Rust pattern for WASM. The `_template` parameter was a misread - the actual implementation uses `include_str!("../../typst/templates/resume.typ")`.

**See:** Moved to [Resolved Issues](#resolved-issues) section.

---

### 🟡 ~P1-4: API Route Tests Don't Test HTTP Handler~ → **RESOLVED**

**Status:** ✅ RESOLVED (2026-02-04)

**Original Issue:** Claimed tests don't import POST handler.

**Resolution:** Tests DO import the POST handler. The file `app/api/resume/select/__tests__/route.test.ts` imports and tests the actual route handler with proper mocking. The handler is tested with various scenarios including rate limiting and turnstile verification.

**See:** Moved to [Resolved Issues](#resolved-issues) section.

---

## Code Quality Issues (P2)

### 🟠 P2-1: Rust Selection Code Unused + TS Missing Feature

**Severity:** Medium - ~1300 LOC dead code + missing constraint

**Issue:** Rust selection/scoring code (~290 LOC + 1000+ LOC tests) never executed. Only TS version runs. TS missing `min_per_company` constraint that Rust has.

**Actual Execution Flow:**
```
Client → /api/resume/select → TS selectBullets() → WASM PDF generation
                               └─ Line 132: Uses TS algorithm only
```

**Evidence:**
```bash
# WASM exports (verified - only PDF, no selection)
crates/resume-wasm/src/lib.rs exports:
- generate_pdf_typst  ← Used for PDF compilation
- validate_payload_json
- estimate_pdf_size
# ❌ NO selection/scoring exports

# Rust selection exists but never called
crates/resume-core/src/selector.rs:290 LOC
crates/resume-core/src/scoring.rs:90 LOC
crates/resume-core/tests/:1000+ LOC tests
# ↑ All dead code - well-tested but never executed

# TS implementation is only one running
app/api/resume/select/route.ts:132:
const selected = selectBullets(resumeData, roleProfile, selectionConfig)
# ↑ This TS function runs in production

# TS missing feature that Rust has
rg "min_per_company" crates/resume-core/src/selector.rs
# 8 results - feature exists in Rust

rg "minPerCompany" app/api/resume/select/route.ts
# 0 results - feature missing in TS
```

**Affected Files:**
- `crates/resume-core/src/selector.rs:1-290` - Dead code (never called)
- `crates/resume-core/src/scoring.rs:1-90` - Dead code (never called)
- `crates/resume-core/tests/` - Dead tests (testing unused code)
- `app/api/resume/select/route.ts:199-400` - Only implementation running
- `components/data/ResumeDownload.tsx:92` - Calls /select, gets TS-selected bullets
- `crates/resume-wasm/src/lib.rs` - Only exports PDF generation, not selection

**Discovery:**
```bash
# Verify WASM doesn't export selection
rg "#\[wasm_bindgen\]" crates/resume-wasm/src/lib.rs -A 2
# No select_bullets or score_bullet exports

# Verify TS is only one running
rg "selectBullets\(" app/api/resume/select/route.ts -n
# Line 132, 199 - TS function called by API

# Check Rust imports in WASM
rg "use.*resume_core::selector" crates/resume-wasm/src/lib.rs
# No results - selector not used

# Count dead code
find crates/resume-core -name "*.rs" -exec wc -l {} + | tail -1
```

**Why Rust Code Exists But Doesn't Run:**

Original plan was to use Rust for selection, but:
1. Selection happens **server-side** (security - don't send full resume to client)
2. WASM only used **client-side** for PDF generation
3. Server-side Rust would require napi-rs or Node WASM loader (added complexity)
4. TS version works, was meant as temporary, never replaced

**Future Consideration:**

Planned Phase 6 adds Claude API selection:
```typescript
if (jobDescription) {
  // Claude API selects bullets based on job description
  selectedBullets = await selectWithClaude(jobDescription, resumeData)
} else {
  // Heuristic selection (current TS algorithm)
  selectedBullets = selectBullets(resumeData, roleProfile, config)
}
```

Both flows are naturally TypeScript (API calls, async). Rust selection doesn't fit either path.

**Solution Approaches:**

**Option A: Delete Rust Selection, Port Missing Feature (Recommended)**
```bash
# Delete dead code
rm crates/resume-core/src/selector.rs
rm crates/resume-core/src/scoring.rs
rm -rf crates/resume-core/tests/selector_tests.rs
rm -rf crates/resume-core/tests/scoring_tests.rs
# Keep: crates/resume-core/src/lib.rs (types needed for WASM)

# Port min_per_company to TS
# app/api/resume/select/route.ts
interface SelectionConfig {
  maxBullets: number
  maxPerCompany?: number
  maxPerPosition?: number
  minPerCompany?: number  // ← ADD
}

function applyDiversityConstraints(
  sortedBullets: ScoredBullet[],
  config: SelectionConfig
): ScoredBullet[] {
  // ... existing maxPerCompany, maxPerPosition logic ...

  // Enforce minimum bullets per company (avoid single-bullet companies)
  if (config.minPerCompany) {
    const companyCounts: Record<string, number> = {}
    for (const bullet of selected) {
      companyCounts[bullet.companyId] = (companyCounts[bullet.companyId] || 0) + 1
    }

    return selected.filter(bullet =>
      companyCounts[bullet.companyId] >= config.minPerCompany!
    )
  }

  return selected
}
```

**Benefits:**
- Removes ~1300 LOC dead code
- Eliminates maintenance of duplicate implementations
- Aligns with future Claude API flow (TS)
- WASM stays focused on what it's good at: PDF generation with Typst

**Option B: Implement Server-Side Rust**
```bash
# Add napi-rs for native Node.js module
cargo install napi-rs

# Create crates/resume-node with napi bindings
# Compile to .node native module
# Call from Next.js API route
```

**Drawbacks:**
- Significant complexity (native compilation, build pipeline)
- Doesn't help with Claude API flow (that's still TS)
- WASM already provides the "Rust value-add" (PDF generation)
- Heuristic selection is simple business logic (TS fine)

**Option C: Keep Both, Add Parity Tests**
```typescript
// Test TS matches Rust behavior
describe('TS/Rust parity', () => {
  it('should eventually match when we wire up Rust', () => {
    // This will fail forever since Rust never runs
  })
})
```

**Drawbacks:**
- Maintains dead code
- False sense of safety (Rust tests pass but code never runs)
- Drift continues (TS has bugs Rust doesn't, vice versa)

**Recommendation:** **Option A** - Delete Rust selection code, keep TS as single source of truth. Port min_per_company (~30 LOC). WASM stays focused on PDF generation (its actual value).

**Considerations:**
- Rust selection/scoring well-tested, but tests are testing dead code
- Future is Claude API (TS) for smart selection, heuristic (TS) for fallback
- WASM PDF generation is already the technical achievement
- Simplicity > "coolness" when complexity doesn't add value

---

### 🟠 P2-2: Dead DOCX Generation Tests

**Severity:** Low - 20 LOC dead test code

**Issue:** Tests call `generate_docx()` function that doesn't exist.

**Evidence:**
```rust
// crates/resume-wasm/src/lib.rs:507-530 (verified)
#[test]
#[cfg(target_arch = "wasm32")]
fn test_generate_docx_valid_payload() {
    let result = generate_docx(&json);  // ← Function doesn't exist
    assert!(result.is_ok());
}

// Line 540:
// NOTE: DOCX generation has been removed - only PDF via Typst is supported
```

**Why Tests Still Exist:**

Tests are `#[cfg(target_arch = "wasm32")]` gated, so `cargo test` (host architecture) skips them. Only fail on explicit `cargo test --target wasm32-unknown-unknown`.

**Solution:**
```bash
# Delete lines 507-530
# Keep the NOTE comment explaining removal

# Verify no other DOCX references
rg "docx|DOCX" crates/ --type rust
```

---

### 🟠 P2-3: WASM Size Limits Duplicated

**Severity:** Low - Config drift risk

**Issue:** Limits defined in both `justfile` and `scripts/check-bundle-size.sh`.

**Evidence:**
```bash
# justfile:15-16
wasm_max_raw_mb := "17"
wasm_max_gzip_mb := "6.5"

# scripts/check-bundle-size.sh:14-15
MAX_RAW_MB="${1:-17}"
MAX_GZIP_MB="${2:-6.5}"
```

**Solution:**
```bash
# scripts/check-bundle-size.sh
# Read from justfile (single source of truth)
MAX_RAW_MB="${1:-$(just --evaluate wasm_max_raw_mb)}"
MAX_GZIP_MB="${2:-$(just --evaluate wasm_max_gzip_mb)}"
```

---

## Recommended Prioritization

### Immediate (P0) - Fix Before Next Deploy

1. **P0-1: PII Exposure** - Move email/phone out of client bundle
2. **P0-2: Rate Limiting** - Implement Redis or document limitation
3. **P0-3: Race Condition** - Fixed automatically by P0-2 Redis solution

**Estimated Effort:** 4-8 hours
**Risk if unfixed:** Security/privacy violation, undermines Turnstile protection

### High Priority (P1) - Technical Debt

1. **P1-1: Schema Drift** - Add missing fields, enable strict validation
2. **P1-2: Dead /prepare** - Remove or wire up (check roadmap first)
3. **P1-3: Template Bypass** - Rename function or implement template loading
4. **P1-4: API Tests** - Add handler-level integration tests

**Estimated Effort:** 6-10 hours
**Risk if unfixed:** Type safety violations, confusing codebase

### Medium Priority (P2) - Code Quality

1. **P2-1: TS Duplication** - Port min_per_company to TS
2. **P2-2: Dead Tests** - Delete 20 LOC
3. **P2-3: Config Drift** - Single source for limits

**Estimated Effort:** 2-3 hours
**Risk if unfixed:** Feature parity issues, minor maintenance burden

---

## Validation Commands

Run these to verify issues before fixing:

```bash
# P0-1: PII in bundles
just build
rg "[REDACTED_EMAIL]|[REDACTED_PHONE]" .next/static/ .next/server/

# P0-2: In-memory storage
rg "new Map|new Set" lib/rate-limit.ts proxy.ts app/api/contact-card/route.ts

# P0-3: Race condition
rg "race condition" proxy.ts -B 5 -A 5

# P1-1: Schema drift
jq '.personal | keys[]' data/resume-data.json | sort
rg "pub \w+:" crates/shared-types/src/lib.rs | grep -A 20 "PersonalInfo"

# P1-2: /prepare unused
rg "/api/resume/prepare" components/ app/ lib/

# P1-3: Template unused
rg "_template" crates/resume-typst/src/lib.rs

# P1-4: Tests don't import handler
rg "^import.*POST" app/api/resume/select/__tests__/route.test.ts

# P2-1: Missing min_per_company
rg "minPerCompany|min_per_company" app/api/resume/select/route.ts

# P2-2: Dead DOCX tests
rg "test_generate_docx" crates/resume-wasm/src/lib.rs

# P2-3: Config duplication
rg "17|6\.5" justfile scripts/check-bundle-size.sh
```

---

---

## Resolved Issues

Issues that were previously flagged but have been verified as either fixed or incorrectly identified.

### ✅ P1-3: Typst Template - RESOLVED

**Original Claim:** Template file `typst/templates/resume.typ` never loaded, `render_template` uses string concatenation.

**Actual State:** Template IS compiled into binary via `include_str!()` macro. This is the correct Rust/WASM pattern - templates are embedded at compile-time, not loaded at runtime. The WASM binary contains the template.

**Evidence:**
```rust
// crates/resume-typst/src/lib.rs
const TEMPLATE: &str = include_str!("../../typst/templates/resume.typ");
```

### ✅ P1-4: API Route Tests - RESOLVED

**Original Claim:** Tests don't import POST handler, only test mock data.

**Actual State:** Tests DO import and test the POST handler. Full handler-level testing exists with proper mocking of dependencies.

**Evidence:**
```bash
# Verify imports exist
rg "import.*POST|import.*route" app/api/resume/select/__tests__/route.test.ts
```

### ✅ Phase 6 AI Implementation - COMPLETE

**Note:** Phase 6 (AI resume generation) was completed 2025-12-08, commit d0b9d1d. The P2-1 section about "Future Consideration" for Claude API is now implemented:
- Multi-provider support (Anthropic + Cerebras)
- AI-curated bullet selection from job descriptions
- Salary extraction
- Full analytics integration

---

**Review Date:** 2025-11-19 (original)
**Updated:** 2026-02-04 (documentation remediation)
**Methodology:** Systematic code verification + build output analysis
**Next Review:** After remaining P0 fixes deployed
**Document Version:** 3.1 (Resolved section added)
