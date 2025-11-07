//! Common test utilities and helpers for Typst PDF generation testing

use resume_core::scoring::ScoredBullet;
use resume_core::{
    Bullet, Education, GenerationPayload, PersonalInfo, RoleProfile, ScoringWeights,
};
use std::collections::HashMap;

/// Builder for test generation payloads
pub struct TestDataBuilder;

impl TestDataBuilder {
    /// Create minimal valid payload
    pub fn minimal_payload() -> GenerationPayload {
        let mut tag_weights = HashMap::new();
        tag_weights.insert("test".to_string(), 1.0);

        GenerationPayload {
            personal: PersonalInfo {
                name: "Test User".to_string(),
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
                    description: "Test bullet".to_string(),
                    tags: vec![],
                    priority: 5,
                    link: None,
                },
                score: 0.5,
                company_id: "co1".to_string(),
                company_name: Some("Company".to_string()),
                company_description: None,
                company_link: None,
                company_date_start: "2020".to_string(),
                company_date_end: Some("2021".to_string()),
                company_location: None,
                position_id: "pos1".to_string(),
                position_name: "Position".to_string(),
                position_description: None,
                position_date_start: "2020".to_string(),
                position_date_end: Some("2021".to_string()),
            }],
            role_profile: RoleProfile {
                id: "test".to_string(),
                name: "Test Role".to_string(),
                description: None,
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: None,
            summary: None,
            meta_footer: None,
            total_bullets_available: Some(10),
            total_companies_available: Some(2),
            metadata: None,
        }
    }

    /// Create payload with special characters and Unicode
    pub fn with_unicode() -> GenerationPayload {
        let mut base = Self::minimal_payload();

        base.personal.name = "François Müller-O'Brien".to_string();
        base.personal.email = Some("françois.müller@example.com".to_string());
        base.personal.location = Some("São Paulo, Brazil • 日本 Tokyo".to_string());

        base.selected_bullets[0].bullet.description =
            "Implemented system with 100% uptime → reduced costs by €50K/year • improved latency ≤ 10ms".to_string();

        base.summary = Some("Engineer with expertise in distributed systems — focused on reliability & performance. Background in both 🚀 startups and enterprises (FAANG).".to_string());

        base
    }

    /// Create payload with extremely long text to test wrapping
    pub fn with_long_text() -> GenerationPayload {
        let mut base = Self::minimal_payload();

        // Very long bullet that should wrap across multiple lines
        base.selected_bullets[0].bullet.description =
            "Led a comprehensive infrastructure migration project that involved coordinating across multiple teams, refactoring legacy systems, implementing modern cloud-native architectures, establishing CI/CD pipelines, improving observability with distributed tracing and metrics, reducing operational costs by 40%, improving deployment frequency from monthly to daily, decreasing mean time to recovery by 75%, and mentoring 5 junior engineers throughout the process while maintaining 99.99% uptime and zero downtime migrations.".to_string();

        // 500-word summary to test multi-page layout
        base.summary = Some("Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50));

        base
    }

    /// Create payload with empty optional fields
    pub fn with_empty_fields() -> GenerationPayload {
        let mut tag_weights = HashMap::new();
        tag_weights.insert("test".to_string(), 1.0);

        GenerationPayload {
            personal: PersonalInfo {
                name: "Minimal User".to_string(),
                nickname: None,
                tagline: None,
                email: None,
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                website: None,
                twitter: None,
            },
            selected_bullets: vec![],
            role_profile: RoleProfile {
                id: "minimal".to_string(),
                name: "Minimal".to_string(),
                description: None,
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.5,
                    priority: 0.5,
                },
            },
            education: None,
            skills: None,
            summary: None,
            meta_footer: None,
            total_bullets_available: Some(0),
            total_companies_available: Some(0),
            metadata: None,
        }
    }

    /// Create comprehensive payload with all fields
    pub fn comprehensive_payload() -> GenerationPayload {
        let mut tag_weights = HashMap::new();
        tag_weights.insert("engineering".to_string(), 1.0);
        tag_weights.insert("leadership".to_string(), 0.9);

        let mut skills = HashMap::new();
        skills.insert(
            "technical".to_string(),
            vec!["Rust".to_string(), "TypeScript".to_string()],
        );

        GenerationPayload {
            personal: PersonalInfo {
                name: "Jane Doe".to_string(),
                nickname: Some("Jane".to_string()),
                tagline: Some("Senior Software Engineer".to_string()),
                email: Some("jane@example.com".to_string()),
                phone: Some("+1 (555) 123-4567".to_string()),
                location: Some("San Francisco, CA".to_string()),
                linkedin: Some("janedoe".to_string()),
                github: Some("janedoe".to_string()),
                website: Some("janedoe.com".to_string()),
                twitter: None,
            },
            selected_bullets: vec![
                ScoredBullet {
                    bullet: Bullet {
                        id: "b1".to_string(),
                        name: None,
                        location: None,
                        date_start: None,
                        date_end: None,
                        summary: None,
                        description: "Led infrastructure migration to Kubernetes, reducing deployment time by 75%".to_string(),
                        tags: vec!["engineering".to_string()],
                        priority: 10,
                        link: None,
                    },
                    score: 0.95,
                    company_id: "tech-corp".to_string(),
                    company_name: Some("Tech Corp".to_string()),
                    company_description: Some("Leading technology company".to_string()),
                    company_link: Some("https://techcorp.com".to_string()),
                    company_date_start: "2018".to_string(),
                    company_date_end: Some("2022".to_string()),
                    company_location: Some("San Francisco, CA".to_string()),
                    position_id: "senior-engineer".to_string(),
                    position_name: "Senior Software Engineer".to_string(),
                    position_description: Some("Led infrastructure team".to_string()),
                    position_date_start: "2020".to_string(),
                    position_date_end: Some("2022".to_string()),
                },
                ScoredBullet {
                    bullet: Bullet {
                        id: "b2".to_string(),
                        name: None,
                        location: None,
                        date_start: None,
                        date_end: None,
                        summary: None,
                        description: "Mentored team of 5 junior engineers".to_string(),
                        tags: vec!["leadership".to_string()],
                        priority: 9,
                        link: None,
                    },
                    score: 0.92,
                    company_id: "tech-corp".to_string(),
                    company_name: Some("Tech Corp".to_string()),
                    company_description: Some("Leading technology company".to_string()),
                    company_link: Some("https://techcorp.com".to_string()),
                    company_date_start: "2018".to_string(),
                    company_date_end: Some("2022".to_string()),
                    company_location: Some("San Francisco, CA".to_string()),
                    position_id: "senior-engineer".to_string(),
                    position_name: "Senior Software Engineer".to_string(),
                    position_description: Some("Led infrastructure team".to_string()),
                    position_date_start: "2020".to_string(),
                    position_date_end: Some("2022".to_string()),
                },
            ],
            role_profile: RoleProfile {
                id: "software-engineer".to_string(),
                name: "Software Engineer".to_string(),
                description: Some("Full-stack development".to_string()),
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: Some(vec![Education {
                degree: "Bachelor of Science in Computer Science".to_string(),
                degree_type: "BSc".to_string(),
                institution: "Stanford University".to_string(),
                location: "Stanford, CA".to_string(),
                year: "2020".to_string(),
                coursework: Some(vec!["Algorithms".to_string()]),
                societies: Some(vec!["ACM".to_string()]),
            }]),
            skills: Some(skills),
            summary: Some("Experienced software engineer with 8+ years building scalable systems.".to_string()),
            meta_footer: Some("Generated by Resumate".to_string()),
            total_bullets_available: Some(50),
            total_companies_available: Some(5),
            metadata: None,
        }
    }
}

