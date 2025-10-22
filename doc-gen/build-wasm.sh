#!/usr/bin/env bash
#
# Build WASM package for browser use
#
# Usage:
#   ./build-wasm.sh [--dev|--release]
#
# Output: ../public/wasm/ directory with .wasm, .js, and .d.ts files
#          (Served by Next.js at /wasm/* URLs)

set -e

PROFILE="${1:---release}"
TARGET="web"
# Path is relative to doc-gen/ -> ../ goes to project root
OUTPUT_DIR="../public/wasm"

echo "🦀 Building WASM package (profile: ${PROFILE})..."
echo "📍 Output directory: ${OUTPUT_DIR}"

if [ "$PROFILE" = "--dev" ]; then
    wasm-pack build crates/wasm --target "$TARGET" --out-dir "$OUTPUT_DIR" --dev
else
    wasm-pack build crates/wasm --target "$TARGET" --out-dir "$OUTPUT_DIR" --release
fi

echo "✅ WASM build complete!"
echo ""
echo "📦 Package contents:"
ls -lh "${OUTPUT_DIR}/"

echo ""
echo "📏 Size (gzipped):"
gzip -c "${OUTPUT_DIR}/docgen_wasm_bg.wasm" | wc -c | awk '{print "  " $1/1024 " KB"}'
