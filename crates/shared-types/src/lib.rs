//! Resumate type definitions - source of truth for the entire project.
//!
//! These types define the hierarchical resume data structure:
//! **Company → Position → Bullet**
//!
//! All levels share identical field names (id, name, location, date_start, date_end,
//! summary, description, tags, priority, link) with varying optionality.
//!
//! Types are generated into JSON Schema and TypeScript for cross-language compatibility.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Tag type - string label for categorizing experience items
pub type Tag = String;

// =============================================================================
// HIERARCHICAL EXPERIENCE TYPES
// =============================================================================

/// Company - top level of experience hierarchy
///
/// Represents a company/organization where you worked.
/// Contains positions (roles) held at this company.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Company {
    #[schemars(
        description = "Unique identifier (required)",
        example = "company_id_example"
    )]
    pub id: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Company name (optional)",
        example = "company_name_example"
    )]
    pub name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Physical location (optional)",
        example = "location_example"
    )]
    pub location: Option<String>,

    #[schemars(description = "Start date (required)", example = "date_start_example")]
    pub date_start: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "End date or null for Present (optional)",
        example = "date_end_example"
    )]
    pub date_end: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Brief company context (optional)",
        example = "company_summary_example"
    )]
    pub summary: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Detailed description, rarely used at company level (optional)")]
    pub description: Option<String>,

    #[schemars(
        description = "Category tags for filtering and scoring (required)",
        example = "tags_example"
    )]
    pub tags: Vec<Tag>,

    #[schemars(
        description = "Company importance ranking 1-10, higher = more prestigious (required)",
        range(min = 1, max = 10),
        example = "priority_example"
    )]
    pub priority: u8,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Link to company website (optional)",
        example = "url_example"
    )]
    pub link: Option<String>,

    #[schemars(description = "List of Position objects - roles held at this company (required)")]
    pub children: Vec<Position>,
}

fn company_id_example() -> &'static str {
    "anthropic"
}
fn company_name_example() -> &'static str {
    "Anthropic"
}
fn company_summary_example() -> &'static str {
    "AI safety research company"
}

/// Position - middle level of hierarchy (role within a company)
///
/// Represents a specific role/title at a company.
/// Contains bullets (achievements/responsibilities) for this role.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    #[schemars(
        description = "Unique identifier (required)",
        example = "position_id_example"
    )]
    pub id: String,

    #[schemars(
        description = "Job title or role name (required)",
        example = "position_name_example"
    )]
    pub name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Physical location if different from company (optional)",
        example = "location_example"
    )]
    pub location: Option<String>,

    #[schemars(description = "Start date (required)", example = "date_start_example")]
    pub date_start: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "End date or null for Present (optional)",
        example = "date_end_example"
    )]
    pub date_end: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Brief role summary (optional)",
        example = "position_summary_example"
    )]
    pub summary: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Detailed role description shown in resume (optional)")]
    pub description: Option<String>,

    #[schemars(
        description = "Category tags for filtering and scoring (required)",
        example = "tags_example"
    )]
    pub tags: Vec<Tag>,

    #[schemars(
        description = "Position importance ranking 1-10, higher = more senior/relevant (required)",
        range(min = 1, max = 10),
        example = "priority_example"
    )]
    pub priority: u8,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Link to position-specific work or context (optional)",
        example = "url_example"
    )]
    pub link: Option<String>,

    #[schemars(
        description = "List of Bullet objects - achievements/responsibilities for this role (required)"
    )]
    pub children: Vec<Bullet>,
}

fn position_id_example() -> &'static str {
    "anthropic-swe"
}
fn position_name_example() -> &'static str {
    "Software Engineer"
}
fn position_summary_example() -> &'static str {
    "Led team of 5 engineers building developer tools"
}

/// Bullet - leaf level of hierarchy (individual achievement/responsibility)
///
/// Represents a single resume bullet point.
/// This is the atomic unit of experience that gets selected for targeted resumes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Bullet {
    #[schemars(
        description = "Unique identifier (required)",
        example = "bullet_id_example"
    )]
    pub id: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Optional heading or label, rarely used (optional)")]
    pub name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Physical location, rarely used at bullet level (optional)")]
    pub location: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Start date for time-bound achievements (optional)",
        example = "date_start_example"
    )]
    pub date_start: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "End date for time-bound achievements (optional)",
        example = "date_end_example"
    )]
    pub date_end: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Brief context for this achievement (optional)")]
    pub summary: Option<String>,

    #[schemars(
        description = "The actual bullet text that appears on resume (required)",
        example = "bullet_description_example"
    )]
    pub description: String,

    #[schemars(
        description = "Category tags for filtering and scoring (required)",
        example = "tags_example"
    )]
    pub tags: Vec<Tag>,

    #[schemars(
        description = "Bullet importance ranking 1-10, higher = more impressive/relevant (required)",
        range(min = 1, max = 10),
        example = "priority_example"
    )]
    pub priority: u8,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Link to work, recording, demo, or additional context (optional)",
        example = "url_example"
    )]
    pub link: Option<String>,
}

