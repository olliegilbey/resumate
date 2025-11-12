# Scripts & Tooling Context

**You're reading this because you're working with:**
- Files in `scripts/`
- Gist synchronization scripts
- Type generation scripts
- Validation scripts
- Automation tooling

**Shared project context already loaded via root CLAUDE.md:**
- Architecture, workflows, status, deployment
- Linear project for active tasks

**This file contains scripts-specific patterns and conventions.**

---

## Scripts Directory Structure

```
scripts/
├── check-wasm.sh               # WASM validation (--exists/--fresh modes)
├── fetch-gist-data.js          # Gist → local (prebuild hook, fail-fast)
├── gist-push.js                # Local → gist (with conflict detection)
├── gist-view.js                # View gist in terminal
├── gen-ts-from-schemas.ts      # JSON Schema → TypeScript types
├── update-metrics-from-logs.sh # Generate METRICS.md from test logs
├── validate-compendium.mjs     # Schema validation
└── verify-docs.sh              # Documentation system verification
```

---

## WASM Validation Scripts

### check-wasm.sh

**Purpose:** Validate WASM binaries with two modes (build once locally, validate everywhere)

**Modes:**
- `--exists`: Fail-fast if WASM missing (Vercel/CI - never rebuilds)
- `--fresh`: Hash check + conditional rebuild (pre-commit)

**Usage:**
```bash
# Vercel prebuild (existence check only)
bash scripts/check-wasm.sh --exists

# Pre-commit (freshness check + rebuild if stale)
bash scripts/check-wasm.sh --fresh
```

**--exists Mode (Vercel):**
- Checks if WASM binaries exist in `public/wasm/`
- Fails immediately with actionable error if missing
- Never attempts to rebuild (requires pre-built artifacts)
- Duration: <1s

**--fresh Mode (Pre-commit):**
- Only runs if WASM source files are staged
- Computes hash of all WASM sources (Rust, Typst, fonts)
- Compares to stored hash in `.wasm-build-hash`
- Rebuilds if hash changed or WASM missing
- Auto-stages WASM binaries + hash file
- Duration: 1s (cached) or 13s (rebuild)

**WASM Sources Tracked:**
```bash
crates/resume-wasm/
crates/resume-typst/
crates/resume-core/
crates/shared-types/
typst/templates/
typst/fonts/
```

**Philosophy:** WASM compiled locally once, validated everywhere, deployed fast

---

## Gist Integration Scripts

### fetch-gist-data.js

**Purpose:** Fetch resume data from GitHub Gist with fail-fast validation

**Usage:**
```bash
just data-pull                        # Interactive mode
just data-pull -- --force             # Force mode (prebuild)
node scripts/fetch-gist-data.js --allow-template  # Dev template fallback
```

**Environment Variables:**
- `RESUME_DATA_GIST_URL` - Raw gist URL (required in production)
- `NODE_ENV` - Environment mode (production/development)

**Modes:**

**Production (NODE_ENV=production):**
- GIST_URL required (fails immediately if missing)
- Fetch must succeed (fail-fast on network/HTTP errors)
- JSON syntax validated
- Schema validated against `schemas/resume.schema.json`
- File existence verified after write
- All failures are fatal with `::error::` markers

**Development (NODE_ENV=development):**
- GIST_URL optional
- Template fallback with `--allow-template` flag
- Copies `data/resume-data-template.json` if GIST_URL missing
- Same validation as production if GIST_URL provided

**Validation Steps:**
1. ✅ JSON syntax validation (`JSON.parse`)
2. ✅ Schema validation (`validate-compendium.mjs`)
3. ✅ File existence check
4. ✅ File size reporting

**Conflict Detection:**
```javascript
// If local file exists and differs from gist:
if (!forceMode) {
  const answer = await prompt('Local differs from gist. Overwrite? (y/N): ')
  if (answer !== 'y') {
    console.log('Aborted.')
    process.exit(1)
  }
}
```

**Package.json Integration:**
```json
{
  "scripts": {
    "prebuild": "bash scripts/check-wasm.sh --exists && node scripts/fetch-gist-data.js --force",
    "data:pull": "node scripts/fetch-gist-data.js"
  }
}
```

