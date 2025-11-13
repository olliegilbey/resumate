---
last_updated: 2025-11-13
category: Build & Deployment
update_frequency: When build process changes
retention_policy: All versions preserved in git
---

# Build Pipeline & CI/CD

> **Purpose:** Concise build process and deployment automation.
> For implementation history, see `.claude/CI_CD_IMPLEMENTATION_LOG.md`

---

## Core Philosophy

**Compile Once, Validate Everywhere, Deploy Fast**

- **Heavy local guardrails** - Last line of defense before public repo
- **Artifacts are source of truth** - Don't rebuild what's already built
- **Fail fast, fail loud** - Better to block than deploy broken
- **Separation of concerns** - Local ≠ CI ≠ Server

---

## Build Limits (Single Source of Truth)

All limits defined in `justfile` (lines 11-34).

**Current values:**
- WASM raw: ≤17MB
- WASM gzipped: ≤6.5MB
- Pre-commit duration: ≤70s (fast: 15s, rebuild: 60s)
- Rust test minimum: ≥140 tests
- TypeScript test minimum: ≥200 tests
- Coverage minimum: ≥85% (both Rust + TS)

**Current metrics:** See `docs/METRICS.md` (auto-generated)

Scripts source limits via `just --evaluate variable_name`

---

## WASM Build Strategy

### Why Binaries Are Committed (16MB)

**Problem:** Rust compilation slow + storage heavy
- Local: 9GB target/ directory (24,631 files)
- Vercel: Would take 8-12min + 9GB storage per build
- GitHub Actions: Would take 8-10min per run

**Solution:** Pre-compile locally, commit binaries
- Pre-commit validates freshness (hash-based)
- Vercel build: 45-47s (was 12min) - 95% reduction
- GitHub Actions: Skip Rust entirely
- **Savings:** $3.60/deploy, 700min/month

**Tradeoff:** 16MB in git (6.28MB gzipped over wire)

### WASM Build Process

**Local:**
```bash
just wasm          # Full WASM build (release mode)
just wasm-dev      # Dev build (faster, larger)
```

**Pre-commit:**
```bash
scripts/check-wasm.sh --fresh
# Hash-based rebuild detection
# Auto-stages binaries if rebuilt
```

**Vercel:**
```bash
scripts/check-wasm.sh --exists
# Fail-fast if missing (no rebuild)
```

**Output:** `public/wasm/`
- `resume_wasm_bg.wasm` (size limits in justfile)
- `resume_wasm.js` (JS bindings)
- `resume_wasm.d.ts` (TypeScript types)

**Optimization:** `wasm-opt` runs automatically (configured in Cargo.toml)

---

## Pre-Commit Hook (7 Phases)

**Duration:** See justfile for current limits

**Phase order (optimized for fast-fail):**

1. **Secret scanning** (~5s)
   - gitleaks (PII patterns, staged only)
   - ripsecrets (additional PII)
   - trufflehog (verified secrets)
   - Blocks: ANY secret/PII detected

2. **Lint + typecheck** (~5-10s)
   - ESLint, TSC (TypeScript)
   - cargo fmt --check, cargo clippy (Rust)
   - Blocks: Syntax errors, linter warnings

3. **WASM freshness** (~1-45s conditional)
   - Hash-based detection (sources vs last build)
   - Rebuilds if Rust/Typst/fonts changed
   - Skips if WASM fresh

4. **Bundle size** (<1s)
   - Enforces WASM size limits (from justfile)
   - Blocks: Binary exceeds raw or gzipped limit

5. **Type sync** (~5s conditional)
   - Runs if `shared-types/` changed
   - Regenerates schema + TypeScript types
   - Auto-stages generated files

6. **Tests** (~10-30s conditional)
   - Rust tests: If ANY .rs changed
   - TypeScript tests: ALWAYS run
   - WASM tests: If WASM rebuilt
   - Blocks: ANY test failure

7. **Timing enforcement** (<1s)
   - Measures total pre-commit duration
   - Warns: Exceeds fast target (from justfile)
   - Blocks: Exceeds hard limit (from justfile)

**Philosophy:** Heavy pre-commit acceptable for public repo - prevents PII leaks

---

## GitHub Actions (Gist Watcher Only)

**Purpose:** Detect gist updates → trigger Vercel deploy

**Workflow:** `.github/workflows/gist-deploy-trigger.yml`

**Trigger:**
- Cron: Every hour at :00
- Manual: workflow_dispatch

**Duration:** ~30s (no Rust, no builds, no tests)

**Process:**
1. Fetch gist metadata (GitHub API)
2. Validate JSON syntax + schema
3. Get last Vercel deployment time (Vercel API)
4. Compare gist `updated_at` vs last deploy
5. If gist newer → POST to Vercel deploy hook

**NOT for:**
- Code testing (pre-commit handles)
- Artifact validation (pre-commit handles)
- PR validation (deleted, redundant)

**Why no PR workflow:** 100% redundant with pre-commit hook. Pre-commit blocks push until validation passes. Deleted 2025-11-12.

---

## Vercel Deployment

**Build command:** `bun run build`

**Prebuild hook:**
```bash
bash scripts/check-wasm.sh --exists && bun scripts/fetch-gist-data.js --force
```

**Process:**
1. Check WASM exists (fail-fast if missing)
2. Fetch gist data (fail-fast if invalid)
3. Build Next.js + Turbopack

**Duration:** 45-47s (current, see METRICS.md)

**Triggers:**
- Git push to main
- Gist update (via GitHub Actions)
- Manual (vercel --prod)

