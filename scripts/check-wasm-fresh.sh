#!/usr/bin/env bash
set -euo pipefail

# Check if WASM binaries are up-to-date with source code
# Used by pre-commit hook to ensure builds are fresh

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# WASM source paths (relative to repo root)
WASM_SOURCES=(
  "crates/resume-wasm"
  "crates/resume-typst"
  "crates/resume-core"
  "crates/shared-types"
  "typst/templates"
  "typst/fonts"
)

# WASM output files
WASM_OUTPUTS=(
  "public/wasm/resume_wasm_bg.wasm"
  "public/wasm/resume_wasm.js"
)

# Hash file to track source state
HASH_FILE=".wasm-build-hash"

# Function to compute hash of all WASM sources
compute_source_hash() {
  # Find all relevant files and compute combined hash
  (
    for source in "${WASM_SOURCES[@]}"; do
      if [[ -d "$source" ]]; then
        find "$source" -type f \( -name "*.rs" -o -name "*.toml" -o -name "*.typ" -o -name "*.ttf" -o -name "*.otf" \) -exec sha256sum {} \;
      fi
    done
  ) | sha256sum | cut -d' ' -f1
}

# Check if WASM outputs exist
check_wasm_exists() {
  for output in "${WASM_OUTPUTS[@]}"; do
    if [[ ! -f "$output" ]]; then
      return 1
    fi
  done
  return 0
}

# Main check
main() {
  # Check if any WASM source files are staged
  wasm_staged=false
  for source in "${WASM_SOURCES[@]}"; do
    if git diff --cached --name-only | grep -q "^${source}/"; then
      wasm_staged=true
      break
    fi
  done

  # If no WASM sources changed, skip check
  if [[ "$wasm_staged" == "false" ]]; then
    exit 0
  fi

  echo -e "${YELLOW}🔍 WASM source files changed - checking if rebuild needed...${NC}"

  # Check if WASM outputs exist
  if ! check_wasm_exists; then
    echo -e "${RED}❌ WASM binaries missing!${NC}"
    echo -e "${YELLOW}Running: just wasm${NC}"
    just wasm
    echo -e "${GREEN}✅ WASM rebuilt successfully${NC}"
    exit 0
  fi

  # Compute current source hash
  current_hash=$(compute_source_hash)

  # Check if hash file exists and matches
  if [[ -f "$HASH_FILE" ]]; then
    stored_hash=$(cat "$HASH_FILE")
    if [[ "$current_hash" == "$stored_hash" ]]; then
      echo -e "${GREEN}✅ WASM is up-to-date${NC}"
      exit 0
    fi
  fi

  # WASM is stale - rebuild
  echo -e "${YELLOW}⚠️  WASM is stale - rebuilding...${NC}"
  echo -e "${YELLOW}Running: just wasm${NC}"

  just wasm

  # Store new hash
  echo "$current_hash" > "$HASH_FILE"

  # Stage updated WASM files
  git add "${WASM_OUTPUTS[@]}" "$HASH_FILE"

  echo -e "${GREEN}✅ WASM rebuilt and staged for commit${NC}"
}

main "$@"
