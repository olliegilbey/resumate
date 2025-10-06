//! Core types for resume data structures.
//!
//! These types mirror the TypeScript schema defined in `types/resume.ts`
//! and must maintain 1:1 compatibility for JSON serialization/deserialization.

use serde::{Deserialize, Serialize};

/// Tag type - a string label for categorizing bullets and accomplishments
pub type Tag = String;

/// Individual achievement or responsibility bullet point
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BulletPoint {
    pub id: String,
    /// Exact written bullet text
    pub text: String,
    /// Category tags for filtering and selection
    pub tags: Vec<Tag>,
    /// Manual ranking from 1-10 (higher = more important)
    pub priority: u8,
    /// Extracted metrics for emphasis (e.g., "10x increase", "1M users")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metrics: Option<String>,
    /// Additional detail for future AI curation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    /// Optional link to work/recording/etc
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
}

/// Position/role within a company
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub id: String,
    pub role: String,
    pub date_range: String,
    /// Primary description - the main bullet that defines the position
    pub description: String,
    pub description_tags: Vec<Tag>,
    pub description_priority: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description_metrics: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description_context: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description_link: Option<String>,
    /// Additional achievement bullets for this role
    pub bullets: Vec<BulletPoint>,
}

/// Company with one or more positions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Company {
    pub id: String,
    pub name: String,
    /// Overall date range: earliest to latest position
    pub date_range: String,
    /// Company location (e.g., "London - Remote")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    /// Company-level context (e.g., "Web3 Cloud Infrastructure")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    /// Multiple roles at same company (chronological, newest first)
    pub positions: Vec<Position>,
}

/// Personal contact information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Education {
    pub degree: String,
    /// Degree type (BSc, BComm, etc)
    pub degree_type: String,
    pub institution: String,
    pub location: String,
    pub year: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coursework: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub societies: Option<Vec<String>>,
}

/// Accomplishment, award, or achievement
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Accomplishment {
    pub id: String,
    pub title: String,
    pub description: String,
    pub year: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<Tag>>,
}

/// Skills section
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Skills {
    pub technical: Vec<String>,
    pub soft: Vec<String>,
}

/// Role profile mapping for bullet selection algorithm
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RoleProfile {
    /// Unique identifier (e.g., "developer-relations", "product-management")
    pub id: String,
    /// Display name (e.g., "Developer Relations")
    pub name: String,
    /// Description of the role type
    pub description: String,
    /// Tags with relevance weights (0.0-1.0)
    /// Higher weight = more relevant to this role
    pub tag_weights: std::collections::HashMap<Tag, f32>,
}

/// Complete resume data structure
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResumeData {
    pub personal: PersonalInfo,
    /// Professional summary (2-3 sentences)
    pub summary: String,
    /// Footer motto
    pub tagline: String,
    /// Work experience grouped by company
    pub companies: Vec<Company>,
    pub skills: Skills,
    pub education: Vec<Education>,
    pub accomplishments: Vec<Accomplishment>,
    pub interests: Vec<String>,
    /// Role profiles for AI curation (optional - may be added in Phase 5)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role_profiles: Option<Vec<RoleProfile>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bullet_serialization() {
        let bullet = BulletPoint {
            id: "test-bullet".to_string(),
            text: "Built amazing thing".to_string(),
            tags: vec!["engineering".to_string(), "leadership".to_string()],
            priority: 10,
            metrics: Some("10x increase".to_string()),
            context: None,
            link: None,
        };

        let json = serde_json::to_string(&bullet).unwrap();
        let deserialized: BulletPoint = serde_json::from_str(&json).unwrap();
        assert_eq!(bullet, deserialized);
    }

    #[test]
    fn test_optional_fields_omitted_when_none() {
        let bullet = BulletPoint {
            id: "test".to_string(),
            text: "Test".to_string(),
            tags: vec![],
            priority: 5,
            metrics: None,
            context: None,
            link: None,
        };

        let json = serde_json::to_string(&bullet).unwrap();
        // Optional fields should not appear in JSON when None
        assert!(!json.contains("metrics"));
        assert!(!json.contains("context"));
        assert!(!json.contains("link"));
    }

    #[test]
    fn test_camel_case_serialization() {
        let position = Position {
            id: "test-pos".to_string(),
            role: "Engineer".to_string(),
            date_range: "2020-2021".to_string(),
            description: "Test description".to_string(),
            description_tags: vec![],
            description_priority: 8,
            description_metrics: None,
            description_context: None,
            description_link: None,
            bullets: vec![],
        };

        let json = serde_json::to_string(&position).unwrap();
        // Should use camelCase in JSON
        assert!(json.contains("dateRange"));
        assert!(json.contains("descriptionTags"));
        assert!(json.contains("descriptionPriority"));
        // Should NOT use snake_case
        assert!(!json.contains("date_range"));
        assert!(!json.contains("description_tags"));
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
    fn test_resume_data_with_optional_role_profiles() {
        use std::collections::HashMap;

        let resume_without_profiles = ResumeData {
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
            tagline: "Test tagline".to_string(),
            companies: vec![],
            skills: Skills {
                technical: vec![],
                soft: vec![],
            },
            education: vec![],
            accomplishments: vec![],
            interests: vec![],
            role_profiles: None,
        };

        let json = serde_json::to_string(&resume_without_profiles).unwrap();
        // roleProfiles should not appear when None
        assert!(!json.contains("roleProfiles"));

        // Test with profiles
        let mut tag_weights = HashMap::new();
        tag_weights.insert("engineering".to_string(), 1.0);

        let resume_with_profiles = ResumeData {
            role_profiles: Some(vec![RoleProfile {
                id: "engineer".to_string(),
                name: "Software Engineer".to_string(),
                description: "Software engineering role".to_string(),
                tag_weights,
            }]),
            ..resume_without_profiles
        };

        let json2 = serde_json::to_string(&resume_with_profiles).unwrap();
        assert!(json2.contains("roleProfiles"));
    }
}
