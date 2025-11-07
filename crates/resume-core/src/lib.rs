//! # resume-core
//!
//! Core selection algorithms and types for resume document generation.
//!
//! Types are re-exported from the `shared-types` crate (single source of truth).

use serde::{Deserialize, Serialize};

// Re-export types from shared-types crate
pub use shared_types::*;

pub mod scoring;
pub mod selector;

// =============================================================================
// GENERATION PAYLOAD TYPES
// =============================================================================

/// Payload for document generation (PDF, DOCX, etc.)
///
/// Contains all data needed to generate a targeted resume document.
/// This is the data structure that generation functions receive.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GenerationPayload {
    /// Personal contact information
    pub personal: PersonalInfo,

    /// Selected bullets with scoring metadata
    pub selected_bullets: Vec<scoring::ScoredBullet>,

    /// Role profile used for selection
    pub role_profile: RoleProfile,

    /// Optional: Education history
    #[serde(skip_serializing_if = "Option::is_none")]
    pub education: Option<Vec<Education>>,

    /// Optional: Skills by category
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills: Option<std::collections::HashMap<String, Vec<String>>>,

    /// Optional: Professional summary
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,

    /// Optional: Meta footer text for PDF
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta_footer: Option<String>,

    /// Total bullets available in database (for meta footer template variables)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_bullets_available: Option<usize>,

    /// Total companies in database (for meta footer template variables)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_companies_available: Option<usize>,

    /// Metadata for tracking and reconstruction
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<GenerationMetadata>,
}

/// Metadata for tracking and reconstruction
///
/// Allows recreating exact PDFs from stored generation IDs
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GenerationMetadata {
    /// Unique ID for this generation
    pub generation_id: String,

    /// Timestamp of generation (Unix epoch)
    pub timestamp: u64,

    /// IDs of selected bullets (for reconstruction)
    pub selected_bullet_ids: Vec<String>,

    /// Role profile ID used
    pub role_profile_id: String,
}
