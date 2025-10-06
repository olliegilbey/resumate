# Resumate - AI-Assisted Resume Curation System

## Project Overview

**Resumate** is an intelligent resume system that curates experience based on role types using Rust/WASM for client-side PDF+DOCX generation. This framework serves as both a personal portfolio site and a technical showcase of systems programming, WebAssembly, and AI integration.

## Meta-Project Philosophy

This project is a **meta-resume**: it demonstrates technical capabilities through its own creation. Key principles:

1. **Human-authored, AI-curated**: All bullet text written by you, AI only selects what's relevant
2. **Rust/WASM showcase**: Demonstrates systems programming, WebAssembly, performance optimization
3. **Agentic coding**: You oversee architecture, AI assists implementation (Anthropic hiring guideline compliant)
4. **Growth engineering**: Analytics-driven, iterated based on recruiter behavior data
5. **Fast & light**: Sub-5s generation time, no heavy servers, client-side compilation
6. **Security-first**: Turnstile protection, rate limiting, no data exposure

---

## Current Status

### Phase 1: Foundation & Data Explorer - ✅ COMPLETE

**Completed Features:**
- ✅ Beautiful, filterable experience explorer at `/resume/view`
- ✅ Search functionality (text-based filtering)
- ✅ Tag filtering with smart priority sorting (count × avg_priority)
- ✅ Click-to-filter tags from bullet cards
- ✅ Company grouping with timeline
- ✅ Priority indicators and metrics highlighting
- ✅ Responsive design (mobile-first)
- ✅ vCard download with Cloudflare Turnstile protection
- ✅ Cal.com booking link integration
- ✅ Comprehensive test coverage (48 tests passing)
- ✅ GitHub Gist integration with auto-deploy

**Tech Stack:**
- Framework: Next.js 15.5.4 (Turbopack) with App Router (TypeScript)
- Styling: Tailwind CSS v4
- Testing: Vitest + @testing-library/react
- Deployment: Vercel
- Security: Cloudflare Turnstile CAPTCHA
- Data Source: GitHub Gist (hourly auto-deploy)

### Phase 5: Rust/WASM PDF+DOCX Engine - 🚧 IN PROGRESS

Building dual-format (PDF + DOCX) resume generation with Rust compiled to WebAssembly, featuring:
- Server-side heuristic bullet selection
- Client-side WASM document generation
- Beautiful progress UI with educational messaging
- Full observability and reconstruction capability

---

## Architecture Overview

### Data Flow (Security-Conscious)

```
┌─────────────────────────────────────────────────────────────┐
│ BUILD TIME (Server)                                          │
├─────────────────────────────────────────────────────────────┤
│ • prebuild hook: fetch-gist-data.js                         │
│ • Full resume-data.json cached at build time                │
│ • Server has complete data (never exposed to client)        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ USER INTERACTION                                             │
├─────────────────────────────────────────────────────────────┤
│ 1. User visits /resume page                                 │
│ 2. Sees role dropdown (from roleProfiles[])                 │
│ 3. Selects role (e.g., "Product Manager")                  │
│ 4. Clicks "Generate Resume"                                 │
│ 5. Turnstile CAPTCHA appears                                │
│ 6. User completes verification                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
                 POST /api/resume/prepare
         { roleId: "product-manager", turnstileToken }
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ SERVER (Next.js API Route)                                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Verify Turnstile token with Cloudflare                   │
│ 2. Rate limit check (5 generations/hour/IP)                 │
│ 3. Load resume-data.json from build-time cache              │
│ 4. Find RoleProfile by roleId                               │
│ 5. Extract all bullets from companies                       │
│ 6. Run heuristic selection:                                 │
│    • Score bullets (priority + tags + metrics)             │
│    • Apply diversity constraints                            │
│    • Select top 10-15 bullets                               │
│ 7. Build GenerationPayload:                                 │
│    {                                                         │
│      personal: PersonalInfo,        // Full contact info    │
│      selectedBullets: Bullet[],     // Only selected        │
│      roleProfile: RoleProfile,      // Role config          │
│      metadata: { ids, timestamp }                           │
│    }                                                         │
│ 8. Log to PostHog & N8N (store IDs for reconstruction)     │
│ 9. Return GenerationPayload to client                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ CLIENT (WASM Generation)                                     │
├─────────────────────────────────────────────────────────────┤
│ Progress UI:                                                │
│ ✨ "Initializing resume compiler..."          (~500ms)     │
│ 🧠 "Analyzing your curated experience..."     (~200ms)     │
│ 📄 "Generating PDF (ATS-optimized)..."        (~1500ms)    │
│ 📝 "Generating DOCX (Word format)..."         (~1200ms)    │
│ ⚡ "Finalizing downloads..."                  (~300ms)     │
│                                                              │
│ → Dual download: PDF + DOCX                                │
│ → Track completion in PostHog                               │
└─────────────────────────────────────────────────────────────┘
```

