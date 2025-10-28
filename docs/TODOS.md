# Active Tasks & Todos

**Last Updated:** 2025-10-20

---

## 🎯 Current Sprint: Build Optimization & Documentation

### ✅ Recently Completed (2025-10-20)

- [x] **Build Performance Optimization**
  - Root caused 3x build regression (24s → 7.5s, 66% improvement!)
  - Added Rust patterns to .gitignore (target/, *.rs.bk, pkg/)
  - Updated tsconfig.json to exclude target/ from TypeScript scanning

- [x] **Build Automation with justfile**
  - Created comprehensive justfile with 40+ targets
  - Covers development, building, testing, cleaning, data management
  - Justfile is now canonical build system (documented everywhere)

- [x] **Documentation Updates**
  - Updated STATUS.md with Typst migration and build fix
  - Rewrote COMMANDS.md to feature justfile commands first
  - Updated ARCHITECTURE.md to remove DOCX references
  - Updated .claude/CLAUDE.md and README.md to mention justfile
  - Updated doc-gen/CLAUDE.md to reflect Typst-only approach

### ✅ Previously Completed (2025-10-18)

- [x] **Typst PDF Generation Migration**
  - Migrated from manual pdf-writer to Typst typesetting system
  - Automatic pagination and professional typography
  - Template-based design (resume.typ)
  - Removed DOCX generation (focus on high-quality PDF)
  - Sub-1s generation time in WASM

### ✅ Previously Completed (2025-10-14)

- [x] **Schema Infrastructure Migration**
  - Rust types as source of truth with schemars
  - JSON Schema generation from Rust
  - TypeScript codegen from JSON Schema
  - Complete validation pipeline

- [x] **Scoring & Selection Algorithms**
  - Hierarchical bullet scoring (company × position × bullet)
  - Diversity-constrained selection
  - 30+ tests passing
  - API route integration

---

## 🚧 In Progress

**None** - Documentation cleanup complete, ready for next feature phase

---

## 📋 Next Up

### Phase 5.6: WASM Integration with Typst

**Goal:** Integrate Typst PDF generation into WASM bundle for browser use

**Tasks:**
1. **Update WASM bindings** (`doc-gen/crates/wasm/src/lib.rs`)
   - Export `generate_pdf_typst` function
   - Accept GenerationPayload JSON + dev_mode flag
   - Return PDF bytes via wasm-bindgen

2. **Build WASM with Typst**
   ```bash
   just wasm        # Build with fonts
   ```
   - Ensure fonts are embedded
   - Test bundle size (target: <20MB uncompressed)
   - Verify gzipped size for production

3. **Test WASM Integration**
   - Create simple HTML test page
   - Load WASM module
   - Call `generate_pdf_typst` with test data
   - Verify PDF output

**Estimated Time:** 2-3 hours

**Blockers:** None

---

### Phase 5.7: Next.js UI Integration

**Goal:** Build resume generation UI in Next.js

**Components to Create:**
1. **`RoleSelector`** - Dropdown from roleProfiles
   - Fetch available profiles from server
   - Display with descriptions
   - Pass selected role to generation flow

2. **`TurnstileGate`** - CAPTCHA modal
   - Cloudflare Turnstile widget
   - Block generation until verification
   - Pass token to server API

3. **`GenerationProgress`** - Animated progress UI
   - 4-5 step progress indicator
   - Educational messaging during generation
   - Smooth transitions

4. **`ResumeDownload`** - Main orchestration component
   - Call `/api/resume/prepare` with role + turnstile token
   - Receive GenerationPayload
   - Load WASM module
   - Generate PDF client-side
   - Trigger download

**Estimated Time:** 12-15 hours (~2 days)

---

### Phase 5.8: Observability & Tracking

**Goal:** Add analytics and reconstruction capability

**Tasks:**
1. **PostHog Integration**
   - Track generation events
   - Log role selections
   - Monitor download completion
   - Session replay for debugging

2. **N8N Webhook** (optional)
   - Send generation metadata to N8N
   - Store in Airtable/Notion
   - Slack notifications for new generations

