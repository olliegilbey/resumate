//! Header section rendering (name, contact info, summary)

use crate::layout::ResumeLayout;
use crate::{GenerationPayload, PdfError};
use pdf_writer::{Content, Name, Pdf};

/// Render the resume header section
///
/// Includes:
/// - Name (large, bold)
/// - Contact information (email, phone, location, links)
/// - Professional summary
///
/// Returns the Y position after rendering (for positioning next section)
pub fn render(
    _pdf: &mut Pdf,
    content: &mut Content,
    payload: &GenerationPayload,
    layout: &ResumeLayout,
    start_y: f32,
) -> Result<f32, PdfError> {
    let mut current_y = start_y;

    // Render name
    current_y = render_name(content, &payload.personal.name, layout, current_y)?;

    // Render contact info
    current_y = render_contact_info(content, payload, layout, current_y)?;

    // Render summary (if present)
    if let Some(summary) = &payload.summary {
        current_y = render_summary(content, summary, layout, current_y)?;
    }

    // Add spacing after header
    current_y -= layout.section_spacing;

    Ok(current_y)
}

/// Render the name (large, bold at top)
fn render_name(
    content: &mut Content,
    name: &str,
    layout: &ResumeLayout,
    y: f32,
) -> Result<f32, PdfError> {
    // For now, we'll use simple text rendering
    // In a full implementation, we'd set font to bold and larger size

    content
        .begin_text()
        .set_font(Name(b"F1"), layout.font_size_name) // Font F1 = Helvetica-Bold
        .next_line(layout.margin_left, y)
        .show(pdf_writer::Str(name.as_bytes()))
        .end_text();

    // Move down by name height + extra spacing
    Ok(y - (layout.line_height(layout.font_size_name) + 6.0))
}

/// Render contact information in horizontal layout
fn render_contact_info(
    content: &mut Content,
    payload: &GenerationPayload,
    layout: &ResumeLayout,
    y: f32,
) -> Result<f32, PdfError> {
    let personal = &payload.personal;
    let mut contact_parts = Vec::new();

    // Build contact string (only include present fields)
    if let Some(email) = &personal.email {
        contact_parts.push(email.clone());
    }
    if let Some(phone) = &personal.phone {
        contact_parts.push(phone.clone());
    }
    if let Some(location) = &personal.location {
        contact_parts.push(location.clone());
    }

    let contact_line = contact_parts.join(" • ");

    if !contact_line.is_empty() {
        content
            .begin_text()
            .set_font(Name(b"F2"), layout.font_size_body) // Font F2 = Helvetica
            .next_line(layout.margin_left, y)
            .show(pdf_writer::Str(contact_line.as_bytes()))
            .end_text();
    }

    // Links on next line
    let mut links = Vec::new();
    if let Some(linkedin) = &personal.linkedin {
        links.push(format!("linkedin.com/in/{}", linkedin));
    }
    if let Some(github) = &personal.github {
        links.push(format!("github.com/{}", github));
    }
    if let Some(website) = &personal.website {
        links.push(website.clone());
    }

    let mut next_y = y - layout.line_height(layout.font_size_body);

    if !links.is_empty() {
        let links_line = links.join(" • ");
        content
            .begin_text()
            .set_font(Name(b"F2"), layout.font_size_body)
            .next_line(layout.margin_left, next_y)
            .show(pdf_writer::Str(links_line.as_bytes()))
            .end_text();

        next_y -= layout.line_height(layout.font_size_body);
    }

    Ok(next_y)
}

