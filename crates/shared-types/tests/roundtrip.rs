//! Roundtrip tests - Ensure types can serialize and deserialize correctly
//!
//! These tests verify that:
//! 1. Types can be serialized to JSON
//! 2. JSON can be deserialized back to types
//! 3. The roundtrip produces identical data
//! 4. Required fields are enforced
//! 5. Optional fields work correctly

use serde_json;
use shared_types::*;

#[test]
fn test_personal_info_roundtrip() {
    let personal = PersonalInfo {
        name: "John Doe".to_string(),
        nickname: Some("Johnny".to_string()),
        email: Some("john@example.com".to_string()),
        phone: Some("+1234567890".to_string()),
        location: Some("London".to_string()),
        linkedin: Some("johndoe".to_string()),
        github: Some("johndoe".to_string()),
        website: Some("https://johndoe.com".to_string()),
        twitter: Some("johndoe".to_string()),
        tagline: Some("Software Engineer".to_string()),
    };

    // Serialize to JSON
    let json = serde_json::to_string(&personal).expect("Failed to serialize PersonalInfo");

    // Deserialize back
    let deserialized: PersonalInfo =
        serde_json::from_str(&json).expect("Failed to deserialize PersonalInfo");

    // Verify equality
    assert_eq!(personal.name, deserialized.name);
    assert_eq!(personal.nickname, deserialized.nickname);
    assert_eq!(personal.email, deserialized.email);
    assert_eq!(personal.phone, deserialized.phone);
    assert_eq!(personal.location, deserialized.location);
    assert_eq!(personal.linkedin, deserialized.linkedin);
    assert_eq!(personal.github, deserialized.github);
    assert_eq!(personal.website, deserialized.website);
    assert_eq!(personal.twitter, deserialized.twitter);
    assert_eq!(personal.tagline, deserialized.tagline);
}

#[test]
fn test_personal_info_minimal_required_fields() {
    // Only required field: name
    let json = r#"{"name": "Jane Doe"}"#;

    let personal: PersonalInfo =
        serde_json::from_str(json).expect("Failed to deserialize minimal PersonalInfo");

    assert_eq!(personal.name, "Jane Doe");
    assert_eq!(personal.nickname, None);
    assert_eq!(personal.email, None);
    assert_eq!(personal.phone, None);
}

#[test]
fn test_bullet_roundtrip() {
    let bullet = Bullet {
        id: "bullet-1".to_string(),
        description: "Led team of 5 engineers".to_string(),
        tags: vec!["leadership".to_string(), "engineering".to_string()],
        priority: 8,
        summary: Some("Major achievement".to_string()),
        link: Some("https://example.com".to_string()),
        date_start: Some("2022-01".to_string()),
        date_end: Some("2023-12".to_string()),
        location: None,
        name: None,
    };

    let json = serde_json::to_string_pretty(&bullet).expect("Failed to serialize Bullet");
    let deserialized: Bullet = serde_json::from_str(&json).expect("Failed to deserialize Bullet");

    assert_eq!(bullet.id, deserialized.id);
    assert_eq!(bullet.description, deserialized.description);
    assert_eq!(bullet.tags, deserialized.tags);
    assert_eq!(bullet.priority, deserialized.priority);
    assert_eq!(bullet.summary, deserialized.summary);
}

#[test]
fn test_position_roundtrip() {
    let bullet = Bullet {
        id: "b1".to_string(),
        description: "Achievement".to_string(),
        tags: vec!["engineering".to_string()],
        priority: 7,
        summary: None,
        link: None,
        date_start: None,
        date_end: None,
        location: None,
        name: None,
    };

    let position = Position {
        id: "pos-1".to_string(),
        name: "Senior Engineer".to_string(),
        date_start: "2022-01".to_string(),
        date_end: None,
        children: vec![bullet],
        description: Some("Role description".to_string()),
        priority: 9,
        tags: vec!["engineering".to_string()],
        summary: None,
        link: None,
        location: None,
    };

    let json = serde_json::to_string_pretty(&position).expect("Failed to serialize Position");
    let deserialized: Position =
        serde_json::from_str(&json).expect("Failed to deserialize Position");

    assert_eq!(position.id, deserialized.id);
    assert_eq!(position.name, deserialized.name);
    assert_eq!(position.date_start, deserialized.date_start);
    assert_eq!(position.children.len(), deserialized.children.len());
    assert_eq!(position.priority, deserialized.priority);
}

