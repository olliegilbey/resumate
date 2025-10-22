//! Common test utilities and helpers for PDF generation testing

use docgen_core::scoring::ScoredBullet;
use docgen_core::{Bullet, Education, PersonalInfo, RoleProfile, ScoringWeights};
use docgen_pdf::{GenerationMetadata, GenerationPayload};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

// =============================================================================
// TEST LOGGER
// =============================================================================

/// Log entry for test debugging
#[derive(Debug, Clone)]
pub struct LogEntry {
    pub level: LogLevel,
    pub message: String,
    pub timestamp: SystemTime,
}

#[derive(Debug, Clone, PartialEq)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

/// Test logger for capturing and asserting on log output
pub struct TestLogger {
    entries: Arc<Mutex<Vec<LogEntry>>>,
}

impl TestLogger {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn debug(&self, message: impl Into<String>) {
        self.log(LogLevel::Debug, message.into());
    }

    pub fn info(&self, message: impl Into<String>) {
        self.log(LogLevel::Info, message.into());
    }

    pub fn warn(&self, message: impl Into<String>) {
        self.log(LogLevel::Warn, message.into());
    }

    pub fn error(&self, message: impl Into<String>) {
        self.log(LogLevel::Error, message.into());
    }

    fn log(&self, level: LogLevel, message: String) {
        let entry = LogEntry {
            level,
            message: message.clone(),
            timestamp: SystemTime::now(),
        };

        self.entries.lock().unwrap().push(entry);

        // Also print to console for debugging
        let prefix = match level {
            LogLevel::Debug => "[DEBUG]",
            LogLevel::Info => "[INFO]",
            LogLevel::Warn => "[WARN]",
            LogLevel::Error => "[ERROR]",
        };
        eprintln!("{} {}", prefix, message);
    }

    /// Assert that logs contain a specific pattern
    pub fn assert_log_contains(&self, pattern: &str) {
        let entries = self.entries.lock().unwrap();
        let found = entries.iter().any(|e| e.message.contains(pattern));
        assert!(
            found,
            "Expected to find '{}' in logs, but didn't. Logs:\n{}",
            pattern,
            self.dump_logs_string()
        );
    }

    /// Assert that no error logs were recorded
    pub fn assert_no_errors(&self) {
        let entries = self.entries.lock().unwrap();
        let errors: Vec<_> = entries
            .iter()
            .filter(|e| e.level == LogLevel::Error)
            .collect();

        assert!(
            errors.is_empty(),
            "Expected no errors, but found {}:\n{}",
            errors.len(),
            errors
                .iter()
                .map(|e| format!("  - {}", e.message))
                .collect::<Vec<_>>()
                .join("\n")
        );
    }

    /// Dump all logs to console
    pub fn dump_logs(&self) {
        println!("\n=== Test Logs ===");
        println!("{}", self.dump_logs_string());
        println!("=================\n");
    }

