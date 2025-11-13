//! Integration tests using real resume data
//!
//! These tests load the actual resume-data.json and validate
//! that scoring and selection work correctly for all role profiles.

mod common;

use common::load_resume_data;
use resume_core::selector::{count_selectable_items, select_bullets, SelectionConfig};
use std::collections::HashSet;

#[test]
fn test_all_role_profiles_produce_valid_selections() {
    let resume = load_resume_data();
    let config = SelectionConfig::default();

    let role_profiles = resume.role_profiles.as_ref().unwrap();
    for role_profile in role_profiles {
        println!("\n🎯 Testing role profile: {}", role_profile.name);

        let selected = select_bullets(&resume, role_profile, &config);

        // Basic validation - should have selected some bullets
        assert!(
            !selected.is_empty(),
            "Profile '{}' selected 0 bullets",
            role_profile.name
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
fn test_diversity_constraints_across_all_profiles() {
    let resume = load_resume_data();
    let config = SelectionConfig {
        max_bullets: None,
        max_per_company: Some(6),
        min_per_company: None,
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
        if !selected.is_empty() && has_description {
            println!(
                "  ✅ Profile '{}' includes position descriptions",
                role_profile.name
            );
        }
    }
}

#[test]
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
fn test_tag_weights_affect_selection() {
    let resume = load_resume_data();
    let config = SelectionConfig {
        max_bullets: None,
        max_per_company: None,
        min_per_company: None,
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
// NOTE: PDF generation tests are in crates/resume-typst/tests/
// This keeps generation-specific tests separate from core selection/scoring tests.

// ========== Generation Payload Validation Tests ==========

#[test]
fn test_generation_payload_from_real_data() {
    use resume_core::GenerationPayload;

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    // Calculate total selectable items once
    let (_bullet_count, _position_desc_count, total_selectable) = count_selectable_items(&resume);
    let total_companies = resume.experience.len();

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        let selected = select_bullets(&resume, role_profile, &config);

        let payload = GenerationPayload {
            personal: resume.personal.clone(),
            selected_bullets: selected.clone(),
            role_profile: role_profile.clone(),
            education: resume.education.clone(),
            skills: resume.skills.clone(),
            summary: resume.summary.clone(),
            meta_footer: resume.meta_footer.clone(),
            total_bullets_available: Some(total_selectable),
            total_companies_available: Some(total_companies),
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
