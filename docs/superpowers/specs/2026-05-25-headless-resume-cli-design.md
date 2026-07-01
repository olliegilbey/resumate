# Resume Layout Overhaul + Headless CLI — Design

**Status:** 🔧 ACTIVE (revived 2026-07-01). Scope: adopt the hand-crafted CV layout across
**both** surfaces (web app + a new headless CLI) in lockstep. The CLI is one workstream inside
the layout overhaul.
**Dates:** drafted 2026-05-25 (CLI only) · expanded 2026-07-01. **Owner:** Oliver.
**Anchors are `file:line` as of `main @ 2026-07-01`; line numbers drift — grep the symbol.**
**This spec is the build contract. Defaults below are decided — see "Decisions locked"; do not
re-litigate them mid-build.**

---

## TL;DR for the next agent

- **Goal:** render Ollie's hand-crafted CV layout (in `~/jarvis/scripts/resume/`) from Resumate,
  delivered **identically** by the web app (WASM) and a new headless CLI. Target: same
  `GenerationPayload` → **SHA-identical PDF** on both surfaces.
- **Mental model (the naming misleads):** the on-disk `typst/templates/resume.typ` is a **dead
  placeholder**. The real layout is **Rust string concatenation** in `render_template()`
  (`crates/resume-typst/src/lib.rs:97-505`). Typst *is* compiling the PDF — it just compiles a
  Typst-source *string that Rust builds at runtime*, not the `.typ` file. "Swapping the
  template" = changing where that source string comes from.
- **Why lockstep is easy:** both surfaces already call the same
  `resume_typst::render_resume(&payload, dev_mode)` (`lib.rs:70`). Do the layout work **once in
  the shared `resume-typst` crate** and both surfaces inherit it. Never duplicate the layout.
- **Approach:** Route B — make `render_resume` compile the ported `template.typ` as the real
  source, fed data via `sys.inputs`, replacing the Rust string-builder.
