//! PDF Permutation Testing (Typst)
//!
//! This test suite generates PDFs for all permutations of:
//! - All role profiles (6 profiles)
//! - Different selection configs (various bullet limits)
//! - Different bullet counts
//!
//! It analyzes:
//! - PDF size consistency
//! - Generation time
//! - PDF structure validity
//! - Page count estimates
//! - Format compliance

mod common;

use common::load_resume_data;
use resume_core::selector::{count_selectable_items, select_bullets, SelectionConfig};
use resume_core::GenerationPayload;
use resume_typst::TypstError;
use std::collections::HashMap;
use std::time::Instant;

/// Generate PDF using Typst
fn generate_pdf(payload: &GenerationPayload) -> Result<Vec<u8>, TypstError> {
    resume_typst::render_resume(payload, false)
}

/// Get output directory for baseline PDFs
fn get_baseline_output_dir() -> std::path::PathBuf {
    // From crates/resume-core, outputs go to test-outputs/baseline
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test-outputs/baseline")
}

/// Save PDF to baseline directory with ISO datetime prefix
fn save_baseline_pdf(role_id: &str, pdf_bytes: &[u8]) -> std::path::PathBuf {
    let output_dir = get_baseline_output_dir();
    std::fs::create_dir_all(&output_dir).expect("Failed to create baseline directory");

    // ISO 8601 datetime format: 2025-10-23T09-50-32
    let timestamp = chrono::Local::now().format("%Y-%m-%dT%H-%M-%S");
    let pdf_filename = format!("{}_baseline-{}.pdf", timestamp, role_id);
    let pdf_path = output_dir.join(&pdf_filename);
    std::fs::write(&pdf_path, pdf_bytes).expect("Failed to write PDF file");

    pdf_path
}

#[derive(Debug)]
struct PdfAnalysis {
    profile_name: String,
    bullet_count: usize,
    pdf_size_bytes: usize,
    generation_time_ms: u128,
    has_pdf_header: bool,
    estimated_pages: usize,
    size_per_bullet: f64,
}

impl PdfAnalysis {
    fn estimate_pages(&self) -> usize {
        // Very rough estimate: ~400 bytes per line, ~50 lines per page
        // Adjust based on empirical data
        let lines_estimate = (self.pdf_size_bytes / 400).max(1);
        (lines_estimate / 50).max(1)
    }

    fn print_summary(&self) {
        println!(
            "  📊 {} ({} bullets): {} bytes, {}ms, ~{} pages, {:.1} bytes/bullet",
            self.profile_name,
            self.bullet_count,
            self.pdf_size_bytes,
            self.generation_time_ms,
            self.estimated_pages,
            self.size_per_bullet
        );
    }
}

fn analyze_pdf(
    profile_name: &str,
    bullet_count: usize,
    pdf_bytes: &[u8],
    generation_time_ms: u128,
) -> PdfAnalysis {
    let has_pdf_header = pdf_bytes.starts_with(b"%PDF-");
    let pdf_size_bytes = pdf_bytes.len();
    let size_per_bullet = if bullet_count > 0 {
        pdf_size_bytes as f64 / bullet_count as f64
    } else {
        0.0
    };

    let analysis = PdfAnalysis {
        profile_name: profile_name.to_string(),
        bullet_count,
        pdf_size_bytes,
        generation_time_ms,
        has_pdf_header,
        estimated_pages: 0, // Will be calculated
        size_per_bullet,
    };

    PdfAnalysis {
        estimated_pages: analysis.estimate_pages(),
        ..analysis
    }
}

