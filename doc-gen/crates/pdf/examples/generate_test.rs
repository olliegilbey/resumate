use docgen_core::scoring::ScoredBullet;
use docgen_core::*;
use docgen_pdf::generator::generate_with_build_info;
use docgen_pdf::GenerationPayload;
use std::fs;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create minimal test payload
    let personal = PersonalInfo {
        name: "Oliver Gilbey".to_string(),
        nickname: None,
        tagline: None,
        email: Some("test@example.com".to_string()),
        phone: Some("+1234567890".to_string()),
        location: Some("San Francisco, CA".to_string()),
        linkedin: None,
        github: None,
        website: None,
        twitter: None,
    };

    let role_profile = RoleProfile {
        id: "test-role".to_string(),
        name: "Test Role".to_string(),
        description: Some("Test description".to_string()),
        tag_weights: std::collections::HashMap::new(),
        scoring_weights: ScoringWeights {
            tag_relevance: 0.7,
            priority: 0.3,
        },
    };

    let bullet = Bullet {
        id: "test-bullet-1".to_string(),
        name: None,
        location: None,
        date_start: Some("2022-01".to_string()),
        date_end: Some("2023-01".to_string()),
        summary: None,
        description: "Built a test system with amazing results".to_string(),
        tags: vec!["engineering".to_string()],
        priority: 8,
        link: None,
    };

    let scored_bullet = ScoredBullet {
        bullet,
        score: 0.9,
        company_id: "test-company".to_string(),
        company_name: Some("Test Company".to_string()),
        position_id: "test-position".to_string(),
        position_name: "Test Position".to_string(),
    };

    let payload = GenerationPayload {
        personal,
        selected_bullets: vec![scored_bullet],
        role_profile,
        education: None,
        skills: None,
        summary: None,
        metadata: None,
    };

    // Generate PDF with build info
    let build_info = "TEST BUILD: 2025-10-17 18:51 (test)";
    let pdf_bytes = generate_with_build_info(&payload, Some(build_info))?;

    // Save to test-outputs
    fs::write("../../test-outputs/rust-generated-test.pdf", pdf_bytes)?;
    println!("PDF generated: test-outputs/rust-generated-test.pdf");

    Ok(())
}
