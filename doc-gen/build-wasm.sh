#!/usr/bin/env bash
#
# Build WASM package for browser use
#
# Usage:
#   ./build-wasm.sh [--dev|--release]
#
# Output: pkg/ directory with .wasm, .js, and .d.ts files

set -e

PROFILE="${1:---release}"
TARGET="web"

echo "🦀 Building WASM package (profile: ${PROFILE})..."

if [ "$PROFILE" = "--dev" ]; then
    wasm-pack build crates/wasm --target "$TARGET" --dev
else
    wasm-pack build crates/wasm --target "$TARGET" --release
fi

echo "✅ WASM build complete!"
echo ""
echo "📦 Package contents:"
ls -lh pkg/

echo ""
echo "📏 Size (gzipped):"
gzip -c pkg/docgen_wasm_bg.wasm | wc -c | awk '{print "  " $1/1024 " KB"}'
