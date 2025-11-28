# Resumate - Build Automation
# Next.js 15 + Rust/WASM project
#
# Usage:
#   just          # Show all available targets
#   just dev      # Start dev server
#   just test     # Run all tests
#   just wasm     # Rebuild WASM

# ============================================
# Build Limits (Single Source of Truth)
# ============================================

# WASM Binary Size Limits (MB)
wasm_max_raw_mb := "17"
wasm_max_gzip_mb := "6.5"

# Pre-commit Timing Limits (seconds)
precommit_max_duration := "70"
precommit_fast_target := "15"
precommit_rebuild_target := "60"

# Test Coverage Targets (%)
rust_coverage_min := "85"
ts_coverage_min := "85"

# Test Count Baselines (for regression detection)
rust_test_min := "140"
ts_test_min := "200"

# Build Artifact Paths
wasm_binary_path := "public/wasm/resume_wasm_bg.wasm"

# Note: Update these values only after testing + documenting reason

# ============================================

# Default target: list all commands
default:
    @just --list

# ============================================
# Development
# ============================================

# Start Next.js dev server with Turbopack (port 3002)
dev:
    @echo "🚀 Starting dev server on port 3002..."
    PORT=3002 bun dev

# ============================================
# Building
# ============================================

# Build Next.js production bundle
# Note: This runs the same steps as Vercel's build process
build:
    @echo "📦 Building production bundle..."
    @echo ""
    @echo "  Step 1/3: Building WASM..."
    @just wasm
    @echo ""
    @echo "  Step 2/3: Fetching resume data from gist..."
    bun scripts/fetch-gist-data.js --force
    @echo ""
    @echo "  Step 3/3: Building Next.js with Turbopack..."
    bun x next build --turbopack
    @echo ""
    @echo "✅ Build complete"

