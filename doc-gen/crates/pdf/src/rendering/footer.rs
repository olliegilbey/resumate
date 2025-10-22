//! Footer section rendering (education, skills)

use crate::layout::ResumeLayout;
use crate::{GenerationPayload, PdfError};
use pdf_writer::{Content, Name, Pdf};

/// Render the footer sections (education, skills)
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

    // Render education (if present)
    if let Some(education) = &payload.education {
        current_y = render_education(content, education, layout, current_y)?;
    }

    // Render skills (if present)
    if let Some(skills) = &payload.skills {
        current_y = render_skills(content, skills, layout, current_y)?;
    }

    Ok(current_y)
}

/// Render education section
fn render_education(
    content: &mut Content,
    education: &[docgen_core::Education],
    layout: &ResumeLayout,
    start_y: f32,
) -> Result<f32, PdfError> {
    let mut current_y = start_y;

    // Section heading
    content
        .begin_text()
        .set_font(Name(b"F1"), layout.font_size_heading)
        .next_line(layout.margin_left, current_y)
        .show(pdf_writer::Str(b"EDUCATION"))
        .end_text();

    current_y -= layout.line_height(layout.font_size_heading) + 4.0;

    // Render each education entry
    for edu in education {
        // Degree and institution
        let edu_line = format!("{}, {} - {}", edu.degree, edu.degree_type, edu.institution);

        content
            .begin_text()
            .set_font(Name(b"F1"), layout.font_size_subheading)
            .next_line(layout.margin_left, current_y)
            .show(pdf_writer::Str(edu_line.as_bytes()))
            .end_text();

        current_y -= layout.line_height(layout.font_size_subheading);

        // Location and year
        let details = format!("{} • {}", edu.location, edu.year);

        content
            .begin_text()
            .set_font(Name(b"F2"), layout.font_size_body)
            .next_line(layout.margin_left, current_y)
            .show(pdf_writer::Str(details.as_bytes()))
            .end_text();

        current_y -= layout.line_height(layout.font_size_body);

        // Coursework (if present)
        if let Some(coursework) = &edu.coursework {
            if !coursework.is_empty() {
                let coursework_text = format!("Coursework: {}", coursework.join(", "));
                let lines = layout.wrap_text(
                    &coursework_text,
                    layout.content_width(),
                    layout.font_size_body,
                );

                for line in lines {
                    content
                        .begin_text()
                        .set_font(Name(b"F2"), layout.font_size_body)
                        .next_line(layout.margin_left, current_y)
                        .show(pdf_writer::Str(line.as_bytes()))
                        .end_text();

                    current_y -= layout.line_height(layout.font_size_body);
                }
            }
        }

        // Societies (if present)
        if let Some(societies) = &edu.societies {
            if !societies.is_empty() {
                let societies_text = format!("Activities: {}", societies.join(", "));
                let lines = layout.wrap_text(
                    &societies_text,
                    layout.content_width(),
                    layout.font_size_body,
                );

                for line in lines {
                    content
                        .begin_text()
                        .set_font(Name(b"F2"), layout.font_size_body)
                        .next_line(layout.margin_left, current_y)
                        .show(pdf_writer::Str(line.as_bytes()))
                        .end_text();

                    current_y -= layout.line_height(layout.font_size_body);
                }
            }
        }

        // Spacing between education entries
        current_y -= 6.0;
    }

    // Section spacing
    current_y -= layout.section_spacing;

    Ok(current_y)
}