- **Biggest work item:** the **data adapter** (`GenerationPayload` → the template's flat JSON).
- **SHA-identity essentials:** pin the PDF date from the payload (it's wall-clock today,
  `compiler.rs:117-120`); use the same *embedded* fonts on both surfaces (never system fonts);
  verify wasm-vs-native byte-identity with a lockstep test.

---

## Goal

Adopt Ollie's hand-crafted CV layout as Resumate's resume output, delivered by **two surfaces in
lockstep**:

1. **Inbound — the web app.** Visitors select/generate and download; renders client-side via
   WASM. Must produce the new layout.
2. **Outbound — a headless CLI.** `~/jarvis` builds a job-context-aware `GenerationPayload` per
   application and shells out to compile a PDF locally (no Next.js / WASM / browser). Must
   produce the *same* layout.

**Lockstep requirement:** the two surfaces must produce **identical — ideally SHA-identical —
PDFs** for the same payload. This drives the architecture: one shared layout core, deterministic
output, and a test that enforces it.

The layout is the one Ollie hardened in `~/jarvis/scripts/resume/` (reproduces his old
Google-Docs CV export pixel-for-pixel: navy `#00368e`, "OG" monogram, Times-New-Roman-metric
serif, centred-on-name-axis section headers, generous dividers, a " - aside" convention on
titles/education, inline auto-linking). See "The layout to adopt".

## Non-goals

- **Selection logic in Rust.** All scoring, selection, diversity constraints, bullet editing and
  summary rewriting stay in TypeScript (`lib/selection.ts`) / jarvis. The renderer is dumb: it
  lays out whatever bullets it's handed.
- **Hosting/publishing the CLI.** Local-only; jarvis invokes via absolute path to
  `target/release/resume-cli`.
- **Proprietary fonts.** Real Times New Roman / Arial are not embeddable (licensing + WASM
  size). Use the metric-compatible open clones **Liberation Serif** (≈ Times New Roman) and
  **Liberation Sans** (≈ Arial) — already the project's font approach (`docs/ARCHITECTURE.md:51`).

---

## How Resumate rendering actually works (read before touching anything)

**Typst compiles a source *string*, not necessarily a `.typ` file.** A `.typ` file is just one
way to supply the source. Resumate builds the Typst source **in Rust at runtime**, then hands
that string to the Typst compiler.

The live pipeline (per render):

```
GenerationPayload (JSON)
  → template::prepare_template_data()   crates/resume-typst/src/template.rs:140-229
        (regroups flat selected_bullets into company→position→bullet hierarchy;
         returns an intermediate serde_json::Value)
  → render_template()                    crates/resume-typst/src/lib.rs:97-505
        (reads that Value, push_str()s Typst MARKUP into a String, escaping every
         user value via escape_typst_string(); lib.rs:532)
  → ResumeWorld { source = that String } crates/resume-typst/src/compiler.rs:46-61
  → typst::compile(world)                crates/resume-typst/src/compiler.rs:70
  → typst_pdf::pdf(doc, PdfOptions::default())  lib.rs:85-87  → Vec<u8> (PDF bytes)
```

Key facts:

- **`typst/templates/resume.typ` is a dead placeholder.** It is `include_str!`'d at `lib.rs:75`
  and passed into `render_template` as the argument **`_template`** (`lib.rs:98`, underscore =
  unused) — the function ignores it and builds the layout from scratch. It's unfinished
  scaffolding; you will make it the real compile source (Route B).
- **`World::file()` hard-returns `NotFound`** (`compiler.rs:106-111`) — today the compiler cannot
  read any external file; the only source is the in-memory generated string.
- **Both surfaces share `render_resume`.** WASM: `generate_pdf_typst` →
  `resume_typst::render_resume` (`crates/resume-wasm/src/lib.rs:54-68`). CLI (new): same call.
  Tests: same call (`lib.rs:585`). This is why lockstep is natural.

Route B adds ≈0 bundle size — the Typst compiler is already bundled (`typst`, `typst-syntax`,
`typst-pdf`; `Cargo.toml:24-27`) and already compiles a runtime source string; a real `.typ` is
just a static `include_str!`. The WASM size budget is a **fonts** question, not a layout one.

---

## The layout to adopt (lives in `~/jarvis`)

- **Template:** `~/jarvis/scripts/resume/template.typ` — the real, hardened Typst layout to port.
- **Builder / reference adapter:** `~/jarvis/scripts/resume/build-resume.mjs` — parses a markdown
  resume into the JSON the template consumes; read it to learn the exact data contract and the
  inline-markdown behaviours.
- **Format spec:** `~/jarvis/scripts/resume/resume-format.md` — the compiler contract as a worked
  example.

**Data contract the template consumes** (in jarvis, injected via `--input data=<path>` and read
with `json(sys.inputs.data)` reading a *file path*; under Resumate it becomes
`json.decode(sys.inputs.data)` reading a *string*):

```jsonc
{
  "name": "Oliver James Gilbey",
  "citizenship": "South African / British - Dual Citizenship • London - Central",
  "links": [ { "label": "Website", "url": "http://ollie.gg" }, /* GitHub, LinkedIn, email, Contact Card */ ],
  "summary": "…one paragraph…",
  "work": [
    {
      "company": "Interchain Foundation",
      "companyUrl": "https://interchain.io/",     // nullable → plain navy if absent
      "location": "London - Remote",
      "title": "Developer Relations Lead - (promoted from Developer Advocate)",  // " - " tail = black-italic aside
      "dates": "January 2024 - April 2025",        // pre-formatted string
      "descriptor": "One-line italic company descriptor.",
      "bullets": [ "First-person bullet, no pronouns.", "…" ]   // plain strings
    }
  ],
  "education": {                                    // SINGLE object
    "heading": "Stellenbosch University - Two Undergraduate Degrees",
    "headingUrl": "http://www.sun.ac.za/english",  // nullable
    "location": "South Africa",
    "bullets": [ { "lead": "BSc Computer Science:", "rest": " modules…" } ]
  },
  "additional": [                                  // ORDERED, pre-typed blocks
    { "type": "section",  "text": "Additional" },
    { "type": "leadpara", "lead": "Technical skills:", "rest": " Python, …" },
    { "type": "section",  "text": "Personal Projects" },
    { "type": "bullets",  "items": [ { "lead": "Nalu", "rest": " (nalu.ollie.gg): …" } ] },
    { "type": "leadpara", "lead": "Personal Interests:", "rest": " Running, …" }
  ]
}
```

> The block above is the **full** contract the `.typ` can render. **Phase 1's adapter emits only**
> `name`, `citizenship`, `links`, `summary`, `work`, `education`, and an `additional` containing
> just the `Technical skills:` paragraph. Personal Projects + Interests are Phase 4.

Template behaviours the adapter must respect (all handled inside the `.typ` — the adapter just
supplies clean strings): bare-domain + `[text](url)` auto-linking; a leading `**lead**` is a bold
lead-in but mid-text `**bold**` renders literally; a " - " in a work title or the education
heading becomes a black-italic aside; work titles must fit one line (they share the row with
right-aligned dates); "Additional" must lead with a paragraph, not a sub-header, or the two
centred headers stack. Fonts in jarvis are real Times New Roman + Arial; under Resumate these
become Liberation Serif + Liberation Sans.

---

## Approach: layout in the shared crate (Route B)

**Do Route B: compile a real `.typ`, fed data via `sys.inputs`.** (The alternative — rewriting
the design inside `render_template`'s Rust `push_str` calls — is rejected: it keeps the layout in
imperative string-concat, doesn't reuse the jarvis `.typ`, and is hard to iterate.)

**Route B mechanics:**

1. Build the Typst `Library` with `sys.inputs.data = <payload-derived JSON string>`
   (`LibraryBuilder::default().with_inputs(...)`), returned by `ResumeWorld::library()`.
   Fallback if `sys.inputs` doesn't work: serve an in-memory `data.json` from `World::file()`
   (currently hard-`NotFound` at `compiler.rs:106-111`) and `json("data.json")` in the template.
2. `render_resume` compiles the embedded, ported `template.typ` instead of `render_template`'s
   generated string. Keep `render_template` behind a feature flag until the new path reaches
   parity, then delete it.
3. Port `~/jarvis/scripts/resume/template.typ` → `typst/templates/resume.typ`; change
   `json(sys.inputs.data)` → `json.decode(sys.inputs.data)`; rename font families
   `"Times New Roman"`→`"Liberation Serif"`, `"Arial"`→`"Liberation Sans"`.
4. The jarvis layout has **no meta-footer, no "About this resume" section, and no dev-mode
   metadata page**. Drop them from the rendered CV (the current `render_template` emits them;
   don't carry them over). The payload's `meta_footer` / `total_*` fields become unused.

Both surfaces call `render_resume`, so this single change lights up the web app *and* the CLI.

---

## Data adapter: `GenerationPayload` → the template contract

The bulk of the work. Extend/replace `prepare_template_data`
(`crates/resume-typst/src/template.rs:140-229`) to emit the flat JSON above. The Resumate data
model (`crates/shared-types/src/lib.rs`) is a 3-level hierarchy **Company → Position → Bullet**;
the selection layer flattens chosen bullets into `GenerationPayload.selected_bullets` before
rendering.

| Template field | Source in Resumate | How to map it |
|---|---|---|
| `name` | `personal.fullName` (fallback `personal.name`) | `fullName` is a drift field (`types/resume.ts`, not the Rust schema). |
| `citizenship` | `personal.citizenship` (array) + `personal.location` | **Currently dropped before Typst** (`template.rs:208-216`). Thread it through `GenerationPayload`/`prepare_template_data`; format to the jarvis string, e.g. `"South African / British - Dual Citizenship • London - Central"`. |
| `links[]` | `personal.website/github/linkedin/email` | Stored as **bare handles** (`"olliegilbey"`, `"ollie.gg"`). Build full URLs and the label set (incl. "Contact Card" → the site). |
| `summary` | `payload.summary` | Pass through. |
| `work[]` | `companies[]` → `positions[]` → `children` (bullets) | One work entry per company. Dates via existing `format_date_range` (`template.rs`). `companyUrl` ← `Company.link`; `descriptor` ← `Company.summary`; `bullets` ← selected `Bullet.description` strings. **Promotions:** flatten multiple `positions` to a single title with a " - (promoted from X)" aside; do not render multiple position rows. |
| `education` | `education[]` (array) | **Merge** the array under one `heading` (institution + a degrees descriptor after " - ") with each degree as a bold-lead bullet, plus `coursework`/`societies`. Ollie's data is one institution — do not loop multiple institution blocks. |
| `additional[]` | `skills{category:[]}` | **Phase 1: emit only the `Technical skills:` leadpara** (format all skills). Leave personal projects in Work (Resumate models them as `Company` entries) and omit interests — both are Phase 4. Keeping Additional a single paragraph under its header avoids the stacked-header trap. |

**Skills curation (later — Phase 4).** Today skills are passed to Typst wholesale; only *bullets*
are role-curated. A tailored resume should select/order skills per role too — extend the
selection layer (`lib/selection.ts`, possibly the AI prompt/schema in
`app/api/resume/ai-select/`) the same way it does bullets. Not needed for the first render.

---

## Lockstep & determinism (the SHA-identity contract)

Both surfaces share `render_resume`, so **layout identity is free**. Byte-identity (SHA) needs:

**1. Deterministic date — MUST FIX.** `World::today()` returns wall-clock UTC
(`compiler.rs:117-120`, `chrono::Utc::now()`), which Typst stamps into the PDF's creation-date
metadata (`document.date` is auto). So today two renders of the same payload are SHA-identical
only **within the same UTC day**. Fix: thread the payload's `metadata.timestamp` into
`ResumeWorld` and return *that* date from `today()`. `metadata` is optional; if absent, use a
**fixed constant date — never wall-clock**.

**2. Identical embedded fonts + options — MUST HOLD.** Fonts are `include_bytes!`-embedded
(`fonts.rs:12-13`) and compiled into *both* binaries, so they match — **as long as the CLI does
NOT switch to system fonts** (real TNR/Arial would break lockstep; use the shared embedded
Liberation set, metric-identical anyway). Keep `dev_mode` consistent and `PdfOptions::default()`
identical (`lib.rs:85`; `ident: Auto` = content-hash `/ID`, no RNG). Build both binaries from the
**same commit** (same Typst version).

**3. wasm32 vs native — MUST VERIFY.** Byte-identity of the PDF across `wasm32` and native isn't
guaranteed by Typst. Settle it empirically with the lockstep test (below), early; if they
diverge, the guarantee falls back to visual/structural identity.

**Enforcement — the lockstep test.** A CI test renders a fixture payload through **both** the
native CLI and the WASM (via node/`wasmtime`) and asserts `sha256(pdf_cli) == sha256(pdf_wasm)`.
Match → hard SHA-identity as an enforced invariant. Mismatch → fall back to visual/structural
identity (same layout/text/positions) and file the byte-diff (likely metadata or rounding) as a
follow-up.

---

## Verification & linter alignment

Three verification layers exist across the two repos. Unifying the pipeline means they must
agree on "what is a valid, well-formed resume," or a resume that passes one surface fails the
other.

**Inventory:**

| Layer | Where | Operates on | Enforces |
|---|---|---|---|
| jarvis `build-resume.mjs` hardening | `~/jarvis/scripts/resume/build-resume.mjs` | resume **markdown** | format drift (unknown sections, role-collapse, stacked Additional headers), title-wrap (≤65 chars), inline-markdown, **>2 pages** (via `pdfinfo`) |
| jarvis `resume-lint.mjs` | `~/jarvis/scripts/resume-lint.mjs` | resume **markdown** | Work-Experience **bullet count 18–22**, **≤45 words/bullet** (Education/Additional excluded) |
| Resumate Rust validation | `crates/resume-wasm/src/lib.rs:73` (`validate_payload_internal`) + `crates/shared-types/src/lib.rs:328,352` (`Company/Position::validate`) + `scripts/validate-compendium.mjs` (schema) | `GenerationPayload` / gist data | **structural** requiredness (required fields, ≥1 position/bullet), schema conformance |

**Concrete misalignments to resolve:**

- **Bullet budget:** Resumate's `SelectionConfig` default is **`maxBullets: 24`**
  (`lib/selection.ts` `DEFAULT_SELECTION_OPTIONS`) — *outside* jarvis's **18–22** band.
- **Word cap:** jarvis caps bullets at **45 words**; Resumate validation does not check length.
- **Page budget:** jarvis enforces **≤2 pages**; Resumate has **no post-render page-count check**,
  and the denser layout changes how many bullets fit, so the budget must be re-derived.
- **Format checks:** jarvis's markdown-format warnings are markdown-specific and become N/A on a
  structured payload — but their *intent* (2-page fit, clean sections) must carry over.

**Design — one source of truth for resume-quality rules:**

- Add the quality band (bullet count, word cap, page budget) to the **shared Rust validation** so
  both surfaces enforce it identically — into `validate_payload_internal` (or a small
  `resume-rules` module in `shared-types`), alongside the structural checks.
- **Export the thresholds** (like the schema — Workstream C §3): emit constants
  (`MIN_BULLETS=18`, `MAX_BULLETS=22`, `MAX_WORDS=45`, `MAX_PAGES=2`) that jarvis reads. Update
  Resumate's `SelectionConfig` default `maxBullets` to ≤22 so selection never produces a resume
  that fails validation.
- **Page budget:** add a post-render page-count assertion (Typst reports the page count; or reuse
  `pdfinfo`) so both surfaces guarantee ≤2 pages. Re-tune the bullet band if the denser layout
  shifts the fit.
- jarvis's `resume-lint.mjs` then imports the shared constants (or is retired for the payload
  path; the markdown authoring path keeps it).

The CLI and web app already share `validate_payload` via `render_resume`'s callers, so aligning
is mostly *adding* these checks to that shared path and pointing jarvis at the exported constants.

---

## Fonts (shared budget)

Fonts must be **identical on both surfaces**, so the WASM size budget governs the shared set.
Current embed: Liberation Serif **Regular + Bold** only (`fonts.rs:12-13`); italics are
faux-synthesized. **Default set to embed:** Liberation Serif Regular / Bold / **Italic** +
Liberation **Sans Bold** (for the "OG" monogram). Guards (`Justfile:15-16`): **raw ≤17 MB, gzip
≤6.5 MB** — the added TTFs (~1–1.5 MB raw) **must stay under the gzip guard; verify after
rebuild**. Also relax the `fonts.len() <= 10` regression guard (`fonts.rs:86-91`) and update the
font loader + `crates/resume-typst/download-fonts.sh` / `Justfile` `wasm-fonts`. If over budget:
drop Serif Italic (accept faux italics), or draw the monogram in serif and drop Liberation Sans.

---

## Workstream C: the headless `resume-cli`

A thin, dumb wrapper — the outbound surface. Independent of the layout work (it renders whatever
`render_resume` produces), but it's the vehicle that makes the outbound path real and the ideal
place to iterate the new layout natively (no WASM rebuild in the loop).

### 1. `crates/resume-cli` (new bin crate)

clap wrapper around `resume_typst::render_resume`.

```
resume-cli [--input <FILE>|-] [--output <FILE>|-] [--dev-mode]

  --input    Path to GenerationPayload JSON. Default: stdin (-).
  --output   Path for PDF bytes. Default: stdout (-).
  --dev-mode Pass-through flag to renderer.

Exit codes: 0 ok · 1 parse error · 2 validation error · 3 render error
```

**Deps:** `clap`, `serde_json`, `shared-types`, `resume-typst`, `anyhow`. ~100 LOC incl. a smoke
test. Added to the root `Cargo.toml` workspace; does not affect the WASM build.

### 2. Make `ScoredBullet.score` optional

`ScoredBullet.score: f64` is required but the renderer never reads it (grouping is by hierarchy,
`template.rs`). Change to `Option<f64>` (or `#[serde(default)]`) in
`crates/shared-types/src/lib.rs`; audit `lib/selection.ts` consumers (score is selection-time
data, used in TS not rendering — contained); `just types-sync` propagates to TS.

### 3. Schema export for `GenerationPayload`

`crates/shared-types/src/bin/generate_schema.rs` today emits only `ResumeData`. Extend it to also
emit `schemas/generation-payload.schema.json`. Jarvis points its payload-builder at this file
(re-fetched on bootstrap to catch drift). Emit the quality-rule constants here too (see
Verification).

### 4. Justfile entries

- `just cli` — release-build, print the binary's absolute path.
- `just cli-example` — run against `crates/resume-cli/tests/fixtures/example-payload.json` →
  `test-outputs/cli-smoke.pdf`. Doubles as smoke test.

### 5. Fixture + test

`crates/resume-cli/tests/fixtures/example-payload.json` (minimal-but-complete payload exercising
all renderer-consumed fields) + `crates/resume-cli/tests/render.rs` (invoke via `assert_cmd`,
verify exit 0, non-empty stdout, `%PDF-` magic bytes).

### The `GenerationPayload` (the jarvis→renderer boundary)

This is the payload jarvis produces — the stable inter-repo contract, and the *input* to the
adapter above (not the template's flat data). The renderer consumes:
`personal.{name,email,phone,location,linkedin,github,website}` (+ `fullName`, `citizenship` once
threaded), `selected_bullets[]` (already edited + ordered; hierarchy via inline
`companyName`/`positionTitle`/dates), `role_profile.{name,description}` (display only), optional
`summary`, `education[]`, `skills`, `metadata`. **The payload IS the resume in data form** —
jarvis has full editorial freedom over bullet text and summary; the compendium is the source of
facts, jarvis is the editor.

---

## Gotchas catalogue (quick reference)

- The `.typ` file is dead; layout is Rust string-concat (`lib.rs:97-505`); `_template` is unused.
- `World::file()` returns `NotFound` (`compiler.rs:106-111`) — Route B needs `sys.inputs` (or a
  patched `file()`).
- PDF date = wall-clock (`compiler.rs:117-120`) → non-deterministic across days; pin from payload.
- Fonts embedded, Serif R+B only, no italic; `fonts.len() <= 10` guard (`fonts.rs:86-91`).
- WASM guards: raw ≤17 MB, gzip ≤6.5 MB (`Justfile:15-16`); pre-commit rebuilds WASM on crate
  changes (`scripts/check-wasm.sh --fresh`); the 16 MB `public/wasm/*` is committed.
- `citizenship`, `interests`, `accomplishments` exist in real gist data but are **drift fields**
  (`types/resume.ts:34-47`) that never reach the Typst payload today.
- Output is **PDF only** — no SVG, no preview; download-only
  (`components/data/resume-download/pipeline.ts:262-283`).
- Selection/scoring is TypeScript-only (`lib/selection.ts`); the renderer stays dumb.
- `SelectionConfig maxBullets: 24` exceeds jarvis's 18–22 lint band; Resumate validates structure
  only (no word-cap / page-count check).
- The current `render_template` emits a meta-footer + a dev-mode metadata page; the jarvis layout
  has neither — drop them.
- Stale doc: `docs/CODEBASE_REVIEW.md:514` mis-marks the dead-template issue as RESOLVED —
  un-resolve it when convenient.

---

## Decisions locked for the build (don't re-litigate)

- **Route B** (real `.typ` + `sys.inputs`), layout in the shared `resume-typst` crate.
- **Promotions** → single title + " - (promoted from X)" aside.
- **Education** → merge to one institution heading; degrees as bold-lead bullets.
- **Phase 1 `additional`** = the `Technical skills:` paragraph only; projects stay in Work,
  interests deferred (both Phase 4).
- **Fonts** → embedded Liberation only (never system fonts), same set on both surfaces.
- **Deterministic date** from `metadata.timestamp`, fixed-constant fallback (never wall-clock).
- **Meta-footer / dev-mode metadata page** → dropped from the rendered CV.

## Flagged for review (non-blocking — proceed with the default; raise when grilling)

- **SHA-identity vs visual-identity** — resolved by the lockstep-test outcome; build the test and
  proceed with SHA as the target.
- **Exact Liberation face set** within the 6.5 MB gzip guard — default: Serif Regular/Bold/Italic
  + Sans Bold; trim per the Fonts section if over budget.
- **Final bullet band / page budget** for the denser layout — default 18–22 bullets, ≤2 pages;
  re-tune after the first real render.

---

## Phased implementation plan

- **Phase 0 — local proof (no Resumate code, ~1–2 h).** Adapter mapping Resumate's real
  `data/resume-data.json` (or a `GenerationPayload`) → the jarvis `data.json` shape, rendered via
  `~/jarvis/scripts/resume/build-resume.mjs`. Confirms design + mapping before any Rust/WASM work.
- **Phase 1 — shared-crate layout (the core).** Route B in `resume-typst`: port `template.typ`
  (fonts renamed), wire `sys.inputs`, write the `prepare_template_data` adapter, add the fonts,
  pin the deterministic date, drop the meta-footer/dev page. Add the shared quality checks
  (bullet band, word cap, page budget) to `validate_payload` and export the thresholds. Both
  surfaces now render the new layout and enforce the same bar.
- **Phase 2 — CLI wrapper.** `ScoredBullet.score` optional → schema export → `crates/resume-cli`
  → fixture + smoke test → Justfile. (~2.5 h.)
- **Phase 3 — WASM rebuild + lockstep test.** `just wasm` (watch the gzip guard); CI test
  asserting `sha256` equality of CLI vs WASM output on a fixture. Settles wasm-vs-native.
- **Phase 4 — polish.** Role-curated skills, projects + interests threading, the jarvis-side
  `build-resume` skill (compendium + Airtable role context → LLM bullet edit → payload → CLI →
  PDF stored beside the application md).

## Sizing (Resumate side)

- Route B wiring (`sys.inputs`, compile the `.typ`, flag/retire `render_template`): ~1–2 h
- `prepare_template_data` adapter (citizenship/links/education/additional): ~half day
- Fonts (faces, loader, guard, `download-fonts.sh`) + WASM rebuild + size check: ~1–2 h
- Deterministic date fix: ~30 min
- Quality checks + threshold export + `SelectionConfig` update: ~1 h
- CLI crate + `ScoredBullet.score` optional + schema export + fixture/test + Justfile: ~2.5 h
- Lockstep CI test (both surfaces, sha256): ~1–2 h

Jarvis-side `build-resume` skill is a separate effort with its own spec.

## Implementation order

1. **Phase 0** local proof (jarvis-only) — de-risk design + mapping.
2. `ScoredBullet.score` optional in `shared-types`; `just types-sync`; audit consumers; tests green.
3. Extend `generate_schema.rs` to emit `generation-payload.schema.json` + the quality constants.
4. Route B in `resume-typst`: `sys.inputs` + ported `template.typ` + the adapter + deterministic
   date + drop meta-footer/dev page. Keep `render_template` behind a flag until parity.
5. Fonts: add faces, update loader + guard + `download-fonts.sh`; rebuild WASM; verify gzip guard.
6. Quality checks in `validate_payload`; update `SelectionConfig maxBullets`.
7. Scaffold `crates/resume-cli`; implement; fixture + integration test; `just cli` / `just cli-example`.
8. Lockstep CI test: render fixture via CLI + WASM, assert `sha256` equal (or record the diff).
9. `crates/resume-cli/README.md`; PRs. Suggested commits: `feat(typst): adopt hand-crafted CV
   layout via real .typ template` and `feat(cli): headless resume-cli for outbound automation`.
