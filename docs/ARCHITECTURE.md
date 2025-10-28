# WASM PDF Generation Architecture

**Rust → WASM → Browser PDF generation pipeline. Verified 2025-10-22.**

---

## System Overview

**Purpose:** Client-side PDF generation using Typst (Rust typesetting system compiled to WASM).

**Flow:** TypeScript payload → WASM boundary → Rust Typst compiler → PDF bytes → Browser download

**Security Model:**
- Server-side bullet selection (rate-limited, Turnstile-protected)
- Client receives only selected bullets (not full resume JSON)
- PDF generation happens client-side (server never sees final PDF)

---

## Build Pipeline

### 1. Font Acquisition

**Script:** `doc-gen/crates/typst/download-fonts.sh`

```bash
# Downloads Liberation Serif from Fedora Project
curl https://releases.pagure.org/liberation-fonts/liberation-fonts-ttf-2.1.4.tar.gz
tar -xzf liberation-fonts.tar.gz
mv LiberationSerif-Regular.ttf fonts/
mv LiberationSerif-Bold.ttf fonts/
```

**Output:** `doc-gen/crates/typst/fonts/`
- `LiberationSerif-Regular.ttf` (394KB)
- `LiberationSerif-Bold.ttf` (370KB)
- **Total:** ~764KB

**Why Liberation Serif:** SIL Open Font License (embeddable), professional serif font, smaller than full Typst assets (~764KB vs ~8MB).

### 2. Font Embedding (Compile-Time)

**File:** `doc-gen/crates/typst/src/fonts.rs:12-13`

```rust
const FONT_REGULAR: &[u8] = include_bytes!("../fonts/LiberationSerif-Regular.ttf");
const FONT_BOLD: &[u8] = include_bytes!("../fonts/LiberationSerif-Bold.ttf");
```

**Result:** Fonts baked into WASM binary at compile-time (zero runtime overhead, no HTTP requests).

### 3. WASM Compilation

**Script:** `doc-gen/build-wasm.sh`

```bash
wasm-pack build crates/wasm \
  --target web \
  --out-dir ../../public/wasm \
  --release
```

**Compiler Flags (Cargo.toml profile.release):**
```toml
opt-level = "z"        # Size optimization
lto = true             # Link-time optimization
codegen-units = 1      # Better optimization (slower compile)
panic = "abort"        # Smaller binary
strip = true           # Remove debug symbols
```

**Output:** `public/wasm/`
- `docgen_wasm_bg.wasm` (16MB raw, 6.28MB gzipped)
- `docgen_wasm.js` (16KB - JS bindings)
- `docgen_wasm.d.ts` (6KB - TypeScript types)
- `package.json` (446B - module metadata)

### 4. WASM Optimization (Automatic)

**Config:** `doc-gen/crates/wasm/Cargo.toml:10-11`

```toml
[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-Oz", "--enable-bulk-memory", "--enable-nontrapping-float-to-int"]
```

**Verified:** Build output shows "[INFO]: Optimizing wasm binaries with `wasm-opt`..." (tested 2025-10-22).

**Effect:**
- Pre-optimization: ~18-20MB (estimated)
- Post-optimization: 16MB (~11% reduction)
- Gzipped transfer: 6.28MB (what browser downloads)

---

## WASM Exports (Rust → JavaScript)

**File:** `doc-gen/crates/wasm/src/lib.rs`

### Primary Export

```rust
#[wasm_bindgen]
pub fn generate_pdf_typst(payload_json: &str, dev_mode: bool) -> Result<Vec<u8>, JsValue>
```

**Parameters:**
- `payload_json`: Serialized `GenerationPayload` (personal info + selected bullets + role profile)
- `dev_mode`: If true, adds build metadata page to PDF (localhost only)

**Returns:** `Vec<u8>` (PDF bytes) or `JsValue` error message

**Implementation:**
1. Parse JSON → `GenerationPayload` struct
2. Validate payload (name, role, weights, bullet count ≤50)
3. Call `docgen_typst::render_resume(&payload, dev_mode)`
4. Return PDF bytes

### Utility Exports

```rust
#[wasm_bindgen] pub fn version() -> String
#[wasm_bindgen] pub fn build_info() -> String
#[wasm_bindgen] pub fn validate_payload_json(payload_json: &str) -> Result<(), JsValue>
#[wasm_bindgen] pub fn estimate_pdf_size(bullet_count: usize) -> usize
```

---

## TypeScript Integration

**File:** `components/data/ResumeDownload.tsx:116-174`

### WASM Loading (Dynamic)

