//! # docgen-wasm
//!
//! WebAssembly bindings for browser-based resume generation.
//!
//! Provides JavaScript-compatible exports for PDF and DOCX generation.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn init_panic_hook() {
    // Better error messages in browser console
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Test export to validate WASM build pipeline
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// PDF and DOCX generation exports will go here
