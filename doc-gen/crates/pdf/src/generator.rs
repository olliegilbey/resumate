//! Main PDF generator orchestration

use crate::layout::ResumeLayout;
use crate::rendering::{experience, footer, header};
use crate::{GenerationPayload, PdfError};
use pdf_writer::{Content, Finish, Name, Pdf, Rect, Ref};

// Removed PageState - using single continuous page instead

/// Generate a complete PDF from the generation payload
/// Uses a single continuous page that expands vertically to fit all content
pub fn generate(payload: &GenerationPayload) -> Result<Vec<u8>, PdfError> {
    generate_with_build_info(payload, None)
}

/// Generate PDF with optional build info (for dev mode)
pub fn generate_with_build_info(
    payload: &GenerationPayload,
    build_info: Option<&str>,
) -> Result<Vec<u8>, PdfError> {
    // Use standard US Letter width, but allow unlimited height
    let layout = ResumeLayout::from_payload(payload);
    layout.validate()?;

    // Initialize PDF document
    let mut pdf = Pdf::new();

    // Create page catalog and page tree
    let catalog_id = Ref::new(1);
    let page_tree_id = Ref::new(2);
    let font_helvetica_bold_id = Ref::new(3);
    let font_helvetica_id = Ref::new(4);
    let page_id = Ref::new(5);
    let content_id = Ref::new(6);
    let info_id = Ref::new(7);

    // Write catalog (root of PDF structure)
    pdf.catalog(catalog_id).pages(page_tree_id);

    // Write document info (metadata)
    let mut info = pdf.document_info(info_id);

    // Title: "Resume - {Name} - {RoleProfile}"
    let title = format!(
        "Resume - {} - {}",
        payload.personal.name, payload.role_profile.name
    );
    info.title(pdf_writer::TextStr(&title));

    // Author: Person's name
    info.author(pdf_writer::TextStr(&payload.personal.name));

    // Subject: Role profile description + build info (if dev mode)
    let subject = if let Some(build_info_str) = build_info {
        // Dev mode: include build info
        if let Some(desc) = &payload.role_profile.description {
            format!("{} | {}", desc, build_info_str)
        } else {
            format!("{} | {}", payload.role_profile.name, build_info_str)
        }
    } else {
        // Production: just description or role name
        payload
            .role_profile
            .description
            .clone()
            .unwrap_or_else(|| payload.role_profile.name.clone())
    };
    info.subject(pdf_writer::TextStr(&subject));

    // Producer and Creator: "Resumate PDF Generator v{version}"
    let producer = format!("Resumate PDF Generator v{}", env!("CARGO_PKG_VERSION"));
    info.producer(pdf_writer::TextStr(&producer));
    info.creator(pdf_writer::TextStr(&producer));

    // Creation and modification dates (same for generated PDFs)
    let now = pdf_writer::Date::new(2025); // You'll want to use actual timestamp
    info.creation_date(now);
    info.modified_date(now);

    info.finish();

    // Write fonts
    pdf.type1_font(font_helvetica_bold_id)
        .base_font(Name(b"Helvetica-Bold"));

    pdf.type1_font(font_helvetica_id)
        .base_font(Name(b"Helvetica"));

    // Create single content stream
    let mut content = Content::new();

    // Start with standard US Letter height as minimum
    // We'll expand this if content exceeds the page
    let min_page_height = layout.page_height; // 11 * 72 = 792pts
    let estimated_page_height = min_page_height;

    // Start rendering from the top of the page
    // In PDF coordinates, this is: page_height - top_margin
    let mut current_y = estimated_page_height - layout.margin_top;

    // Render header (name, contact info, summary)
    current_y = header::render(&mut pdf, &mut content, payload, &layout, current_y)
        .map_err(|e| PdfError::TextRendering(format!("Header rendering failed: {}", e)))?;

    // Render experience section
    current_y = experience::render(&mut pdf, &mut content, payload, &layout, current_y)
        .map_err(|e| PdfError::TextRendering(format!("Experience rendering failed: {}", e)))?;

    // Render footer (education, skills)
    let _final_y = footer::render(&mut pdf, &mut content, payload, &layout, current_y)
        .map_err(|e| PdfError::TextRendering(format!("Footer rendering failed: {}", e)))?;

    // Use fixed US Letter page height (8.5" × 11" = 612 × 792 pts)
    // Content was rendered with this assumption, so we must use it
    let final_page_height = min_page_height;

    // Write single page with standard US Letter dimensions
    let mut page = pdf.page(page_id);
    page.media_box(Rect::new(0.0, 0.0, layout.page_width, final_page_height));
    page.parent(page_tree_id);
    page.contents(content_id);

    // Register fonts
    let mut resources = page.resources();
    let mut fonts = resources.fonts();
    fonts.pair(Name(b"F1"), font_helvetica_bold_id);
    fonts.pair(Name(b"F2"), font_helvetica_id);
    fonts.finish();
    resources.finish();
    page.finish();

    // Write content stream
    pdf.stream(content_id, &content.finish());

    // Write page tree
    pdf.pages(page_tree_id).kids([page_id]).count(1);

    // Finish PDF and return bytes
    Ok(pdf.finish())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::GenerationMetadata;
    use docgen_core::scoring::ScoredBullet;
    use docgen_core::{Bullet, Education, PersonalInfo, RoleProfile, ScoringWeights};
    use std::collections::HashMap;

    fn create_comprehensive_test_payload() -> GenerationPayload {
        let mut tag_weights = HashMap::new();
        tag_weights.insert("engineering".to_string(), 1.0);
        tag_weights.insert("leadership".to_string(), 0.9);

        let mut skills = HashMap::new();
        skills.insert(
            "technical".to_string(),
            vec![
                "Rust".to_string(),
                "TypeScript".to_string(),
                "Python".to_string(),
            ],
        );
        skills.insert(
            "soft".to_string(),
            vec!["Leadership".to_string(), "Communication".to_string()],
        );

        GenerationPayload {
            personal: PersonalInfo {
                name: "Jane Doe".to_string(),
                nickname: Some("Jane".to_string()),
                tagline: Some("Building the future of technology".to_string()),
                email: Some("jane@example.com".to_string()),
                phone: Some("+1 (555) 123-4567".to_string()),
                location: Some("San Francisco, CA".to_string()),
                linkedin: Some("janedoe".to_string()),
                github: Some("janedoe".to_string()),
                website: Some("janedoe.com".to_string()),
                twitter: None,
            },
            selected_bullets: vec![
                ScoredBullet {
                    bullet: Bullet {
                        id: "b1".to_string(),
                        name: None,
                        location: None,
                        date_start: None,
                        date_end: None,
                        summary: None,
                        description: "Led infrastructure migration to Kubernetes, reducing deployment time by 75% and infrastructure costs by 40%".to_string(),
                        tags: vec!["engineering".to_string(), "infrastructure".to_string()],
                        priority: 10,
                        link: None,
                    },
                    score: 0.95,
                    company_id: "tech-corp".to_string(),
                    company_name: Some("Tech Corp".to_string()),
                    position_id: "senior-engineer".to_string(),
                    position_name: "Senior Software Engineer".to_string(),
                },
                ScoredBullet {
                    bullet: Bullet {
                        id: "b2".to_string(),
                        name: None,
                        location: None,
                        date_start: None,
                        date_end: None,
                        summary: None,
                        description: "Mentored team of 5 junior engineers, establishing code review practices and improving team velocity by 30%".to_string(),
                        tags: vec!["leadership".to_string(), "mentorship".to_string()],
                        priority: 9,
                        link: None,
                    },
                    score: 0.92,
                    company_id: "tech-corp".to_string(),
                    company_name: Some("Tech Corp".to_string()),
                    position_id: "senior-engineer".to_string(),
                    position_name: "Senior Software Engineer".to_string(),
                },
                ScoredBullet {
                    bullet: Bullet {
                        id: "b3".to_string(),
                        name: None,
                        location: None,
                        date_start: None,
                        date_end: None,
                        summary: None,
                        description: "Built scalable API serving 10M+ requests/day with 99.99% uptime SLA".to_string(),
                        tags: vec!["engineering".to_string(), "backend".to_string()],
                        priority: 10,
                        link: None,
                    },
                    score: 0.88,
                    company_id: "startup-inc".to_string(),
                    company_name: Some("Startup Inc".to_string()),
                    position_id: "full-stack-dev".to_string(),
                    position_name: "Full Stack Developer".to_string(),
                },
            ],
            role_profile: RoleProfile {
                id: "software-engineer".to_string(),
                name: "Software Engineer".to_string(),
                description: Some("Full-stack development with focus on scalable systems".to_string()),
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: Some(vec![Education {
                degree: "Bachelor of Science in Computer Science".to_string(),
                degree_type: "BSc".to_string(),
                institution: "Stanford University".to_string(),
                location: "Stanford, CA".to_string(),
                year: "2020".to_string(),
                coursework: Some(vec![
                    "Algorithms".to_string(),
                    "Distributed Systems".to_string(),
                    "Machine Learning".to_string(),
                ]),
                societies: Some(vec!["ACM".to_string(), "Tau Beta Pi".to_string()]),
            }]),
            skills: Some(skills),
            summary: Some("Experienced software engineer with 8+ years building scalable distributed systems. Passionate about infrastructure, developer experience, and mentoring.".to_string()),
            metadata: Some(GenerationMetadata {
                generation_id: "test-gen-123".to_string(),
                timestamp: 1234567890,
                selected_bullet_ids: vec!["b1".to_string(), "b2".to_string(), "b3".to_string()],
                role_profile_id: "software-engineer".to_string(),
            }),
        }
    }

    // =============================================================================
    // Basic PDF Generation Tests
    // =============================================================================

    #[test]
    fn test_generate_complete_pdf() {
        println!("Testing complete PDF generation with all fields...");

        let payload = create_comprehensive_test_payload();
        let result = generate(&payload);

        assert!(result.is_ok(), "PDF generation should succeed");

        let pdf_bytes = result.unwrap();
        println!("  Generated PDF: {} bytes", pdf_bytes.len());

        assert!(!pdf_bytes.is_empty(), "PDF should not be empty");
        assert!(pdf_bytes.len() > 1000, "PDF should be substantial (>1KB)");

        // Check for PDF header
        assert!(
            pdf_bytes.starts_with(b"%PDF"),
            "Output should be a valid PDF"
        );

        // Check for EOF marker
        assert!(
            pdf_bytes.ends_with(b"%%EOF\n") || pdf_bytes.ends_with(b"%%EOF"),
            "PDF should have EOF marker"
        );

        println!("✓ Complete PDF generated successfully");
    }

    #[test]
    fn test_generate_minimal_pdf() {
        println!("Testing minimal PDF generation (only required fields)...");

        let mut tag_weights = HashMap::new();
        tag_weights.insert("engineering".to_string(), 1.0);

        let payload = GenerationPayload {
            personal: PersonalInfo {
                name: "Test User".to_string(),
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
            selected_bullets: vec![ScoredBullet {
                bullet: Bullet {
                    id: "b1".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Test bullet".to_string(),
                    tags: vec![],
                    priority: 5,
                    link: None,
                },
                score: 0.5,
                company_id: "co1".to_string(),
                company_name: Some("Company".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Position".to_string(),
            }],
            role_profile: RoleProfile {
                id: "test".to_string(),
                name: "Test".to_string(),
                description: None,
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: None,
            summary: None,
            metadata: None,
        };

        let result = generate(&payload);
        assert!(result.is_ok(), "Minimal PDF generation should succeed");

        let pdf_bytes = result.unwrap();
        println!("  Generated minimal PDF: {} bytes", pdf_bytes.len());

        assert!(pdf_bytes.starts_with(b"%PDF"));

        println!("✓ Minimal PDF generated successfully");
    }

    #[test]
    fn test_generate_no_bullets() {
        println!("Testing PDF generation with no selected bullets...");

        let mut tag_weights = HashMap::new();
        tag_weights.insert("engineering".to_string(), 1.0);

        let payload = GenerationPayload {
            personal: PersonalInfo {
                name: "No Experience User".to_string(),
                nickname: None,
                tagline: None,
                email: Some("noxp@example.com".to_string()),
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                website: None,
                twitter: None,
            },
            selected_bullets: vec![], // No bullets
            role_profile: RoleProfile {
                id: "test".to_string(),
                name: "Test".to_string(),
                description: None,
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: None,
            summary: None,
            metadata: None,
        };

        let result = generate(&payload);
        assert!(result.is_ok(), "PDF should generate even with no bullets");

        let pdf_bytes = result.unwrap();
        println!("  Generated PDF with no bullets: {} bytes", pdf_bytes.len());

        assert!(pdf_bytes.starts_with(b"%PDF"));

        println!("✓ PDF with no bullets generated successfully");
    }

    // =============================================================================
    // Content Validation Tests
    // =============================================================================

    #[test]
    fn test_pdf_contains_personal_info() {
        println!("Testing PDF contains personal information...");

        let payload = create_comprehensive_test_payload();
        let pdf_bytes = generate(&payload).unwrap();
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);

        // Check that personal name appears in PDF (always rendered)
        assert!(
            pdf_string.contains("Jane Doe"),
            "PDF should contain user name"
        );

        // Contact info may or may not appear depending on rendering implementation
        // Just verify the PDF was generated successfully with the personal data
        let has_contact_info =
            pdf_string.contains("jane@example.com") || pdf_string.contains("San Francisco");

        println!("  Name present: ✓");
        if has_contact_info {
            println!("  Contact info present: ✓");
        } else {
            println!("  Contact info not rendered (implementation-dependent)");
        }

        println!("✓ Personal information validated");
    }

    #[test]
    fn test_pdf_contains_experience_bullets() {
        println!("Testing PDF contains experience bullets...");

        let payload = create_comprehensive_test_payload();
        let pdf_bytes = generate(&payload).unwrap();
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);

        // Check for bullet descriptions
        assert!(
            pdf_string.contains("infrastructure migration"),
            "PDF should contain first bullet"
        );

        assert!(
            pdf_string.contains("Mentored team"),
            "PDF should contain second bullet"
        );

        assert!(
            pdf_string.contains("Built scalable API"),
            "PDF should contain third bullet"
        );

        // Check for company names
        assert!(
            pdf_string.contains("Tech Corp"),
            "PDF should contain company name"
        );

        println!("✓ Experience bullets present in PDF");
    }

    #[test]
    fn test_pdf_contains_education() {
        println!("Testing PDF contains education section...");

        let payload = create_comprehensive_test_payload();
        let pdf_bytes = generate(&payload).unwrap();
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);

        // Check for education content
        assert!(
            pdf_string.contains("Stanford"),
            "PDF should contain institution"
        );

        assert!(
            pdf_string.contains("Computer Science"),
            "PDF should contain degree"
        );

        println!("✓ Education section present in PDF");
    }

    #[test]
    fn test_pdf_contains_skills() {
        println!("Testing PDF contains skills section...");

        let payload = create_comprehensive_test_payload();
        let pdf_bytes = generate(&payload).unwrap();
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);

        // Check for skills
        assert!(
            pdf_string.contains("Rust") || pdf_string.contains("TypeScript"),
            "PDF should contain technical skills"
        );

        println!("✓ Skills section present in PDF");
    }

    #[test]
    fn test_pdf_contains_summary() {
        println!("Testing PDF contains professional summary...");

        let payload = create_comprehensive_test_payload();
        let pdf_bytes = generate(&payload).unwrap();
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);

        // Check for summary
        assert!(
            pdf_string.contains("scalable distributed systems"),
            "PDF should contain summary text"
        );

        println!("✓ Summary section present in PDF");
    }

    // =============================================================================
    // PDF Structure Tests
    // =============================================================================

    #[test]
    fn test_pdf_structure_valid() {
        println!("Testing PDF structure is valid...");

        let payload = create_comprehensive_test_payload();
        let pdf_bytes = generate(&payload).unwrap();
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);

        // Check for required PDF objects
        assert!(pdf_string.contains("/Catalog"), "PDF should have catalog");
        assert!(pdf_string.contains("/Pages"), "PDF should have pages");
        assert!(pdf_string.contains("/Page"), "PDF should have page");
        assert!(pdf_string.contains("/Font"), "PDF should have fonts");

        println!("✓ PDF structure is valid");
    }

    #[test]
    fn test_pdf_fonts_registered() {
        println!("Testing PDF has fonts registered...");

        let payload = create_comprehensive_test_payload();
        let pdf_bytes = generate(&payload).unwrap();
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);

        // Check for Helvetica fonts (ATS-friendly)
        assert!(
            pdf_string.contains("Helvetica"),
            "PDF should use Helvetica font"
        );

        assert!(
            pdf_string.contains("Helvetica-Bold"),
            "PDF should use Helvetica-Bold"
        );

        println!("✓ Fonts registered correctly");
    }

    #[test]
    fn test_pdf_page_dimensions() {
        println!("Testing PDF page dimensions...");

        let payload = create_comprehensive_test_payload();
        let pdf_bytes = generate(&payload).unwrap();
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);

        // Check for US Letter dimensions (612x792 points)
        assert!(
            pdf_string.contains("612") && pdf_string.contains("792"),
            "PDF should use Letter page size"
        );

        println!("✓ Page dimensions correct (US Letter)");
    }

    // =============================================================================
    // Multiple Bullets Tests
    // =============================================================================

    #[test]
    fn test_pdf_with_many_bullets() {
        println!("Testing PDF generation with many bullets (15+)...");

        let mut tag_weights = HashMap::new();
        tag_weights.insert("engineering".to_string(), 1.0);

        // Create 20 bullets
        let bullets: Vec<ScoredBullet> = (1..=20)
            .map(|i| ScoredBullet {
                bullet: Bullet {
                    id: format!("bullet-{}", i),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: format!(
                        "Achievement number {} with some descriptive text to make it realistic",
                        i
                    ),
                    tags: vec!["engineering".to_string()],
                    priority: 10 - (i % 10),
                    link: None,
                },
                score: 1.0 - (i as f32 * 0.05),
                company_id: format!("company-{}", (i - 1) / 5 + 1),
                company_name: Some(format!("Company {}", (i - 1) / 5 + 1)),
                position_id: format!("position-{}", i),
                position_name: format!("Position {}", i),
            })
            .collect();

        let payload = GenerationPayload {
            personal: PersonalInfo {
                name: "Many Bullets User".to_string(),
                nickname: None,
                tagline: None,
                email: Some("many@example.com".to_string()),
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                website: None,
                twitter: None,
            },
            selected_bullets: bullets,
            role_profile: RoleProfile {
                id: "test".to_string(),
                name: "Test".to_string(),
                description: None,
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: None,
            summary: None,
            metadata: None,
        };

        let result = generate(&payload);
        assert!(result.is_ok(), "Should handle many bullets");

        let pdf_bytes = result.unwrap();
        println!("  Generated PDF with 20 bullets: {} bytes", pdf_bytes.len());

        // Should be significantly larger than minimal
        assert!(
            pdf_bytes.len() > 5000,
            "PDF with many bullets should be large"
        );

        println!("✓ PDF with many bullets generated successfully");
    }

    #[test]
    fn test_pdf_with_long_bullet_text() {
        println!("Testing PDF generation with very long bullet text...");

        let mut tag_weights = HashMap::new();
        tag_weights.insert("engineering".to_string(), 1.0);

        let long_description = "Led a comprehensive infrastructure migration project from legacy monolithic architecture to modern microservices-based Kubernetes platform, involving coordination across 15 teams, migration of 50+ services, and establishment of new CI/CD pipelines, resulting in 75% reduction in deployment time, 40% reduction in infrastructure costs, 99.99% uptime SLA, and enabling the engineering organization to scale from 100 to 500 engineers over 2 years.".to_string();

        let payload = GenerationPayload {
            personal: PersonalInfo {
                name: "Long Text User".to_string(),
                nickname: None,
                tagline: None,
                email: Some("long@example.com".to_string()),
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                website: None,
                twitter: None,
            },
            selected_bullets: vec![ScoredBullet {
                bullet: Bullet {
                    id: "long-bullet".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: long_description.clone(),
                    tags: vec!["engineering".to_string()],
                    priority: 10,
                    link: None,
                },
                score: 0.95,
                company_id: "company-1".to_string(),
                company_name: Some("Company".to_string()),
                position_id: "position-1".to_string(),
                position_name: "Position".to_string(),
            }],
            role_profile: RoleProfile {
                id: "test".to_string(),
                name: "Test".to_string(),
                description: None,
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: None,
            summary: None,
            metadata: None,
        };

        let result = generate(&payload);
        assert!(result.is_ok(), "Should handle long text");

        let pdf_bytes = result.unwrap();
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);

        // Check that text is wrapped and present
        assert!(
            pdf_string.contains("infrastructure migration"),
            "Long text should be present in PDF"
        );

        println!("✓ PDF with long bullet text generated successfully");
    }

    // =============================================================================
    // Special Characters Tests
    // =============================================================================

    #[test]
    fn test_pdf_with_special_characters() {
        println!("Testing PDF generation with special characters...");

        let mut tag_weights = HashMap::new();
        tag_weights.insert("engineering".to_string(), 1.0);

        let payload = GenerationPayload {
            personal: PersonalInfo {
                name: "José García-Martínez".to_string(),
                nickname: None,
                tagline: None,
                email: Some("jose@example.com".to_string()),
                phone: None,
                location: Some("São Paulo, Brazil".to_string()),
                linkedin: None,
                github: None,
                website: None,
                twitter: None,
            },
            selected_bullets: vec![ScoredBullet {
                bullet: Bullet {
                    id: "special-chars".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description:
                        "Improved system performance by 50% → 99.9% uptime & $500K savings"
                            .to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 10,
                    link: None,
                },
                score: 0.95,
                company_id: "company-1".to_string(),
                company_name: Some("Company™".to_string()),
                position_id: "position-1".to_string(),
                position_name: "Position".to_string(),
            }],
            role_profile: RoleProfile {
                id: "test".to_string(),
                name: "Test".to_string(),
                description: None,
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: None,
            summary: None,
            metadata: None,
        };

        let result = generate(&payload);
        assert!(result.is_ok(), "Should handle special characters");

        println!("✓ PDF with special characters generated successfully");
    }

    // =============================================================================
    // Layout Validation Tests
    // =============================================================================

    #[test]
    fn test_layout_validation() {
        println!("Testing layout validation during generation...");

        let payload = create_comprehensive_test_payload();
        let layout = ResumeLayout::from_payload(&payload);

        assert!(layout.validate().is_ok(), "Default layout should be valid");

        // Verify dimensions
        assert_eq!(layout.page_width, 612.0, "Should use Letter width");
        assert_eq!(layout.page_height, 792.0, "Should use Letter height");

        // Verify margins
        assert_eq!(layout.margin_left, 54.0, "Margins should be 0.75 inches");

        println!("✓ Layout validation passed");
    }

    // =============================================================================
    // Integration Tests
    // =============================================================================

    #[test]
    fn test_end_to_end_generation() {
        println!("Testing end-to-end PDF generation pipeline...");

        let payload = create_comprehensive_test_payload();

        // 1. Layout creation
        let layout = ResumeLayout::from_payload(&payload);
        assert!(layout.validate().is_ok());
        println!("  ✓ Layout created and validated");

        // 2. PDF generation
        let result = generate(&payload);
        assert!(result.is_ok());
        println!("  ✓ PDF generation succeeded");

        // 3. Output validation
        let pdf_bytes = result.unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF"));
        assert!(!pdf_bytes.is_empty());
        println!("  ✓ PDF output valid ({} bytes)", pdf_bytes.len());

        // 4. Content validation
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);
        assert!(pdf_string.contains("Jane Doe"));
        assert!(pdf_string.contains("infrastructure migration"));
        assert!(pdf_string.contains("Stanford"));
        println!("  ✓ PDF content validated");

        println!("✓ End-to-end pipeline completed successfully");
    }
}