    fn dump_logs_string(&self) -> String {
        let entries = self.entries.lock().unwrap();
        entries
            .iter()
            .map(|e| {
                let level = match e.level {
                    LogLevel::Debug => "DEBUG",
                    LogLevel::Info => "INFO",
                    LogLevel::Warn => "WARN",
                    LogLevel::Error => "ERROR",
                };
                format!("[{}] {}", level, e.message)
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Get count of logs at a specific level
    pub fn count_level(&self, level: LogLevel) -> usize {
        self.entries.lock().unwrap().iter().filter(|e| e.level == level).count()
    }
}

// =============================================================================
// PDF VALIDATOR
// =============================================================================

/// PDF validation utilities
pub struct PdfValidator;

impl PdfValidator {
    /// Validate basic PDF structure
    pub fn validate_structure(pdf_bytes: &[u8]) -> ValidationReport {
        let mut report = ValidationReport::new();

        // Check PDF header
        if !pdf_bytes.starts_with(b"%PDF") {
            report.add_error("Missing PDF header magic bytes");
        }

        // Check minimum size
        if pdf_bytes.len() < 100 {
            report.add_error(&format!(
                "PDF too small ({} bytes), likely invalid",
                pdf_bytes.len()
            ));
        }

        // Check for EOF marker
        if !pdf_bytes.ends_with(b"%%EOF\n") && !pdf_bytes.ends_with(b"%%EOF") {
            report.add_warning("Missing EOF marker");
        }

        // Convert to string for text searches
        let pdf_string = String::from_utf8_lossy(pdf_bytes);

        // Check for required PDF elements
        if !pdf_string.contains("/Type /Catalog") {
            report.add_error("Missing PDF catalog");
        }

        if !pdf_string.contains("/Type /Pages") {
            report.add_error("Missing pages object");
        }

        if !pdf_string.contains("/Type /Page") {
            report.add_error("Missing page object");
        }

        report
    }

    /// Extract visible text from PDF (basic extraction)
    pub fn extract_text(pdf_bytes: &[u8]) -> String {
        let pdf_string = String::from_utf8_lossy(pdf_bytes);

        // Very basic text extraction - looks for text operations
        let mut extracted = String::new();

        for line in pdf_string.lines() {
            // Look for show text operations
            if line.contains("Tj") || line.contains("TJ") {
                // Extract text between parentheses
                if let Some(start) = line.rfind('(') {
                    if let Some(end) = line[start..].find(')') {
                        let text = &line[start + 1..start + end];
                        extracted.push_str(text);
                        extracted.push(' ');
                    }
                }
            }
        }

        extracted
    }

    /// Check ATS compliance
    pub fn check_ats_compliance(pdf_bytes: &[u8]) -> ComplianceReport {
        let mut report = ComplianceReport::new();

        let pdf_string = String::from_utf8_lossy(pdf_bytes);

        // Check for standard fonts (ATS-friendly)
        if pdf_string.contains("Helvetica") || pdf_string.contains("Arial") {
            report.add_check("Uses standard fonts", true);
        } else {
            report.add_check("Uses standard fonts", false);
        }

        // Check for images (should avoid for ATS)
        if pdf_string.contains("/Image") || pdf_string.contains("/XObject") {
            report.add_check("No embedded images", false);
        } else {
            report.add_check("No embedded images", true);
        }

        // Check for text extraction capability
        let extracted_text = Self::extract_text(pdf_bytes);
        if !extracted_text.is_empty() {
            report.add_check("Text is extractable", true);
        } else {
            report.add_check("Text is extractable", false);
        }

        report
    }
}

#[derive(Debug)]
pub struct ValidationReport {
    errors: Vec<String>,
    warnings: Vec<String>,
}

impl ValidationReport {
    fn new() -> Self {
        Self {
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    fn add_error(&mut self, error: &str) {
        self.errors.push(error.to_string());
    }

    fn add_warning(&mut self, warning: &str) {
        self.warnings.push(warning.to_string());
    }

    pub fn is_valid(&self) -> bool {
        self.errors.is_empty()
    }

    pub fn errors(&self) -> &[String] {
        &self.errors
    }

    pub fn warnings(&self) -> &[String] {
        &self.warnings
    }

    pub fn assert_valid(&self) {
        if !self.is_valid() {
            panic!(
                "PDF validation failed:\nErrors:\n{}\nWarnings:\n{}",
                self.errors.join("\n  - "),
                self.warnings.join("\n  - ")
            );
        }
    }
}

#[derive(Debug)]
pub struct ComplianceReport {
    checks: Vec<(String, bool)>,
}

impl ComplianceReport {
    fn new() -> Self {
        Self { checks: Vec::new() }
    }

    fn add_check(&mut self, check: &str, passed: bool) {
        self.checks.push((check.to_string(), passed));
    }

    pub fn is_compliant(&self) -> bool {
        self.checks.iter().all(|(_, passed)| *passed)
    }

    pub fn failed_checks(&self) -> Vec<&String> {
        self.checks
            .iter()
            .filter_map(|(check, passed)| if !passed { Some(check) } else { None })
            .collect()
    }

    pub fn assert_compliant(&self) {
        if !self.is_compliant() {
            panic!(
                "ATS compliance failed:\n{}",
                self.failed_checks()
                    .iter()
                    .map(|c| format!("  ✗ {}", c))
                    .collect::<Vec<_>>()
                    .join("\n")
            );
        }
    }
}

// =============================================================================
// TEST DATA BUILDER
// =============================================================================

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
                position_id: "pos1".to_string(),
                position_name: "Position".to_string(),
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
            metadata: None,
        }
    }

    /// Create maximal payload with all fields populated
    pub fn maximal_payload() -> GenerationPayload {
        let mut tag_weights = HashMap::new();
        tag_weights.insert("engineering".to_string(), 1.0);
        tag_weights.insert("leadership".to_string(), 0.9);
        tag_weights.insert("architecture".to_string(), 0.8);

        let mut skills = HashMap::new();
        skills.insert(
            "technical".to_string(),
            vec![
                "Rust".to_string(),
                "TypeScript".to_string(),
                "Python".to_string(),
                "Go".to_string(),
                "C++".to_string(),
            ],
        );
        skills.insert(
            "soft".to_string(),
            vec![
                "Leadership".to_string(),
                "Communication".to_string(),
                "Problem Solving".to_string(),
            ],
        );

        // Create 20 bullets across multiple companies
        let mut bullets = Vec::new();
        for i in 1..=20 {
            bullets.push(ScoredBullet {
                bullet: Bullet {
                    id: format!("bullet-{}", i),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: Some(format!("Additional context for bullet {}", i)),
                    description: format!(
                        "Comprehensive achievement {} with detailed metrics and impact demonstration",
                        i
                    ),
                    tags: vec!["engineering".to_string(), "leadership".to_string()],
                    priority: (i % 10) as u8 + 1,
                    link: Some(format!("https://example.com/work/{}", i)),
                },
                score: 1.0 - (i as f32 * 0.03),
                company_id: format!("company-{}", (i - 1) / 5 + 1),
                company_name: Some(format!("Company {}", (i - 1) / 5 + 1)),
                position_id: format!("position-{}", (i - 1) / 3 + 1),
                position_name: format!("Position {}", (i - 1) / 3 + 1),
            });
        }

        GenerationPayload {
            personal: PersonalInfo {
                name: "Jane Alexandra Doe-Smith".to_string(),
                nickname: Some("Jane".to_string()),
                tagline: Some("Building the future of distributed systems and cloud infrastructure".to_string()),
                email: Some("jane.doe@example.com".to_string()),
                phone: Some("+1 (555) 123-4567".to_string()),
                location: Some("San Francisco, CA".to_string()),
                linkedin: Some("janedoesmithexample".to_string()),
                github: Some("janedoe".to_string()),
                website: Some("https://janedoe.example.com".to_string()),
                twitter: Some("janedoe".to_string()),
            },
            selected_bullets: bullets,
            role_profile: RoleProfile {
                id: "senior-swe".to_string(),
                name: "Senior Software Engineer".to_string(),
                description: Some("Senior-level software engineering with focus on distributed systems, cloud infrastructure, and technical leadership".to_string()),
                tag_weights,
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: Some(vec![
                Education {
                    degree: "Master of Science in Computer Science".to_string(),
                    degree_type: "MSc".to_string(),
                    institution: "Stanford University".to_string(),
                    location: "Stanford, CA".to_string(),
                    year: "2020".to_string(),
                    coursework: Some(vec![
                        "Advanced Algorithms".to_string(),
                        "Distributed Systems".to_string(),
                        "Machine Learning".to_string(),
                        "Computer Security".to_string(),
                    ]),
                    societies: Some(vec!["ACM".to_string(), "IEEE".to_string()]),
                },
                Education {
                    degree: "Bachelor of Science in Computer Science".to_string(),
                    degree_type: "BSc".to_string(),
                    institution: "University of California, Berkeley".to_string(),
                    location: "Berkeley, CA".to_string(),
                    year: "2018".to_string(),
                    coursework: Some(vec![
                        "Data Structures".to_string(),
                        "Operating Systems".to_string(),
                        "Databases".to_string(),
                    ]),
                    societies: Some(vec!["Tau Beta Pi".to_string()]),
                },
            ]),
            skills: Some(skills),
            summary: Some("Experienced software engineer with 10+ years building scalable distributed systems and leading high-performing engineering teams. Proven track record of architecting and delivering mission-critical infrastructure serving millions of users. Passionate about developer experience, system reliability, and technical mentorship.".to_string()),
            metadata: Some(GenerationMetadata {
                generation_id: "test-maximal-001".to_string(),
                timestamp: 1234567890,
                selected_bullet_ids: (1..=20).map(|i| format!("bullet-{}", i)).collect(),
                role_profile_id: "senior-swe".to_string(),
            }),
        }
    }

    /// Create payload with special characters and Unicode
    pub fn with_special_chars() -> GenerationPayload {
        let mut base = Self::minimal_payload();

        base.personal.name = "François Müller-O'Brien".to_string();
        base.personal.email = Some("françois.müller@example.com".to_string());
        base.personal.location = Some("São Paulo, Brazil • 日本 Tokyo".to_string());

        base.selected_bullets[0].bullet.description =
            "Implemented system with 100% uptime → reduced costs by €50K/year • improved latency ≤ 10ms".to_string();

        base.summary = Some("Engineer with expertise in distributed systems — focused on reliability & performance. Background in both 🚀 startups and enterprises (FAANG).".to_string());

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
            metadata: None,
        }
    }

    /// Create payload with extremely long text
    pub fn with_long_text() -> GenerationPayload {
        let mut base = Self::minimal_payload();

        // 500-word summary
        base.summary = Some("Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50));

        // Very long bullet
        base.selected_bullets[0].bullet.description =
            "Architected and implemented a highly scalable, distributed microservices platform ".to_string() + &"with comprehensive monitoring, observability, and automated deployment pipelines ".repeat(20);

        base
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_logger_basic_functionality() {
        let logger = TestLogger::new();

        logger.debug("Debug message");
        logger.info("Info message");
        logger.warn("Warn message");
        logger.error("Error message");

        logger.assert_log_contains("Debug message");
        logger.assert_log_contains("Info message");

        assert_eq!(logger.count_level(LogLevel::Debug), 1);
        assert_eq!(logger.count_level(LogLevel::Error), 1);
    }

    #[test]
    #[should_panic(expected = "Expected no errors")]
    fn test_logger_assert_no_errors_fails() {
        let logger = TestLogger::new();
        logger.error("Something went wrong");
        logger.assert_no_errors();
    }

    #[test]
    fn test_pdf_validator_structure() {
        // Valid minimal PDF
        let valid_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page >>\nendobj\n%%EOF\n";

        let report = PdfValidator::validate_structure(valid_pdf);
        assert!(report.is_valid(), "Valid PDF should pass validation");
    }

    #[test]
    fn test_pdf_validator_invalid_pdf() {
        let invalid_pdf = b"Not a PDF";

        let report = PdfValidator::validate_structure(invalid_pdf);
        assert!(!report.is_valid(), "Invalid PDF should fail validation");
        assert!(!report.errors().is_empty());
    }

    #[test]
    fn test_minimal_payload_is_valid() {
        let payload = TestDataBuilder::minimal_payload();

        assert!(!payload.personal.name.is_empty());
        assert!(!payload.selected_bullets.is_empty());
    }

    #[test]
    fn test_maximal_payload_has_all_fields() {
        let payload = TestDataBuilder::maximal_payload();

        assert!(payload.summary.is_some());
        assert!(payload.education.is_some());
        assert!(payload.skills.is_some());
        assert!(payload.metadata.is_some());
        assert_eq!(payload.selected_bullets.len(), 20);
    }

    #[test]
    fn test_special_chars_payload() {
        let payload = TestDataBuilder::with_special_chars();

        assert!(payload.personal.name.contains("François"));
        assert!(payload.selected_bullets[0]
            .bullet
            .description
            .contains("€"));
    }
}