**Security Guarantees:**
- ✅ Full resume JSON stored server-side only (build-time cache)
- ✅ Client receives ONLY selected bullets post-curation
- ✅ Turnstile prevents automated abuse
- ✅ Rate limiting (5 generations/hour/IP)
- ✅ No client-side manipulation of selection

---

## Project Structure

```
resumate/
├── rust-pdf/                          # Rust/WASM workspace
│   ├── Cargo.toml                     # Workspace config
│   ├── crates/
│   │   ├── core/                      # Core types & selection
│   │   │   ├── Cargo.toml
│   │   │   └── src/
│   │   │       ├── lib.rs
│   │   │       ├── types.rs           # Data structures
│   │   │       ├── selector/          # Selection algorithms
│   │   │       │   ├── mod.rs
│   │   │       │   ├── heuristic.rs   # Rule-based selection
│   │   │       │   ├── scoring.rs     # Bullet scoring
│   │   │       │   └── diversity.rs   # Diversity constraints
│   │   │       └── validation.rs
│   │   │
│   │   ├── pdf/                       # PDF generation
│   │   │   ├── Cargo.toml
│   │   │   └── src/
│   │   │       ├── lib.rs
│   │   │       ├── generator.rs       # Main PDF builder
│   │   │       ├── layout/            # Layout engine
│   │   │       │   ├── mod.rs
│   │   │       │   ├── positioning.rs
│   │   │       │   ├── text_flow.rs   # Text wrapping
│   │   │       │   └── spacing.rs     # ATS compliance
│   │   │       └── rendering/         # Content rendering
│   │   │           ├── mod.rs
│   │   │           ├── header.rs
│   │   │           ├── experience.rs
│   │   │           └── footer.rs
│   │   │
│   │   ├── docx/                      # DOCX generation
│   │   │   ├── Cargo.toml
│   │   │   └── src/
│   │   │       ├── lib.rs
│   │   │       └── generator.rs
│   │   │
│   │   └── wasm/                      # WASM bindings
│   │       ├── Cargo.toml
│   │       └── src/
│   │           ├── lib.rs             # wasm_bindgen exports
│   │           ├── bridge.rs          # JS ↔ Rust
│   │           └── error.rs           # Error handling
│   │
│   ├── examples/
│   │   ├── reconstruct.rs             # CLI for PDF reconstruction
│   │   └── validate_types.rs          # CI type validation
│   │
│   └── fixtures/
│       └── sample_resume.json         # Test data
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx                       # Landing page
│   ├── api/
│   │   ├── contact-card/
│   │   │   └── route.ts               # vCard generation
│   │   └── resume/
│   │       └── prepare/
│   │           └── route.ts           # Curation + selection API
│   ├── resume/
│   │   ├── page.tsx                   # Resume generation page
│   │   └── view/
│   │       └── page.tsx               # Experience explorer
│   └── globals.css
│
├── components/
│   ├── data/                          # Explorer components
│   │   ├── DataExplorer.tsx
│   │   ├── CompanySection.tsx
│   │   ├── BulletCard.tsx
│   │   ├── TagFilter.tsx
│   │   └── SearchBar.tsx
│   ├── resume/                        # Generation components
│   │   ├── RoleSelector.tsx           # Role dropdown
│   │   ├── TurnstileGate.tsx          # CAPTCHA modal
│   │   ├── GenerationProgress.tsx     # Animated progress UI
│   │   └── PDFGenerator.tsx           # Main orchestration
│   └── ui/                            # Shared UI components
│       ├── Badge.tsx
│       ├── Button.tsx
│       ├── GlassPanel.tsx
│       └── ContactLinks.tsx
│
├── lib/
│   ├── wasm/                          # WASM integration
│   │   ├── loader.ts                  # Initialize WASM
│   │   ├── types.ts                   # TypeScript types
│   │   └── errors.ts                  # Error handling
│   ├── security/
│   │   ├── turnstile.ts               # Verification
│   │   └── rate-limit.ts              # Rate limiting
│   ├── analytics/
│   │   ├── posthog.ts                 # Event tracking
│   │   └── n8n.ts                     # Webhook integration
│   ├── utils.ts
│   ├── tags.ts                        # Tag utilities
│   └── vcard.ts                       # vCard generation
│
├── types/
│   └── resume.ts                      # TypeScript types (canonical)
│
├── scripts/
│   ├── fetch-gist-data.js             # Prebuild: fetch gist
│   ├── gist-push.js                   # Push local → gist
│   ├── gist-view.js                   # View gist
│   ├── codegen/
│   │   └── validate-types.ts          # CI: TS ↔ Rust validation
│   └── test/
│
├── data/
│   ├── resume-data.json               # Full resume (gitignored)
│   └── resume-data-template.json      # Template/schema
│
├── .github/
│   └── workflows/
│       └── gist-deploy-trigger.yml    # Hourly auto-deploy
│
├── middleware.ts                      # Security & rate limiting
└── .env.local                         # Secrets (gitignored)
```

