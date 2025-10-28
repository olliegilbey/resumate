#!/usr/bin/env bash
#
# Build WASM for production deployment
# Runs as part of build process (locally and on Vercel)
#
# Usage: ./scripts/build-wasm.sh [--skip-cleanup]

set -e

SKIP_CLEANUP="${1}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/public/wasm"

echo "🦀 Building WASM for deployment..."
echo ""

# Step 1: Clean old WASM artifacts (unless skipped)
if [ "$SKIP_CLEANUP" != "--skip-cleanup" ]; then
    echo "🧹 Cleaning old WASM artifacts..."
    rm -rf "$OUTPUT_DIR"/*.wasm "$OUTPUT_DIR"/*.js "$OUTPUT_DIR"/*.ts 2>/dev/null || true
    echo "✅ Cleanup complete"
    echo ""
fi

# Step 2: Check for Rust toolchain
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust not found. Installing..."
    echo ""

    # Install Rust (used by Vercel build)
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    source "$HOME/.cargo/env"

    echo "✅ Rust installed"
    echo ""
fi

# Step 3: Check for wasm-pack
if ! command -v wasm-pack &> /dev/null; then
    echo "📦 Installing wasm-pack..."
    cargo install wasm-pack --locked
    echo "✅ wasm-pack installed"
    echo ""
fi

# Step 4: Build WASM
echo "🔨 Building WASM (release mode)..."
cd doc-gen
wasm-pack build crates/wasm \
    --target web \
    --out-dir "$OUTPUT_DIR" \
    --release \
    --no-pack
cd ..

echo ""
echo "✅ WASM build complete!"
echo ""

# Step 5: Show build output
echo "📦 Generated artifacts:"
ls -lh "$OUTPUT_DIR"/*.wasm "$OUTPUT_DIR"/*.js 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'

echo ""
echo "📊 Gzipped size (production delivery):"
gzip -c "$OUTPUT_DIR/docgen_wasm_bg.wasm" | wc -c | awk '{printf "  docgen_wasm_bg.wasm: %.1f MB\n", $1/1024/1024}'

echo ""
echo "🎯 Build timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