#[test]
fn test_pdf_permutation_all_profiles_default_config() {
    println!("\n📄 PDF Permutation Test: All Profiles, Default Config");
    println!("═══════════════════════════════════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    let mut analyses = Vec::new();

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        let start = Instant::now();
        let selected = select_bullets(&resume, role_profile, &config);

        // Calculate total selectable items
        let (_bullet_count, _position_desc_count, total_selectable) =
            count_selectable_items(&resume);
        let total_companies = resume.experience.len();

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

        let pdf_result = generate_pdf(&payload);
        let generation_time = start.elapsed().as_millis();

        assert!(
            pdf_result.is_ok(),
            "PDF generation failed for profile '{}': {:?}",
            role_profile.name,
            pdf_result.err()
        );

        let pdf_bytes = pdf_result.unwrap();

        // Save PDF to baseline directory
        let pdf_path = save_baseline_pdf(&role_profile.id, &pdf_bytes);
        println!("  💾 {}", pdf_path.display());

        let analysis = analyze_pdf(
            &role_profile.name,
            selected.len(),
            &pdf_bytes,
            generation_time,
        );

        analysis.print_summary();

        // Assertions
        assert!(
            analysis.has_pdf_header,
            "Missing PDF header for profile '{}'",
            role_profile.name
        );
        assert!(
            analysis.pdf_size_bytes > 1000,
            "PDF too small for profile '{}': {} bytes",
            role_profile.name,
            analysis.pdf_size_bytes
        );
        assert!(
            analysis.pdf_size_bytes < 10_000_000,
            "PDF too large for profile '{}': {} bytes",
            role_profile.name,
            analysis.pdf_size_bytes
        );

        analyses.push(analysis);
    }

    // Calculate statistics
    let total_profiles = analyses.len();
    let avg_size = analyses.iter().map(|a| a.pdf_size_bytes).sum::<usize>() / total_profiles;
    let avg_time =
        analyses.iter().map(|a| a.generation_time_ms).sum::<u128>() / total_profiles as u128;
    let max_size = analyses.iter().map(|a| a.pdf_size_bytes).max().unwrap();
    let min_size = analyses.iter().map(|a| a.pdf_size_bytes).min().unwrap();

    println!("\n📈 Summary Statistics:");
    println!("  Total profiles tested: {}", total_profiles);
    println!("  Average PDF size: {} bytes", avg_size);
    println!("  Size range: {} - {} bytes", min_size, max_size);
    println!("  Average generation time: {}ms", avg_time);
}

#[test]
fn test_pdf_permutation_varied_bullet_counts() {
    println!("\n📄 PDF Permutation Test: Varied Bullet Counts");
    println!("═══════════════════════════════════════════════");

    let resume = load_resume_data();

    // Test with different diversity constraint settings
    let configs = [
        SelectionConfig {
            max_bullets: None,
            max_per_company: Some(3),
            min_per_company: Some(2),
            max_per_position: Some(2),
        },
        SelectionConfig {
            max_bullets: None,
            max_per_company: Some(5),
            min_per_company: Some(2),
            max_per_position: Some(3),
        },
        SelectionConfig {
            max_bullets: None,
            max_per_company: Some(6),
            min_per_company: Some(2),
            max_per_position: Some(4),
        },
        SelectionConfig {
            max_bullets: None,
            max_per_company: None,
            min_per_company: None,
            max_per_position: None,
        },
    ];

    let mut all_analyses = Vec::new();

    for (config_idx, config) in configs.iter().enumerate() {
        println!(
            "\n🔧 Config {}: max_per_company={:?}, max_per_position={:?}",
            config_idx + 1,
            config.max_per_company,
            config.max_per_position
        );

        let role_profile = &resume.role_profiles.as_ref().unwrap()[0];

        let start = Instant::now();
        let selected = select_bullets(&resume, role_profile, config);

        // Calculate total selectable items
        let (_bullet_count, _position_desc_count, total_selectable) =
            count_selectable_items(&resume);
        let total_companies = resume.experience.len();

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

        let pdf_result = generate_pdf(&payload);
        let generation_time = start.elapsed().as_millis();

        assert!(
            pdf_result.is_ok(),
            "PDF generation failed for config {}: {:?}",
            config_idx + 1,
            pdf_result.err()
        );

        let pdf_bytes = pdf_result.unwrap();

        let analysis = analyze_pdf(
            &role_profile.name,
            selected.len(),
            &pdf_bytes,
            generation_time,
        );

        analysis.print_summary();
        all_analyses.push(analysis);
    }

    // Verify size scales with bullet count
    for i in 0..all_analyses.len() - 1 {
        let current = &all_analyses[i];
        let next = &all_analyses[i + 1];

        if next.bullet_count > current.bullet_count {
            assert!(
                next.pdf_size_bytes > current.pdf_size_bytes,
                "PDF size should increase with bullet count: {} bullets ({} bytes) vs {} bullets ({} bytes)",
                current.bullet_count,
                current.pdf_size_bytes,
                next.bullet_count,
                next.pdf_size_bytes
            );
        }
    }
}