---

## Data Structure

### Resume Data with Role Profiles

```json
{
  "personal": {
    "name": "Oliver Gilbey",
    "fullName": "Oliver James Gilbey",
    "nickname": "Ollie",
    "email": "email@example.com",
    "phone": "+1234567890",
    "location": "London - Central",
    "citizenship": ["South African", "British"],
    "linkedin": "olivergilbey",
    "github": "olliegilbey",
    "website": "ollie.gg",
    "calendar": "https://cal.com/ollie"
  },
  "summary": "Professional summary...",
  "tagline": "Motto or tagline",
  "companies": [
    {
      "id": "company-id",
      "name": "Company Name",
      "dateRange": "Jan 2022 – Present",
      "location": "Remote",
      "context": "Industry context",
      "positions": [
        {
          "id": "position-id",
          "role": "Role Title",
          "dateRange": "Jan 2022 – Present",
          "description": "Primary description",
          "descriptionTags": ["tag1", "tag2"],
          "descriptionPriority": 9,
          "bullets": [
            {
              "id": "bullet-id",
              "text": "Achievement text",
              "tags": ["tag1", "tag2"],
              "priority": 10,
              "metrics": "50% improvement",
              "context": "Additional context",
              "link": "https://example.com"
            }
          ]
        }
      ]
    }
  ],
  "skills": {
    "technical": ["Rust", "TypeScript", "Python"],
    "soft": ["Leadership", "Communication"]
  },
  "education": [
    {
      "degree": "Computer Science",
      "degreeType": "BSc",
      "institution": "University Name",
      "location": "Location",
      "year": "2020",
      "coursework": ["Course 1", "Course 2"],
      "societies": ["Society 1"]
    }
  ],
  "accomplishments": [
    {
      "id": "acc-id",
      "title": "Award Title",
      "description": "Description",
      "year": "2021",
      "tags": ["tag1"]
    }
  ],
  "interests": ["Interest 1", "Interest 2"],

  "roleProfiles": [
    {
      "id": "product-manager",
      "name": "Product Manager",
      "description": "Strategic product leadership with data-driven decision making",
      "primaryTags": ["product-management", "data-driven", "strategic-planning"],
      "secondaryTags": ["team-leadership", "cross-functional"],
      "targetBulletCount": 12
    },
    {
      "id": "developer-relations",
      "name": "Developer Relations",
      "description": "Technical advocacy and community building",
      "primaryTags": ["developer-relations", "community-building", "public-speaking"],
      "secondaryTags": ["technical-writing", "event-management"],
      "targetBulletCount": 14
    },
    {
      "id": "technical-leadership",
      "name": "Technical Leadership",
      "description": "Engineering leadership and architecture",
      "primaryTags": ["technical-leadership", "team-leadership", "architecture"],
      "secondaryTags": ["mentorship", "strategic-planning"],
      "targetBulletCount": 13
    }
  ]
}
```

**User Control:** Edit gist → update roleProfiles → automatic deploy → new roles appear in dropdown

---

## Data Structure & Type System

### Current Approach: Template as Pseudo-Schema

**Design Decision**: We use `data/resume-data-template.json` as the implicit schema for TypeScript type inference.