/// Render skills section
fn render_skills(
    content: &mut Content,
    skills: &std::collections::HashMap<String, Vec<String>>,
    layout: &ResumeLayout,
    start_y: f32,
) -> Result<f32, PdfError> {
    let mut current_y = start_y;

    // Section heading
    content
        .begin_text()
        .set_font(Name(b"F1"), layout.font_size_heading)
        .next_line(layout.margin_left, current_y)
        .show(pdf_writer::Str(b"SKILLS"))
        .end_text();

    current_y -= layout.line_height(layout.font_size_heading) + 4.0;

    // Sort categories for consistent ordering
    let mut categories: Vec<_> = skills.iter().collect();
    categories.sort_by_key(|(cat, _)| *cat);

    // Render each skill category
    for (category, skill_list) in categories {
        // Category name (capitalized)
        let category_name = capitalize_first(category);

        content
            .begin_text()
            .set_font(Name(b"F1"), layout.font_size_body)
            .next_line(layout.margin_left, current_y)
            .show(pdf_writer::Str(category_name.as_bytes()))
            .end_text();

        // Skills list (indented)
        let skills_text = skill_list.join(", ");
        let lines = layout.wrap_text(
            &skills_text,
            layout.content_width() - 20.0,
            layout.font_size_body,
        );

        for line in lines {
            content
                .begin_text()
                .set_font(Name(b"F2"), layout.font_size_body)
                .next_line(layout.margin_left + 80.0, current_y) // Indent skills
                .show(pdf_writer::Str(line.as_bytes()))
                .end_text();

            current_y -= layout.line_height(layout.font_size_body);
        }

        current_y -= 2.0; // Small spacing between categories
    }

    Ok(current_y)
}

