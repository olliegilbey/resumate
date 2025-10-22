# Naming Conventions

## Overview

Resumate uses a **Rust-first schema approach** where types are defined once in Rust and automatically generate both JSON Schema and TypeScript types. This ensures type safety across the entire stack while maintaining readability.

## Type Generation Flow

```
Rust Types (source of truth)
    ↓
JSON Schema (via schemars)
    ↓
TypeScript Types (via json-schema-to-typescript)
```

## Naming Styles by Language

### TypeScript & JSON

-   **Style**: `camelCase`
-   **Examples**:
    -   `companyTags`
    -   `companyPriority`
    -   `scoringWeights`
    -   `tagRelevance`

### Rust

-   **Style**: `snake_case`
-   **Examples**:
    -   `company_tags`
    -   `company_priority`
    -   `scoring_weights`
    -   `tag_relevance`

### Automatic Conversion

Rust types use `#[serde(rename_all = "camelCase")]` to automatically serialize to camelCase JSON:

```rust
#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Company {
    pub company_tags: Option<Vec<Tag>>,  // Rust: snake_case
    pub company_priority: Option<u8>,
}
```

```json
{
    "companyTags": ["blockchain"],
    "companyPriority": 8
}
```

## Field Naming Patterns

### Hierarchy Fields

New fields added for hierarchical scoring algorithm:

-   **Company-level**:
    -   `companyTags: string[]` - Company-level tags (e.g., ["blockchain", "startup"])
    -   `companyPriority: number (1-10)` - Company prestige/relevance
-   **Position-level**: (Existing)
    -   `descriptionTags`, `descriptionPriority`, etc.
-   **Bullet-level**: (Existing)
    -   `tags`, `priority`, etc.

### Scoring Weights

```typescript
interface ScoringWeights {
    tagRelevance: number // 0.0-1.0, typically 0.6 (60%)
    priority: number // 0.0-1.0, typically 0.4 (40%)
    // Must sum to 1.0 (validated in Rust)
}
```

## ID Field Conventions

-   **Format**: Kebab-case, descriptive
-   **Examples**:
    -   `"interchain-foundation"`
    -   `"developer-relations-lead"`
    -   `"icf-001"`, `"icf-002"` (sequential within company)

## Optional vs Required

### Optional Fields (Rust `Option<T>`)

```rust
#[serde(skip_serializing_if = "Option::is_none")]
pub company_tags: Option<Vec<Tag>>
```

-   Omitted from JSON when `null`
-   Used for new hierarchy fields to maintain backward compatibility

### Required Fields

```rust
pub scoring_weights: ScoringWeights
```

-   Must be present in all new `roleProfiles`

## Validation Strategy

### Build-time Validation

-   **Pre-commit hooks**: Validate JSON against schema before commit
-   **CI/GitHub Actions**: Block builds if gist data is malformed
-   **Gist push**: Validate before uploading to prevent bad data

### Runtime Validation

-   **Rust**: Normalize `ScoringWeights` if sum ≠ 1.0 (with warning)
-   **Rust**: Validate ranges (priority 1-10, weights 0.0-1.0)

### Validation Points

1. **Pre-commit**: `lint-staged` runs `validate-compendium.mjs` on `data/*.json`
2. **Gist push**: `scripts/gist-push.js` validates before upload
3. **Gist pull**: `scripts/fetch-gist-data.js` validates after download
4. **Build**: `prebuild` script fetches and validates

## Schema Maintenance Workflow

### 1. Edit Rust Types

```bash
# Edit doc-gen/crates/core/src/types.rs
```

### 2. Regenerate Schema & Types

```bash
just types-schema  # Generate JSON Schema from Rust
just types-ts     # Generate TypeScript from JSON Schema
```

### 3. Update Data (if schema changed)

```bash
# Add new fields to data/resume-data.json
just data-validate data/resume-data.json
```

### 4. Check for Drift

```bash
just types-drift  # Ensures schemas/types are in sync with Rust
```

### 5. Commit

Pre-commit hooks automatically:

-   Re-emit schemas if `types.rs` changed
-   Validate all JSON data files
-   Format Rust code (`cargo fmt`, `cargo clippy`)

## Examples

### Adding a New Field

**Step 1**: Add to Rust types

```rust
#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Company {
    // Existing fields...

    /// Industry classification tags
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Industry tags (e.g., ['fintech', 'b2b'])")]
    pub industry_tags: Option<Vec<String>>,
}
```

**Step 2**: Regenerate

```bash
just types-schema && just types-ts
```

**Step 3**: Update Data

```json
{
    "companies": [
        {
            "id": "example-corp",
            "name": "Example Corp",
            "industryTags": ["fintech", "b2b"]
        }
    ]
}
```

### Renaming a Field

**⚠️ Breaking Change** - Requires data migration

1. Update Rust type name
2. Regenerate schemas
3. Update **all** JSON data files
4. Update **all** TypeScript code references
5. Document in migration notes

## Common Pitfalls

### ❌ Don't manually edit generated files

-   `schemas/compendium.schema.json` - Generated from Rust
-   `lib/types/generated-resume.ts` - Generated from schema

### ❌ Don't mix naming styles

```typescript
// Bad
{ "company_tags": [...] }

// Good
{ "companyTags": [...] }
```

### ❌ Don't forget to validate after changes

```bash
just data-validate data/resume-data.json
just data-validate-template
```

### ✅ Do use descriptive field names

```rust
// Good
pub company_priority: Option<u8>

// Bad
pub co_pri: Option<u8>
```

## Tools Reference

-   **Schema emitter**: `cargo run --bin schema_emitter`
-   **Type generator**: `tsx scripts/gen-ts-from-schemas.ts`
-   **Validator**: `node scripts/validate-compendium.mjs <file>`
-   **Drift checker**: `just types-drift`

## Migration from Old Approach

Previously used template-as-schema with manual TypeScript types. New approach:

| Before                           | After                            |
| -------------------------------- | -------------------------------- |
| TypeScript types (hand-written)  | Rust types (source of truth)     |
| Template for inference           | JSON Schema (generated)          |
| No runtime validation            | ajv validation at all boundaries |
| Manual sync TS ↔ Rust            | Automatic codegen                |
| Optional fields must be in JSON  | Optional fields omitted when nil |
| Basic JSON.parse() error         | Rich schema validation errors    |

## Questions?

-   **"Why not TypeScript as source of truth?"**
    -   Rust provides stronger type safety (u8 for 1-10 ranges, HashMap for tag weights)
    -   Rust validation logic (ScoringWeights.normalize()) closer to business logic
    -   Demonstrates systems programming skills (meta-resume principle)
-   **"Why not JSON Schema as source of truth?"**
    -   Rust is more expressive (methods, trait impls, compile-time checks)
    -   schemars generates excellent schemas from Rust automatically
    -   Single source of truth in language closest to domain logic

---

**Last Updated**: 2025-10-07
**Schema Version**: 1.0.0 (compendium.schema.json)
