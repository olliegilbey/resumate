//! Roundtrip validation test: TypeScript JSON → Rust → JSON → TypeScript
//!
//! Ensures perfect compatibility between TypeScript and Rust type systems
//! by loading the template JSON, deserializing to Rust, re-serializing,
//! and validating the output matches the original structure.

use resume_core::ResumeData;
use std::path::PathBuf;

/// Get path to resume-data-template.json in project root
fn template_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent() // crates
        .unwrap()
        .parent() // resumate
        .unwrap()
        .join("data/resume-data-template.json")
}

#[test]
fn test_roundtrip_resume_data_template() {
    let template_path = template_path();

    // Read the TypeScript template JSON
    let json_content = std::fs::read_to_string(&template_path)
        .unwrap_or_else(|e| panic!("Failed to read template at {:?}: {}", template_path, e));

    // Deserialize to Rust types
    let resume_data: ResumeData = serde_json::from_str(&json_content).unwrap_or_else(|e| {
        panic!(
            "Failed to deserialize template JSON: {}\nJSON: {}",
            e, json_content
        )
    });

    // Re-serialize back to JSON
    let reserialized =
        serde_json::to_string_pretty(&resume_data).expect("Failed to re-serialize ResumeData");

    // Parse both as serde_json::Value for semantic comparison
    let original_value: serde_json::Value =
        serde_json::from_str(&json_content).expect("Failed to parse original JSON");
    let reserialized_value: serde_json::Value =
        serde_json::from_str(&reserialized).expect("Failed to parse reserialized JSON");

    // Compare semantic equality (ignoring whitespace/formatting)
    assert_eq!(
        original_value,
        reserialized_value,
        "Roundtrip failed: JSON structure changed during Rust serialization.\n\
         Original fields: {:?}\n\
         Reserialized fields: {:?}",
        original_value
            .as_object()
            .map(|o| o.keys().collect::<Vec<_>>()),
        reserialized_value
            .as_object()
            .map(|o| o.keys().collect::<Vec<_>>())
    );
}

#[test]
fn test_resume_data_required_fields() {
    let template_path = template_path();
    let json_content = std::fs::read_to_string(&template_path).expect("Failed to read template");

    let resume_data: ResumeData =
        serde_json::from_str(&json_content).expect("Failed to deserialize template");

    // Validate all required top-level fields exist
    assert!(
        !resume_data.personal.name.is_empty(),
        "personal.name is required"
    );

    // Validate experience structure (new schema)
    assert!(
        !resume_data.experience.is_empty(),
        "experience array should have at least one entry in template"
    );

    let first_company = &resume_data.experience[0];
    assert!(!first_company.id.is_empty(), "company.id is required");
    assert!(
        !first_company.children.is_empty(),
        "company.children should have at least one entry"
    );

    let first_position = &first_company.children[0];
    assert!(!first_position.id.is_empty(), "position.id is required");
    assert!(!first_position.name.is_empty(), "position.name is required");
}

#[test]
fn test_camel_case_field_names() {
    let template_path = template_path();
    let json_content = std::fs::read_to_string(&template_path).expect("Failed to read template");

    // Deserialize and re-serialize
    let resume_data: ResumeData =
        serde_json::from_str(&json_content).expect("Failed to deserialize template");
    let reserialized = serde_json::to_string(&resume_data).expect("Failed to re-serialize");

    // Verify camelCase field names are preserved (new schema)
    assert!(
        reserialized.contains("\"dateStart\""),
        "Should use camelCase 'dateStart'"
    );
    assert!(
        reserialized.contains("\"name\""),
        "PersonalInfo should have 'name' field"
    );

    // Verify snake_case is NOT present
    assert!(
        !reserialized.contains("\"date_start\""),
        "Should NOT use snake_case 'date_start'"
    );
}

#[test]
fn test_optional_fields_handling() {
    let template_path = template_path();
    let json_content = std::fs::read_to_string(&template_path).expect("Failed to read template");

    let resume_data: ResumeData =
        serde_json::from_str(&json_content).expect("Failed to deserialize template");

    // Template should have optional fields populated for demonstration
    // but Rust should handle them as Option<T>
    let first_company = &resume_data.experience[0];

    // These are optional in the type system
    let _ = &first_company.location; // Should compile as Option<String>
    let _ = &first_company.description; // Should compile as Option<String>

    let first_position = &first_company.children[0];
    let _ = &first_position.summary; // Should compile as Option<String>
    let _ = &first_position.link; // Should compile as Option<String>
}
