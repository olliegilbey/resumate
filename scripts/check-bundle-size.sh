#!/usr/bin/env bash
# Validates WASM binary sizes against limits
# Used in pre-commit hook to prevent oversized bundles
#
# Usage:
#   bash scripts/check-bundle-size.sh [max_raw_mb] [max_gzip_mb]
#   bash scripts/check-bundle-size.sh 17 6.5

set -euo pipefail

WASM_PATH="public/wasm/resume_wasm_bg.wasm"

# Limits from parameters or defaults (sourced from justfile)
MAX_RAW_MB="${1:-17}"
MAX_GZIP_MB="${2:-6.5}"

# Convert to bytes
MAX_RAW=$(echo "$MAX_RAW_MB * 1024 * 1024" | bc | cut -d. -f1)
MAX_GZIP=$(echo "$MAX_GZIP_MB * 1024 * 1024" | bc | cut -d. -f1)

# Check file exists
if [ ! -f "$WASM_PATH" ]; then
  echo "⚠️  WASM binary not found: $WASM_PATH"
  echo "   Run 'just wasm' to build"
  exit 1
fi

# Get raw size (cross-platform)
if stat -f%z "$WASM_PATH" &>/dev/null; then
  RAW_BYTES=$(stat -f%z "$WASM_PATH")
else
  RAW_BYTES=$(stat -c%s "$WASM_PATH")
fi

# Get gzipped size
GZIP_BYTES=$(gzip -c "$WASM_PATH" | wc -c | tr -d ' ')

# Convert to MB for display
RAW_MB=$(echo "scale=2; $RAW_BYTES / 1024 / 1024" | bc)
GZIP_MB=$(echo "scale=2; $GZIP_BYTES / 1024 / 1024" | bc)

# Check limits
FAILED=0

if (( RAW_BYTES > MAX_RAW )); then
  echo "❌ WASM binary too large: ${RAW_MB}MB (limit: ${MAX_RAW_MB}MB)"
  FAILED=1
fi

if (( GZIP_BYTES > MAX_GZIP )); then
  echo "❌ WASM gzipped too large: ${GZIP_MB}MB (limit: ${MAX_GZIP_MB}MB)"
  FAILED=1
fi

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "Bundle size check FAILED"
  echo "Investigate binary bloat:"
  echo "  cargo tree -i typst"
  echo "  cargo bloat --release --crates"
  exit 1
fi

echo "✅ Bundle size check passed (${RAW_MB}MB raw, ${GZIP_MB}MB gzipped)"
exit 0
