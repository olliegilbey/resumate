//! Core types for resume data structures.
//!
//! These types mirror the TypeScript schema defined in `types/resume.ts`
//! and must maintain 1:1 compatibility for JSON serialization/deserialization.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Tag type - a string label for categorizing bullets and accomplishments
pub type Tag = String;

/// Individual achievement or responsibility bullet point
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(description = "Individual achievement or responsibility bullet point")]
pub struct Bullet {
    pub id: String,
    /// The actual bullet text that appears on resume
    #[schemars(description = "The actual bullet text that appears on resume")]
    pub description: String,
    /// Category tags for filtering and selection
    #[schemars(description = "Category tags for filtering and selection")]
    pub tags: Vec<Tag>,
    /// Manual ranking from 1-10 (higher = more important)
    #[schemars(description = "Manual ranking from 1-10 (higher = more important)", range(min = 1, max = 10))]
    pub priority: u8,
    /// Additional context or impact details
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Additional context or impact details")]
    pub summary: Option<String>,
    /// Optional link to work/recording/etc
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
}

/// Backwards compatibility type alias
pub type BulletPoint = Bullet;

/// Position/role within a company
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(description = "Position/role within a company")]
pub struct Position {
    pub id: String,
    /// Job title or role name
    #[schemars(description = "Job title or role name")]
    pub name: String,
    /// Start date (YYYY or YYYY-MM format)
    #[schemars(description = "Start date (YYYY or YYYY-MM format)")]
    pub date_start: String,
    /// End date or null for current
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "End date or null for current")]
    pub date_end: Option<String>,
    /// Role description (can be scored as a bullet)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Role description (can be scored as a bullet)")]
    pub description: Option<String>,
    /// Position importance (1-10, higher = more senior/relevant)
    #[schemars(description = "Position importance (1-10, higher = more senior/relevant)", range(min = 1, max = 10))]
    pub priority: u8,
    /// Category tags for hierarchical scoring
    #[schemars(description = "Category tags for hierarchical scoring")]
    pub tags: Vec<Tag>,
    /// Achievement bullets for this role
    #[schemars(description = "Achievement bullets for this role")]
    pub children: Vec<Bullet>,
}

/// Company with one or more positions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(description = "Company with one or more positions")]
pub struct Company {
    pub id: String,
    /// Company name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Start date (YYYY or YYYY-MM format)
    #[schemars(description = "Start date (YYYY or YYYY-MM format)")]
    pub date_start: String,
    /// End date or null for current
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "End date or null for current")]
    pub date_end: Option<String>,
    /// Office location
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    /// Company context or industry
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Company context or industry")]
    pub description: Option<String>,
    /// Company importance (1-10, higher = more prestigious)
    #[schemars(description = "Company importance (1-10, higher = more prestigious)", range(min = 1, max = 10))]
    pub priority: u8,
    /// Category tags for hierarchical scoring
    #[schemars(description = "Category tags for hierarchical scoring")]
    pub tags: Vec<Tag>,
    /// Positions at this company
    #[schemars(description = "Positions at this company")]
    pub children: Vec<Position>,
}

/// Personal contact information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(description = "Personal contact information")]
pub struct PersonalInfo {
    /// Display name (may be nickname)
    pub name: String,
    /// Full legal name
    pub full_name: String,
    /// Preferred name (e.g., "Ollie" for "Oliver")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nickname: Option<String>,
    pub email: String,
    pub phone: String,
    pub location: String,
    pub citizenship: Vec<String>,
    pub linkedin: String,
    pub github: String,
    pub website: String,
    /// Cal.com or other calendar booking link
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calendar: Option<String>,
}

/// Educational background
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(description = "Educational background")]
pub struct Education {
    /// Full degree name (e.g., "BSc Computer Science")
    #[schemars(description = "Full degree name (e.g., 'BSc Computer Science')")]
    pub degree: String,
    /// Degree type (e.g., "BSc", "BComm", "MS")
    #[schemars(description = "Degree type (e.g., 'BSc', 'BComm', 'MS')")]
    pub degree_type: String,
    pub institution: String,
    pub location: String,
    /// Year graduated (YYYY format)
    #[schemars(description = "Year graduated (YYYY format)")]
    pub year: String,
    /// Relevant coursework
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Relevant coursework")]
    pub coursework: Option<Vec<String>>,
    /// Clubs, societies, and activities
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Clubs, societies, and activities")]
    pub societies: Option<Vec<String>>,
}