**How it works:**
- TypeScript infers JSON types from the template file at compile time
- `types/resume.ts` defines the explicit TypeScript interfaces
- Template must include ALL fields (even optional ones) for TypeScript to recognize them
- At build time, `resume-data.json` is fetched from gist and must match template structure

**Why this approach:**
- ✅ Simple - no additional dependencies or build steps
- ✅ Sufficient for single-user/small team use
- ✅ Template serves dual purpose: example + type inference source
- ❌ No runtime validation (relies on prebuild + TypeScript compile)
- ❌ Optional fields must exist in template (can be confusing)

**Future Enhancement Option:**
Consider migrating to JSON Schema + runtime validation if:
- Multiple contributors need strict validation
- Runtime data validation becomes critical
- Template/types sync becomes problematic

Potential tools: JSON Schema, Zod, or Ajv for runtime validation.

---

## Commands to Run

### Development
```bash
npm run dev               # Start dev server with Turbopack
npm run build             # Build for production (auto-fetches gist via prebuild)
npm run lint              # Run ESLint
npm run start             # Start production server
npm run test              # Run Vitest tests
npm run test:watch        # Watch mode
npm run test:ui           # Vitest UI
npx prettier --write <file>  # Format code (use for CSS, TypeScript, JSON)
```

### Data Management (Gist Integration)
```bash
npm run data:pull         # Fetch latest from GitHub Gist → local
npm run data:push         # Push local changes → Gist
npm run data:view         # View gist content in terminal

# Force flags for automation (skip interactive prompts)
npm run data:pull -- --force
npm run data:push -- --force
```

**⚠️ CRITICAL: Always Pull Before Editing Data**

**Claude MUST follow this workflow when editing `data/resume-data.json`:**

1. **ALWAYS run `npm run data:pull` FIRST** before any edits to sync gist → local
2. Edit the local file
3. Run `npm run data:push` to sync local → gist
4. **NEVER** edit the file without pulling first - this causes data loss!

**Safety Features:**
- `data:pull` warns if local differs from gist (prompts for confirmation)
- `data:push` warns if gist differs from local (prompts for confirmation)
- Use `--force` flag to skip prompts in automation/CI

**Conflict Resolution:**
- System uses "last write wins" - no automatic merging
- If conflict detected, scripts prompt user to confirm overwrite
- No merge conflicts, just simple replacement

### Rust/WASM
```bash
cd rust-pdf
cargo build               # Build Rust
cargo test                # Run tests
cargo test -- --nocapture # Tests with output
cargo bench               # Benchmarks

# Build WASM
cd crates/wasm
wasm-pack build --target web --out-dir ../../../public/wasm

# Reconstruction CLI
cargo run --example reconstruct -- \
  --generation-id abc-123 \
  --gist-url $RESUME_DATA_GIST_URL \
  --output-pdf resume.pdf \
  --output-docx resume.docx
```

### Validation
```bash
npm run validate:types    # TS ↔ Rust roundtrip test
cargo run --example validate_types < data/resume-data.json
```

### Deployment
```bash
vercel --prod      # Deploy to Vercel production
```

---

## Phase 5: Rust/WASM PDF+DOCX Engine (CURRENT)

### Implementation Plan

#### Phase 5.1: Foundation (8-10 hours)
**Tasks:**
1. Create Rust workspace structure
2. Configure Cargo.toml with dependencies
3. Add `roleProfiles` to resume-data.json
4. Manually write Rust types matching TypeScript
5. Create CI validation script
6. Write property-based tests for serialization

**Dependencies:**
```toml
[workspace.dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
pdf-writer = "0.9"
docx-rs = "0.4"
wasm-bindgen = "0.2"
chrono = "0.4"
thiserror = "1.0"
proptest = "1.0"  # Property-based testing
```

#### Phase 5.2: Server API + Security (6-8 hours)
**Create `/api/resume/prepare` route:**
1. Verify Turnstile token
2. IP-based rate limiting (5/hour)
3. Load resume data from build cache
4. Find matching RoleProfile
5. Run heuristic selection
6. Return `GenerationPayload`
7. Log to PostHog + N8N

**Rate Limiting:**
```typescript
// lib/security/rate-limit.ts
const store = new Map<string, number[]>()

export async function isRateLimited(
  ip: string,
  action: string,
  max: number,
  windowSec: number
): Promise<boolean>
```