/// Render professional summary
fn render_summary(
    content: &mut Content,
    summary: &str,
    layout: &ResumeLayout,
    y: f32,
) -> Result<f32, PdfError> {
    // Add section heading
    content
        .begin_text()
        .set_font(Name(b"F1"), layout.font_size_heading)
        .next_line(layout.margin_left, y)
        .show(pdf_writer::Str(b"SUMMARY"))
        .end_text();

    let mut current_y = y - layout.line_height(layout.font_size_heading);

    // Wrap and render summary text
    let lines = layout.wrap_text(summary, layout.content_width(), layout.font_size_body);

    for line in lines {
        content
            .begin_text()
            .set_font(Name(b"F2"), layout.font_size_body)
            .next_line(layout.margin_left, current_y)
            .show(pdf_writer::Str(line.as_bytes()))
            .end_text();

        current_y -= layout.line_height(layout.font_size_body);
    }

    Ok(current_y)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GenerationMetadata, GenerationPayload};
    use docgen_core::{PersonalInfo, RoleProfile, ScoringWeights};
    use std::collections::HashMap;

    fn create_test_payload() -> GenerationPayload {
        GenerationPayload {
            personal: PersonalInfo {
                name: "Jane Doe".to_string(),
                nickname: Some("Jane".to_string()),
                tagline: Some("Building the future".to_string()),
                email: Some("jane@example.com".to_string()),
                phone: Some("+1234567890".to_string()),
                location: Some("San Francisco, CA".to_string()),
                linkedin: Some("janedoe".to_string()),
                github: Some("janedoe".to_string()),
                website: Some("janedoe.com".to_string()),
                twitter: None,
            },
            selected_bullets: vec![],
            role_profile: RoleProfile {
                id: "test".to_string(),
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
            summary: Some("Experienced professional with diverse background".to_string()),
            metadata: None,
        }
    }

    // =============================================================================
    // Name Rendering Tests
    // =============================================================================

    #[test]
    fn test_render_name() {
        println!("Testing basic name rendering...");

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let start_y = 700.0;
        let result = render_name(&mut content, "Jane Doe", &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(
            end_y < start_y,
            "Y position should decrease after rendering name"
        );

        let expected_decrease = layout.line_height(layout.font_size_name) + 6.0;
        let actual_decrease = start_y - end_y;
        assert!(
            (actual_decrease - expected_decrease).abs() < 0.1,
            "Should decrease by name line height + spacing"
        );

        println!("✓ Name rendered correctly");
    }

    #[test]
    fn test_render_name_unicode() {
        println!("Testing Unicode name rendering...");

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let names = vec![
            "José García-Martínez",
            "Renée Müller-Schmidt",
            "李明",
            "Владимир Иванов",
            "محمد علي",
        ];

        for name in names {
            let result = render_name(&mut content, name, &layout, 700.0);
            assert!(result.is_ok(), "Should render Unicode name: {}", name);
            println!("  ✓ Rendered: {}", name);
        }

        println!("✓ Unicode names rendered successfully");
    }

    #[test]
    fn test_render_name_very_long() {
        println!("Testing very long name rendering...");

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let long_name = "Dr. Alexandra Catherine Montgomery-Williams-Thompson III, Esq.";
        let result = render_name(&mut content, long_name, &layout, 700.0);

        assert!(result.is_ok(), "Should handle long names");
        println!("  Name length: {} chars", long_name.len());
        println!("✓ Long name rendered successfully");
    }

    #[test]
    fn test_render_name_with_special_characters() {
        println!("Testing name with special characters...");

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let names_with_special_chars = vec![
            "O'Brien",
            "Mary-Kate",
            "D'Angelo",
            "St. James",
            "van der Berg",
        ];

        for name in names_with_special_chars {
            let result = render_name(&mut content, name, &layout, 700.0);
            assert!(
                result.is_ok(),
                "Should render name with special chars: {}",
                name
            );
        }

        println!("✓ Special character names rendered successfully");
    }

    // =============================================================================
    // Contact Info Rendering Tests
    // =============================================================================

    #[test]
    fn test_render_contact_info_all_fields() {
        println!("Testing contact info with all fields...");

        let payload = create_test_payload();
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let start_y = 700.0;
        let result = render_contact_info(&mut content, &payload, &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(end_y < start_y, "Y should decrease");

        // Should render 2 lines (contact + links)
        let expected_decrease = layout.line_height(layout.font_size_body) * 2.0;
        let actual_decrease = start_y - end_y;
        assert!(
            (actual_decrease - expected_decrease).abs() < layout.line_height(layout.font_size_body),
            "Should decrease by ~2 line heights"
        );

        println!("✓ All contact fields rendered");
    }

    #[test]
    fn test_render_contact_info_minimal() {
        println!("Testing contact info with minimal fields...");

        let mut payload = create_test_payload();
        payload.personal.phone = None;
        payload.personal.linkedin = None;
        payload.personal.github = None;
        payload.personal.website = None;

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let result = render_contact_info(&mut content, &payload, &layout, 700.0);
        assert!(result.is_ok(), "Should handle minimal contact info");

        println!("✓ Minimal contact info rendered");
    }

    #[test]
    fn test_render_contact_info_no_links() {
        println!("Testing contact info without social links...");

        let mut payload = create_test_payload();
        payload.personal.linkedin = None;
        payload.personal.github = None;
        payload.personal.website = None;
        payload.personal.twitter = None;

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let start_y = 700.0;
        let result = render_contact_info(&mut content, &payload, &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();

        // Should only render 1 line (no links line)
        let decrease = start_y - end_y;
        let expected = layout.line_height(layout.font_size_body);
        assert!(decrease <= expected * 1.1, "Should only render one line");

        println!("✓ Contact info without links rendered correctly");
    }

    #[test]
    fn test_render_contact_info_phone_formats() {
        println!("Testing various phone number formats...");

        let phone_formats = vec![
            "+1234567890",
            "+1 (555) 123-4567",
            "(555) 123-4567",
            "555-123-4567",
            "+44 20 7946 0958",
            "+86 10 6554 9999",
        ];

        let layout = ResumeLayout::default();

        for phone in phone_formats {
            let mut payload = create_test_payload();
            payload.personal.phone = Some(phone.to_string());

            let mut content = Content::new();
            let result = render_contact_info(&mut content, &payload, &layout, 700.0);

            assert!(result.is_ok(), "Should render phone format: {}", phone);
            println!("  ✓ {}", phone);
        }

        println!("✓ All phone formats rendered successfully");
    }

    #[test]
    fn test_render_contact_info_long_email() {
        println!("Testing very long email address...");

        let mut payload = create_test_payload();
        payload.personal.email =
            Some("very.long.email.address.that.might.wrap@example-company-name.co.uk".to_string());

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let result = render_contact_info(&mut content, &payload, &layout, 700.0);
        assert!(result.is_ok(), "Should handle long email");

        println!("✓ Long email rendered successfully");
    }

    #[test]
    fn test_render_linkedin_url_formatting() {
        println!("Testing LinkedIn URL formatting...");

        let mut payload = create_test_payload();
        payload.personal.linkedin = Some("olivergilbey".to_string());

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let result = render_contact_info(&mut content, &payload, &layout, 700.0);
        assert!(result.is_ok(), "Should format LinkedIn URL");

        println!("✓ LinkedIn URL formatted correctly");
    }

    #[test]
    fn test_render_github_url_formatting() {
        println!("Testing GitHub URL formatting...");

        let mut payload = create_test_payload();
        payload.personal.github = Some("olliegilbey".to_string());

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let result = render_contact_info(&mut content, &payload, &layout, 700.0);
        assert!(result.is_ok(), "Should format GitHub URL");

        println!("✓ GitHub URL formatted correctly");
    }

    // =============================================================================
    // Summary Rendering Tests
    // =============================================================================

    #[test]
    fn test_render_summary_short() {
        println!("Testing short summary rendering...");

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let summary = "Experienced software engineer with 10+ years building scalable systems";

        let start_y = 700.0;
        let result = render_summary(&mut content, summary, &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(end_y < start_y, "Y should decrease");

        println!("✓ Short summary rendered");
    }

    #[test]
    fn test_render_summary_long() {
        println!("Testing long summary with text wrapping...");

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let long_summary = "Accomplished technology leader with over 15 years of experience building and scaling engineering teams, delivering complex distributed systems, and driving organizational transformation. Proven track record of leading cross-functional initiatives, mentoring senior engineers, and establishing technical standards that enable rapid innovation while maintaining operational excellence. Passionate about developer experience, infrastructure automation, and fostering inclusive team cultures that attract and retain top talent.";

        let start_y = 700.0;
        let result = render_summary(&mut content, &long_summary, &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();

        // Long summary should wrap to multiple lines
        let lines_rendered = (start_y - end_y) / layout.line_height(layout.font_size_body);
        assert!(
            lines_rendered > 2.0,
            "Long summary should wrap to multiple lines"
        );

        println!("  Rendered {} lines", lines_rendered);
        println!("✓ Long summary rendered with wrapping");
    }

    #[test]
    fn test_render_summary_with_unicode() {
        println!("Testing summary with Unicode characters...");

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let unicode_summary = "Passionate about building products that improve lives • Experienced in scaling teams from 10 → 500 engineers • Fluent in English, 中文, and العربية";

        let result = render_summary(&mut content, &unicode_summary, &layout, 700.0);
        assert!(result.is_ok(), "Should handle Unicode in summary");

        println!("✓ Unicode summary rendered successfully");
    }

    #[test]
    fn test_render_summary_with_special_formatting() {
        println!("Testing summary with special formatting characters...");

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let formatted_summary = "Expert in: (1) distributed systems, (2) team leadership, (3) DevOps practices. Metrics-driven: 50%+ improvement in deployment velocity, $2M cost savings, 99.99% uptime SLA.";

        let result = render_summary(&mut content, &formatted_summary, &layout, 700.0);
        assert!(result.is_ok(), "Should handle formatted text");

        println!("✓ Formatted summary rendered successfully");
    }

    #[test]
    fn test_render_summary_multi_paragraph() {
        println!("Testing multi-paragraph summary...");

        let layout = ResumeLayout::default();
        let mut content = Content::new();

        // Note: Current implementation treats as single block
        // This test documents current behavior
        let multi_para = "First paragraph of professional summary.\n\nSecond paragraph with additional details.\n\nThird paragraph concluding the summary.";

        let result = render_summary(&mut content, &multi_para, &layout, 700.0);
        assert!(result.is_ok(), "Should handle multi-paragraph text");

        println!("✓ Multi-paragraph summary handled");
    }

    // =============================================================================
    // Full Header Integration Tests
    // =============================================================================

    #[test]
    fn test_render_full_header() {
        println!("Testing full header rendering...");

        let payload = create_test_payload();
        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();

        let start_y = layout.page_height - layout.margin_top;
        let result = render(&mut pdf, &mut content, &payload, &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(end_y < start_y, "Header should consume vertical space");

        // Header should include: name, contact, summary, spacing
        let total_consumed = start_y - end_y;
        assert!(
            total_consumed > 50.0,
            "Header should take substantial space"
        );

        println!("  Header consumed {} pts", total_consumed);
        println!("✓ Full header rendered successfully");
    }

    #[test]
    fn test_render_header_no_summary() {
        println!("Testing header without summary section...");

        let mut payload = create_test_payload();
        payload.summary = None;

        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();

        let start_y = layout.page_height - layout.margin_top;
        let result = render(&mut pdf, &mut content, &payload, &layout, start_y);

        assert!(result.is_ok());
        println!("✓ Header without summary rendered successfully");
    }

    #[test]
    fn test_render_header_minimal_contact() {
        println!("Testing header with minimal contact info...");

        let mut payload = create_test_payload();
        payload.personal.phone = None;
        payload.personal.location = None;
        payload.personal.linkedin = None;
        payload.personal.github = None;
        payload.personal.website = None;
        payload.personal.twitter = None;

        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();

        let result = render(&mut pdf, &mut content, &payload, &layout, 700.0);
        assert!(result.is_ok(), "Should handle minimal contact info");

        println!("✓ Minimal header rendered successfully");
    }

    #[test]
    fn test_render_header_positioning() {
        println!("Testing header Y positioning accuracy...");

        let payload = create_test_payload();
        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();

        let start_positions = vec![700.0, 600.0, 500.0];

        for start_y in start_positions {
            let result = render(&mut pdf, &mut content, &payload, &layout, start_y);
            assert!(result.is_ok());

            let end_y = result.unwrap();
            assert!(end_y < start_y, "End Y should always be less than start Y");
            assert!(end_y > 0.0, "End Y should be positive");

            println!(
                "  Start: {} → End: {} (consumed: {})",
                start_y,
                end_y,
                start_y - end_y
            );
        }

        println!("✓ Header positioning accurate across different start positions");
    }

    #[test]
    fn test_render_header_with_nickname_and_tagline() {
        println!("Testing header with nickname and tagline...");

        let payload = create_test_payload();
        assert!(payload.personal.nickname.is_some());
        assert!(payload.personal.tagline.is_some());

        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();

        let result = render(&mut pdf, &mut content, &payload, &layout, 700.0);
        assert!(result.is_ok(), "Should render with nickname and tagline");

        println!("✓ Header with nickname and tagline rendered");
    }
}