/// Skills section
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(description = "Skills section")]
pub struct Skills {
    pub technical: Vec<String>,
    pub soft: Vec<String>,
}

/// Scoring weights for bullet selection algorithm
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(description = "Scoring weights for bullet selection algorithm (must sum to 1.0)")]
pub struct ScoringWeights {
    /// Weight for tag relevance (typically 0.6 = 60%)
    #[schemars(description = "Weight for tag relevance (typically 0.6 = 60%)", range(min = 0.0, max = 1.0))]
    pub tag_relevance: f32,
    /// Weight for priority (typically 0.4 = 40%)
    #[schemars(description = "Weight for priority (typically 0.4 = 40%)", range(min = 0.0, max = 1.0))]
    pub priority: f32,
}

impl ScoringWeights {
    /// Validate that weights sum to 1.0 (strict, for dev/tests)
    pub fn validate_sum(&self) -> Result<(), String> {
        let sum = self.tag_relevance + self.priority;
        let epsilon = 0.001;

        if (sum - 1.0).abs() < epsilon {
            Ok(())
        } else {
            Err(format!(
                "Scoring weights must sum to 1.0, got {:.3} (tagRelevance={:.3}, priority={:.3})",
                sum, self.tag_relevance, self.priority
            ))
        }
    }

    /// Normalize weights to sum to 1.0 (soft, for prod)
    /// Returns (normalized_weights, warning_message)
    pub fn normalize(&self) -> (ScoringWeights, Option<String>) {
        let sum = self.tag_relevance + self.priority;
        let epsilon = 0.001;

        // Already valid
        if (sum - 1.0).abs() < epsilon {
            return (self.clone(), None);
        }

        // Normalize
        let normalized = ScoringWeights {
            tag_relevance: self.tag_relevance / sum,
            priority: self.priority / sum,
        };

        let warning = format!(
            "⚠️  Scoring weights sum to {:.3} (expected 1.0). Normalized to tagRelevance={:.3}, priority={:.3}",
            sum, normalized.tag_relevance, normalized.priority
        );

        (normalized, Some(warning))
    }
}

/// Role profile mapping for bullet selection algorithm
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(description = "Role profile mapping for bullet selection algorithm")]
pub struct RoleProfile {
    /// Unique identifier (e.g., "developer-relations", "product-management")
    #[schemars(description = "Unique identifier (e.g., 'developer-relations', 'product-management')")]
    pub id: String,
    /// Display name (e.g., "Developer Relations")
    #[schemars(description = "Display name (e.g., 'Developer Relations')")]
    pub name: String,
    /// Description of the role type
    #[schemars(description = "Description of the role type")]
    pub description: String,
    /// Tags with relevance weights (0.0-1.0)
    /// Higher weight = more relevant to this role
    #[schemars(description = "Tags with relevance weights (0.0-1.0). Higher weight = more relevant to this role")]
    pub tag_weights: std::collections::HashMap<Tag, f32>,
    /// Configurable weights for scoring algorithm
    #[schemars(description = "Configurable weights for scoring algorithm")]
    pub scoring_weights: ScoringWeights,
}

