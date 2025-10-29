---
last_updated: 2025-10-22
category: Data Schema & Type System
update_frequency: Never (only when schema architecture changes)
retention_policy: All versions preserved in git
---

# Data Schema & Type System

## Overview

Resumate uses **Rust types as the single source of truth**, automatically generating both JSON Schema and TypeScript types. This ensures type safety across the entire stack while maintaining readability and validation.

---

## Type Generation Flow

```
Rust Types (source of truth)
    ↓ cargo run --bin generate_schema
JSON Schema (validation)
    ↓ just types-ts
TypeScript Types (frontend)
```

**Implementation:**
```
crates/shared-types/src/lib.rs (Rust with schemars)
  ↓ cargo run --bin generate_schema
schemas/resume.schema.json
  ↓ just types-ts
lib/types/generated-resume.ts
  ↓ re-exported by
types/resume.ts ← ALWAYS IMPORT FROM HERE
```

**Why this approach:**
- ✅ Single source of truth (Rust types)
- ✅ Type safety across Rust and TypeScript
- ✅ Runtime validation via JSON Schema
- ✅ Automatic type synchronization
- ✅ Schema documentation in Rust code

---

## Naming Conventions

### By Language

**TypeScript & JSON:**
- Style: `camelCase`
- Examples: `companyTags`, `companyPriority`, `scoringWeights`, `tagRelevance`

**Rust:**
- Style: `snake_case`
- Examples: `company_tags`, `company_priority`, `scoring_weights`, `tag_relevance`

### Automatic Conversion

Rust types use `#[serde(rename_all = "camelCase")]` to automatically serialize to camelCase JSON:

```rust
#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Company {
    pub company_tags: Option<Vec<Tag>>,  // Rust: snake_case
    pub company_priority: Option<u8>,    // → JSON: camelCase
}
```

```json
{
    "companyTags": ["blockchain"],
    "companyPriority": 8
}
```

### Field Naming Patterns

**Hierarchy Fields:**
- **Company-level**: `companyTags: string[]`, `companyPriority: number (1-10)`
- **Position-level**: `descriptionTags`, `descriptionPriority`
- **Bullet-level**: `tags`, `priority`

**Scoring Weights:**
```typescript
interface ScoringWeights {
    tagRelevance: number // 0.0-1.0, typically 0.6 (60%)
    priority: number     // 0.0-1.0, typically 0.4 (40%)
    // Must sum to 1.0 (validated in Rust)
}
```

**ID Field Conventions:**
- Format: Kebab-case, descriptive
- Examples: `"interchain-foundation"`, `"developer-relations-lead"`, `"icf-001"`

---

## Hierarchical Resume Schema

### Data Structure

The resume data follows a strict 3-level hierarchy:
- **Company** (top level) - Organizations where you worked
- **Position** (middle level) - Specific roles/titles at each company
- **Bullet** (leaf level) - Individual achievements/responsibilities

Each level uses the generic `children` field to contain the next level, creating a consistent tree structure.

### Complete Resume Data Example

