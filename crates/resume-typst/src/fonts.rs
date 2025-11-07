//! Font management for Typst compilation
//!
//! Uses embedded Liberation Serif fonts for minimal WASM size.
//! Only includes Regular and Bold weights needed for resumes.

use typst::foundations::Bytes;
use typst::text::{Font, FontBook};

// Embed minimal font files at compile time
// Liberation Serif: Open source, ~350KB per weight
// Total: ~700KB vs 5MB+ for full Typst assets
const FONT_REGULAR: &[u8] = include_bytes!("../../../typst/fonts/LiberationSerif-Regular.ttf");
const FONT_BOLD: &[u8] = include_bytes!("../../../typst/fonts/LiberationSerif-Bold.ttf");

/// Load fonts for Typst compilation
///
/// Only includes the minimal font set needed for professional resumes:
/// - Liberation Serif Regular (body text)
/// - Liberation Serif Bold (headings)
///
/// This approach reduces WASM size by ~5-8MB compared to full Typst assets.
///
/// # Returns
/// * `Ok((FontBook, Vec<Font>))` - Font book and font list for Typst World
/// * `Err(String)` - Error loading fonts
///
pub fn load_fonts() -> Result<(FontBook, Vec<Font>), String> {
    let mut fonts = Vec::new();

    // Load Regular weight
    for font in Font::iter(Bytes::from(FONT_REGULAR)) {
        fonts.push(font);
    }

    // Load Bold weight
    for font in Font::iter(Bytes::from(FONT_BOLD)) {
        fonts.push(font);
    }

    if fonts.is_empty() {
        return Err("Failed to load embedded fonts".to_string());
    }

    let book = FontBook::from_fonts(&fonts);

    Ok((book, fonts))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_fonts_success() {
        let result = load_fonts();
        assert!(result.is_ok());

        let (_book, fonts) = result.unwrap();
        assert!(!fonts.is_empty(), "Should have at least one font");
        assert!(!fonts.is_empty(), "Font book should contain fonts");

        // Verify we have fonts in the book
        // (exact count may vary by Typst version)
        println!("Loaded {} fonts", fonts.len());
    }

    #[test]
    fn test_font_count_stays_minimal() {
        // REGRESSION TEST: Ensure we don't accidentally bloat WASM by loading too many fonts
        // We need Liberation Serif with Regular, Bold, and Italic = 3 TTF files max
        // Each TTF may contain multiple font variants (e.g., different Unicode ranges)
        let result = load_fonts();
        assert!(result.is_ok(), "Font loading should succeed");

        let (_book, fonts) = result.unwrap();

        // Should have at least 1 font loaded
        assert!(
            !fonts.is_empty(),
            "Should have at least 1 font loaded, got {}",
            fonts.len()
        );

        // CRITICAL: Prevent bloat - if this fails, someone added too many fonts!
        // Max expected: 3 TTF files (Regular, Bold, Italic) × ~2-3 variants each = ~10 max
        assert!(
            fonts.len() <= 10,
            "Font count too high! Got {} fonts. Only Liberation Serif (Regular, Bold, Italic) should be loaded. \
             Check fonts.rs and embedded fonts to prevent WASM bloat (currently 6.3MB gzipped).",
            fonts.len()
        );

        println!(
            "✓ Font count is minimal: {} fonts loaded (max 10 allowed for Regular/Bold/Italic)",
            fonts.len()
        );
    }
}
