//! Resumate type definitions - source of truth for the entire project.
//!
//! These types define the hierarchical resume data structure:
//! **Company → Position → Bullet**
//!
//! All levels share identical field names (id, name, location, date_start, date_end,
//! summary, description, tags, priority, link) with varying optionality.
//!
//! Types are generated into JSON Schema and TypeScript for cross-language compatibility.
//!
//! # Features
//! - `schema`: Enable JSON Schema generation via schemars (not needed for runtime/WASM)

#[cfg(feature = "schema")]
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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "schema", derive(JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct Company {
    #[cfg_attr(feature = "schema", schemars(
        description = "Unique identifier (required)",
        example = company_id_example()
    ))]
    pub id: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Company name (optional)",
        example = company_name_example()
    ))]
    pub name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Physical location (optional)",
        example = location_example()
    ))]
    pub location: Option<String>,

    #[cfg_attr(feature = "schema", schemars(description = "Start date (required)", example = date_start_example()))]
    pub date_start: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "End date or null for Present (optional)",
        example = date_end_example()
    ))]
    pub date_end: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Brief company context (optional)",
        example = company_summary_example()
    ))]
    pub summary: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Detailed description, rarely used at company level (optional)")
    )]
    pub description: Option<String>,

    #[cfg_attr(feature = "schema", schemars(
        description = "Category tags for filtering and scoring (required)",
        example = tags_example()
    ))]
    pub tags: Vec<Tag>,

    #[cfg_attr(feature = "schema", schemars(
        description = "Company importance ranking 1-10, higher = more prestigious (required)",
        range(min = 1, max = 10),
        example = priority_example()
    ))]
    pub priority: u8,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Link to company website (optional)",
        example = url_example()
    ))]
    pub link: Option<String>,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "List of Position objects - roles held at this company (required)")
    )]
    pub children: Vec<Position>,
}

#[cfg(feature = "schema")]
fn company_id_example() -> &'static str {
    "anthropic"
}
#[cfg(feature = "schema")]
fn company_name_example() -> &'static str {
    "Anthropic"
}
#[cfg(feature = "schema")]
fn company_summary_example() -> &'static str {
    "AI safety research company"
}

/// Position - middle level of hierarchy (role within a company)
///
/// Represents a specific role/title at a company.
/// Contains bullets (achievements/responsibilities) for this role.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "schema", derive(JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct Position {
    #[cfg_attr(feature = "schema", schemars(
        description = "Unique identifier (required)",
        example = position_id_example()
    ))]
    pub id: String,

    #[cfg_attr(feature = "schema", schemars(
        description = "Job title or role name (required)",
        example = position_name_example()
    ))]
    pub name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Physical location if different from company (optional)",
        example = location_example()
    ))]
    pub location: Option<String>,

    #[cfg_attr(feature = "schema", schemars(description = "Start date (required)", example = date_start_example()))]
    pub date_start: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "End date or null for Present (optional)",
        example = date_end_example()
    ))]
    pub date_end: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Brief role summary (optional)",
        example = position_summary_example()
    ))]
    pub summary: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Detailed role description shown in resume (optional)")
    )]
    pub description: Option<String>,

    #[cfg_attr(feature = "schema", schemars(
        description = "Category tags for filtering and scoring (required)",
        example = tags_example()
    ))]
    pub tags: Vec<Tag>,

    #[cfg_attr(feature = "schema", schemars(
        description = "Position importance ranking 1-10, higher = more senior/relevant (required)",
        range(min = 1, max = 10),
        example = priority_example()
    ))]
    pub priority: u8,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Link to position-specific work or context (optional)",
        example = url_example()
    ))]
    pub link: Option<String>,

    #[cfg_attr(
        feature = "schema",
        schemars(
            description = "List of Bullet objects - achievements/responsibilities for this role (required)"
        )
    )]
    pub children: Vec<Bullet>,
}

#[cfg(feature = "schema")]
fn position_id_example() -> &'static str {
    "anthropic-swe"
}
#[cfg(feature = "schema")]
fn position_name_example() -> &'static str {
    "Software Engineer"
}
#[cfg(feature = "schema")]
fn position_summary_example() -> &'static str {
    "Led team of 5 engineers building developer tools"
}

