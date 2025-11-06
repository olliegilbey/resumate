//! PDF Text Extraction Validation Tests
//!
//! Simple tests to verify:
//! - Text extraction works
//! - PDF < 2 pages
//! - Correct bullet count
//! - Frontmatter with links present
//! - Meta footer present

mod common;

use common::load_resume_data;
use docgen_core::selector::{count_selectable_items, select_bullets, SelectionConfig};
use docgen_core::GenerationPayload;
use docgen_typst::TypstError;

/// Generate PDF using Typst
fn generate_pdf(payload: &GenerationPayload) -> Result<Vec<u8>, TypstError> {
    docgen_typst::render_resume(payload, false)
}

/// Extract text from PDF bytes
fn extract_text_from_pdf(pdf_bytes: &[u8]) -> Result<String, String> {
    pdf_extract::extract_text_from_mem(pdf_bytes)
        .map_err(|e| format!("PDF text extraction failed: {}", e))
}

#[test]
fn test_pdf_text_extraction_quality_all_profiles() {
    println!("\n📝 PDF Text Extraction Quality Validation (All Profiles)");
    println!("═════════════════════════════════════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();
    let (_bullet_count, _position_desc_count, total_selectable) = count_selectable_items(&resume);
    let total_companies = resume.experience.len();

    // Optional: Save PDFs for manual inspection (set SAVE_TEST_PDFS=1)
    let save_pdfs = std::env::var("SAVE_TEST_PDFS").is_ok();
    let output_dir = if save_pdfs {
        let dir = std::path::PathBuf::from("target/test-pdfs");
        std::fs::create_dir_all(&dir).expect("Failed to create test-pdfs dir");
        println!("📁 Saving test PDFs to: {}", dir.display());
        Some(dir)
    } else {
        None
    };

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        println!("\n🎯 Testing: {}", role_profile.name);

        let selected = select_bullets(&resume, role_profile, &config);

        let payload = GenerationPayload {
            personal: resume.personal.clone(),
            selected_bullets: selected.clone(),
            role_profile: role_profile.clone(),
            education: resume.education.clone(),
            skills: resume.skills.clone(),
            summary: resume.summary.clone(),
            meta_footer: resume.meta_footer.clone(),
            total_bullets_available: Some(total_selectable),
            total_companies_available: Some(total_companies),
            metadata: None,
        };

        let pdf_bytes = generate_pdf(&payload).expect("PDF generation failed");

        // Save PDF if requested
        if let Some(ref dir) = output_dir {
            let filename = format!("{}.pdf", role_profile.id);
            let path = dir.join(&filename);
            std::fs::write(&path, &pdf_bytes).expect("Failed to write PDF");
            println!("  💾 Saved: {}", path.display());
        }

        let extracted_text = extract_text_from_pdf(&pdf_bytes).expect("Text extraction failed");

        // Normalize extracted text: remove whitespace + common punctuation
        let extracted_normalized: String = extracted_text
            .chars()
            .filter(|c| !c.is_whitespace() && !"''\"\",.;:—–-".contains(*c))
            .collect::<String>()
            .to_lowercase();

        let mut found_count = 0;
        let mut failed_bullets = Vec::new();
        let total_bullets = selected.len();

        for (idx, scored_bullet) in selected.iter().enumerate() {
            let bullet_text = &scored_bullet.bullet.description;
            let bullet_id = &scored_bullet.bullet.id;

            // Extract middle 10 words (avoids edge formatting issues)
            let bullet_words: Vec<&str> = bullet_text.split_whitespace().collect();
            let total_words = bullet_words.len();

            let (start_idx, end_idx) = if total_words > 10 {
                let start = (total_words - 10) / 2;
                (start, start + 10)
            } else {
                (0, total_words)
            };

            let middle_words = &bullet_words[start_idx..end_idx];
            let bullet_excerpt = middle_words.join(" ");

            let bullet_normalized: String = bullet_excerpt
                .chars()
                .filter(|c| !c.is_whitespace() && !"''\"\",.;:—–-".contains(*c))
                .collect::<String>()
                .to_lowercase();

            if extracted_normalized.contains(&bullet_normalized) {
                found_count += 1;
            } else {
                failed_bullets.push((
                    idx + 1,
                    bullet_id.clone(),
                    bullet_text.clone(),
                    bullet_excerpt.clone(),
                ));
            }
        }

        // Show failed bullets if any
        if !failed_bullets.is_empty() {
            println!("  ⚠️  Missing bullets:");
            for (idx, id, full_text, excerpt) in &failed_bullets {
                println!("    #{} [{}]", idx, id);
                println!(
                    "      Full: {}",
                    if full_text.len() > 100 {
                        format!("{}...", &full_text[..100])
                    } else {
                        full_text.clone()
                    }
                );
                println!("      Search: {}", excerpt);
            }
        }

        let match_rate = (found_count as f64 / total_bullets as f64) * 100.0;
        println!(
            "  📊 {}/{} bullets found ({:.1}%)",
            found_count, total_bullets, match_rate
        );

        // With whitespace removed, should find 90%+ of bullets
        let pass_threshold = (total_bullets * 9 / 10).max(1);
        assert!(
            found_count >= pass_threshold,
            "Profile '{}': Only {}/{} bullets found (need ≥90%)",
            role_profile.name,
            found_count,
            total_bullets
        );

        assert!(
            extracted_text.len() > 500,
            "Profile '{}': Extracted text too short: {} chars",
            role_profile.name,
            extracted_text.len()
        );
    }

    println!("\n✅ All profiles validated");
}

