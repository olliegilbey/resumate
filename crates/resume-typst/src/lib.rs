//! # resume-typst
//!
//! Typst-based PDF generation for Resumate.
//!
//! This crate provides professional PDF generation using the Typst typesetting system,
//! replacing the manual pdf-writer implementation with a template-based approach.
//!
//! # Example
//!
//! ```no_run
//! use resume_typst::render_resume;
//! use resume_core::GenerationPayload;
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

use resume_core::GenerationPayload;
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
/// use resume_typst::render_resume;
/// use resume_core::GenerationPayload;
///
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// let payload: GenerationPayload = serde_json::from_str("{...}")?;
/// let is_dev = cfg!(debug_assertions);
/// let pdf_bytes = render_resume(&payload, is_dev)?;
/// # Ok(())
/// # }
/// ```
pub fn render_resume(payload: &GenerationPayload, dev_mode: bool) -> Result<Vec<u8>, TypstError> {
    // 1. Prepare data for template
    let template_data = template::prepare_template_data(payload);

    // 2. Load template and inject data
    let template_source = include_str!("../../../typst/templates/resume.typ");
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
/// Generates professional ATS-optimized resume layout using Typst markup language.
/// The template is built dynamically from the payload data.
///
fn render_template(
    _template: &str,
    data: &serde_json::Value,
    dev_mode: bool,
) -> Result<String, TypstError> {
    let personal = &data["personal"];
    let empty_companies = vec![];
    let companies = data["companies"].as_array().unwrap_or(&empty_companies);

    let mut output = String::new();

    // ====================
    // DOCUMENT SETTINGS
    // ====================

    output.push_str("#set document(\n");
    output.push_str(&format!(
        "  title: \"Resume - {}\",\n",
        escape_typst_string(personal["name"].as_str().unwrap_or("Resume"))
    ));
    output.push_str(&format!(
        "  author: (\"{}\",),\n",
        escape_typst_string(personal["name"].as_str().unwrap_or(""))
    ));
    output.push_str(")\n\n");

    output.push_str("#set page(\n");
    output.push_str("  paper: \"us-letter\",\n");
    output.push_str("  margin: (top: 0.75in, bottom: 0.75in, x: 0.75in),\n");
    output.push_str("  numbering: none,\n");
    output.push_str(")\n\n");

    output.push_str("#set text(\n");
    output.push_str("  font: \"Liberation Serif\",\n");
    output.push_str("  size: 10pt,\n");
    output.push_str("  hyphenate: false,\n");
    output.push_str(")\n\n");

    output.push_str("#set par(\n");
    output.push_str("  leading: 0.55em,\n");
    output.push_str("  justify: false,\n");
    output.push_str("  first-line-indent: 0pt,\n");
    output.push_str(")\n\n");

    // Heading styles (section headers) - LARGER for better hierarchy
    output.push_str("#show heading.where(level: 1): set text(size: 12pt, weight: \"bold\")\n");
    output.push_str("#show heading.where(level: 1): set block(above: 1.2em, below: 0.6em)\n");
    output.push_str("#show heading.where(level: 2): set text(size: 10.5pt, weight: \"bold\")\n");
    output.push_str(
        "#show heading.where(level: 2): set block(above: 0.8em, below: 0.4em, breakable: false)\n",
    );
    output.push_str("#show heading.where(level: 3): set text(size: 10pt, weight: \"regular\", style: \"italic\")\n");
    output.push_str("#show heading.where(level: 3): set block(above: 0.5em, below: 0.3em)\n\n");

    // List styling (bullets)
    output.push_str("#set list(marker: [•], indent: 1em, body-indent: 0.5em, spacing: 0.4em)\n\n");

    // ====================
    // HEADER
    // ====================

    output.push_str("#align(center)[\n");

    // Name and role on same line
    let name = personal["name"].as_str().unwrap_or("");
    let role_name = data["role_profile"]["name"].as_str().unwrap_or("");

    if !role_name.is_empty() {
        output.push_str(&format!(
            "  #text(size: 20pt, weight: \"bold\")[{}] #h(0.5em) #text(size: 14pt, style: \"italic\")[– {}]\n",
            escape_typst_string(name),
            escape_typst_string(role_name)
        ));
    } else {
        output.push_str(&format!(
            "  #text(size: 20pt, weight: \"bold\")[{}]\n",
            escape_typst_string(name)
        ));
    }

    output.push_str("  #v(0.4em)\n");

    // Contact line with better spacing
    output.push_str("  #text(size: 10pt)[\n");
    let mut contact_parts = Vec::new();

    if let Some(email) = personal["email"].as_str() {
        if !email.is_empty() {
            let mailto_url = format!("mailto:{}", email);
            // Raw text (backticks) doesn't need escaping in Typst
            contact_parts.push(format!(
                "#link(\"{}\")[`{}`]",
                escape_typst_string(&mailto_url),
                email
            ));
        }
    }
    if let Some(phone) = personal["phone"].as_str() {
        if !phone.is_empty() {
            contact_parts.push(escape_typst_string(phone));
        }
    }
    if let Some(location) = personal["location"].as_str() {
        if !location.is_empty() {
            contact_parts.push(escape_typst_string(location));
        }
    }
    if let Some(website) = personal["website"].as_str() {
        if !website.is_empty() {
            let url = if website.starts_with("http://") || website.starts_with("https://") {
                website.to_string()
            } else {
                format!("https://{}", website)
            };
            contact_parts.push(format!(
                "#link(\"{}\")[{}]",
                escape_typst_string(&url),
                escape_typst_string(website)
            ));
        }
    }
    if let Some(linkedin) = personal["linkedin"].as_str() {
        if !linkedin.is_empty() {
            let url = format!("https://linkedin.com/in/{}", linkedin);
            contact_parts.push(format!(
                "#link(\"{}\")[linkedin.com/in/{}]",
                escape_typst_string(&url),
                escape_typst_string(linkedin)
            ));
        }
    }
    if let Some(github) = personal["github"].as_str() {
        if !github.is_empty() {
            let url = format!("https://github.com/{}", github);
            contact_parts.push(format!(
                "#link(\"{}\")[github.com/{}]",
                escape_typst_string(&url),
                escape_typst_string(github)
            ));
        }
    }

    if !contact_parts.is_empty() {
        output.push_str("    ");
        output.push_str(&contact_parts.join(" #h(0.6em)•#h(0.6em) ")); // Better spacing between items
        output.push('\n');
    }

    output.push_str("  ]\n");
    output.push_str("]\n\n");

    output.push_str("#v(0.5em)\n\n");

    // ====================
    // SUMMARY
    // ====================

    if let Some(summary) = data["summary"].as_str() {
        if !summary.is_empty() {
            output.push_str("= PROFESSIONAL SUMMARY\n\n");
            output.push_str(&escape_typst_string(summary));
            output.push_str("\n\n");
        }
    }

    // ====================
    // EXPERIENCE
    // ====================

    if !companies.is_empty() {
        output.push_str("= EXPERIENCE\n\n");

        for company in companies {
            let company_name = company["name"].as_str().unwrap_or("");
            let company_description = company["description"].as_str();
            let company_link = company["link"].as_str();
            let company_date_range = company["date_range"].as_str().unwrap_or("");
            let position_count = company["position_count"].as_u64().unwrap_or(0);

            if !company_name.is_empty() {
                // Company name - clickable if link available
                if let Some(link) = company_link {
                    if !link.is_empty() {
                        let url = if link.starts_with("http://") || link.starts_with("https://") {
                            link.to_string()
                        } else {
                            format!("https://{}", link)
                        };
                        output.push_str(&format!(
                            "== #link(\"{}\")[{}]",
                            escape_typst_string(&url),
                            escape_typst_string(company_name)
                        ));
                    } else {
                        output.push_str(&format!("== {}", escape_typst_string(company_name)));
                    }
                } else {
                    output.push_str(&format!("== {}", escape_typst_string(company_name)));
                }

                // Show date range if available
                if !company_date_range.is_empty() {
                    output.push_str(&format!(
                        " #h(1fr) _{}_",
                        escape_typst_string(company_date_range)
                    ));
                }
                output.push_str("\n\n");

                // Company description (context/industry) - Show if available
                if let Some(desc) = company_description {
                    if !desc.is_empty() {
                        output.push_str(&format!("_{}_\n\n", escape_typst_string(desc)));
                    }
                }
            }

            if let Some(positions) = company["positions"].as_array() {
                for position in positions {
                    let title = position["title"].as_str().unwrap_or("");
                    let date_range = position["date_range"].as_str().unwrap_or("");

                    if !title.is_empty() {
                        output.push_str(&format!("=== {}", escape_typst_string(title)));

                        // Only show position dates if company has multiple positions (avoid redundancy)
                        if position_count > 1 && !date_range.is_empty() {
                            output.push_str(&format!(
                                " #h(1fr) _{}_",
                                escape_typst_string(date_range)
                            ));
                        }
                        output.push_str("\n\n");
                    }

                    // Position description removed - company description is enough context

                    if let Some(bullets) = position["bullets"].as_array() {
                        for bullet in bullets {
                            if let Some(bullet_obj) = bullet.as_object() {
                                let description = bullet_obj
                                    .get("description")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");

                                if !description.is_empty() {
                                    output.push_str(&format!(
                                        "- {}\n",
                                        escape_typst_string(description)
                                    ));
                                }
                            }
                        }
                        output.push('\n');
                    }
                }
            }
        }
    }

    // ====================
    // EDUCATION
    // ====================

    if let Some(education) = data["education"].as_array() {
        if !education.is_empty() {
            output.push_str("= EDUCATION\n\n");

            for edu in education {
                let degree = edu["degree"].as_str().unwrap_or("");
                let institution = edu["institution"].as_str().unwrap_or("");
                let year = edu["year"].as_str().unwrap_or("");

                if !degree.is_empty() || !institution.is_empty() {
                    output.push_str(&format!("== {}", escape_typst_string(degree)));

                    if !year.is_empty() {
                        output.push_str(&format!(" #h(1fr) _{}_", escape_typst_string(year)));
                    }
                    output.push_str("\n\n");

                    if !institution.is_empty() {
                        output.push_str(&format!("_{}_\n\n", escape_typst_string(institution)));
                    }
                }
            }
        }
    }

    // ====================
    // SKILLS
    // ====================

    if let Some(skills) = data["skills"].as_object() {
        if !skills.is_empty() {
            output.push_str("= SKILLS\n\n");

            for (category, skill_list) in skills {
                if let Some(skills_array) = skill_list.as_array() {
                    if !skills_array.is_empty() {
                        // Capitalize category
                        let category_display = category
                            .split('-')
                            .map(|word| {
                                let mut chars = word.chars();
                                match chars.next() {
                                    None => String::new(),
                                    Some(first) => {
                                        first.to_uppercase().collect::<String>() + chars.as_str()
                                    }
                                }
                            })
                            .collect::<Vec<_>>()
                            .join(" ");

                        output.push_str(&format!("*{}:* ", escape_typst_string(&category_display)));

                        let skill_strings: Vec<String> = skills_array
                            .iter()
                            .filter_map(|s| s.as_str())
                            .map(escape_typst_string)
                            .collect();

                        output.push_str(&skill_strings.join(", "));
                        output.push_str("\n\n");
                    }
                }
            }
        }
    }

    // ====================
    // META FOOTER (dedicated page with formatting)
    // ====================

    if let Some(meta_footer) = data["metaFooter"].as_str() {
        if !meta_footer.is_empty() {
            // Get totals from database (not selected output)
            let total_bullets = data["totalBulletsAvailable"]
                .as_u64()
                .map(|n| n as usize)
                .unwrap_or(0);
            let total_companies = data["totalCompaniesAvailable"]
                .as_u64()
                .map(|n| n as usize)
                .unwrap_or(0);

            // Replace template variables in meta footer text
            let footer_text = meta_footer
                .replace("{bullet_count}", &total_bullets.to_string())
                .replace("{company_count}", &total_companies.to_string());

            // Format for ATS/AI readability: Break into logical sections with line breaks
            let formatted_footer = format_footer_for_ats(&footer_text);

            // Add footer on page 3 with heading
            output.push_str("\n\n#pagebreak(weak: true)\n\n");
            output.push_str("= ABOUT THIS RESUME\n\n");
            output.push_str(&escape_typst_string(&formatted_footer));
            output.push('\n');
        }
    }

    // ====================
    // DEV MODE METADATA
    // ====================

    if dev_mode {
        output.push_str("\n#pagebreak()\n\n");
        output.push_str("= BUILD METADATA (DEV MODE)\n\n");
        output.push_str(&format!(
            "*Build Time:* {}\n\n",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
        ));
        output.push_str(&format!(
            "*Typst Version:* {}\n\n",
            env!("CARGO_PKG_VERSION")
        ));

        if let Some(role_profile) = data["role_profile"].as_object() {
            if let Some(role_name) = role_profile["name"].as_str() {
                output.push_str(&format!(
                    "*Role Profile:* {}\n\n",
                    escape_typst_string(role_name)
                ));
            }
            if let Some(role_desc) = role_profile["description"].as_str() {
                output.push_str(&format!(
                    "*Description:* {}\n\n",
                    escape_typst_string(role_desc)
                ));
            }
        }

        output.push_str(&format!("*Companies:* {}\n\n", companies.len()));

        let total_bullets: usize = companies
            .iter()
            .filter_map(|c| c["positions"].as_array())
            .flat_map(|positions| positions.iter())
            .filter_map(|p| p["bullets"].as_array())
            .map(|bullets| bullets.len())
            .sum();

        output.push_str(&format!("*Total Bullets:* {}\n\n", total_bullets));
    }

    Ok(output)
}

/// Format meta footer text for optimal ATS/AI readability
///
/// Breaks long paragraph text into logical sections with line breaks between
/// key concepts to help automated systems parse the information clearly.
///
fn format_footer_for_ats(text: &str) -> String {
    // Break after key sentence endings to create logical paragraphs
    text.replace(
        ". A hierarchical scoring engine",
        ".\n\nA hierarchical scoring engine",
    )
    .replace(". The system is built", ".\n\nThe system is built")
    .replace(". Deployed on", ".\n\nDeployed on")
    .replace(". Explore the full", ".\n\nExplore the full")
}

/// Escape special characters for Typst strings
///
/// Typst has special meaning for certain characters:
/// - `#` starts a Typst expression
/// - `$` starts math mode
/// - `@` creates a reference
/// - `[` and `]` delimit content blocks
/// - `\` is the escape character
///
fn escape_typst_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('#', "\\#")
        .replace('$', "\\$")
        .replace('@', "\\@")
        .replace('[', "\\[")
        .replace(']', "\\]")
}

#[cfg(test)]
mod tests {
    use super::*;
    use resume_core::{PersonalInfo, RoleProfile, ScoringWeights};
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
            meta_footer: None,
            total_bullets_available: None,
            total_companies_available: None,
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
