# CI/CD Architecture Principles

**Status:** Implementation Plan
**Date:** 2025-11-11
**Public Repo:** ⚠️ All decisions made with public visibility in mind

---

## 🎯 First Principles

### Core Philosophy

**Compile Once, Validate Everywhere, Deploy Fast**

1. **Heavy local guardrails** - Last line of defense before public repo
2. **Artifacts are source of truth** - Don't rebuild what's already built
3. **Fail fast, fail loud** - Better to block than deploy broken
4. **Separation of concerns** - Local ≠ CI ≠ Server

---

## 🔒 Security Posture (Public Repo)

### Zero Tolerance Policy

**Public repo = Assume adversaries watching**

**Guardrails:**
- 3 secret scanners (gitleaks, ripsecrets, trufflehog) - EVERY commit
- PII detection (phone, email) - EVERY commit
- Build artifacts excluded from scans (avoid false positive fatigue)
- Email removed from all committed files
- Contact info server-side only, hashed in WASM

**Philosophy:** Heavy pre-commit acceptable if prevents ONE leak.

---

## 🏗️ Build Efficiency Strategy

### Why WASM Binaries Are Committed (16MB)

**Problem:** Rust compilation slow + storage heavy
- Local: 9GB `target/` directory (24,631 files)
- Vercel: Would take 8-12min + 9GB storage per build
- GitHub Actions: Would take 8-10min per run

**Solution:** Pre-compile locally, commit binaries
- Pre-commit hook validates freshness (hash-based)
- Vercel build: 2-3min (was 12min) - saves 9min
- GitHub Actions: Skip Rust entirely - saves 7min
- **Cost:** $3.60/deploy saved, 700min/month saved

**Tradeoff:** 16MB in git (6.28MB gzipped over wire)
- ✅ Justified: 10x faster deploys
- ✅ Pre-commit ensures never stale
- ✅ CDN gzips automatically (no pre-compression needed)

---

## 📊 Target Directory (9GB) - NORMAL

### Breakdown

```
4.2GB  target/debug/deps           - Debug builds (7,653 files)
3.4GB  target/llvm-cov-target      - Coverage instrumentation
797MB  target/release/deps         - Release builds (917 files)
658MB  target/wasm32-unknown-unknown - WASM target (723 files)
---
9GB    24,631 files total
```

### Why So Large

- **4 compilation targets:** debug, release, wasm32, coverage
- **Typst crate:** Embeds fonts (~50MB per target)
- **Coverage doubles debug:** Instrumentation overhead
- **Incremental compilation:** Cached artifacts
- **Normal Rust behavior:** Not a problem

### Optimization

- Clean `llvm-cov-target` after coverage runs (-3.4GB)
- Keep others for incremental build speed
- **Never pushed to git** (gitignored)

---

## 🔄 Gist Data Flow

### Why Separate Data from Code

**Problem:** PII in repo + remote editing needed

**Solution:** Secret gist as data source
- Resume data lives in gist (not git)
- Local: Interactive pull/push with conflict detection
- Server: Force-fetch on build (--force, non-interactive)
- Auto-deploy: Hourly check + schema validation

### Hourly GitHub Action (Gist Watcher)

**Purpose:** Detect gist updates → trigger Vercel deploy

**NOT for:** Testing code, building artifacts, validating PRs

**Flow:**
1. Fetch gist `updated_at` timestamp
2. Validate JSON syntax + schema
3. Compare vs last Vercel deploy time
4. If newer → POST to Vercel deploy hook
5. **Duration:** ~30s (no Rust, no builds)

**Runs:** Every hour at :00 (predictable for testing)

### Gist Fetch Behavior by Environment

| Environment | Flag | Missing GIST_URL | Fetch Fails | Invalid Data |
|-------------|------|------------------|-------------|--------------|
| Local dev | none | Use template* | Prompt user | Block commit |
| Local pre-commit | none | Block commit | Block commit | Block commit |
| GitHub Actions | --force | Fail workflow | Fail workflow | Fail workflow |
| Vercel | --force | Fail build | Fail build | Fail build |

*Template fallback: Only if `NODE_ENV=development` AND `--allow-template` flag
**Never silent failures in production environments**

---

## 🛡️ Heavy Pre-Commit Hook (By Design)

### Philosophy

**Last line of defense before public repo**