**Required env vars:** See DEPLOYMENT_GUIDE.md

---

## Gist Data Flow

**Local:** `data/resume-data.json` (gitignored, PII)

**Commands:**
- `just data-pull` - Fetch from gist (interactive, conflict detection)
- `just data-push` - Push to gist (interactive, conflict detection)
- `just data-validate` - Schema validation

**Server:** Always fetches from `RESUME_DATA_GIST_URL` (environment variable)

**Validation:**
- JSON syntax (jq)
- Schema validation (validate-compendium.mjs)
- Both local (pre-commit) and server (GitHub Actions, Vercel prebuild)

**Failure mode:** Fail-fast on invalid data (no silent fallbacks in production)

---

## Type System Flow

**Single source of truth:** `crates/shared-types/src/lib.rs`

**Generation:**
```bash
just types-sync
# Runs:
# 1. cargo run --bin generate_schema
# 2. bun types:gen
```

**Output:**
- `schemas/resume.schema.json` (generated)
- `lib/types/generated-resume.ts` (generated)

**Enforcement:**
- Pre-commit auto-generates if `shared-types/` changed
- Pre-commit fails if uncommitted changes detected
- Server never regenerates (uses committed artifacts)

**Flow:**
```
Rust types (source of truth)
  ↓ just types-sync
JSON Schema (generated)
  ↓
TypeScript types (generated)
```

**Never edit generated files** - change Rust, regenerate downstream

---

## Security (Public Repo)

**Zero tolerance:**
- 3 secret scanners EVERY commit
- PII detection (phone, email patterns)
- Build artifacts excluded from scans
- Contact info server-side only, hashed in WASM

**Gitleaks findings:**
- 2 personal emails in old Cargo.toml commits (acceptable, metadata only)
- No API keys, tokens, or credentials
- Current protection prevents new leaks

---

## Performance Comparison

**Before optimization:**
- Local: 30-90s
- GitHub Actions: ~11min
- Vercel: ~12min

**After optimization:**
- Local: 4-60s (conditional, see justfile limits)
- GitHub Actions: ~30s (gist watcher only)
- Vercel: ~47s (current, see METRICS.md)

**Savings:**
- Vercel: 11min/deploy = $3.60/deploy
- GitHub Actions: 700min/month (deleted PR workflow)
- Total: Significant cost + time savings

---

## Local Development

**Common commands:**
```bash
just build          # Full build (WASM + Next.js)
just test           # All tests (Rust + TS), updates METRICS.md
just check          # Lint, typecheck, clippy
just wasm           # WASM only (release)
just wasm-dev       # WASM dev mode (faster)
just clean          # All artifacts
just health         # Diagnostics
```

**Discovery:** Run `just` for full command list

---

## Quality Gates

**Pre-commit (non-negotiable):**
- Zero secrets/PII detected
- All linters pass
- WASM fresh (hash validated)
- WASM within size limits (from justfile)
- Types synchronized (if changed)
- All tests pass

**Gist validation (non-negotiable):**
- Valid JSON syntax
- Passes schema validation
- All required fields present

**Deploy validation (non-negotiable):**
- WASM binaries exist
- Gist data fetched
- Next.js build succeeds

---

## Troubleshooting

**WASM missing on Vercel:**
```bash
# Build locally
just wasm

# Verify artifacts
ls -lh public/wasm/*.wasm

# Commit (pre-commit validates freshness)
git add public/wasm/
git commit -m "chore: update WASM binaries"
```

**Gist not updating:**
```bash
# Test fetch
bun scripts/fetch-gist-data.js --force
# Should output: ✅ Resume data fetched and validated
```

**Deployment not triggering:**
- Check GitHub Actions logs (repo → Actions tab)
- Verify workflow detected gist change
- Check deploy hook called successfully
- See DEPLOYMENT_GUIDE.md for details

**Pre-commit slow:**
- Fast path (no rebuilds): See justfile target
- Rebuild path: See justfile target
- If exceeds hard limit: Check what changed

---

## Target Directory (9GB) - NORMAL

**Breakdown:**
- 4.2GB debug/deps - Debug builds
- 3.4GB llvm-cov-target - Coverage instrumentation
- 797MB release/deps - Release builds
- 658MB wasm32-unknown-unknown - WASM target

**Why large:**
- 4 compilation targets (debug, release, wasm32, coverage)
- Typst embeds fonts (~50MB per target)
- Incremental compilation caches
- Normal Rust behavior

**Optimization:**
- Clean `llvm-cov-target` after coverage (-3.4GB)
- Keep others for incremental speed
- Never pushed to git (gitignored)

---

## Related Documentation

- **DEPLOYMENT_GUIDE.md** - Environment setup, Vercel config, troubleshooting
- **ARCHITECTURE.md** - WASM pipeline, font embedding, performance characteristics
- **METRICS.md** - Current test counts, coverage, sizes (auto-generated)
- **TESTING_STRATEGY.md** - Testing philosophy, patterns
- **.claude/CI_CD_IMPLEMENTATION_LOG.md** - Full Phase 1-6 implementation history

---

## References

**Build limits:** `justfile` lines 11-34 (SSOT)
**Current metrics:** `docs/METRICS.md` (auto-generated)
**WASM validation:** `scripts/check-wasm.sh`
**Bundle size check:** `scripts/check-bundle-size.sh`
**Pre-commit hook:** `.husky/pre-commit`
**Type generation:** `scripts/gen-ts-from-schemas.ts`

---

**Philosophy:** Security first. Fail fast. Build once. Heavy guardrails.