/// Complete resume data structure (Compendium)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(description = "Complete resume data structure (Compendium)")]
pub struct ResumeData {
    pub personal: PersonalInfo,
    /// Professional summary (2-3 sentences)
    pub summary: String,
    /// Work experience (companies with positions and bullets)
    #[schemars(description = "Work experience (companies with positions and bullets)")]
    pub experience: Vec<Company>,
    /// Skills section
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills: Option<Skills>,
    /// Education history
    #[serde(skip_serializing_if = "Option::is_none")]
    pub education: Option<Vec<Education>>,
    /// Role profiles for bullet selection algorithm
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Role profiles for bullet selection algorithm")]
    pub role_profiles: Option<Vec<RoleProfile>>,
    /// Meta footer text for PDF (supports {bullet_count} and {company_count} variables)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Meta footer text for PDF (supports {bullet_count} and {company_count} variables)")]
    pub meta_footer: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bullet_serialization() {
        let bullet = Bullet {
            id: "test-bullet".to_string(),
            description: "Built amazing thing".to_string(),
            tags: vec!["engineering".to_string(), "leadership".to_string()],
            priority: 10,
            summary: Some("Additional context about this achievement".to_string()),
            link: None,
        };

        let json = serde_json::to_string(&bullet).unwrap();
        let deserialized: Bullet = serde_json::from_str(&json).unwrap();
        assert_eq!(bullet, deserialized);
    }

    #[test]
    fn test_optional_fields_omitted_when_none() {
        let bullet = Bullet {
            id: "test".to_string(),
            description: "Test".to_string(),
            tags: vec![],
            priority: 5,
            summary: None,
            link: None,
        };

        let json = serde_json::to_string(&bullet).unwrap();
        // Optional fields should not appear in JSON when None
        assert!(!json.contains("summary"));
        assert!(!json.contains("link"));
    }

    #[test]
    fn test_camel_case_serialization() {
        let position = Position {
            id: "test-pos".to_string(),
            name: "Engineer".to_string(),
            date_start: "2020-01".to_string(),
            date_end: Some("2021-12".to_string()),
            description: Some("Test description".to_string()),
            priority: 8,
            tags: vec!["engineering".to_string()],
            children: vec![],
        };

        let json = serde_json::to_string(&position).unwrap();
        // Should use camelCase in JSON
        assert!(json.contains("dateStart"));
        assert!(json.contains("dateEnd"));
        // Should NOT use snake_case
        assert!(!json.contains("date_start"));
        assert!(!json.contains("date_end"));
    }

    #[test]
    fn test_role_profile_with_tag_weights() {
        use std::collections::HashMap;

        let mut tag_weights = HashMap::new();
        tag_weights.insert("developer-relations".to_string(), 1.0);
        tag_weights.insert("engineering".to_string(), 0.8);
        tag_weights.insert("product".to_string(), 0.3);

        let profile = RoleProfile {
            id: "devrel".to_string(),
            name: "Developer Relations".to_string(),
            description: "Developer advocacy and community building".to_string(),
            tag_weights,
            scoring_weights: ScoringWeights {
                tag_relevance: 0.6,
                priority: 0.4,
            },
        };

        let json = serde_json::to_string(&profile).unwrap();
        let deserialized: RoleProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(profile, deserialized);
        assert_eq!(
            deserialized.tag_weights.get("developer-relations"),
            Some(&1.0)
        );
    }

    #[test]
    fn test_resume_data_with_role_profiles() {
        use std::collections::HashMap;

        let mut tag_weights = HashMap::new();
        tag_weights.insert("engineering".to_string(), 1.0);

        let resume = ResumeData {
            personal: PersonalInfo {
                name: "Test User".to_string(),
                full_name: "Test Full Name".to_string(),
                nickname: None,
                email: "test@example.com".to_string(),
                phone: "+1234567890".to_string(),
                location: "Test City".to_string(),
                citizenship: vec!["Country".to_string()],
                linkedin: "testuser".to_string(),
                github: "testuser".to_string(),
                website: "example.com".to_string(),
                calendar: None,
            },
            summary: "Test summary".to_string(),
            experience: vec![],
            skills: Some(Skills {
                technical: vec![],
                soft: vec![],
            }),
            education: None,
            role_profiles: Some(vec![RoleProfile {
                id: "engineer".to_string(),
                name: "Software Engineer".to_string(),
                description: "Software engineering role".to_string(),
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            }]),
        };

        let json = serde_json::to_string(&resume).unwrap();
        assert!(json.contains("roleProfiles"));
        assert!(json.contains("scoringWeights"));
        assert!(json.contains("experience"));
    }
}
