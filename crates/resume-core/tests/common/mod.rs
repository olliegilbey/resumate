//! Shared test utilities for resume-core integration tests
//!
//! This module provides common functionality used across multiple test files,
//! eliminating code duplication and ensuring consistent test setup.

use resume_core::ResumeData;
use std::path::PathBuf;

/// Get the path to the project root (resumate/)
///
/// Works from any test file in the workspace by navigating up from CARGO_MANIFEST_DIR
pub fn get_project_root() -> PathBuf {
    // CARGO_MANIFEST_DIR = /path/to/resumate/crates/resume-core
    // Need to go up 2 levels: resume-core -> crates -> resumate
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent() // crates
        .unwrap()
        .parent() // resumate
        .unwrap()
        .to_path_buf()
}

/// Get the path to data/resume-data.json
pub fn get_resume_data_path() -> PathBuf {
    get_project_root().join("data").join("resume-data.json")
}

/// Load resume data from project root
///
/// Panics with a helpful error message if the file cannot be read or parsed.
/// This is intentional for tests - we want tests to fail fast if data is missing.
pub fn load_resume_data() -> ResumeData {
    let data_path = get_resume_data_path();

    let json = std::fs::read_to_string(&data_path).unwrap_or_else(|e| {
        panic!(
            "Failed to read resume-data.json from {:?}: {}\n\
             Run 'just data-pull' to fetch the data file.",
            data_path, e
        )
    });

    serde_json::from_str(&json).unwrap_or_else(|e| {
        panic!(
            "Failed to parse resume-data.json: {}\n\
             The JSON structure may be invalid or incompatible with ResumeData schema.",
            e
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_project_root_exists() {
        let root = get_project_root();
        assert!(root.exists(), "Project root should exist: {:?}", root);
        assert!(root.is_dir(), "Project root should be a directory");
    }

    #[test]
    fn test_get_resume_data_path() {
        let path = get_resume_data_path();
        assert!(
            path.ends_with("data/resume-data.json"),
            "Path should end with data/resume-data.json: {:?}",
            path
        );
    }

    #[test]
    fn test_load_resume_data_succeeds() {
        let resume = load_resume_data();
        assert!(
            !resume.personal.name.is_empty(),
            "Personal name should not be empty"
        );
        assert!(
            !resume.experience.is_empty(),
            "Experience should not be empty"
        );
    }
}