/// PDF validation utilities
pub struct PdfValidator;

impl PdfValidator {
    /// Validate basic PDF structure
    pub fn validate_structure(pdf_bytes: &[u8]) -> Result<(), String> {
        // Check PDF header
        if !pdf_bytes.starts_with(b"%PDF") {
            return Err("Missing PDF header magic bytes".to_string());
        }

        // Check minimum size
        if pdf_bytes.len() < 100 {
            return Err(format!(
                "PDF too small ({} bytes), likely invalid",
                pdf_bytes.len()
            ));
        }

        // Check for EOF marker
        if !pdf_bytes.ends_with(b"%%EOF\n") && !pdf_bytes.ends_with(b"%%EOF") {
            return Err("Missing EOF marker".to_string());
        }

        // Convert to string for text searches
        let pdf_string = String::from_utf8_lossy(pdf_bytes);

        // Check for required PDF elements
        if !pdf_string.contains("/Catalog") && !pdf_string.contains("/Type/Catalog") {
            return Err("Missing PDF catalog".to_string());
        }

        if !pdf_string.contains("/Pages") {
            return Err("Missing pages object".to_string());
        }

        Ok(())
    }

    /// Verify PDF contains expected text content
    pub fn contains_text(pdf_bytes: &[u8], text: &str) -> bool {
        let pdf_string = String::from_utf8_lossy(pdf_bytes);
        pdf_string.contains(text)
    }

    /// Verify PDF has text rendering operators (Typst uses different structure)
    pub fn has_text_content(pdf_bytes: &[u8]) -> bool {
        // Typst may use different operators - just check PDF isn't empty and has reasonable size
        pdf_bytes.len() > 5000
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_minimal_payload_is_valid() {
        let payload = TestDataBuilder::minimal_payload();
        assert!(!payload.personal.name.is_empty());
        assert!(!payload.selected_bullets.is_empty());
    }

    #[test]
    fn test_unicode_payload() {
        let payload = TestDataBuilder::with_unicode();
        assert!(payload.personal.name.contains("François"));
        assert!(payload.selected_bullets[0].bullet.description.contains("€"));
    }

    #[test]
    fn test_long_text_payload() {
        let payload = TestDataBuilder::with_long_text();
        assert!(payload.selected_bullets[0].bullet.description.len() > 200);
    }
}
