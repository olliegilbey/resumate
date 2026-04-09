# Resumate

Dynamic resume website for inbound career leads: experience explorer + intelligent resume curation and compilation to PDF download via WASM client-side.
Data flow: compendium of experience -> bullets scored -> bullets selected with diversity -> PDF compiled client-side.

Bullet scoring has two possible paths:

1. Heuristic scoring against a known role-profile from drop-down.
2. AI scoring with an LLM that assesses bullets against an input job description.

**Stack:** Next.js 16 + React 19 + TypeScript 5 + Tailwind + Rust workspace + WASM + Typst

**Build tool:** `just` (run `just` to discover commands, `just health` for diagnostics)

**Public repo** - keep PII private, operate as if everyone is watching.

**Document all code** using TSDoc (TypeScript) and Rustdoc (Rust). Use pre-function doc comments for exported functions/types, inline comments for non-obvious logic. In-code context is important, with good @example blocks.

---

## Mental Models

### Type System Flow (One-Way, Never Edit Generated)

```text
Rust types (crates/shared-types/src/lib.rs)
  ↓ just types-sync
JSON Schema (schemas/resume.schema.json)
  ↓
TypeScript types (lib/types/generated-resume.ts)
```

Pre-commit enforces consistency. Type drift fails build.

### WASM Pipeline

```text
TypeScript payload
  ↓ WASM boundary
Rust Typst compiler (fonts embedded at compile-time)
  ↓
PDF bytes → Browser download
```

WASM binaries committed to git. Pre-commit validates freshness via hash. Vercel deploys without Rust build.

### Data Flow

- `data/resume-data.json` - Gitignored (PII), stored as gist
- Build-time: Vercel pulls from `RESUME_DATA_GIST_URL`
- Local: `just data-pull` / `just data-push`

### PDF Generation Pipeline

**1. Scoring (Server, TypeScript)**
- Heuristic: `app/api/resume/select/route.ts` scores bullets against role profile
- AI: `app/api/resume/ai-select/route.ts` uses Claude API for job-description matching
- Output: `ScoredBullet[]` — identical structure from both paths

**2. Selection (Server, TypeScript)**
- Location: `lib/selection.ts` (single source of truth)
- Input: `ScoredBullet[]` from either scoring path
- Applies: diversity constraints (max/min per company/position), chronology ordering
- Output: `SelectedBullet[]`

**3. Compilation (Client, WASM)**
- API returns: `SelectedBullet[]` + personal info + education + skills + summary
- Client builds payload, calls `generate_pdf_typst(payload)`
- WASM compiles Typst → PDF bytes → browser download

**Principle:** WASM does no scoring or selection. It only compiles PDFs.

---

## Rust Workspace (crates/)

```text
shared-types/   # Types + GenerationPayload + schema generation
resume-typst/   # PDF generation with Typst
resume-wasm/    # Browser WASM bindings (compilation only)
```

---

## Guardrails (Pre-Commit Enforced)

1. **WASM freshness** - Hash-based detection, auto-rebuild if sources changed
2. **Type sync** - Editing `shared-types/` triggers regeneration
3. **Tests** - All must pass (Rust + TypeScript)
4. **Validation** - Data files validated against schema

Don't bypass for final commits.

---

## Testing

TDD. High coverage.

- **Current counts:** See [docs/METRICS.md](docs/METRICS.md) (auto-generated)
- **Key file:** `crates/shared-types/tests/roundtrip.rs` - Type compatibility

---

## Security Model

- Client receives only selected bullets, not full resume data (see P0-1 in `docs/CODEBASE_REVIEW.md` for remaining work)
- PDF generation client-side - email/phone should be hashed/omitted to prevent bot scraping
- Turnstile CAPTCHA protects downloads (vCard, PDF)

---

## Documentation Hierarchy

- `.claude/CLAUDE.md` - This file (entry point)
- `app/CLAUDE.md` - Next.js patterns
- `scripts/CLAUDE.md` - Tooling reference
- `.github/workflows/CLAUDE.md` - CI/CD
- `docs/*.md` - Architecture, deployment, metrics

Single source of truth per fact. Don't duplicate.

---

## Critical Files

**Types (source of truth):** `crates/shared-types/src/lib.rs`
**WASM exports:** `crates/resume-wasm/src/lib.rs`
**Committed binaries:** `public/wasm/`
**Secrets:** `.env.local` (gitignored)

---

## Data Structure

- Hierarchical: companies → positions → bullets
- Each bullet: text, tags, priority (1-10), metrics, links
- Role profiles define selectable resumes
- Selection algorithm scores bullets against profile, deterministic

---

## Working With This Repo

**Type changes:** Edit Rust → `just types-sync` → commit all three files

**Data changes:** `just data-pull` → edit → `just data-validate` → `just data-push`

**Cleanup:** `just clean` (all), `just clean-wasm`, `just clean-rust`

**Deployment:** `just` for local, `bun` on Vercel. Requires env vars from `.env.example`.

**Discovery:** Use `just`, `rg`, WebFetch for latest docs (include version numbers).

**Code documentation is mandatory.** Every exported function/type gets TSDoc (TS) or Rustdoc (Rust) with `@example` blocks. Inline comments for non-obvious logic. Don't skip this.