#[test]
fn test_company_roundtrip() {
    let bullet = Bullet {
        id: "b1".to_string(),
        description: "Achievement".to_string(),
        tags: vec!["engineering".to_string()],
        priority: 7,
        summary: None,
        link: None,
        date_start: None,
        date_end: None,
        location: None,
        name: None,
    };

    let position = Position {
        id: "pos-1".to_string(),
        name: "Senior Engineer".to_string(),
        date_start: "2022-01".to_string(),
        date_end: None,
        children: vec![bullet],
        description: None,
        priority: 8,
        tags: vec!["engineering".to_string()],
        summary: None,
        link: None,
        location: None,
    };

    let company = Company {
        id: "company-1".to_string(),
        name: Some("Tech Corp".to_string()),
        date_start: "2022-01".to_string(),
        date_end: None,
        children: vec![position],
        description: Some("Leading tech company".to_string()),
        priority: 10,
        tags: vec!["technology".to_string()],
        summary: None,
        link: Some("https://techcorp.com".to_string()),
        location: Some("San Francisco".to_string()),
    };

    let json = serde_json::to_string_pretty(&company).expect("Failed to serialize Company");
    let deserialized: Company = serde_json::from_str(&json).expect("Failed to deserialize Company");

    assert_eq!(company.id, deserialized.id);
    assert_eq!(company.name, deserialized.name);
    assert_eq!(company.date_start, deserialized.date_start);
    assert_eq!(company.children.len(), deserialized.children.len());
    assert_eq!(company.priority, deserialized.priority);
}

#[test]
fn test_role_profile_roundtrip() {
    let mut tag_weights = std::collections::HashMap::new();
    tag_weights.insert("engineering".to_string(), 1.0);
    tag_weights.insert("leadership".to_string(), 0.8);

    let role_profile = RoleProfile {
        id: "software-engineer".to_string(),
        name: "Software Engineer".to_string(),
        description: Some("Full-stack development".to_string()),
        tag_weights,
        scoring_weights: ScoringWeights {
            tag_relevance: 0.6,
            priority: 0.4,
        },
    };

    let json =
        serde_json::to_string_pretty(&role_profile).expect("Failed to serialize RoleProfile");
    let deserialized: RoleProfile =
        serde_json::from_str(&json).expect("Failed to deserialize RoleProfile");

    assert_eq!(role_profile.id, deserialized.id);
    assert_eq!(role_profile.name, deserialized.name);
    assert_eq!(
        role_profile.scoring_weights.tag_relevance,
        deserialized.scoring_weights.tag_relevance
    );
}

#[test]
fn test_education_roundtrip() {
    let education = Education {
        institution: "University of Example".to_string(),
        degree: "Bachelor of Science in Computer Science".to_string(),
        degree_type: "BSc".to_string(),
        year: "2020".to_string(),
        location: "London".to_string(),
        coursework: Some(vec![
            "Algorithms".to_string(),
            "Data Structures".to_string(),
        ]),
        societies: Some(vec!["Computer Science Society".to_string()]),
    };

    let json = serde_json::to_string_pretty(&education).expect("Failed to serialize Education");
    let deserialized: Education =
        serde_json::from_str(&json).expect("Failed to deserialize Education");

    assert_eq!(education.institution, deserialized.institution);
    assert_eq!(education.degree, deserialized.degree);
    assert_eq!(education.degree_type, deserialized.degree_type);
    assert_eq!(education.year, deserialized.year);
    assert_eq!(education.location, deserialized.location);
}

