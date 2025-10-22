//! Experience section rendering (companies, positions, bullets)

use crate::layout::ResumeLayout;
use crate::{GenerationPayload, PdfError};
use docgen_core::scoring::ScoredBullet;
use pdf_writer::{Content, Name, Pdf};
use std::collections::HashMap;

/// Group bullets by company and position for rendering
struct ExperienceGroup {
    company_id: String,
    company_name: String,
    positions: Vec<PositionGroup>,
}

struct PositionGroup {
    position_id: String,
    position_name: String,
    bullets: Vec<ScoredBullet>,
}

/// Render the experience section
///
/// Groups bullets by company and position, rendering in hierarchical format:
/// - Company name + dates
/// - Position title + dates
/// - Bullet points (indented)
///
/// Returns the Y position after rendering
pub fn render(
    _pdf: &mut Pdf,
    content: &mut Content,
    payload: &GenerationPayload,
    layout: &ResumeLayout,
    start_y: f32,
) -> Result<f32, PdfError> {
    let mut current_y = start_y;

    // Add section heading
    content
        .begin_text()
        .set_font(Name(b"F1"), layout.font_size_heading)
        .next_line(layout.margin_left, current_y)
        .show(pdf_writer::Str(b"EXPERIENCE"))
        .end_text();

    current_y -= layout.line_height(layout.font_size_heading) + 4.0;

    // Group bullets by company and position
    let groups = group_bullets_by_company(&payload.selected_bullets);

    // Render each company group
    for group in groups {
        current_y = render_company_group(content, &group, layout, current_y)?;
    }

    Ok(current_y)
}

/// Group bullets by company, then by position
/// Preserves the order of first appearance (bullets are pre-sorted by score)
fn group_bullets_by_company(bullets: &[ScoredBullet]) -> Vec<ExperienceGroup> {
    let mut groups: Vec<ExperienceGroup> = vec![];
    let mut company_indices: HashMap<String, usize> = HashMap::new();

    for bullet in bullets {
        // Find or create company group (preserving first-seen order)
        let company_idx = if let Some(&idx) = company_indices.get(&bullet.company_id) {
            idx
        } else {
            let idx = groups.len();
            company_indices.insert(bullet.company_id.clone(), idx);
            groups.push(ExperienceGroup {
                company_id: bullet.company_id.clone(),
                company_name: bullet
                    .company_name
                    .clone()
                    .unwrap_or_else(|| bullet.company_id.clone()),
                positions: vec![],
            });
            idx
        };

        let company = &mut groups[company_idx];

        // Find or create position group (preserving first-seen order)
        let position_entry = company
            .positions
            .iter_mut()
            .find(|p| p.position_id == bullet.position_id);

        if let Some(pos) = position_entry {
            pos.bullets.push(bullet.clone());
        } else {
            company.positions.push(PositionGroup {
                position_id: bullet.position_id.clone(),
                position_name: bullet.position_name.clone(),
                bullets: vec![bullet.clone()],
            });
        }
    }

    groups
}

/// Render a single company group (company header + positions + bullets)
fn render_company_group(
    content: &mut Content,
    group: &ExperienceGroup,
    layout: &ResumeLayout,
    start_y: f32,
) -> Result<f32, PdfError> {
    let mut current_y = start_y;

    // Render company name (bold, larger)
    content
        .begin_text()
        .set_font(Name(b"F1"), layout.font_size_subheading)
        .next_line(layout.margin_left, current_y)
        .show(pdf_writer::Str(group.company_name.as_bytes()))
        .end_text();

    current_y -= layout.line_height(layout.font_size_subheading);

    // Render each position in this company
    for position in &group.positions {
        current_y = render_position_group(content, position, layout, current_y)?;
    }

    // Add spacing after company
    current_y -= layout.section_spacing;

    Ok(current_y)
}

/// Render a single position group (position title + bullets)
fn render_position_group(
    content: &mut Content,
    group: &PositionGroup,
    layout: &ResumeLayout,
    start_y: f32,
) -> Result<f32, PdfError> {
    let mut current_y = start_y;

    // Render position title (slightly smaller than company, indented)
    content
        .begin_text()
        .set_font(Name(b"F1"), layout.font_size_body)
        .next_line(layout.margin_left + 10.0, current_y) // Slight indent
        .show(pdf_writer::Str(group.position_name.as_bytes()))
        .end_text();

    current_y -= layout.line_height(layout.font_size_body);

    // Render bullets
    for bullet in &group.bullets {
        current_y = render_bullet(content, &bullet.bullet.description, layout, current_y)?;
    }

    Ok(current_y)
}