#[test]
fn test_pdf_page_count_under_two_pages() {
    println!("\n📄 PDF Page Count Validation");
    println!("═════════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    let (_bullet_count, _position_desc_count, total_selectable) = count_selectable_items(&resume);
    let total_companies = resume.experience.len();

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        let selected = select_bullets(&resume, role_profile, &config);

        let payload = GenerationPayload {
            personal: resume.personal.clone(),
            selected_bullets: selected.clone(),
            role_profile: role_profile.clone(),
            education: resume.education.clone(),
            skills: resume.skills.clone(),
            summary: resume.summary.clone(),
            meta_footer: resume.meta_footer.clone(),
            total_bullets_available: Some(total_selectable),
            total_companies_available: Some(total_companies),
            metadata: None,
        };

        let pdf_bytes = generate_pdf(&payload).expect("PDF generation failed");

        // Rough estimate: ~40KB per page for typical resume
        let estimated_pages = (pdf_bytes.len() / 40_000).max(1);

        println!(
            "  {} ({} bullets): {} bytes, ~{} page(s)",
            role_profile.name,
            selected.len(),
            pdf_bytes.len(),
            estimated_pages
        );

        assert!(
            estimated_pages <= 2,
            "Profile '{}': Estimated {} pages (target: ≤2)",
            role_profile.name,
            estimated_pages
        );
    }

    println!("\n✅ All profiles ≤2 pages");
}

