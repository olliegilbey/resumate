//! Layout engine for PDF generation
//!
//! Handles page dimensions, margins, text positioning, and measurements.

use crate::{GenerationPayload, PdfError};

/// Page size presets
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PageSize {
    /// US Letter (8.5" × 11")
    Letter,
    /// A4 (210mm × 297mm)
    A4,
}

impl PageSize {
    /// Get page dimensions in points (1 point = 1/72 inch)
    pub fn dimensions(self) -> (f32, f32) {
        match self {
            PageSize::Letter => (612.0, 792.0), // 8.5" × 11" in points
            PageSize::A4 => (595.0, 842.0),     // 210mm × 297mm in points
        }
    }
}

/// Resume layout configuration
///
/// Defines the visual layout of the resume PDF, including page size, margins,
/// fonts, and spacing.
#[derive(Debug, Clone)]
pub struct ResumeLayout {
    // Page dimensions
    pub page_width: f32,
    pub page_height: f32,

    // Margins (in points)
    pub margin_top: f32,
    pub margin_bottom: f32,
    pub margin_left: f32,
    pub margin_right: f32,

    // Typography
    pub font_size_name: f32,       // Large name at top
    pub font_size_heading: f32,    // Section headings
    pub font_size_subheading: f32, // Company/position names
    pub font_size_body: f32,       // Bullet points

    // Spacing
    pub line_spacing: f32,    // Multiplier (e.g., 1.15 = 115%)
    pub section_spacing: f32, // Space between sections
    pub bullet_indent: f32,   // Bullet point indentation
}

impl Default for ResumeLayout {
    fn default() -> Self {
        let (width, height) = PageSize::Letter.dimensions();

        Self {
            // Page dimensions
            page_width: width,
            page_height: height,

            // Margins (0.75 inches)
            margin_top: 54.0, // 0.75" = 54pts
            margin_bottom: 54.0,
            margin_left: 54.0,
            margin_right: 54.0,

            // Typography (ATS-friendly sizes)
            font_size_name: 18.0,
            font_size_heading: 12.0,
            font_size_subheading: 11.0,
            font_size_body: 10.0,

            // Spacing (ATS-optimized)
            line_spacing: 1.15,
            section_spacing: 12.0,
            bullet_indent: 18.0,
        }
    }
}

impl ResumeLayout {
    /// Create layout from generation payload
    pub fn from_payload(_payload: &GenerationPayload) -> Self {
        // For now, use default layout
        // In the future, we could customize based on payload metadata
        Self::default()
    }

    /// Validate layout parameters
    pub fn validate(&self) -> Result<(), PdfError> {
        // Check margins don't exceed page size
        if self.margin_left + self.margin_right >= self.page_width {
            return Err(PdfError::InvalidLayout(
                "Horizontal margins exceed page width".to_string(),
            ));
        }

        if self.margin_top + self.margin_bottom >= self.page_height {
            return Err(PdfError::InvalidLayout(
                "Vertical margins exceed page height".to_string(),
            ));
        }

        // Check font sizes are reasonable
        if self.font_size_body < 8.0 || self.font_size_body > 14.0 {
            return Err(PdfError::InvalidLayout(format!(
                "Body font size {} outside recommended range (8-14pt)",
                self.font_size_body
            )));
        }

        // Check line spacing is reasonable
        if self.line_spacing < 1.0 || self.line_spacing > 2.0 {
            return Err(PdfError::InvalidLayout(format!(
                "Line spacing {} outside recommended range (1.0-2.0)",
                self.line_spacing
            )));
        }

        Ok(())
    }

    /// Get the content width (page width minus margins)
    pub fn content_width(&self) -> f32 {
        self.page_width - self.margin_left - self.margin_right
    }

    /// Get the content height (page height minus margins)
    pub fn content_height(&self) -> f32 {
        self.page_height - self.margin_top - self.margin_bottom
    }