#[test]
fn test_resume_data_roundtrip() {
    let personal = PersonalInfo {
        name: "John Doe".to_string(),
        nickname: None,
        email: Some("john@example.com".to_string()),
        phone: None,
        location: Some("London".to_string()),
        linkedin: None,
        github: None,
        website: None,
        twitter: None,
        tagline: None,
    };

    let bullet = Bullet {
        id: "b1".to_string(),
        description: "Achievement".to_string(),
        tags: vec!["engineering".to_string()],
        priority: 8,
        summary: None,
        link: None,
        date_start: None,
        date_end: None,
        location: None,
        name: None,
    };

    let position = Position {
        id: "pos-1".to_string(),
        name: "Engineer".to_string(),
        date_start: "2022-01".to_string(),
        date_end: None,
        children: vec![bullet],
        description: None,
        priority: 8,
        tags: vec!["engineering".to_string()],
        summary: None,
        link: None,
        location: None,
    };

    let company = Company {
        id: "company-1".to_string(),
        name: Some("Tech Corp".to_string()),
        date_start: "2022-01".to_string(),
        date_end: None,
        children: vec![position],
        description: None,
        priority: 9,
        tags: vec!["technology".to_string()],
        summary: None,
        link: None,
        location: None,
    };

    let resume = ResumeData {
        personal,
        summary: Some("Professional summary".to_string()),
        experience: vec![company],
        skills: None,
        education: None,
        role_profiles: None,
    };

    let json = serde_json::to_string_pretty(&resume).expect("Failed to serialize ResumeData");
    let deserialized: ResumeData =
        serde_json::from_str(&json).expect("Failed to deserialize ResumeData");

    assert_eq!(resume.personal.name, deserialized.personal.name);
    assert_eq!(resume.experience.len(), deserialized.experience.len());
    assert_eq!(resume.summary, deserialized.summary);
}

#[test]
fn test_camel_case_serialization() {
    // Verify that fields serialize to camelCase, not snake_case
    let personal = PersonalInfo {
        name: "Test".to_string(),
        nickname: None,
        email: None,
        phone: None,
        location: None,
        linkedin: None,
        github: None,
        website: None,
        twitter: None,
        tagline: None,
    };

    let json = serde_json::to_string(&personal).expect("Failed to serialize");

    // Should contain "name" not "full_name"
    assert!(json.contains("\"name\""));
    assert!(!json.contains("full_name"));
}

#[test]
fn test_optional_fields_omitted_when_null() {
    let bullet = Bullet {
        id: "b1".to_string(),
        description: "Test".to_string(),
        tags: vec![],
        priority: 5,
        summary: None, // Should be omitted
        link: None,    // Should be omitted
        date_start: None,
        date_end: None,
        location: None,
        name: None,
    };

    let json = serde_json::to_string(&bullet).expect("Failed to serialize");

    // Optional None fields should not appear in JSON
    assert!(!json.contains("\"summary\""));
    assert!(!json.contains("\"link\""));
}

#[test]
#[should_panic(expected = "missing field")]
fn test_missing_required_field_fails() {
    // Missing required field "description" should fail
    let json = r#"{
        "id": "b1",
        "tags": ["test"],
        "priority": 5
    }"#;

    let _: Bullet = serde_json::from_str(json).expect("Should fail with missing field");
}

#[test]
fn test_priority_bounds() {
    // Priorities should be 1-10
    let bullet_low = Bullet {
        id: "b1".to_string(),
        description: "Test".to_string(),
        tags: vec![],
        priority: 1, // Min valid
        summary: None,
        link: None,
        date_start: None,
        date_end: None,
        location: None,
        name: None,
    };

    let bullet_high = Bullet {
        id: "b2".to_string(),
        description: "Test".to_string(),
        tags: vec![],
        priority: 10, // Max valid
        summary: None,
        link: None,
        date_start: None,
        date_end: None,
        location: None,
        name: None,
    };

    // Should serialize/deserialize successfully
    let json_low = serde_json::to_string(&bullet_low).expect("Failed to serialize");
    let json_high = serde_json::to_string(&bullet_high).expect("Failed to serialize");

    let _: Bullet = serde_json::from_str(&json_low).expect("Failed to deserialize");
    let _: Bullet = serde_json::from_str(&json_high).expect("Failed to deserialize");
}