**Duration:** 10-60s depending on changes
- Fast path (no rebuilds): ~10-15s
- WASM rebuild path: ~45-60s
- **Acceptable:** Better 60s wait than ONE PII leak

### Optimized Order (Fast-Fail First)

```
1. Secret scanning     (~5s)   - FAIL FAST if leaks
2. Lint + typecheck    (~5-10s) - FAIL FAST if syntax errors
3. WASM freshness      (~1-45s) - Rebuild if stale
4. WASM tests          (~10s)   - IF rebuilt only
5. Type sync           (~5s)    - IF shared-types changed
6. Commit succeeds
```

**Key:** Expensive operations AFTER cheap validation

### Smart Test Execution (Conditional)

**WASM-dependent Rust tests:**
- Run ONLY if WASM rebuilt in this commit
- Tests: `pdf_validation.rs`, `pdf_permutation.rs`, `pdf_snapshot.rs`
- Why: WASM unchanged = these tests would pass (already validated)
- Saves ~10s on typical commits

**TypeScript tests:**
- ALWAYS run in pre-commit (fast, ~5-10s)
- Cover non-WASM logic (API routes, components, utils)
- No conditional logic needed (cheap to run)

**Rust test suite:**
- Run if ANY Rust file changed (not just WASM)
- Includes integration tests with real gist data
- Skip if only TS/docs changed
- Conditional: Check git diff for crates/**/*.rs

**Coverage generation:**
- Run AFTER all tests pass
- Non-blocking (warnings OK)
- Generated for local viewing, not committed

---

## 🎭 Separation of Concerns

### Local Development

**Purpose:** Compile, test, validate EVERYTHING
**Duration:** 10-60s pre-commit
**Output:** WASM, schema, types → committed
**Storage:** 9GB target/ (local only)

**Responsibilities:**
- ✅ Secret scanning (3 tools)
- ✅ WASM compilation
- ✅ Type generation (Rust → Schema → TS)
- ✅ All tests (Rust + TypeScript)
- ✅ Full build validation

---

### GitHub Actions (Gist Watcher Only)

**Purpose:** Detect gist updates → trigger deploy
**Duration:** ~30s
**Triggers:** Hourly cron (on the hour) + manual
**Workflow:** `gist-deploy-trigger.yml`

**Responsibilities:**
- ✅ Fetch gist metadata (GitHub API)
- ✅ Validate JSON syntax + schema
- ✅ Compare timestamps (gist vs last Vercel deploy)
- ✅ Trigger Vercel deploy if gist newer
- ❌ NOT for code testing (pre-commit handles)
- ❌ NOT for artifact validation (pre-commit handles)
- ❌ NOT for Rust compilation (local only)
- ❌ NOT for PR validation (deleted, redundant)

**Why NO PR Validation Workflow:**

**Decision:** Deleted entirely (Option 1)
**Date:** 2025-11-12

**Previous:** `rust-type-validation.yml` ran on every PR (11min)
**Problem:** 100% redundant with pre-commit hook
**Solution:** Deleted workflow entirely

**Rationale:**
- Pre-commit hook already validates everything (6s local)
- Every push is blocked until validation passes
- No external contributors (private project)
- Husky hooks auto-install via `bun install` (if there were contributors)
- Vercel build is final artifact gate
- Saves 11min × N pushes/month
- Zero value add over local validation

**Validation Gates (Sufficient):**
1. **Pre-commit** (local, 6s, blocks push)
   - Secret scanning (gitleaks, ripsecrets, trufflehog)
   - Lint + typecheck (ESLint, TSC, clippy, cargo fmt)
   - WASM freshness (hash-based rebuild detection)
   - All tests (Rust + TypeScript, 200+ tests)
   - Type sync (if shared-types changed)
2. **Vercel prebuild** (server, <3s, blocks deploy)
   - WASM existence check (fail-fast if missing)
   - Gist fetch validation (fail-fast if invalid)

**Edge Cases Covered:**
- Developer bypasses pre-commit (`--no-verify`)? → Vercel catches missing WASM/invalid gist
- Broken code pushed? → PR review catches it (solo developer)
- Fork contributors? → Husky hooks install automatically, same validation

---

### Pull Request Validation

**Strategy:** No separate workflow (deleted)
**Duration:** 0s CI time

**Philosophy:** Heavy pre-commit IS the PR validation
- ✅ Developer runs pre-commit locally (4-60s)
- ✅ Vercel preview deploy validates build (2-3min)
- ❌ NO GitHub Actions for PR testing (deleted, redundant)
- ❌ NO cargo test in CI (already ran locally)

