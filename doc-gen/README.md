# doc-gen

Rust/WASM document generation engine for Resumate.

## Overview

Generates PDF and DOCX resumes from JSON data using a shared layout system. Compiles to WebAssembly for client-side generation with zero server cost.

## Architecture

```
doc-gen/
├── crates/
│   ├── core/       # Shared types & selection algorithms
│   ├── pdf/        # PDF generation (pdf-writer)
│   ├── docx/       # DOCX generation (docx-rs)
│   └── wasm/       # WebAssembly bindings
├── pkg/            # WASM build output (gitignored)
└── build-wasm.sh   # Build script
```

## Dependencies

- **Rust 1.90.0+** (stable)
- **wasm-pack 0.13+**
- **wasm32-unknown-unknown** target

## Quick Start

```bash
# Build WASM package (release mode)
./build-wasm.sh

# Build for development (faster, larger)
./build-wasm.sh --dev

# Run tests
cargo test --all

# Run roundtrip validation
cargo test -p docgen-core --test roundtrip

# Format code
cargo fmt --all

# Lint
cargo clippy --all -- -D warnings
```

## WASM Output

Build output goes to `pkg/`:
- `docgen_wasm.js` - ES6 module loader
- `docgen_wasm_bg.wasm` - Binary (~9KB gzipped)
- `docgen_wasm.d.ts` - TypeScript definitions

## Type System

Rust types in `core/src/types.rs` maintain 1:1 compatibility with TypeScript:
- `ResumeData` - Complete resume structure
- `BulletPoint` - Individual experience bullets
- `RoleProfile` - Tag weights for curation
- All types use `camelCase` in JSON (via serde)

## Tests

- **Unit tests**: `cargo test --all`
- **Roundtrip validation**: Ensures TS ↔ Rust compatibility
- **CI**: GitHub Actions validates types on every push

## Performance

Current (unoptimized):
- WASM binary: ~21 KB raw, ~9.2 KB gzipped
- Init time: <100ms (target: <500ms)
- Generation: TBD (target: <5s)

## Development

```bash
# Watch mode (requires cargo-watch)
cargo watch -x 'test --all'

# Build only a specific crate
cargo build -p docgen-core

# Check without building
cargo check --all
```

## License

MIT (see parent directory)
