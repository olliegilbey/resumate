## Data Structure

### Hierarchical Resume Schema

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
        "strategic-planning": 0.8,
        "team-leadership": 0.7,
        "cross-functional": 0.6
      },
      "scoringWeights": {
        "tagRelevance": 0.6,
        "priority": 0.4
      }
    },
    {
      "id": "developer-relations",
      "name": "Developer Relations",
      "description": "Technical advocacy and community building",
      "tagWeights": {
        "developer-relations": 1.0,
        "community-building": 0.95,
        "public-speaking": 0.9,
        "technical-writing": 0.85,
        "event-management": 0.7
      },
      "scoringWeights": {
        "tagRelevance": 0.65,
        "priority": 0.35
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

## Data Structure & Type System

### Current Approach: Rust Types as Source of Truth

**Design Decision**: We use Rust types with schemars for JSON Schema generation, which then generates TypeScript types.

**Type Flow:**
```
Rust types (doc-gen/crates/core/src/types.rs)
  ↓ cargo run --bin schema_emitter
JSON Schema (schemas/compendium.schema.json)
  ↓ just types-ts
Generated TypeScript (lib/types/generated-resume.ts)
  ↓ re-exported by
Canonical types (types/resume.ts) ← ALWAYS IMPORT FROM HERE
```

**How it works:**
- Rust types define the schema with `#[derive(JsonSchema)]`
- JSON Schema generated from Rust using schemars
- TypeScript types generated from JSON Schema using json-schema-to-typescript
- Runtime validation in CI/CD and pre-commit hooks

**Why this approach:**
- ✅ Single source of truth (Rust types)
- ✅ Type safety across Rust and TypeScript
- ✅ Runtime validation via JSON Schema
- ✅ Automatic type synchronization
- ✅ Schema documentation in Rust code

**Validation Points:**
- Pre-commit: Validates `data/*.json` against schema
- Gist push: Validates before uploading
- Build: Validates during prebuild (blocks deploy if invalid)
- Rust compilation: Type-checks at compile time

---

## Naming Conventions

### Field Naming
- **JSON/TypeScript**: camelCase (`dateStart`, `tagWeights`, `scoringWeights`)
- **Rust**: snake_case (`date_start`, `tag_weights`, `scoring_weights`)
- **Automatic conversion**: `#[serde(rename_all = "camelCase")]` handles mapping

### Hierarchy Fields
All levels use consistent patterns:
- **children**: Generic field for hierarchical relationships
  - Company.children → Position[]
  - Position.children → Bullet[]
- **name**: Display name at all levels (company name, position name, bullet can have optional name)
- **description**: Text content at all levels
- **tags**: Category tags at all levels
- **priority**: Importance ranking (1-10) at all levels
- **dateStart/dateEnd**: Date ranges at all levels

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

