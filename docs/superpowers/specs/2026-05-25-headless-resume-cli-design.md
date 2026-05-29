# Headless Resume CLI — Design

**Status:** Drafted via /superpowers:brainstorming, awaiting implementation.
**Date:** 2026-05-25
**Owner:** Oliver

## Goal

Add a thin headless CLI to resumate that compiles a `GenerationPayload` JSON into a PDF locally, with no Next.js / WASM / browser involvement. Enables outbound application automation from the sibling `~/jarvis` repo, where job-context-aware payloads are built per role.

Resumate today serves _inbound_ (the web app + WASM client-side compile). This CLI extends it for _outbound_ (jarvis builds custom payloads per application and shells out to compile).

## Non-goals

- **Layout / template changes.** Deferred. Current Typst template is used as-is. A future pass will move the template closer to the user's hand-crafted outbound CV design.
- **Selection logic in Rust.** All scoring, selection, diversity constraints, bullet editing, and summary rewriting stay outside the CLI. Jarvis is the brain; the CLI is dumb.
- **Hosting / publishing the CLI.** Local-only. No `cargo install`, no Homebrew, no npm. Jarvis invokes via absolute path to `target/release/resume-cli`.

## Architecture

```
┌──────────────────── jarvis (~/jarvis) ────────────────────┐
│ claude code skill: build-resume                           │
│   • reads resume compendium cache                         │
│   • reads Airtable role context (JD, fit, tech depth)     │
│   • LLM crafts/edits bullet text + summary                │
│   • writes data/applications/<co>-<role>-<date>.json      │
│   • shells out ↓                                          │
└───────────────────────────┬───────────────────────────────┘
                            │ JSON via stdin or --input
                            ▼
┌───────────────────── resumate (~/code/resumate) ──────────┐
│ crates/resume-cli (NEW)                                   │
│   • parse GenerationPayload JSON                          │
│   • call resume_typst::render_resume(&payload, dev_mode)  │
│   • write PDF to stdout or --output                       │
│                                                           │
│ crates/resume-typst (unchanged)                           │
│   • render_resume(&GenerationPayload, dev_mode) → Vec<u8> │
└───────────────────────────────────────────────────────────┘
```

The boundary between repos is **the `GenerationPayload` JSON contract**. Schema is exported by resumate (see "Schema export" below) and consumed by jarvis.

## Components

### 1. `crates/resume-cli` (new bin crate)

Tiny clap-based wrapper around `resume_typst::render_resume`.

**Interface:**

```
resume-cli [--input <FILE>|-] [--output <FILE>|-] [--dev-mode]

  --input    Path to GenerationPayload JSON. Default: stdin (-).
  --output   Path for PDF bytes. Default: stdout (-).
  --dev-mode Pass-through flag to renderer (faster compile, no optimisations).

Exit codes:
  0  ok
  1  parse error (invalid JSON / shape mismatch)
  2  validation error (e.g. missing required field after deserialisation)
  3  render error (Typst compile failure)
```

**Dependencies:** `clap`, `serde_json`, `shared-types`, `resume-typst`, `anyhow`.

**Size target:** ~100 LOC including a smoke test that round-trips a fixture payload.

**Workspace registration:** Added to root `Cargo.toml` workspace members. Does **not** affect the WASM build (separate crate).

### 2. Make `ScoredBullet.score` optional