#### Phase 5.3: Heuristic Selection (TDD) (8-10 hours)
**Scoring Algorithm:**
```rust
fn score_bullet(bullet: &Bullet, role: &RoleProfile) -> f64 {
    let priority_score = (bullet.priority as f64 / 10.0) * 0.3;

    let tag_matches = count_tag_matches(bullet, role);
    let tag_score = calculate_tag_relevance(tag_matches, role) * 0.6;

    let metrics_bonus = if bullet.metrics.is_some() { 0.1 } else { 0.0 };

    priority_score + tag_score + metrics_bonus
}
```

**Tests:**
- ✅ High priority bullets score well
- ✅ Tag matching increases score
- ✅ Metrics add bonus
- ✅ Diversity constraint (max 4 per company)
- ✅ Property tests (random inputs)

#### Phase 5.4: PDF Generation (10-12 hours)
**Using `pdf-writer` crate:**
1. Create `ResumeLayout` struct (shared with DOCX)
2. Implement header rendering (name, contact)
3. Implement experience section (grouped by company)
4. Add text wrapping
5. Implement footer
6. Test ATS compliance

**ATS Optimization:**
- ✅ Standard fonts (Helvetica/Arial)
- ✅ 10-12pt body text
- ✅ 1.15-1.25 line spacing
- ✅ Logical reading order
- ✅ No images in text

#### Phase 5.5: DOCX Generation (8-10 hours)
**Using `docx-rs` crate:**
1. Use same `ResumeLayout` as PDF
2. Match PDF structure exactly
3. Test content parity
4. Validate file size

**Consistency Test:**
```rust
#[test]
fn pdf_and_docx_content_matches() {
    let pdf_text = extract_text_from_pdf(&pdf_bytes);
    let docx_text = extract_text_from_docx(&docx_bytes);
    assert_eq!(pdf_text.trim(), docx_text.trim());
}
```

#### Phase 5.6: WASM Bindings (6-8 hours)
**Exports:**
```rust
#[wasm_bindgen]
pub fn generate_pdf_wasm(payload_json: &str) -> Result<Vec<u8>, JsValue>

#[wasm_bindgen]
pub fn generate_docx_wasm(payload_json: &str) -> Result<Vec<u8>, JsValue>
```

**Error Handling:**
```rust
#[derive(Debug, thiserror::Error)]
pub enum ResumeError {
    #[error("Invalid data: {0}")]
    InvalidData(String),

    #[error("PDF generation failed: {0}")]
    PDFError(String),

    #[error("DOCX generation failed: {0}")]
    DOCXError(String),
}
```

#### Phase 5.7: Next.js Integration + UX (8-10 hours)
**Components:**
1. `RoleSelector` - Dropdown from roleProfiles
2. `TurnstileGate` - CAPTCHA modal
3. `GenerationProgress` - 5-step animated UI
4. `PDFGenerator` - Main orchestration

**Progress Steps:**
1. ✨ Initializing resume compiler (WASM loading)
2. 🧠 Analyzing curated experience (validation)
3. 📄 Generating PDF (ATS-optimized)
4. 📝 Generating DOCX (Word format)
5. ⚡ Finalizing downloads (blob creation)

#### Phase 5.8: Observability + CLI (6-8 hours)
**Generation Record (stored in N8N/Airtable):**
```typescript
interface GenerationRecord {
  id: string
  timestamp: string
  role: string
  method: 'heuristic' | 'ai'

  // Reconstruction data
  selectedBulletIds: string[]
  roleProfileSnapshot: RoleProfile

  // Metadata
  bulletCount: number
  companies: string[]
  tags: string[]

  // Analytics
  userAgent: string
  locationCity: string
  sessionReplayUrl: string
}
```

**Reconstruction CLI:**
```bash
cargo run --example reconstruct -- \
  --generation-id abc-123 \
  --output-pdf resume.pdf
```

#### Phase 5.9: Testing + Polish (4-6 hours)
1. Test all role profiles
2. Compare PDF and DOCX side-by-side
3. Run ATS checker tools
4. Performance profiling
5. Fix visual inconsistencies

**Total: 60-76 hours (~2-3 weeks)**

---

## Type Synchronization Strategy

### Approach: Template-as-Schema

**Process:**
1. `types/resume.ts` is canonical source
2. Developer manually writes matching Rust types
3. CI validates roundtrip: JSON → TS → Rust → JSON