**Prebuild Flow (Vercel):**
1. Validate WASM exists (fail-fast if missing)
2. Fetch gist data (fail-fast if invalid)
3. Build Next.js

**Important Notes:**
- **ALWAYS run before editing** `data/resume-data.json` to prevent data loss
- Production mode fails fast on any error
- Force mode prevents blocking builds on prompts

---

### gist-push.js

**Purpose:** Push local resume data to GitHub Gist

**Usage:**
```bash
just data-push              # Interactive mode (prompts on conflicts)
just data-push -- --force   # Force mode (skip prompts)
node scripts/gist-push.js --force
```

**Requirements:**
- `gh` CLI installed and authenticated
- `RESUME_DATA_GIST_URL` environment variable set

**Behavior:**
- Reads local `data/resume-data.json`
- Validates JSON format
- Fetches current gist content
- Compares local vs gist (conflict detection)
- **Interactive mode**: Prompts if gist differs from local
- **Force mode**: Pushes without prompting
- Uses `gh gist edit` to update

**Implementation:**
```javascript
const gistId = extractGistId(process.env.RESUME_DATA_GIST_URL)
const result = execSync(`gh gist edit ${gistId} -f resume-data.json`, {
  input: localContent,
  encoding: 'utf-8'
})
```

**Conflict Detection:**
```javascript
// If gist differs from local:
if (!forceMode && gistContent !== localContent) {
  const answer = await prompt('Gist differs from local. Overwrite gist? (y/N): ')
  if (answer !== 'y') {
    console.log('Aborted.')
    process.exit(1)
  }
}
```

**Safety Features:**
- Validates JSON before pushing
- Warns on differences
- Requires confirmation in interactive mode
- No automatic merging (last write wins)

---

### gist-view.js

**Purpose:** View gist content in terminal (for debugging)

**Usage:**
```bash
just data-view
node scripts/gist-view.js
```

**Behavior:**
- Fetches gist from `RESUME_DATA_GIST_URL`
- Pretty-prints JSON with syntax highlighting
- Shows metadata (size, last modified if available)

---

## Type Generation Scripts

### gen-ts-from-schemas.ts

**Purpose:** Generate TypeScript types from JSON Schema

**Usage:**
```bash
just types-ts
npx tsx scripts/gen-ts-from-schemas.ts
```

**Input:** `schemas/resume.schema.json` (generated by Rust generate_schema)

**Output:** `lib/types/generated-resume.ts`

**Process:**
1. Read JSON Schema from `schemas/resume.schema.json`
2. Use `json-schema-to-typescript` to generate TS types
3. Add header comment warning not to edit manually
4. Write to `lib/types/generated-resume.ts`
5. Re-exported by `types/resume.ts` (canonical import location)

**Implementation:**
```typescript
import { compile } from 'json-schema-to-typescript'

const schema = JSON.parse(fs.readFileSync('schemas/resume.schema.json', 'utf-8'))

const ts = await compile(schema, 'ResumeData', {
  bannerComment: '/* This file is auto-generated. DO NOT EDIT. Run `just types-ts` to regenerate. */',
  style: {
    singleQuote: true,
    semi: false,
  },
})

fs.writeFileSync('lib/types/generated-resume.ts', ts)
```

**Type Flow:**
```
Rust types (crates/shared-types/src/lib.rs)
  ↓ cargo run --bin generate_schema
JSON Schema (schemas/resume.schema.json)
  ↓ just types-ts
Generated TS (lib/types/generated-resume.ts)
  ↓ re-exported by
Canonical types (types/resume.ts) ← ALWAYS IMPORT FROM HERE
```

**Important:**
- **NEVER edit** `lib/types/generated-resume.ts` manually
- **ALWAYS import** from `types/resume.ts`, not generated file
- Run after changing Rust types

---

## Data Migration Scripts

### transform-resume-data.ts

**Purpose:** Transform resume data to match new schema

**Usage:**
```bash
npx tsx scripts/transform-resume-data.ts
```

**Example Use Cases:**
- Adding new required fields (e.g., `companyPriority`, `companyTags`)
- Renaming fields
- Data normalization
- Schema migrations

