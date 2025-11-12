---
last_updated: 2025-10-28
category: System Architecture & Design
update_frequency: Never (only on major architectural changes)
retention_policy: All versions preserved in git
---

# WASM PDF Generation Architecture

> **📍 Purpose:** Immutable system design and data flow documentation.
> For current status and deployment issues, see [CURRENT_PHASE.md](./CURRENT_PHASE.md)

**Rust → WASM → Browser PDF generation pipeline**

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

**Script:** `crates/resume-typst/download-fonts.sh`

```bash
# Downloads Liberation Serif from Fedora Project
curl https://releases.pagure.org/liberation-fonts/liberation-fonts-ttf-2.1.4.tar.gz
tar -xzf liberation-fonts.tar.gz
mv LiberationSerif-Regular.ttf fonts/
mv LiberationSerif-Bold.ttf fonts/
```

**Output:** `typst/fonts/`
- `LiberationSerif-Regular.ttf` (394KB)
- `LiberationSerif-Bold.ttf` (370KB)
- **Total:** ~764KB

**Why Liberation Serif:** SIL Open Font License (embeddable), professional serif font, smaller than full Typst assets (~764KB vs ~8MB).

### 2. Font Embedding (Compile-Time)

**File:** `crates/resume-typst/src/fonts.rs`

```rust
const FONT_REGULAR: &[u8] = include_bytes!("../fonts/LiberationSerif-Regular.ttf");
const FONT_BOLD: &[u8] = include_bytes!("../fonts/LiberationSerif-Bold.ttf");
```

**Result:** Fonts baked into WASM binary at compile-time (zero runtime overhead, no HTTP requests).

### 3. WASM Compilation

**Script:** `scripts/check-wasm.sh --fresh` (pre-commit) or `just wasm` (manual)

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
- `resume_wasm_bg.wasm` (16MB raw, 6.28MB gzipped)
- `resume_wasm.js` (16KB - JS bindings)
- `resume_wasm.d.ts` (6KB - TypeScript types)
- `package.json` (446B - module metadata)

### 4. WASM Optimization (Automatic)

**Config:** `crates/resume-wasm/Cargo.toml:10-11`

```toml
[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-Oz", "--enable-bulk-memory", "--enable-nontrapping-float-to-int"]
```

**Effect:**
- Pre-optimization: ~18-20MB (estimated)
- Post-optimization: 16MB (~11% reduction)
- Gzipped transfer: 6.28MB (what browser downloads)

---

## WASM Exports (Rust → JavaScript)

**File:** `crates/resume-wasm/src/lib.rs`

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
3. Call `resume_typst::render_resume(&payload, dev_mode)`
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
  import init, { generate_pdf_typst } from '/wasm/resume_wasm.js';
  await init('/wasm/resume_wasm_bg.wasm');

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
| JS bindings | 16KB | resume_wasm.js |
| TypeScript defs | 6KB | Type safety |
| First load time | ~2-5s | Depends on connection |
| Subsequent loads | ~0ms | Browser cached |

**Historical Context:**
- Original approach: Full Typst assets (~8MB fonts) → 24MB WASM, ~10MB gzipped
- Current approach: Liberation Serif only → 16MB WASM, 6.28MB gzipped
- **Savings:** 8MB raw, 3.72MB gzipped (37% reduction)

---

## Local Development

### Build Commands

```bash
just wasm    # Build WASM only (uses wasm-pack)
just build   # Full build (WASM + Next.js)
just dev     # Dev server (uses cached WASM if exists)
```

---

## Font Directory Status

### Font Directory: `typst/fonts/`
- `LiberationSerif-Regular.ttf` (394KB)
- `LiberationSerif-Bold.ttf` (370KB)
- `README.md` (936B)
- **Used by:** `fonts.rs:12-13` via `include_bytes!()`

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

**WASM Tests:** `crates/resume-wasm/tests/`

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

**Verify WASM Build:**
```bash
just wasm
# Expected output: "[INFO]: Optimizing wasm binaries with `wasm-opt`..."
# Expected size: ~16MB raw, ~6.28MB gzipped
```

---

## Related Documentation

- **[CURRENT_PHASE.md](./CURRENT_PHASE.md)** - Current status, deployment issues, next steps
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - How to deploy and configure
- **[TESTING_STRATEGY.md](./TESTING_STRATEGY.md)** - Testing philosophy and patterns
- **[DATA_SCHEMA.md](./DATA_SCHEMA.md)** - Type system and validation

---

## Key File References

**WASM Pipeline:**
- WASM exports: `crates/resume-wasm/src/lib.rs`
- Font embedding: `crates/resume-typst/src/fonts.rs`
- Build script: `scripts/check-wasm.sh` (validation), `justfile` (build)
- Optimization: `crates/resume-wasm/Cargo.toml`

**TypeScript Integration:**
- Component: `components/data/ResumeDownload.tsx:116-174`
- Dynamic loading: ES module script injection
- Type safety: wasm-bindgen generates `.d.ts` files

**Critical Facts:**
- Fonts embedded at compile-time (not runtime)
- Size: 16MB raw, 6.28MB gzipped
- First load: ~2-5s, subsequent: ~500ms (cached)
- wasm-opt runs automatically during build