    /// Calculate line height for given font size
    pub fn line_height(&self, font_size: f32) -> f32 {
        font_size * self.line_spacing
    }

    /// Calculate text width (approximate, for wrapping)
    ///
    /// This is a simple approximation using average character width.
    /// For more accurate measurements, we'd need the actual font metrics.
    pub fn estimate_text_width(&self, text: &str, font_size: f32) -> f32 {
        // Average character width is approximately 0.5 * font_size for proportional fonts
        // This is a rough estimate, but sufficient for line wrapping
        let avg_char_width = font_size * 0.5;
        text.len() as f32 * avg_char_width
    }

    /// Wrap text to fit within given width
    ///
    /// Returns a vector of lines that fit within the specified width.
    pub fn wrap_text(&self, text: &str, width: f32, font_size: f32) -> Vec<String> {
        let mut lines = Vec::new();
        let mut current_line = String::new();
        let mut current_width = 0.0;

        for word in text.split_whitespace() {
            let word_width = self.estimate_text_width(word, font_size);
            let space_width = self.estimate_text_width(" ", font_size);

            // Check if adding this word would exceed the width
            let test_width = if current_line.is_empty() {
                word_width
            } else {
                current_width + space_width + word_width
            };

            if test_width > width && !current_line.is_empty() {
                // Start new line
                lines.push(current_line.trim().to_string());
                current_line = word.to_string();
                current_width = word_width;
            } else {
                // Add to current line
                if !current_line.is_empty() {
                    current_line.push(' ');
                }
                current_line.push_str(word);
                current_width = test_width;
            }
        }

        // Add the last line
        if !current_line.is_empty() {
            lines.push(current_line.trim().to_string());
        }

        // Handle case where text is empty
        if lines.is_empty() {
            lines.push(String::new());
        }

        lines
    }

