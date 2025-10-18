//! # docgen-typst
//!
//! Typst-based PDF generation for Resumate.
//!
//! This crate provides professional PDF generation using the Typst typesetting system,
//! replacing the manual pdf-writer implementation with a template-based approach.
//!
//! # Example
//!
//! ```no_run
//! use docgen_typst::render_resume;
//! use docgen_pdf::GenerationPayload;
//!
//! # fn main() -> Result<(), Box<dyn std::error::Error>> {
//! let payload: GenerationPayload = serde_json::from_str("{...}")?;
//! let pdf_bytes = render_resume(&payload, false)?;
//! # Ok(())
//! # }
//! ```

// Allow dead code during migration - will be removed when complete
#![allow(dead_code)]

// Modules
pub mod compiler;
pub mod fonts;
pub mod template;

use docgen_pdf::GenerationPayload;
use thiserror::Error;

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

/// Generate a PDF resume using Typst
///
/// # Arguments
/// * `payload` - Generation payload containing resume data
/// * `dev_mode` - If true, includes build metadata in PDF
///
/// # Returns
/// * `Ok(Vec<u8>)` - PDF binary data
/// * `Err(TypstError)` - Error during generation
///
/// # Example
/// ```no_run
/// use docgen_typst::render_resume;
/// use docgen_pdf::GenerationPayload;
///
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// let payload: GenerationPayload = serde_json::from_str("{...}")?;
/// let is_dev = cfg!(debug_assertions);
/// let pdf_bytes = render_resume(&payload, is_dev)?;
/// # Ok(())
/// # }
/// ```
pub fn render_resume(
    payload: &GenerationPayload,
    dev_mode: bool,
) -> Result<Vec<u8>, TypstError> {
    // 1. Prepare data for template
    let template_data = template::prepare_template_data(payload);

    // 2. Load template and inject data
    let template_source = include_str!("../templates/resume.typ");
    let rendered_template = render_template(template_source, &template_data, dev_mode)?;

    // 3. Create Typst World
    let world = compiler::ResumeWorld::new(rendered_template)?;

    // 4. Compile to document
    let document = world.compile()?;

    // 5. Export to PDF
    let pdf_options = typst_pdf::PdfOptions::default();
    let pdf_bytes = typst_pdf::pdf(&document, &pdf_options)
        .map_err(|e| TypstError::ExportError(format!("{:?}", e)))?;

    Ok(pdf_bytes)
}

/// Render Typst template with data injection
///
/// For now, this is a simplified implementation that will evolve.
/// In Phase 3.4, we'll implement proper data injection.
///
fn render_template(
    _template: &str,
    data: &serde_json::Value,
    _dev_mode: bool,
) -> Result<String, TypstError> {
    // Simplified template for initial testing
    // Full template rendering will be implemented in Phase 3.4

    let personal = &data["personal"];
    let empty_companies = vec![];
    let companies = data["companies"].as_array().unwrap_or(&empty_companies);

    let mut output = String::new();

    // Document settings
    output.push_str("#set document(\n");
    output.push_str(&format!("  title: \"Resume - {}\",\n", personal["name"].as_str().unwrap_or("Unknown")));
    output.push_str(&format!("  author: (\"{}\",),\n", personal["name"].as_str().unwrap_or("Unknown")));
    output.push_str(")\n\n");

    output.push_str("#set page(\n");
    output.push_str("  paper: \"us-letter\",\n");
    output.push_str("  margin: (top: 0.75in, bottom: 0.75in, x: 0.75in),\n");
    output.push_str(")\n\n");

    output.push_str("#set text(\n");
    output.push_str("  font: \"Liberation Serif\",\n");
    output.push_str("  size: 10pt,\n");
    output.push_str(")\n\n");

    // Header
    output.push_str("#align(center)[\n");
    output.push_str(&format!("  #text(size: 18pt, weight: \"bold\")[{}]\n", personal["name"].as_str().unwrap_or("Unknown")));
    output.push_str("\n  #v(0.3em)\n\n");
    output.push_str("  #text(size: 9pt)[\n");
    // Use raw text for email to avoid Typst auto-link/label interpretation
    if let Some(email) = personal["email"].as_str() {
        if !email.is_empty() {
            output.push_str(&format!("    `{}`", email));
        }
    }
    if let Some(phone) = personal["phone"].as_str() {
        output.push_str(&format!(" • {}", phone));
    }
    if let Some(location) = personal["location"].as_str() {
        output.push_str(&format!(" • {}", location));
    }
    output.push_str("\n  ]\n");
    output.push_str("]\n\n");

    output.push_str("#v(0.8em)\n\n");

    // Summary
    if let Some(summary) = data["summary"].as_str() {
        output.push_str("= SUMMARY\n\n");
        output.push_str(summary);
        output.push_str("\n\n");
    }

    // Experience
    if !companies.is_empty() {
        output.push_str("= EXPERIENCE\n\n");

        for company in companies {
            let company_name = company["name"].as_str().unwrap_or("Unknown Company");
            let company_location = company["location"].as_str().unwrap_or("");

            output.push_str(&format!("== {}\n", company_name));
            if !company_location.is_empty() {
                output.push_str(&format!("_{}_\n\n", company_location));
            } else {
                output.push('\n');
            }

            if let Some(positions) = company["positions"].as_array() {
                for position in positions {
                    let title = position["title"].as_str().unwrap_or("Unknown Position");
                    let date_range = position["date_range"].as_str().unwrap_or("");

                    output.push_str(&format!("=== {} #h(1fr) _{}_\n\n", title, date_range));

                    if let Some(bullets) = position["bullets"].as_array() {
                        for bullet in bullets {
                            if let Some(bullet_str) = bullet.as_str() {
                                output.push_str(&format!("- {}\n", bullet_str));
                            }
                        }
                    }
                    output.push('\n');
                }
            }
        }
    }

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use docgen_core::{PersonalInfo, RoleProfile, ScoringWeights};
    use std::collections::HashMap;

    fn create_minimal_payload() -> GenerationPayload {
        GenerationPayload {
            personal: PersonalInfo {
                name: "Test Person".to_string(),
                nickname: None,
                tagline: None,
                email: Some("test@example.com".to_string()),
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                website: None,
                twitter: None,
            },
            selected_bullets: vec![],
            role_profile: RoleProfile {
                id: "test-role".to_string(),
                name: "Test Role".to_string(),
                description: None,
                tag_weights: HashMap::new(),
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
    fn test_render_resume_minimal() {
        let payload = create_minimal_payload();
        let result = render_resume(&payload, false);

        if let Err(e) = &result {
            eprintln!("Error: {:?}", e);
        }
        assert!(result.is_ok(), "Should render minimal payload");

        let pdf_bytes = result.unwrap();
        assert!(!pdf_bytes.is_empty(), "PDF should not be empty");

        // Check PDF header
        assert_eq!(&pdf_bytes[0..4], b"%PDF", "Should be valid PDF");
    }

    #[test]
    fn test_render_resume_with_dev_mode() {
        let payload = create_minimal_payload();
        let result = render_resume(&payload, true);

        if let Err(e) = &result {
            eprintln!("Error: {:?}", e);
        }
        assert!(result.is_ok(), "Should render with dev mode");

        let pdf_bytes = result.unwrap();
        assert!(!pdf_bytes.is_empty());
        assert_eq!(&pdf_bytes[0..4], b"%PDF");
    }
}

