#!/usr/bin/env bash
# Cleanup obsolete files after schema refactor

set -e

echo "🧹 Cleaning up obsolete files..."

# Remove backup files
echo "  - Removing backup files"
rm -f app/globals.css.backup
rm -f doc-gen/crates/core/tests/roundtrip.rs.bak
rm -f doc-gen/crates/core/tests/integration_test.rs.bak
rm -f .env.local.bak

# Remove old types/src Rust directory (obsolete, moved to crates/shared-types)
if [ -d "types/src" ]; then
  echo "  - Removing obsolete types/src/ directory"
  rm -rf types/src
fi

# Remove old types/Cargo.toml (obsolete, moved to crates/shared-types)
if [ -f "types/Cargo.toml" ]; then
  echo "  - Removing obsolete types/Cargo.toml"
  rm -f types/Cargo.toml
fi

# Keep types/resume.ts - it's the TypeScript re-export (still needed!)

# Remove old generated/ directory if it exists (schema now in schemas/)
if [ -d "generated" ]; then
  echo "  - Removing obsolete generated/ directory"
  rm -rf generated
fi

# Remove old doc-gen schema directories if they exist
if [ -d "doc-gen/schemas" ]; then
  echo "  - Removing obsolete doc-gen/schemas/"
  rm -rf doc-gen/schemas
fi

echo "✅ Cleanup complete"
echo ""
echo "Remaining structure:"
echo "  ✓ crates/shared-types/  - Canonical Rust types"
echo "  ✓ schemas/              - Generated JSON Schema"
echo "  ✓ types/resume.ts       - TypeScript re-export"
