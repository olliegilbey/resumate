# Resumate

Dynamic resume website: experience explorer + intelligent PDF download via WASM client-side Typst compilation.

**Stack:** Next.js 16 + React 19 + TypeScript 5 + Tailwind + Rust workspace + WASM + Typst

**Build tool:** `just` (run `just` to discover commands, `just health` for diagnostics)

**Public repo** - keep PII private, operate as if everyone is watching.

---

## Mental Models

### Type System Flow (One-Way, Never Edit Generated)

```
Rust types (crates/shared-types/src/lib.rs)
  ↓ just types-sync
JSON Schema (schemas/resume.schema.json)
  ↓
TypeScript types (lib/types/generated-resume.ts)
```

Pre-commit enforces consistency. Type drift fails build.

### WASM Pipeline

```
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

---

## Rust Workspace (crates/)

```
shared-types/   # Source of truth - changes trigger regeneration
resume-core/    # Bullet scoring, selection logic
resume-typst/   # PDF generation with Typst
resume-wasm/    # Browser WASM bindings
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

TDD. High coverage. Property-based tests for core logic (proptest).

- **Current counts:** See [docs/METRICS.md](docs/METRICS.md) (auto-generated)
- **Key file:** `crates/resume-core/tests/roundtrip.rs` - Type compatibility

---

## Security Model

- Client never receives full plaintext resume data in production
- PDF generation client-side - email/phone hashed to prevent bot scraping
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