```typescript
// Create module script for dynamic import
const script = document.createElement('script')
script.type = 'module'
script.textContent = `
  import init, { generate_pdf_typst } from '/wasm/docgen_wasm.js';
  await init('/wasm/docgen_wasm_bg.wasm');

  window.__wasmReady = true;
  window.__generatePdfTypst = generate_pdf_typst;
`
document.head.appendChild(script)
```

**Why Dynamic:**
- Non-blocking (user sees UI before 6.28MB download)
- Browser caching (instant subsequent loads)
- Progress indicator during first load

### PDF Generation

```typescript
const payload = {
  personal: resumeData.personal,
  selectedBullets: selectData.selected,
  roleProfile: roleProfile,
  education: resumeData.education,
  skills: resumeData.skills,
  summary: resumeData.summary,
  metadata: null,
}

const isDevMode = window.location.hostname === 'localhost'
const generatePdfTypst = window.__generatePdfTypst as (payload: string, devMode: boolean) => Uint8Array
const pdfBytes = generatePdfTypst(JSON.stringify(payload), isDevMode)

// Download
const blob = new Blob([pdfBytes.slice()], { type: 'application/pdf' })
const url = URL.createObjectURL(blob)
const link = document.createElement('a')
link.href = url
link.download = `${fullName}-${roleName}-${timestamp}.pdf`
link.click()
```

**Type Safety:** TypeScript sees `Uint8Array` return type (wasm-bindgen generates `.d.ts` files).

---

## Dependencies

**Workspace:** `Cargo.toml:59-64`

```toml
typst = "0.12.0"           # Core typesetting engine
typst-pdf = "0.12.0"       # PDF export
typst-syntax = "0.12.0"    # Template parsing
typst-utils = "0.12.0"     # Utilities
comemo = "0.4"             # Memoization (caching)
ecow = "0.2"               # Efficient clone-on-write strings
```

**Tree-Shaking Opportunities:**
- `typst` uses default features (no feature flags set)
- Potential savings: Disable unused Typst features (bibliography, math layout, SVG)
- Investigate: `cargo tree -i typst` to see feature dependencies

---

## Size Metrics (Verified)

| Metric | Size | Notes |
|--------|------|-------|
| Liberation Serif fonts | 764KB | Embedded at compile-time |
| WASM binary (raw) | 16MB | After wasm-opt -Oz |
| WASM binary (gzipped) | 6.28MB | Browser transfer size |
| JS bindings | 16KB | docgen_wasm.js |
| TypeScript defs | 6KB | Type safety |
| First load time | ~2-5s | Depends on connection |
| Subsequent loads | ~0ms | Browser cached |

**Historical Context:**
- Original approach: Full Typst assets (~8MB fonts) → 24MB WASM, ~10MB gzipped
- Current approach: Liberation Serif only → 16MB WASM, 6.28MB gzipped
- **Savings:** 8MB raw, 3.72MB gzipped (37% reduction)

---

## Critical Deployment Issue

**Problem:** `public/wasm/.gitignore` contains `*` → All WASM files gitignored

**Impact:**
- Works locally (files exist on disk)
- **Fails on Vercel** (files not in git, returns 404)
- User sees: "Failed to fetch /wasm/docgen_wasm_bg.wasm"

**Verification:**
```bash
git ls-files public/wasm/  # Returns empty (no files tracked)
```

**Solutions:**

### Option A: Commit WASM Files (Quick Fix)
```bash
rm public/wasm/.gitignore
git add public/wasm/
git commit -m "feat: Add pre-built WASM for deployment"
```
- **Pros:** Immediate fix, works on any static host
- **Cons:** 16MB in git history, manual rebuilds

### Option B: Build WASM on Vercel (Recommended)

Update `vercel.json`:
```json
{
  "buildCommand": "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && source $HOME/.cargo/env && cd doc-gen && bash crates/typst/download-fonts.sh && bash build-wasm.sh && cd .. && npm run build"
}
```

- **Pros:** Always up-to-date, no git bloat, guaranteed sync
- **Cons:** +2-3min build time (acceptable per user)
- **Status:** User preference stated: "on vercel the compilation should happen, build times don't really matter there"

### Option C: GitHub Actions Pre-Build

```yaml
# .github/workflows/wasm-build.yml
on:
  push:
    paths: ['doc-gen/crates/**']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: dtolnay/rust-toolchain@stable
      - run: cd doc-gen && bash crates/typst/download-fonts.sh && bash build-wasm.sh
      - uses: stefanzweifel/git-auto-commit-action@v4
        with:
          file_pattern: public/wasm/*
```

