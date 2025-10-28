## Phase 5: Rust/WASM PDF+DOCX Engine (CURRENT)

### Implementation Plan

#### Phase 5.0: Schema Infrastructure Switch (4-6 hours) - IN PROGRESS

**Goal:** Migrate from template-as-pseudo-schema to Valibot + typeshare for proper type generation and runtime validation.

**Objectives:**
- ✅ Single source of truth: `schema/resume.ts`
- ✅ TypeScript types inferred from Valibot schemas
- ✅ Rust types generated via typeshare (TS → Rust codegen)
- ✅ Runtime validation at all checkpoints (pre-commit, gist push/pull, build)
- ✅ Add hierarchy fields (`companyTags`, `companyPriority`, `scoringWeights`)

**Tasks:**

**5.0.1: Install Dependencies**
```bash
bun install valibot
bun install -D typeshare-cli  # OR cargo install typeshare-cli (verify method)
```

**5.0.2: Create `schema/resume.ts`**
- Convert existing TypeScript types to Valibot schemas
- Define all types: `PersonalInfo`, `Company`, `Position`, `BulletPoint`, `RoleProfile`, etc.
- Add custom validations (e.g., `scoringWeights` sum to 1.0)
- Example structure:
```typescript
import * as v from 'valibot';

export const ScoringWeightsSchema = v.pipe(
  v.object({
    tagRelevance: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
    priority: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  }),
  v.check(
    (data) => Math.abs((data.tagRelevance + data.priority) - 1.0) < 0.001,
    'tagRelevance + priority must sum to 1.0'
  )
);

export type ScoringWeights = v.InferOutput<typeof ScoringWeightsSchema>;
```

**5.0.3: Add Hierarchy Fields to Schema**
- `Company`: Add `companyTags?: string[]`, `companyPriority?: number (1-10)`
- `RoleProfile`: Add `scoringWeights: ScoringWeights`
- `RoleProfile`: Add optional `scoringMode?: "flat" | "hierarchical"`

**5.0.4: Create `types/resume.ts`**
```typescript
// Re-export only types (not schemas) for app usage
export type {
  ResumeData,
  PersonalInfo,
  Company,
  Position,
  BulletPoint,
  RoleProfile,
  ScoringWeights,
} from '../schema/resume';
```

**5.0.5: Configure typeshare**
- Research typeshare CLI usage (npm vs cargo install)
- Create script to generate Rust types from `schema/resume.ts`
- Ensure output path: `doc-gen/crates/core/src/types.rs`
- Verify `#[serde(rename_all = "camelCase")]` is added

**5.0.6: Create `scripts/validate-resume-data.js`**
```javascript
import * as v from 'valibot';
import { ResumeDataSchema } from '../schema/resume.js';
import fs from 'fs';

const filepath = process.argv[2];
const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
const result = v.safeParse(ResumeDataSchema, data);

if (!result.success) {
  console.error('\n❌ Resume data validation failed:\n');
  const issues = v.flatten(result.issues);
  console.error(JSON.stringify(issues, null, 2));
  process.exit(1);
}

console.log('✅ Resume data is valid');
```

**5.0.7: Update `scripts/gist-push.js`**
- Import validation from `validate-resume-data.js`
- Add validation before push (replace current JSON.parse check)
- Fail if validation fails

