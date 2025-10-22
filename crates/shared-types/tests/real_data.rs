//! Real data validation tests
//!
//! These tests verify that:
//! 1. Actual resume-data.json can be deserialized
//! 2. All real data conforms to type definitions
//! 3. Schema validation passes for production data

use shared_types::*;
use std::fs;
use std::path::PathBuf;

/// Load resume data from the project's data directory
fn load_resume_data() -> Result<ResumeData, Box<dyn std::error::Error>> {
    // Navigate up from crates/shared-types/tests to project root
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let project_root = PathBuf::from(manifest_dir)
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let data_path = project_root.join("data/resume-data.json");

    if !data_path.exists() {
        return Err(format!("Resume data not found at {:?}", data_path).into());
    }

    let json_str = fs::read_to_string(&data_path)?;
    let resume: ResumeData = serde_json::from_str(&json_str)?;

    Ok(resume)
}

#[test]
fn test_real_resume_data_loads() {
    let result = load_resume_data();

    match result {
        Ok(resume) => {
            // Basic structure checks
            assert!(
                !resume.personal.name.is_empty(),
                "Personal name should not be empty"
            );
            assert!(
                !resume.experience.is_empty(),
                "Should have at least one company"
            );
        }
        Err(e) => {
            // If file doesn't exist (e.g., in CI before prebuild), skip test
            if e.to_string().contains("Resume data not found") {
                eprintln!("⚠️  Skipping test - resume-data.json not found (run `npm run data:pull` first)");
            } else {
                panic!("Failed to load resume data: {}", e);
            }
        }
    }
}

#[test]
fn test_real_data_hierarchy() {
    let result = load_resume_data();
    if result.is_err() {
        eprintln!("⚠️  Skipping test - resume-data.json not available");
        return;
    }

    let resume = result.unwrap();

    // Verify hierarchy: Company → Position → Bullet
    for company in &resume.experience {
        assert!(!company.id.is_empty(), "Company ID should not be empty");
        assert!(
            !company.children.is_empty(),
            "Company should have at least one position"
        );

        for position in &company.children {
            assert!(!position.id.is_empty(), "Position ID should not be empty");
            assert!(
                !position.name.is_empty(),
                "Position name should not be empty"
            );

            // Positions MAY have bullets (description-only positions are valid)
            for bullet in &position.children {
                assert!(!bullet.id.is_empty(), "Bullet ID should not be empty");
                assert!(
                    !bullet.description.is_empty(),
                    "Bullet description should not be empty"
                );
                assert!(
                    !bullet.tags.is_empty(),
                    "Bullet should have at least one tag"
                );
                assert!(
                    bullet.priority >= 1 && bullet.priority <= 10,
                    "Bullet priority should be 1-10, got {}",
                    bullet.priority
                );
            }
        }
    }
}

#[test]
fn test_real_data_priorities() {
    let result = load_resume_data();
    if result.is_err() {
        eprintln!("⚠️  Skipping test - resume-data.json not available");
        return;
    }

    let resume = result.unwrap();

    // All priorities should be 1-10
    for company in &resume.experience {
        assert!(
            company.priority >= 1 && company.priority <= 10,
            "Company priority should be 1-10, got {}",
            company.priority
        );

        for position in &company.children {
            assert!(
                position.priority >= 1 && position.priority <= 10,
                "Position priority should be 1-10, got {}",
                position.priority
            );

            for bullet in &position.children {
                assert!(
                    bullet.priority >= 1 && bullet.priority <= 10,
                    "Bullet priority should be 1-10, got {}",
                    bullet.priority
                );
            }
        }
    }
}

