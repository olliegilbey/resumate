//! # docgen-wasm
//!
//! WebAssembly bindings for browser-based resume generation.
//!
//! Provides JavaScript-compatible exports for Typst PDF generation.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn init_panic_hook() {
    // Better error messages in browser console
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Test export to validate WASM build pipeline
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get build timestamp (when WASM was compiled)
#[wasm_bindgen]
pub fn build_info() -> String {
    format!(
        "Built: {} ({})",
        env!("BUILD_TIMESTAMP"),
        env!("BUILD_GIT_HASH")
    )
}

/// Generate PDF from GenerationPayload JSON using Typst
///
/// This is the new Typst-based PDF generation, replacing the manual pdf-writer implementation.
/// Typst provides professional typography, automatic layout, and template-based design.
///
/// # Arguments
/// * `payload_json` - JSON string containing GenerationPayload
/// * `dev_mode` - If true, includes build metadata in PDF
///
/// # Returns
/// * `Result<Vec<u8>, JsValue>` - PDF bytes or error
///
/// # Example (JavaScript)
/// ```js
/// const payloadJson = JSON.stringify({
///   personal: { name: "John Doe", ... },
///   selected_bullets: [...],
///   role_profile: {...},
/// });
/// const isDev = window.location.hostname === 'localhost';
/// const pdfBytes = await generate_pdf_typst(payloadJson, isDev);
/// ```
#[wasm_bindgen]
pub fn generate_pdf_typst(payload_json: &str, dev_mode: bool) -> Result<Vec<u8>, JsValue> {
    // Parse JSON payload
    let payload: docgen_core::GenerationPayload = serde_json::from_str(payload_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON payload: {}", e)))?;

    // Validate payload
    validate_payload(&payload)?;

    // Generate PDF using Typst
    let pdf_bytes = docgen_typst::render_resume(&payload, dev_mode)
        .map_err(|e| JsValue::from_str(&format!("Typst PDF generation failed: {}", e)))?;

    Ok(pdf_bytes)
}

/// Internal validation logic (WASM-agnostic)
///
/// Returns String error messages instead of JsValue for testability
fn validate_payload_internal(payload: &docgen_core::GenerationPayload) -> Result<(), String> {
    // Check personal info
    if payload.personal.name.trim().is_empty() {
        return Err("Personal name is required".to_string());
    }

    // Check role profile
    if payload.role_profile.id.trim().is_empty() {
        return Err("Role profile ID is required".to_string());
    }

    if payload.role_profile.name.trim().is_empty() {
        return Err("Role profile name is required".to_string());
    }

    // Validate scoring weights sum to approximately 1.0
    let weights_sum = payload.role_profile.scoring_weights.tag_relevance
        + payload.role_profile.scoring_weights.priority;

    if (weights_sum - 1.0).abs() > 0.1 {
        return Err(format!(
            "Scoring weights must sum to ~1.0, got {}",
            weights_sum
        ));
    }

    // Check selected bullets count is reasonable
    if payload.selected_bullets.len() > 50 {
        return Err(format!(
            "Too many bullets ({}), maximum is 50",
            payload.selected_bullets.len()
        ));
    }

    Ok(())
}

/// Validate GenerationPayload before generation (WASM wrapper)
///
/// Checks:
/// - Personal info has required fields
/// - Role profile is valid
/// - Selected bullets array is reasonable size
fn validate_payload(payload: &docgen_core::GenerationPayload) -> Result<(), JsValue> {
    validate_payload_internal(payload).map_err(|e| JsValue::from_str(&e))
}

/// Validate JSON payload structure without generating
///
/// Useful for pre-flight validation before expensive generation
#[wasm_bindgen]
pub fn validate_payload_json(payload_json: &str) -> Result<(), JsValue> {
    let payload: docgen_core::GenerationPayload = serde_json::from_str(payload_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

    validate_payload(&payload)?;

    Ok(())
}

/// Get estimated PDF size in bytes (for progress UI)
#[wasm_bindgen]
pub fn estimate_pdf_size(bullet_count: usize) -> usize {
    // Rough estimate: base size + bytes per bullet
    let base_size = 5000; // Base PDF structure
    let bytes_per_bullet = 200; // Approximate
    base_size + (bullet_count * bytes_per_bullet)
}

#[cfg(test)]
mod tests {
    use super::*;
    use docgen_core::GenerationPayload;
    use docgen_core::{scoring::ScoredBullet, Bullet, PersonalInfo, RoleProfile, ScoringWeights};
    use std::collections::HashMap;

    fn create_test_payload() -> GenerationPayload {
        GenerationPayload {
            personal: PersonalInfo {
                name: "Test Person".to_string(),
                nickname: None,
                tagline: None,
                email: Some("test@example.com".to_string()),
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                website: None,
                twitter: None,
            },
            selected_bullets: vec![ScoredBullet {
                bullet: Bullet {
                    id: "b1".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Led infrastructure migration".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 10,
                    link: None,
                },
                score: 0.95,
                company_id: "company1".to_string(),
                company_name: Some("Tech Corp".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Senior Engineer".to_string(),
            }],
            role_profile: RoleProfile {
                id: "test-role".to_string(),
                name: "Test Role".to_string(),
                description: None,
                tag_weights: HashMap::new(),
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: None,
            summary: None,
            metadata: None,
        }
    }

    // ========== Validation Tests ==========
    // These use validate_payload_internal (WASM-agnostic) so they work on all platforms

    #[test]
    fn test_validate_payload_valid() {
        let payload = create_test_payload();
        assert!(validate_payload_internal(&payload).is_ok());
    }

    #[test]
    fn test_validate_payload_empty_name() {
        let mut payload = create_test_payload();
        payload.personal.name = "".to_string();

        let result = validate_payload_internal(&payload);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_payload_whitespace_name() {
        let mut payload = create_test_payload();
        payload.personal.name = "   ".to_string();

        let result = validate_payload_internal(&payload);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_payload_empty_role_id() {
        let mut payload = create_test_payload();
        payload.role_profile.id = "".to_string();

        let result = validate_payload_internal(&payload);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_payload_empty_role_name() {
        let mut payload = create_test_payload();
        payload.role_profile.name = "".to_string();

        let result = validate_payload_internal(&payload);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_payload_invalid_weights_sum() {
        let mut payload = create_test_payload();
        payload.role_profile.scoring_weights = ScoringWeights {
            tag_relevance: 0.5,
            priority: 0.3, // Sum is 0.8, not ~1.0
        };

        let result = validate_payload_internal(&payload);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_payload_too_many_bullets() {
        let mut payload = create_test_payload();
        payload.selected_bullets = (0..51)
            .map(|i| ScoredBullet {
                bullet: Bullet {
                    id: format!("b{}", i),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: format!("Bullet {}", i),
                    tags: vec![],
                    priority: 5,
                    link: None,
                },
                score: 0.5,
                company_id: "company1".to_string(),
                company_name: Some("Company".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Position".to_string(),
            })
            .collect();

        let result = validate_payload_internal(&payload);
        assert!(result.is_err());
    }

    // ========== JSON Serialization Tests ==========
    // These tests use wasm_bindgen functions so only run on wasm32

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_validate_payload_json_valid() {
        let payload = create_test_payload();
        let json = serde_json::to_string(&payload).unwrap();

        assert!(validate_payload_json(&json).is_ok());
    }

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_validate_payload_json_invalid_json() {
        let result = validate_payload_json("{invalid json}");
        assert!(result.is_err());
    }

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_validate_payload_json_missing_fields() {
        let json = r#"{"personal": {"name": "Test"}}"#;
        let result = validate_payload_json(json);
        assert!(result.is_err());
    }

    // ========== PDF Generation Tests (pdf-writer) ==========
    // These tests use wasm_bindgen functions so only run on wasm32

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_generate_pdf_valid_payload() {
        let payload = create_test_payload();
        let json = serde_json::to_string(&payload).unwrap();

        let result = generate_pdf(&json, false);
        assert!(result.is_ok());

        let pdf_bytes = result.unwrap();
        assert!(!pdf_bytes.is_empty());
        assert!(pdf_bytes.len() > 1000); // PDFs are typically >1KB
    }

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_generate_pdf_invalid_json() {
        let result = generate_pdf("{invalid}", false);
        assert!(result.is_err());
    }

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_generate_pdf_empty_name() {
        let mut payload = create_test_payload();
        payload.personal.name = "".to_string();
        let json = serde_json::to_string(&payload).unwrap();

        let result = generate_pdf(&json, false);
        assert!(result.is_err());
    }

    // ========== PDF Generation Tests (Typst) ==========
    // These tests use wasm_bindgen functions so only run on wasm32

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_generate_pdf_typst_valid_payload() {
        let payload = create_test_payload();
        let json = serde_json::to_string(&payload).unwrap();

        let result = generate_pdf_typst(&json, false);
        assert!(result.is_ok());

        let pdf_bytes = result.unwrap();
        assert!(!pdf_bytes.is_empty());
        assert!(pdf_bytes.len() > 1000); // PDFs are typically >1KB
                                         // Check PDF header
        assert_eq!(&pdf_bytes[0..4], b"%PDF");
    }

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_generate_pdf_typst_with_dev_mode() {
        let payload = create_test_payload();
        let json = serde_json::to_string(&payload).unwrap();

        let result = generate_pdf_typst(&json, true);
        assert!(result.is_ok());

        let pdf_bytes = result.unwrap();
        assert!(!pdf_bytes.is_empty());
        assert_eq!(&pdf_bytes[0..4], b"%PDF");
    }

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_generate_pdf_typst_invalid_json() {
        let result = generate_pdf_typst("{invalid}", false);
        assert!(result.is_err());
    }

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_generate_pdf_typst_empty_name() {
        let mut payload = create_test_payload();
        payload.personal.name = "".to_string();
        let json = serde_json::to_string(&payload).unwrap();

        let result = generate_pdf_typst(&json, false);
        assert!(result.is_err());
    }

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_generate_pdf_typst_with_complex_payload() {
        let payload = GenerationPayload {
            personal: PersonalInfo {
                name: "José García-Martínez".to_string(),
                nickname: Some("Pepe".to_string()),
                tagline: Some("Test tagline".to_string()),
                email: Some("jose@example.com".to_string()),
                phone: Some("+34 123 456 789".to_string()),
                location: Some("Madrid, Spain".to_string()),
                linkedin: Some("jose-garcia".to_string()),
                github: Some("josegarcia".to_string()),
                website: Some("https://jose.example.com".to_string()),
                twitter: Some("josegarcia".to_string()),
            },
            selected_bullets: vec![ScoredBullet {
                bullet: Bullet {
                    id: "b1".to_string(),
                    name: Some("Infrastructure Project".to_string()),
                    location: Some("Remote".to_string()),
                    date_start: Some("2022-01".to_string()),
                    date_end: Some("2023-01".to_string()),
                    summary: Some("Major infrastructure overhaul".to_string()),
                    description: "Led infrastructure migration reducing costs by 40%".to_string(),
                    tags: vec![
                        "infrastructure".to_string(),
                        "cost-optimization".to_string(),
                    ],
                    priority: 10,
                    link: Some("https://example.com/project".to_string()),
                },
                score: 0.95,
                company_id: "company1".to_string(),
                company_name: Some("Tech Corp".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Senior Engineer".to_string(),
            }],
            role_profile: RoleProfile {
                id: "software-engineer".to_string(),
                name: "Software Engineer".to_string(),
                description: Some("Full-stack software engineering role".to_string()),
                tag_weights: {
                    let mut map = HashMap::new();
                    map.insert("infrastructure".to_string(), 1.0);
                    map.insert("cost-optimization".to_string(), 0.8);
                    map
                },
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.65,
                    priority: 0.35,
                },
            },
            education: Some(vec![docgen_core::Education {
                degree: "BSc Computer Science".to_string(),
                degree_type: "BSc".to_string(),
                institution: "University of Madrid".to_string(),
                location: "Madrid, Spain".to_string(),
                year: "2014".to_string(),
                coursework: Some(vec![
                    "Advanced Algorithms".to_string(),
                    "Systems Programming".to_string(),
                ]),
                societies: Some(vec!["ACM Student Chapter".to_string()]),
            }]),
            skills: Some({
                let mut map = HashMap::new();
                map.insert(
                    "technical".to_string(),
                    vec![
                        "Rust".to_string(),
                        "TypeScript".to_string(),
                        "Python".to_string(),
                    ],
                );
                map
            }),
            summary: Some("Experienced software engineer with focus on infrastructure".to_string()),
            metadata: None,
        };

        let json = serde_json::to_string(&payload).unwrap();
        let result = generate_pdf_typst(&json, false);

        assert!(result.is_ok(), "Should generate PDF with complex payload");
        let pdf_bytes = result.unwrap();
        assert!(!pdf_bytes.is_empty());
        assert_eq!(&pdf_bytes[0..4], b"%PDF");
    }

    // ========== DOCX Generation Tests ==========
    // These tests use wasm_bindgen functions so only run on wasm32

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_generate_docx_valid_payload() {
        let payload = create_test_payload();
        let json = serde_json::to_string(&payload).unwrap();

        let result = generate_docx(&json);
        assert!(result.is_ok());

        let docx_bytes = result.unwrap();
        assert!(!docx_bytes.is_empty());
        assert!(docx_bytes.len() > 1000); // DOCX files are typically larger
    }

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_generate_docx_invalid_json() {
        let result = generate_docx("{invalid}");
        assert!(result.is_err());
    }

    // ========== Size Estimation Tests ==========

    #[test]
    fn test_estimate_pdf_size() {
        assert_eq!(estimate_pdf_size(0), 5000);
        assert_eq!(estimate_pdf_size(10), 5000 + 2000);
        assert_eq!(estimate_pdf_size(20), 5000 + 4000);
    }

    // NOTE: DOCX generation has been removed - only PDF via Typst is supported

    // ========== Edge Case: Bullet Count Boundary ==========

    #[test]
    fn test_validate_payload_exactly_50_bullets() {
        let mut payload = create_test_payload();
        payload.selected_bullets = (0..50)
            .map(|i| ScoredBullet {
                bullet: Bullet {
                    id: format!("b{}", i),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: format!("Bullet {}", i),
                    tags: vec![],
                    priority: 5,
                    link: None,
                },
                score: 0.5,
                company_id: "company1".to_string(),
                company_name: Some("Company".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Position".to_string(),
            })
            .collect();

        // 50 bullets should be OK (limit is >50)
        let result = validate_payload_internal(&payload);
        assert!(result.is_ok());
    }

    // ========== Edge Case: Scoring Weights Boundary ==========

    #[test]
    fn test_validate_payload_weights_sum_boundary_low() {
        let mut payload = create_test_payload();
        payload.role_profile.scoring_weights = ScoringWeights {
            tag_relevance: 0.45,
            priority: 0.46, // Sum is 0.91 (within tolerance)
        };

        let result = validate_payload_internal(&payload);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_payload_weights_sum_boundary_high() {
        let mut payload = create_test_payload();
        payload.role_profile.scoring_weights = ScoringWeights {
            tag_relevance: 0.55,
            priority: 0.54, // Sum is 1.09 (within tolerance)
        };

        let result = validate_payload_internal(&payload);
        assert!(result.is_ok());
    }

    // ========== Edge Case: Empty vs Whitespace ==========

    #[test]
    fn test_validate_payload_whitespace_role_id() {
        let mut payload = create_test_payload();
        payload.role_profile.id = "   ".to_string();

        let result = validate_payload_internal(&payload);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_payload_whitespace_role_name() {
        let mut payload = create_test_payload();
        payload.role_profile.name = "   ".to_string();

        let result = validate_payload_internal(&payload);
        assert!(result.is_err());
    }

    // ========== Edge Case: Zero Bullets ==========

    #[test]
    fn test_validate_payload_zero_bullets() {
        let mut payload = create_test_payload();
        payload.selected_bullets = vec![];

        // Zero bullets should be OK
        let result = validate_payload_internal(&payload);
        assert!(result.is_ok());
    }

    // ========== Size Estimation Edge Cases ==========

    #[test]
    fn test_estimate_pdf_size_large_count() {
        let size = estimate_pdf_size(100);
        assert_eq!(size, 5000 + (100 * 200));
        assert_eq!(size, 25000);
    }

    #[test]
    fn test_size_estimates_scale_linearly() {
        for count in [0, 5, 10, 20, 50].iter() {
            let pdf_size = estimate_pdf_size(*count);

            // Verify linear scaling
            let expected_pdf = 5000 + (*count * 200);

            assert_eq!(pdf_size, expected_pdf);
        }
    }

    // ========== Version Test ==========

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_version() {
        let v = version();
        assert!(!v.is_empty());
        assert!(v.contains('.'));
    }

    // ========== Integration Test: Complex Payload ==========

    #[test]
    fn test_validate_complex_payload() {
        let payload = GenerationPayload {
            personal: PersonalInfo {
                name: "José García-Martínez".to_string(),
                nickname: Some("Pepe".to_string()),
                tagline: Some("Test tagline".to_string()),
                email: Some("jose@example.com".to_string()),
                phone: Some("+34 123 456 789".to_string()),
                location: Some("Madrid, Spain".to_string()),
                linkedin: Some("jose-garcia".to_string()),
                github: Some("josegarcia".to_string()),
                website: Some("https://jose.example.com".to_string()),
                twitter: Some("josegarcia".to_string()),
            },
            selected_bullets: vec![
                ScoredBullet {
                    bullet: Bullet {
                        id: "b1".to_string(),
                        name: Some("Infrastructure Project".to_string()),
                        location: Some("Remote".to_string()),
                        date_start: Some("2022-01".to_string()),
                        date_end: Some("2023-01".to_string()),
                        summary: Some("Major infrastructure overhaul".to_string()),
                        description: "Led infrastructure migration reducing costs by 40%"
                            .to_string(),
                        tags: vec![
                            "infrastructure".to_string(),
                            "cost-optimization".to_string(),
                        ],
                        priority: 10,
                        link: Some("https://example.com/project".to_string()),
                    },
                    score: 0.95,
                    company_id: "company1".to_string(),
                    company_name: Some("Tech Corp".to_string()),
                    position_id: "pos1".to_string(),
                    position_name: "Senior Engineer".to_string(),
                },
                ScoredBullet {
                    bullet: Bullet {
                        id: "b2".to_string(),
                        name: None,
                        location: None,
                        date_start: None,
                        date_end: None,
                        summary: None,
                        description: "Minimal bullet with only required fields".to_string(),
                        tags: vec![],
                        priority: 5,
                        link: None,
                    },
                    score: 0.5,
                    company_id: "company2".to_string(),
                    company_name: None,
                    position_id: "pos2".to_string(),
                    position_name: "Engineer".to_string(),
                },
            ],
            role_profile: RoleProfile {
                id: "software-engineer".to_string(),
                name: "Software Engineer".to_string(),
                description: Some("Full-stack software engineering role".to_string()),
                tag_weights: {
                    let mut map = HashMap::new();
                    map.insert("infrastructure".to_string(), 1.0);
                    map.insert("cost-optimization".to_string(), 0.8);
                    map.insert("leadership".to_string(), 0.9);
                    map
                },
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.65,
                    priority: 0.35,
                },
            },
            education: Some(vec![docgen_core::Education {
                degree: "BSc Computer Science".to_string(),
                degree_type: "BSc".to_string(),
                institution: "University of Madrid".to_string(),
                location: "Madrid, Spain".to_string(),
                year: "2014".to_string(),
                coursework: Some(vec![
                    "Advanced Algorithms".to_string(),
                    "Systems Programming".to_string(),
                ]),
                societies: Some(vec!["ACM Student Chapter".to_string()]),
            }]),
            skills: Some({
                let mut map = HashMap::new();
                map.insert(
                    "technical".to_string(),
                    vec![
                        "Rust".to_string(),
                        "TypeScript".to_string(),
                        "Python".to_string(),
                    ],
                );
                map.insert(
                    "soft".to_string(),
                    vec!["Leadership".to_string(), "Communication".to_string()],
                );
                map
            }),
            summary: Some("Experienced software engineer with focus on infrastructure".to_string()),
            metadata: None,
        };

        let result = validate_payload_internal(&payload);
        assert!(result.is_ok());
    }
}