```json
{
  "personal": {
    "name": "Oliver Gilbey",
    "nickname": "Ollie",
    "email": "email@example.com",
    "phone": "+1234567890",
    "location": "London - Central",
    "linkedin": "olivergilbey",
    "github": "olliegilbey",
    "website": "https://ollie.gg",
    "twitter": "olliegilbey",
    "tagline": "Motto or tagline"
  },
  "summary": "Professional summary...",

  "experience": [
    {
      "id": "company-id",
      "name": "Company Name",
      "dateStart": "2022-01",
      "dateEnd": null,
      "location": "Remote",
      "description": "Industry context or company description",
      "priority": 10,
      "tags": ["blockchain", "devtools"],
      "children": [
        {
          "id": "position-id",
          "name": "Senior Engineer",
          "dateStart": "2022-01",
          "dateEnd": null,
          "description": "Primary role description",
          "priority": 9,
          "tags": ["engineering", "leadership"],
          "children": [
            {
              "id": "bullet-id",
              "description": "Led infrastructure migration, reducing deployment time by 50%",
              "tags": ["infrastructure", "performance"],
              "priority": 10,
              "summary": "Additional context or impact details",
              "link": "https://example.com"
            }
          ]
        }
      ]
    }
  ],

  "skills": {
    "technical": ["Rust", "TypeScript", "Python"],
    "soft": ["Leadership", "Communication"]
  },

  "education": [
    {
      "id": "edu-id",
      "institution": "University Name",
      "field": "Computer Science",
      "degree": "Bachelor of Science",
      "dateStart": "2016",
      "dateEnd": "2020",
      "gpa": "3.8",
      "honors": ["Summa Cum Laude"]
    }
  ],

  "roleProfiles": [
    {
      "id": "product-manager",
      "name": "Product Manager",
      "description": "Strategic product leadership with data-driven decision making",
      "tagWeights": {
        "product-management": 1.0,
        "data-driven": 0.9,
        "strategic-planning": 0.8
      },
      "scoringWeights": {
        "tagRelevance": 0.6,
        "priority": 0.4
      }
    }
  ]
}
```

---

## Field Details

### Personal Info
- **name** (required): Display name
- **email**, **phone**, **location** (optional): Contact information
- **linkedin**, **github**, **website**, **twitter** (optional): URLs or handles
- **nickname**, **tagline** (optional): Additional personal branding

### Experience Hierarchy

#### Company (Top Level)
- **id** (required): Unique identifier
- **name** (optional): Company name
- **dateStart** (required): Start date (YYYY or YYYY-MM format)
- **dateEnd** (optional): End date or null for current
- **location** (optional): Office location
- **description** (optional): Company context or industry
- **priority** (required): Company importance (1-10, higher = more prestigious)
- **tags** (required): Category tags for hierarchical scoring
- **children** (required): Array of Position objects

#### Position (Middle Level)
- **id** (required): Unique identifier
- **name** (required): Job title or role name
- **dateStart** (required): Start date (YYYY or YYYY-MM format)
- **dateEnd** (optional): End date or null for current
- **description** (optional): Role description (can be scored as a bullet)
- **priority** (required): Position importance (1-10, higher = more senior/relevant)
- **tags** (required): Category tags for hierarchical scoring
- **children** (required): Array of Bullet objects

#### Bullet (Leaf Level)
- **id** (required): Unique identifier
- **description** (required): The actual bullet text that appears on resume
- **priority** (required): Bullet importance (1-10, higher = more impressive/relevant)
- **tags** (required): Category tags for filtering and scoring
- **summary** (optional): Additional context or impact details
- **link** (optional): URL to work, recording, demo, or additional context

### Role Profiles
- **id** (required): Unique identifier (e.g., "product-manager")
- **name** (required): Display name
- **description** (optional): Description of role type
- **tagWeights** (required): Map of tag names to relevance weights (0.0-1.0)
- **scoringWeights** (required): Weights for scoring algorithm components
  - **tagRelevance**: Weight for tag matching (0.0-1.0)
  - **priority**: Weight for manual priority (0.0-1.0)
  - **Must sum to approximately 1.0**

### Skills
- Object with category keys mapping to string arrays
- Common categories: `technical`, `soft`, `languages`, `tools`

### Education
- **id** (required): Unique identifier
- **institution** (required): University/school name
- **dateStart** (required): Start date (YYYY format)
- **dateEnd** (optional): End date or null for in-progress
- **field** (optional): Field of study
- **degree** (optional): Degree name
- **gpa** (optional): GPA if relevant
- **honors** (optional): Array of honors and awards

---

## Schema Maintenance Workflow

### 1. Edit Rust Types

```bash
# Edit crates/shared-types/src/lib.rs
nvim crates/shared-types/src/lib.rs
```

### 2. Regenerate Schema & Types