Currently `ScoredBullet.score: f64` is required, but the renderer never reads it (verified — `template.rs:141` groups by hierarchy, doesn't sort by score). Forcing jarvis to emit `"score": 0` on every bullet would be a lie and noise in the JSON.

**Change:** in `crates/shared-types/src/lib.rs`, make `ScoredBullet.score` an `Option<f64>` (or add `#[serde(default)]`).

**Touchpoints:**

- Any TS/Rust code that reads `bullet.score` in the existing pipeline must handle the optional. Audit `lib/selection.ts` consumers and any Rust callers — the score is used during selection in TS, not during rendering, so the change should be contained.
- Schema regeneration (`just types-sync`) propagates to TS types automatically.

### 3. Schema export for `GenerationPayload`

`crates/shared-types/src/bin/generate_schema.rs` today only emits `ResumeData`. Extend it to also emit `schemas/generation-payload.schema.json` (separate file). Jarvis points its payload-builder skill at this file as the authoritative shape.

### 4. Justfile entries

- `just cli` — release-build the binary, print absolute path on success (so jarvis can pick it up programmatically or via copy-paste during skill setup).
- `just cli-example` — runs the binary against a fixture payload (`crates/resume-cli/tests/fixtures/example-payload.json`) and emits a PDF to `test-outputs/cli-smoke.pdf`. Doubles as smoke test.

### 5. Fixture + test

`crates/resume-cli/tests/fixtures/example-payload.json` — a minimal but complete payload exercising all renderer-consumed fields. Used by the smoke test and as a copy-paste starting point for jarvis.

A single integration test in `crates/resume-cli/tests/render.rs`:

- Reads the fixture
- Invokes the binary via `assert_cmd` (or `Command`)
- Verifies exit 0, non-empty stdout, and PDF magic bytes (`%PDF-`).

## Data contract: what jarvis must produce

The renderer (see `crates/resume-typst/src/template.rs:141-227`) reads:

| Field                                                                 | Required                     | Notes                                                                                                         |
| --------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `personal.name, email, phone, location, linkedin, github, website`    | yes (struct required)        | Email/phone may be hashed/omitted per security model                                                          |
| `selected_bullets[]`                                                  | yes                          | Already-edited, already-ordered. Hierarchy via inline `companyName` / `positionTitle` / dates on each bullet. |
| `role_profile.name, .description`                                     | yes (struct required)        | **Display strings only.** Set to anything — e.g. "Senior Platform Engineer @ Acme". Not used for any logic.   |
| `summary`                                                             | optional                     | Free text. Jarvis rewrites per JD.                                                                            |
| `education[]`, `skills`                                               | optional                     | Pass through from compendium.                                                                                 |
| `meta_footer`, `total_bullets_available`, `total_companies_available` | optional                     | Display strings only.                                                                                         |
| `metadata`                                                            | optional                     | Generation ID, timestamp — for jarvis-side tracking.                                                          |
| `selected_bullets[].score`                                            | **optional after change #2** | Renderer ignores. Omit.                                                                                       |

**Key insight for jarvis:** the payload IS the resume in data form. Bullet text and summary are passed through verbatim — jarvis has full editorial freedom to rewrite, customise, and reorder. The compendium is the source of _facts_; jarvis is the editor.

## Out of scope / future work

- **Outbound-flavoured Typst template.** Tighter density, ATS-friendly single-column, no fancy accents. Add as `--template outbound` flag once the CLI proves out the workflow. The inbound site keeps its current look.
- **Jarvis-side `build-resume` skill.** Owns: compendium read, Airtable role lookup, LLM-driven bullet selection + rewriting, payload assembly, CLI invocation, PDF storage alongside the application markdown file. Lives in jarvis, separate session.
- **PDF storage convention in jarvis.** Likely `~/jarvis/data/applications/<company>-<role>-<YYYY-MM-DD>.{json,pdf}` paired files. To be designed in the jarvis-side spec.

## Risk / open questions

- **`ScoredBullet.score` consumers.** Need to audit `lib/selection.ts` and any Rust call sites before flipping it to optional, to ensure all readers handle `None` / `undefined` gracefully. Low risk — score is selection-time data.
- **Font availability.** `resume-typst` embeds fonts at compile time, so the CLI should be hermetic. Confirm via the smoke test on a clean shell.
- **Schema drift.** Jarvis caches `generation-payload.schema.json`. If resumate's types change without notice, jarvis payloads silently break. Mitigation: jarvis re-fetches the schema as part of its skill bootstrap, same pattern as `fetch-compendium.mjs`.

## Sizing

- `resume-cli` crate scaffolding + parse/render/IO: ~1 hour
- Schema export extension: ~10 min
- `ScoredBullet.score` optional + consumer audit: ~30 min
- Fixture + smoke test: ~30 min
- Justfile + docs: ~15 min

**Total in resumate:** ~2.5 hours. Jarvis-side skill is a separate effort, separate spec.

## Implementation order (for the later session)

1. Make `ScoredBullet.score` optional in `shared-types`. Run `just types-sync`. Audit + fix consumers. All tests green.
2. Extend `generate_schema.rs` to also emit `generation-payload.schema.json`. Verify it parses.
3. Scaffold `crates/resume-cli` crate, register in workspace.
4. Implement CLI: clap args → JSON parse → `render_resume` → write PDF.
5. Add fixture + integration test.
6. Add `just cli` and `just cli-example` recipes.
7. Brief `crates/resume-cli/README.md` covering invocation + payload shape + link to schema.
8. PR with all of the above bundled. Conventional commit: `feat(cli): headless resume-cli for outbound automation`.
