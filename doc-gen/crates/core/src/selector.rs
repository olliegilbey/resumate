//! Bullet Selection Algorithm
//!
//! Select top N bullets from resume data based on role profile scoring

use crate::scoring::{score_bullet, ScoredBullet};
use crate::{Company, Position, ResumeData, RoleProfile};

/// Configuration for bullet selection
pub struct SelectionConfig {
    /// Maximum bullets to select
    pub max_bullets: usize,
    /// Maximum bullets per company (for diversity)
    pub max_per_company: Option<usize>,
    /// Maximum bullets per position
    pub max_per_position: Option<usize>,
}

impl Default for SelectionConfig {
    fn default() -> Self {
        SelectionConfig {
            max_bullets: 18,
            max_per_company: Some(6),
            max_per_position: Some(4),
        }
    }
}

/// Select top bullets from resume data for given role profile
pub fn select_bullets(
    resume_data: &ResumeData,
    role_profile: &RoleProfile,
    config: &SelectionConfig,
) -> Vec<ScoredBullet> {
    // Collect all bullets with scores
    let mut all_bullets: Vec<ScoredBullet> = vec![];

    for company in &resume_data.experience {
        for position in &company.children {
            // Score position description as a bullet (if it has one)
            if position.description.is_some() {
                let desc_bullet = score_description_as_bullet(position, company, role_profile);
                all_bullets.push(desc_bullet);
            }

            // Score all regular bullets
            for bullet in &position.children {
                let score = score_bullet(bullet, position, company, role_profile);
                all_bullets.push(ScoredBullet {
                    bullet: bullet.clone(),
                    score,
                    company_id: company.id.clone(),
                    company_name: company.name.clone(),
                    position_id: position.id.clone(),
                    position_name: position.name.clone(),
                });
            }
        }
    }

    // Sort by score descending
    all_bullets.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

    // Apply diversity constraints
    apply_diversity_constraints(all_bullets, config)
}

/// Convert position description to scored bullet
fn score_description_as_bullet(
    position: &Position,
    company: &Company,
    role_profile: &RoleProfile,
) -> ScoredBullet {
    use crate::Bullet;

    let desc_as_bullet = Bullet {
        id: format!("{}-description", position.id),
        name: None,
        location: None,
        date_start: None,
        date_end: None,
        summary: None,
        description: position.description.clone().unwrap_or_default(),
        tags: position.tags.clone(),
        priority: position.priority,
        link: None,
    };

    let score = score_bullet(&desc_as_bullet, position, company, role_profile);

    ScoredBullet {
        bullet: desc_as_bullet,
        score,
        company_id: company.id.clone(),
        company_name: company.name.clone(),
        position_id: position.id.clone(),
        position_name: position.name.clone(),
    }
}