**Rationale:**
- Pre-commit enforces all quality gates before push
- Cannot push without passing validation
- If bypassed → Vercel build catches it
- Saves 11min × N pushes/month
- Faster feedback (local >> CI)
- GitHub Actions reserved for gist watching only

**Deleted Workflows:**
- `rust-type-validation.yml` (2025-11-12) - 100% redundant with pre-commit

---

### Vercel Deployment

**Purpose:** Build Next.js with pre-built artifacts
**Duration:** 2-3min
**Triggers:** Git push OR deploy hook (from Actions)

**Responsibilities:**
- ✅ Install Node deps
- ✅ Check WASM exists (early exit)
- ✅ Fetch gist data (fail-fast if missing)
- ✅ Build Next.js + Turbopack
- ❌ NOT for Rust compilation
- ❌ NOT for running tests

---

## 📋 WASM Gzip Strategy

### Why NOT Pre-Compress

**Current:** Commit `resume_wasm_bg.wasm` (16MB uncompressed)

**What happens:**
1. Vercel/CDN auto-gzips (6.28MB)
2. Sets `Content-Encoding: gzip` header
3. Browser transparently decompresses
4. WASM loader gets raw bytes

**If we pre-compressed:**
- ❌ Would need custom Next.js serving logic
- ❌ Would break browser WASM loading
- ❌ Would save ZERO bandwidth (CDN already does it)
- ❌ Would add complexity for no gain

**Decision:** Current approach is correct. CDN handles compression.

---

## 🚨 Failure Modes (Fail Fast)

### Gist Fetch Failure

**OLD:** Silent fallback, broken deploy
**NEW:** Fail immediately, block deploy

```bash
if [ ! -f "data/resume-data.json" ]; then
  echo "::error::CRITICAL: Gist fetch failed!"
  exit 1
fi
```

**Template fallback:** Development only (NODE_ENV=development)

---

### WASM Missing

**OLD:** Try to build on server (8min wasted)
**NEW:** Fail immediately

```bash
if [ ! -f "public/wasm/*.wasm" ]; then
  echo "::error::WASM missing - run 'just wasm' locally"
  exit 1
fi
```

**Philosophy:** Pre-commit ensures WASM exists. If missing = developer error.

---

### Secret Detected

**Pre-commit blocks immediately:**

```
❌ Gitleaks found secrets!
   Rule: email-address
   File: Cargo.toml
   Line: 14

❌ COMMIT BLOCKED
```

**No exceptions.** Fix and retry.

---

## 🔧 Type Synchronization

### Rust → Schema → TypeScript

**Single source of truth:** `crates/shared-types/src/lib.rs`

**Flow:**
1. Rust types changed
2. Pre-commit runs: `cargo run --bin generate_schema`
3. Output: `schemas/resume.schema.json`
4. Pre-commit runs: `bun types:gen`
5. Output: `lib/types/generated-resume.ts`
6. Both auto-staged for commit

**Server never regenerates:** Uses committed artifacts

**Drift detection:** Pre-commit fails if uncommitted changes

---

## 📊 Performance Comparison

### Before Optimization

| Environment | Duration | Rust Build | Target Size |
|-------------|----------|------------|-------------|
| Local | 30-90s | ✅ | 9GB |
| GitHub Actions | ~11min | ✅ | 9GB |
| Vercel | ~12min | ✅ | 9GB |

### After Optimization

| Environment | Duration | Rust Build | Target Size | Workflows |
|-------------|----------|------------|-------------|-----------|
| Local | 4-60s | ✅ (if needed) | 9GB | Pre-commit hook |
| GitHub Actions | ~30s | ❌ | 0GB | Gist watcher only |
| Vercel | ~3min | ❌ | 0GB | N/A |

**Savings:**
- Vercel: 9min/deploy = $3.60/deploy
- GitHub Actions: 700min/month (deleted PR workflow)
- Local: Faster feedback (4-60s vs 11min CI)
- Total: Significant cost + time savings

---

## ✅ Quality Gates

### Pre-Commit (Non-Negotiable)

- ✅ Zero secrets/PII detected
- ✅ All linters pass
- ✅ All typechecks pass
- ✅ WASM fresh (hash validated)
- ✅ WASM tests pass (if rebuilt)
- ✅ Types synchronized (if changed)