# Build WASM with fonts (release mode)
wasm: wasm-fonts
    @echo "🦀 Building WASM (release mode)..."
    wasm-pack build crates/resume-wasm --target web --out-dir ../../public/wasm --release
    @echo ""
    @echo "📦 WASM bundle:"
    @ls -lh public/wasm/*.wasm public/wasm/*.js 2>/dev/null | head -5 || true
    @echo ""
    @echo "📏 Gzipped size:"
    @gzip -c public/wasm/resume_wasm_bg.wasm | wc -c | awk '{printf "  %.1f MB\n", $1/1024/1024}'

# Build WASM in dev mode (faster, larger)
wasm-dev: wasm-fonts
    @echo "🦀 Building WASM (dev mode)..."
    @echo "⚠️  Dev mode: faster build, larger bundle, no optimizations"
    wasm-pack build crates/resume-wasm --target web --out-dir ../../public/wasm --dev

# Download fonts for Typst PDF generation
wasm-fonts:
    @if [ ! -d "typst/fonts" ] || [ -z "$(ls -A typst/fonts 2>/dev/null)" ]; then \
        echo "📥 Downloading Typst fonts..."; \
        cd crates/resume-typst && bash download-fonts.sh; \
    else \
        echo "✓ Fonts already downloaded"; \
    fi

# ============================================
# Type Synchronization
# ============================================

# Generate JSON Schema from Rust types
types-schema:
    @echo "🔧 Generating JSON Schema from Rust..."
    cargo run --bin generate_schema -p shared-types
    @echo "  → schemas/resume.schema.json"

# Generate TypeScript types from JSON Schema
types-ts:
    @echo "🔧 Generating TypeScript types..."
    bun types:gen
    @echo "  → lib/types/generated-resume.ts"

# Full type sync pipeline: Rust → Schema → TypeScript
types-sync: types-schema types-ts
    @echo "✓ Validating type synchronization..."
    bun typecheck
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
    bun scripts/fetch-gist-data.js

# Pull resume data (force overwrite local changes)
data-pull-force:
    @echo "📥 Fetching resume data (force overwrite)..."
    @echo "⚠️  This will overwrite any local changes"
    bun scripts/fetch-gist-data.js --force

# Push resume data to GitHub Gist
data-push:
    @echo "📤 Pushing resume data to gist..."
    @echo "  → Validating data..."
    bun scripts/validate-compendium.mjs data/resume-data.json
    @echo "  → Uploading..."
    bun scripts/gist-push.js
    @echo "✅ Data pushed successfully"

# View current gist URL
data-view:
    @echo "🔗 Current gist URL:"
    @bun scripts/gist-view.js

# Validate resume data against schema
data-validate:
    @echo "✓ Validating resume data..."
    bun scripts/validate-compendium.mjs data/resume-data.json

# Validate template file
data-validate-template:
    @echo "✓ Validating template..."
    bun scripts/validate-compendium.mjs data/resume-data-template.json

# ============================================
# Documentation
# ============================================

# Generate METRICS.md from test logs
metrics-generate:
    @echo "📊 Generating METRICS.md from test logs..."
    bash scripts/update-metrics-from-logs.sh

# Verify documentation consistency
docs-verify:
    @echo "🔍 Verifying documentation system..."
    bash scripts/verify-docs.sh

# Full documentation health check (generate + verify)
docs-health: metrics-generate docs-verify
    @echo ""
    @echo "✅ Documentation system is healthy"

# ============================================
# Testing
# ============================================

# Run all tests (Rust + TypeScript)
test: test-rust test-ts
    @echo "✅ All tests passed"
    @bash scripts/update-metrics-from-logs.sh

# Run Rust tests
test-rust:
    @echo "🧪 Running Rust tests..."
    @mkdir -p .logs
    @cargo test --all 2>&1 | tee .logs/rust-tests.log

# Run Rust tests with output
test-rust-verbose:
    @echo "🧪 Running Rust tests (verbose)..."
    cargo test --all -- --nocapture

# Run TypeScript tests with Vitest
test-ts:
    @echo "🧪 Running TypeScript tests..."
    @mkdir -p .logs
    @bun run test 2>&1 | tee .logs/ts-tests.log

# Run TypeScript tests in watch mode
test-ts-watch:
    @echo "🧪 Running TypeScript tests (watch mode)..."
    bun run test:watch

# Run TypeScript tests with UI
test-ts-ui:
    @echo "🧪 Opening Vitest UI..."
    bun run test:ui

# Run specific Rust test by name
test-rust-filter PATTERN:
    @echo "🧪 Running Rust tests matching: {{PATTERN}}"
    cargo test {{PATTERN}}

# ============================================
# Test Coverage
# ============================================

# Run all coverage reports (Rust + TypeScript)
coverage: coverage-rust coverage-ts
    @echo "✅ Coverage reports generated"
    @echo "  📊 Rust: target/llvm-cov/html/index.html"
    @echo "  📊 TypeScript: coverage/index.html"

# Generate Rust test coverage with llvm-cov (requires: cargo install cargo-llvm-cov)
coverage-rust:
    @echo "📊 Generating Rust coverage report..."
    @echo "  (Install: cargo install cargo-llvm-cov)"
    cargo llvm-cov --all --html --output-dir target/llvm-cov/html
    @echo "✅ Rust coverage: target/llvm-cov/html/index.html"

# Generate Rust coverage in lcov format (for CI/GitHub)
coverage-rust-lcov:
    @echo "📊 Generating Rust coverage (lcov format)..."
    cargo llvm-cov --all --lcov --output-path target/llvm-cov/lcov.info
    @echo "✅ Rust coverage: target/llvm-cov/lcov.info"

# Generate TypeScript coverage with Vitest
coverage-ts:
    @echo "📊 Generating TypeScript coverage..."
    bun run test:coverage
    @echo "✅ TypeScript coverage: coverage/index.html"

# Open Rust coverage report in browser
coverage-rust-open:
    @echo "🌐 Opening Rust coverage report..."
    open target/llvm-cov/html/index.html || xdg-open target/llvm-cov/html/index.html

# Open TypeScript coverage report in browser
coverage-ts-open:
    @echo "🌐 Opening TypeScript coverage report..."
    open coverage/index.html || xdg-open coverage/index.html

# Clean coverage artifacts
coverage-clean:
    @echo "🧹 Cleaning coverage artifacts..."
    rm -rf target/llvm-cov coverage
    @echo "✅ Coverage artifacts cleaned"

# ============================================
# Code Quality
# ============================================

# Run all checks (lint, typecheck, clippy)
check: check-ts check-rust
    @echo "✅ All checks passed"

# Run TypeScript type checking and linting
check-ts:
    @echo "✓ Type checking TypeScript..."
    bun typecheck
    @echo "✓ Running ESLint..."
    bun lint

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
    bun x prettier --write "**/*.{ts,tsx,js,jsx,json,md}"
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
    @echo "📦 Checking for outdated bun dependencies..."
    @bun pm outdated || true

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
    @# Also clean nested cargo workspaces
    @find . -type d -name "target" -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true

# Clean WASM build outputs
clean-wasm:
    @echo "🧹 Cleaning WASM artifacts..."
    rm -rf public/wasm/*

# Clean node_modules (nuclear option)
clean-node:
    @echo "🧹 Cleaning node_modules (500MB+)..."
    @echo "⚠️  Run bun install to restore"
    rm -rf node_modules

# Clean everything including dependencies
clean-all: clean clean-node
    @echo "✅ Everything cleaned"
    @echo "   Run: bun install && just wasm"

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
    if [ -f "public/wasm/resume_wasm_bg.wasm" ]; then
        size=$(ls -lh public/wasm/resume_wasm_bg.wasm | awk '{print $5}')
        echo "  ✓ WASM bundle exists ($size)"
    else
        echo "  ⚠️  WASM bundle missing (run: just wasm)"
    fi

# Install all dependencies (fresh setup)
install:
    @echo "📦 Installing dependencies..."
    @echo "  → Bun packages..."
    bun install
    @echo "  → Cargo dependencies..."
    cargo fetch
    @echo "  → WASM tooling..."
    rustup target add wasm32-unknown-unknown
    cargo install wasm-pack --locked
    @echo ""
    @echo "✅ Dependencies installed"
    @echo ""
    @echo "Next steps:"
    @echo "  1. Run: vercel link (pulls .env.local)"
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
    @bun typecheck
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
