# Fonts for Typst PDF Generation

## Strategy

For WASM builds, we have two options:

### Option 1: Use Typst's Built-in Fonts (Current)
Typst includes built-in fonts that work in WASM:
- Default serif, sans-serif, and monospace fonts
- Automatic font fallback
- Smaller WASM bundle

### Option 2: Embed Custom Fonts (Future)
To use Linux Libertine or other custom fonts:
1. Download font files (`.ttf` or `.otf`)
2. Place in this directory
3. Use `include_bytes!()` in `fonts.rs` to embed in binary
4. Larger WASM bundle (~500KB-1MB more)

## Current Approach

We're starting with Typst's built-in fonts to minimize WASM size and complexity.
Custom fonts can be added later if needed for brand consistency.

## Font Downloads

Linux Libertine: https://www.linuxlibertine.org/
- LinLibertine_R.ttf (Regular)
- LinLibertine_RB.ttf (Bold)
- LinLibertine_RI.ttf (Italic)
- LinBiolinum_R.ttf (Sans Regular)
- LinBiolinum_RB.ttf (Sans Bold)