/// Bullet - leaf level of hierarchy (individual achievement/responsibility)
///
/// Represents a single resume bullet point.
/// This is the atomic unit of experience that gets selected for targeted resumes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "schema", derive(JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct Bullet {
    #[cfg_attr(feature = "schema", schemars(
        description = "Unique identifier (required)",
        example = bullet_id_example()
    ))]
    pub id: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Optional heading or label, rarely used (optional)")
    )]
    pub name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Physical location, rarely used at bullet level (optional)")
    )]
    pub location: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Start date for time-bound achievements (optional)",
        example = date_start_example()
    ))]
    pub date_start: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "End date for time-bound achievements (optional)",
        example = date_end_example()
    ))]
    pub date_end: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Brief context for this achievement (optional)")
    )]
    pub summary: Option<String>,

    #[cfg_attr(feature = "schema", schemars(
        description = "The actual bullet text that appears on resume (required)",
        example = bullet_description_example()
    ))]
    pub description: String,

    #[cfg_attr(feature = "schema", schemars(
        description = "Category tags for filtering and scoring (required)",
        example = tags_example()
    ))]
    pub tags: Vec<Tag>,

    #[cfg_attr(feature = "schema", schemars(
        description = "Bullet importance ranking 1-10, higher = more impressive/relevant (required)",
        range(min = 1, max = 10),
        example = priority_example()
    ))]
    pub priority: u8,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Link to work, recording, demo, or additional context (optional)",
        example = url_example()
    ))]
    pub link: Option<String>,
}

#[cfg(feature = "schema")]
fn bullet_id_example() -> &'static str {
    "anthropic-launched-claude"
}
#[cfg(feature = "schema")]
fn bullet_description_example() -> &'static str {
    "Built distributed system handling 10M requests/day with 99.9% uptime"
}

// Shared example functions
#[cfg(feature = "schema")]
fn location_example() -> &'static str {
    "San Francisco, CA"
}
#[cfg(feature = "schema")]
fn date_start_example() -> &'static str {
    "January 2020"
}
#[cfg(feature = "schema")]
fn date_end_example() -> &'static str {
    "December 2023"
}
#[cfg(feature = "schema")]
fn tags_example() -> Vec<String> {
    vec!["engineering".to_string(), "leadership".to_string()]
}
#[cfg(feature = "schema")]
fn priority_example() -> &'static str {
    "9"
}
#[cfg(feature = "schema")]
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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "schema", derive(JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct RoleProfile {
    #[cfg_attr(feature = "schema", schemars(
        description = "Unique identifier (required)",
        example = role_profile_id_example()
    ))]
    pub id: String,

    #[cfg_attr(feature = "schema", schemars(
        description = "Display name for this role type (required)",
        example = role_profile_name_example()
    ))]
    pub name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Optional description of this role type (optional)")
    )]
    pub description: Option<String>,

    #[cfg_attr(
        feature = "schema",
        schemars(
            description = "Map of tag names to relevance weights 0.0-1.0, higher = more relevant (required)"
        )
    )]
    pub tag_weights: HashMap<Tag, f32>,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Weights for scoring algorithm components (required)")
    )]
    pub scoring_weights: ScoringWeights,
}

#[cfg(feature = "schema")]
fn role_profile_id_example() -> &'static str {
    "software-engineer"
}
#[cfg(feature = "schema")]
fn role_profile_name_example() -> &'static str {
    "Software Engineer"
}

/// Scoring weights for bullet selection algorithm
///
/// Defines how to weight different factors when scoring bullets.
/// All weights should sum to approximately 1.0.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "schema", derive(JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct ScoringWeights {
    #[cfg_attr(feature = "schema", schemars(
        description = "Weight for tag relevance 0.0-1.0 (required)",
        range(min = 0.0, max = 1.0),
        example = scoring_tag_relevance_example()
    ))]
    pub tag_relevance: f32,

    #[cfg_attr(feature = "schema", schemars(
        description = "Weight for manual priority 0.0-1.0 (required)",
        range(min = 0.0, max = 1.0),
        example = scoring_priority_example()
    ))]
    pub priority: f32,
}

#[cfg(feature = "schema")]
fn scoring_tag_relevance_example() -> &'static str {
    "0.6"
}
#[cfg(feature = "schema")]
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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "schema", derive(JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct ResumeData {
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Personal information (required)")
    )]
    pub personal: PersonalInfo,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Professional summary 2-3 sentences (optional)")
    )]
    pub summary: Option<String>,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "List of Company objects - work experience (required)")
    )]
    pub experience: Vec<Company>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "List of Education objects - degrees earned (optional)")
    )]
    pub education: Option<Vec<Education>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Skills grouped by category (optional)")
    )]
    pub skills: Option<HashMap<String, Vec<String>>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(
            description = "List of RoleProfile objects for targeted resume generation (optional)"
        )
    )]
    pub role_profiles: Option<Vec<RoleProfile>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(
            description = "Meta footer text for PDF (supports {bullet_count} and {company_count} template variables)"
        )
    )]
    pub meta_footer: Option<String>,
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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "schema", derive(JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct PersonalInfo {
    #[cfg_attr(feature = "schema", schemars(
        description = "Full name (required)",
        example = personal_name_example()
    ))]
    pub name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Nickname or preferred name (optional)")
    )]
    pub nickname: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Professional tagline or motto (optional)",
        example = personal_tagline_example()
    ))]
    pub tagline: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Email address (optional)",
        example = personal_email_example()
    ))]
    pub email: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(description = "Phone number (optional)"))]
    pub phone: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Current location (optional)",
        example = location_example()
    ))]
    pub location: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "LinkedIn profile URL (optional)",
        example = url_example()
    ))]
    pub linkedin: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(description = "GitHub profile URL (optional)", example = url_example()))]
    pub github: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Personal website URL (optional)",
        example = url_example()
    ))]
    pub website: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(
        description = "Twitter/X profile URL (optional)",
        example = url_example()
    ))]
    pub twitter: Option<String>,
}