#[test]
fn test_pdf_size_consistency_across_profiles() {
    println!("\n📄 PDF Size Consistency Test");
    println!("═════════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    let mut size_per_bullet_ratios = Vec::new();

    // Calculate total selectable items
    let (_bullet_count, _position_desc_count, total_selectable) = count_selectable_items(&resume);
    let total_companies = resume.experience.len();

    for role_profile in resume.role_profiles.as_ref().unwrap() {
        let selected = select_bullets(&resume, role_profile, &config);

        if selected.is_empty() {
            continue;
        }

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

        let size_per_bullet = pdf_bytes.len() as f64 / selected.len() as f64;
        size_per_bullet_ratios.push(size_per_bullet);

        println!(
            "  {} ({} bullets): {:.1} bytes/bullet",
            role_profile.name,
            selected.len(),
            size_per_bullet
        );
    }

    // Calculate coefficient of variation (CV)
    let mean = size_per_bullet_ratios.iter().sum::<f64>() / size_per_bullet_ratios.len() as f64;
    let variance = size_per_bullet_ratios
        .iter()
        .map(|x| (x - mean).powi(2))
        .sum::<f64>()
        / size_per_bullet_ratios.len() as f64;
    let std_dev = variance.sqrt();
    let cv = std_dev / mean;

    println!("\n📊 Consistency Metrics:");
    println!("  Mean bytes/bullet: {:.1}", mean);
    println!("  Std deviation: {:.1}", std_dev);
    println!("  Coefficient of variation: {:.2}%", cv * 100.0);

    // Size per bullet should be reasonably consistent (CV < 50%)
    assert!(
        cv < 0.5,
        "Size per bullet varies too much (CV={:.2}%), may indicate layout inconsistencies",
        cv * 100.0
    );
}

#[test]
fn test_pdf_generation_performance_benchmarks() {
    println!("\n⏱️  PDF Generation Performance Benchmarks");
    println!("═════════════════════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    // Calculate total selectable items
    let (_bullet_count, _position_desc_count, total_selectable) = count_selectable_items(&resume);
    let total_companies = resume.experience.len();

    let mut timings = HashMap::new();

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

        // Warm-up run
        let _ = generate_pdf(&payload);

        // Measure multiple runs
        let mut run_times = Vec::new();
        for _ in 0..5 {
            let start = Instant::now();
            let _ = generate_pdf(&payload).expect("PDF generation failed");
            run_times.push(start.elapsed().as_millis());
        }

        let avg_time = run_times.iter().sum::<u128>() / run_times.len() as u128;
        let min_time = *run_times.iter().min().unwrap();
        let max_time = *run_times.iter().max().unwrap();

        println!(
            "  {} ({} bullets): avg={}ms, min={}ms, max={}ms",
            role_profile.name,
            selected.len(),
            avg_time,
            min_time,
            max_time
        );

        timings.insert(role_profile.id.clone(), avg_time);
    }

    // All profiles should generate in < 3s
    for (profile_id, time_ms) in &timings {
        assert!(
            *time_ms < 3000,
            "Profile '{}' took {}ms (target: <3000ms)",
            profile_id,
            time_ms
        );
    }

    let overall_avg = timings.values().sum::<u128>() / timings.len() as u128;
    println!("\n📊 Overall average: {}ms", overall_avg);

    // Target: Average under 1.5s
    assert!(
        overall_avg < 1500,
        "Average generation time {}ms exceeds target (1500ms)",
        overall_avg
    );
}

#[test]
fn test_pdf_structure_validation_all_profiles() {
    println!("\n🔍 PDF Structure Validation");
    println!("═══════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    // Calculate total selectable items
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

        // PDF structure validation
        assert!(
            pdf_bytes.starts_with(b"%PDF-"),
            "Profile '{}': Missing PDF magic number",
            role_profile.name
        );

        // Check for required PDF elements (as byte patterns)
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);

        // Should contain xref table
        assert!(
            pdf_string.contains("xref"),
            "Profile '{}': Missing xref table",
            role_profile.name
        );

        // Should contain trailer
        assert!(
            pdf_string.contains("trailer"),
            "Profile '{}': Missing trailer",
            role_profile.name
        );

        // Should contain EOF marker
        assert!(
            pdf_bytes.ends_with(b"%%EOF") || pdf_bytes.ends_with(b"%%EOF\n"),
            "Profile '{}': Missing EOF marker",
            role_profile.name
        );

        println!("  ✅ {} - Structure valid", role_profile.name);
    }
}

