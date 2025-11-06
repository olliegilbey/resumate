//! PDF Snapshot Generator
//!
//! Usage: cargo run --bin pdf-snapshot --release -p docgen-typst > output.pdf

use docgen_core::{selector, GenerationPayload, ResumeData};
use docgen_typst::render_resume;
use std::io::{self, Write};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let resume_data: ResumeData =
        serde_json::from_reader(std::fs::File::open("data/resume-data.json")?)?;

    let role_profile = resume_data
        .role_profiles
        .as_ref()
        .and_then(|p| p.iter().find(|r| r.id == "developer-relations-lead"))
        .ok_or("Profile not found")?;

    let selected = selector::select_bullets(
        &resume_data,
        role_profile,
        &selector::SelectionConfig::default(),
    );
    let (_, _, total_selectable) = selector::count_selectable_items(&resume_data);

    let payload = GenerationPayload {
        personal: resume_data.personal.clone(),
        selected_bullets: selected,
        role_profile: role_profile.clone(),
        education: resume_data.education.clone(),
        skills: resume_data.skills.clone(),
        summary: resume_data.summary.clone(),
        meta_footer: resume_data.meta_footer.clone(),
        total_bullets_available: Some(total_selectable),
        total_companies_available: Some(resume_data.experience.len()),
        metadata: None,
    };

    let pdf_bytes = render_resume(&payload, false)?;
    io::stdout().write_all(&pdf_bytes)?;

    Ok(())
}