fn bullet_id_example() -> &'static str {
    "anthropic-launched-claude"
}
fn bullet_description_example() -> &'static str {
    "Built distributed system handling 10M requests/day with 99.9% uptime"
}

// Shared example functions
fn location_example() -> &'static str {
    "San Francisco, CA"
}
fn date_start_example() -> &'static str {
    "January 2020"
}
fn date_end_example() -> &'static str {
    "December 2023"
}
fn tags_example() -> Vec<String> {
    vec!["engineering".to_string(), "leadership".to_string()]
}
fn priority_example() -> &'static str {
    "9"
}
fn url_example() -> &'static str {
    "https://example.com"
}

// =============================================================================
// VALIDATION METHODS
// =============================================================================

impl Company {
    /// Validate company has required fields and at least one position
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("Company ID cannot be empty".to_string());
        }
        if self.date_start.is_empty() {
            return Err(format!("Company '{}': date_start cannot be empty", self.id));
        }
        if self.children.is_empty() {
            return Err(format!(
                "Company '{}': must have at least one position",
                self.id
            ));
        }
        for (i, position) in self.children.iter().enumerate() {
            position
                .validate()
                .map_err(|e| format!("Company '{}' → position[{}]: {}", self.id, i, e))?;
        }
        Ok(())
    }
}

impl Position {
    /// Validate position has required fields and at least one bullet
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("Position ID cannot be empty".to_string());
        }
        if self.name.is_empty() {
            return Err(format!("Position '{}': name cannot be empty", self.id));
        }
        if self.date_start.is_empty() {
            return Err(format!(
                "Position '{}': date_start cannot be empty",
                self.id
            ));
        }
        if self.children.is_empty() {
            return Err(format!(
                "Position '{}': must have at least one bullet",
                self.id
            ));
        }
        for (i, bullet) in self.children.iter().enumerate() {
            bullet
                .validate()
                .map_err(|e| format!("Position '{}' → bullet[{}]: {}", self.id, i, e))?;
        }
        Ok(())
    }
}

impl Bullet {
    /// Validate bullet has required fields
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("Bullet ID cannot be empty".to_string());
        }
        if self.priority < 1 || self.priority > 10 {
            return Err(format!(
                "Bullet '{}': priority must be 1-10, got {}",
                self.id, self.priority
            ));
        }
        if self.description.is_empty() {
            return Err(format!(
                "Bullet '{}': must have non-empty description text",
                self.id
            ));
        }
        Ok(())
    }
}

// =============================================================================
// ROLE PROFILES & SCORING
// =============================================================================

/// Role profile for targeted resume generation
///
/// Defines which tags/skills are most relevant for a specific role type,
/// and how to weight different scoring components when selecting bullets.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RoleProfile {
    #[schemars(
        description = "Unique identifier (required)",
        example = "role_profile_id_example"
    )]
    pub id: String,

    #[schemars(
        description = "Display name for this role type (required)",
        example = "role_profile_name_example"
    )]
    pub name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Optional description of this role type (optional)")]
    pub description: Option<String>,

    #[schemars(
        description = "Map of tag names to relevance weights 0.0-1.0, higher = more relevant (required)"
    )]
    pub tag_weights: HashMap<Tag, f32>,

    #[schemars(description = "Weights for scoring algorithm components (required)")]
    pub scoring_weights: ScoringWeights,
}

fn role_profile_id_example() -> &'static str {
    "software-engineer"
}
fn role_profile_name_example() -> &'static str {
    "Software Engineer"
}

/// Scoring weights for bullet selection algorithm
///
/// Defines how to weight different factors when scoring bullets.
/// All weights should sum to approximately 1.0.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScoringWeights {
    #[schemars(
        description = "Weight for tag relevance 0.0-1.0 (required)",
        range(min = 0.0, max = 1.0),
        example = "scoring_tag_relevance_example"
    )]
    pub tag_relevance: f32,

    #[schemars(
        description = "Weight for manual priority 0.0-1.0 (required)",
        range(min = 0.0, max = 1.0),
        example = "scoring_priority_example"
    )]
    pub priority: f32,
}

fn scoring_tag_relevance_example() -> &'static str {
    "0.6"
}
fn scoring_priority_example() -> &'static str {
    "0.4"
}