**Pattern:**
```typescript
import resumeData from '../data/resume-data.json'

// Define transformation metadata
const COMPANY_METADATA = {
  'company-id': {
    companyPriority: 10,
    companyTags: ['tag1', 'tag2'],
    reasoning: 'Why this priority'
  },
}

// Transform data
const transformed = {
  ...resumeData,
  companies: resumeData.companies.map(company => ({
    ...company,
    companyPriority: COMPANY_METADATA[company.id].companyPriority,
    companyTags: COMPANY_METADATA[company.id].companyTags,
  }))
}

// Write back
fs.writeFileSync('data/resume-data.json', JSON.stringify(transformed, null, 2))
```

**Workflow:**
1. Pull latest gist: `just data-pull`
2. Run transformation: `npx tsx scripts/transform-resume-data.ts`
3. Validate: `just data-validate`
4. Test in app: `just dev`
5. Push to gist: `just data-push`

---

## Validation Scripts

### Package.json Scripts

```json
{
  "scripts": {
    "validate:gist": "node -e \"JSON.parse(require('fs').readFileSync('data/resume-data.json', 'utf-8'))\"",
    "validate:template": "node -e \"JSON.parse(require('fs').readFileSync('data/resume-data-template.json', 'utf-8'))\"",
    "check:drift": "just types-schema && just types-ts && git diff --exit-code schemas/ lib/types/"
  }
}
```

**validate:gist**
- Quick JSON syntax check for resume data
- Fails fast if JSON is malformed

**validate:template**
- Validates template JSON syntax
- Template serves as pseudo-schema for TypeScript inference

**check:drift**
- Regenerates schemas and types
- Checks git diff to detect uncommitted schema changes
- Useful in CI to ensure schema/types are in sync

---

## Automation Patterns

### Prebuild Hook

**When it runs:** Before every production build (Vercel, local `just build`)

```json
{
  "scripts": {
    "prebuild": "node scripts/fetch-gist-data.js --force"
  }
}
```

**Why `--force`:**
- Prevents blocking build on prompts
- Always fetches latest gist data
- Build fails if gist is unreachable or invalid JSON

**Safety:**
- Local `data/resume-data.json` is gitignored
- Gist is source of truth for production builds
- No risk of stale data in deployments

---

### CI/CD Integration

**GitHub Actions Use:**
```yaml
# .github/workflows/gist-deploy-trigger.yml
- name: Fetch gist data
  run: just data-pull -- --force

- name: Validate JSON
  run: jq empty data/resume-data.json

- name: Build
  run: just build
```

**Key Points:**
- Use `--force` flag in CI to avoid hanging on prompts
- Validate JSON before building to fail fast
- Fetch gist data even if deploying from GitHub push (ensures fresh data)

---

## Error Handling

### Common Errors

**Missing Environment Variable:**
```
Error: RESUME_DATA_GIST_URL not set
Solution: Add to .env.local
```

**Invalid JSON:**
```
Error: Unexpected token in JSON
Solution: Validate with jq or jsonlint
```

**gh CLI Not Authenticated:**
```
Error: gh auth required
Solution: Run `gh auth login`
```

**Gist Fetch Failed:**
```
Error: Failed to fetch gist (HTTP 404)
Solution: Check RESUME_DATA_GIST_URL is correct raw URL
```

---

## Notes for AI Assistants

**Before editing data/resume-data.json:**
1. **ALWAYS** run `just data-pull` first to fetch latest from gist
2. Edit the local file
3. Validate with `just data-validate`
4. Test in Next.js app (`just dev`)
5. Push to gist with `just data-push`

**After changing Rust types:**
1. Run `just types-schema` to regenerate JSON Schema
2. Run `just types-ts` to regenerate TypeScript types
3. Run `just data-validate` to ensure data matches new schema
4. Commit both Rust changes AND generated files

**For hybrid work (scripts + app):**
- Also read `app/CLAUDE.md` for Next.js context
- Scripts are Node.js, not Next.js (use `node` or `npx tsx`, not `next`)
- Environment variables from `.env.local` auto-loaded by Node scripts

**Common tasks:**
- Sync gist data → `just data-pull`
- Push local changes → `just data-push`
- Regenerate types → `just types-ts`
- Validate data → `just data-validate`
- Transform data → Create script in `scripts/`, run with `npx tsx`