/// Apply diversity constraints to bullet selection
fn apply_diversity_constraints(
    sorted_bullets: Vec<ScoredBullet>,
    config: &SelectionConfig,
) -> Vec<ScoredBullet> {
    use std::collections::HashMap;

    let mut selected = Vec::new();
    let mut company_counts: HashMap<String, usize> = HashMap::new();
    let mut position_counts: HashMap<String, usize> = HashMap::new();

    for bullet in sorted_bullets {
        // Check total limit
        if selected.len() >= config.max_bullets {
            break;
        }

        // Check per-company limit
        if let Some(max_per_company) = config.max_per_company {
            let company_count = company_counts.get(&bullet.company_id).unwrap_or(&0);
            if *company_count >= max_per_company {
                continue;
            }
        }

        // Check per-position limit
        if let Some(max_per_position) = config.max_per_position {
            let position_count = position_counts.get(&bullet.position_id).unwrap_or(&0);
            if *position_count >= max_per_position {
                continue;
            }
        }

        // Add bullet and increment counters
        *company_counts.entry(bullet.company_id.clone()).or_insert(0) += 1;
        *position_counts
            .entry(bullet.position_id.clone())
            .or_insert(0) += 1;
        selected.push(bullet);
    }

    selected
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Bullet, PersonalInfo, ScoringWeights};
    use std::collections::HashMap;

    fn create_test_resume() -> ResumeData {
        let mut tag_weights = HashMap::new();
        tag_weights.insert("engineering".to_string(), 1.0);
        tag_weights.insert("leadership".to_string(), 0.9);

        ResumeData {
            personal: PersonalInfo {
                name: "Test".to_string(),
                nickname: None,
                tagline: None,
                email: Some("test@test.com".to_string()),
                phone: Some("+1234".to_string()),
                location: Some("Test".to_string()),
                linkedin: Some("test".to_string()),
                github: Some("test".to_string()),
                website: Some("test.com".to_string()),
                twitter: None,
            },
            summary: Some("Test".to_string()),
            experience: vec![
                Company {
                    id: "company1".to_string(),
                    name: Some("Company 1".to_string()),
                    location: None,
                    date_start: "2020".to_string(),
                    date_end: Some("2021".to_string()),
                    summary: None,
                    description: None,
                    tags: vec![],
                    priority: 10,
                    link: None,
                    children: vec![Position {
                        id: "pos1".to_string(),
                        name: "Senior Engineer".to_string(),
                        location: None,
                        date_start: "2020".to_string(),
                        date_end: Some("2021".to_string()),
                        summary: None,
                        description: Some("Led engineering team".to_string()),
                        tags: vec!["engineering".to_string(), "leadership".to_string()],
                        priority: 10,
                        link: None,
                        children: vec![
                            Bullet {
                                id: "b1".to_string(),
                                name: None,
                                location: None,
                                date_start: None,
                                date_end: None,
                                summary: None,
                                description: "Built scalable system".to_string(),
                                tags: vec!["engineering".to_string()],
                                priority: 10,
                                link: None,
                            },
                            Bullet {
                                id: "b2".to_string(),
                                name: None,
                                location: None,
                                date_start: None,
                                date_end: None,
                                summary: None,
                                description: "Mentored team".to_string(),
                                tags: vec!["leadership".to_string()],
                                priority: 9,
                                link: None,
                            },
                        ],
                    }],
                },
                Company {
                    id: "company2".to_string(),
                    name: Some("Company 2".to_string()),
                    location: None,
                    date_start: "2019".to_string(),
                    date_end: Some("2020".to_string()),
                    summary: None,
                    description: None,
                    tags: vec![],
                    priority: 5,
                    link: None,
                    children: vec![Position {
                        id: "pos2".to_string(),
                        name: "Junior Dev".to_string(),
                        location: None,
                        date_start: "2019".to_string(),
                        date_end: Some("2020".to_string()),
                        summary: None,
                        description: Some("Wrote code".to_string()),
                        tags: vec![],
                        priority: 5,
                        link: None,
                        children: vec![Bullet {
                            id: "b3".to_string(),
                            name: None,
                            location: None,
                            date_start: None,
                            date_end: None,
                            summary: None,
                            description: "Fixed bugs".to_string(),
                            tags: vec![],
                            priority: 3,
                            link: None,
                        }],
                    }],
                },
            ],
            education: None,
            skills: None,
            role_profiles: Some(vec![RoleProfile {
                id: "test".to_string(),
                name: "Test Role".to_string(),
                description: Some("Test".to_string()),
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            }]),
        }
    }

    #[test]
    fn test_select_bullets_basic() {
        let resume = create_test_resume();
        let role_profile = &resume.role_profiles.as_ref().unwrap()[0];
        let config = SelectionConfig {
            max_bullets: 5,
            max_per_company: None,
            max_per_position: None,
        };

        let selected = select_bullets(&resume, role_profile, &config);

        // Should select top 5 bullets
        assert_eq!(selected.len(), 5);

        // First should be highest scored (b1 from Company 1, high priority company)
        assert!(selected[0].score > selected[1].score);
    }

    #[test]
    fn test_diversity_constraint_per_company() {
        let resume = create_test_resume();
        let role_profile = &resume.role_profiles.as_ref().unwrap()[0];
        let config = SelectionConfig {
            max_bullets: 10,
            max_per_company: Some(2),
            max_per_position: None,
        };

        let selected = select_bullets(&resume, role_profile, &config);

        // Count bullets per company
        let mut counts: HashMap<String, usize> = HashMap::new();
        for bullet in &selected {
            *counts.entry(bullet.company_id.clone()).or_insert(0) += 1;
        }

        // No company should have more than 2 bullets
        for count in counts.values() {
            assert!(*count <= 2);
        }
    }

    #[test]
    fn test_description_included_as_bullet() {
        let resume = create_test_resume();
        let role_profile = &resume.role_profiles.as_ref().unwrap()[0];
        let config = SelectionConfig::default();

        let selected = select_bullets(&resume, role_profile, &config);

        // Should include description bullets (identified by -description suffix)
        let has_description = selected
            .iter()
            .any(|b| b.bullet.id.ends_with("-description"));
        assert!(has_description);
    }

    #[test]
    fn test_selection_respects_max_bullets() {
        let resume = create_test_resume();
        let role_profile = &resume.role_profiles.as_ref().unwrap()[0];

        for max in [1, 5, 10, 20] {
            let config = SelectionConfig {
                max_bullets: max,
                max_per_company: None,
                max_per_position: None,
            };

            let selected = select_bullets(&resume, role_profile, &config);
            assert!(
                selected.len() <= max,
                "Selected {} bullets, expected <= {}",
                selected.len(),
                max
            );
        }
    }

    #[test]
    fn test_selection_is_deterministic() {
        let resume = create_test_resume();
        let role_profile = &resume.role_profiles.as_ref().unwrap()[0];
        let config = SelectionConfig::default();

        let selected1 = select_bullets(&resume, role_profile, &config);
        let selected2 = select_bullets(&resume, role_profile, &config);

        assert_eq!(selected1.len(), selected2.len());
        for (a, b) in selected1.iter().zip(selected2.iter()) {
            assert_eq!(a.bullet.id, b.bullet.id);
            assert_eq!(a.score, b.score);
        }
    }

    #[test]
    fn test_sorted_by_score_descending() {
        let resume = create_test_resume();
        let role_profile = &resume.role_profiles.as_ref().unwrap()[0];
        let config = SelectionConfig {
            max_bullets: 100, // No limit
            max_per_company: None,
            max_per_position: None,
        };

        let selected = select_bullets(&resume, role_profile, &config);

        for i in 0..selected.len() - 1 {
            assert!(
                selected[i].score >= selected[i + 1].score,
                "Scores not descending at index {}: {} vs {}",
                i,
                selected[i].score,
                selected[i + 1].score
            );
        }
    }

    #[test]
    fn test_empty_resume_returns_empty() {
        use std::collections::HashMap;

        let tag_weights = HashMap::new();
        let empty_resume = ResumeData {
            personal: PersonalInfo {
                name: "Test".to_string(),
                nickname: None,
                tagline: None,
                email: Some("test@test.com".to_string()),
                phone: Some("+1234".to_string()),
                location: Some("Test".to_string()),
                linkedin: Some("test".to_string()),
                github: Some("test".to_string()),
                website: Some("test.com".to_string()),
                twitter: None,
            },
            summary: Some("Test".to_string()),
            experience: vec![],
            education: None,
            skills: None,
            role_profiles: Some(vec![RoleProfile {
                id: "test".to_string(),
                name: "Test".to_string(),
                description: Some("Test".to_string()),
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            }]),
        };

        let config = SelectionConfig::default();
        let selected = select_bullets(
            &empty_resume,
            &empty_resume.role_profiles.as_ref().unwrap()[0],
            &config,
        );

        assert_eq!(selected.len(), 0);
    }
}