- **Pros:** Automated, only rebuilds on Rust changes, clean workflow
- **Cons:** Complexity, requires CI/CD setup

---

## Local Development

### Current Commands

```bash
just wasm    # Build WASM only (doc-gen/build-wasm.sh)
just build   # Build Next.js only (fetches gist, runs next build)
just dev     # Dev server (uses cached WASM if exists)
```

### Planned: Full Build Command

**User Requirement:** "have a local full build process to run a single just command and everything gets fully done, end-to-end"

**Proposal:** `just build-all`

```makefile
build-all:
    cd doc-gen && bash crates/typst/download-fonts.sh
    cd doc-gen && bash build-wasm.sh
    npm run build
```

**Effect:** Single command rebuilds WASM + Next.js (full end-to-end).

---

## Font Directory Status

### Active Directory: `doc-gen/crates/typst/fonts/`
- `LiberationSerif-Regular.ttf` (394KB)
- `LiberationSerif-Bold.ttf` (370KB)
- `README.md` (936B)
- **Used by:** `fonts.rs:12-13` via `include_bytes!()`
- **Status:** ✅ KEEP

### Obsolete Directory: `crates/typst/fonts/`
- `liberation-fonts-ttf-2.1.5.tar.gz` (9 bytes - empty placeholder)
- **Used by:** Nothing
- **Status:** ❌ DELETE

**Action:** `rm -rf crates/typst/fonts/`

---

## Performance Characteristics

**WASM Initialization (First Load):**
1. Download 6.28MB (gzipped): ~1-3s (typical connection)
2. Parse and instantiate WASM: ~500ms
3. **Total:** ~2-5s cold start

**WASM Initialization (Cached):**
1. Browser cache hit: ~0ms download
2. Parse and instantiate: ~500ms
3. **Total:** ~500ms warm start

**PDF Generation:**
- 10 bullets: ~200ms
- 20 bullets: ~500ms
- 50 bullets: ~800ms

**Total Time (Cold Start):** ~2-6s first visit, ~1-2s subsequent visits

---

## Testing

**WASM Tests:** `doc-gen/crates/wasm/src/lib.rs:142-756`

- 32 tests (validation, JSON parsing, PDF generation, edge cases)
- Tests run with `#[cfg(target_arch = "wasm32")]` (only on WASM target)
- Validates: Payload structure, scoring weights (sum ≈ 1.0), bullet count (≤50), empty fields

**Integration Test:**
```bash
just dev
# Visit http://localhost:3000/resume
# Select role, generate PDF
# Check browser console for: "✅ PDF generated successfully with Typst"
```

**Verify Optimizer Runs:**
```bash
cd doc-gen && bash build-wasm.sh
# Check output for: "[INFO]: Optimizing wasm binaries with `wasm-opt`..."
# Verify size: ls -lh ../public/wasm/docgen_wasm_bg.wasm (should be ~16M)
```

---

## Next Steps

### Immediate (Required for Production)
1. **Fix deployment issue:** Implement Vercel WASM compilation (Option B)
2. **Delete obsolete fonts:** `rm -rf crates/typst/fonts/`
3. **Create `just build-all`:** Single command for full build
4. **Update docs/STATUS.md:** Mark Phase 5.6, 5.7 as ✅ DONE

### Optimization (Future)
1. **Tree-shake Typst:** Disable unused features (bibliography, math, SVG)
   - Investigate: `cargo tree -i typst -e features`
   - Target: <14MB raw, <5MB gzipped
2. **Profile WASM:** Measure actual bottlenecks with `wasm-profile`
3. **Lazy-load fonts:** Download fonts on-demand (non-WASM approach)

---

## Summary for AI Agents

**Key Files:**
- WASM exports: `doc-gen/crates/wasm/src/lib.rs:54-68`
- Font embedding: `doc-gen/crates/typst/src/fonts.rs:12-13`
- TS integration: `components/data/ResumeDownload.tsx:116-174`
- Build script: `doc-gen/build-wasm.sh`
- Optimization: `doc-gen/crates/wasm/Cargo.toml:10-11`

**Critical Facts:**
- WASM IS working locally (verified 2025-10-22)
- WASM will NOT work on Vercel (gitignored files)
- wasm-opt IS running (verified in build output)
- Fonts embedded at compile-time (not runtime)
- Size: 16MB raw, 6.28MB gzipped

**User Requirement:** Build WASM on Vercel (Option B), create `just build-all`, tree-shake Typst.