    /// Calculate total height needed for wrapped text
    pub fn calculate_text_height(&self, text: &str, width: f32, font_size: f32) -> f32 {
        let lines = self.wrap_text(text, width, font_size);
        lines.len() as f32 * self.line_height(font_size)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // =============================================================================
    // Page Size Tests
    // =============================================================================

    #[test]
    fn test_page_size_letter() {
        println!("Testing US Letter page size...");

        let (width, height) = PageSize::Letter.dimensions();
        assert_eq!(width, 612.0, "Letter width should be 8.5 inches (612 pts)");
        assert_eq!(height, 792.0, "Letter height should be 11 inches (792 pts)");

        println!("✓ Letter dimensions correct: {}x{} pts", width, height);
    }

    #[test]
    fn test_page_size_a4() {
        println!("Testing A4 page size...");

        let (width, height) = PageSize::A4.dimensions();
        assert_eq!(width, 595.0, "A4 width should be 210mm (595 pts)");
        assert_eq!(height, 842.0, "A4 height should be 297mm (842 pts)");

        println!("✓ A4 dimensions correct: {}x{} pts", width, height);
    }

    #[test]
    fn test_page_size_comparison() {
        println!("Comparing page sizes...");

        let (letter_w, letter_h) = PageSize::Letter.dimensions();
        let (a4_w, a4_h) = PageSize::A4.dimensions();

        assert!(letter_w > a4_w, "Letter should be wider than A4");
        assert!(a4_h > letter_h, "A4 should be taller than Letter");

        println!("✓ Letter: {}x{}, A4: {}x{}", letter_w, letter_h, a4_w, a4_h);
    }

    // =============================================================================
    // Default Layout Tests
    // =============================================================================

    #[test]
    fn test_default_layout_validates() {
        println!("Testing default layout validates...");

        let layout = ResumeLayout::default();
        assert!(layout.validate().is_ok(), "Default layout should be valid");

        println!("✓ Default layout is valid");
    }

    #[test]
    fn test_default_layout_dimensions() {
        println!("Testing default layout dimensions...");

        let layout = ResumeLayout::default();

        assert_eq!(layout.page_width, 612.0, "Default should use Letter width");
        assert_eq!(
            layout.page_height, 792.0,
            "Default should use Letter height"
        );

        println!("✓ Default uses Letter page size");
    }

    #[test]
    fn test_default_layout_margins() {
        println!("Testing default layout margins...");

        let layout = ResumeLayout::default();

        assert_eq!(
            layout.margin_top, 54.0,
            "Default margins should be 0.75 inches (54 pts)"
        );
        assert_eq!(layout.margin_bottom, 54.0);
        assert_eq!(layout.margin_left, 54.0);
        assert_eq!(layout.margin_right, 54.0);

        println!("✓ Default margins are 0.75\" on all sides");
    }

    #[test]
    fn test_default_layout_font_sizes() {
        println!("Testing default layout font sizes...");

        let layout = ResumeLayout::default();

        assert_eq!(layout.font_size_name, 18.0, "Name should be 18pt");
        assert_eq!(layout.font_size_heading, 12.0, "Headings should be 12pt");
        assert_eq!(
            layout.font_size_subheading, 11.0,
            "Subheadings should be 11pt"
        );
        assert_eq!(layout.font_size_body, 10.0, "Body text should be 10pt");

        // All font sizes should be within ATS-friendly range (8-14pt for body)
        assert!(layout.font_size_body >= 8.0);
        assert!(layout.font_size_body <= 14.0);

        println!("✓ Font sizes are ATS-friendly");
    }

    #[test]
    fn test_default_layout_spacing() {
        println!("Testing default layout spacing...");

        let layout = ResumeLayout::default();

        assert_eq!(layout.line_spacing, 1.15, "Line spacing should be 1.15");
        assert_eq!(
            layout.section_spacing, 12.0,
            "Section spacing should be 12pt"
        );
        assert_eq!(layout.bullet_indent, 18.0, "Bullet indent should be 18pt");

        println!("✓ Spacing values are correct");
    }

    // =============================================================================
    // Content Dimension Tests
    // =============================================================================

    #[test]
    fn test_content_dimensions() {
        println!("Testing content dimensions calculation...");

        let layout = ResumeLayout::default();
        let expected_width = 612.0 - 54.0 - 54.0; // Letter width - margins
        let expected_height = 792.0 - 54.0 - 54.0;

        assert_eq!(layout.content_width(), expected_width);
        assert_eq!(layout.content_height(), expected_height);

        println!("✓ Content area: {}x{} pts", expected_width, expected_height);
    }

    #[test]
    fn test_content_width_with_custom_margins() {
        println!("Testing content width with custom margins...");

        let mut layout = ResumeLayout::default();
        layout.margin_left = 72.0; // 1 inch
        layout.margin_right = 36.0; // 0.5 inch

        let expected = 612.0 - 72.0 - 36.0;
        assert_eq!(layout.content_width(), expected);

        println!("✓ Custom margins: content width = {} pts", expected);
    }

    #[test]
    fn test_content_height_with_custom_margins() {
        println!("Testing content height with custom margins...");

        let mut layout = ResumeLayout::default();
        layout.margin_top = 72.0; // 1 inch
        layout.margin_bottom = 36.0; // 0.5 inch

        let expected = 792.0 - 72.0 - 36.0;
        assert_eq!(layout.content_height(), expected);

        println!("✓ Custom margins: content height = {} pts", expected);
    }

    // =============================================================================
    // Line Height Tests
    // =============================================================================

    #[test]
    fn test_line_height_calculation() {
        println!("Testing line height calculation...");

        let layout = ResumeLayout::default();
        let height = layout.line_height(10.0);
        assert_eq!(height, 11.5); // 10pt * 1.15 spacing

        println!("✓ Line height for 10pt: {} pts", height);
    }

    #[test]
    fn test_line_height_various_sizes() {
        println!("Testing line height for various font sizes...");

        let layout = ResumeLayout::default();

        let heights = [
            (8.0, 9.2),   // 8pt * 1.15
            (10.0, 11.5), // 10pt * 1.15
            (12.0, 13.8), // 12pt * 1.15
            (14.0, 16.1), // 14pt * 1.15
        ];

        for (font_size, expected) in heights.iter() {
            let calculated = layout.line_height(*font_size);
            assert!(
                (calculated - expected).abs() < 0.01,
                "Line height for {}pt should be ~{}",
                font_size,
                expected
            );
            println!("  {}pt → {} pts line height", font_size, calculated);
        }

        println!("✓ Line heights calculated correctly");
    }

    #[test]
    fn test_line_height_custom_spacing() {
        println!("Testing line height with custom spacing...");

        let mut layout = ResumeLayout::default();
        layout.line_spacing = 1.5; // Double spacing

        let height = layout.line_height(10.0);
        assert_eq!(height, 15.0);

        println!("✓ Custom spacing (1.5x): 10pt → {} pts", height);
    }

    // =============================================================================
    // Text Width Estimation Tests
    // =============================================================================

    #[test]
    fn test_estimate_text_width_basic() {
        println!("Testing text width estimation...");

        let layout = ResumeLayout::default();
        let text = "Hello";
        let width = layout.estimate_text_width(text, 10.0);

        // Approximate: 5 chars * 10pt * 0.5 = 25pts
        let expected = 25.0;
        assert_eq!(width, expected);

        println!("✓ '{}' at 10pt ≈ {} pts wide", text, width);
    }

    #[test]
    fn test_estimate_text_width_empty() {
        println!("Testing text width estimation for empty string...");

        let layout = ResumeLayout::default();
        let width = layout.estimate_text_width("", 10.0);

        assert_eq!(width, 0.0, "Empty string should have zero width");

        println!("✓ Empty string width = 0");
    }

    #[test]
    fn test_estimate_text_width_scales_with_font_size() {
        println!("Testing text width scales with font size...");

        let layout = ResumeLayout::default();
        let text = "Test";

        let width_10pt = layout.estimate_text_width(text, 10.0);
        let width_20pt = layout.estimate_text_width(text, 20.0);

        assert_eq!(width_20pt, width_10pt * 2.0, "Width should scale linearly");

        println!("✓ 10pt: {} pts, 20pt: {} pts (2x)", width_10pt, width_20pt);
    }

    // =============================================================================
    // Text Wrapping Tests
    // =============================================================================

    #[test]
    fn test_text_wrapping_single_line() {
        println!("Testing text wrapping (single line)...");

        let layout = ResumeLayout::default();
        let text = "Short text";
        let lines = layout.wrap_text(text, 500.0, 10.0);

        assert_eq!(lines.len(), 1, "Short text should not wrap");
        assert_eq!(lines[0], "Short text");

        println!("✓ Short text remains on single line");
    }

    #[test]
    fn test_text_wrapping_multiple_lines() {
        println!("Testing text wrapping (multiple lines)...");

        let layout = ResumeLayout::default();
        let text = "This is a very long sentence that should definitely wrap onto multiple lines when rendered in the PDF";
        let lines = layout.wrap_text(text, 100.0, 10.0); // Narrow width

        println!("  Wrapped to {} lines", lines.len());
        assert!(lines.len() > 1, "Text should wrap to multiple lines");

        // Verify all original words appear
        let rejoined = lines.join(" ");
        for word in text.split_whitespace() {
            assert!(
                rejoined.contains(word),
                "Word '{}' missing after wrapping",
                word
            );
        }

        println!("✓ All words preserved after wrapping");
    }

    #[test]
    fn test_text_wrapping_empty_string() {
        println!("Testing text wrapping (empty string)...");

        let layout = ResumeLayout::default();
        let lines = layout.wrap_text("", 500.0, 10.0);

        assert_eq!(lines.len(), 1, "Empty string should produce 1 line");
        assert_eq!(lines[0], "", "Line should be empty");

        println!("✓ Empty string produces single empty line");
    }

    #[test]
    fn test_text_wrapping_single_word_too_long() {
        println!("Testing text wrapping (single long word)...");

        let layout = ResumeLayout::default();
        let text = "Supercalifragilisticexpialidocious"; // Very long word
        let lines = layout.wrap_text(text, 50.0, 10.0); // Very narrow width

        // Word should not be split, even if it exceeds width
        assert_eq!(lines.len(), 1, "Single word should not split");
        assert_eq!(lines[0], text);

        println!("✓ Long single word stays on one line (no splitting)");
    }

    #[test]
    fn test_text_wrapping_whitespace_handling() {
        println!("Testing text wrapping (whitespace handling)...");

        let layout = ResumeLayout::default();
        let text = "   Multiple   spaces   between   words   ";
        let lines = layout.wrap_text(text, 500.0, 10.0);

        // Should collapse multiple spaces to single spaces
        assert!(
            !lines[0].contains("  "),
            "Multiple spaces should be collapsed"
        );
        assert!(
            !lines[0].starts_with(' '),
            "Leading spaces should be trimmed"
        );
        assert!(
            !lines[0].ends_with(' '),
            "Trailing spaces should be trimmed"
        );

        println!("✓ Whitespace normalized: '{}'", lines[0]);
    }

    #[test]
    fn test_text_wrapping_exact_fit() {
        println!("Testing text wrapping (exact fit)...");

        let layout = ResumeLayout::default();
        let text = "word"; // 4 chars
        let font_size = 10.0;
        let exact_width = layout.estimate_text_width(text, font_size);

        let lines = layout.wrap_text(text, exact_width, font_size);

        assert_eq!(lines.len(), 1, "Word that exactly fits should not wrap");
        assert_eq!(lines[0], text);

        println!("✓ Word fits exactly: width = {} pts", exact_width);
    }

    #[test]
    fn test_text_wrapping_just_under_width() {
        println!("Testing text wrapping (just under width)...");

        let layout = ResumeLayout::default();
        let text = "word1 word2";
        let font_size = 10.0;

        // Width just enough for both words + space
        let width = layout.estimate_text_width(text, font_size);
        let lines = layout.wrap_text(text, width, font_size);

        assert_eq!(lines.len(), 1, "Text just under width should not wrap");

        println!("✓ Text just under width stays on one line");
    }

    // =============================================================================
    // Text Height Calculation Tests
    // =============================================================================

    #[test]
    fn test_calculate_text_height() {
        println!("Testing text height calculation...");

        let layout = ResumeLayout::default();
        let text = "Line 1\nLine 2\nLine 3";
        let height = layout.calculate_text_height(text, 500.0, 10.0);

        // Should be at least 1 line height
        assert!(height > 0.0, "Text height should be positive");

        let line_height = layout.line_height(10.0);
        println!(
            "✓ Text height: {} pts (line height: {})",
            height, line_height
        );
    }

    #[test]
    fn test_calculate_text_height_single_line() {
        println!("Testing text height (single line)...");

        let layout = ResumeLayout::default();
        let text = "Single line";
        let height = layout.calculate_text_height(text, 500.0, 10.0);

        let expected = layout.line_height(10.0); // 11.5pts
        assert_eq!(height, expected, "Single line should match line height");

        println!("✓ Single line height: {} pts", height);
    }

    #[test]
    fn test_calculate_text_height_wrapping() {
        println!("Testing text height with wrapping...");

        let layout = ResumeLayout::default();
        let text = "This is a very long sentence that should definitely wrap onto multiple lines";
        let height = layout.calculate_text_height(text, 100.0, 10.0);

        let single_line_height = layout.line_height(10.0);

        assert!(
            height > single_line_height,
            "Wrapped text should be taller than single line"
        );

        println!(
            "✓ Wrapped text height: {} pts (> {})",
            height, single_line_height
        );
    }

    // =============================================================================
    // Layout Validation Tests
    // =============================================================================

    #[test]
    fn test_invalid_layout_excessive_horizontal_margins() {
        println!("Testing validation: excessive horizontal margins...");

        let mut layout = ResumeLayout::default();
        layout.margin_left = 400.0;
        layout.margin_right = 300.0;

        let result = layout.validate();
        assert!(
            result.is_err(),
            "Should reject excessive horizontal margins"
        );

        if let Err(e) = result {
            println!("  Error: {}", e);
        }

        println!("✓ Excessive horizontal margins rejected");
    }

    #[test]
    fn test_invalid_layout_excessive_vertical_margins() {
        println!("Testing validation: excessive vertical margins...");

        let mut layout = ResumeLayout::default();
        layout.margin_top = 400.0;
        layout.margin_bottom = 500.0;

        let result = layout.validate();
        assert!(result.is_err(), "Should reject excessive vertical margins");

        println!("✓ Excessive vertical margins rejected");
    }

    #[test]
    fn test_invalid_layout_font_too_small() {
        println!("Testing validation: font too small...");

        let mut layout = ResumeLayout::default();
        layout.font_size_body = 6.0; // Too small for ATS

        let result = layout.validate();
        assert!(result.is_err(), "Should reject font < 8pt");

        println!("✓ Font < 8pt rejected");
    }

    #[test]
    fn test_invalid_layout_font_too_large() {
        println!("Testing validation: font too large...");

        let mut layout = ResumeLayout::default();
        layout.font_size_body = 16.0; // Too large

        let result = layout.validate();
        assert!(result.is_err(), "Should reject font > 14pt");

        println!("✓ Font > 14pt rejected");
    }

    #[test]
    fn test_invalid_layout_line_spacing_too_tight() {
        println!("Testing validation: line spacing too tight...");

        let mut layout = ResumeLayout::default();
        layout.line_spacing = 0.5; // Too tight

        let result = layout.validate();
        assert!(result.is_err(), "Should reject spacing < 1.0");

        println!("✓ Spacing < 1.0 rejected");
    }

    #[test]
    fn test_invalid_layout_line_spacing_too_loose() {
        println!("Testing validation: line spacing too loose...");

        let mut layout = ResumeLayout::default();
        layout.line_spacing = 3.0; // Too loose

        let result = layout.validate();
        assert!(result.is_err(), "Should reject spacing > 2.0");

        println!("✓ Spacing > 2.0 rejected");
    }

    #[test]
    fn test_valid_layout_edge_cases() {
        println!("Testing validation: edge cases (valid)...");

        let mut layout = ResumeLayout::default();

        // Minimum valid font size
        layout.font_size_body = 8.0;
        assert!(layout.validate().is_ok(), "8pt should be valid");

        // Maximum valid font size
        layout.font_size_body = 14.0;
        assert!(layout.validate().is_ok(), "14pt should be valid");

        // Minimum valid spacing
        layout.line_spacing = 1.0;
        assert!(layout.validate().is_ok(), "1.0 spacing should be valid");

        // Maximum valid spacing
        layout.line_spacing = 2.0;
        assert!(layout.validate().is_ok(), "2.0 spacing should be valid");

        println!("✓ Edge cases validate correctly");
    }

    // =============================================================================
    // from_payload Tests
    // =============================================================================

    #[test]
    fn test_from_payload_uses_defaults() {
        println!("Testing from_payload (currently returns defaults)...");

        use crate::GenerationPayload;
        use docgen_core::{PersonalInfo, RoleProfile, ScoringWeights};
        use std::collections::HashMap;

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

        let layout = ResumeLayout::from_payload(&payload);
        let default_layout = ResumeLayout::default();

        assert_eq!(layout.page_width, default_layout.page_width);
        assert_eq!(layout.page_height, default_layout.page_height);

        println!("✓ from_payload currently returns default layout");
    }
}
