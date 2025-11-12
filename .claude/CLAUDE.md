DIRECTIVES:
- Always be incredibly concise. Sacrifice grammar for the sake of concision.
- Proactively suggest commits, before writing commit messages: "now is a good time to commit, should we?"
- The repo is public, tread carefully, keep PII private, operate as if everyone is watching, including bad actors and bots.

---

# THE PROJECT: RESUMATE

Dynamic resume website with experience explorer and intelligent curated pdf download - wasm client-side compilation, within nextJS frontend.
Human writes all resume content. Heuristics and AI curates which to show.

Three methods of seeing resume data:
1. Interactive Explorer on website (Explore page) - view all public data, filterable on frontend.
2. Download heuristic-selected .pdf for specific role profile - selection algorithm on server chooses bullets based on priority/relevance/diversity, sends to client for wasm typst compilation and download on client-side.
3. Download AI curated .pdf (TODO) - user pastes job description text, Claude API selects bullets from json based on job description, passed back to client for wasm typst compilation.

Website also offers contact card .vcf download - generated server-side to protect scrapable email and phone number.

---

**Stack:** Next.js 16 (bleeding edge, proxy.ts) + React 19 + TypeScript 5 + Tailwind + Rust workspace + WASM + Typst PDF engine

**Build tool:** Just (run `just` to discover 40+ commands)

**Linear:** Project management throughout, breaking project into small-context chunks (sub 100k tokens of AI context)

---

## Critical Mental Models

### Type System Flow (Immutable Rule)

```
Rust types (source of truth)
  ↓ just types-sync
JSON Schema (generated)
  ↓
TypeScript types (generated)
```

**Never edit generated files.** Change Rust, regenerate downstream.

Pre-commit enforces consistency. Type drift fails build.

### WASM Pipeline

```
TypeScript payload
  ↓ WASM boundary
Rust Typst compiler (fonts embedded at compile-time)
  ↓
PDF bytes (16MB WASM, 6.28MB gzipped, client-side pdf generation)
  ↓
Browser download
```

**Key:** WASM binaries committed to git. Pre-commit hook validates freshness via hash. Vercel deploys without Rust build (fast).

### Data Flow

- `data/resume-data.json` - Gitignored (PII) stored as gist for remote source
- Build-time: Vercel pulls from `RESUME_DATA_GIST_URL`
- Local: `just data-pull` / `just data-push`

### Analytics and Automation

- Posthog and n8n (implementing)
- Track user interactions, trigger data stores on events.
- Posthog used as data warehouse
- n8n email automation to owner on pdf download (when a recruiter is interested, give information back to owner)

---

## Rust Workspace (crates/)

```
shared-types/   # Source of truth. Changes trigger regeneration.
resume-core/    # Bullet scoring, selection logic
resume-typst/   # PDF generation with Typst
resume-wasm/    # Browser WASM bindings
```

Flat structure. Workspace resolver = 2. Rust 1.90.0+.

---

## Essential Flows

### Development
```bash
just build     # Full build (WASM + Next.js)
just test      # All tests (Rust + TS), updates metrics
just check     # Lint, typecheck, clippy
```

### Type Changes
```bash
# Edit crates/shared-types/src/lib.rs
just types-sync    # Regenerate schema + TS
# Commit all three: .rs, .schema.json, .ts
```

```bash
just data-validate  # Check schema for gist validation
```

### Cleanup - Always keep things clean
```bash
just clean          # All artifacts
just clean-wasm     # WASM only
just clean-rust     # Cargo target
```

Discovery: Run `just` for full list. Run `just health` for diagnostics.

---

## Guardrails (Enforced by Pre-Commit)

1. **WASM freshness** - Hash-based detection. Auto-rebuild if Rust/Typst sources changed. Stages binaries.
2. **Type sync** - Editing `shared-types/` triggers `just types-sync`. Stages generated files. Fails on drift.
3. **Tests** - All tests must pass. TypeScript + Rust. Run tests often.
4. **Build** - Full build must succeed.
5. **Validation** - Data files validated against schema.