#[cfg(feature = "schema")]
fn personal_name_example() -> &'static str {
    "Jane Doe"
}
#[cfg(feature = "schema")]
fn personal_tagline_example() -> &'static str {
    "Building the future of AI"
}
#[cfg(feature = "schema")]
fn personal_email_example() -> &'static str {
    "jane@example.com"
}

/// Education entry
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "schema", derive(JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct Education {
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Full degree name (required)")
    )]
    pub degree: String,

    #[cfg_attr(feature = "schema", schemars(description = "Degree type (required)"))]
    pub degree_type: String,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Institution name (required)")
    )]
    pub institution: String,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Institution location (required)")
    )]
    pub location: String,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Year graduated (required)")
    )]
    pub year: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Relevant coursework (optional)")
    )]
    pub coursework: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Clubs, societies, and activities (optional)")
    )]
    pub societies: Option<Vec<String>>,
}

// =============================================================================
// SCORED BULLET (for PDF generation)
// =============================================================================

/// Selected bullet with context for PDF generation
///
/// Contains the bullet plus company/position context needed
/// to render the resume PDF properly.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct ScoredBullet {
    #[cfg_attr(
        feature = "schema",
        schemars(description = "The bullet point (required)")
    )]
    pub bullet: Bullet,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Selection score (required)")
    )]
    pub score: f32,

    #[cfg_attr(feature = "schema", schemars(description = "Company ID (required)"))]
    pub company_id: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "schema", schemars(description = "Company name (optional)"))]
    pub company_name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Company context/industry (optional)")
    )]
    pub company_description: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Company website (optional)")
    )]
    pub company_link: Option<String>,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Company start date (required)")
    )]
    pub company_date_start: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Company end date (optional)")
    )]
    pub company_date_end: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Company location (optional)")
    )]
    pub company_location: Option<String>,

    #[cfg_attr(feature = "schema", schemars(description = "Position ID (required)"))]
    pub position_id: String,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Position/role name (required)")
    )]
    pub position_name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Position description (optional)")
    )]
    pub position_description: Option<String>,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Position start date (required)")
    )]
    pub position_date_start: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Position end date (optional)")
    )]
    pub position_date_end: Option<String>,
}

// =============================================================================
// GENERATION PAYLOAD (for WASM PDF generation)
// =============================================================================

/// Payload for document generation (PDF)
///
/// Contains all data needed to generate a targeted resume document.
/// This is the data structure that the WASM PDF generator receives.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "schema", derive(JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct GenerationPayload {
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Personal contact information (required)")
    )]
    pub personal: PersonalInfo,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Selected bullets with context (required)")
    )]
    pub selected_bullets: Vec<ScoredBullet>,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Role profile used for selection (required)")
    )]
    pub role_profile: RoleProfile,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Education history (optional)")
    )]
    pub education: Option<Vec<Education>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Skills by category (optional)")
    )]
    pub skills: Option<HashMap<String, Vec<String>>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Professional summary (optional)")
    )]
    pub summary: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Meta footer text for PDF (optional)")
    )]
    pub meta_footer: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Total bullets available in database (optional)")
    )]
    pub total_bullets_available: Option<usize>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Total companies in database (optional)")
    )]
    pub total_companies_available: Option<usize>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Generation metadata for tracking (optional)")
    )]
    pub metadata: Option<GenerationMetadata>,
}

/// Metadata for tracking and reconstruction
///
/// Allows recreating exact PDFs from stored generation IDs
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "schema", derive(JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct GenerationMetadata {
    #[cfg_attr(
        feature = "schema",
        schemars(description = "Unique generation ID (required)")
    )]
    pub generation_id: String,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Unix epoch timestamp (required)")
    )]
    pub timestamp: u64,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "IDs of selected bullets (required)")
    )]
    pub selected_bullet_ids: Vec<String>,

    #[cfg_attr(
        feature = "schema",
        schemars(description = "Role profile ID used (required)")
    )]
    pub role_profile_id: String,
}
