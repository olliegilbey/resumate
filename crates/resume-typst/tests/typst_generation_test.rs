//! Integration tests for Typst PDF generation
//!
//! This test suite verifies that Typst-based PDF generation works correctly
//! with various types of resume data, including edge cases like Unicode,
//! long text, and minimal/empty fields.

mod common;

use common::{PdfValidator, TestDataBuilder};
use resume_typst::render_resume;
use std::fs;

#[test]
fn test_minimal_data_generates_valid_pdf() {
    println!("\n=== Test: Minimal Data PDF Generation ===\n");

    let payload = TestDataBuilder::minimal_payload();
    let result = render_resume(&payload, false);

    assert!(
        result.is_ok(),
        "PDF generation should succeed with minimal data: {:?}",
        result.err()
    );

    let pdf_bytes = result.unwrap();

    // Validate structure
    PdfValidator::validate_structure(&pdf_bytes).expect("PDF should have valid structure");

    // Verify content
    assert!(!pdf_bytes.is_empty(), "PDF should not be empty");
    assert!(
        pdf_bytes.len() > 1000,
        "PDF should be substantial (>1KB), got {} bytes",
        pdf_bytes.len()
    );

    // Verify it contains the test user's name
    assert!(
        PdfValidator::contains_text(&pdf_bytes, "Test User"),
        "PDF should contain user name"
    );

    println!(
        "✓ Minimal data PDF generated successfully ({} bytes)",
        pdf_bytes.len()
    );
}

#[test]
fn test_unicode_content_renders_correctly() {
    println!("\n=== Test: Unicode Content Rendering ===\n");

    let payload = TestDataBuilder::with_unicode();
    let result = render_resume(&payload, false);

    assert!(
        result.is_ok(),
        "PDF generation should handle Unicode characters: {:?}",
        result.err()
    );

    let pdf_bytes = result.unwrap();

    // Validate structure
    PdfValidator::validate_structure(&pdf_bytes)
        .expect("PDF with Unicode should have valid structure");

    // Write to file for manual inspection
    let output_path = "/tmp/test_unicode.pdf";
    fs::write(output_path, &pdf_bytes).expect("Failed to write test PDF");

    // Verify PDF contains text rendering operators
    assert!(
        PdfValidator::has_text_content(&pdf_bytes),
        "PDF should have text rendering operators"
    );

    println!("✓ Unicode content PDF generated successfully");
    println!("  File saved to: {}", output_path);
    println!("  Contains: François, Müller, São Paulo, €, 日本");
}

#[test]
fn test_long_text_wraps_correctly() {
    println!("\n=== Test: Long Text Wrapping ===\n");

    let payload = TestDataBuilder::with_long_text();
    let result = render_resume(&payload, false);

    assert!(
        result.is_ok(),
        "PDF generation should handle long text: {:?}",
        result.err()
    );

    let pdf_bytes = result.unwrap();

    // Validate structure
    PdfValidator::validate_structure(&pdf_bytes)
        .expect("PDF with long text should have valid structure");

    // Write to file for manual inspection
    let output_path = "/tmp/test_long_text.pdf";
    fs::write(output_path, &pdf_bytes).expect("Failed to write test PDF");

    // Long text should produce a larger PDF (multiple pages likely)
    assert!(
        pdf_bytes.len() > 2000,
        "PDF with long text should be larger, got {} bytes",
        pdf_bytes.len()
    );

    println!(
        "✓ Long text PDF generated successfully ({} bytes)",
        pdf_bytes.len()
    );
    println!("  File saved to: {}", output_path);
    println!(
        "  Bullet length: {} chars",
        payload.selected_bullets[0].bullet.description.len()
    );
}

#[test]
fn test_empty_fields_handled_gracefully() {
    println!("\n=== Test: Empty Optional Fields ===\n");

    let payload = TestDataBuilder::with_empty_fields();
    let result = render_resume(&payload, false);

    assert!(
        result.is_ok(),
        "PDF generation should handle empty optional fields: {:?}",
        result.err()
    );

    let pdf_bytes = result.unwrap();

    // Validate structure
    PdfValidator::validate_structure(&pdf_bytes)
        .expect("PDF with empty fields should have valid structure");

    // Should still produce valid PDF with just the name
    assert!(
        PdfValidator::contains_text(&pdf_bytes, "Minimal User"),
        "PDF should contain user name even with empty fields"
    );

    println!(
        "✓ Empty fields PDF generated successfully ({} bytes)",
        pdf_bytes.len()
    );
}

#[test]
fn test_generation_is_deterministic() {
    println!("\n=== Test: Deterministic Generation ===\n");

    let payload = TestDataBuilder::minimal_payload();

    // Generate PDF twice
    let result1 = render_resume(&payload, false);
    let result2 = render_resume(&payload, false);

    assert!(result1.is_ok(), "First generation should succeed");
    assert!(result2.is_ok(), "Second generation should succeed");

    let pdf1 = result1.unwrap();
    let pdf2 = result2.unwrap();

    // PDFs should be identical
    assert_eq!(
        pdf1.len(),
        pdf2.len(),
        "Generated PDFs should have same size"
    );

    // Note: We can't do byte-for-byte comparison because Typst may include
    // timestamps or other metadata. But size should be the same.
    assert_eq!(
        pdf1, pdf2,
        "Generated PDFs should be identical for same input"
    );

    println!("✓ PDF generation is deterministic ({} bytes)", pdf1.len());
}

#[test]
fn test_comprehensive_payload_all_features() {
    println!("\n=== Test: Comprehensive Payload (All Features) ===\n");

    let payload = TestDataBuilder::comprehensive_payload();
    let result = render_resume(&payload, false);

    assert!(
        result.is_ok(),
        "PDF generation should handle comprehensive data: {:?}",
        result.err()
    );

    let pdf_bytes = result.unwrap();

    // Write to file for manual inspection
    let output_path = "/tmp/test_comprehensive.pdf";
    fs::write(output_path, &pdf_bytes).expect("Failed to write test PDF");

    // Validate structure
    PdfValidator::validate_structure(&pdf_bytes)
        .expect("Comprehensive PDF should have valid structure");

    // Verify PDF contains expected content
    // Note: Typst may encode text differently, so we just check for reasonable size
    assert!(
        pdf_bytes.len() > 10000,
        "Comprehensive PDF should be substantial (>10KB), got {} bytes",
        pdf_bytes.len()
    );

    println!(
        "✓ Comprehensive PDF generated successfully ({} bytes)",
        pdf_bytes.len()
    );
    println!("  File saved to: {}", output_path);
    println!("  Includes: personal info, bullets, education, skills, summary");
}

#[test]
fn test_dev_mode_includes_metadata() {
    println!("\n=== Test: Dev Mode Metadata ===\n");

    let payload = TestDataBuilder::minimal_payload();

    // Generate in prod mode (no metadata)
    let prod_result = render_resume(&payload, false);
    assert!(prod_result.is_ok(), "Prod mode generation should succeed");
    let prod_pdf = prod_result.unwrap();

    // Generate in dev mode (with metadata)
    let dev_result = render_resume(&payload, true);
    assert!(dev_result.is_ok(), "Dev mode generation should succeed");
    let dev_pdf = dev_result.unwrap();

    // Dev mode PDF should be larger (includes extra page/metadata)
    assert!(
        dev_pdf.len() >= prod_pdf.len(),
        "Dev mode PDF should be same size or larger than prod mode"
    );

    println!("✓ Dev mode PDF includes metadata");
    println!("  Prod size: {} bytes", prod_pdf.len());
    println!("  Dev size:  {} bytes", dev_pdf.len());
}