3. **Reconstruction CLI** (future)
   - CLI tool to regenerate PDF from stored generation IDs
   - Fetch original payload from database
   - Recreate exact PDF

**Estimated Time:** 6-8 hours

---

### Phase 5.9: Testing & Polish

**Goal:** End-to-end testing and optimization

**Tasks:**
1. **E2E Tests** (Playwright)
   - Test full generation flow
   - Verify CAPTCHA works
   - Test PDF download
   - Test error states

2. **Performance Profiling**
   - Measure WASM load time
   - Measure PDF generation time
   - Target: <3s total (from click to download)

3. **Visual Testing**
   - Verify PDF output matches expectations
   - Test with different role profiles
   - Check ATS compliance (parseable structure)

4. **Error Handling**
   - Rate limit exceeded
   - CAPTCHA failure
   - WASM load failure
   - Generation timeout

**Estimated Time:** 8-10 hours

---

## 📅 Timeline Summary

| Phase | Description | Time | Status |
|-------|-------------|------|--------|
| **5.0-5.3** | Types, scoring, selection | Complete | ✅ Done |
| **5.4** | Typst PDF migration | Complete | ✅ Done (Oct 18) |
| **5.5** | Build automation | Complete | ✅ Done (Oct 20) |
| **5.6** | WASM integration | 2-3 hours | 📋 Next |
| **5.7** | Next.js UI | 12-15 hours | 📋 Queued |
| **5.8** | Observability | 6-8 hours | 📋 Queued |
| **5.9** | Testing & polish | 8-10 hours | 📋 Queued |
| **TOTAL Phase 5** | **28-36 hours remaining** | **~1 week** | 🚧 In progress |

---

## 🚀 Future Phases (Post Phase 5)

### Phase 6: Claude API Integration
- AI-powered bullet selection from job descriptions
- Prompt engineering for context extraction
- Rate limiting (5 req/hour/IP)
- Cost management (<$10/month with Claude Haiku)
- Sanitization of job description inputs

### Phase 7: Enhanced Analytics
- Full PostHog event tracking
- Session replay for UX optimization
- Recruiter behavior analysis
- A/B testing for UI improvements

### Phase 8: Advanced Features
- Custom PDF themes/templates
- Multi-language support
- PDF preview before download
- Bulk generation for multiple roles

---

## 📝 Notes for AI Assistants

### Before Starting Work
1. ✅ Check `docs/STATUS.md` for current phase progress
2. ✅ Check this file (TODOS.md) for active tasks
3. ✅ Read relevant component CLAUDE.md (app/, doc-gen/, scripts/)
4. ✅ Run `just health` to verify environment
5. ✅ Pull latest data if editing resume-data.json: `just data-pull`

### During Work
1. ✅ Use `just` commands as primary build system
2. ✅ Run tests frequently: `just test`
3. ✅ Check types after Rust changes: `just types-sync`
4. ✅ Test in browser after UI changes: `just dev`

### After Completing Tasks
1. ✅ Mark tasks as [x] completed in this file
2. ✅ Update `docs/STATUS.md` if major milestone reached
3. ✅ Run full validation: `just check && just test`
4. ✅ Commit with descriptive message

### Critical Reminders
- ⚠️ **ALWAYS** `just data-pull` before editing data/resume-data.json
- ⚠️ **ALWAYS** run `just types-sync` after changing Rust types
- ⚠️ **NEVER** import from `lib/types/generated-resume.ts` (use `types/resume.ts`)
- ⚠️ **NEVER** run `just build` unnecessarily (slow, only for production)
- ⚠️ Use `just` commands for all common tasks (40+ targets available)

### Quick Reference
```bash
just              # List all commands
just dev          # Start dev server
just test         # Run all tests
just wasm         # Rebuild WASM
just types-sync   # Sync Rust → TS types
just data-pull    # Pull resume data
just clean        # Clean artifacts
just health       # Check environment
```

---

## 🎯 Current Focus

**Primary:** Complete Phase 5.6 (WASM integration with Typst)
**Secondary:** Plan Phase 5.7 UI components
**Maintenance:** Keep documentation up-to-date as changes occur

**Last Updated:** 2025-10-20