/// Capitalize first letter of a string
fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => {
            let rest: String = chars.collect();
            format!("{}{}", first.to_uppercase(), rest)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use docgen_core::Education;
    use std::collections::HashMap;

    fn create_test_education() -> Vec<Education> {
        vec![Education {
            degree: "Bachelor of Science in Computer Science".to_string(),
            degree_type: "BSc".to_string(),
            institution: "Stanford University".to_string(),
            location: "Stanford, CA".to_string(),
            year: "2020".to_string(),
            coursework: Some(vec![
                "Data Structures".to_string(),
                "Algorithms".to_string(),
                "Operating Systems".to_string(),
            ]),
            societies: Some(vec!["ACM".to_string(), "IEEE".to_string()]),
        }]
    }

    fn create_test_skills() -> HashMap<String, Vec<String>> {
        let mut skills = HashMap::new();
        skills.insert(
            "technical".to_string(),
            vec![
                "Rust".to_string(),
                "TypeScript".to_string(),
                "Python".to_string(),
                "Docker".to_string(),
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
        skills
    }

    // ========== Education Tests ==========

    #[test]
    fn test_render_education() {
        let education = create_test_education();
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let start_y = 700.0;
        let result = render_education(&mut content, &education, &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(end_y < start_y);
    }

    #[test]
    fn test_render_education_minimal() {
        let education = vec![Education {
            degree: "Bachelor of Science".to_string(),
            degree_type: "BSc".to_string(),
            institution: "MIT".to_string(),
            location: "Cambridge, MA".to_string(),
            year: "2020".to_string(),
            coursework: None,
            societies: None,
        }];

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_education(&mut content, &education, &layout, start_y);
        assert!(result.is_ok());
    }

    #[test]
    fn test_render_education_multiple_entries() {
        let education = vec![
            Education {
                degree: "Ph.D. in Computer Science".to_string(),
                degree_type: "PhD".to_string(),
                institution: "MIT".to_string(),
                location: "Cambridge, MA".to_string(),
                year: "2024".to_string(),
                coursework: None,
                societies: None,
            },
            Education {
                degree: "Master of Science in Computer Science".to_string(),
                degree_type: "MSc".to_string(),
                institution: "Stanford University".to_string(),
                location: "Stanford, CA".to_string(),
                year: "2020".to_string(),
                coursework: Some(vec!["Machine Learning".to_string(), "AI".to_string()]),
                societies: None,
            },
            Education {
                degree: "Bachelor of Science in Computer Science".to_string(),
                degree_type: "BSc".to_string(),
                institution: "UC Berkeley".to_string(),
                location: "Berkeley, CA".to_string(),
                year: "2018".to_string(),
                coursework: None,
                societies: Some(vec!["ACM".to_string()]),
            },
        ];

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_education(&mut content, &education, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Multiple entries should use more space
        assert!(end_y < start_y - 50.0);
    }

    #[test]
    fn test_render_education_unicode_institution() {
        let education = vec![Education {
            degree: "计算机科学学士学位".to_string(),
            degree_type: "理学士".to_string(),
            institution: "清华大学".to_string(), // Tsinghua University
            location: "北京, 中国".to_string(),
            year: "2020".to_string(),
            coursework: None,
            societies: None,
        }];

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_education(&mut content, &education, &layout, start_y);
        assert!(result.is_ok(), "Failed to render Unicode education");
    }

    #[test]
    fn test_render_education_long_coursework() {
        let long_coursework = vec![
            "Advanced Data Structures and Algorithms".to_string(),
            "Distributed Systems and Cloud Computing".to_string(),
            "Machine Learning and Artificial Intelligence".to_string(),
            "Computer Networks and Network Security".to_string(),
            "Database Management Systems".to_string(),
            "Operating Systems Design and Implementation".to_string(),
            "Software Engineering and Project Management".to_string(),
        ];

        let education = vec![Education {
            degree: "Bachelor of Science".to_string(),
            degree_type: "BSc".to_string(),
            institution: "Stanford".to_string(),
            location: "Stanford, CA".to_string(),
            year: "2020".to_string(),
            coursework: Some(long_coursework),
            societies: None,
        }];

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_education(&mut content, &education, &layout, start_y);
        assert!(result.is_ok());
    }

    #[test]
    fn test_render_education_empty_list() {
        let education: Vec<Education> = vec![];
        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_education(&mut content, &education, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Empty list should still consume heading space
        assert!(end_y < start_y);
    }

    // ========== Skills Tests ==========

    #[test]
    fn test_render_skills() {
        let skills = create_test_skills();
        let layout = ResumeLayout::default();
        let mut content = Content::new();

        let start_y = 700.0;
        let result = render_skills(&mut content, &skills, &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(end_y < start_y);
    }

    #[test]
    fn test_render_skills_empty() {
        let skills = HashMap::new();
        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_skills(&mut content, &skills, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Empty map should still render heading
        assert!(end_y < start_y);
    }

    #[test]
    fn test_render_skills_single_category() {
        let mut skills = HashMap::new();
        skills.insert(
            "languages".to_string(),
            vec!["Rust".to_string(), "Go".to_string(), "Python".to_string()],
        );

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_skills(&mut content, &skills, &layout, start_y);
        assert!(result.is_ok());
    }

    #[test]
    fn test_render_skills_many_categories() {
        let mut skills = HashMap::new();
        skills.insert(
            "languages".to_string(),
            vec!["Rust".to_string(), "Python".to_string()],
        );
        skills.insert(
            "frameworks".to_string(),
            vec!["React".to_string(), "Next.js".to_string()],
        );
        skills.insert(
            "tools".to_string(),
            vec!["Docker".to_string(), "Kubernetes".to_string()],
        );
        skills.insert(
            "databases".to_string(),
            vec!["PostgreSQL".to_string(), "Redis".to_string()],
        );
        skills.insert(
            "cloud".to_string(),
            vec!["AWS".to_string(), "GCP".to_string()],
        );

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_skills(&mut content, &skills, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Many categories should use more space
        assert!(end_y < start_y - 40.0);
    }

    #[test]
    fn test_render_skills_long_list() {
        let mut skills = HashMap::new();
        let long_list = vec![
            "Rust",
            "Python",
            "JavaScript",
            "TypeScript",
            "Go",
            "Java",
            "C++",
            "C#",
            "Ruby",
            "PHP",
            "Swift",
            "Kotlin",
            "Scala",
            "Haskell",
            "OCaml",
            "Elixir",
            "Clojure",
            "Erlang",
            "Lua",
            "Dart",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();

        skills.insert("languages".to_string(), long_list);

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_skills(&mut content, &skills, &layout, start_y);
        assert!(result.is_ok());
    }

    #[test]
    fn test_render_skills_unicode() {
        let mut skills = HashMap::new();
        skills.insert(
            "编程语言".to_string(), // Programming Languages
            vec!["Rust".to_string(), "Python".to_string(), "Go".to_string()],
        );
        skills.insert(
            "工具".to_string(), // Tools
            vec!["Docker".to_string(), "Kubernetes".to_string()],
        );

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_skills(&mut content, &skills, &layout, start_y);
        assert!(result.is_ok(), "Failed to render Unicode skills");
    }

    // ========== Helper Function Tests ==========

    #[test]
    fn test_capitalize_first() {
        assert_eq!(capitalize_first("technical"), "Technical");
        assert_eq!(capitalize_first("soft"), "Soft");
        assert_eq!(capitalize_first(""), "");
        assert_eq!(capitalize_first("a"), "A");
    }

    #[test]
    fn test_capitalize_first_unicode() {
        assert_eq!(capitalize_first("über"), "Über");
        assert_eq!(capitalize_first("αlpha"), "Αlpha");
    }

    // ========== Integration Tests ==========

    #[test]
    fn test_render_footer_complete() {
        use crate::GenerationPayload;
        use docgen_core::{PersonalInfo, RoleProfile, ScoringWeights};

        let payload = GenerationPayload {
            personal: PersonalInfo {
                name: "Test".to_string(),
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
                id: "test".to_string(),
                name: "Test".to_string(),
                description: None,
                tag_weights: HashMap::new(),
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: Some(create_test_education()),
            skills: Some(create_test_skills()),
            summary: None,
            metadata: None,
        };

        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();

        let start_y = 700.0;
        let result = render(&mut pdf, &mut content, &payload, &layout, start_y);

        assert!(result.is_ok());
        let end_y = result.unwrap();
        assert!(end_y < start_y);
    }

    #[test]
    fn test_render_footer_education_only() {
        use crate::GenerationPayload;
        use docgen_core::{PersonalInfo, RoleProfile, ScoringWeights};

        let payload = GenerationPayload {
            personal: PersonalInfo {
                name: "Test".to_string(),
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
                id: "test".to_string(),
                name: "Test".to_string(),
                description: None,
                tag_weights: HashMap::new(),
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: Some(create_test_education()),
            skills: None,
            summary: None,
            metadata: None,
        };

        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render(&mut pdf, &mut content, &payload, &layout, start_y);
        assert!(result.is_ok());
    }

    #[test]
    fn test_render_footer_skills_only() {
        use crate::GenerationPayload;
        use docgen_core::{PersonalInfo, RoleProfile, ScoringWeights};

        let payload = GenerationPayload {
            personal: PersonalInfo {
                name: "Test".to_string(),
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
                id: "test".to_string(),
                name: "Test".to_string(),
                description: None,
                tag_weights: HashMap::new(),
                scoring_weights: ScoringWeights {
                    tag_relevance: 0.6,
                    priority: 0.4,
                },
            },
            education: None,
            skills: Some(create_test_skills()),
            summary: None,
            metadata: None,
        };

        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render(&mut pdf, &mut content, &payload, &layout, start_y);
        assert!(result.is_ok());
    }

    #[test]
    fn test_render_footer_empty() {
        use crate::GenerationPayload;
        use docgen_core::{PersonalInfo, RoleProfile, ScoringWeights};

        let payload = GenerationPayload {
            personal: PersonalInfo {
                name: "Test".to_string(),
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
                id: "test".to_string(),
                name: "Test".to_string(),
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
        };

        let layout = ResumeLayout::default();
        let mut pdf = Pdf::new();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render(&mut pdf, &mut content, &payload, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Empty footer should not change Y position much
        assert_eq!(end_y, start_y);
    }

    #[test]
    fn test_render_education_empty_coursework_and_societies() {
        let education = vec![Education {
            degree: "Bachelor of Arts".to_string(),
            degree_type: "BA".to_string(),
            institution: "Liberal Arts College".to_string(),
            location: "Boston, MA".to_string(),
            year: "2019".to_string(),
            coursework: Some(vec![]),
            societies: Some(vec![]),
        }];

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_education(&mut content, &education, &layout, start_y);
        assert!(result.is_ok());
        let end_y = result.unwrap();
        // Empty arrays should not render additional lines
        assert!(end_y < start_y);
    }

    #[test]
    fn test_render_skills_empty_category() {
        let mut skills = HashMap::new();
        skills.insert("tools".to_string(), vec![]);

        let layout = ResumeLayout::default();
        let mut content = Content::new();
        let start_y = 700.0;

        let result = render_skills(&mut content, &skills, &layout, start_y);
        assert!(result.is_ok());
    }
}
