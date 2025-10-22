//! Visual PDF test - verifies content is actually visible in the rendered page

use docgen_core::scoring::ScoredBullet;
use docgen_core::{Bullet, PersonalInfo, RoleProfile, ScoringWeights};
use docgen_pdf::{generate_pdf, GenerationPayload};
use std::collections::HashMap;
use std::fs;

#[test]
fn test_pdf_content_in_visible_area() {
    println!("\n=== PDF Visual Verification Test ===\n");

    let mut tag_weights = HashMap::new();
    tag_weights.insert("engineering".to_string(), 1.0);

    let payload = GenerationPayload {
        personal: PersonalInfo {
            name: "Oliver Gilbey".to_string(),
            nickname: Some("Ollie".to_string()),
            tagline: Some("Developer Relations Lead".to_string()),
            email: Some("oliver@example.com".to_string()),
            phone: Some("+44747176241".to_string()),
            location: Some("London, UK".to_string()),
            linkedin: Some("olivergilbey".to_string()),
            github: Some("olliegilbey".to_string()),
            website: Some("ollie.gg".to_string()),
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
                    description: "Managed the transition of leadership following the Managing Director's exit within a three-person team".to_string(),
                    tags: vec!["leadership".to_string()],
                    priority: 10,
                    link: None,
                },
                score: 0.95,
                company_id: "interchain".to_string(),
                company_name: Some("Interchain Foundation".to_string()),
                position_id: "devrel-lead".to_string(),
                position_name: "Developer Relations Lead".to_string(),
            },
            ScoredBullet {
                bullet: Bullet {
                    id: "b2".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Recruited and onboarded three DevRel members to my team".to_string(),
                    tags: vec!["leadership".to_string(), "hiring".to_string()],
                    priority: 9,
                    link: None,
                },
                score: 0.92,
                company_id: "interchain".to_string(),
                company_name: Some("Interchain Foundation".to_string()),
                position_id: "devrel-lead".to_string(),
                position_name: "Developer Relations Lead".to_string(),
            },
        ],
        role_profile: RoleProfile {
            id: "devrel-lead".to_string(),
            name: "Developer Relations Lead".to_string(),
            description: Some("Developer Relations leadership".to_string()),
            tag_weights,
            scoring_weights: ScoringWeights {
                tag_relevance: 0.6,
                priority: 0.4,
            },
        },
        education: None,
        skills: None,
        summary: Some("Experienced Developer Relations Lead with deep understanding of blockchain".to_string()),
        metadata: None,
    };

    let pdf_bytes = generate_pdf(&payload).expect("PDF generation failed");
    let pdf_string = String::from_utf8_lossy(&pdf_bytes);

    // Write to file for manual inspection
    let output_path = "/tmp/visual_test.pdf";
    fs::write(output_path, &pdf_bytes).expect("Failed to write test PDF");
    println!("✓ PDF written to: {}\n", output_path);

    // Extract MediaBox dimensions
    let media_box_regex =
        regex::Regex::new(r"/MediaBox\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]")
            .unwrap();

    let (media_x1, media_y1, media_x2, media_y2) =
        if let Some(caps) = media_box_regex.captures(&pdf_string) {
            let x1: f32 = caps[1].parse().unwrap();
            let y1: f32 = caps[2].parse().unwrap();
            let x2: f32 = caps[3].parse().unwrap();
            let y2: f32 = caps[4].parse().unwrap();
            println!("MediaBox: [{} {} {} {}]", x1, y1, x2, y2);
            println!("  Page width: {}", x2 - x1);
            println!("  Page height: {}", y2 - y1);
            (x1, y1, x2, y2)
        } else {
            panic!("Could not find MediaBox in PDF");
        };

    let page_width = media_x2 - media_x1;
    let page_height = media_y2 - media_y1;

    // Extract text positioning commands (Td = move text position)
    let td_regex = regex::Regex::new(r"([0-9.]+)\s+([0-9.]+)\s+Td").unwrap();

    let mut y_positions = Vec::new();
    for caps in td_regex.captures_iter(&pdf_string) {
        let x: f32 = caps[1].parse().unwrap();
        let y: f32 = caps[2].parse().unwrap();
        y_positions.push((x, y));
    }

    println!("\nText positioning (first 10):");
    for (i, (x, y)) in y_positions.iter().take(10).enumerate() {
        println!("  {}: X={:.1}, Y={:.1}", i + 1, x, y);
    }

    // Check that text is within visible page bounds
    let mut text_outside_page = Vec::new();
    for (i, (x, y)) in y_positions.iter().enumerate() {
        if *y < media_y1 || *y > media_y2 {
            text_outside_page.push((i, *x, *y));
        }
    }

    if !text_outside_page.is_empty() {
        println!("\n❌ ERROR: Text rendered outside visible page area!");
        for (i, x, y) in &text_outside_page {
            println!(
                "  Position {}: X={:.1}, Y={:.1} (page bounds: {} to {})",
                i, x, y, media_y1, media_y2
            );
        }
    }

    // Find the highest Y coordinate (should be near top of page)
    let max_y = y_positions
        .iter()
        .map(|(_, y)| y)
        .fold(0.0_f32, |a, b| a.max(*b));
    let min_y = y_positions
        .iter()
        .map(|(_, y)| y)
        .fold(f32::INFINITY, |a, b| a.min(*b));

    println!("\nY coordinate range:");
    println!("  Highest Y: {:.1} (closest to top)", max_y);
    println!("  Lowest Y: {:.1} (closest to bottom)", min_y);
    println!("  Page height: {:.1}", page_height);

    // Calculate how far from top the content starts
    let distance_from_top = media_y2 - max_y;
    let distance_from_bottom = min_y - media_y1;

    println!("\nContent positioning:");
    println!("  Distance from top of page: {:.1} pts", distance_from_top);
    println!(
        "  Distance from bottom of page: {:.1} pts",
        distance_from_bottom
    );

    // Check for issues
    let mut issues = Vec::new();

    if text_outside_page.len() > 0 {
        issues.push(format!(
            "{} text positions outside page bounds",
            text_outside_page.len()
        ));
    }

    if distance_from_top > 100.0 {
        issues.push(format!(
            "Content starts too far from top ({:.1} pts)",
            distance_from_top
        ));
    }

    if distance_from_top < 30.0 {
        issues.push("Content too close to top edge (< 30pts margin)".to_string());
    }

    // Check for bullet character encoding
    // Using hyphen (-) for PDF compatibility and ATS parsing
    let has_bullet_char = pdf_string.contains("(- )");

    if !has_bullet_char {
        issues.push("Bullet character (-) not found in PDF".to_string());
    } else {
        println!("\n✓ Bullet character encoding found");
    }

    // Summary
    println!("\n=== Test Summary ===");
    if issues.is_empty() {
        println!("✅ All checks passed!");
        println!("  - Content within page bounds");
        println!("  - Proper top margin ({:.1} pts)", distance_from_top);
        println!("  - Bullet encoding correct");
    } else {
        println!("❌ Issues found:");
        for issue in &issues {
            println!("  - {}", issue);
        }
        println!("\n💡 Suggested fix:");
        if distance_from_top > 100.0 {
            println!(
                "  The content is rendered at Y={:.1} but page height is {:.1}",
                max_y, page_height
            );
            println!("  Content should start near page_height - margin_top");
            println!("  Expected Y ≈ {:.1}, got {:.1}", page_height - 54.0, max_y);
        }
        panic!("PDF content positioning issues detected");
    }

    println!("\nInspect PDF at: {}", output_path);
}