**CI Validation:**
```typescript
// scripts/codegen/validate-types.ts
const json = JSON.stringify(mockResumeData)
const rustOutput = execSync('cargo run --example validate_types', { input: json })
const rustParsed = JSON.parse(rustOutput.toString())
assert.deepStrictEqual(mockResumeData, rustParsed)
```

**Trade-off:**
- **Pro:** Simple, no magic, clear ownership
- **Con:** Manual sync (but CI catches errors)

---

## Security & Performance Targets

### Security
- ✅ Full resume server-side only
- ✅ Turnstile verification required
- ✅ Rate limiting (5/hour/IP)
- ✅ Server-side selection (no client manipulation)
- ✅ All generations logged

### Performance
- ✅ Total time: <5s (target: 2-3s)
- ✅ WASM bundle: <600KB
- ✅ API response: <300ms
- ✅ Selection: <100ms
- ✅ PDF generation: <1.5s
- ✅ DOCX generation: <1.2s

### Quality
- ✅ 100+ tests passing
- ✅ TypeScript ↔ Rust validated
- ✅ PDF and DOCX visually consistent
- ✅ ATS-compliant output
- ✅ Reconstruction CLI works

---

## Future Phases

### Phase 6: Claude API Integration (Days 27-35)

**Easy Migration:**
```typescript
// app/api/resume/prepare/route.ts

async function selectBullets(bullets, roleProfile, jobDescription?) {
  if (jobDescription) {
    // AI-powered selection
    return await claudeAPISelection(bullets, roleProfile, jobDescription)
  } else {
    // Rule-based selection
    return await heuristicSelection(bullets, roleProfile)
  }
}
```

**UI Addition:**
- Optional textarea for job description
- If provided → Claude API route
- If empty → heuristic route
- Both return same structure → same WASM generation path

**Security:**
- Input sanitization (max 5000 chars)
- Injection pattern detection
- Rate limiting (5/hour/IP)
- Cost control (Anthropic spending cap)

### Phase 7: PostHog Analytics (Ongoing)

**Events:**
```typescript
posthog.capture('resume_generated', {
  role: 'product-manager',
  format: 'pdf+docx',
  bulletCount: 12,
  generationTime: 2340,
  method: 'heuristic'
})

posthog.capture('tag_filter_applied', {
  tags: ['leadership', 'blockchain'],
  resultsCount: 15
})

posthog.capture('calendar_link_clicked', {
  source: 'landing_page'
})
```

### Phase 8: N8N Notifications (Ongoing)

**Workflow:**
```
Resume Generated (PostHog) → N8N Webhook
    ↓
1. Enrich with session replay URL
2. Store in Airtable/Notion
3. Send Slack/Telegram notification
```

**Notification Format:**
```
🎯 New Resume Downloaded

Role: Developer Relations
Format: PDF + DOCX
Location: San Francisco, US
Device: Desktop - Chrome

📊 View Session: [link]
📄 Bullets: [list of IDs]
```

---

## Design System

### Colors (Tailwind)
- Primary: blue-600
- Background: slate-50
- Cards: white with slate-200 borders
- Text: slate-900 (headings), slate-600 (body)
- Tags: Various pastels (blue-100, green-100, purple-100, etc.)

### Typography
- Headings: font-semibold, tracking-tight
- Body: font-normal, leading-relaxed
- Bullet text: text-base, leading-7
- Meta info: text-sm, text-slate-500

---

## Code Quality & Documentation Standards

### TypeScript & JSDoc Best Practices

**Current Approach**: TypeScript provides primary type safety; JSDoc is minimal.

**When to use JSDoc:**
- ✅ Public API functions/components used by other developers
- ✅ Complex business logic requiring explanation
- ✅ Non-obvious function behavior or edge cases
- ❌ Simple utility functions (TypeScript types are sufficient)
- ❌ React components with clear prop types
- ❌ Internal implementation details

**Example - Good JSDoc usage:**
```typescript
/**
 * Generate a vCard (VCF) file content string
 * Following vCard 3.0 specification
 */
export function generateVCard(data: VCardData): string {
  // Implementation...
}
```

**Example - TypeScript is enough:**
```typescript
// Good - no JSDoc needed, types are clear
function getInitials(name: string): string {
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
}
```