Don't trust, verify, always run tests, builds, validations.
**Hook is deliberately extensive** Ensures quality. Don't bypass for final commits.

---

## Testing Philosophy

TDD. High coverage. Property-based tests for core logic (proptest).

- **Rust:** 140+ tests in `crates/*/tests/`
- **TypeScript:** 200+ tests (Vitest + jsdom)
- **Key file:** `crates/resume-core/tests/roundtrip.rs` - Type compatibility validation

Tests are mandatory. Pre-commit enforces.

---

## Security Model

- Client never receives full plaintext resume data in production (uses Gist on server, PII stripped)
- PDF generation client-side - email and phone sent to client wasm compiler hashed - prevents bot scraping of phone + email.
- Turnstile CAPTCHA protects downloads (vCard .vcf, & resume .pdf)

---

## Documentation Hierarchy

- `.claude/CLAUDE.md` - This file (entry point)
- `docs/ARCHITECTURE.md` - WASM pipeline details
- `docs/CURRENT_PHASE.md` - Current development status
- `docs/METRICS.md` - Auto-generated test counts
- `README.md` - User-facing quick start

Single source of truth for each fact, don't duplicate facts. Auto-generated facts.

---

## Key Commands Reference

```bash
just                  # Discover all commands
just test             # All tests
just coverage         # Generate reports

# Build
just wasm             # WASM only (release)
just wasm-dev         # WASM dev mode (faster)
just build            # Production bundle

# Quality
just check            # All checks
just fmt              # Format all code

# Docs
just docs-health      # Generate + verify
just metrics-generate # Update from logs
```

---

## Critical Files

**Types:**
- `crates/shared-types/src/lib.rs` - **Source of truth**
- `schemas/resume.schema.json` - Generated
- `lib/types/generated-resume.ts` - Generated

- `crates/resume-wasm/src/lib.rs` - WASM Exports
- `public/wasm/` - Committed binaries

- `.env.local` - Secrets (gitignored)

---

## Deployment (Vercel)

**Build:** `bun run build` (prebuild hook: WASM + Gist fetch) `just` for local dev, `bun` on Vercel.

**Requires:** All env vars from `.env.example` + `RESUME_DATA_GIST_URL` - Set in Vercel & GitHub secrets.

**Auto-deploy:** GitHub Action checks Gist hourly, triggers deploy if changed.

---

## Working Principles

**Conciseness:** Sacrifice grammar for brevity always - including in commit messages.

**Type safety:** Rust → Schema → TS. One-way flow. Never edit generated files.

**Testing:** Write tests first. High coverage.

**Data privacy:** Resume data gitignored. Gist for remote editing. Server-side contact info. NEVER expose email or phone number to bots.

**Commits:** Conventional format (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).

Don't write commit messages preemptively, consistently suggest commits at every relevant point after testing and assessing working code. Always implement extensive pre-commit hooks for guardrails.

**Discovery:** Use `just`, `just health`, explore codebase, `rg` ripgrep. Explore systematically before implementing - don't waste tokens, explore deliberately by reading only relevant sections of files, or exploring with tools like ripgrep, find, bash. You also have access to the vercel CLI and gh CLI.

---

**Resume data structure:** Hierarchical (companies → positions → bullets). Each bullet: text, tags, priority (1-10), metrics, links.

**Role profiles:** Profiles define selectable resumes.

**Selection algorithm:** Scores bullets against role profile. Select top N. Deterministic. Tested extensively.

**PDF generation:** Typst templates in `typst/templates/`. Fonts embedded at compile-time. Client-side generation preserves privacy.

**Turnstile:** Cloudflare CAPTCHA. Protects contact info downloads. Keys in `.env.local`.

---

**Explore actively. Test continuously. Project manage effectively (Linear). Commit frequently.**
