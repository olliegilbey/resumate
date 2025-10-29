# Rust/WASM Document Generation Context

**You're reading this because you're working with:**
- Files in `doc-gen/`
- Rust code (types, scoring, selection, PDF generation via Typst, WASM)
- Cargo workspace

**Core Documentation (Read First):**
- **[../.claude/CLAUDE.md](../.claude/CLAUDE.md)** - Project router, first principles, critical paths
- **[../docs/CURRENT_PHASE.md](../docs/CURRENT_PHASE.md)** - Active phase, current status
- **[../docs/TESTING_STRATEGY.md](../docs/TESTING_STRATEGY.md)** - Testing philosophy
- **[../docs/METRICS.md](../docs/METRICS.md)** - Test counts, coverage (auto-generated)
- **[../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)** - WASM pipeline architecture

**This file contains Rust/WASM-specific patterns and conventions.**

---

## Cargo Workspace Structure

See root `.claude/CLAUDE.md` for complete project structure.

**Key crates:**
- `doc-gen/crates/core/` - Types, scoring, selection algorithms
- `doc-gen/crates/typst/` - Typst PDF generation (replaced old pdf/docx crates)
- `doc-gen/crates/wasm/` - WASM bindings (wasm-bindgen exports)

---

## Core Modules

### Type System Architecture

**IMPORTANT:** There is NO `types.rs` in `doc-gen/crates/core/src/`

**Pattern:** Re-export shared-types crate:
```rust
// doc-gen/crates/core/src/lib.rs
pub use shared_types::*;  // All types from canonical source
```

**Canonical source:** `crates/shared-types/src/lib.rs` (project root)

**Type Flow:**
```
crates/shared-types/src/lib.rs (edit here ONLY)
  ↓ pub use in doc-gen/crates/core/src/lib.rs (re-export)
  ↓ just types-schema (generate JSON Schema)
  ↓ just types-ts (generate TypeScript)
```

**Shared Types Use Schemars for JSON Schema Generation:**
```rust
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(description = "...")]
pub struct BulletPoint {
    pub id: String,
    #[schemars(description = "Exact written bullet text")]
    pub text: String,
    pub tags: Vec<Tag>,
    #[schemars(range(min = 1, max = 10))]
    pub priority: u8,
    // ...
}
```

**Important Patterns:**
- `#[serde(rename_all = "camelCase")]` - JSON uses camelCase
- `#[schemars(description = "...")]` - Documentation for schema
- `#[schemars(range(min = X, max = Y))]` - Validation constraints
- `#[serde(skip_serializing_if = "Option::is_none")]` - Omit null fields

### scoring.rs - Hierarchical Scoring
Implements Company × Position × Bullet multiplicative scoring:

```rust
pub fn score_bullet(
    bullet: &BulletPoint,
    position: &Position,
    company: &Company,
    role_profile: &RoleProfile,
) -> f32 {
    let weights = &role_profile.scoring_weights;

    // Base score: tag relevance + priority
    let tag_score = calculate_tag_relevance(&bullet.tags, &role_profile.tag_weights);
    let priority_score = bullet.priority as f32 / 10.0;
    let base_score = (tag_score * weights.tag_relevance) + (priority_score * weights.priority);

    // Hierarchical multipliers
    let company_multiplier = calculate_company_multiplier(company);  // 0.8-1.2
    let position_multiplier = calculate_position_multiplier(position, &role_profile.tag_weights);

    base_score * company_multiplier * position_multiplier
}
```

**Key Functions:**
- `calculate_tag_relevance()` - Average weight of matched tags
- `calculate_company_multiplier()` - Maps priority 1-10 to 0.8-1.2
- `calculate_position_multiplier()` - Priority + tag relevance combo

### selector.rs - Bullet Selection
Implements diversity-constrained selection:

```rust
pub struct SelectionConfig {
    pub max_bullets: usize,           // Default: 18
    pub max_per_company: Option<usize>, // Default: Some(6)
    pub max_per_position: Option<usize>, // Default: Some(4)
}

pub fn select_bullets(
    resume_data: &ResumeData,
    role_profile: &RoleProfile,
    config: &SelectionConfig,
) -> Vec<ScoredBullet> {
    // 1. Score all bullets (including position descriptions)
    // 2. Sort by score descending
    // 3. Apply diversity constraints
}
```

**Diversity Constraints:**
- Prevents all bullets from same company/position
- Ensures balanced representation across experience
- Greedy selection (best-first with limits)

---

## Type Synchronization Flow

### Rust → JSON Schema → TypeScript

1. **Rust Types** (crates/shared-types/src/lib.rs)
   - Define with `#[derive(JsonSchema)]`
   - Add schemars annotations

2. **Schema Generation**
   ```bash
   just types-schema  # Runs cargo run --bin generate_schema
   ```
   - Outputs to `schemas/resume.schema.json`

3. **TypeScript Generation**
   ```bash
   just types-ts     # Runs tsx scripts/gen-ts-from-schemas.ts
   ```
   - Outputs to `lib/types/generated-resume.ts`

4. **Re-export for App**
   - `types/resume.ts` re-exports from generated file
   - App always imports from `types/resume.ts`

### Validation Strategy
- **Build/CI Only:** Strict validation with ajv
- **NOT Runtime Client-Side:** Too heavy for browser
- **Server-Side:** Validates on gist pull/push

---

## Testing

**Philosophy:** See [../docs/TESTING_STRATEGY.md](../docs/TESTING_STRATEGY.md)

**Test Types:**
- Unit: `#[cfg(test)] mod tests` in module files
- Integration: `tests/` directory
- Property-based: `proptest!` macro

---

## Common Commands

