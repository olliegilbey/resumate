// Resume Template for Resumate
// Professional ATS-optimized resume template using Typst
//
// This template will receive data injected from Rust via JSON
// The data structure matches GenerationPayload from resume-core

// ====================
// DOCUMENT SETTINGS
// ====================

#set document(
  title: "Resume",
  author: ("Resume Author",),
)

#set page(
  paper: "us-letter",
  margin: (top: 0.75in, bottom: 0.75in, x: 0.75in),
  numbering: none,  // No page numbers for single-page resumes
)

#set text(
  font: "Liberation Serif",  // Fallback: Typst built-in serif font
  size: 10pt,
  hyphenate: false,  // Disable hyphenation for ATS compatibility
)

#set par(
  leading: 0.55em,
  justify: false,
  first-line-indent: 0pt,
)

// ====================
// HELPER FUNCTIONS
// ====================

// Format date range (will be called from Rust)
#let format-date-range(start, end) = {
  if end == none or end == "" or end == "present" [
    #start -- Present
  ] else [
    #start -- #end
  ]
}

// ====================
// TEMPLATE CONTENT
// ====================

// This is a placeholder template.
// The actual content will be injected via Rust string interpolation
// in the render_resume() function.

// For now, this shows the structure we'll use:

= Resume Template

This is a placeholder template that will be populated with data from Rust.

The final template will include:
- Header with contact information
- Professional summary
- Experience section (company → position → bullets hierarchy)
- Education section
- Skills section
- Optional dev mode metadata

_Template to be completed in Phase 3 (Rust Integration)_
