//! Bullet Scoring Algorithm
//!
//! Hierarchical scoring: Company × Position × Bullet
//! Models real recruiter behavior: Company name → Job title → Bullets

use crate::{Bullet, Company, Position, RoleProfile, Tag};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Scored bullet with metadata for selection
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoredBullet {
    pub bullet: Bullet,
    pub score: f32,
    pub company_id: String,
    pub company_name: Option<String>,
    pub company_description: Option<String>, // Company context/industry
    pub company_link: Option<String>,        // Company website/link
    pub company_date_start: String,
    pub company_date_end: Option<String>,
    pub company_location: Option<String>,
    pub position_id: String,
    pub position_name: String,
    pub position_description: Option<String>, // Role summary/context (NOT RENDERED)
    pub position_date_start: String,
    pub position_date_end: Option<String>,
}

/// Score a single bullet given role profile and context
pub fn score_bullet(
    bullet: &Bullet,
    position: &Position,
    company: &Company,
    role_profile: &RoleProfile,
) -> f32 {
    let weights = &role_profile.scoring_weights;

    // Tag relevance score (0.0-1.0)
    let tag_score = calculate_tag_relevance(&bullet.tags, &role_profile.tag_weights);

    // Priority score (0.0-1.0)
    let priority_score = bullet.priority as f32 / 10.0;

    // Weighted combination
    let base_score = (tag_score * weights.tag_relevance) + (priority_score * weights.priority);

    // Hierarchical multipliers
    let company_multiplier = calculate_company_multiplier(company);
    let position_multiplier = calculate_position_multiplier(position, &role_profile.tag_weights);

    base_score * company_multiplier * position_multiplier
}

/// Calculate tag relevance score
fn calculate_tag_relevance(bullet_tags: &[Tag], tag_weights: &HashMap<Tag, f32>) -> f32 {
    if bullet_tags.is_empty() || tag_weights.is_empty() {
        return 0.0;
    }

    let mut total_weight = 0.0;
    let mut matched_tags = 0;

    for tag in bullet_tags {
        if let Some(weight) = tag_weights.get(tag) {
            total_weight += weight;
            matched_tags += 1;
        }
    }

    if matched_tags == 0 {
        return 0.0;
    }

    // Average weight of matched tags
    total_weight / matched_tags as f32
}

/// Calculate company prestige multiplier
fn calculate_company_multiplier(company: &Company) -> f32 {
    // Map priority 1-10 to 0.8-1.2 (±20% adjustment)
    0.8 + (company.priority as f32 / 10.0) * 0.4
}

