# Project Status

**Last Updated:** 2025-10-20

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
  - See: docs/TYPST_MIGRATION.md

- ✅ **Phase 5.5:** Build Automation & Performance (2025-10-20)
  - Created comprehensive justfile with 40+ targets
  - Fixed build performance regression (24s → 7.5s, 66% faster!)
  - Added Rust patterns to .gitignore (target/, *.rs.bk, pkg/)
  - Excluded target/ from TypeScript scanning (tsconfig.json)
  - Documented root cause: Next.js scanning 6.6GB Rust build cache
  - See: BUILD_REGRESSION_REPORT.md

### Currently Working On
- 📝 **Documentation updates in progress**
  - Updating docs to reflect Typst migration
  - Adding justfile usage as canonical build process
  - Cleaning up obsolete references

### Next Up
- **Phase 5.6:** WASM Bindings with Typst integration
- **Phase 5.7:** Next.js Integration + UX
- **Phase 5.8:** Observability + CLI
- **Phase 5.9:** Testing + Polish

### Blockers/Considerations
- None currently - Typst migration resolved previous PDF layout issues

### Test Results (as of 2025-10-16)
- **Rust Tests:** 236 passing
  - Core library: 75 tests
  - PDF generation: 132 tests
  - WASM bindings: 20 tests
  - Integration tests: 15 tests
  - PDF permutation: 7 tests
  - Real data validation: 8 tests
  - Roundtrip: 12 tests
  - Schema validation: 11 tests
- **TypeScript Tests:** 125 passing
  - API route tests: 13 tests
  - vCard utility: 34 tests
  - Rate limiting: 30 tests
  - Component tests: ~48 tests
- **Total:** **361 tests passing**
- **Performance:** PDF generation <1ms average, CV=1.91% (excellent consistency)

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