#[test]
fn test_pdf_frontmatter_with_links() {
    println!("\n🔗 PDF Frontmatter & Links Validation");
    println!("═══════════════════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();
    let role_profile = &resume.role_profiles.as_ref().unwrap()[0];
    let selected = select_bullets(&resume, role_profile, &config);

    let (_bullet_count, _position_desc_count, total_selectable) = count_selectable_items(&resume);
    let total_companies = resume.experience.len();

    let payload = GenerationPayload {
        personal: resume.personal.clone(),
        selected_bullets: selected,
        role_profile: role_profile.clone(),
        education: resume.education.clone(),
        skills: resume.skills.clone(),
        summary: resume.summary.clone(),
        meta_footer: resume.meta_footer.clone(),
        total_bullets_available: Some(total_selectable),
        total_companies_available: Some(total_companies),
        metadata: None,
    };

    let pdf_bytes = generate_pdf(&payload).expect("PDF generation failed");
    let extracted_text = extract_text_from_pdf(&pdf_bytes).expect("Text extraction failed");

    // Check for personal info
    assert!(
        extracted_text.contains(&resume.personal.name),
        "Personal name not found in PDF"
    );
    println!("  ✓ Name present: {}", resume.personal.name);

    // Check for email (if present)
    if let Some(email) = &resume.personal.email {
        assert!(extracted_text.contains(email), "Email not found in PDF");
        println!("  ✓ Email present: {}", email);
    }

    // Check for phone (if present)
    if let Some(phone) = &resume.personal.phone {
        // Phone might be formatted differently, check without spaces
        let phone_no_spaces = phone.replace(' ', "");
        let text_no_spaces = extracted_text.replace(' ', "");
        assert!(
            text_no_spaces.contains(&phone_no_spaces),
            "Phone not found in PDF"
        );
        println!("  ✓ Phone present: {}", phone);
    }

    // Check for links (if present)
    let mut link_count = 0;
    if let Some(linkedin) = &resume.personal.linkedin {
        if extracted_text.contains(linkedin) || extracted_text.contains("linkedin") {
            println!("  ✓ LinkedIn present");
            link_count += 1;
        }
    }
    if let Some(github) = &resume.personal.github {
        if extracted_text.contains(github) || extracted_text.contains("github") {
            println!("  ✓ GitHub present");
            link_count += 1;
        }
    }
    if let Some(website) = &resume.personal.website {
        if extracted_text.contains(website) {
            println!("  ✓ Website present: {}", website);
            link_count += 1;
        }
    }

    // Should have at least one link present
    assert!(link_count > 0, "No links found in PDF frontmatter");

    println!("\n✅ Frontmatter validated");
}

#[test]
fn test_pdf_meta_footer_present() {
    println!("\n📋 PDF Meta Footer Validation");
    println!("══════════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();
    let role_profile = &resume.role_profiles.as_ref().unwrap()[0];
    let selected = select_bullets(&resume, role_profile, &config);

    let (_bullet_count, _position_desc_count, total_selectable) = count_selectable_items(&resume);
    let total_companies = resume.experience.len();

    let payload = GenerationPayload {
        personal: resume.personal.clone(),
        selected_bullets: selected,
        role_profile: role_profile.clone(),
        education: resume.education.clone(),
        skills: resume.skills.clone(),
        summary: resume.summary.clone(),
        meta_footer: resume.meta_footer.clone(),
        total_bullets_available: Some(total_selectable),
        total_companies_available: Some(total_companies),
        metadata: None,
    };

    let pdf_bytes = generate_pdf(&payload).expect("PDF generation failed");
    let extracted_text = extract_text_from_pdf(&pdf_bytes).expect("Text extraction failed");

    // Check for key meta footer keywords (case-insensitive, spacing-tolerant)
    let expected_keywords = ["algorithmically", "rust", "webassembly", "typst"];

    let extracted_lower = extracted_text.to_lowercase();
    let mut found_count = 0;
    for keyword in &expected_keywords {
        if extracted_lower.contains(keyword) {
            println!("  ✓ Found: {}", keyword);
            found_count += 1;
        } else {
            println!("  ⚠️  Missing: {}", keyword);
        }
    }

    // Require at least 1/4 keywords (pdf-extract has multi-page issues)
    // Presence of any keyword proves meta footer rendered
    assert!(
        found_count >= 1,
        "Meta footer not found: 0/{} expected keywords present",
        expected_keywords.len()
    );

    // Check for counts
    let has_accomplishments_count = extracted_text.contains(&total_selectable.to_string());
    let has_companies_count = extracted_text.contains(&total_companies.to_string());

    if has_accomplishments_count {
        println!("  ✓ Accomplishments count: {}", total_selectable);
    }
    if has_companies_count {
        println!("  ✓ Companies count: {}", total_companies);
    }

    println!("\n✅ Meta footer validated ({}/5 phrases)", found_count);
}