/// Render a single bullet point
fn render_bullet(
    content: &mut Content,
    text: &str,
    layout: &ResumeLayout,
    start_y: f32,
) -> Result<f32, PdfError> {
    let mut current_y = start_y;

    // Wrap text to fit within content width minus bullet indent
    let available_width = layout.content_width() - layout.bullet_indent;
    let lines = layout.wrap_text(text, available_width, layout.font_size_body);

    for (i, line) in lines.iter().enumerate() {
        let x_pos = if i == 0 {
            // First line: render bullet point
            // Using hyphen for PDF compatibility and ATS parsing
            content
                .begin_text()
                .set_font(Name(b"F2"), layout.font_size_body)
                .next_line(layout.margin_left + layout.bullet_indent, current_y)
                .show(pdf_writer::Str(b"- ")) // Hyphen bullet
                .end_text();

            layout.margin_left + layout.bullet_indent + 12.0 // Bullet width
        } else {
            // Continuation lines: align with first line text
            layout.margin_left + layout.bullet_indent + 12.0
        };

        // Render line text
        content
            .begin_text()
            .set_font(Name(b"F2"), layout.font_size_body)
            .next_line(x_pos, current_y)
            .show(pdf_writer::Str(line.as_bytes()))
            .end_text();

        current_y -= layout.line_height(layout.font_size_body);
    }

    Ok(current_y)
}

#[cfg(test)]
mod tests {
    use super::*;
    use docgen_core::Bullet;