### Gist Validation (Non-Negotiable)

- ✅ Valid JSON syntax
- ✅ Passes schema validation
- ✅ All required fields present
- ✅ Priority values in range (1-10)
- ✅ Date formats valid

### Deploy Validation (Non-Negotiable)

- ✅ WASM binaries exist
- ✅ Gist data fetched
- ✅ Next.js build succeeds
- ✅ No build warnings/errors

---

## 📜 Decision Log

### Why No CI Testing for PRs

**Decision:** Delete PR validation workflow entirely (Option 1)
**Date:** 2025-11-12 (updated from 2025-11-11)
**File Deleted:** `rust-type-validation.yml`

**Rationale:**
- Pre-commit runs all tests locally (4-60s, blocks push)
- Cannot push without passing validation
- 100% redundant to run same tests in CI (11min wasted)
- No external contributors (private project)
- Vercel build is final artifact gate
- GitHub Actions reserved for gist watching

**Previous workflow did:**
- cargo fmt --check (pre-commit does this)
- cargo clippy (pre-commit does this)
- cargo test --all (pre-commit does this)
- Fetched real gist (pre-commit uses template, sufficient)
- **Total waste:** 11min × every push

**Risk:** Developer bypasses pre-commit (`--no-verify`)
**Mitigation:** Vercel prebuild fail-fast (WASM check + gist validation)
**Acceptable:** Extremely rare, Vercel catches it, not worth 11min per push

### Why Keep WASM Binaries in Git

**Decision:** Commit 16MB WASM binaries
**Date:** 2025-11-11
**Rationale:**
- Saves 9min per Vercel deploy
- Saves 7min per GitHub Actions run
- Pre-commit ensures freshness (hash-based)
- CDN handles gzip automatically

**Cost:** 16MB per commit with Rust changes
**Benefit:** 10x faster deploys, $3.60 saved per deploy

### Why Heavy Pre-Commit Hook

**Decision:** 10-60s pre-commit acceptable
**Date:** 2025-11-11
**Rationale:**
- Public repo = one PII leak is catastrophic
- Last line of defense before push
- Fast path (no rebuilds) is ~10-15s
- Heavy path (rebuilds) is ~45-60s

**Alternative:** Lightweight pre-commit + heavy CI
**Rejected:** Wastes CI minutes, slower feedback

---

## 🎯 Success Metrics

### Security
- ✅ Zero PII leaks in commit history
- ✅ Zero secrets in git
- ✅ 100% pre-commit secret scan rate

### Performance
- ✅ Vercel builds <5min (target: 2-3min)
- ✅ GitHub Actions <2min (target: 30s)
- ✅ Pre-commit <15s fast path

### Reliability
- ✅ Zero stale WASM deploys
- ✅ Zero invalid gist deploys
- ✅ 100% artifact freshness

---

## 🧭 Guiding Principles

1. **Security First** - Public repo demands paranoia
2. **Fail Fast** - Block bad commits, not bad deploys
3. **Build Once** - Artifacts are truth, not rebuilds
4. **Optimize for Common Case** - Fast path <15s
5. **Heavy Guardrails** - Better safe than exposed
6. **Separation of Concerns** - Right tool, right job
7. **No Silent Failures** - Loud errors > broken deploys

---

## 📚 Implementation Checklist

See active todo list in conversation for detailed steps.

**Critical Path:**
1. Remove PII from committed files
2. Fix gitleaks false positives
3. Optimize pre-commit hook order
4. Add WASM early exit to build script
5. Simplify GitHub Actions to gist-only
6. Test end-to-end

**Success Criteria:**
- [ ] No email in git history/files
- [ ] Gitleaks runs clean on commits
- [ ] Pre-commit <15s fast path
- [ ] Vercel builds in 2-3min
- [ ] GitHub Actions runs in ~30s
- [ ] All quality gates enforced

---

**This document captures the WHY behind every decision.**
**Read this before modifying CI/CD components.**

---

## 📋 Implementation Todos (Phased)

