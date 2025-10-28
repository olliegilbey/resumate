//! Template rendering utilities for Typst resume generation
//!
//! This module provides helper functions for preparing data and formatting
//! content for injection into the Typst template.

use chrono::NaiveDate;
use docgen_core::scoring::ScoredBullet;
use docgen_core::GenerationPayload;
use serde_json::Value as JsonValue;
use std::collections::HashMap;

/// Format a date string for display in resume
///
/// Converts dates from "YYYY-MM-DD" or "YYYY-MM" format to "Mon YYYY" format
/// Examples:
/// - "2020-01-15" → "Jan 2020"
/// - "2020-01" → "Jan 2020"
/// - "2020" → "2020"
///
fn format_month_year(date_str: &str) -> String {
    // Try parsing as full date (YYYY-MM-DD)
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        return date.format("%b %Y").to_string();
    }

    // Try parsing as year-month (YYYY-MM)
    if let Ok(date) = NaiveDate::parse_from_str(&format!("{}-01", date_str), "%Y-%m-%d") {
        return date.format("%b %Y").to_string();
    }

    // Fallback: return as-is (could be just year "2020")
    date_str.to_string()
}

/// Format a date range for display in resume
///
/// Examples:
/// - ("2020-01", "2022-12") → "Jan 2020 - Dec 2022"
/// - ("2020-01", None) → "Jan 2020 - Present"
/// - ("2020-01", "present") → "Jan 2020 - Present"
///
pub fn format_date_range(start: Option<&str>, end: Option<&str>) -> String {
    match (start, end) {
        (Some(s), Some(e)) if e.is_empty() || e.eq_ignore_ascii_case("present") => {
            format!("{} - Present", format_month_year(s))
        }
        (Some(s), Some(e)) => {
            format!("{} - {}", format_month_year(s), format_month_year(e))
        }
        (Some(s), None) => {
            format!("{} - Present", format_month_year(s))
        }
        _ => String::new(),
    }
}

/// Group bullets by company and position for hierarchical rendering
///
/// Takes flat list of ScoredBullets and organizes them into a hierarchical
/// structure suitable for template rendering:
///
/// ```json
/// {
///   "companies": [
///     {
///       "name": "Company A",
///       "location": "Remote",
///       "positions": [
///         {
///           "title": "Senior Engineer",
///           "date_start": "Jan 2020",
///           "date_end": "Present",
///           "bullets": ["Achieved X", "Led Y"]
///         }
///       ]
///     }
///   ]
/// }
/// ```
///
fn group_bullets_by_hierarchy(bullets: &[ScoredBullet]) -> Vec<CompanyData> {
    let mut companies_map: HashMap<String, CompanyData> = HashMap::new();

    for scored_bullet in bullets {
        let company_id = &scored_bullet.company_id;
        let position_id = &scored_bullet.position_id;

        // Get or create company entry
        let company_data = companies_map
            .entry(company_id.clone())
            .or_insert_with(|| CompanyData {
                name: scored_bullet.company_name.clone().unwrap_or_default(),
                description: scored_bullet.company_description.clone(),
                link: scored_bullet.company_link.clone(),
                location: scored_bullet.company_location.clone().unwrap_or_default(),
                date_start: scored_bullet.company_date_start.clone(),
                date_end: scored_bullet.company_date_end.clone(),
                positions: HashMap::new(),
            });

        // Get or create position entry within company
        let position_data = company_data
            .positions
            .entry(position_id.clone())
            .or_insert_with(|| PositionData {
                title: scored_bullet.position_name.clone(),
                description: scored_bullet.position_description.clone(),
                date_start: scored_bullet.position_date_start.clone(),
                date_end: scored_bullet.position_date_end.clone(),
                bullets: Vec::new(),
            });

        // Add bullet description and score to position
        position_data.bullets.push((
            scored_bullet.bullet.description.clone(),
            scored_bullet.score,
        ));
    }

    // Convert HashMap to Vec
    let mut companies: Vec<CompanyData> = companies_map.into_values().collect();

    // Sort companies: Present first, then reverse chronological by end date
    companies.sort_by(|a, b| {
        match (&a.date_end, &b.date_end) {
            (None, Some(_)) => std::cmp::Ordering::Less, // Present (None) comes first
            (Some(_), None) => std::cmp::Ordering::Greater, // Present (None) comes first
            (None, None) => b.date_start.cmp(&a.date_start), // Both present: reverse chron by start
            (Some(a_end), Some(b_end)) => b_end.cmp(a_end), // Reverse chronological by end
        }
    });

    companies
}

