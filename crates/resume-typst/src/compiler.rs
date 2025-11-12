//! Typst compiler wrapper for resume generation
//!
//! Implements the Typst `World` trait to provide the compiler with access to
//! source files, fonts, and other resources needed for PDF generation.

use crate::fonts;
use crate::TypstError;
use chrono::Datelike; // For year(), month(), day() methods
use ecow::eco_format;
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime};
use typst::syntax::{FileId, Source, VirtualPath};
use typst::text::{Font, FontBook};
use typst::{Library, World};
use typst_utils::LazyHash;

/// Typst World implementation for resume compilation
///
/// The World trait is Typst's interface for accessing files, fonts, and other
/// resources during compilation. Our implementation provides:
/// - A single source file (the rendered template)
/// - Built-in fonts from Typst assets
/// - Current date/time
///
pub struct ResumeWorld {
    /// The main resume template source
    main: Source,
    /// The Typst standard library
    library: LazyHash<Library>,
    /// Font book for font selection
    book: LazyHash<FontBook>,
    /// Available fonts
    fonts: Vec<Font>,
}

impl ResumeWorld {
    /// Create a new World for resume compilation
    ///
    /// # Arguments
    /// * `template_content` - The rendered Typst template as a string
    ///
    /// # Returns
    /// * `Ok(ResumeWorld)` - Ready to compile
    /// * `Err(TypstError)` - Font loading or setup failed
    ///
    pub fn new(template_content: String) -> Result<Self, TypstError> {
        // Load fonts
        let (book, fonts) = fonts::load_fonts().map_err(TypstError::FontError)?;

        // Create source from template content
        // FileId requires a VirtualPath for identification
        let path = VirtualPath::new("resume.typ");
        let source = Source::new(FileId::new(None, path), template_content);

        Ok(Self {
            main: source,
            library: LazyHash::new(Library::default()),
            book: LazyHash::new(book),
            fonts,
        })
    }

    /// Compile the template to a Typst document
    ///
    /// # Returns
    /// * `Ok(typst::Document)` - Compiled document ready for PDF export
    /// * `Err(TypstError)` - Compilation failed
    ///
    pub fn compile(&self) -> Result<typst::model::Document, TypstError> {
        let result = typst::compile(self);

        // Handle Warned<Result<...>> return type
        result.output.map_err(|errors| {
            let error_msgs: Vec<String> = errors
                .iter()
                .map(|e| eco_format!("{:?}", e).to_string())
                .collect();
            TypstError::CompilationError(error_msgs.join("; "))
        })
    }
}

impl World for ResumeWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }

    fn book(&self) -> &LazyHash<FontBook> {
        &self.book
    }

    fn main(&self) -> FileId {
        self.main.id()
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.main.id() {
            Ok(self.main.clone())
        } else {
            Err(FileError::NotFound(
                id.vpath().as_rootless_path().to_path_buf(),
            ))
        }
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        // We don't support external file loading in resume generation
        Err(FileError::NotFound(
            id.vpath().as_rootless_path().to_path_buf(),
        ))
    }

    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.get(index).cloned()
    }

    fn today(&self, _offset: Option<i64>) -> Option<Datetime> {
        // Use current date for PDF metadata
        let now = chrono::Local::now();
        Datetime::from_ymd(now.year(), now.month() as u8, now.day() as u8)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_world_basic() {
        let template = r#"
            #set document(title: "Test Resume")
            #set page(paper: "us-letter")

            = Test Resume

            This is a test.
        "#
        .to_string();

        let world = ResumeWorld::new(template);
        assert!(world.is_ok());
    }

    #[test]
    fn test_create_world_empty_template() {
        let template = "".to_string();
        let world = ResumeWorld::new(template);
        assert!(world.is_ok());
    }

    #[test]
    fn test_world_has_fonts() {
        let template = "#set document(title: \"Test\")".to_string();
        let world = ResumeWorld::new(template).unwrap();

        // Should have access to fonts
        assert!(!world.fonts.is_empty());
        assert!(world.font(0).is_some());
    }

    #[test]
    fn test_world_has_library() {
        let template = "#set document(title: \"Test\")".to_string();
        let world = ResumeWorld::new(template).unwrap();

        // Library should be accessible
        let _lib = world.library();
        // If we get here without panicking, library is working
    }

    #[test]
    fn test_compile_minimal_template() {
        let template = r#"
            #set document(title: "Test")
            #set page(paper: "us-letter")

            Test content
        "#
        .to_string();

        let world = ResumeWorld::new(template).unwrap();
        let result = world.compile();

        assert!(result.is_ok(), "Should compile minimal template");

        let document = result.unwrap();
        assert!(!document.pages.is_empty(), "Should have at least one page");
    }

    #[test]
    fn test_compile_invalid_template() {
        // Invalid Typst syntax (unclosed function)
        let template = r#"
            #set document(title: "Test"

            Test content
        "#
        .to_string();

        let world = ResumeWorld::new(template).unwrap();
        let result = world.compile();

        assert!(result.is_err(), "Should fail to compile invalid template");
    }

    #[test]
    fn test_source_lookup() {
        let template = "#set document(title: \"Test\")".to_string();
        let world = ResumeWorld::new(template).unwrap();

        // Main source should be accessible
        let main_id = world.main.id();
        let source_result = world.source(main_id);
        assert!(source_result.is_ok());

        // Unknown source should fail
        let unknown_path = VirtualPath::new("unknown.typ");
        let unknown_id = FileId::new(None, unknown_path);
        let unknown_result = world.source(unknown_id);
        assert!(unknown_result.is_err());
    }

    #[test]
    fn test_today_returns_valid_date() {
        let template = "#set document(title: \"Test\")".to_string();
        let world = ResumeWorld::new(template).unwrap();

        let today = world.today(None);
        assert!(today.is_some());

        let date = today.unwrap();
        // Year should be reasonable (2024+)
        assert!(date.year() >= Some(2024));
    }
}
