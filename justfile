# Resumate - Build Automation
# Next.js 15 + Rust/WASM project
#
# Usage:
#   just          # Show all available targets
#   just dev      # Start dev server
#   just test     # Run all tests
#   just wasm     # Rebuild WASM

# Default target: list all commands
default:
    @just --list

# ============================================
# Development
# ============================================

# Start Next.js dev server with Turbopack
dev:
    @echo "🚀 Starting dev server..."
    npm run dev

# ============================================
# Building
# ============================================

# Build Next.js production bundle
build:
    @echo "📦 Building production bundle..."
    @echo "  → Fetching resume data from gist..."
    node scripts/fetch-gist-data.js --force
    @echo "  → Building Next.js with Turbopack..."
    npm run build
    @echo "✅ Build complete"

# Build WASM with fonts (release mode)
wasm: wasm-fonts
    @echo "🦀 Building WASM (release mode)..."
    cd doc-gen && bash build-wasm.sh --release
    @echo ""
    @echo "📦 WASM bundle:"
    @ls -lh public/wasm/*.wasm public/wasm/*.js 2>/dev/null | head -5 || true
    @echo ""
    @echo "📏 Gzipped size:"
    @gzip -c public/wasm/docgen_wasm_bg.wasm | wc -c | awk '{printf "  %.1f MB\n", $$1/1024/1024}'

# Build WASM in dev mode (faster, larger)
wasm-dev: wasm-fonts
    @echo "🦀 Building WASM (dev mode)..."
    @echo "⚠️  Dev mode: faster build, larger bundle, no optimizations"
    cd doc-gen && bash build-wasm.sh --dev

# Download fonts for Typst PDF generation
wasm-fonts:
    @if [ ! -d "doc-gen/crates/typst/fonts" ] || [ -z "$(ls -A doc-gen/crates/typst/fonts 2>/dev/null)" ]; then \
        echo "📥 Downloading Typst fonts..."; \
        cd doc-gen/crates/typst && bash download-fonts.sh; \
    else \
        echo "✓ Fonts already downloaded"; \
    fi

# ============================================
# Type Synchronization
# ============================================

# Generate JSON Schema from Rust types
types-schema:
    @echo "🔧 Generating JSON Schema from Rust..."
    cargo run --bin schema_emitter -p shared-types
    @echo "  → schemas/resume.schema.json"

# Generate TypeScript types from JSON Schema
types-ts:
    @echo "🔧 Generating TypeScript types..."
    npm run types:gen
    @echo "  → lib/types/generated-resume.ts"

# Full type sync pipeline: Rust → Schema → TypeScript
types-sync: types-schema types-ts
    @echo "✓ Validating type synchronization..."
    npm run typecheck
    cargo check --all
    @echo "✅ Types synchronized and validated"

# Check for type drift (uncommitted changes to generated files)
types-drift:
    @echo "🔍 Checking for type drift..."
    @just types-sync > /dev/null
    @if git diff --exit-code schemas/resume.schema.json lib/types/generated-resume.ts > /dev/null 2>&1; then \
        echo "✅ No type drift detected"; \
    else \
        echo "❌ Type drift detected!"; \
        echo "   Generated files differ from committed versions."; \
        echo "   Run: just types-sync && git add schemas lib/types"; \
        exit 1; \
    fi

# ============================================
# Data Management
# ============================================

# Pull resume data from GitHub Gist
data-pull:
    @echo "📥 Fetching resume data from gist..."
    node scripts/fetch-gist-data.js

# Pull resume data (force overwrite local changes)
data-pull-force:
    @echo "📥 Fetching resume data (force overwrite)..."
    @echo "⚠️  This will overwrite any local changes"
    node scripts/fetch-gist-data.js --force

# Push resume data to GitHub Gist
data-push:
    @echo "📤 Pushing resume data to gist..."
    @echo "  → Validating data..."
    node scripts/validate-compendium.mjs data/resume-data.json
    @echo "  → Uploading..."
    node scripts/gist-push.js
    @echo "✅ Data pushed successfully"

# View current gist URL
data-view:
    @echo "🔗 Current gist URL:"
    @node scripts/gist-view.js

# Validate resume data against schema
data-validate:
    @echo "✓ Validating resume data..."
    node scripts/validate-compendium.mjs data/resume-data.json

# Validate template file
data-validate-template:
    @echo "✓ Validating template..."
    node scripts/validate-compendium.mjs data/resume-data-template.json

# ============================================
# Testing
# ============================================

# Run all tests (Rust + TypeScript)
test: test-rust test-ts
    @echo "✅ All tests passed"

# Run Rust tests
test-rust:
    @echo "🧪 Running Rust tests..."
    cargo test --all

# Run Rust tests with output
test-rust-verbose:
    @echo "🧪 Running Rust tests (verbose)..."
    cargo test --all -- --nocapture

# Run TypeScript tests with Vitest
test-ts:
    @echo "🧪 Running TypeScript tests..."
    npm run test

# Run TypeScript tests in watch mode
test-ts-watch:
    @echo "🧪 Running TypeScript tests (watch mode)..."
    npm run test:watch

# Run TypeScript tests with UI
test-ts-ui:
    @echo "🧪 Opening Vitest UI..."
    npm run test:ui

# Run specific Rust test by name
test-rust-filter PATTERN:
    @echo "🧪 Running Rust tests matching: {{PATTERN}}"
    cargo test {{PATTERN}}

# ============================================
# Code Quality
# ============================================

# Run all checks (lint, typecheck, clippy)
check: check-ts check-rust
    @echo "✅ All checks passed"

# Run TypeScript type checking and linting
check-ts:
    @echo "✓ Type checking TypeScript..."
    npm run typecheck
    @echo "✓ Running ESLint..."
    npm run lint

# Run Rust clippy and formatting checks
check-rust:
    @echo "✓ Checking Rust code..."
    cargo check --all
    @echo "✓ Running clippy..."
    cargo clippy --all -- -D warnings
    @echo "✓ Checking formatting..."
    cargo fmt --all -- --check

# Format all code (Rust + TypeScript)
fmt:
    @echo "🎨 Formatting Rust code..."
    cargo fmt --all
    @echo "🎨 Formatting TypeScript code..."
    npx prettier --write "**/*.{ts,tsx,js,jsx,json,md}"
    @echo "✅ Code formatted"

