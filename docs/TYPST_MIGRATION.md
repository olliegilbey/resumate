# Typst Migration Specification

**Status:** Planning Document for AI Agent Execution
**Created:** 2025-10-18
**Owner:** Ollie Gilbey
**Purpose:** Complete specification for migrating from manual pdf-writer PDF generation to Typst-based typesetting system

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Comparison](#technology-comparison)
3. [Architecture Overview](#architecture-overview)
4. [Implementation Plan](#implementation-plan)
5. [Typst Template Design](#typst-template-design)
6. [Rust Integration](#rust-integration)
7. [WASM Build Pipeline](#wasm-build-pipeline)
8. [Frontend Integration](#frontend-integration)
9. [Testing Strategy](#testing-strategy)
10. [Migration Checklist](#migration-checklist)
11. [Rollback Plan](#rollback-plan)

---

## Executive Summary

### The Problem

Current PDF generation using `pdf-writer` requires manual coordinate calculations, text positioning, and page break logic. We've encountered multiple issues:
- Content positioning bugs (starting midway down page)
- Page height calculation errors
- Manual layout management complexity
- No automatic text flow or multi-page support
- Character encoding issues

### The Solution

Migrate to **Typst** - a modern, Rust-based typesetting system (think LaTeX but better) that handles:
- ✅ Automatic layout and typography
- ✅ Multi-page support with proper text flow
- ✅ Professional document formatting out-of-the-box
- ✅ Template-based design (easier to iterate)
- ✅ Native Rust integration
- ✅ WASM compilation support

### Technical Showcase Value

**"Full Typst compiler running in browser via WASM"** is significantly more impressive than "manual PDF coordinate calculations" for a meta-resume that demonstrates technical capabilities.

### User Decisions

- ✅ Compile Typst to WASM ourselves (not use typst.ts NPM packages)
- ✅ Complete replacement of pdf-writer (no fallback)
- ✅ PDF only via Typst (remove DOCX generation entirely)

---

## Technology Comparison

### Current Approach: pdf-writer

**Library:** `pdf-writer` (low-level PDF creation)

**Pros:**
- Small WASM size (~220KB)
- Fast generation (~50ms)
- Direct control over every element

**Cons:**
- ❌ Manual Y-coordinate calculations
- ❌ Text wrapping logic required
- ❌ Page break detection needed
- ❌ No automatic layout
- ❌ Complex to maintain
- ❌ Doesn't showcase advanced skills

### New Approach: Typst

**Library:** `typst` (modern typesetting system)

**Pros:**
- ✅ Automatic layout and typography
- ✅ Multi-page support built-in
- ✅ Template-based (easy to iterate designs)
- ✅ Professional typography out-of-the-box
- ✅ Written in Rust (native integration)
- ✅ Shows off advanced WASM integration
- ✅ Much more impressive technically

**Cons:**
- Larger WASM size (~2-5MB estimated)
- Slightly slower compilation (~500ms vs ~50ms)
- Need to learn Typst markup syntax

**Verdict:** Pros massively outweigh cons. The WASM size is acceptable (first load only, cached after), and the added compilation time is negligible for the value provided.

### Rejected Alternatives

**SwiftLaTeX:**
- Not actively maintained
- Not Rust-based
- ❌ Rejected

**typst.ts (NPM packages):**
- Would be easier
- But compiling ourselves is more impressive
- ❌ User chose to compile ourselves

**Tectonic (LaTeX engine):**
- Full LaTeX engine
- WASM support not production-ready (C dependencies challenging)
- ❌ Too complex for our needs

**printpdf:**
- Similar level to pdf-writer
- Still requires manual layout
- ❌ Doesn't solve our problems

---

## Architecture Overview

### Current Crate Structure

```
doc-gen/
├── Cargo.toml (workspace)
├── crates/
│   ├── core/              # Types, scoring, selection (KEEP)
│   ├── pdf/               # pdf-writer generation (REMOVE)
│   ├── docx/              # DOCX generation (REMOVE)
│   └── wasm/              # WASM bindings (UPDATE)
```

### New Crate Structure

```
doc-gen/
├── Cargo.toml (workspace)
├── crates/
│   ├── core/              # Types, scoring, selection (UNCHANGED)
│   │   ├── src/
│   │   │   ├── types.rs
│   │   │   ├── scoring.rs
│   │   │   └── selector.rs
│   │
│   ├── typst/             # NEW: Typst PDF generation
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs           # Public API
│   │   │   ├── compiler.rs      # Typst compiler wrapper
│   │   │   ├── template.rs      # Template rendering
│   │   │   └── fonts.rs         # Font management
│   │   └── templates/
│   │       ├── resume.typ       # Main resume template
│   │       ├── modern.typ       # Modern style variant
│   │       └── ats-optimized.typ # ATS-focused variant
│   │
│   └── wasm/              # UPDATED: Typst WASM bindings
│       ├── Cargo.toml
│       ├── build.rs
│       └── src/
│           └── lib.rs           # wasm_bindgen exports
```

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (React/Next.js)                                 │
├─────────────────────────────────────────────────────────┤
│ 1. User selects role profile                            │
│ 2. POST /api/resume/select                              │
│ 3. Receives GenerationPayload JSON                      │
│ 4. Loads Typst WASM module                             │
│ 5. Calls generate_pdf_typst(payload_json, dev_mode)    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ WASM (doc-gen/crates/wasm/src/lib.rs)                  │
├─────────────────────────────────────────────────────────┤
│ #[wasm_bindgen]                                         │
│ pub fn generate_pdf_typst(                              │
│     payload_json: &str,                                 │
│     dev_mode: bool                                      │
│ ) -> Result<Vec<u8>, JsValue>                          │
│                                                          │
│ 1. Deserialize JSON to GenerationPayload               │
│ 2. Call typst crate: render_resume(&payload, dev_mode) │
│ 3. Return PDF bytes                                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ TYPST CRATE (doc-gen/crates/typst/src/)                │
├─────────────────────────────────────────────────────────┤
│ pub fn render_resume(                                   │
│     payload: &GenerationPayload,                        │
│     dev_mode: bool                                      │
│ ) -> Result<Vec<u8>, TypstError>                       │
│                                                          │
│ 1. Load resume.typ template                            │
│ 2. Inject data via template variables                  │
│ 3. Compile Typst → PDF                                 │
│ 4. Return PDF bytes                                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ TYPST COMPILER (typst crate from crates.io)            │
├─────────────────────────────────────────────────────────┤
│ • Parses .typ template markup                          │
│ • Applies typography rules                             │
│ • Handles multi-page layout                            │
│ • Generates PDF binary                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Setup & Dependencies (1-2 hours)

#### 1.1: Update Workspace Cargo.toml

**File:** `doc-gen/Cargo.toml`

**Changes:**
```toml
[workspace]
members = [
    "crates/core",
    # "crates/pdf",      # REMOVE
    # "crates/docx",     # REMOVE
    "crates/typst",      # ADD
    "crates/wasm",
]
resolver = "2"

[workspace.dependencies]
# Existing
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "2.0"

# NEW: Typst dependencies
typst = "0.13"                        # Main Typst library
typst-pdf = "0.13"                    # PDF export functionality
typst-syntax = "0.13"                 # Typst syntax parsing
comemo = "0.4"                        # Memoization for Typst
ecow = "0.2"                          # Copy-on-write strings for Typst
```

**Note:** Check latest versions at https://crates.io/crates/typst

#### 1.2: Create Typst Crate

**Command:**
```bash
cd doc-gen/crates
mkdir -p typst/src
mkdir -p typst/templates
```

**File:** `doc-gen/crates/typst/Cargo.toml`

```toml
[package]
name = "docgen-typst"
version = "0.1.0"
edition = "2021"

[dependencies]
# Workspace dependencies
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }

# Typst dependencies
typst = { workspace = true }
typst-pdf = { workspace = true }
typst-syntax = { workspace = true }
comemo = { workspace = true }
ecow = { workspace = true }

# Local dependencies
docgen-core = { path = "../core" }

# Additional utilities
chrono = "0.4"            # For date formatting
```

### Phase 2: Create Typst Template (2-3 hours)

#### 2.1: Basic Resume Template

**File:** `doc-gen/crates/typst/templates/resume.typ`

```typst
// Resume Template for Resumate
// Variables injected from Rust:
// - personal: PersonalInfo
// - summary: String
// - companies: Array<Company>
// - education: Array<Education>
// - skills: Map<String, Array<String>>
// - metadata: Map (optional, dev mode only)

#set document(
  title: [Resume - #personal.name - #role_profile.name],
  author: (personal.name,),
)

#set page(
  paper: "us-letter",
  margin: (top: 0.75in, bottom: 0.75in, x: 0.75in),
  numbering: "1",
  number-align: center,
)

#set text(
  font: "Linux Libertine",
  size: 10pt,
)

#set par(
  leading: 0.55em,
  justify: false,
)

// ====================
// HEADER SECTION
// ====================

#align(center)[
  #text(size: 18pt, weight: "bold")[#personal.name]

  #v(0.3em)

  #text(size: 9pt)[
    #personal.email •
    #personal.phone •
    #personal.location

    #if personal.linkedin != none [
      • linkedin.com/in/#personal.linkedin
    ]

    #if personal.github != none [
      • github.com/#personal.github
    ]
  ]
]

#v(0.8em)

// ====================
// SUMMARY SECTION
// ====================

#if summary != none [
  #text(size: 11pt, weight: "bold")[SUMMARY]
  #line(length: 100%, stroke: 0.5pt)
  #v(0.3em)

  #par(justify: true)[#summary]

  #v(0.6em)
]

// ====================
// EXPERIENCE SECTION
// ====================

#text(size: 11pt, weight: "bold")[EXPERIENCE]
#line(length: 100%, stroke: 0.5pt)
#v(0.3em)

#for company in companies [
  // Company header
  #grid(
    columns: (1fr, auto),
    [#text(weight: "bold", size: 11pt)[#company.name]],
    [#text(size: 9pt)[#company.location]]
  )

  #v(0.2em)

  // Positions within company
  #for position in company.positions [
    #grid(
      columns: (1fr, auto),
      [#text(style: "italic", size: 10pt)[#position.title]],
      [#text(size: 9pt)[#format_date_range(position.date_start, position.date_end)]]
    )

    #v(0.2em)

    // Bullets for this position
    #for bullet in position.bullets [
      - #bullet.description
    ]

    #v(0.3em)
  ]

  #v(0.4em)
]

// ====================
// EDUCATION SECTION
// ====================

#if education != none [
  #text(size: 11pt, weight: "bold")[EDUCATION]
  #line(length: 100%, stroke: 0.5pt)
  #v(0.3em)

  #for edu in education [
    #grid(
      columns: (1fr, auto),
      [
        #text(weight: "bold")[#edu.institution]
        #h(1em)
        #text(style: "italic")[#edu.degree]
      ],
      [#text(size: 9pt)[#edu.year]]
    )

    #v(0.2em)
  ]

  #v(0.4em)
]

// ====================
// SKILLS SECTION
// ====================

#if skills != none [
  #text(size: 11pt, weight: "bold")[SKILLS]
  #line(length: 100%, stroke: 0.5pt)
  #v(0.3em)

  #for (category, skill_list) in skills [
    *#category:* #skill_list.join(", ")

    #v(0.2em)
  ]
]

// ====================
// DEV MODE METADATA
// ====================

#if metadata != none [
  #pagebreak()

  #align(center)[
    #text(size: 14pt, weight: "bold", fill: red)[DEV MODE BUILD INFO]
  ]

  #v(0.5em)

  #table(
    columns: (auto, 1fr),
    [*Build Time:*], [#metadata.build_time],
    [*Git Hash:*], [#metadata.git_hash],
    [*Role Profile:*], [#metadata.role_profile],
  )
]
```

**Key Features:**
- Automatic text flow and page breaks
- Professional typography (font, spacing, alignment)
- Date formatting helper function (implemented in Rust)
- Conditional sections (only show if data present)
- Dev mode metadata page
- ATS-friendly plain text bullets

#### 2.2: Helper Functions

**File:** `doc-gen/crates/typst/src/template.rs`

```rust
use chrono::NaiveDate;
use docgen_core::{GenerationPayload, PersonalInfo, Company, Position};

/// Format a date range for display in resume
/// Examples:
///   - "2020-01" → "Jan 2020"
///   - ("2020-01", "2022-12") → "Jan 2020 - Dec 2022"
///   - ("2020-01", None) → "Jan 2020 - Present"
pub fn format_date_range(start: Option<&str>, end: Option<&str>) -> String {
    match (start, end) {
        (Some(s), Some(e)) if e.is_empty() || e.eq_ignore_ascii_case("present") => {
            format!("{} - Present", format_month_year(s))
        }
        (Some(s), Some(e)) => {
            format!("{} - {}", format_month_year(s), format_month_year(e))
        }
        (Some(s), None) => {
            format!("{} - Present", format_month_year(s))
        }
        _ => String::new(),
    }
}

fn format_month_year(date_str: &str) -> String {
    // Parse formats: "2020-01-15", "2020-01", "2020"
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        date.format("%b %Y").to_string()
    } else if let Ok(date) = NaiveDate::parse_from_str(&format!("{}-01", date_str), "%Y-%m-%d") {
        date.format("%b %Y").to_string()
    } else {
        date_str.to_string() // Fallback: return as-is
    }
}

/// Prepare data for Typst template injection
/// Groups bullets by company and position for hierarchical rendering
pub fn prepare_template_data(payload: &GenerationPayload) -> serde_json::Value {
    // Group selected bullets by company → position
    let mut companies_map: std::collections::HashMap<String, CompanyData> =
        std::collections::HashMap::new();

    for scored_bullet in &payload.selected_bullets {
        let company_id = &scored_bullet.company_id;
        let position_id = &scored_bullet.position_id;

        let company_data = companies_map.entry(company_id.clone())
            .or_insert_with(|| CompanyData {
                name: scored_bullet.company_name.clone().unwrap_or_default(),
                location: String::new(), // Will be filled from ResumeData if needed
                positions: std::collections::HashMap::new(),
            });

        let position_data = company_data.positions.entry(position_id.clone())
            .or_insert_with(|| PositionData {
                title: scored_bullet.position_name.clone(),
                date_start: None,
                date_end: None,
                bullets: Vec::new(),
            });

        position_data.bullets.push(scored_bullet.bullet.description.clone());
    }

    // Convert to sorted vector (by company priority, then position dates)
    let companies_vec: Vec<_> = companies_map.into_iter()
        .map(|(_, company_data)| {
            let positions_vec: Vec<_> = company_data.positions.into_iter()
                .map(|(_, pos_data)| serde_json::json!({
                    "title": pos_data.title,
                    "date_start": pos_data.date_start,
                    "date_end": pos_data.date_end,
                    "bullets": pos_data.bullets,
                }))
                .collect();

            serde_json::json!({
                "name": company_data.name,
                "location": company_data.location,
                "positions": positions_vec,
            })
        })
        .collect();

    // Build final data structure for template
    serde_json::json!({
        "personal": {
            "name": payload.personal.name,
            "email": payload.personal.email,
            "phone": payload.personal.phone,
            "location": payload.personal.location,
            "linkedin": payload.personal.linkedin,
            "github": payload.personal.github,
        },
        "summary": payload.summary,
        "companies": companies_vec,
        "education": payload.education,
        "skills": payload.skills,
        "role_profile": {
            "name": payload.role_profile.name,
            "description": payload.role_profile.description,
        },
    })
}

struct CompanyData {
    name: String,
    location: String,
    positions: std::collections::HashMap<String, PositionData>,
}

struct PositionData {
    title: String,
    date_start: Option<String>,
    date_end: Option<String>,
    bullets: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_date_range() {
        assert_eq!(format_month_year("2020-01-15"), "Jan 2020");
        assert_eq!(format_month_year("2020-01"), "Jan 2020");
        assert_eq!(format_date_range(Some("2020-01"), Some("2022-12")), "Jan 2020 - Dec 2022");
        assert_eq!(format_date_range(Some("2020-01"), None), "Jan 2020 - Present");
        assert_eq!(format_date_range(Some("2020-01"), Some("present")), "Jan 2020 - Present");
    }
}
```

### Phase 3: Rust Typst Integration (3-4 hours)

#### 3.1: Typst Compiler Wrapper

**File:** `doc-gen/crates/typst/src/compiler.rs`

```rust
use comemo::Prehashed;
use ecow::EcoString;
use std::path::PathBuf;
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime, Smart};
use typst::syntax::{FileId, Source};
use typst::text::{Font, FontBook};
use typst::{Library, World};

/// Typst world implementation for resume compilation
pub struct ResumeWorld {
    /// The main resume template source
    main: Source,
    /// The standard library
    library: Prehashed<Library>,
    /// The font book for font selection
    book: Prehashed<FontBook>,
    /// Available fonts
    fonts: Vec<Font>,
}

impl ResumeWorld {
    /// Create a new world for resume compilation
    pub fn new(template: String) -> Result<Self, String> {
        // Load fonts (embedded or system fonts)
        let fonts = Self::load_fonts()?;
        let book = Prehashed::new(FontBook::from_fonts(&fonts));

        // Create source from template
        let source = Source::new(FileId::new(None, "resume.typ"), template);

        Ok(Self {
            main: source,
            library: Prehashed::new(typst::Library::default()),
            book,
            fonts,
        })
    }

    /// Load system or embedded fonts
    fn load_fonts() -> Result<Vec<Font>, String> {
        // For WASM, we'll embed specific fonts
        // For native, we can use system fonts
        let mut fonts = Vec::new();

        // Load Linux Libertine (embedded in binary)
        fonts.extend(
            Font::iter(Bytes::from_static(include_bytes!("../fonts/LinLibertine_R.ttf")))
                .map_err(|e| format!("Failed to load font: {}", e))?
        );

        // Add more fonts as needed
        // fonts.extend(Font::iter(Bytes::from_static(include_bytes!("../fonts/...))));

        Ok(fonts)
    }
}

impl World for ResumeWorld {
    fn library(&self) -> &Prehashed<Library> {
        &self.library
    }

    fn book(&self) -> &Prehashed<FontBook> {
        &self.book
    }

    fn main(&self) -> Source {
        self.main.clone()
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.main.id() {
            Ok(self.main.clone())
        } else {
            Err(FileError::NotFound(id.vpath().as_rootless_path().to_path_buf()))
        }
    }

    fn file(&self, _id: FileId) -> FileResult<Bytes> {
        Err(FileError::NotFound(PathBuf::from("external files not supported")))
    }

    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.get(index).cloned()
    }

    fn today(&self, _offset: Option<i64>) -> Option<Datetime> {
        Some(Datetime::from_ymd(2025, 1, 1).unwrap()) // Or use chrono for actual date
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_world() {
        let template = r#"#set document(title: "Test")"#.to_string();
        let world = ResumeWorld::new(template);
        assert!(world.is_ok());
    }
}
```

#### 3.2: Main Library Interface

**File:** `doc-gen/crates/typst/src/lib.rs`

```rust
//! Typst-based PDF generation for Resumate
//!
//! This crate provides a high-level interface for generating resumes using Typst,
//! a modern typesetting system. It handles template loading, data injection,
//! and compilation to PDF.

mod compiler;
mod template;
mod fonts;

use docgen_core::GenerationPayload;
use thiserror::Error;

pub use compiler::ResumeWorld;
pub use template::{format_date_range, prepare_template_data};

/// Errors that can occur during Typst PDF generation
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

/// Generate a PDF resume from the given payload using Typst
///
/// # Arguments
/// * `payload` - The generation payload containing resume data
/// * `dev_mode` - If true, includes build info and metadata in PDF
///
/// # Returns
/// * `Ok(Vec<u8>)` - PDF binary data
/// * `Err(TypstError)` - Error during generation
///
/// # Example
/// ```
/// use docgen_typst::render_resume;
/// use docgen_core::GenerationPayload;
///
/// let payload = GenerationPayload { /* ... */ };
/// let pdf_bytes = render_resume(&payload, false)?;
/// ```
pub fn render_resume(
    payload: &GenerationPayload,
    dev_mode: bool,
) -> Result<Vec<u8>, TypstError> {
    // 1. Prepare data for template
    let mut template_data = prepare_template_data(payload);

    // 2. Add dev mode metadata if enabled
    if dev_mode {
        template_data["metadata"] = serde_json::json!({
            "build_time": chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            "git_hash": env!("BUILD_GIT_HASH"),
            "role_profile": payload.role_profile.name,
        });
    }

    // 3. Load template and inject data
    let template_source = include_str!("../templates/resume.typ");
    let rendered_template = inject_template_data(template_source, &template_data)?;

    // 4. Create Typst world
    let world = ResumeWorld::new(rendered_template)
        .map_err(|e| TypstError::CompilationError(e))?;

    // 5. Compile to document
    let document = typst::compile(&world)
        .map_err(|errors| {
            let error_msgs: Vec<_> = errors.iter()
                .map(|e| format!("{:?}", e))
                .collect();
            TypstError::CompilationError(error_msgs.join("; "))
        })?;

    // 6. Export to PDF
    let pdf_bytes = typst_pdf::pdf(&document, Smart::Auto, None)
        .map_err(|e| TypstError::ExportError(format!("{:?}", e)))?;

    Ok(pdf_bytes)
}

/// Inject JSON data into Typst template
fn inject_template_data(
    template: &str,
    data: &serde_json::Value,
) -> Result<String, TypstError> {
    // Typst uses its own syntax for data injection
    // We'll use a simple approach: convert JSON to Typst data structures

    // For now, use string replacement (can be improved with proper Typst data injection)
    let mut result = template.to_string();

    // TODO: Implement proper Typst data injection
    // This is a simplified version - in practice, you'd use Typst's data loading features

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Add comprehensive tests here
}
```

**Note:** The actual data injection mechanism needs refinement based on Typst's capabilities. Research Typst's JSON/data loading features for the most elegant solution.

### Phase 4: Update WASM Bindings (1-2 hours)

#### 4.1: Update WASM Cargo.toml

**File:** `doc-gen/crates/wasm/Cargo.toml`

```toml
[package]
name = "docgen-wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { workspace = true }
serde_json = { workspace = true }
console_error_panic_hook = "0.1"

# Local crates
docgen-core = { path = "../core" }
docgen-typst = { path = "../typst" }  # NEW: Replace docgen-pdf

# REMOVE: docgen-pdf, docgen-docx

[build-dependencies]
chrono = "0.4"
```

#### 4.2: Update WASM Bindings

**File:** `doc-gen/crates/wasm/src/lib.rs`

```rust
//! WebAssembly bindings for Resumate document generation
//!
//! This crate provides JavaScript-compatible exports for PDF generation
//! using Typst compiled to WebAssembly.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Get WASM module version
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get build timestamp (when WASM was compiled)
#[wasm_bindgen]
pub fn build_info() -> String {
    format!(
        "Built: {} ({})",
        env!("BUILD_TIMESTAMP"),
        env!("BUILD_GIT_HASH")
    )
}

/// Generate PDF using Typst from GenerationPayload JSON
///
/// # Arguments
/// * `payload_json` - JSON string containing GenerationPayload
/// * `dev_mode` - If true, adds build info to PDF metadata
///
/// # Returns
/// * `Result<Vec<u8>, JsValue>` - PDF bytes or error
///
/// # Example (JavaScript)
/// ```js
/// import init, { generate_pdf_typst } from './wasm/docgen_wasm.js';
/// await init();
///
/// const payloadJson = JSON.stringify({
///   personal: { name: "John Doe", ... },
///   selectedBullets: [...],
///   roleProfile: {...},
/// });
///
/// const isDev = window.location.hostname === 'localhost';
/// const pdfBytes = generate_pdf_typst(payloadJson, isDev);
/// ```
#[wasm_bindgen]
pub fn generate_pdf_typst(payload_json: &str, dev_mode: bool) -> Result<Vec<u8>, JsValue> {
    // Parse JSON payload
    let payload: docgen_typst::GenerationPayload = serde_json::from_str(payload_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON payload: {}", e)))?;

    // Validate payload (reuse existing validation)
    validate_payload(&payload)?;

    // Generate PDF using Typst
    let pdf_bytes = docgen_typst::render_resume(&payload, dev_mode)
        .map_err(|e| JsValue::from_str(&format!("Typst PDF generation failed: {}", e)))?;

    Ok(pdf_bytes)
}

/// Validate GenerationPayload before generation
fn validate_payload(payload: &docgen_core::GenerationPayload) -> Result<(), JsValue> {
    // Reuse existing validation logic from current wasm/src/lib.rs
    // Check personal info, role profile, bullets count, etc.

    if payload.personal.name.trim().is_empty() {
        return Err(JsValue::from_str("Personal name is required"));
    }

    if payload.role_profile.id.trim().is_empty() {
        return Err(JsValue::from_str("Role profile ID is required"));
    }

    if payload.selected_bullets.len() > 50 {
        return Err(JsValue::from_str(&format!(
            "Too many bullets ({}), maximum is 50",
            payload.selected_bullets.len()
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Add tests for WASM bindings
}
```

### Phase 5: Update Build Script (30 min)

#### 5.1: Update build-wasm.sh

**File:** `doc-gen/build-wasm.sh`

**Changes:**
- No changes needed! The script already builds the wasm crate
- The wasm crate now depends on typst instead of pdf, so it will automatically compile Typst to WASM

**Verify:**
```bash
cd doc-gen
./build-wasm.sh
# Should output to: ../public/wasm/docgen_wasm_bg.wasm
# Size will be larger (~2-5MB vs previous ~220KB)
```

### Phase 6: Frontend Integration (1-2 hours)

#### 6.1: Update React Component

**File:** `components/data/ResumeDownload.tsx`

**Changes:**

```typescript
// Change function name from generate_pdf to generate_pdf_typst
const pdfBytes = window.__generatePdfTypst!(JSON.stringify(payload), isDevMode)

// Update loading message
setStatus('generating')
setStatusMessage('Generating resume with Typst...')

// Update window interface
declare global {
  interface Window {
    __wasmReady?: boolean
    __generatePdfTypst?: (payload: string, devMode: boolean) => Uint8Array
  }
}

// Update WASM module import
script.textContent = `
  import init, { generate_pdf_typst } from '/wasm/docgen_wasm.js?v=${cacheBust}';
  await init('/wasm/docgen_wasm_bg.wasm?v=${cacheBust}');

  console.log('✅ Typst WASM loaded successfully');

  window.__wasmReady = true;
  window.__generatePdfTypst = generate_pdf_typst;
`
```

#### 6.2: Update Loading Messages

Show more informative messages during Typst compilation:

```typescript
const statusMessages = {
  verifying: 'Verifying with Cloudflare Turnstile...',
  loading_wasm: 'Loading Typst compiler (~2MB, cached after first load)...',
  generating: 'Compiling your resume with Typst...',
  error: errorMessage || 'An error occurred'
}
```

### Phase 7: Font Management (1-2 hours)

#### 7.1: Download Fonts

**Fonts to include (for professional resume):**
- Linux Libertine (serif, body text)
- Linux Biolinum (sans-serif, headings)
- DejaVu Sans Mono (monospace, optional)

**Directory:**
```
doc-gen/crates/typst/fonts/
├── LinLibertine_R.ttf       # Regular
├── LinLibertine_RB.ttf      # Bold
├── LinLibertine_RI.ttf      # Italic
├── LinBiolinum_R.ttf        # Sans regular
└── LinBiolinum_RB.ttf       # Sans bold
```

**Download from:**
- https://www.linuxlibertine.org/

#### 7.2: Embed Fonts in Binary

**File:** `doc-gen/crates/typst/src/fonts.rs`

```rust
//! Font management for Typst compilation
//!
//! Embeds necessary fonts directly in the WASM binary for consistent rendering

use typst::text::Font;
use typst::foundations::Bytes;

/// Load all embedded fonts
pub fn load_embedded_fonts() -> Result<Vec<Font>, String> {
    let mut fonts = Vec::new();

    // Linux Libertine (Serif)
    fonts.extend(
        Font::iter(Bytes::from_static(include_bytes!("../fonts/LinLibertine_R.ttf")))
            .map_err(|e| format!("Failed to load LinLibertine Regular: {}", e))?
    );

    fonts.extend(
        Font::iter(Bytes::from_static(include_bytes!("../fonts/LinLibertine_RB.ttf")))
            .map_err(|e| format!("Failed to load LinLibertine Bold: {}", e))?
    );

    fonts.extend(
        Font::iter(Bytes::from_static(include_bytes!("../fonts/LinLibertine_RI.ttf")))
            .map_err(|e| format!("Failed to load LinLibertine Italic: {}", e))?
    );

    // Linux Biolinum (Sans-serif)
    fonts.extend(
        Font::iter(Bytes::from_static(include_bytes!("../fonts/LinBiolinum_R.ttf")))
            .map_err(|e| format!("Failed to load LinBiolinum Regular: {}", e))?
    );

    fonts.extend(
        Font::iter(Bytes::from_static(include_bytes!("../fonts/LinBiolinum_RB.ttf")))
            .map_err(|e| format!("Failed to load LinBiolinum Bold: {}", e))?
    );

    Ok(fonts)
}
```

**Note:** This will increase WASM size by ~500KB-1MB for font data, but ensures consistent rendering across all devices.

---

## Testing Strategy

### Phase 8: Testing (2-3 hours)

#### 8.1: Rust Unit Tests

**File:** `doc-gen/crates/typst/src/lib.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use docgen_core::{PersonalInfo, RoleProfile, ScoringWeights, GenerationPayload};

    fn create_test_payload() -> GenerationPayload {
        GenerationPayload {
            personal: PersonalInfo {
                name: "Test Person".to_string(),
                full_name: "Test Full Person".to_string(),
                nickname: None,
                email: Some("test@example.com".to_string()),
                phone: Some("+1234567890".to_string()),
                location: Some("Test City".to_string()),
                linkedin: None,
                github: None,
                website: None,
            },
            selected_bullets: vec![
                // Add test bullets
            ],
            role_profile: RoleProfile {
                id: "test-role".to_string(),
                name: "Test Role".to_string(),
                description: Some("Test role description".to_string()),
                tag_weights: std::collections::HashMap::new(),
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: None,
            summary: Some("Test summary".to_string()),
            metadata: None,
        }
    }

    #[test]
    fn test_render_resume_basic() {
        let payload = create_test_payload();
        let result = render_resume(&payload, false);
        assert!(result.is_ok());

        let pdf_bytes = result.unwrap();
        assert!(!pdf_bytes.is_empty());

        // Check PDF header
        assert_eq!(&pdf_bytes[0..4], b"%PDF");
    }

    #[test]
    fn test_render_resume_with_dev_mode() {
        let payload = create_test_payload();
        let result = render_resume(&payload, true);
        assert!(result.is_ok());

        let pdf_bytes = result.unwrap();
        assert!(!pdf_bytes.is_empty());

        // Dev mode PDF should include metadata
        // (Could check for metadata page or size difference)
    }

    #[test]
    fn test_template_data_preparation() {
        let payload = create_test_payload();
        let data = prepare_template_data(&payload);

        assert!(data["personal"].is_object());
        assert_eq!(data["personal"]["name"], "Test Person");
    }
}
```

#### 8.2: Integration Tests

**File:** `doc-gen/crates/typst/tests/integration_test.rs`

```rust
use docgen_typst::render_resume;
use docgen_core::GenerationPayload;
use std::fs;

#[test]
fn test_generate_all_role_profiles() {
    // Load actual resume data
    let resume_data_json = fs::read_to_string("../../data/resume-data.json")
        .expect("Failed to read resume data");

    let resume_data: serde_json::Value = serde_json::from_str(&resume_data_json)
        .expect("Failed to parse resume data");

    let role_profiles = resume_data["roleProfiles"].as_array()
        .expect("No role profiles found");

    for role_profile in role_profiles {
        let role_name = role_profile["name"].as_str().unwrap();
        println!("Testing role profile: {}", role_name);

        // Create payload (simplified - in practice would use selection logic)
        let payload = create_payload_for_role(&resume_data, role_profile);

        // Generate PDF
        let result = render_resume(&payload, false);
        assert!(result.is_ok(), "Failed to generate PDF for role: {}", role_name);

        let pdf_bytes = result.unwrap();
        assert!(pdf_bytes.len() > 5000, "PDF too small for role: {}", role_name);

        // Optionally save for manual inspection
        fs::write(
            format!("../../test-outputs/typst-{}.pdf", role_name.to_lowercase().replace(' ', '-')),
            &pdf_bytes
        ).ok();
    }
}

fn create_payload_for_role(
    resume_data: &serde_json::Value,
    role_profile: &serde_json::Value
) -> GenerationPayload {
    // TODO: Implement proper bullet selection
    // For now, return a test payload
    unimplemented!("Create proper payload from resume data")
}
```

#### 8.3: WASM Tests

**File:** `doc-gen/crates/wasm/tests/wasm_test.rs`

```rust
#[cfg(target_arch = "wasm32")]
#[cfg(test)]
mod wasm_tests {
    use wasm_bindgen_test::*;
    use docgen_wasm::{generate_pdf_typst, version};

    #[wasm_bindgen_test]
    fn test_version() {
        let v = version();
        assert!(!v.is_empty());
    }

    #[wasm_bindgen_test]
    fn test_generate_pdf_typst_valid_payload() {
        let payload_json = r#"{
            "personal": {
                "name": "Test Person",
                "fullName": "Test Full Person",
                "email": "test@example.com",
                "phone": "+1234567890",
                "location": "Test City"
            },
            "selectedBullets": [],
            "roleProfile": {
                "id": "test-role",
                "name": "Test Role",
                "description": "Test description",
                "tagWeights": {},
                "scoringWeights": {
                    "tagRelevance": 0.6,
                    "priority": 0.4
                }
            },
            "education": null,
            "skills": null,
            "summary": "Test summary",
            "metadata": null
        }"#;

        let result = generate_pdf_typst(payload_json, false);
        assert!(result.is_ok());

        let pdf_bytes = result.unwrap();
        assert!(!pdf_bytes.is_empty());
    }
}
```

**Run WASM tests:**
```bash
cd doc-gen/crates/wasm
wasm-pack test --firefox --headless
```

#### 8.4: Manual Testing Checklist

**Browser Testing:**
- [ ] Load http://localhost:3001/resume
- [ ] Select role profile
- [ ] Click "Generate Resume"
- [ ] Verify Typst WASM loads (~2MB download first time)
- [ ] Verify PDF generates successfully
- [ ] Download PDF and open in viewer
- [ ] Check PDF quality:
  - [ ] Professional typography
  - [ ] Proper page breaks
  - [ ] Correct bullet formatting (hyphens)
  - [ ] All sections present
  - [ ] No text overflow
  - [ ] Metadata correct (Author, Title, Subject)
- [ ] Test dev mode (localhost):
  - [ ] Build info in metadata
- [ ] Test multiple role profiles
- [ ] Check WASM caching (second load should be instant)

**Performance Testing:**
- [ ] Measure WASM load time (first visit)
- [ ] Measure PDF generation time
- [ ] Compare to previous pdf-writer approach
- [ ] Verify browser memory usage acceptable

---

## Migration Checklist

### Pre-Migration

- [x] Research Typst and alternatives
- [x] Create comprehensive specification (this document)
- [ ] Review specification with team
- [ ] Backup current working state
- [ ] Create migration branch

### Implementation

#### Phase 1: Crate Structure
- [ ] Remove `doc-gen/crates/pdf/`
- [ ] Remove `doc-gen/crates/docx/`
- [ ] Create `doc-gen/crates/typst/`
- [ ] Update `doc-gen/Cargo.toml` workspace
- [ ] Create `doc-gen/crates/typst/Cargo.toml`

#### Phase 2: Typst Template
- [ ] Create `doc-gen/crates/typst/templates/resume.typ`
- [ ] Implement `doc-gen/crates/typst/src/template.rs`
- [ ] Add date formatting helpers
- [ ] Test template with sample data

#### Phase 3: Rust Integration
- [ ] Implement `doc-gen/crates/typst/src/compiler.rs`
- [ ] Implement `doc-gen/crates/typst/src/lib.rs`
- [ ] Download and add fonts to `doc-gen/crates/typst/fonts/`
- [ ] Implement `doc-gen/crates/typst/src/fonts.rs`
- [ ] Write Rust unit tests

#### Phase 4: WASM Bindings
- [ ] Update `doc-gen/crates/wasm/Cargo.toml`
- [ ] Update `doc-gen/crates/wasm/src/lib.rs`
- [ ] Remove old pdf/docx function exports
- [ ] Add `generate_pdf_typst` export
- [ ] Write WASM tests

#### Phase 5: Build & Test
- [ ] Run `cargo test --all`
- [ ] Run `cargo clippy --all`
- [ ] Build WASM: `cd doc-gen && ./build-wasm.sh`
- [ ] Verify WASM size (~2-5MB)
- [ ] Run integration tests

#### Phase 6: Frontend
- [ ] Update `components/data/ResumeDownload.tsx`
- [ ] Change function name to `generate_pdf_typst`
- [ ] Update window interface types
- [ ] Update loading messages
- [ ] Test in browser (localhost:3001)

#### Phase 7: Documentation
- [ ] Mark `docs/PDF_RENDERING_SPEC.md` as deprecated
- [ ] Update `docs/ARCHITECTURE.md`
- [ ] Update `docs/PHASE_5_PLAN.md`
- [ ] Update `doc-gen/CLAUDE.md`
- [ ] Update `README.md` tech stack

### Post-Migration

- [ ] Generate PDFs for all role profiles
- [ ] Manual quality inspection
- [ ] Performance benchmarks
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Create pull request
- [ ] Code review
- [ ] Merge to main
- [ ] Deploy to Vercel
- [ ] Monitor production for issues

---

## Rollback Plan

### If Migration Fails

**Git Rollback:**
```bash
# If on migration branch
git checkout main
git branch -D typst-migration

# If already merged
git revert <merge-commit-hash>
```

**Phased Rollback:**
1. Keep Typst code but add feature flag
2. Revert frontend to use old function
3. Rebuild WASM without Typst
4. Test old code still works
5. Remove Typst crate later

### Backup Strategy

**Before starting:**
```bash
# Create backup branch
git checkout -b backup-before-typst-migration
git push origin backup-before-typst-migration

# Start migration
git checkout -b typst-migration
```

**During migration:**
- Commit frequently with descriptive messages
- Test at each phase before proceeding
- Don't delete old code until new code is proven

---

## Performance Expectations

### WASM Bundle Size

**Current (pdf-writer):**
- docgen_wasm_bg.wasm: ~220KB

**Expected (Typst):**
- docgen_wasm_bg.wasm: ~2-5MB (includes Typst compiler + fonts)

**Mitigation:**
- Cached after first load (localStorage or browser cache)
- Acceptable for modern web apps
- Can add loading screen with progress bar

### PDF Generation Speed

**Current (pdf-writer):**
- ~50-100ms

**Expected (Typst):**
- ~300-500ms (includes compilation + layout)

**Mitigation:**
- Still under 1 second (imperceptible to user)
- Show progress indicator
- Much faster than typical online generators

### First Load Experience

**Sequence:**
1. Load page (~500ms)
2. User selects role (~5s)
3. Clicks Generate (~instant)
4. WASM loads (~1-2s, first time only)
5. PDF generates (~500ms)
6. Total: ~2-3s first time, <1s subsequent times

**UX Improvements:**
- Show "Downloading Typst compiler..." message
- Progress bar for WASM load
- Cache WASM aggressively
- Preload WASM on page load (optional)

---

## Common Issues & Solutions

### Issue 1: WASM Build Fails

**Symptom:**
```
error: could not compile `docgen-typst` due to X previous errors
```

**Solutions:**
- Check all Typst dependencies are correct versions
- Ensure fonts are in correct location
- Verify Rust toolchain includes wasm32-unknown-unknown target
  ```bash
  rustup target add wasm32-unknown-unknown
  ```

### Issue 2: Fonts Not Loading

**Symptom:**
```
FontError: Failed to load font: ...
```

**Solutions:**
- Verify font files exist in `doc-gen/crates/typst/fonts/`
- Check `include_bytes!` paths are correct
- Ensure fonts are valid TTF/OTF files
- Try with fewer fonts to isolate issue

### Issue 3: Template Compilation Fails

**Symptom:**
```
CompilationError: syntax error at line X
```

**Solutions:**
- Validate Typst syntax in template
- Check all variables are defined
- Test template with minimal data first
- Use Typst CLI locally to debug template

### Issue 4: PDF Output Issues

**Symptom:**
- Text overflow
- Missing sections
- Incorrect layout

**Solutions:**
- Review Typst template spacing settings
- Check data injection is correct
- Compare to expected output
- Adjust template margins/spacing
- Test with different data volumes

### Issue 5: Browser WASM Loading Fails

**Symptom:**
```
Error: Failed to instantiate WebAssembly module
```

**Solutions:**
- Check WASM file is in public/wasm/
- Verify correct MIME type (application/wasm)
- Check browser console for CORS errors
- Ensure middleware excludes .wasm files
- Clear browser cache and retry

---

## Additional Resources

### Typst Documentation

- **Official Docs:** https://typst.app/docs/
- **Tutorial:** https://typst.app/docs/tutorial/
- **Reference:** https://typst.app/docs/reference/
- **GitHub:** https://github.com/typst/typst

### Rust WASM

- **wasm-bindgen Book:** https://rustwasm.github.io/wasm-bindgen/
- **wasm-pack Docs:** https://rustwasm.github.io/docs/wasm-pack/

### Examples

- **typst.ts:** https://github.com/Myriad-Dreamin/typst.ts (reference implementation)
- **Typst Examples:** https://typst.app/universe/ (community templates)

---

## Success Criteria

### Technical

- [ ] WASM builds successfully
- [ ] All tests pass (Rust + WASM + integration)
- [ ] PDF generates without errors
- [ ] Professional typography and layout
- [ ] Multi-page support works correctly
- [ ] Performance within acceptable range

### User Experience

- [ ] PDF quality meets or exceeds current version
- [ ] Generation time < 1 second
- [ ] Clear loading indicators
- [ ] Works in all major browsers
- [ ] Proper error messages
- [ ] Dev mode metadata visible (localhost only)

### Project

- [ ] Documentation updated
- [ ] Code review completed
- [ ] Deployed to production
- [ ] No regressions in other features
- [ ] Team trained on new system

---

## Timeline Estimate

**Total: 18-26 hours** (across multiple sessions)

- Phase 1: Setup & Dependencies (1-2 hours)
- Phase 2: Typst Template (2-3 hours)
- Phase 3: Rust Integration (3-4 hours)
- Phase 4: WASM Bindings (1-2 hours)
- Phase 5: Build & Debug (1-2 hours)
- Phase 6: Frontend Integration (1-2 hours)
- Phase 7: Font Management (1-2 hours)
- Phase 8: Testing (2-3 hours)
- Phase 9: Documentation Updates (1-2 hours)
- Phase 10: Deployment & Verification (1-2 hours)
- Buffer for unexpected issues (3-4 hours)

**Recommended Approach:**
- Session 1: Phases 1-2 (setup + template)
- Session 2: Phase 3 (Rust integration)
- Session 3: Phases 4-5 (WASM + build)
- Session 4: Phases 6-7 (frontend + fonts)
- Session 5: Phases 8-10 (testing + docs + deploy)

---

## Conclusion

This migration from pdf-writer to Typst represents a significant architectural improvement that:

1. **Solves Current Problems:** Eliminates manual layout issues, coordinate calculations, and page break logic
2. **Improves Maintainability:** Template-based design is much easier to iterate on
3. **Enhances Technical Showcase:** Running a full typesetting system in the browser demonstrates advanced WASM skills
4. **Provides Better UX:** Professional typography and automatic layout produce higher quality resumes

While the WASM bundle will be larger and generation slightly slower, these trade-offs are minimal compared to the benefits. The migration is well-scoped, testable, and reversible if needed.

**Next Step:** Begin implementation following the phase-by-phase plan outlined above.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-18
**AI Agent Ready:** ✅ Yes
**Reviewed By:** Ollie Gilbey
