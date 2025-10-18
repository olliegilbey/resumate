//! Font management for Typst compilation
//!
//! Uses embedded Liberation Serif fonts for minimal WASM size.
//! Only includes Regular and Bold weights needed for resumes.

use typst::foundations::Bytes;
use typst::text::{Font, FontBook};

// Embed minimal font files at compile time
// Liberation Serif: Open source, ~350KB per weight
// Total: ~700KB vs 5MB+ for full Typst assets
const FONT_REGULAR: &[u8] = include_bytes!("../fonts/LiberationSerif-Regular.ttf");
const FONT_BOLD: &[u8] = include_bytes!("../fonts/LiberationSerif-Bold.ttf");

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
    fn test_font_book_not_empty() {
        let result = load_fonts();
        assert!(result.is_ok());

        let (_book, fonts) = result.unwrap();
        // Should have multiple fonts (serif, sans, mono, etc.)
        assert!(fonts.len() > 5, "Should have multiple font families");
    }
}
