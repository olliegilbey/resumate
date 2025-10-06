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

// WASM exports will go here
