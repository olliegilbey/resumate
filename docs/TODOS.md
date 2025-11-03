---
last_updated: 2025-10-29
category: Active Tasks & Todos (MIGRATED TO LINEAR)
update_frequency: Daily
retention_policy: Delete completed tasks >7 days old (history preserved in git)
---

# Active Tasks & Todos

> **🔄 MIGRATED TO LINEAR (2025-10-29)**
>
> All active tasks now tracked in Linear for better project management across sessions.
>
> **Linear Project:** https://linear.app/olliegg/project/resumate-66ec0bda8b63
>
> This file preserved for historical reference. See git history for full task audit trail.

---

## Current Sprint (Linear)

**Priority 1 (Urgent):**
- [OLL-26](https://linear.app/olliegg/issue/OLL-26) - Add PDF text extraction validation tests
- [OLL-27](https://linear.app/olliegg/issue/OLL-27) - Fix and verify Vercel deployment pipeline
- [OLL-29](https://linear.app/olliegg/issue/OLL-29) - Integrate PostHog event tracking and N8N webhooks

**Phase 5.9 (High):**
- [OLL-30](https://linear.app/olliegg/issue/OLL-30) - Add E2E tests with Playwright
- [OLL-31](https://linear.app/olliegg/issue/OLL-31) - Profile WASM load and PDF generation performance
- [OLL-32](https://linear.app/olliegg/issue/OLL-32) - Add visual regression tests for PDF output
- [OLL-33](https://linear.app/olliegg/issue/OLL-33) - Polish error handling UI and messaging

**Documentation (Medium):**
- [OLL-34](https://linear.app/olliegg/issue/OLL-34) - Refactor documentation structure and naming
- [OLL-35](https://linear.app/olliegg/issue/OLL-35) - Add documentation automation scripts

---

## Historical Tasks (Pre-Linear Migration)

### 🚧 In Progress

*No tasks currently in progress*

---

## 📋 Queued - Next Up

### Phase 5.9: Testing & Polish (From CURRENT_PHASE.md)
- [ ] E2E Tests (Playwright) - 8-10 hours (Date queued: 2025-10-28)
- [ ] Performance Profiling - 2-3 hours (Date queued: 2025-10-28)
- [ ] Visual Testing - 2-3 hours (Date queued: 2025-10-28)
- [ ] Error Handling Polish - 2-3 hours (Date queued: 2025-10-28)

### Phase 2: Continue Refactoring (3 remaining)
- [ ] Rename `docs/DEPLOYMENT.md` → `docs/DEPLOYMENT_GUIDE.md` (Date queued: 2025-10-28)
  - Make prescriptive (how to deploy), not descriptive (current status)
  - Remove "Status: ✅ Deployed" → move to CURRENT_PHASE.md
  - Keep: Environment setup, Vercel config, deployment commands

- [ ] Clean `docs/ARCHITECTURE.md` of temporary status notes (Date queued: 2025-10-28)
  - Keep only: Immutable system design, data flow, security model
  - Remove: Any metrics, current phase info, temporary notes
  - No timestamps (timeless architecture)

- [ ] Delete `docs/STATUS.md` (Date queued: 2025-10-28)
  - Content already migrated to CURRENT_PHASE.md + METRICS.md
  - Simple deletion

### Phase 3: Automation Scripts (3 tasks)
- [ ] Create `scripts/verify-docs.sh` with 5 checks (Date queued: 2025-10-28)
  - No test counts in .claude/CLAUDE.md
  - docs/METRICS.md is <24h old
  - All timestamps are date-only (except METRICS.md = date+time)
  - No duplicate headers across docs
  - Exit non-zero if any check fails

- [ ] Create `scripts/archive-todos.sh` (Date queued: 2025-10-28)
  - Scan docs/TODOS.md for completed tasks with dates
  - Delete entries completed >7 days ago
  - Exit with message: "History preserved in git log"

- [ ] Add justfile targets: metrics-generate, docs-verify, docs-health (Date queued: 2025-10-28)

### Phase 4: Pre-Commit Integration (1 task)
- [ ] Update `package.json` lint-staged for markdown files (Date queued: 2025-10-28)
  - Run metrics + verify + archive scripts on markdown changes

### Phase 5: Component CLAUDE.md Updates (2 tasks)
- [ ] Update `app/CLAUDE.md` to remove duplication (Date queued: 2025-10-28)
- [ ] Update `doc-gen/CLAUDE.md` to remove duplication (Date queued: 2025-10-28)

### Phase 6: Verification & Testing (6 tasks)
- [ ] Run `just metrics-generate` and verify accuracy (Date queued: 2025-10-28)
- [ ] Run `just docs-verify` and fix any issues (Date queued: 2025-10-28)
- [ ] Search all .md files for "361 tests" duplication (Date queued: 2025-10-28)
- [ ] Test pre-commit hook with markdown change (Date queued: 2025-10-28)
- [ ] Update README.md with documentation section (Date queued: 2025-10-28)
- [ ] Final verification: Resolve all 20 original discrepancies (Date queued: 2025-10-28)

---

## ✅ Recently Completed (Last 7 Days)

### Documentation System Foundation (2025-10-28)
- [x] Created `docs/archive/` directory for historical reports
- [x] Created `scripts/update-metrics-from-logs.sh` (tested, working)
- [x] Generated initial `docs/METRICS.md` with real counts (133 Rust + 200 TypeScript = 333)
- [x] Created `docs/CURRENT_PHASE.md` from STATUS.md content
- [x] Created `docs/TESTING_STRATEGY.md` with TDD philosophy
- [x] Created `docs/META_DOCUMENTATION.md` (244 lines, directive-focused)
- [x] Refactored `.claude/CLAUDE.md` to pure router (323 lines)
  - Removed all metrics → links to METRICS.md
  - Added documentation first principles section
  - Fixed: Next.js 16 (not 15), Bun 1.3 mentioned
  - Fixed: All timestamps to date-only format
  - Fixed: Removed specific timings, use targets only

---

## 🎯 Current Focus

**Primary:** Phase 2 - Continue documentation refactoring (TODOS.md, DEPLOYMENT_GUIDE.md, ARCHITECTURE.md)
**Secondary:** Phase 3 - Build automation scripts (verify-docs.sh, archive-todos.sh)
**Target:** Complete all 16 remaining tasks (~2 hours estimated)

---

## 📝 Quick Reference

**For current test counts & coverage:** See [docs/METRICS.md](./METRICS.md) (auto-generated)
**For current project phase:** See [docs/CURRENT_PHASE.md](./CURRENT_PHASE.md)
**For testing philosophy:** See [docs/TESTING_STRATEGY.md](./TESTING_STRATEGY.md)
**For documentation system rules:** See [docs/META_DOCUMENTATION.md](./META_DOCUMENTATION.md)

---

## 🚨 AI Assistant Reminders

**Before Starting Work:**
- Read [docs/CURRENT_PHASE.md](./CURRENT_PHASE.md) - Active phase
- Read this file (TODOS.md) - Current tasks
- Read component CLAUDE.md if in subdirectory
- Run `just data-pull` if editing `data/resume-data.json`

**During Work:**
- Run `just test` frequently (fast feedback loop)
- Run `just check` after code changes
- Run `just types-sync` after Rust type changes
- Use `just` commands (never raw npm/cargo when just target exists)

**After Completing Tasks:**
1. Mark tasks complete in this file (add completion date)
2. Update [docs/CURRENT_PHASE.md](./CURRENT_PHASE.md) if major milestone
3. Run `just test` (auto-regenerates METRICS.md)
4. Commit (pre-commit hooks verify everything)

**Critical Rules:**
- ⚠️ NEVER edit METRICS.md manually
- ⚠️ NEVER duplicate information
- ⚠️ ALWAYS link to canonical source
- ⚠️ ALWAYS use date-only timestamps (except metrics)
- ⚠️ ALWAYS verify before claiming numbers

---

**Last Updated:** 2025-10-28