/// Prepare data for Typst template injection
///
/// Converts GenerationPayload into a JSON structure suitable for
/// string interpolation into the Typst template.
///
pub fn prepare_template_data(payload: &GenerationPayload) -> JsonValue {
    let companies = group_bullets_by_hierarchy(&payload.selected_bullets);

    // Convert companies to JSON
    let companies_json: Vec<JsonValue> = companies
        .iter()
        .map(|company| {
            // Convert positions HashMap to Vec and sort
            let mut positions: Vec<&PositionData> = company.positions.values().collect();

            // Sort positions: Present first, then reverse chronological by end date
            positions.sort_by(|a, b| {
                match (&a.date_end, &b.date_end) {
                    (None, Some(_)) => std::cmp::Ordering::Less, // Present (None) comes first
                    (Some(_), None) => std::cmp::Ordering::Greater, // Present (None) comes first
                    (None, None) => b.date_start.cmp(&a.date_start), // Both present: reverse chron by start
                    (Some(a_end), Some(b_end)) => b_end.cmp(a_end),  // Reverse chronological by end
                }
            });

            let positions_json: Vec<JsonValue> = positions
                .iter()
                .map(|pos| {
                    // Convert bullets from Vec<(String, f32)> to JSON array
                    let bullets_json: Vec<JsonValue> = pos
                        .bullets
                        .iter()
                        .map(|(description, score)| {
                            serde_json::json!({
                                "description": description,
                                "score": score,
                            })
                        })
                        .collect();

                    serde_json::json!({
                        "title": pos.title,
                        "description": pos.description, // Position context/summary - can be removed if too verbose
                        "date_start": &pos.date_start,
                        "date_end": pos.date_end.as_ref(),
                        "date_range": format_date_range(
                            Some(&pos.date_start),
                            pos.date_end.as_deref()
                        ),
                        "bullets": bullets_json,
                    })
                })
                .collect();

            serde_json::json!({
                "name": company.name,
                "description": company.description,
                "link": company.link,
                "location": company.location,
                "date_start": company.date_start,
                "date_end": company.date_end,
                "date_range": format_date_range(
                    Some(&company.date_start),
                    company.date_end.as_deref()
                ),
                "positions": positions_json,
                "position_count": company.positions.len(),
            })
        })
        .collect();

    // Build final data structure
    serde_json::json!({
        "personal": {
            "name": payload.personal.name,
            "email": payload.personal.email,
            "phone": payload.personal.phone,
            "location": payload.personal.location,
            "linkedin": payload.personal.linkedin,
            "github": payload.personal.github,
            "website": payload.personal.website,
        },
        "summary": payload.summary,
        "companies": companies_json,
        "education": payload.education,
        "skills": payload.skills,
        "role_profile": {
            "name": payload.role_profile.name,
            "description": payload.role_profile.description,
        },
        "metaFooter": payload.meta_footer,
        "totalBulletsAvailable": payload.total_bullets_available,
        "totalCompaniesAvailable": payload.total_companies_available,
    })
}

// ====================
// INTERNAL TYPES
// ====================

#[derive(Debug)]
struct CompanyData {
    name: String,
    description: Option<String>, // Company context/industry
    link: Option<String>,        // Company website
    location: String,
    date_start: String,
    date_end: Option<String>,
    positions: HashMap<String, PositionData>,
}

#[derive(Debug)]
struct PositionData {
    title: String,
    description: Option<String>, // Position summary/context
    date_start: String,
    date_end: Option<String>,
    bullets: Vec<(String, f32)>, // (description, score)
}

// ====================
// TESTS
// ====================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_month_year_full_date() {
        assert_eq!(format_month_year("2020-01-15"), "Jan 2020");
        assert_eq!(format_month_year("2022-12-31"), "Dec 2022");
    }

    #[test]
    fn test_format_month_year_month_only() {
        assert_eq!(format_month_year("2020-01"), "Jan 2020");
        assert_eq!(format_month_year("2022-12"), "Dec 2022");
    }

    #[test]
    fn test_format_month_year_year_only() {
        assert_eq!(format_month_year("2020"), "2020");
    }

    #[test]
    fn test_format_date_range_with_end() {
        assert_eq!(
            format_date_range(Some("2020-01"), Some("2022-12")),
            "Jan 2020 - Dec 2022"
        );
    }

    #[test]
    fn test_format_date_range_no_end() {
        assert_eq!(
            format_date_range(Some("2020-01"), None),
            "Jan 2020 - Present"
        );
    }

    #[test]
    fn test_format_date_range_present_string() {
        assert_eq!(
            format_date_range(Some("2020-01"), Some("present")),
            "Jan 2020 - Present"
        );
        assert_eq!(
            format_date_range(Some("2020-01"), Some("Present")),
            "Jan 2020 - Present"
        );
        assert_eq!(
            format_date_range(Some("2020-01"), Some("PRESENT")),
            "Jan 2020 - Present"
        );
    }

    #[test]
    fn test_format_date_range_empty_end() {
        assert_eq!(
            format_date_range(Some("2020-01"), Some("")),
            "Jan 2020 - Present"
        );
    }

    #[test]
    fn test_format_date_range_no_start() {
        assert_eq!(format_date_range(None, Some("2022-12")), "");
        assert_eq!(format_date_range(None, None), "");
    }
}
