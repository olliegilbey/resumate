# Project Status

**Last Updated:** 2025-10-22

---

## Phase 1: Foundation & Data Explorer - ✅ COMPLETE

### Completed Features
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

### Tech Stack
- **Framework:** Next.js 15.5.4 (Turbopack) with App Router (TypeScript)
- **Styling:** Tailwind CSS v4
- **Testing:** Vitest + @testing-library/react
- **Deployment:** Vercel
- **Security:** Cloudflare Turnstile CAPTCHA
- **Data Source:** GitHub Gist (hourly auto-deploy)

---

## Phase 5: Rust/WASM PDF Engine - 🚧 IN PROGRESS

### Overview
Building professional PDF resume generation with Rust compiled to WebAssembly, featuring:
- **Typst-based PDF generation** (replaced manual pdf-writer approach)
- Server-side heuristic bullet selection
- Client-side WASM document generation
- Beautiful progress UI with educational messaging
- Full observability and reconstruction capability

**Note:** DOCX generation was removed in favor of focusing on high-quality PDF output via Typst. Users can convert PDF to DOCX if needed.

### Completed (as of 2025-10-08)
- ✅ **Phase 5.0:** Schema infrastructure switch
  - Rust types as source of truth with schemars
  - JSON Schema generation from Rust
  - TypeScript codegen from JSON Schema
  - Validation pipeline (ajv + schema)

- ✅ **Phase 5.3.1:** TDD tests for hierarchical bullet scoring
  - 14 scoring algorithm tests
  - Tag relevance, company multipliers, position multipliers
  - End-to-end bullet scoring with hierarchical weights

- ✅ **Phase 5.3.2:** Heuristic selection algorithm
  - Bullet selection with diversity constraints
  - 7 selector tests
  - Configurable limits (max bullets, max per company/position)

- ✅ **Phase 5.3.3:** Permutation testing for all role profiles
  - 8 integration tests across all 6 role profiles
  - Real resume data validation
  - Deterministic selection verification

- ✅ **Phase 5.3.4:** API route integration
  - POST /api/resume/select endpoint
  - Rate limiting (10 req/hour per IP)
  - TypeScript implementation of Rust algorithm
  - Test script for validation

- ✅ **Phase 5.X:** Resume data schema transformation
  - Added company priorities (1-10 scale) to all companies
  - Added company tags for hierarchical scoring
  - Validated and pushed to gist
  - Frontend tested and working

- ✅ **Phase 5.T.1:** Comprehensive test expansion (Phases 1-3)
  - Expanded Rust PDF tests from 30 to 236 tests
  - Expanded TypeScript tests from 48 to 125 tests
  - Added 7 PDF permutation tests
  - Added 13 API route unit tests
  - Added 34 vCard utility tests
  - Added 30 rate limiting tests
  - Added 8 property-based tests for scoring invariants
  - Added 132 PDF generation tests (header, body, footer, layout)
  - Added 20 WASM binding tests with edge cases
  - Total: **361 tests passing**

- ✅ **Phase 5.4:** Typst PDF Generation Migration (2025-10-18)
  - Migrated from manual pdf-writer to Typst typesetting system
  - Automatic pagination and layout management
  - Professional typography with embedded fonts
  - ATS-optimized output with proper hierarchy
  - Template-based design (resume.typ)
  - Sub-1s generation time in WASM

- ✅ **Phase 5.5:** Build Automation & Performance (2025-10-20)
  - Created comprehensive justfile with 40+ targets
  - Fixed build performance regression (24s → 7.5s, 66% faster!)
  - Added Rust patterns to .gitignore (target/, *.rs.bk, pkg/)
  - Excluded target/ from TypeScript scanning (tsconfig.json)
  - Root cause: Next.js scanning 6.6GB Rust build cache

- ✅ **Phase 5.6:** WASM Bindings with Typst Integration (2025-10-22)
  - wasm-bindgen exports for browser integration
  - generate_pdf_typst(payload_json, dev_mode) → PDF bytes
  - Utility exports: validate_payload_json, version, build_info, estimate_pdf_size
  - 32 WASM-specific tests (validation, edge cases, complex payloads)
  - wasm-opt automatic optimization (-Oz, bulk-memory, nontrapping-float-to-int)
  - 16MB WASM binary (6.28MB gzipped) with embedded Liberation Serif fonts
  - Font embedding at compile-time via include_bytes!() (~764KB total)