**5.0.8: Update `scripts/fetch-gist-data.js`**
- Import validation from `validate-resume-data.js`
- Add validation after fetch (replace current JSON.parse check)
- Warn if validation fails (don't block pull, but log issues)

**5.0.9: Update `.husky/pre-commit` and `lint-staged`**
```json
{
  "lint-staged": {
    "schema/resume.ts": [
      "eslint --fix",
      "just types-schema",
      "git add doc-gen/crates/core/src/types.rs"
    ],
    "data/*.json": [
      "node scripts/validate-resume-data.js"
    ],
    "*.{ts,tsx}": [
      "eslint --fix",
      "bash -c 'just check-ts'"
    ],
    "doc-gen/**/*.rs": [
      "bash -c 'cd doc-gen && cargo fmt --all'",
      "bash -c 'cd doc-gen && cargo clippy --all -- -D warnings'"
    ]
  }
}
```

**5.0.10: Add npm scripts**
```json
{
  "scripts": {
    "generate:rust-types": "typeshare schema/resume.ts --lang=rust --output-file=doc-gen/crates/core/src/types.rs && cd doc-gen && cargo fmt",
    "validate:data": "node scripts/validate-resume-data.js data/resume-data.json",
    "validate:template": "node scripts/validate-resume-data.js data/resume-data-template.json"
  }
}
```

**5.0.11: Generate Initial Rust Types**
- Run `just types-schema`
- Verify output in `doc-gen/crates/core/src/types.rs`
- Check `#[serde(rename_all = "camelCase")]` is present
- Manually add if missing

**5.0.12: Update Template**
- Edit `data/resume-data-template.json`
- Add `companyTags`, `companyPriority` to example companies
- Add `scoringWeights` to all roleProfiles
- Run validation to ensure template is valid

**5.0.13: Migrate Actual Data**
- Run `just data-pull` to get latest
- Add hierarchy fields to your actual `data/resume-data.json`:
  - Add `companyTags` and `companyPriority` to each company
  - Add `scoringWeights: { tagRelevance: 0.6, priority: 0.4 }` to each roleProfile
- Run validation locally

**5.0.14: Test Validation**
- Run `just data-validate-template` - should pass
- Run `just data-validate` - should pass
- Test with intentionally broken data (weights sum to 0.8) - should fail with good error

**5.0.15: Test Roundtrip**
- Run existing `cargo test` in doc-gen
- Verify roundtrip test passes (TS → JSON → Rust → JSON → TS)
- Fix any serialization issues

**5.0.16: Refactor App Imports**
- Search codebase for `from 'types/resume'` or `from '@/types/resume'`
- Verify all use type imports (not schema imports)
- Update any direct type definitions to use generated types

**5.0.17: Test Full Build**
- `just dev` - should start without errors
- `just check-ts` - should pass
- `just build` - should complete (will fetch gist and validate)
- Browse app - should work normally

**5.0.18: Push to Gist**
- Run `just data-push` - validation should pass, push to gist
- Verify gist contains new hierarchy fields

**5.0.19: Document Conventions**
- Create `NAMING_CONVENTIONS.md` with:
  - camelCase (TS/JSON) ↔ snake_case (Rust)
  - Hierarchy field naming (`company*`, `description*`)
  - Optional field patterns
  - ID field conventions

**5.0.20: Commit Everything**
```bash
git add schema/ types/ scripts/ package.json lint-staged.config.js \
  doc-gen/crates/core/src/types.rs data/resume-data-template.json NAMING_CONVENTIONS.md

git commit -m "feat: Migrate to Valibot + typeshare schema infrastructure

- Add schema/resume.ts as single source of truth (Valibot schemas)
- Generate Rust types via typeshare (TS → Rust codegen)
- Add runtime validation at all checkpoints (pre-commit, gist, build)
- Add hierarchy fields: companyTags, companyPriority, scoringWeights
- Update validation scripts to use Valibot (excellent error messages)
- Document naming conventions (camelCase ↔ snake_case)

Breaking changes:
- resume-data.json now requires scoringWeights in roleProfiles
- Rust types now generated (was hand-written)
"
```

**Architecture:**
```
schema/resume.ts (Valibot schemas - source of truth)
    ↓
    ├─→ TypeScript types (inferred via v.InferOutput)
    ├─→ Valibot validation (0.7KB runtime)
    └─→ typeshare → Rust types (generated)
```

**Naming Convention:**
- **TypeScript:** camelCase (`companyTags`, `scoringWeights`)
- **Rust:** snake_case (`company_tags`, `scoring_weights`)
- **JSON:** camelCase (web standard)
- **Mapping:** `#[serde(rename_all = "camelCase")]` in Rust handles conversion

**Validation Points:**
- Pre-commit: Validates `data/*.json` against schema
- Gist push: Validates before uploading
- Gist pull: Validates after fetching
- Build: Validates during prebuild (blocks deploy if invalid)

**Dependency Note:**
typeshare installation needs verification - may be npm package or cargo install. Adjust 5.0.1 and 5.0.5 accordingly.

**Estimated Time:** 4-6 hours

---

#### Phase 5.1: Foundation (8-10 hours) - COMPLETED
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

#### Phase 5.10: Typst Migration (18-26 hours) - PLANNED

**Goal:** Migrate from manual pdf-writer PDF generation to Typst-based typesetting system for professional-quality documents with automatic layout.

**Why Typst:**
- ✅ Automatic multi-page layout (eliminates manual Y-coordinate calculations)
- ✅ Professional typography out-of-the-box
- ✅ Template-based design (easier to iterate)
- ✅ Modern Rust-based system
- ✅ Compiles to WASM (~2-5MB vs 220KB, but worth it)
- ✅ **Much more impressive technically** - shows off advanced WASM integration

**Decision Points:**
- ✅ Compile Typst to WASM ourselves (vs using typst.ts npm packages)
- ✅ Complete replacement of pdf-writer (no fallback)
- ✅ PDF only (remove DOCX generation)

**Tasks:**

**5.10.1: Remove Old Crates** ✅ COMPLETED
- ✅ Deleted `doc-gen/crates/pdf/` entirely
- ✅ Deleted `doc-gen/crates/docx/` entirely
- ✅ Updated `doc-gen/Cargo.toml` workspace members (never included)

**5.10.2: Create Typst Crate**
- Create `doc-gen/crates/typst/` structure
- Add Typst dependencies to workspace Cargo.toml
- Create `doc-gen/crates/typst/Cargo.toml`
- Download and embed fonts (Linux Libertine, etc.)

**5.10.3: Implement Typst Template**
- Create `doc-gen/crates/typst/templates/resume.typ`
- Design professional layout (ATS-friendly, clean typography)
- Add date formatting helpers
- Implement dev mode metadata page

**5.10.4: Rust Typst Integration**
- Implement `doc-gen/crates/typst/src/compiler.rs` (Typst world wrapper)
- Implement `doc-gen/crates/typst/src/lib.rs` (public API)
- Implement `doc-gen/crates/typst/src/template.rs` (data preparation)
- Implement `doc-gen/crates/typst/src/fonts.rs` (embedded font loading)

**5.10.5: Update WASM Bindings**
- Update `doc-gen/crates/wasm/Cargo.toml` (replace pdf/docx with typst)
- Update `doc-gen/crates/wasm/src/lib.rs` (new `generate_pdf_typst` export)
- Remove old PDF/DOCX functions

**5.10.6: Frontend Integration**
- Update `components/data/ResumeDownload.tsx`
- Change to `generate_pdf_typst` function call
- Update loading messages for Typst
- Test WASM loading and PDF generation

**5.10.7: Testing**
- Write Rust unit tests for Typst crate
- Write integration tests (all role profiles)
- Test WASM compilation
- Manual browser testing
- Performance benchmarks

**5.10.8: Documentation**
- Create `docs/TYPST_MIGRATION.md` ✅ (DONE)
- Mark `docs/PDF_RENDERING_SPEC.md` as deprecated ✅ (DONE)
- Update `docs/ARCHITECTURE.md` ✅ (DONE)
- Update `doc-gen/CLAUDE.md` (pending)
- Update README.md tech stack

**📄 See:** [docs/TYPST_MIGRATION.md](./TYPST_MIGRATION.md) for complete specification and implementation guide.

**Estimated Time:** 18-26 hours across 5 sessions
**Current Status:** Planning complete, ready for implementation

---

### 🚧 CHECKPOINT: Paused at Phase 5.3.1 (2025-10-07)

**Context:** We paused mid-implementation to address schema infrastructure needs.

**What We Were Doing:**
- Task: Phase 5.3.1 - Writing TDD tests for hierarchical bullet scoring algorithm
- Updated TypeScript types: Added `ScoringWeights` interface and updated `RoleProfile`
- Updated Rust types: Added `ScoringWeights` struct with validation logic (weights must sum to 1.0)
- Made `role_profiles` required in `ResumeData` (was previously `Option<Vec<RoleProfile>>`)

**Key Architectural Decisions Made:**
1. **Dropped metrics from scoring** - Metrics are human-readable strings ("10x improvement"), not structured data we can score algorithmically
2. **Configurable 60/40 weights** - Tag relevance vs priority split stored in JSON per role profile, allowing experimentation
3. **Hierarchical scoring needed** - Company × Position × Bullet multiplicative scoring to model real recruiter behavior
4. **Dual curation paths**:
   - **Heuristic** (Phase 5): Free, instant, dropdown presets like "DevRel Lead" or "Product Manager"
   - **AI** (Phase 8): Claude API integration, $0.02/request, custom job description input

**Hierarchical Scoring Rationale:**
- Same bullet at "Google Staff Engineer" vs "Startup Junior Dev" should score very differently
- Recruiters scan: Company name → Job title → Bullets (in that order)
- Context (company prestige + position seniority) sets frame for bullet value
- AI can test both with/without metadata to optimize prompt engineering
- Heuristic scores provide validation/fallback for AI selections

**Why We Paused:**
- Schema complexity growing (hierarchy fields, validation rules, optional vs required fields)
- Need JSON Schema as single source of truth for type generation
- Need to add `companyTags`, `companyPriority` to support hierarchical scoring
- Need runtime validation with excellent error messages (e.g., "scoringWeights sum to 0.8, expected 1.0")
- Need to audit field naming consistency across codebase
- Explorer's tag filtering might benefit from hierarchy logic

**Next Steps - Schema & Hierarchy Sidequest (Phase 5.0):**
1. Establish JSON Schema infrastructure
2. Add hierarchy fields to data structure (`companyTags`, `companyPriority`)
3. Generate TypeScript + Rust types from schema
4. Add runtime validation to all JSON operations (pre-commit, gist push/pull, build)
5. Resume Phase 5.3.1 with proper foundation

---

### Phase 5 Progress Tracker

**✅ Completed (10 tasks):**
- ☒ 5.1.1: Initialize Rust workspace (doc-gen/) with 4 crates structure
- ☒ 5.1.2: Define core Rust types matching TypeScript (ResumeData, BulletPoint, RoleProfile)
- ☒ 5.1.3: Add CI validation roundtrip test (TS→JSON→Rust→JSON→TS)
- ☒ 5.1.4: Set up wasm-pack build pipeline
- ☒ 5.1.5: Add Rust pre-commit hooks (cargo fmt, cargo clippy)
- ☒ 5.2.1: Create /api/resume/prepare route with Turnstile verification
- ☒ 5.2.2: Implement rate limiting (5/hour/IP) in API route
- ☒ 5.2.3: Add server-side resume-data.json loading from build cache
- ☒ 5.2.4: Add personalized roleProfiles to resume-data.json
- ☒ 5.2.5: Add JSON validation to pre-commit hooks and gist push

**⏸️ Paused (1 task):**
- ⏸️ 5.3.1: Write TDD tests for bullet scoring algorithm (PAUSED - awaiting schema work)

**⏳ Pending (26 tasks):**
- ☐ 5.3.2: Implement heuristic selection algorithm (tag relevance + priority, hierarchical)
- ☐ 5.3.3: Add permutation testing for all role profiles
- ☐ 5.3.4: Integrate selection algorithm into API route
- ☐ 5.4.1: Design ResumeLayout shared struct (spacing, fonts, margins)
- ☐ 5.4.2: Implement PDF generation with pdf-writer crate
- ☐ 5.4.3: Add ATS optimization (standard fonts, proper spacing, reading order)
- ☐ 5.4.4: Write visual regression tests for PDF output
- ☐ 5.5.1: Implement DOCX generation with docx-rs crate using ResumeLayout
- ☐ 5.5.2: Ensure visual parity between PDF and DOCX formats
- ☐ 5.5.3: Add DOCX-specific optimizations (Word compatibility)
- ☐ 5.6.1: Create wasm_bindgen exports for generatePDF and generateDOCX
- ☐ 5.6.2: Implement error handling for WASM (Result → JS Promise)
- ☐ 5.6.3: Optimize WASM bundle size (<500KB gzipped target)
- ☐ 5.7.1: Build RoleSelector component with role profiles dropdown
- ☐ 5.7.2: Build TurnstileGate component for verification
- ☐ 5.7.3: Build GenerationProgress component with 5-step animated UI
- ☐ 5.7.4: Build PDFGenerator component orchestrating WASM calls
- ☐ 5.7.5: Add dual-download functionality (PDF + DOCX simultaneous)
- ☐ 5.8.1: Add PostHog event tracking (resume_generated, resume_prepared)
- ☐ 5.8.2: Create /api/resume/log route for metadata storage
- ☐ 5.8.3: Build Rust CLI reconstruction tool (resumate-rebuild)
- ☐ 5.8.4: Set up N8N webhook integration for notifications
- ☐ 5.9.1: Write integration tests for full generation flow
- ☐ 5.9.2: Add E2E tests with Playwright (Turnstile → download)
- ☐ 5.9.3: Performance testing (WASM init <500ms, generation <5s)
- ☐ 5.9.4: Polish UI animations and error states

**Progress: 10/37 tasks (27% complete)**

---

