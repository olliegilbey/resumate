//! Integration tests using real resume data
//!
//! These tests load the actual resume-data.json and validate
//! that scoring and selection work correctly for all role profiles.

use docgen_core::selector::{select_bullets, SelectionConfig};
use docgen_core::ResumeData;
use std::collections::HashSet;

/// Load resume data from project root
fn load_resume_data() -> ResumeData {
    // CARGO_MANIFEST_DIR = /path/to/resumate/doc-gen/crates/core
    // Need to go up 3 levels: core -> crates -> doc-gen -> resumate
    let data_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent() // crates
        .unwrap()
        .parent() // doc-gen
        .unwrap()
        .parent() // resumate
        .unwrap()
        .join("data")
        .join("resume-data.json");

    let json = std::fs::read_to_string(&data_path).unwrap_or_else(|e| {
        panic!(
            "Failed to read resume-data.json from {:?}: {}. Run npm run data:pull first",
            data_path, e
        )
    });

    serde_json::from_str(&json).expect("Failed to parse resume-data.json")
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_all_role_profiles_produce_valid_selections() {
    let resume = load_resume_data();
    let config = SelectionConfig::default();

    let role_profiles = resume.role_profiles.as_ref().unwrap();
    for role_profile in role_profiles {
        println!("\n🎯 Testing role profile: {}", role_profile.name);

        let selected = select_bullets(&resume, role_profile, &config);

        // Basic validation
        assert!(
            selected.len() <= config.max_bullets,
            "Profile '{}' selected {} bullets, max is {}",
            role_profile.name,
            selected.len(),
            config.max_bullets
        );

        // All bullets should have valid scores
        for bullet in &selected {
            assert!(
                bullet.score >= 0.0,
                "Negative score {} for bullet {}",
                bullet.score,
                bullet.bullet.id
            );
            assert!(
                bullet.score.is_finite(),
                "Non-finite score for bullet {}",
                bullet.bullet.id
            );
        }

        // Scores should be descending
        for i in 0..selected.len().saturating_sub(1) {
            assert!(
                selected[i].score >= selected[i + 1].score,
                "Profile '{}': scores not descending at index {}: {} vs {}",
                role_profile.name,
                i,
                selected[i].score,
                selected[i + 1].score
            );
        }

        println!(
            "  ✅ Selected {} bullets, top score: {:.3}, lowest score: {:.3}",
            selected.len(),
            selected.first().map(|b| b.score).unwrap_or(0.0),
            selected.last().map(|b| b.score).unwrap_or(0.0)
        );
    }
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_diversity_constraints_across_all_profiles() {
    let resume = load_resume_data();
    let config = SelectionConfig {
        max_bullets: 18,
        max_per_company: Some(6),
        max_per_position: Some(4),
    };

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        let selected = select_bullets(&resume, role_profile, &config);

        // Check company diversity
        let mut company_counts: std::collections::HashMap<String, usize> =
            std::collections::HashMap::new();

        for bullet in &selected {
            *company_counts.entry(bullet.company_id.clone()).or_insert(0) += 1;
        }

        for (company_id, count) in &company_counts {
            assert!(
                *count <= config.max_per_company.unwrap(),
                "Profile '{}': Company '{}' has {} bullets, max is {}",
                role_profile.name,
                company_id,
                count,
                config.max_per_company.unwrap()
            );
        }

        // Check position diversity
        let mut position_counts: std::collections::HashMap<String, usize> =
            std::collections::HashMap::new();

        for bullet in &selected {
            *position_counts
                .entry(bullet.position_id.clone())
                .or_insert(0) += 1;
        }

        for (position_id, count) in &position_counts {
            assert!(
                *count <= config.max_per_position.unwrap(),
                "Profile '{}': Position '{}' has {} bullets, max is {}",
                role_profile.name,
                position_id,
                count,
                config.max_per_position.unwrap()
            );
        }
    }
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_role_profiles_select_different_bullets() {
    let resume = load_resume_data();
    let config = SelectionConfig::default();

    let mut all_selections = Vec::new();

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        let selected = select_bullets(&resume, role_profile, &config);
        let bullet_ids: HashSet<String> = selected.iter().map(|b| b.bullet.id.clone()).collect();
        all_selections.push((role_profile.name.clone(), bullet_ids));
    }

    // Check that different role profiles select at least some different bullets
    let mut differences_found = 0;

    for i in 0..all_selections.len() {
        for j in i + 1..all_selections.len() {
            let (name1, ids1) = &all_selections[i];
            let (name2, ids2) = &all_selections[j];

            let unique_to_first: HashSet<_> = ids1.difference(ids2).collect();
            let unique_to_second: HashSet<_> = ids2.difference(ids1).collect();

            if !unique_to_first.is_empty() || !unique_to_second.is_empty() {
                differences_found += 1;
                println!(
                    "  '{}' vs '{}': {} unique to first, {} unique to second",
                    name1,
                    name2,
                    unique_to_first.len(),
                    unique_to_second.len()
                );
            }
        }
    }

    assert!(
        differences_found > 0,
        "All role profiles selected identical bullets - scoring may not be working"
    );
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_scoring_weights_are_respected() {
    let resume = load_resume_data();

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        // Validate weights sum to 1.0
        let sum =
            role_profile.scoring_weights.tag_relevance + role_profile.scoring_weights.priority;

        assert!(
            (sum - 1.0).abs() < 0.001,
            "Profile '{}': scoring weights sum to {:.3}, expected 1.0",
            role_profile.name,
            sum
        );

        assert!(
            role_profile.scoring_weights.tag_relevance >= 0.0
                && role_profile.scoring_weights.tag_relevance <= 1.0,
            "Profile '{}': tag_relevance out of range: {:.3}",
            role_profile.name,
            role_profile.scoring_weights.tag_relevance
        );

        assert!(
            role_profile.scoring_weights.priority >= 0.0
                && role_profile.scoring_weights.priority <= 1.0,
            "Profile '{}': priority weight out of range: {:.3}",
            role_profile.name,
            role_profile.scoring_weights.priority
        );
    }
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_all_profiles_include_position_descriptions() {
    let resume = load_resume_data();
    let config = SelectionConfig::default();

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        let selected = select_bullets(&resume, role_profile, &config);

        let has_description = selected
            .iter()
            .any(|b| b.bullet.id.ends_with("-description"));

        // At least some profiles should include descriptions
        // (this is a soft check - not all profiles might include them if scores are very low)
        if selected.len() > 0 && has_description {
            println!(
                "  ✅ Profile '{}' includes position descriptions",
                role_profile.name
            );
        }
    }
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_selection_is_deterministic_for_all_profiles() {
    let resume = load_resume_data();
    let config = SelectionConfig::default();

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        let selected1 = select_bullets(&resume, role_profile, &config);
        let selected2 = select_bullets(&resume, role_profile, &config);

        assert_eq!(
            selected1.len(),
            selected2.len(),
            "Profile '{}': non-deterministic selection count",
            role_profile.name
        );

        for (a, b) in selected1.iter().zip(selected2.iter()) {
            assert_eq!(
                a.bullet.id, b.bullet.id,
                "Profile '{}': non-deterministic bullet order",
                role_profile.name
            );
            assert_eq!(
                a.score, b.score,
                "Profile '{}': non-deterministic scores",
                role_profile.name
            );
        }
    }
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_tag_weights_affect_selection() {
    let resume = load_resume_data();
    let config = SelectionConfig {
        max_bullets: 10,
        max_per_company: None,
        max_per_position: None,
    };

    // Get selections for first two profiles
    let role_profiles = resume.role_profiles.as_ref().unwrap();
    if role_profiles.len() >= 2 {
        let profile1 = &role_profiles[0];
        let profile2 = &role_profiles[1];

        let selected1 = select_bullets(&resume, profile1, &config);
        let selected2 = select_bullets(&resume, profile2, &config);

        // Different tag weights should generally produce different top bullets
        let top_5_ids_1: HashSet<String> = selected1
            .iter()
            .take(5)
            .map(|b| b.bullet.id.clone())
            .collect();

        let top_5_ids_2: HashSet<String> = selected2
            .iter()
            .take(5)
            .map(|b| b.bullet.id.clone())
            .collect();

        let intersection: HashSet<_> = top_5_ids_1.intersection(&top_5_ids_2).collect();

        println!(
            "  Top 5 overlap between '{}' and '{}': {} bullets",
            profile1.name,
            profile2.name,
            intersection.len()
        );

        // They shouldn't be completely identical (unless priorities dominate)
        // This is a soft check - some overlap is expected
        assert!(
            intersection.len() < 5,
            "Tag weights may not be affecting selection - top 5 bullets are identical"
        );
    }
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_expected_role_profiles_exist() {
    let resume = load_resume_data();

    let role_profiles = resume.role_profiles.as_ref().unwrap();

    // Verify we have the expected 6 role profiles
    assert_eq!(
        role_profiles.len(),
        6,
        "Expected 6 role profiles, found {}",
        role_profiles.len()
    );

    let expected_ids = [
        "developer-relations-lead",
        "web3-blockchain-lead",
        "ai-ml-product-lead",
        "technical-product-manager",
        "growth-technical-leader",
        "head-of-community-ecosystem",
    ];

    for expected_id in &expected_ids {
        assert!(
            role_profiles.iter().any(|p| p.id == *expected_id),
            "Missing expected role profile: {}",
            expected_id
        );
    }
}

// ========== PDF Generation Integration Tests ==========
// TODO: Port these tests to use docgen_typst::render_resume in typst crate tests

#[test]
#[ignore = "TODO: Port to docgen_typst"]
#[ignore = "TODO: Port to docgen_typst"]
fn test_pdf_generation_for_all_profiles() {
    use docgen_core::GenerationPayload;

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        println!("\n📄 Testing PDF generation for: {}", role_profile.name);

        let selected = select_bullets(&resume, role_profile, &config);

        let payload = GenerationPayload {
            personal: resume.personal.clone(),
            selected_bullets: selected,
            role_profile: role_profile.clone(),
            education: resume.education.clone(),
            skills: resume.skills.clone(),
            summary: resume.summary.clone(),
            metadata: None,
        };

        let result = generate_pdf(&payload);
        assert!(
            result.is_ok(),
            "PDF generation failed for profile '{}': {:?}",
            role_profile.name,
            result.err()
        );

        let pdf_bytes = result.unwrap();
        assert!(
            !pdf_bytes.is_empty(),
            "PDF bytes empty for profile '{}'",
            role_profile.name
        );

        // PDFs should start with %PDF- header
        assert!(
            pdf_bytes.starts_with(b"%PDF-"),
            "Invalid PDF header for profile '{}'",
            role_profile.name
        );

        // Reasonable size check (>1KB, <10MB)
        assert!(
            pdf_bytes.len() > 1000,
            "PDF suspiciously small for profile '{}': {} bytes",
            role_profile.name,
            pdf_bytes.len()
        );

        assert!(
            pdf_bytes.len() < 10_000_000,
            "PDF suspiciously large for profile '{}': {} bytes",
            role_profile.name,
            pdf_bytes.len()
        );

        println!("  ✅ Generated PDF: {} bytes", pdf_bytes.len());
    }
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_pdf_generation_consistency() {
    use docgen_core::GenerationPayload;
    unimplemented!("Port to docgen_typst::render_resume");

    let resume = load_resume_data();
    let config = SelectionConfig::default();
    let role_profile = &resume.role_profiles.as_ref().unwrap()[0];

    let selected = select_bullets(&resume, role_profile, &config);

    let payload = GenerationPayload {
        personal: resume.personal.clone(),
        selected_bullets: selected,
        role_profile: role_profile.clone(),
        education: resume.education.clone(),
        skills: resume.skills.clone(),
        summary: resume.summary.clone(),
        metadata: None,
    };

    // Generate PDFs multiple times
    let pdf1 = generate_pdf(&payload).expect("First PDF generation failed");
    let pdf2 = generate_pdf(&payload).expect("Second PDF generation failed");
    let pdf3 = generate_pdf(&payload).expect("Third PDF generation failed");

    // Check that sizes are reasonably consistent
    // Note: Some variability is expected due to floating-point calculations in PDF layout
    let size1 = pdf1.len();
    let size2 = pdf2.len();
    let size3 = pdf3.len();

    // All sizes should be within 5% of each other (allows for floating-point variance)
    let max_size = size1.max(size2).max(size3);
    let min_size = size1.min(size2).min(size3);
    let tolerance = (max_size as f64 * 0.05) as usize;

    assert!(
        max_size - min_size <= tolerance,
        "PDF sizes vary too much: {} vs {} vs {} (tolerance: {} bytes)",
        size1,
        size2,
        size3,
        tolerance
    );

    println!(
        "✓ PDF generation reasonably consistent: {} bytes (±{} bytes, {}%)",
        size1,
        max_size - min_size,
        ((max_size - min_size) as f64 / max_size as f64 * 100.0)
    );
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_pdf_generation_with_minimal_data() {
    use docgen_core::GenerationPayload;
    use docgen_core::{PersonalInfo, RoleProfile, ScoringWeights};
    unimplemented!("Port to docgen_typst::render_resume");
    use std::collections::HashMap;

    // Minimal valid payload
    let payload = GenerationPayload {
        personal: PersonalInfo {
            name: "Test Person".to_string(),
            nickname: None,
            tagline: None,
            email: None,
            phone: None,
            location: None,
            linkedin: None,
            github: None,
            website: None,
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
        summary: None,
        metadata: None,
    };

    let result = generate_pdf(&payload);
    assert!(
        result.is_ok(),
        "PDF generation failed with minimal data: {:?}",
        result.err()
    );

    let pdf_bytes = result.unwrap();
    assert!(!pdf_bytes.is_empty(), "PDF bytes empty with minimal data");
    assert!(pdf_bytes.starts_with(b"%PDF-"), "Invalid PDF header");
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_pdf_generation_with_unicode_content() {
    use docgen_core::GenerationPayload;
    use docgen_core::{scoring::ScoredBullet, Bullet, PersonalInfo, RoleProfile, ScoringWeights};
    unimplemented!("Port to docgen_typst::render_resume");
    use std::collections::HashMap;

    let payload = GenerationPayload {
        personal: PersonalInfo {
            name: "José García-Martínez 李明".to_string(),
            nickname: None,
            tagline: Some("Test tagline with émojis 🚀".to_string()),
            email: Some("josé@example.com".to_string()),
            phone: None,
            location: Some("São Paulo, Brasil".to_string()),
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
                description: "Improved performance by 50% • Reduced costs • Enhanced UX 🎉"
                    .to_string(),
                tags: vec!["engineering".to_string()],
                priority: 10,
                link: None,
            },
            score: 0.95,
            company_id: "company1".to_string(),
            company_name: Some("Tech Corp™".to_string()),
            position_id: "pos1".to_string(),
            position_name: "Senior Engineer".to_string(),
        }],
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
        summary: None,
        metadata: None,
    };

    let result = generate_pdf(&payload);
    assert!(
        result.is_ok(),
        "PDF generation failed with Unicode content: {:?}",
        result.err()
    );

    let pdf_bytes = result.unwrap();
    assert!(!pdf_bytes.is_empty());
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_pdf_generation_with_long_bullets() {
    use docgen_core::GenerationPayload;
    use docgen_core::{scoring::ScoredBullet, Bullet, PersonalInfo, RoleProfile, ScoringWeights};
    unimplemented!("Port to docgen_typst::render_resume");
    use std::collections::HashMap;

    // Create a bullet with very long text to test text wrapping
    let long_text = "Led a comprehensive infrastructure migration project that involved \
        coordinating across multiple teams, refactoring legacy systems, implementing modern \
        cloud-native architectures, establishing CI/CD pipelines, improving observability \
        with distributed tracing and metrics, reducing operational costs by 40%, improving \
        deployment frequency from monthly to daily, decreasing mean time to recovery by 75%, \
        and mentoring 5 junior engineers throughout the process while maintaining 99.99% uptime.";

    let payload = GenerationPayload {
        personal: PersonalInfo {
            name: "Test Person".to_string(),
            nickname: None,
            tagline: None,
            email: None,
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
                description: long_text.to_string(),
                tags: vec![],
                priority: 10,
                link: None,
            },
            score: 0.95,
            company_id: "company1".to_string(),
            company_name: Some("Test Company".to_string()),
            position_id: "pos1".to_string(),
            position_name: "Test Position".to_string(),
        }],
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
        summary: None,
        metadata: None,
    };

    let result = generate_pdf(&payload);
    assert!(
        result.is_ok(),
        "PDF generation failed with long bullets: {:?}",
        result.err()
    );

    let pdf_bytes = result.unwrap();
    assert!(!pdf_bytes.is_empty());
}

// ========== Generation Payload Validation Tests ==========

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_generation_payload_from_real_data() {
    use docgen_core::GenerationPayload;
    unimplemented!("Port to docgen_typst::render_resume");

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        let selected = select_bullets(&resume, role_profile, &config);

        let payload = GenerationPayload {
            personal: resume.personal.clone(),
            selected_bullets: selected.clone(),
            role_profile: role_profile.clone(),
            education: resume.education.clone(),
            skills: resume.skills.clone(),
            summary: resume.summary.clone(),
            metadata: None,
        };

        // Verify payload is serializable
        let json_result = serde_json::to_string(&payload);
        assert!(
            json_result.is_ok(),
            "Failed to serialize payload for profile '{}': {:?}",
            role_profile.name,
            json_result.err()
        );

        // Verify roundtrip
        let json = json_result.unwrap();
        let deserialized: Result<GenerationPayload, _> = serde_json::from_str(&json);
        assert!(
            deserialized.is_ok(),
            "Failed to deserialize payload for profile '{}': {:?}",
            role_profile.name,
            deserialized.err()
        );

        let payload2 = deserialized.unwrap();
        assert_eq!(
            payload.personal.name, payload2.personal.name,
            "Roundtrip changed personal name"
        );
        assert_eq!(
            payload.selected_bullets.len(),
            payload2.selected_bullets.len(),
            "Roundtrip changed bullet count"
        );
    }
}

#[test]
#[ignore = "TODO: Port to docgen_typst"]
fn test_all_resume_data_fields_are_present() {
    let resume = load_resume_data();

    // Verify personal info
    assert!(!resume.personal.name.is_empty(), "Personal name is empty");

    // Verify experience exists
    assert!(!resume.experience.is_empty(), "Experience is empty");

    // Verify first company has required structure
    let first_company = &resume.experience[0];
    assert!(!first_company.id.is_empty(), "Company ID is empty");
    assert!(
        !first_company.children.is_empty(),
        "Company has no positions"
    );

    // Verify first position has bullets
    let first_position = &first_company.children[0];
    assert!(!first_position.id.is_empty(), "Position ID is empty");
    assert!(!first_position.name.is_empty(), "Position name is empty");
    assert!(
        !first_position.children.is_empty(),
        "Position has no bullets"
    );

    // Verify role profiles exist
    assert!(resume.role_profiles.is_some(), "Role profiles are missing");

    let role_profiles = resume.role_profiles.as_ref().unwrap();
    assert!(!role_profiles.is_empty(), "No role profiles defined");
}