#[test]
fn test_real_data_role_profiles() {
    let result = load_resume_data();
    if result.is_err() {
        eprintln!("⚠️  Skipping test - resume-data.json not available");
        return;
    }

    let resume = result.unwrap();

    if let Some(role_profiles) = &resume.role_profiles {
        assert!(
            !role_profiles.is_empty(),
            "Should have at least one role profile"
        );

        for profile in role_profiles {
            assert!(
                !profile.id.is_empty(),
                "Role profile ID should not be empty"
            );
            assert!(
                !profile.name.is_empty(),
                "Role profile name should not be empty"
            );
            assert!(
                !profile.tag_weights.is_empty(),
                "Role profile should have tag weights"
            );

            // Check scoring weights
            let sw = &profile.scoring_weights;
            assert!(
                sw.tag_relevance >= 0.0 && sw.tag_relevance <= 1.0,
                "tagRelevance should be 0-1"
            );
            assert!(
                sw.priority >= 0.0 && sw.priority <= 1.0,
                "priority should be 0-1"
            );

            // Weights should sum to approximately 1.0 (allow small floating point errors)
            let sum = sw.tag_relevance + sw.priority;
            assert!(
                (sum - 1.0).abs() < 0.01,
                "Scoring weights should sum to ~1.0, got {:.3}",
                sum
            );

            // Tag weights should all be 0-1
            for (tag, weight) in &profile.tag_weights {
                assert!(
                    *weight >= 0.0 && *weight <= 1.0,
                    "Tag weight for '{}' should be 0-1, got {}",
                    tag,
                    weight
                );
            }
        }
    }
}

#[test]
fn test_real_data_education() {
    let result = load_resume_data();
    if result.is_err() {
        eprintln!("⚠️  Skipping test - resume-data.json not available");
        return;
    }

    let resume = result.unwrap();

    if let Some(education) = &resume.education {
        for edu in education {
            assert!(
                !edu.institution.is_empty(),
                "Institution should not be empty"
            );
            assert!(!edu.year.is_empty(), "Year should not be empty");
            assert!(!edu.location.is_empty(), "Location should not be empty");
            assert!(
                !edu.degree_type.is_empty(),
                "Degree type should not be empty"
            );
        }
    }
}

#[test]
fn test_real_data_roundtrip() {
    let result = load_resume_data();
    if result.is_err() {
        eprintln!("⚠️  Skipping test - resume-data.json not available");
        return;
    }

    let resume = result.unwrap();

    // Serialize back to JSON
    let json_str = serde_json::to_string_pretty(&resume).expect("Failed to serialize");

    // Deserialize again
    let resume2: ResumeData = serde_json::from_str(&json_str).expect("Failed to deserialize");

    // Basic checks that data survived roundtrip
    assert_eq!(resume.personal.name, resume2.personal.name);
    assert_eq!(resume.experience.len(), resume2.experience.len());
}

#[test]
fn test_real_data_unique_ids() {
    let result = load_resume_data();
    if result.is_err() {
        eprintln!("⚠️  Skipping test - resume-data.json not available");
        return;
    }

    let resume = result.unwrap();

    let mut all_ids = std::collections::HashSet::new();

    // Collect all IDs
    for company in &resume.experience {
        assert!(
            all_ids.insert(&company.id),
            "Duplicate company ID: {}",
            company.id
        );

        for position in &company.children {
            assert!(
                all_ids.insert(&position.id),
                "Duplicate position ID: {}",
                position.id
            );

            for bullet in &position.children {
                assert!(
                    all_ids.insert(&bullet.id),
                    "Duplicate bullet ID: {}",
                    bullet.id
                );
            }
        }
    }

    if let Some(role_profiles) = &resume.role_profiles {
        for profile in role_profiles {
            assert!(
                all_ids.insert(&profile.id),
                "Duplicate role profile ID: {}",
                profile.id
            );
        }
    }
}

#[test]
fn test_real_data_date_formats() {
    let result = load_resume_data();
    if result.is_err() {
        eprintln!("⚠️  Skipping test - resume-data.json not available");
        return;
    }

    let resume = result.unwrap();

    // Dates should be in YYYY or YYYY-MM format
    let date_regex = regex::Regex::new(r"^\d{4}(-\d{2})?$").unwrap();

    for company in &resume.experience {
        assert!(
            date_regex.is_match(&company.date_start),
            "Invalid company dateStart format: {}",
            company.date_start
        );

        if let Some(date_end) = &company.date_end {
            assert!(
                date_regex.is_match(date_end),
                "Invalid company dateEnd format: {}",
                date_end
            );
        }

        for position in &company.children {
            assert!(
                date_regex.is_match(&position.date_start),
                "Invalid position dateStart format: {}",
                position.date_start
            );

            if let Some(date_end) = &position.date_end {
                assert!(
                    date_regex.is_match(date_end),
                    "Invalid position dateEnd format: {}",
                    date_end
                );
            }
        }
    }
}