- ✅ **Phase 5.7:** Next.js Integration + UX (2025-10-22)
  - Dynamic WASM loading via module script injection (ResumeDownload.tsx)
  - Browser-side PDF generation (client receives only selected bullets)
  - Progress UI with 5-step generation flow
  - Automatic PDF download with timestamped filename
  - Dev mode detection (localhost adds build metadata page)
  - Browser caching (6.28MB first load, instant subsequent loads)
  - Full end-to-end working: User confirmed PDF downloads functional

### Currently Working On
- 📝 **Deployment & Optimization**
  - Critical: Fix WASM deployment (public/wasm/.gitignore blocks Vercel)
  - Solution: Build WASM on Vercel (user preference stated)
  - Tree-shake Typst dependencies (target: <5MB gzipped)
  - Create `just build-all` for full end-to-end local builds
  - Delete obsolete crates/typst/fonts/ directory

### Next Up
- **Phase 5.8:** Observability + CLI
- **Phase 5.9:** Testing + Polish

### Blockers/Considerations
- **CRITICAL:** `public/wasm/.gitignore` contains `*` → WASM files not tracked in git
  - Works locally (files exist on disk)
  - Will FAIL on Vercel (404 on /wasm/docgen_wasm_bg.wasm)
  - Solution: Build WASM on Vercel (Rust toolchain + wasm-pack in buildCommand)
  - See docs/ARCHITECTURE.md for detailed deployment options

### Test Results (as of 2025-10-27)
- **Rust Tests:** 236 passing (~5s)
  - Core library: 75 tests
  - PDF generation: 132 tests
  - WASM bindings: 20 tests
  - Integration tests: 15 tests
  - PDF permutation: 7 tests
  - Real data validation: 8 tests
  - Roundtrip: 12 tests
  - Schema validation: 11 tests
- **TypeScript Tests:** 125 passing (~1s)
  - API route tests: 13 tests
  - vCard utility: 34 tests
  - Rate limiting: 30 tests
  - Component tests: ~48 tests
- **Total:** **361 tests passing (~6-7s full suite)**
- **Performance:** PDF generation <1ms average, CV=1.91% (excellent consistency)

### Code Coverage (as of 2025-10-27)

**Rust Coverage: 88.91% line coverage** (`cargo llvm-cov --workspace`)
- scoring.rs: 100.00% (243/243 lines) - ✅ Perfect coverage
- selector.rs: 99.21% (375/378 lines) - ✅ Near perfect
- typst/template.rs: 96.41% (161/167 lines) - ✅ Excellent
- typst/compiler.rs: 95.97% (119/124 lines) - ✅ Excellent
- wasm/lib.rs: 92.33% (373/404 lines) - ✅ Good
- typst/lib.rs: 92.41% (341/369 lines) - ✅ Good
- typst/fonts.rs: 84.62% (33/39 lines) - ⚠️ Acceptable
- shared-types/lib.rs: 35.39% (63/178 lines) - ⚠️ Mostly validation code

**TypeScript Coverage: 23.5% overall** (`bun test:coverage`)
- Components: 50.89% - ✅ Well-tested (DataExplorer, TagFilter, SearchBar)
- lib utilities: 76.55% - ✅ Excellent (rate-limit, tags, vcard)
- API routes: 0% - ⚠️ Need integration tests
- Scripts: 0% - ⚠️ Tooling, acceptable
- UI components: 41.21% - ⚠️ Need more component tests

**Coverage Reports:**
- Rust: `open target/llvm-cov/html/index.html` (after `just coverage-rust`)
- TypeScript: `open coverage/index.html` (after `just coverage-ts`)
- Combined: `just coverage` (generates both)

---

## Production Deployment

### Status: ✅ Live at ollie.gg

**Deployed Features:**
- ✅ Landing page with hero section
- ✅ Resume overview page
- ✅ Experience explorer at /resume/view
- ✅ vCard download with Turnstile protection
- ✅ Rate limiting active
- ✅ Gist auto-deploy functional (hourly checks)
- ✅ Environment variables configured
- ✅ Security headers active

**Monitoring:**
- GitHub Actions: ✅ Running hourly
- Vercel deployments: ✅ Automatic on git push
- JSON validation: ✅ Active in workflow

---

## Future Phases (Post-Phase 5)

### Phase 6: Claude API Integration
- AI-powered bullet curation
- Job description analysis
- Custom bullet selection beyond heuristics
- Cost-controlled (<$10/month)

### Phase 7: PostHog Analytics
- Event tracking (generation, filters, downloads)
- Session replay
- User journey analysis
- Recruiter behavior insights

### Phase 8: N8N Notifications
- PostHog → N8N webhooks
- Slack/Telegram notifications
- Airtable storage
- Session replay integration
