# AGENTS.md — Durable Rules for AI Agents Working on Resumate

This file captures the non-negotiable rules for any automated agent (Claude,
Copilot, Codex, etc.) touching this repo. Read it first. It complements
`.claude/CLAUDE.md` (mental models) and `docs/*.md` (deep dives) by stating
what you must never do and what you must always do.

If a rule here conflicts with something else, this file wins.

---

## Stack

- **Frontend:** Next.js 16 + React 19 + TypeScript 5 + Tailwind 4
- **Backend/compute:** Rust workspace (`crates/{shared-types,resume-typst,resume-wasm}`)
- **PDF engine:** Typst (compiled to WASM, runs in-browser)
- **Build tool:** `just` (run `just` for the command menu)
- **Package manager:** `bun` (see `bun.lock`)

## Daily Commands

| Intent                   | Command                           |
| ------------------------ | --------------------------------- |
| Dev server               | `just dev`                        |
| Unit tests               | `just test`                       |
| Full check (fmt+TS+Rust) | `just check`                      |
| CI-equivalent locally    | `just ci`                         |
| Regenerate types         | `just types-sync`                 |
| Pull resume data         | `just data-pull`                  |
| Push resume data         | `just data-push`                  |
| Dead code scan           | `bun run deadcode` (or `just deadcode`) |
| Format everything        | `bun run format`                  |

---

## Critical Rules (violate and the build breaks)

### 1. Never bypass git hooks

- Do **not** pass `--no-verify`, set `HUSKY=0`, delete `.husky/*`, or otherwise
  skip pre-commit / commit-msg hooks.
- If a hook fails, **fix the root cause**. Hook output is the signal.
- CI re-runs every check anyway — bypassing locally just moves the failure.
- The single exception: a sandbox env genuinely can't run hooks (missing PII
  data files). Document the bypass in the commit message.

### 2. Generated files are read-only

- `schemas/resume.schema.json` — generated from Rust
- `lib/types/generated-resume.ts` — generated from the schema
- Never hand-edit either. Regenerate via `bun types:generate` or `just types-sync`.
- Types flow one-way: **`crates/shared-types/src/lib.rs` → JSON Schema → TS types.**
- Pre-commit Phase 6 enforces this. Type drift fails the build.

### 3. WASM does no logic

- WASM (`crates/resume-wasm`) only compiles Typst → PDF bytes.
- All scoring and selection lives in TypeScript:
  - `lib/selection.ts` — diversity-aware selection
  - `app/api/resume/select/route.ts` — heuristic scoring
  - `app/api/resume/ai-select/route.ts` — LLM scoring
- Do not move scoring into Rust or WASM without explicit architecture sign-off.

### 4. Client never receives raw data

- API returns `SelectedBullet[]` plus minimal personal/education/skills —
  never the full compendium.
- Email/phone must be hashed or omitted client-side (bot-scrape protection).
- Turnstile CAPTCHA guards PDF and vCard downloads.

### 5. Conventional Commits

Every commit message must match:

```
<type>(<scope>)?: <subject>
```

Allowed types (enforced by `commitlint.config.mjs`):

`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`, `ci`, `build`

Subjects are lowercase, imperative, no trailing period. Keep the subject under
72 chars; put the reasoning in the body.

### 6. File length

- **Max 500 lines per file** (tests exempt). TODO: tighten to 250.
- Only known violator: `components/data/ResumeDownload.tsx` (file-level
  `/* eslint-disable max-lines */` with a TODO to split into subcomponents).
- Enforced by ESLint `max-lines`.

### 7. No `console.log`

- Use `console.warn` / `console.error` in app code.
- `scripts/**` is exempt (logging is the job).
- Enforced by ESLint `no-console`.

### 8. No `.only` in committed tests

- `it.only`, `describe.only`, `test.only` are blocked by `no-restricted-syntax`.
- Remove them before committing. Pre-commit will catch you.

### 9. Data files are gitignored PII

- `data/resume-data.json` contains real resume data. **Never commit it.**
- Use `just data-pull` (fetch from gist) and `just data-push` (update gist).
- The template `data/resume-data-template.json` is the only data file in git.

### 10. Public repo hygiene

- Assume every commit is read by someone at a target company.
- No TODOs with swear words, no debugging scaffolding, no secrets, no PII.

---

## The 7-Phase Pre-Commit Pipeline

`.husky/pre-commit` runs, in order:

1. **Secret scanning** — gitleaks + ripsecrets + trufflehog
1.5. **Auto-format staged** — lint-staged (prettier --write + eslint --fix)
2. **Lint + typecheck** — eslint, tsc, cargo fmt --check, clippy -D warnings
3. **WASM freshness** — rebuild if `crates/resume-wasm`, `crates/resume-typst`, `crates/resume-core`, `crates/shared-types`, `typst/templates`, or `typst/fonts` changed
4. **Bundle size** — enforce WASM binary limits from `justfile`
5. **WASM tests** — run if WASM was rebuilt this commit
6. **Type sync** — regenerate schema + TS types if `shared-types/` changed
7. **Full test suite** — Rust + TS + data validation + doc verification

Timing SLO: **70 seconds** (sourced from `justfile`). Regressions fail the hook.

---

## Knip Exceptions (`knip.json`)

Each ignored entry must have a documented reason:

- `lib/types/generated-resume.ts` — generated from schema, not hand-maintained
- `types/resume.ts` — ambient type augmentation used across the app
- `types/wasm.d.ts` — ambient module declarations for WASM imports

New ignores require a one-line rationale added here.

---

## Useful References

- `docs/ARCHITECTURE.md` — system design
- `docs/BUILD_PIPELINE.md` — WASM + type-sync deep dive
- `docs/TESTING_STRATEGY.md` — TDD approach, coverage targets
- `docs/METRICS.md` — auto-generated test/coverage counts
- `docs/CODEBASE_REVIEW.md` — known issues, P0/P1 backlog
- `.claude/CLAUDE.md` — mental models and data flow
- `app/CLAUDE.md` — Next.js patterns
- `scripts/CLAUDE.md` — tooling reference
- `.github/workflows/CLAUDE.md` — CI/CD notes

---

## When in Doubt

1. Read the hook output.
2. Read the relevant `CLAUDE.md` for the directory you're in.
3. Run `just` to discover the right command.
4. Ask before bypassing any guardrail.