impl ScoringWeights {
    /// Normalize weights to sum to 1.0
    ///
    /// Returns normalized weights and optional warning message if normalization was needed.
    pub fn normalize(&self) -> (ScoringWeights, Option<String>) {
        let sum = self.tag_relevance + self.priority;
        if (sum - 1.0).abs() < 0.001 {
            return (self.clone(), None);
        }

        let normalized = ScoringWeights {
            tag_relevance: self.tag_relevance / sum,
            priority: self.priority / sum,
        };

        let message = format!(
            "Normalized scoring weights from {:.3} to 1.0 (tag_relevance: {:.2} → {:.2}, priority: {:.2} → {:.2})",
            sum, self.tag_relevance, normalized.tag_relevance, self.priority, normalized.priority
        );

        (normalized, Some(message))
    }

    /// Validate weights sum to approximately 1.0 and are non-negative
    pub fn validate(&self) -> Result<(), String> {
        if self.tag_relevance < 0.0 || self.priority < 0.0 {
            return Err(format!(
                "Scoring weights cannot be negative (tag_relevance: {:.2}, priority: {:.2})",
                self.tag_relevance, self.priority
            ));
        }

        let sum = self.tag_relevance + self.priority;
        if (sum - 1.0).abs() > 0.01 {
            return Err(format!(
                "Scoring weights must sum to ~1.0, got {:.3} (tag_relevance: {:.2}, priority: {:.2})",
                sum, self.tag_relevance, self.priority
            ));
        }

        Ok(())
    }
}

// =============================================================================
// TOP-LEVEL RESUME DATA
// =============================================================================

/// Complete resume data structure
///
/// Top-level container for all resume information.
/// This is the root object stored in resume-data.json.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ResumeData {
    #[schemars(description = "Personal information (required)")]
    pub personal: PersonalInfo,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Professional summary 2-3 sentences (optional)")]
    pub summary: Option<String>,

    #[schemars(description = "List of Company objects - work experience (required)")]
    pub experience: Vec<Company>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "List of Education objects - degrees earned (optional)")]
    pub education: Option<Vec<Education>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Skills grouped by category (optional)")]
    pub skills: Option<HashMap<String, Vec<String>>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "List of RoleProfile objects for targeted resume generation (optional)"
    )]
    pub role_profiles: Option<Vec<RoleProfile>>,
}

impl ResumeData {
    /// Validate entire resume data structure
    ///
    /// Recursively validates all companies, positions, bullets, and role profiles.
    /// Returns detailed error messages with hierarchical context.
    pub fn validate(&self) -> Result<(), String> {
        // Validate personal info
        if self.personal.name.is_empty() {
            return Err("Personal info: name cannot be empty".to_string());
        }

        // Validate experience
        if self.experience.is_empty() {
            return Err("Resume must have at least one company in experience".to_string());
        }

        for (i, company) in self.experience.iter().enumerate() {
            company
                .validate()
                .map_err(|e| format!("Experience[{}]: {}", i, e))?;
        }

        // Validate role profiles
        if let Some(profiles) = &self.role_profiles {
            for (i, profile) in profiles.iter().enumerate() {
                profile
                    .scoring_weights
                    .validate()
                    .map_err(|e| format!("Role profile[{}] '{}': {}", i, profile.id, e))?;
            }
        }

        Ok(())
    }
}

/// Personal information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PersonalInfo {
    #[schemars(
        description = "Full name (required)",
        example = "personal_name_example"
    )]
    pub name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Nickname or preferred name (optional)")]
    pub nickname: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Professional tagline or motto (optional)",
        example = "personal_tagline_example"
    )]
    pub tagline: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Email address (optional)",
        example = "personal_email_example"
    )]
    pub email: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Phone number (optional)")]
    pub phone: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Current location (optional)",
        example = "location_example"
    )]
    pub location: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "LinkedIn profile URL (optional)",
        example = "url_example"
    )]
    pub linkedin: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "GitHub profile URL (optional)", example = "url_example")]
    pub github: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Personal website URL (optional)",
        example = "url_example"
    )]
    pub website: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(
        description = "Twitter/X profile URL (optional)",
        example = "url_example"
    )]
    pub twitter: Option<String>,
}

fn personal_name_example() -> &'static str {
    "Jane Doe"
}
fn personal_tagline_example() -> &'static str {
    "Building the future of AI"
}
fn personal_email_example() -> &'static str {
    "jane@example.com"
}

/// Education entry
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Education {
    #[schemars(description = "Full degree name (required)")]
    pub degree: String,

    #[schemars(description = "Degree type (required)")]
    pub degree_type: String,

    #[schemars(description = "Institution name (required)")]
    pub institution: String,

    #[schemars(description = "Institution location (required)")]
    pub location: String,

    #[schemars(description = "Year graduated (required)")]
    pub year: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Relevant coursework (optional)")]
    pub coursework: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(description = "Clubs, societies, and activities (optional)")]
    pub societies: Option<Vec<String>>,
}