# ============================================
# Dependency Management
# ============================================

# Check for security vulnerabilities in dependencies
audit:
    @echo "🔒 Auditing Rust dependencies for security issues..."
    cargo audit
    @echo "✅ Security audit complete"

# Check for outdated dependencies
outdated:
    @echo "📦 Checking for outdated Rust dependencies..."
    @cargo outdated --workspace --root-deps-only
    @echo ""
    @echo "📦 Checking for outdated npm dependencies..."
    @npm outdated || true

# Show dependency status (audit + outdated)
deps-status: audit outdated
    @echo "✅ Dependency status check complete"

# ============================================
# Cleaning
# ============================================

# Clean all build artifacts and caches
clean: clean-next clean-rust clean-wasm
    @echo "✅ All artifacts cleaned"

# Clean Next.js build cache
clean-next:
    @echo "🧹 Cleaning Next.js cache..."
    rm -rf .next

# Clean Rust build artifacts
clean-rust:
    @echo "🧹 Cleaning Rust artifacts (6.6GB+)..."
    @echo "⚠️  This will require a full rebuild next time"
    cargo clean

# Clean WASM build outputs
clean-wasm:
    @echo "🧹 Cleaning WASM artifacts..."
    rm -rf public/wasm/*

# Clean node_modules (nuclear option)
clean-node:
    @echo "🧹 Cleaning node_modules (500MB+)..."
    @echo "⚠️  Run npm install to restore"
    rm -rf node_modules

# Clean everything including dependencies
clean-all: clean clean-node
    @echo "✅ Everything cleaned"
    @echo "   Run: npm install && just wasm"

# ============================================
# Utilities
# ============================================

# Show project statistics
stats:
    #!/usr/bin/env bash
    echo "📊 Project Statistics"
    echo ""
    echo "Directory sizes:"
    printf "  Node modules:  " && du -sh node_modules 2>/dev/null || echo "Not found"
    printf "  Rust target:   " && du -sh target 2>/dev/null || echo "Not found"
    printf "  Next.js cache: " && du -sh .next 2>/dev/null || echo "Not found"
    printf "  WASM bundle:   " && du -sh public/wasm 2>/dev/null || echo "Not found"
    echo ""
    echo "File counts:"
    printf "  TypeScript:    " && find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v target | wc -l | xargs
    printf "  Rust:          " && find . -name "*.rs" | grep -v target | wc -l | xargs
    printf "  Tests:         " && find . -name "*test*.rs" -o -name "*test*.ts" -o -name "*test*.tsx" | grep -v node_modules | grep -v target | wc -l | xargs

# Run health checks on project
health:
    #!/usr/bin/env bash
    echo "🏥 Project Health Check"
    echo ""
    echo "Environment:"
    printf "  Node:      " && node --version
    printf "  Rust:      " && rustc --version
    printf "  Cargo:     " && cargo --version
    printf "  wasm-pack: " && wasm-pack --version 2>/dev/null || echo "❌ Not installed"
    echo ""
    echo "Configuration files:"
    for file in package.json Cargo.toml tsconfig.json next.config.ts .env.local; do
        if [ -f "$file" ]; then
            echo "  ✓ $file"
        else
            echo "  ❌ $file missing"
        fi
    done
    echo ""
    echo "Data files:"
    if [ -f "data/resume-data.json" ]; then
        echo "  ✓ Resume data exists"
    else
        echo "  ⚠️  Resume data missing (run: just data-pull)"
    fi
    echo ""
    echo "WASM bundle:"
    if [ -f "public/wasm/docgen_wasm_bg.wasm" ]; then
        size=$(ls -lh public/wasm/docgen_wasm_bg.wasm | awk '{print $5}')
        echo "  ✓ WASM bundle exists ($size)"
    else
        echo "  ⚠️  WASM bundle missing (run: just wasm)"
    fi

# Install all dependencies (fresh setup)
install:
    @echo "📦 Installing dependencies..."
    @echo "  → NPM packages..."
    npm install
    @echo "  → Cargo dependencies..."
    cargo fetch
    @echo ""
    @echo "✅ Dependencies installed"
    @echo ""
    @echo "Next steps:"
    @echo "  1. Copy .env.example to .env.local and fill in values"
    @echo "  2. Run: just data-pull"
    @echo "  3. Run: just wasm"
    @echo "  4. Run: just dev"

# Full rebuild from scratch
rebuild: clean install wasm types-sync
    @echo "✅ Full rebuild complete"
    @echo "   Ready to run: just dev"

# ============================================
# CI/CD
# ============================================

# Run all CI checks (used in GitHub Actions)
ci: check test types-drift
    @echo "✅ All CI checks passed"

# Pre-commit hook (fast checks)
pre-commit:
    @echo "🔍 Running pre-commit checks..."
    @echo "  → Formatting code..."
    @cargo fmt --all
    @echo "  → Type checking..."
    @npm run typecheck
    @echo "  → Cargo check..."
    @cargo check --all
    @echo "✅ Pre-commit checks passed"

# ============================================
# Documentation
# ============================================

# Open project documentation
docs:
    @echo "📚 Opening documentation..."
    @open docs/ARCHITECTURE.md 2>/dev/null || xdg-open docs/ARCHITECTURE.md 2>/dev/null || echo "See: docs/ARCHITECTURE.md"

# Generate Rust documentation
docs-rust:
    @echo "📚 Generating Rust documentation..."
    cargo doc --no-deps --workspace --open
