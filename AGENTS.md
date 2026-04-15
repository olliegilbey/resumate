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

| Intent                   | Command                                 |
| ------------------------ | --------------------------------------- |
| Dev server               | `just dev`                              |
| Unit tests               | `just test`                             |
| Full check (fmt+TS+Rust) | `just check`                            |
| CI-equivalent locally    | `just ci`                               |
| Regenerate types         | `just types-sync`                       |
| Pull resume data         | `just data-pull`                        |
| Push resume data         | `just data-push`                        |
| Dead code scan           | `bun run deadcode` (or `just deadcode`) |
| Format everything        | `bun run format`                        |

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

- **Max 250 effective lines per file** (blank lines + comments skipped, tests exempt).
- Enforced by ESLint `max-lines`. No `eslint-disable max-lines` in source — split instead.

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

## Immutability

- Prefer `const` over `let`. `functional/no-let` warns on `let`.
- Prefer spread over in-place mutation: `{...obj, key: v}`, `[...arr, x]`.
- `functional/immutable-data` runs with typed linting, globally, with these
  tuning options (not strictness relaxations):
  - `ignoreNonConstDeclarations`: `let` is caught by `no-let`, not double-flagged.
  - `ignoreClasses`: class field assignment is idiomatic OOP.
  - `ignoreMapsAndSets`: `Map`/`Set` have no immutable API.
- Severity today: `warn` (209 warnings, tracked in `docs/IMMUTABILITY_GAPS.md`).
  Will promote to `error` once the hotspots drop (criteria in that doc).
- WASM boundary payloads are already immutable by design.
- `just agent-check` runs typecheck → lint → test as a post-change gate.

## TSDoc coverage

- Every exported function/type/constant needs a one-line TSDoc.
- Exported functions additionally get `@param`, `@returns`, and `@example`
  where practical.
- Coverage is tracked in `docs/TSDOC_GAPS.md`. When you touch a file listed
  there, document the symbols as part of your change — don't leave it for
  later.

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

Every entry in `knip.json` `ignore` / `ignoreDependencies` must have a
documented reason here. knip.json itself rejects unknown keys, so rationales
live in this file.

### Files

- `lib/types/generated-resume.ts` — generated from schema, not hand-maintained
- `types/resume.ts` — ambient type augmentation used across the app
- `types/wasm.d.ts` — ambient module declarations for WASM imports
- `public/theme-init.js` — loaded by `app/layout.tsx` via `<Script src=...>`,
  not imported from TS
- `public/wasm/resume_wasm.js` — emitted by wasm-pack, loaded dynamically at
  runtime via the WASM loader
- `scripts/test-bullet-selection-api.ts` — manual dev harness for hitting
  `/api/resume/select` locally; run ad-hoc via bun
- `scripts/transform-resume-data.ts` — one-off data migration script, kept
  for provenance
- `lib/__tests__/helpers/mock-data.ts` — mock fixtures consumed by tests via
  relative imports that knip can't resolve through vitest
- `lib/__tests__/helpers/mock-fetch.ts` — shared test helper used across
  route integration tests
- `lib/__tests__/helpers/rate-limit-helper.ts` — `clearRateLimits` is used
  in per-test setup across multiple suites
- `lib/analytics/types.ts` — shared analytics type definitions re-exported
  from sibling files
- `lib/analytics/types-base.ts` — base analytics types consumed via
  type-only re-exports from `lib/analytics/types.ts`; knip treats the
  indirection as unused
- `lib/analytics/event-properties-client.ts` — client-side event-property
  interfaces composed into `EventPropertiesMap` in `lib/analytics/types.ts`;
  consumed via typed re-export only
- `lib/analytics/event-properties-server.ts` — server-side event-property
  interfaces for API routes, same re-export pattern as the client file
- `lib/analytics/events.ts` — PostHog event type catalogue exported for
  analytics authoring
- `lib/posthog-client.tsx` — `usePostHogContactCard` is intentionally
  exported for future call sites
- `lib/posthog-hooks.tsx` — domain hooks (`usePostHogResume`,
  `usePostHogContactCard`) kept as the public analytics surface; knip can't
  trace all runtime entry points
- `lib/vcard.ts` — `generateAndDownloadVCard` is a public helper; knip can't
  trace the lazy import path from `components/data`

### Dependencies

- `@eslint/eslintrc` — transitively used by the `next/core-web-vitals` flat
  config bridge; knip can't see through it
- `playwright` — reserved for upcoming E2E work, kept installed intentionally
- `postcss` — required by `postcss.config.mjs` which Next.js resolves at
  build time, not by direct import

New ignores require a one-line rationale added to the appropriate section
above.

---

## Useful References

- `docs/ARCHITECTURE.md` — system design
- `docs/BUILD_PIPELINE.md` — WASM + type-sync deep dive
- `docs/TESTING_STRATEGY.md` — TDD approach, coverage targets
- `docs/METRICS.md` — auto-generated test/coverage counts
- `docs/CODEBASE_REVIEW.md` — known issues, P0/P1 backlog
- `docs/IMMUTABILITY_GAPS.md` — ratchet tracker for `functional/*` warnings
- `docs/TSDOC_GAPS.md` — ratchet tracker for undocumented exports
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
