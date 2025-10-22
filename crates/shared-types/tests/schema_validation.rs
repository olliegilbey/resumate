//! Schema validation tests
//!
//! These tests verify that:
//! 1. JSON Schema can be generated from Rust types
//! 2. Schema has correct structure and metadata
//! 3. Required/optional fields are correctly marked
//! 4. Descriptions and constraints are present

use schemars::schema_for;
use serde_json::Value;
use shared_types::*;

#[test]
fn test_resume_data_schema_generation() {
    let schema = schema_for!(ResumeData);

    // Should generate valid schema
    assert!(schema.schema.metadata.is_some());

    // Convert to JSON to inspect structure
    let schema_json = serde_json::to_value(&schema).expect("Failed to serialize schema");

    // Check that required fields are marked
    if let Some(obj) = schema_json.get("properties") {
        assert!(obj.get("personal").is_some(), "Missing 'personal' property");
        assert!(
            obj.get("experience").is_some(),
            "Missing 'experience' property"
        );
    } else {
        panic!("Schema missing 'properties' field");
    }
}

#[test]
fn test_personal_info_schema() {
    let schema = schema_for!(PersonalInfo);
    let schema_json = serde_json::to_value(&schema).expect("Failed to serialize schema");

    // Check required fields
    if let Some(required) = schema_json.get("required") {
        let required_arr = required.as_array().expect("Required should be an array");
        assert!(
            required_arr.contains(&Value::String("name".to_string())),
            "PersonalInfo should require 'name'"
        );
    }

    // Check properties exist
    if let Some(props) = schema_json.get("properties") {
        assert!(props.get("name").is_some());
        assert!(props.get("email").is_some());
        assert!(props.get("phone").is_some());
        assert!(props.get("location").is_some());
    }
}

#[test]
fn test_bullet_schema() {
    let schema = schema_for!(Bullet);
    let schema_json = serde_json::to_value(&schema).expect("Failed to serialize schema");

    // Check required fields
    if let Some(required) = schema_json.get("required") {
        let required_arr = required.as_array().expect("Required should be an array");

        // These fields should be required
        assert!(required_arr.contains(&Value::String("id".to_string())));
        assert!(required_arr.contains(&Value::String("description".to_string())));
        assert!(required_arr.contains(&Value::String("tags".to_string())));
        assert!(required_arr.contains(&Value::String("priority".to_string())));
    } else {
        panic!("Bullet schema missing 'required' field");
    }

    // Check that optional fields are NOT in required
    if let Some(required) = schema_json.get("required") {
        let required_arr = required.as_array().expect("Required should be an array");
        assert!(!required_arr.contains(&Value::String("summary".to_string())));
        assert!(!required_arr.contains(&Value::String("link".to_string())));
    }
}

#[test]
fn test_position_schema() {
    let schema = schema_for!(Position);
    let schema_json = serde_json::to_value(&schema).expect("Failed to serialize schema");

    // Check required fields
    if let Some(required) = schema_json.get("required") {
        let required_arr = required.as_array().expect("Required should be an array");

        assert!(required_arr.contains(&Value::String("id".to_string())));
        assert!(
            required_arr.contains(&Value::String("name".to_string())),
            "Position should require 'name'"
        );
        assert!(required_arr.contains(&Value::String("dateStart".to_string())));
        assert!(required_arr.contains(&Value::String("children".to_string())));
        assert!(required_arr.contains(&Value::String("priority".to_string())));
        assert!(required_arr.contains(&Value::String("tags".to_string())));
    }
}

#[test]
fn test_company_schema() {
    let schema = schema_for!(Company);
    let schema_json = serde_json::to_value(&schema).expect("Failed to serialize schema");

    // Check required fields
    if let Some(required) = schema_json.get("required") {
        let required_arr = required.as_array().expect("Required should be an array");

        assert!(required_arr.contains(&Value::String("id".to_string())));
        assert!(required_arr.contains(&Value::String("dateStart".to_string())));
        assert!(required_arr.contains(&Value::String("children".to_string())));
        assert!(required_arr.contains(&Value::String("priority".to_string())));
        assert!(required_arr.contains(&Value::String("tags".to_string())));
    }

    // Company name should be optional
    if let Some(required) = schema_json.get("required") {
        let required_arr = required.as_array().expect("Required should be an array");
        assert!(
            !required_arr.contains(&Value::String("name".to_string())),
            "Company name should be optional"
        );
    }
}

