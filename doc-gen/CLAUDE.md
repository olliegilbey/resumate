# Rust/WASM Document Generation Context

**You're reading this because you're working with:**
- Files in `doc-gen/`
- Rust code (types, scoring, selection, PDF, DOCX, WASM)
- Cargo workspace

**Shared project context already loaded via root CLAUDE.md:**
- Architecture, workflows, status, todos, deployment

**This file contains Rust/WASM-specific patterns and conventions.**

---

## Cargo Workspace Structure

```
doc-gen/
├── Cargo.toml                # Workspace config
├── crates/
│   ├── core/                 # Core types & algorithms (UNCHANGED)
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs        # Module exports
│   │   │   ├── types.rs      # Data structures (source of truth)
│   │   │   ├── scoring.rs    # Hierarchical bullet scoring
│   │   │   ├── selector.rs   # Bullet selection algorithm
│   │   │   └── bin/
│   │   │       └── schema_emitter.rs  # JSON Schema generator
│   │   └── tests/
│   │       └── integration_test.rs    # Real data tests
│   │
│   ├── typst/                # Typst PDF generation (NEW - replaces pdf/docx)
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs        # Public API
│   │   │   ├── compiler.rs   # Typst compiler wrapper (World implementation)
│   │   │   ├── template.rs   # Template data preparation & rendering
│   │   │   └── fonts.rs      # Embedded font management
│   │   ├── templates/
│   │   │   └── resume.typ    # Main Typst resume template
│   │   └── fonts/
│   │       └── *.ttf         # Embedded fonts (Linux Libertine, etc.)
│   │
│   └── wasm/                 # WASM bindings (UPDATED for Typst)
│       ├── Cargo.toml
│       ├── build.rs          # Build-time git hash/timestamp
│       └── src/
│           └── lib.rs        # wasm_bindgen exports (generate_pdf_typst)
│
├── examples/
│   └── reconstruct.rs        # CLI reconstruction tool
│
└── fixtures/
    └── sample_resume.json    # Test data
```

**Note:** The `pdf/` and `docx/` crates have been removed and replaced with the `typst/` crate which uses the Typst typesetting system for professional PDF generation. See `docs/TYPST_MIGRATION.md` for details.

---

## Core Modules

### types.rs - Source of Truth
All Rust types use schemars for JSON Schema generation:

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

1. **Rust Types** (doc-gen/crates/core/src/types.rs)
   - Define with `#[derive(JsonSchema)]`
   - Add schemars annotations

2. **Schema Generation**
   ```bash
   npm run schemas:emit  # Runs cargo run --bin schema_emitter
   ```
   - Outputs to `schemas/compendium.schema.json`

3. **TypeScript Generation**
   ```bash
   npm run types:gen     # Runs tsx scripts/gen-ts-from-schemas.ts
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

## Testing Philosophy

### TDD (Test-Driven Development)
1. Write tests first
2. Implement to make tests pass
3. Refactor while keeping tests green

### Test Types

**Unit Tests** (in module files):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tag_relevance_perfect_match() {
        let tags = vec!["engineering".to_string()];
        let mut weights = HashMap::new();
        weights.insert("engineering".to_string(), 1.0);

        let score = calculate_tag_relevance(&tags, &weights);
        assert_eq!(score, 1.0);
    }
}
```

**Integration Tests** (tests/ directory):
```rust
// tests/integration_test.rs
#[test]
fn test_all_role_profiles_produce_valid_selections() {
    let resume = load_resume_data();  // Real data!

    for role_profile in &resume.role_profiles {
        let selected = select_bullets(&resume, role_profile, &config);
        assert!(selected.len() <= config.max_bullets);
        // ... more assertions
    }
}
```

**Property-Based Tests** (with proptest):
```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_scoring_is_deterministic(
        priority in 1u8..=10,
        tags in prop::collection::vec(any::<String>(), 0..5)
    ) {
        // Test with random valid inputs
        let score1 = score_bullet(...);
        let score2 = score_bullet(...);
        assert_eq!(score1, score2);
    }
}
```

---

## Common Commands

### Testing
```bash
cargo test --all                    # Run all tests
cargo test -p docgen-core           # Test core only
cargo test --test integration_test  # Integration tests only
cargo test -- --nocapture          # Show println! output
```

### Building
```bash
cargo build                         # Debug build
cargo build --release               # Release build
cargo build --target wasm32-unknown-unknown  # WASM target
./build-wasm.sh                     # WASM build script
```

### Schema Generation
```bash
cargo run --bin schema_emitter      # Generate JSON Schema
npm run schemas:emit                # Same, via npm
```

### Type Checking
```bash
cargo check                         # Fast type check
cargo clippy                        # Linter
cargo fmt                           # Format code
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

**Note:** DOCX generation has been removed. Only PDF generation via Typst is supported.

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

**Note:** DOCX generation has been removed in favor of focusing on high-quality PDF output via Typst. Users can convert PDF to DOCX if needed.

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
1. Run `npm run schemas:emit` to regenerate JSON Schema
2. Run `npm run types:gen` to regenerate TypeScript types
3. Run `npm run validate:template` to validate template
4. Commit both Rust changes AND generated schema/types

**For hybrid work (Rust + Next.js):**
- Also read `app/CLAUDE.md` for Next.js context
- Follow type sync workflow carefully
- Test both Rust (cargo test) and Next.js (npm run typecheck)

**Common tasks:**
- Adding new type → Update types.rs, regenerate schema + TS
- Changing scoring → Update scoring.rs, add tests
- New selection feature → Update selector.rs, add tests
- WASM exports → Update wasm/src/lib.rs, rebuild WASM