/// Calculate position seniority/relevance multiplier
fn calculate_position_multiplier(position: &Position, tag_weights: &HashMap<Tag, f32>) -> f32 {
    // Base multiplier from priority
    let priority_multiplier = 0.8 + (position.priority as f32 / 10.0) * 0.4;

    // Tag relevance multiplier for position
    let tag_multiplier = if !position.tags.is_empty() {
        let tag_score = calculate_tag_relevance(&position.tags, tag_weights);
        0.9 + (tag_score * 0.2) // 0.9-1.1 range
    } else {
        1.0
    };

    priority_multiplier * tag_multiplier
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ScoringWeights;

    fn create_test_scoring_weights() -> ScoringWeights {
        ScoringWeights {
            tag_relevance: 0.6,
            priority: 0.4,
        }
    }

    fn create_test_tag_weights() -> HashMap<Tag, f32> {
        let mut weights = HashMap::new();
        weights.insert("engineering".to_string(), 1.0);
        weights.insert("leadership".to_string(), 0.9);
        weights.insert("blockchain".to_string(), 0.8);
        weights.insert("product".to_string(), 0.5);
        weights
    }

    fn create_test_role_profile() -> RoleProfile {
        RoleProfile {
            id: "test-role".to_string(),
            name: "Test Role".to_string(),
            description: Some("Test role for scoring".to_string()),
            tag_weights: create_test_tag_weights(),
            scoring_weights: create_test_scoring_weights(),
        }
    }

    #[test]
    fn test_tag_relevance_perfect_match() {
        let tags = vec!["engineering".to_string(), "leadership".to_string()];
        let weights = create_test_tag_weights();

        let score = calculate_tag_relevance(&tags, &weights);

        // Average of 1.0 and 0.9
        assert!((score - 0.95).abs() < 0.01);
    }

    #[test]
    fn test_tag_relevance_partial_match() {
        let tags = vec!["engineering".to_string(), "unknown-tag".to_string()];
        let weights = create_test_tag_weights();

        let score = calculate_tag_relevance(&tags, &weights);

        // Only engineering matches (1.0), so average = 1.0
        assert!((score - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_tag_relevance_no_match() {
        let tags = vec!["unknown-tag".to_string()];
        let weights = create_test_tag_weights();

        let score = calculate_tag_relevance(&tags, &weights);
        assert_eq!(score, 0.0);
    }

    #[test]
    fn test_tag_relevance_empty_tags() {
        let tags: Vec<Tag> = vec![];
        let weights = create_test_tag_weights();

        let score = calculate_tag_relevance(&tags, &weights);
        assert_eq!(score, 0.0);
    }

    #[test]
    fn test_company_multiplier_high_priority() {
        let company = Company {
            id: "test".to_string(),
            name: Some("Test Corp".to_string()),
            location: None,
            date_start: "2020".to_string(),
            date_end: Some("2021".to_string()),
            summary: None,
            description: None,
            tags: vec![],
            priority: 10, // Highest priority
            link: None,
            children: vec![],
        };

        let multiplier = calculate_company_multiplier(&company);
        assert!((multiplier - 1.2).abs() < 0.01); // Should be 1.2 (20% boost)
    }

    #[test]
    fn test_company_multiplier_low_priority() {
        let company = Company {
            id: "test".to_string(),
            name: Some("Test Corp".to_string()),
            location: None,
            date_start: "2020".to_string(),
            date_end: Some("2021".to_string()),
            summary: None,
            description: None,
            tags: vec![],
            priority: 1, // Lowest priority
            link: None,
            children: vec![],
        };

        let multiplier = calculate_company_multiplier(&company);
        assert!((multiplier - 0.84).abs() < 0.01); // Should be 0.84 (16% reduction)
    }

    #[test]
    fn test_company_multiplier_no_priority() {
        let company = Company {
            id: "test".to_string(),
            name: Some("Test Corp".to_string()),
            location: None,
            date_start: "2020".to_string(),
            date_end: Some("2021".to_string()),
            summary: None,
            description: None,
            tags: vec![],
            priority: 5, // Middle priority (neutral)
            link: None,
            children: vec![],
        };

        let multiplier = calculate_company_multiplier(&company);
        assert_eq!(multiplier, 1.0); // Neutral
    }

    #[test]
    fn test_position_multiplier_high_priority_relevant_tags() {
        let position = Position {
            id: "test".to_string(),
            name: "Senior Engineer".to_string(),
            location: None,
            date_start: "2020".to_string(),
            date_end: Some("2021".to_string()),
            summary: None,
            description: Some("Test".to_string()),
            tags: vec!["engineering".to_string(), "leadership".to_string()],
            priority: 10,
            link: None,
            children: vec![],
        };

        let tag_weights = create_test_tag_weights();
        let multiplier = calculate_position_multiplier(&position, &tag_weights);

        // Priority: 1.2, Tag: ~1.09 (0.9 + 0.95*0.2)
        assert!(multiplier > 1.2); // Should be > 1.2
    }

    #[test]
    fn test_score_bullet_high_relevance_high_priority() {
        let bullet = Bullet {
            id: "test".to_string(),
            name: None,
            location: None,
            date_start: None,
            date_end: None,
            summary: None,
            description: "Test bullet".to_string(),
            tags: vec!["engineering".to_string(), "leadership".to_string()],
            priority: 10,
            link: None,
        };

        let position = Position {
            id: "pos".to_string(),
            name: "Senior Engineer".to_string(),
            location: None,
            date_start: "2020".to_string(),
            date_end: Some("2021".to_string()),
            summary: None,
            description: Some("Test".to_string()),
            tags: vec!["engineering".to_string()],
            priority: 9,
            link: None,
            children: vec![],
        };

        let company = Company {
            id: "co".to_string(),
            name: Some("Test Corp".to_string()),
            location: None,
            date_start: "2020".to_string(),
            date_end: Some("2021".to_string()),
            summary: None,
            description: None,
            tags: vec![],
            priority: 8,
            link: None,
            children: vec![],
        };

        let role_profile = create_test_role_profile();

        let score = score_bullet(&bullet, &position, &company, &role_profile);

        // Base: (0.95*0.6 + 1.0*0.4) = 0.97
        // Company mult: ~1.12
        // Position mult: ~1.3
        // Total: ~1.4
        assert!(score > 1.0); // Should be significantly boosted
    }

    #[test]
    fn test_score_bullet_low_relevance_low_priority() {
        let bullet = Bullet {
            id: "test".to_string(),
            name: None,
            location: None,
            date_start: None,
            date_end: None,
            summary: None,
            description: "Test bullet".to_string(),
            tags: vec!["unknown-tag".to_string()],
            priority: 1,
            link: None,
        };

        let position = Position {
            id: "pos".to_string(),
            name: "Junior Role".to_string(),
            location: None,
            date_start: "2020".to_string(),
            date_end: Some("2021".to_string()),
            summary: None,
            description: Some("Test".to_string()),
            tags: vec![],
            priority: 3,
            link: None,
            children: vec![],
        };

        let company = Company {
            id: "co".to_string(),
            name: Some("Startup".to_string()),
            location: None,
            date_start: "2020".to_string(),
            date_end: Some("2021".to_string()),
            summary: None,
            description: None,
            tags: vec![],
            priority: 3,
            link: None,
            children: vec![],
        };

        let role_profile = create_test_role_profile();

        let score = score_bullet(&bullet, &position, &company, &role_profile);

        // Base: (0.0*0.6 + 0.1*0.4) = 0.04
        // Multipliers will reduce further
        assert!(score < 0.1); // Should be very low
    }

    // ========== Property-Based Tests ==========

    #[cfg(test)]
    mod proptests {
        use super::*;
        use proptest::prelude::*;

        prop_compose! {
            fn arb_company()(
                id in "[a-z]{3,10}",
                name in proptest::option::of("[A-Za-z ]{3,30}"),
                priority in 1u8..=10,
                tags in prop::collection::vec("[a-z]{3,10}", 0..5),
            ) -> Company {
                Company {
                    id,
                    name,
                    location: None,
                    date_start: "2020".to_string(),
                    date_end: Some("2023".to_string()),
                    summary: None,
                    description: None,
                    priority,
                    tags,
                    link: None,
                    children: vec![],
                }
            }
        }

        prop_compose! {
            fn arb_position()(
                id in "[a-z]{3,10}",
                name in "[A-Za-z ]{3,30}",
                priority in 1u8..=10,
                tags in prop::collection::vec("[a-z]{3,10}", 0..5),
            ) -> Position {
                Position {
                    id,
                    name,
                    location: None,
                    date_start: "2020".to_string(),
                    date_end: Some("2023".to_string()),
                    summary: None,
                    description: Some("Position description".to_string()),
                    priority,
                    tags,
                    link: None,
                    children: vec![],
                }
            }
        }

        prop_compose! {
            fn arb_bullet()(
                id in "[a-z]{3,10}",
                description in "[A-Za-z ]{10,100}",
                priority in 1u8..=10,
                tags in prop::collection::vec("[a-z]{3,10}", 0..5),
            ) -> Bullet {
                Bullet {
                    id,
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description,
                    priority,
                    tags,
                    link: None,
                }
            }
        }

        prop_compose! {
            fn arb_role_profile()(
                id in "[a-z]{3,10}",
                name in "[A-Za-z ]{3,30}",
                tag_relevance in 0.0f32..=1.0,
                priority_weight in 0.0f32..=1.0,
                tag_weights in prop::collection::hash_map("[a-z]{3,10}", 0.0f32..=1.0, 0..10),
            ) -> RoleProfile {
                // Normalize weights to sum to 1.0
                let total = tag_relevance + priority_weight;
                let normalized_tag = if total > 0.0 { tag_relevance / total } else { 0.5 };
                let normalized_priority = if total > 0.0 { priority_weight / total } else { 0.5 };

                RoleProfile {
                    id,
                    name,
                    description: None,
                    tag_weights,
                    scoring_weights: ScoringWeights {
                        tag_relevance: normalized_tag,
                        priority: normalized_priority,
                    },
                }
            }
        }

        proptest! {
            #[test]
            fn prop_score_is_non_negative(
                bullet in arb_bullet(),
                position in arb_position(),
                company in arb_company(),
                role_profile in arb_role_profile(),
            ) {
                let score = score_bullet(&bullet, &position, &company, &role_profile);
                prop_assert!(score >= 0.0, "Score should never be negative: {}", score);
            }

            #[test]
            fn prop_score_is_finite(
                bullet in arb_bullet(),
                position in arb_position(),
                company in arb_company(),
                role_profile in arb_role_profile(),
            ) {
                let score = score_bullet(&bullet, &position, &company, &role_profile);
                prop_assert!(score.is_finite(), "Score should be finite: {}", score);
            }

            #[test]
            fn prop_company_multiplier_in_range(company in arb_company()) {
                let multiplier = calculate_company_multiplier(&company);
                prop_assert!((0.8..=1.2).contains(&multiplier),
                    "Company multiplier should be in [0.8, 1.2]: {}", multiplier);
            }

            #[test]
            fn prop_position_multiplier_in_range(
                position in arb_position(),
                tag_weights in prop::collection::hash_map("[a-z]{3,10}", 0.0f32..=1.0, 0..10),
            ) {
                let multiplier = calculate_position_multiplier(&position, &tag_weights);
                // Position multiplier combines priority (0.8-1.2) with tag (0.9-1.1)
                prop_assert!((0.7..=1.4).contains(&multiplier),
                    "Position multiplier should be reasonable: {}", multiplier);
            }

            #[test]
            fn prop_tag_relevance_in_range(
                tags in prop::collection::vec("[a-z]{3,10}", 0..10),
                tag_weights in prop::collection::hash_map("[a-z]{3,10}", 0.0f32..=1.0, 0..10),
            ) {
                let score = calculate_tag_relevance(&tags, &tag_weights);
                prop_assert!((0.0..=1.0).contains(&score),
                    "Tag relevance should be in [0.0, 1.0]: {}", score);
            }

            #[test]
            fn prop_higher_priority_means_higher_score(
                mut bullet in arb_bullet(),
                position in arb_position(),
                company in arb_company(),
                role_profile in arb_role_profile(),
            ) {
                // Test with priority 1
                bullet.priority = 1;
                let score_low = score_bullet(&bullet, &position, &company, &role_profile);

                // Test with priority 10
                bullet.priority = 10;
                let score_high = score_bullet(&bullet, &position, &company, &role_profile);

                // Higher priority should generally lead to higher score
                // (unless tag relevance dominates and tags are irrelevant)
                if role_profile.scoring_weights.priority > 0.1 {
                    prop_assert!(score_high >= score_low,
                        "Higher priority should not decrease score (unless tag weights dominate)");
                }
            }

            #[test]
            fn prop_scoring_is_deterministic(
                bullet in arb_bullet(),
                position in arb_position(),
                company in arb_company(),
                role_profile in arb_role_profile(),
            ) {
                let score1 = score_bullet(&bullet, &position, &company, &role_profile);
                let score2 = score_bullet(&bullet, &position, &company, &role_profile);

                prop_assert_eq!(score1, score2,
                    "Scoring should be deterministic");
            }

            #[test]
            fn prop_empty_tags_gives_zero_tag_score(
                tag_weights in prop::collection::hash_map("[a-z]{3,10}", 0.0f32..=1.0, 1..10),
            ) {
                let tags: Vec<Tag> = vec![];
                let score = calculate_tag_relevance(&tags, &tag_weights);
                prop_assert_eq!(score, 0.0,
                    "Empty tags should give zero relevance");
            }
        }
    }
}