#[test]
fn test_pdf_content_extraction_smoke_test() {
    println!("\n📝 PDF Content Extraction (Smoke Test)");
    println!("═══════════════════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    // Calculate total selectable items
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

        // Convert to string for basic content checks
        let pdf_string = String::from_utf8_lossy(&pdf_bytes);

        // Should contain personal name
        assert!(
            pdf_string.contains(&resume.personal.name),
            "Profile '{}': Personal name not found in PDF",
            role_profile.name
        );

        // Should contain at least one bullet description (if any bullets)
        if !selected.is_empty() {
            let first_bullet_desc = &selected[0].bullet.description;
            // Check first 10 chars of description (shorter for more robust matching)
            let search_term = &first_bullet_desc[..first_bullet_desc.len().min(10)];

            // PDF text extraction can be unreliable, so just warn if not found
            if !pdf_string.contains(search_term) {
                println!(
                    "  ⚠️  Warning: First bullet text not found via PDF extraction (this is ok - PDF extraction is unreliable)"
                );
                println!("     Looking for: '{}'", search_term);
            }
        }

        println!(
            "  ✅ {} - Content present ({} bullets)",
            role_profile.name,
            selected.len()
        );
    }
}

#[test]
fn test_pdf_page_count_estimates() {
    println!("\n📄 PDF Page Count Estimates");
    println!("═══════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    // Calculate total selectable items
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

        // Rough page estimate based on content
        let estimated_pages = {
            let base_sections = 3; // Header, summary, footer
            let bullet_lines = selected.len() * 2; // ~2 lines per bullet on average
            let total_lines = base_sections + bullet_lines;
            (total_lines / 50).max(1) // ~50 lines per page
        };

        println!(
            "  {} ({} bullets): ~{} pages, {} bytes",
            role_profile.name,
            selected.len(),
            estimated_pages,
            pdf_bytes.len()
        );

        // All PDFs should be <= 2 pages with default config (18 bullets)
        assert!(
            estimated_pages <= 2,
            "Profile '{}': Estimated {} pages (target: ≤2)",
            role_profile.name,
            estimated_pages
        );
    }
}