```bash
# Use just commands (defined in root justfile)
just test-rust         # All Rust tests
just wasm              # Build WASM
just types-schema      # Generate JSON Schema
just check             # Type check (cargo check)

# Direct cargo (when debugging specific issues)
cargo test -p docgen-core           # Test specific crate
cargo test -- --nocapture           # Show println! output
cargo clippy                        # Linter
cargo fmt                           # Format
```

---

## WASM Integration

### wasm-bindgen Exports
```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn generate_pdf_typst(
    payload_json: &str,
    dev_mode: bool,
) -> Result<Vec<u8>, JsValue> {
    // 1. Deserialize JSON
    // 2. Generate PDF with Typst
    // 3. Return bytes
}
```

### Build Process
```bash
#!/bin/bash
# build-wasm.sh
cd doc-gen
wasm-pack build --target web --out-dir pkg crates/wasm
cp pkg/* ../public/wasm/
```

### JS Bridge (bridge.rs)
```rust
pub fn parse_generation_payload(json: &str) -> Result<GenerationPayload, Error> {
    serde_json::from_str(json).map_err(Error::from)
}

pub fn serialize_pdf(bytes: Vec<u8>) -> js_sys::Uint8Array {
    js_sys::Uint8Array::from(&bytes[..])
}
```

---

## PDF Generation Architecture (Typst)

### Why Typst?
- **Automatic Layout:** No manual Y-coordinate calculations or page breaks
- **Professional Typography:** Built-in font selection, spacing, and layout
- **Template-Based:** Easy to iterate on design via .typ files
- **Rust-Native:** Perfect integration with our existing codebase
- **WASM-Friendly:** Compiles to ~2-5MB (cached after first load)

### Design Goals
- ATS-optimized (parseable structure, proper spacing)
- Professional typography and layout
- Multi-page support with automatic text flow
- Template-driven design (easier to maintain)
- Sub-1s generation time

### Implementation (Typst)
```rust
use docgen_typst::render_resume;

pub fn generate_pdf(payload: &GenerationPayload, dev_mode: bool) -> Result<Vec<u8>, TypstError> {
    // 1. Prepare data for template injection
    let template_data = prepare_template_data(payload);

    // 2. Load Typst template
    let template_source = include_str!("../templates/resume.typ");

    // 3. Inject data into template
    let rendered_template = inject_template_data(template_source, &template_data)?;

    // 4. Compile Typst → PDF
    let world = ResumeWorld::new(rendered_template)?;
    let document = typst::compile(&world)?;
    let pdf_bytes = typst_pdf::pdf(&document, Smart::Auto, None)?;

    Ok(pdf_bytes)
}
```

### Template Structure (resume.typ)
```typst
#set document(title: [Resume - #personal.name])
#set page(paper: "us-letter", margin: 0.75in)
#set text(font: "Linux Libertine", size: 10pt)

// Header (name, contact)
#align(center)[
  #text(size: 18pt, weight: "bold")[#personal.name]
  #text(size: 9pt)[#personal.email • #personal.phone]
]

// Experience section
#for company in companies [
  #text(weight: "bold")[#company.name]
  #for position in company.positions [
    #text(style: "italic")[#position.title]
    #for bullet in position.bullets [
      - #bullet.description
    ]
  ]
]
```

### Key Features
- **Automatic pagination:** Typst handles page breaks intelligently
- **Font embedding:** Linux Libertine fonts embedded in WASM
- **Dev mode:** Optional metadata page with build info (localhost only)
- **ATS-friendly:** Plain text bullets, clear hierarchy

---

## Error Handling

### Rust Errors (Typst)
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TypstError {
    #[error("Template rendering failed: {0}")]
    TemplateError(String),

    #[error("Typst compilation failed: {0}")]
    CompilationError(String),

    #[error("PDF export failed: {0}")]
    ExportError(String),

    #[error("Font loading failed: {0}")]
    FontError(String),
}
```

### WASM Errors
```rust
impl From<TypstError> for JsValue {
    fn from(err: TypstError) -> Self {
        JsValue::from_str(&err.to_string())
    }
}
```

---

## Validation Patterns

### ScoringWeights Validation
```rust
impl ScoringWeights {
    // Strict (for tests/dev)
    pub fn validate_sum(&self) -> Result<(), String> {
        let sum = self.tag_relevance + self.priority;
        if (sum - 1.0).abs() < 0.001 {
            Ok(())
        } else {
            Err(format!("Weights must sum to 1.0, got {:.3}", sum))
        }
    }

    // Soft (for production)
    pub fn normalize(&self) -> (ScoringWeights, Option<String>) {
        let sum = self.tag_relevance + self.priority;
        if (sum - 1.0).abs() < 0.001 {
            return (self.clone(), None);
        }

        let normalized = ScoringWeights {
            tag_relevance: self.tag_relevance / sum,
            priority: self.priority / sum,
        };

        (normalized, Some(format!("⚠️  Normalized from {:.3}", sum)))
    }
}
```

---

## Notes for AI Assistants

**Before making Rust changes:**
1. Run `cargo test --all` to ensure tests pass
2. Run `cargo clippy` for lint warnings
3. Run `cargo fmt` to format code

**After changing types.rs:**
1. Run `just types-schema` to regenerate JSON Schema
2. Run `just types-ts` to regenerate TypeScript types
3. Run `just data-validate-template` to validate template
4. Commit both Rust changes AND generated schema/types

**For hybrid work (Rust + Next.js):**
- Also read `app/CLAUDE.md` for Next.js context
- Follow type sync workflow carefully
- Test both Rust (cargo test) and Next.js (just check-ts)

**Common tasks:**
- Adding new type → Update types.rs, regenerate schema + TS
- Changing scoring → Update scoring.rs, add tests
- New selection feature → Update selector.rs, add tests
- WASM exports → Update wasm/src/lib.rs, rebuild WASM