```bash
just types-schema  # Generate JSON Schema from Rust
just types-ts      # Generate TypeScript from JSON Schema
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
- Re-emit schemas if Rust types changed
- Validate all JSON data files
- Format Rust code (`cargo fmt`, `cargo clippy`)

---

## Validation Strategy

### Build-time Validation
- **Pre-commit hooks**: Validate JSON against schema before commit
- **CI/GitHub Actions**: Block builds if gist data is malformed
- **Gist push**: Validate before uploading to prevent bad data

### Runtime Validation
- **Rust**: Normalize `ScoringWeights` if sum ≠ 1.0 (with warning)
- **Rust**: Validate ranges (priority 1-10, weights 0.0-1.0)

### Validation Points
1. **Pre-commit**: `lint-staged` runs `validate-compendium.mjs` on `data/*.json`
2. **Gist push**: `scripts/gist-push.js` validates before upload
3. **Gist pull**: `scripts/fetch-gist-data.js` validates after download
4. **Build**: `prebuild` script fetches and validates

---

## Optional vs Required Fields

### Optional Fields (Rust `Option<T>`)

```rust
#[serde(skip_serializing_if = "Option::is_none")]
pub company_tags: Option<Vec<Tag>>
```

- Omitted from JSON when `null`
- Used for new hierarchy fields to maintain backward compatibility

### Required Fields

```rust
pub scoring_weights: ScoringWeights
```

- Must be present in all new `roleProfiles`

---

## Example: Adding a New Field

**Step 1: Add to Rust types**

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

**Step 2: Regenerate**

```bash
just types-schema && just types-ts
```

**Step 3: Update Data**

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

---

## Common Pitfalls

### ❌ Don't manually edit generated files
- `schemas/resume.schema.json` - Generated from Rust
- `lib/types/generated-resume.ts` - Generated from schema

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

---

## User Control

**Edit gist → update roleProfiles → automatic deploy → new roles appear in dropdown**

The resume data is stored in a GitHub Gist and automatically deployed to production:
1. Edit `resume-data.json` in your gist
2. Push changes with `just data-push`
3. Hourly GitHub Action checks for updates
4. If changed, triggers Vercel deployment
5. New role profiles appear in the UI automatically

---

## Tools Reference

- **Schema emitter**: `cargo run --bin generate_schema`
- **Type generator**: `tsx scripts/gen-ts-from-schemas.ts`
- **Validator**: `node scripts/validate-compendium.mjs <file>`
- **Drift checker**: `just types-drift`

---

## Migration Notes

### From Old Schema (Pre-2025-10)

If migrating from the old schema format:

**Field Renames:**
- `companies` → `experience`
- `positions` → `children` (at company level)
- `bullets` → `children` (at position level)
- `role` → `name` (at position level)
- `text` → `description` (at bullet level)
- `dateRange` → `dateStart`/`dateEnd` (structured dates)
- `context` → `description` or `summary`
- `descriptionTags` → `tags` (at position level)
- `descriptionPriority` → `priority` (at position level)

**Removed Fields:**
- `metrics` - No longer supported (include in description text instead)
- `accomplishments` - Moved to bullets within positions
- `fullName`, `citizenship`, `calendar` - Simplified PersonalInfo

**New Required Fields:**
- Company: `priority`, `tags`
- Position: `priority` (was `descriptionPriority`)
- All dates: `dateStart` instead of `dateRange`

**RoleProfile Changes:**
- `primaryTags`/`secondaryTags` → `tagWeights` (weighted map)
- `targetBulletCount` → removed (use selection config instead)
- Added `scoringWeights` (required)

---

## FAQ

**Q: Why Rust as source of truth instead of TypeScript?**
- Rust provides stronger type safety (u8 for 1-10 ranges, HashMap for tag weights)
- Rust validation logic (ScoringWeights.normalize()) closer to business logic
- Demonstrates systems programming skills (meta-resume principle)

**Q: Why not JSON Schema as source of truth?**
- Rust is more expressive (methods, trait impls, compile-time checks)
- schemars generates excellent schemas from Rust automatically
- Single source of truth in language closest to domain logic

---

**Last Updated:** 2025-10-22
**Schema Version:** 1.0.0 (resume.schema.json)