    fn create_test_bullets() -> Vec<ScoredBullet> {
        vec![
            ScoredBullet {
                bullet: Bullet {
                    id: "b1".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Led infrastructure migration reducing costs by 40%".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 10,
                    link: None,
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
                    description: "Mentored team of 5 junior engineers".to_string(),
                    tags: vec!["leadership".to_string()],
                    priority: 9,
                    link: None,
                },
                score: 0.90,
                company_id: "company1".to_string(),
                company_name: Some("Tech Corp".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Senior Engineer".to_string(),
            },
            ScoredBullet {
                bullet: Bullet {
                    id: "b3".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Built scalable API serving 10M requests/day".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 8,
                    link: None,
                },
                score: 0.85,
                company_id: "company2".to_string(),
                company_name: Some("Startup Inc".to_string()),
                position_id: "pos2".to_string(),
                position_name: "Full Stack Developer".to_string(),
            },
        ]
    }

    // ========== Company Grouping Tests ==========

    #[test]
    fn test_group_bullets_by_company() {
        let bullets = create_test_bullets();
        let groups = group_bullets_by_company(&bullets);

        assert_eq!(groups.len(), 2); // 2 companies

        // Find Tech Corp group
        let tech_corp = groups.iter().find(|g| g.company_id == "company1");
        assert!(tech_corp.is_some());

        let tech_corp = tech_corp.unwrap();
        assert_eq!(tech_corp.positions.len(), 1); // 1 position
        assert_eq!(tech_corp.positions[0].bullets.len(), 2); // 2 bullets
    }

    #[test]
    fn test_group_bullets_multiple_positions_same_company() {
        let bullets = vec![
            ScoredBullet {
                bullet: Bullet {
                    id: "b1".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Senior work".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 10,
                    link: None,
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
                    description: "Junior work".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 8,
                    link: None,
                },
                score: 0.80,
                company_id: "company1".to_string(),
                company_name: Some("Tech Corp".to_string()),
                position_id: "pos2".to_string(),
                position_name: "Junior Engineer".to_string(),
            },
        ];

        let groups = group_bullets_by_company(&bullets);
        assert_eq!(groups.len(), 1); // 1 company
        assert_eq!(groups[0].positions.len(), 2); // 2 positions
        assert_eq!(groups[0].positions[0].bullets.len(), 1); // 1 bullet per position
        assert_eq!(groups[0].positions[1].bullets.len(), 1);
    }

    #[test]
    fn test_group_bullets_no_company_name() {
        let bullets = vec![ScoredBullet {
            bullet: Bullet {
                id: "b1".to_string(),
                name: None,
                location: None,
                date_start: None,
                date_end: None,
                summary: None,
                description: "Work without company name".to_string(),
                tags: vec!["engineering".to_string()],
                priority: 10,
                link: None,
            },
            score: 0.95,
            company_id: "company1".to_string(),
            company_name: None,
            position_id: "pos1".to_string(),
            position_name: "Engineer".to_string(),
        }];

        let groups = group_bullets_by_company(&bullets);
        assert_eq!(groups.len(), 1);
        // Should fall back to company_id
        assert_eq!(groups[0].company_name, "company1");
    }

    #[test]
    fn test_group_bullets_empty_list() {
        let bullets: Vec<ScoredBullet> = vec![];
        let groups = group_bullets_by_company(&bullets);
        assert_eq!(groups.len(), 0);
    }

    #[test]
    fn test_group_bullets_unicode_company_names() {
        let bullets = vec![
            ScoredBullet {
                bullet: Bullet {
                    id: "b1".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Chinese company work".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 10,
                    link: None,
                },
                score: 0.95,
                company_id: "company1".to_string(),
                company_name: Some("阿里巴巴集团".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Engineer".to_string(),
            },
            ScoredBullet {
                bullet: Bullet {
                    id: "b2".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Arabic company work".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 9,
                    link: None,
                },
                score: 0.90,
                company_id: "company2".to_string(),
                company_name: Some("شركة التقنية".to_string()),
                position_id: "pos2".to_string(),
                position_name: "Developer".to_string(),
            },
        ];

        let groups = group_bullets_by_company(&bullets);
        assert_eq!(groups.len(), 2);

        let chinese = groups.iter().find(|g| g.company_id == "company1");
        assert!(chinese.is_some());
        assert_eq!(chinese.unwrap().company_name, "阿里巴巴集团");

        let arabic = groups.iter().find(|g| g.company_id == "company2");
        assert!(arabic.is_some());
        assert_eq!(arabic.unwrap().company_name, "شركة التقنية");
    }

    // ========== Position Hierarchy Tests ==========

    #[test]
    fn test_render_position_group_basic() {
        let position = PositionGroup {
            position_id: "pos1".to_string(),
            position_name: "Senior Engineer".to_string(),
            bullets: vec![ScoredBullet {
                bullet: Bullet {
                    id: "b1".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Led team".to_string(),
                    tags: vec!["leadership".to_string()],
                    priority: 10,
                    link: None,
                },
                score: 0.95,
                company_id: "company1".to_string(),
                company_name: Some("Tech Corp".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Senior Engineer".to_string(),
            }],
        };

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_position_group(&mut content, &position, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(end_y < start_y);
    }

    #[test]
    fn test_render_position_group_multiple_bullets() {
        let bullets = vec![
            ScoredBullet {
                bullet: Bullet {
                    id: "b1".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "First achievement".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 10,
                    link: None,
                },
                score: 0.95,
                company_id: "company1".to_string(),
                company_name: Some("Tech Corp".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Engineer".to_string(),
            },
            ScoredBullet {
                bullet: Bullet {
                    id: "b2".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Second achievement".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 9,
                    link: None,
                },
                score: 0.90,
                company_id: "company1".to_string(),
                company_name: Some("Tech Corp".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Engineer".to_string(),
            },
        ];

        let position = PositionGroup {
            position_id: "pos1".to_string(),
            position_name: "Engineer".to_string(),
            bullets,
        };

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_position_group(&mut content, &position, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Should use more space with 2 bullets
        assert!(end_y < start_y - 20.0);
    }

    #[test]
    fn test_render_position_group_unicode_title() {
        let position_titles = vec![
            "高级软件工程师",    // Chinese: Senior Software Engineer
            "مهندس برمجيات أول", // Arabic: Senior Software Engineer
            "Старший инженер",   // Russian: Senior Engineer
        ];

        let layout = ResumeLayout::default();

        for title in position_titles {
            let position = PositionGroup {
                position_id: "pos1".to_string(),
                position_name: title.to_string(),
                bullets: vec![],
            };

            let mut content = Content::new();
            let result = render_position_group(&mut content, &position, &layout, 700.0);
            assert!(
                result.is_ok(),
                "Failed to render Unicode position title: {}",
                title
            );
        }
    }

    // ========== Bullet Wrapping Tests ==========

    #[test]
    fn test_render_bullet_wrapping() {
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let long_text = "This is a very long bullet point that should definitely wrap onto multiple lines when rendered in the PDF with proper indentation and alignment";

        let start_y = 700.0;
        let result = render_bullet(&mut content, long_text, &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(end_y < start_y); // Y should decrease
    }

    #[test]
    fn test_render_bullet_short_text() {
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let short_text = "Led team";
        let start_y = 700.0;
        let result = render_bullet(&mut content, short_text, &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Short text should only use one line height
        let expected_delta = layout.line_height(layout.font_size_body);
        assert!((start_y - end_y - expected_delta).abs() < 1.0);
    }

    #[test]
    fn test_render_bullet_unicode_content() {
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let unicode_bullets = vec![
            "领导基础设施迁移，降低成本40%",
            "قاد هجرة البنية التحتية، مما قلل التكاليف بنسبة 40٪",
            "Руководил миграцией инфраструктуры, снизив затраты на 40%",
        ];

        for text in unicode_bullets {
            let result = render_bullet(&mut content, text, &layout, 700.0);
            assert!(result.is_ok(), "Failed to render Unicode bullet: {}", text);
        }
    }

    #[test]
    fn test_render_bullet_special_characters() {
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let special_texts = vec![
            "Improved performance by 50% & reduced costs by 30%",
            "Built API (RESTful) with OAuth2.0 authentication",
            "Managed $1.5M budget across 3 teams",
            "Deployed to AWS/GCP/Azure simultaneously",
        ];

        for text in special_texts {
            let result = render_bullet(&mut content, text, &layout, 700.0);
            assert!(
                result.is_ok(),
                "Failed to render special characters: {}",
                text
            );
        }
    }

    #[test]
    fn test_render_bullet_numbers_and_metrics() {
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let metric_bullets = vec![
            "Increased revenue by $2.5M (150% YoY growth)",
            "Reduced latency from 500ms to 50ms (90% improvement)",
            "Managed team of 12 engineers across 4 time zones",
            "Processed 10M+ requests/day with 99.99% uptime",
        ];

        for text in metric_bullets {
            let result = render_bullet(&mut content, text, &layout, 700.0);
            assert!(result.is_ok(), "Failed to render metrics: {}", text);
        }
    }

    #[test]
    fn test_render_bullet_empty_text() {
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let empty_text = "";
        let start_y = 700.0;
        let result = render_bullet(&mut content, empty_text, &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Even empty text should consume some space
        assert!(end_y < start_y);
    }

    // ========== Company Rendering Tests ==========

    #[test]
    fn test_render_company_group() {
        let bullets = create_test_bullets();
        let groups = group_bullets_by_company(&bullets);
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let start_y = 700.0;
        let result = render_company_group(&mut content, &groups[0], &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(end_y < start_y);
    }

    #[test]
    fn test_render_company_group_long_name() {
        let company = ExperienceGroup {
            company_id: "company1".to_string(),
            company_name:
                "International Business Machines Corporation - Global Technology Services Division"
                    .to_string(),
            positions: vec![],
        };

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_company_group(&mut content, &company, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(end_y < start_y);
    }

    #[test]
    fn test_render_company_group_multiple_positions() {
        let company = ExperienceGroup {
            company_id: "company1".to_string(),
            company_name: "Tech Corp".to_string(),
            positions: vec![
                PositionGroup {
                    position_id: "pos1".to_string(),
                    position_name: "Senior Engineer".to_string(),
                    bullets: vec![],
                },
                PositionGroup {
                    position_id: "pos2".to_string(),
                    position_name: "Junior Engineer".to_string(),
                    bullets: vec![],
                },
            ],
        };

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_company_group(&mut content, &company, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Should use more space with multiple positions
        assert!(end_y < start_y - 30.0);
    }

    // ========== Full Experience Section Tests ==========

    #[test]
    fn test_render_experience_full_section() {
        let bullets = create_test_bullets();
        let payload = crate::GenerationPayload {
            personal: crate::PersonalInfo {
                name: "Test Person".to_string(),
                email: Some("test@example.com".to_string()),
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                website: None,
                twitter: None,
                nickname: None,
                tagline: None,
            },
            selected_bullets: bullets,
            role_profile: docgen_core::RoleProfile {
                id: "test".to_string(),
                name: "Test Role".to_string(),
                description: None,
                tag_weights: std::collections::HashMap::new(),
                scoring_weights: docgen_core::ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: None,
            summary: None,
            metadata: None,
        };

        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();
        let start_y = 750.0;

        let result = render(&mut pdf, &mut content, &payload, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(end_y < start_y);
    }

    #[test]
    fn test_render_experience_no_bullets() {
        let payload = crate::GenerationPayload {
            personal: crate::PersonalInfo {
                name: "Test Person".to_string(),
                email: Some("test@example.com".to_string()),
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                website: None,
                twitter: None,
                nickname: None,
                tagline: None,
            },
            selected_bullets: vec![],
            role_profile: docgen_core::RoleProfile {
                id: "test".to_string(),
                name: "Test Role".to_string(),
                description: None,
                tag_weights: std::collections::HashMap::new(),
                scoring_weights: docgen_core::ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: None,
            summary: None,
            metadata: None,
        };

        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();
        let start_y = 750.0;

        let result = render(&mut pdf, &mut content, &payload, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Should only render section heading
        assert!(end_y < start_y);
    }

    #[test]
    fn test_render_experience_many_companies() {
        let mut bullets = vec![];
        for i in 0..10 {
            bullets.push(ScoredBullet {
                bullet: Bullet {
                    id: format!("b{}", i),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: format!("Achievement at company {}", i),
                    tags: vec!["engineering".to_string()],
                    priority: 8,
                    link: None,
                },
                score: 0.80,
                company_id: format!("company{}", i),
                company_name: Some(format!("Company {}", i)),
                position_id: format!("pos{}", i),
                position_name: format!("Position {}", i),
            });
        }

        let groups = group_bullets_by_company(&bullets);
        assert_eq!(groups.len(), 10);
    }

    // ========== Additional Edge Cases ==========

    #[test]
    fn test_render_bullet_very_long_single_word() {
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        // Test that very long unbreakable strings don't crash
        let long_word = "Supercalifragilisticexpialidocious".repeat(10);
        let result = render_bullet(&mut content, &long_word, &layout, 700.0);

        assert!(result.is_ok());
    }

    #[test]
    fn test_render_experience_interleaved_companies() {
        // Test that bullets from same company are correctly grouped
        // even when they appear non-consecutively in input
        let bullets = vec![
            ScoredBullet {
                bullet: Bullet {
                    id: "b1".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Company A bullet 1".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 10,
                    link: None,
                },
                score: 0.95,
                company_id: "companyA".to_string(),
                company_name: Some("Company A".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Engineer".to_string(),
            },
            ScoredBullet {
                bullet: Bullet {
                    id: "b2".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Company B bullet 1".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 9,
                    link: None,
                },
                score: 0.90,
                company_id: "companyB".to_string(),
                company_name: Some("Company B".to_string()),
                position_id: "pos2".to_string(),
                position_name: "Developer".to_string(),
            },
            ScoredBullet {
                bullet: Bullet {
                    id: "b3".to_string(),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: "Company A bullet 2".to_string(),
                    tags: vec!["engineering".to_string()],
                    priority: 8,
                    link: None,
                },
                score: 0.85,
                company_id: "companyA".to_string(),
                company_name: Some("Company A".to_string()),
                position_id: "pos1".to_string(),
                position_name: "Engineer".to_string(),
            },
        ];

        let groups = group_bullets_by_company(&bullets);
        assert_eq!(groups.len(), 2); // 2 companies despite interleaving

        let company_a = groups.iter().find(|g| g.company_id == "companyA");
        assert!(company_a.is_some());
        assert_eq!(company_a.unwrap().positions[0].bullets.len(), 2); // Both bullets grouped
    }

    #[test]
    fn test_render_bullet_newlines_in_text() {
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        // Bullet text with embedded newlines (should be handled gracefully)
        let text_with_newlines = "First line\nSecond line\nThird line";
        let result = render_bullet(&mut content, text_with_newlines, &layout, 700.0);

        assert!(result.is_ok());
    }

    #[test]
    fn test_render_position_group_empty_bullets() {
        let position = PositionGroup {
            position_id: "pos1".to_string(),
            position_name: "Engineer".to_string(),
            bullets: vec![],
        };

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_position_group(&mut content, &position, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Should still render position title even with no bullets
        assert!(end_y < start_y);
    }

    #[test]
    fn test_render_experience_mixed_unicode_and_ascii() {
        let bullets = vec![ScoredBullet {
            bullet: Bullet {
                id: "b1".to_string(),
                name: None,
                location: None,
                date_start: None,
                date_end: None,
                summary: None,
                description: "Led team at 谷歌 (Google) with 50% improvement".to_string(),
                tags: vec!["engineering".to_string()],
                priority: 10,
                link: None,
            },
            score: 0.95,
            company_id: "company1".to_string(),
            company_name: Some("Google 谷歌".to_string()),
            position_id: "pos1".to_string(),
            position_name: "Senior Engineer 高级工程师".to_string(),
        }];

        let payload = crate::GenerationPayload {
            personal: crate::PersonalInfo {
                name: "Test Person".to_string(),
                email: Some("test@example.com".to_string()),
                phone: None,
                location: None,
                linkedin: None,
                github: None,
                website: None,
                twitter: None,
                nickname: None,
                tagline: None,
            },
            selected_bullets: bullets,
            role_profile: docgen_core::RoleProfile {
                id: "test".to_string(),
                name: "Test Role".to_string(),
                description: None,
                tag_weights: std::collections::HashMap::new(),
                scoring_weights: docgen_core::ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: None,
            summary: None,
            metadata: None,
        };

        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();
        let start_y = 750.0;

        let result = render(&mut pdf, &mut content, &payload, &layout, start_y);
        assert!(result.is_ok(), "Failed to render mixed Unicode and ASCII");
    }
}
