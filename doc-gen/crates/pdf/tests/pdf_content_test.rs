//! Integration test to verify PDF generation produces non-empty output with visible content

use docgen_core::scoring::ScoredBullet;
use docgen_core::{Bullet, Education, PersonalInfo, RoleProfile, ScoringWeights};
use docgen_pdf::{generate_pdf, GenerationPayload};
use std::collections::HashMap;
use std::fs;

fn create_test_payload() -> GenerationPayload {
    let mut tag_weights = HashMap::new();
    tag_weights.insert("engineering".to_string(), 1.0);
    tag_weights.insert("leadership".to_string(), 0.9);

    let mut skills = HashMap::new();
    skills.insert(
        "technical".to_string(),
        vec!["Rust".to_string(), "TypeScript".to_string()],
    );

    GenerationPayload {
        personal: PersonalInfo {
            name: "Jane Doe".to_string(),
            nickname: Some("Jane".to_string()),
            tagline: Some("Senior Software Engineer".to_string()),
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
                    description: "Led infrastructure migration to Kubernetes, reducing deployment time by 75%".to_string(),
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
                    description: "Mentored team of 5 junior engineers".to_string(),
                    tags: vec!["leadership".to_string()],
                    priority: 9,
                    link: None,
                },
                score: 0.92,
                company_id: "tech-corp".to_string(),
                company_name: Some("Tech Corp".to_string()),
                position_id: "senior-engineer".to_string(),
                position_name: "Senior Software Engineer".to_string(),
            },
        ],
        role_profile: RoleProfile {
            id: "software-engineer".to_string(),
            name: "Software Engineer".to_string(),
            description: Some("Full-stack development".to_string()),
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
            coursework: Some(vec!["Algorithms".to_string()]),
            societies: Some(vec!["ACM".to_string()]),
        }]),
        skills: Some(skills),
        summary: Some("Experienced software engineer with 8+ years building scalable systems.".to_string()),
        metadata: None,
    }
}

#[test]
fn test_pdf_generation_produces_non_empty_output() {
    println!("\n=== PDF Content Verification Test ===\n");

    let payload = create_test_payload();
    let result = generate_pdf(&payload);

    assert!(result.is_ok(), "PDF generation should succeed");

    let pdf_bytes = result.unwrap();

    // Write to file for manual inspection
    let output_path = "/tmp/test_output.pdf";
    fs::write(output_path, &pdf_bytes).expect("Failed to write test PDF");
    println!("✓ PDF written to: {}", output_path);
    println!(
        "  Size: {} bytes ({:.1} KB)",
        pdf_bytes.len(),
        pdf_bytes.len() as f64 / 1024.0
    );

    // Basic validation
    assert!(!pdf_bytes.is_empty(), "PDF should not be empty");
    assert!(
        pdf_bytes.len() > 1000,
        "PDF should be substantial (>1KB), got {} bytes",
        pdf_bytes.len()
    );
    assert!(
        pdf_bytes.starts_with(b"%PDF"),
        "Should start with PDF header"
    );

    // Convert to string for content inspection
    let pdf_string = String::from_utf8_lossy(&pdf_bytes);

    // Check for required PDF structures
    assert!(pdf_string.contains("/Catalog"), "PDF should have catalog");
    assert!(pdf_string.contains("/Pages"), "PDF should have pages");
    assert!(pdf_string.contains("/Page"), "PDF should have page");
    assert!(
        pdf_string.contains("/Contents"),
        "PDF should have content stream"
    );

    // Check for fonts (required for text rendering)
    assert!(pdf_string.contains("/Font"), "PDF should have fonts");
    assert!(
        pdf_string.contains("Helvetica"),
        "PDF should use Helvetica font"
    );

    // Check for content operators (text rendering)
    let has_text_operators = pdf_string.contains("BT") && pdf_string.contains("ET");
    println!("  Has BT/ET (text blocks): {}", has_text_operators);

    let has_text_positioning = pdf_string.contains("Tm") || pdf_string.contains("Td");
    println!("  Has Tm/Td (text positioning): {}", has_text_positioning);

    let has_text_showing = pdf_string.contains("Tj")
        || pdf_string.contains("TJ")
        || pdf_string.contains("'")
        || pdf_string.contains("\"");
    println!("  Has Tj/TJ/' (text showing): {}", has_text_showing);

    // Check for actual content
    let has_name = pdf_string.contains("Jane Doe")
        || pdf_string.contains("Jane")
        || pdf_string.contains("Doe");
    println!("  Contains name 'Jane Doe': {}", has_name);

    let has_bullet_text = pdf_string.contains("Kubernetes")
        || pdf_string.contains("infrastructure")
        || pdf_string.contains("deployment");
    println!("  Contains bullet text: {}", has_bullet_text);

    let has_company = pdf_string.contains("Tech Corp");
    println!("  Contains company 'Tech Corp': {}", has_company);

    let has_education = pdf_string.contains("Stanford") || pdf_string.contains("Computer Science");
    println!("  Contains education: {}", has_education);

    // Assert that we have text rendering commands
    assert!(
        has_text_operators,
        "PDF must contain text block operators (BT/ET)"
    );

    // Warn if no recognizable content found
    if !has_name && !has_bullet_text && !has_company {
        println!("\n⚠️  WARNING: PDF contains no recognizable text content!");
        println!("   This suggests content may be rendered outside visible page area.");
    }

    println!("\n✓ PDF structure validation passed");
    println!("  You can inspect the PDF at: {}\n", output_path);
}

#[test]
fn test_pdf_page_dimensions_and_content_stream() {
    println!("\n=== PDF Page Dimensions Test ===\n");

    let payload = create_test_payload();
    let pdf_bytes = generate_pdf(&payload).expect("PDF generation failed");
    let pdf_string = String::from_utf8_lossy(&pdf_bytes);

    // Find MediaBox dimensions
    if let Some(media_box_start) = pdf_string.find("/MediaBox") {
        let media_box_section = &pdf_string[media_box_start..media_box_start + 100];
        println!(
            "MediaBox: {}",
            media_box_section.lines().next().unwrap_or("not found")
        );
    }

    // Find content stream
    if let Some(stream_start) = pdf_string.find("stream\n") {
        let content_start = stream_start + 7; // Length of "stream\n"
        let content_preview =
            &pdf_string[content_start..std::cmp::min(content_start + 500, pdf_string.len())];
        println!("\nContent stream preview (first 500 chars):");
        println!("{}", content_preview);
    }

    // Count text operators
    let bt_count = pdf_string.matches("BT").count();
    let et_count = pdf_string.matches("ET").count();
    let tm_count = pdf_string.matches("Tm").count();

    println!("\nText operator counts:");
    println!("  BT (begin text): {}", bt_count);
    println!("  ET (end text): {}", et_count);
    println!("  Tm (text matrix): {}", tm_count);

    assert_eq!(bt_count, et_count, "BT and ET counts should match");
    assert!(bt_count > 0, "Should have at least one text block");
}