**Pre-commit Checks:**
All commits are automatically checked by Husky + lint-staged:
- TypeScript compilation (`tsc --noEmit`) - catches type errors
- ESLint with auto-fix - enforces code style
- Files must pass both checks to commit

This prevents build-breaking commits from reaching CI/Vercel.

### CodeRabbit CLI

This project uses [CodeRabbit](https://coderabbit.ai) for AI-powered code reviews. Claude Code and Warp should run this extensively when making changes.

**Installation**:
```bash
npm install -g @coderabbit/cli
coderabbit auth
```

**Commands**:
```bash
# Review uncommitted changes with context from CLAUDE.md
coderabbit review --plain --type uncommitted --config CLAUDE.md

# Review all files
coderabbit review --plain --type all

# Review committed changes
coderabbit review --plain --type committed --config CLAUDE.md

# Check specific files
coderabbit review --plain --type uncommitted --files "app/**/*.tsx"
```

**When to run**:
- ✅ Before committing (check for issues, security vulnerabilities)
- ✅ After major refactors (verify quality, catch regressions)
- ✅ When stuck or debugging (get AI suggestions)
- ✅ Regular check-ins (maintain code health, spot patterns)
- ✅ Before opening PRs (ensure review-ready code)

**Why use it**:
- Catches security issues, race conditions, accessibility problems
- Suggests performance improvements
- Identifies code smells and anti-patterns
- Provides context-aware suggestions (uses CLAUDE.md for project understanding)
- Faster than manual review, more thorough than linters

**Integration**:
Both Claude Code and Warp editors should invoke CodeRabbit:
- When making significant changes
- Before marking tasks as complete
- When quality concerns arise
- As part of the development workflow

### Code Quality & Formatting

**Always use Prettier for formatting** - saves tokens and ensures consistency:
```bash
npx prettier --write <file>  # Format specific file
npx prettier --write app/    # Format directory
```

Use prettier instead of manual formatting for:
- CSS/SCSS files (especially after large edits)
- TypeScript/JavaScript
- JSON files
- Markdown

---

## Development Workflow & Guidelines

### Error Detection Strategy
**Key principle**: Claude proactively catches errors before user testing whenever possible.

**When Claude makes changes:**
- **Automatic type-checking** before major refactors: `npx tsc --noEmit`
- **Lint checks** when modifying multiple files: `npm run lint`
- **Proactive validation** for TypeScript interface changes, new imports, or dependency updates

**User's role:**
- Keep `npm run dev` running in terminal (monitor for errors)
- Watch browser for error overlay (Next.js shows red screen with stack trace)
- Report any errors to Claude with terminal output or browser console logs

### Development Server Behavior

**Hot Module Replacement (HMR)** - Auto-updates without refresh:
- ✅ React components (.tsx, .jsx)
- ✅ Tailwind CSS classes
- ✅ Page routes (app/ directory)
- ✅ Most TypeScript changes

**Requires browser refresh** (`Cmd + R`):
- 🔄 API route changes (app/api/)
- 🔄 Middleware changes (middleware.ts)
- 🔄 Environment variable changes (.env.local)

**Requires hard refresh** (`Cmd + Shift + R` or `Shift + Click` refresh):
- 💪 CSS seems stuck/cached
- 💪 Static assets not updating
- 💪 Cloudflare Turnstile widget issues

**Requires dev server restart** (`Ctrl+C` then `npm run dev`):
- ⚙️ next.config.js changes
- ⚙️ tailwind.config.ts changes
- ⚙️ New environment variables added
- ⚙️ Package installations (npm install)

**NEVER needed in development:**
- ❌ `npm run build` (only for production testing/deployment)
- ❌ Vercel handles builds automatically on deploy

### Claude's Responsibilities
1. Run type-checks proactively when making structural changes
2. Inform user of expected refresh behavior after edits
3. Validate code before user begins testing
4. Fix errors as they arise based on user feedback

### User's Responsibilities
1. Monitor terminal output for red text/errors
2. Check browser DevTools console when needed
3. Share error messages with Claude for rapid fixing
4. Test UI/UX behavior after changes

**Goal**: User experiences minimal errors during testing; Claude catches issues preemptively.

### Testing Philosophy
- **TDD for Rust** - Write tests first, then implementation
- **Property-based tests** for type validation (proptest)
- **Integration tests** for full PDF/DOCX generation
- **Visual parity tests** - Compare PDF and DOCX output

---

## Deployment

**Status:** Deployed to ollie.gg via Vercel with full gist integration and auto-deploy.

### Environment Variables

Required environment variables (see `.env.example` for template):

**Server-Side Only:**
- `CONTACT_EMAIL_PERSONAL` - Your primary email address
- `CONTACT_EMAIL_PROFESSIONAL` - Your work/professional email address
- `CONTACT_PHONE` - Your phone number (international format)
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile secret key
- `RESUME_DATA_GIST_URL` - GitHub Gist raw URL for resume data
- `N8N_WEBHOOK_URL` - N8N webhook for notifications (Phase 8)

**Client-Side (Public):**
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Cloudflare Turnstile site key

**Setup Instructions:**
1. Copy `.env.example` to `.env.local`
2. Sign up for [Cloudflare Turnstile](https://dash.cloudflare.com/turnstile)
3. Create a "Managed" widget with "Invisible" mode
4. Copy site key and secret key to `.env.local`
5. Add your contact information

**Security Note:** Phone and email are NEVER exposed to the client. They're only used server-side in the vCard generation API route.

### Vercel Setup

1. **Environment Variables** - Set using Vercel CLI with `printf` to avoid newlines:
   ```bash
   printf "%s" "value" | vercel env add VAR_NAME production
   ```
   Required vars: `CONTACT_EMAIL_PERSONAL`, `CONTACT_EMAIL_PROFESSIONAL`, `CONTACT_PHONE`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RESUME_DATA_GIST_URL`

2. **GitHub Action Secrets** - For auto-deploy workflow:
   - `VERCEL_TOKEN` - API token from https://vercel.com/account/tokens
   - `VERCEL_PROJECT_ID` - From `vercel project inspect`
   - `VERCEL_DEPLOY_HOOK_URL` - Deploy hook from Vercel dashboard

3. **Deploy Command**:
   ```bash
   vercel --prod
   ```

### Auto-Deploy Architecture

#### How Deployments Are Triggered

**1. Git Push to GitHub (Standard Vercel Behavior):**
- Vercel watches your main branch automatically
- Any push to `main` triggers automatic deployment
- This is the standard Vercel GitHub integration

**2. Gist Updates (Hourly Auto-Deploy):**
- **Workflow**: `.github/workflows/gist-deploy-trigger.yml`
- **Schedule**: Runs every hour at minute 0 (cron: `0 * * * *`)
- **Can also trigger manually** from GitHub Actions UI

**Hourly Check Process:**
1. Fetch gist metadata from GitHub API
2. **Validate JSON format** with `jq` (fail-fast if invalid)
3. Query Vercel API for last deployment timestamp
4. Compare gist `updated_at` vs Vercel last deploy time
5. If gist is newer → trigger Vercel deploy hook
6. If JSON invalid → fail with error, skip deploy

**3. Manual Deployment:**
- Run `vercel --prod` locally
- Or trigger deploy from Vercel dashboard UI

#### Important Notes

- **No git commits required** - timestamps tracked via Vercel API, not repo state
- **Prebuild always fetches gist** - `package.json` has `"prebuild": "node scripts/fetch-gist-data.js --force"`
- **Gist filename must be** `resume-data.json` (generic for all users)
- **JSON validation is strict** - malformed JSON blocks deployment to prevent build failures

### Checklist
- ✅ Deployed to ollie.gg
- ✅ Environment variables set correctly (no newlines!)
- ✅ GitHub Action running hourly
- ✅ JSON validation in workflow
- ✅ Turnstile working on production
- ✅ Auto-deploy tested and functional

---

## Technical Showcases

This project demonstrates:

1. **Rust/WASM** - Systems programming compiled to run in browser
2. **Type Safety** - Rust + TypeScript with validated boundaries
3. **Security** - Turnstile, rate limiting, server-side validation
4. **Performance** - Sub-5s generation, optimized WASM
5. **Testing** - TDD, property-based tests, 100+ test coverage
6. **Analytics** - PostHog events, N8N automation, full observability
7. **AI Integration** - Human-written content, AI-curated selection
8. **Growth Engineering** - Data-driven iteration based on recruiter behavior

---

## License & Contribution

**Status:** Personal project, will be open-sourced

**Philosophy:** This codebase serves as a living demonstration of technical capabilities. Every design decision prioritizes correctness, clarity, and craftsmanship.