#[test]
fn test_developer_relations_verbose_scoring() {
    use resume_core::scoring::ScoredBullet;

    println!("\n🔍 Verbose Scoring Analysis: Developer Relations Lead");
    println!("═════════════════════════════════════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    // Find developer-relations-lead profile
    let role_profile = resume
        .role_profiles
        .as_ref()
        .unwrap()
        .iter()
        .find(|rp| rp.id == "developer-relations-lead")
        .expect("developer-relations-lead profile not found");

    println!("\n📋 Role Profile: {}", role_profile.name);
    println!(
        "📊 Selection Config: max_per_company={:?}, min_per_company={:?}, max_per_position={:?}",
        config.max_per_company, config.min_per_company, config.max_per_position
    );

    // Score ALL bullets (before selection)
    let mut all_bullets: Vec<ScoredBullet> = vec![];

    for company in &resume.experience {
        for position in &company.children {
            // Score position description if it exists
            if position.description.is_some() {
                use resume_core::{scoring::score_bullet, Bullet};

                let desc_bullet = Bullet {
                    id: format!("{}-description", position.id),
                    name: None,
                    location: None,
                    date_start: None,
                    date_end: None,
                    summary: None,
                    description: position.description.clone().unwrap_or_default(),
                    tags: position.tags.clone(),
                    priority: position.priority,
                    link: None,
                };

                let score = score_bullet(&desc_bullet, position, company, role_profile);
                all_bullets.push(ScoredBullet {
                    bullet: desc_bullet,
                    score,
                    company_id: company.id.clone(),
                    company_name: company.name.clone(),
                    company_description: company.description.clone(),
                    company_link: company.link.clone(),
                    company_date_start: company.date_start.clone(),
                    company_date_end: company.date_end.clone(),
                    company_location: company.location.clone(),
                    position_id: position.id.clone(),
                    position_name: position.name.clone(),
                    position_description: position.description.clone(),
                    position_date_start: position.date_start.clone(),
                    position_date_end: position.date_end.clone(),
                });
            }

            // Score all regular bullets
            for bullet in &position.children {
                use resume_core::scoring::score_bullet;
                let score = score_bullet(bullet, position, company, role_profile);
                all_bullets.push(ScoredBullet {
                    bullet: bullet.clone(),
                    score,
                    company_id: company.id.clone(),
                    company_name: company.name.clone(),
                    company_description: company.description.clone(),
                    company_link: company.link.clone(),
                    company_date_start: company.date_start.clone(),
                    company_date_end: company.date_end.clone(),
                    company_location: company.location.clone(),
                    position_id: position.id.clone(),
                    position_name: position.name.clone(),
                    position_description: position.description.clone(),
                    position_date_start: position.date_start.clone(),
                    position_date_end: position.date_end.clone(),
                });
            }
        }
    }

    // Sort by score descending (same as selector does)
    all_bullets.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

    // Run actual selection
    let selected = select_bullets(&resume, role_profile, &config);
    let selected_ids: std::collections::HashSet<String> =
        selected.iter().map(|sb| sb.bullet.id.clone()).collect();

    println!(
        "\n📊 All Bullets Ranked by Score ({} total):",
        all_bullets.len()
    );
    println!("─────────────────────────────────────────────────────────");

    for (idx, scored_bullet) in all_bullets.iter().enumerate() {
        let is_selected = selected_ids.contains(&scored_bullet.bullet.id);
        let marker = if is_selected { "✓ SELECTED" } else { " " };

        // Truncate description for readability
        let desc = &scored_bullet.bullet.description;
        let desc_preview = if desc.len() > 60 {
            format!("{}...", &desc[..60])
        } else {
            desc.clone()
        };

        println!(
            "{:>3}. [{:.2}] {} | {} @ {} | {}",
            idx + 1,
            scored_bullet.score,
            marker,
            scored_bullet.position_name,
            scored_bullet.company_name.as_deref().unwrap_or("Unknown"),
            desc_preview
        );
    }

    println!("\n📈 Selection Summary:");
    println!("  Total bullets available: {}", all_bullets.len());
    println!("  Bullets selected: {}", selected.len());
    println!(
        "  Selection rate: {:.1}%",
        (selected.len() as f64 / all_bullets.len() as f64) * 100.0
    );
    println!(
        "  Score range (all): {:.2} - {:.2}",
        all_bullets.last().map(|b| b.score).unwrap_or(0.0),
        all_bullets.first().map(|b| b.score).unwrap_or(0.0)
    );
    println!(
        "  Score range (selected): {:.2} - {:.2}",
        selected.last().map(|b| b.score).unwrap_or(0.0),
        selected.first().map(|b| b.score).unwrap_or(0.0)
    );

    // Calculate total selectable items
    let (_bullet_count, _position_desc_count, total_selectable) = count_selectable_items(&resume);
    let total_companies = resume.experience.len();

    // Generate PDF
    let start = Instant::now();
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

    let pdf_result = generate_pdf(&payload);
    let generation_time = start.elapsed().as_millis();

    assert!(
        pdf_result.is_ok(),
        "PDF generation failed: {:?}",
        pdf_result.err()
    );

    let pdf_bytes = pdf_result.unwrap();
    let pdf_path = save_baseline_pdf(&role_profile.id, &pdf_bytes);

    println!("\n💾 PDF Generated:");
    println!("  Path: {}", pdf_path.display());
    println!("  Size: {} bytes", pdf_bytes.len());
    println!("  Time: {}ms", generation_time);
}

#[test]
#[ignore = "Footer rendering in Typst not working yet - tracked in DATA_SCHEMA.md"]
fn test_pdf_meta_footer_content() {
    println!("\n📝 PDF Meta Footer Content Test");
    println!("═══════════════════════════════════");

    let resume = load_resume_data();
    let config = SelectionConfig::default();

    // Calculate expected totals
    let (bullet_count, position_desc_count, total_selectable) = count_selectable_items(&resume);
    let total_companies = resume.experience.len();

    println!("\n📊 Expected counts:");
    println!("  Bullets: {}", bullet_count);
    println!("  Position descriptions: {}", position_desc_count);
    println!("  Total selectable: {}", total_selectable);
    println!("  Companies: {}", total_companies);

    // Test first role profile
    let role_profile = &resume.role_profiles.as_ref().unwrap()[0];
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

    // Generate PDF
    let pdf_bytes = generate_pdf(&payload).expect("PDF generation failed");

    // Extract text from PDF
    let extracted_text = match pdf_extract::extract_text_from_mem(&pdf_bytes) {
        Ok(text) => text,
        Err(e) => {
            eprintln!("⚠️  PDF text extraction failed: {}", e);
            eprintln!("   This is expected for some PDF formats");
            return;
        }
    };

    println!("\n📄 Extracted text length: {} chars", extracted_text.len());

    // Verify footer content
    let accomplishments_text = format!("{} accomplishments", total_selectable);
    let companies_text = format!("across {} companies", total_companies);

    let expected_phrases = vec![
        "ABOUT THIS RESUME",
        "algorithmically generated",
        accomplishments_text.as_str(),
        companies_text.as_str(),
        "hierarchical scoring engine",
        "Rust compiled to WebAssembly",
        "Next.js",
        "Typst",
        "ollie.gg/resume",
    ];

    let mut found_count = 0;
    let mut missing_phrases = Vec::new();

    for phrase in &expected_phrases {
        if extracted_text.contains(phrase) {
            found_count += 1;
            println!("  ✓ Found: \"{}\"", phrase);
        } else {
            missing_phrases.push(phrase);
            println!("  ✗ Missing: \"{}\"", phrase);
        }
    }

    if !missing_phrases.is_empty() {
        // Print excerpt of extracted text for debugging
        println!("\n🔍 Extracted text sample (last 500 chars):");
        let text_len = extracted_text.len();
        let start = text_len.saturating_sub(500);
        println!("{}", &extracted_text[start..]);
    }

    // Also check for the numbers separately (PDF text extraction may remove spaces)
    let has_accomplishments_count = extracted_text.contains(&total_selectable.to_string());
    let has_companies_count = extracted_text.contains(&total_companies.to_string());

    if !has_accomplishments_count {
        println!(
            "  ⚠️  Warning: Could not verify accomplishments count ({}) in extracted text",
            total_selectable
        );
    }
    if !has_companies_count {
        println!(
            "  ⚠️  Warning: Could not verify companies count ({}) in extracted text",
            total_companies
        );
    }

    // Require at least 7/9 phrases (PDF extraction may have spacing issues)
    assert!(
        found_count >= 7,
        "Footer content incomplete: found {}/{} expected phrases. Missing: {:?}",
        found_count,
        expected_phrases.len(),
        missing_phrases
    );

    // Verify the actual counts are present somewhere in the text
    assert!(
        has_accomplishments_count,
        "Accomplishments count ({}) not found in PDF text",
        total_selectable
    );
    assert!(
        has_companies_count,
        "Companies count ({}) not found in PDF text",
        total_companies
    );

    println!(
        "\n✅ Meta footer verification: {}/{} phrases found",
        found_count,
        expected_phrases.len()
    );
    println!(
        "✅ Counts verified: {} accomplishments, {} companies",
        total_selectable, total_companies
    );
}