#[test]
fn test_role_profile_schema() {
    let schema = schema_for!(RoleProfile);
    let schema_json = serde_json::to_value(&schema).expect("Failed to serialize schema");

    // Check required fields
    if let Some(required) = schema_json.get("required") {
        let required_arr = required.as_array().expect("Required should be an array");

        assert!(required_arr.contains(&Value::String("id".to_string())));
        assert!(required_arr.contains(&Value::String("name".to_string())));
        assert!(required_arr.contains(&Value::String("tagWeights".to_string())));
        assert!(required_arr.contains(&Value::String("scoringWeights".to_string())));
    }
}

#[test]
fn test_scoring_weights_schema() {
    let schema = schema_for!(ScoringWeights);
    let schema_json = serde_json::to_value(&schema).expect("Failed to serialize schema");

    // Both fields should be required
    if let Some(required) = schema_json.get("required") {
        let required_arr = required.as_array().expect("Required should be an array");

        assert!(required_arr.contains(&Value::String("tagRelevance".to_string())));
        assert!(required_arr.contains(&Value::String("priority".to_string())));
    }

    // Check properties are numbers
    if let Some(props) = schema_json.get("properties") {
        if let Some(tag_rel) = props.get("tagRelevance") {
            assert!(tag_rel.get("type").is_some());
        }
        if let Some(priority) = props.get("priority") {
            assert!(priority.get("type").is_some());
        }
    }
}

#[test]
fn test_education_schema() {
    let schema = schema_for!(Education);
    let schema_json = serde_json::to_value(&schema).expect("Failed to serialize schema");

    // Check required fields
    if let Some(required) = schema_json.get("required") {
        let required_arr = required.as_array().expect("Required should be an array");

        assert!(required_arr.contains(&Value::String("institution".to_string())));
        assert!(required_arr.contains(&Value::String("degreeType".to_string())));
        assert!(required_arr.contains(&Value::String("year".to_string())));
        assert!(required_arr.contains(&Value::String("location".to_string())));
    }

    // Check optional fields (coursework and societies are optional)
    if let Some(required) = schema_json.get("required") {
        let required_arr = required.as_array().expect("Required should be an array");
        // degree is required (full degree name)
        assert!(
            required_arr.contains(&Value::String("degree".to_string())),
            "degree should be required"
        );
        // coursework and societies are optional
        assert!(!required_arr.contains(&Value::String("coursework".to_string())));
        assert!(!required_arr.contains(&Value::String("societies".to_string())));
    }
}

#[test]
fn test_schema_has_descriptions() {
    let schema = schema_for!(ResumeData);
    let schema_json = serde_json::to_value(&schema).expect("Failed to serialize schema");

    // Root schema should have description
    if let Some(metadata) = schema_json.get("description") {
        assert!(
            !metadata.as_str().unwrap().is_empty(),
            "Schema should have description"
        );
    }
}

#[test]
fn test_schema_output_format() {
    // Test that schema can be serialized to pretty JSON (for file output)
    let schema = schema_for!(ResumeData);
    let pretty_json =
        serde_json::to_string_pretty(&schema).expect("Failed to serialize schema to JSON");

    // Should be valid JSON
    let _: Value = serde_json::from_str(&pretty_json).expect("Schema JSON should be valid");

    // Should contain expected top-level keys
    assert!(pretty_json.contains("\"$schema\""));
    assert!(pretty_json.contains("\"definitions\"") || pretty_json.contains("\"$defs\""));
}

#[test]
fn test_all_main_types_generate_schema() {
    // Verify all main types can generate schemas without panicking
    let _ = schema_for!(ResumeData);
    let _ = schema_for!(PersonalInfo);
    let _ = schema_for!(Company);
    let _ = schema_for!(Position);
    let _ = schema_for!(Bullet);
    let _ = schema_for!(Education);
    let _ = schema_for!(RoleProfile);
    let _ = schema_for!(ScoringWeights);
}