### PHASE 1: Security & Cleanup (Critical)
  ☐ Remove email from Cargo.toml authors field
  ☐ Add public/wasm/package.json to .gitignore
  ☐ Add public/wasm/*.d.ts to .gitignore
  ☐ Git rm --cached public/wasm/package.json
  ☐ Rebuild WASM without email (just wasm)
  ☐ Verify package.json no longer contains email
  ☐ Create .gitleaks.toml with proper exclusions
  ☐ Test gitleaks on Cargo.toml (should flag email initially)
  ☐ Test gitleaks after email removal (should be clean)
  ☐ Test ripsecrets runs clean
  ☐ Test trufflehog runs clean
  ☐ Clean llvm-cov-target/ directory (saves 3.4GB)
  ☐ Add target/llvm-cov-target/ to .gitignore
  ☐ Commit: "security: remove email from WASM + add secret scanning config"

### PHASE 2: Pre-Commit Hook (Heavy Guardrails)
  ☐ Audit current .git/hooks/pre-commit (understand what runs)
  ☐ Create new .husky/pre-commit with optimized order
  ☐ Add secret scanning (gitleaks + ripsecrets + trufflehog) FIRST
  ☐ Add PII regex detection (phone/email) to pre-commit
  ☐ Add lint + typecheck SECOND (fail fast)
  ☐ Add conditional WASM rebuild detection THIRD
  ☐ Add conditional WASM tests (if rebuilt) FOURTH
  ☐ Add conditional type sync (if shared-types changed) FIFTH
  ☐ Add conditional Rust tests (if any .rs changed) SIXTH
  ☐ Test pre-commit with TS-only changes (should skip Rust)
  ☐ Test pre-commit with Rust changes (should run all)
  ☐ Test pre-commit with doc-only changes (should skip most)
  ☐ Test pre-commit end-to-end with all scanners
  ☐ Remove orphaned .git/hooks/pre-commit file
  ☐ Commit: "ci: optimize pre-commit hook with conditional execution"

### PHASE 3: Build Scripts (Fail-Fast)
  ☐ Update scripts/build-wasm.sh with early exit check
  ☐ Add WASM exists check to build-wasm.sh (exit 0 if present)
  ☐ Add fail-fast error if WASM missing in production
  ☐ Test build-wasm.sh early exit locally
  ☐ Update scripts/fetch-gist-data.js fail-fast logic
  ☐ Add NODE_ENV=production check for GIST_URL requirement
  ☐ Add template fallback for NODE_ENV=development only
  ☐ Add --allow-template flag for explicit dev testing
  ☐ Add data file existence validation after fetch
  ☐ Add JSON syntax validation after fetch
  ☐ Test fetch-gist-data.js in dev mode (should allow template)
  ☐ Test fetch-gist-data.js in prod mode (should fail-fast)
  ☐ Commit: "ci: add fail-fast validation to build scripts"

### PHASE 4: GitHub Actions (Gist-Only) ✅ COMPLETE
  ✅ Decided: Delete rust-type-validation.yml entirely (Option 1)
  ✅ Deleted rust-type-validation.yml (100% redundant with pre-commit)
  ✅ Updated CI_CD_PRINCIPLES.md to reflect actual strategy
  ✅ Verified gist-deploy-trigger.yml unchanged (hourly, gist only)
  ✅ GitHub Actions now exclusively for gist watching
  ✅ Commit: "ci: delete redundant PR validation workflow"

### PHASE 5: Vercel Configuration (Pre-Built Artifacts)
  ☐ Verify RESUME_DATA_GIST_URL set in Vercel
  ☐ Verify NODE_ENV=production set in Vercel (default)
  ☐ Test Vercel build completes successfully
  ☐ Check Vercel logs: WASM early exit message present
  ☐ Check Vercel logs: Gist fetch succeeds
  ☐ Check Vercel logs: Build time ~2-3min (not 12min)
  ☐ Test Vercel preview deploy from PR
  ☐ Commit: "ci: verify Vercel uses pre-built artifacts"

### PHASE 6: End-to-End Validation
  ☐ Run full pre-commit hook on branch (all scanners + tests)
  ☐ Push to GitHub and verify no automatic Actions run
  ☐ Manually trigger manual-validation.yml workflow
  ☐ Verify Vercel production deploy succeeds
  ☐ Wait for hourly cron (next :00 mark)
  ☐ Update gist content manually
  ☐ Wait for next hourly cron
  ☐ Verify gist-deploy-trigger workflow runs and triggers Vercel
  ☐ Run gitleaks on full git history (not just staged)
  ☐ Verify no secrets in entire git history
  ☐ Update .claude/CLAUDE.md with new CI/CD flow
  ☐ Update docs/ARCHITECTURE.md with optimized pipeline
  ☐ Commit: "docs: update CI/CD flow documentation"
