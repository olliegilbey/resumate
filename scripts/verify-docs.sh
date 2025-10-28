#!/usr/bin/env bash
# Verifies documentation consistency and freshness
# Called automatically by pre-commit hook on markdown changes

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

echo "🔍 Verifying documentation system..."
echo ""

# =============================================================================
# CHECK 1: No test counts in .claude/CLAUDE.md
# =============================================================================
echo "📋 Check 1: No test counts in .claude/CLAUDE.md"

if grep -qE "[0-9]+ tests" .claude/CLAUDE.md 2>/dev/null; then
  echo -e "${RED}❌ FAIL${NC}: Found test counts in .claude/CLAUDE.md"
  echo "   Test counts should only appear in docs/METRICS.md (auto-generated)"
  grep -nE "[0-9]+ tests" .claude/CLAUDE.md || true
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ PASS${NC}: No test counts found in router document"
fi
echo ""

# =============================================================================
# CHECK 2: docs/METRICS.md is <24h old
# =============================================================================
echo "📊 Check 2: docs/METRICS.md freshness (<24h)"

if [[ ! -f docs/METRICS.md ]]; then
  echo -e "${RED}❌ FAIL${NC}: docs/METRICS.md does not exist"
  echo "   Run: just test (auto-generates METRICS.md)"
  ERRORS=$((ERRORS + 1))
else
  # Get last modified time of METRICS.md
  if [[ "$(uname)" == "Darwin" ]]; then
    # macOS
    FILE_AGE_SECONDS=$(( $(date +%s) - $(stat -f %m docs/METRICS.md) ))
  else
    # Linux
    FILE_AGE_SECONDS=$(( $(date +%s) - $(stat -c %Y docs/METRICS.md) ))
  fi

  FILE_AGE_HOURS=$((FILE_AGE_SECONDS / 3600))

  if [[ $FILE_AGE_HOURS -gt 24 ]]; then
    echo -e "${YELLOW}⚠️  WARN${NC}: docs/METRICS.md is ${FILE_AGE_HOURS}h old (>24h)"
    echo "   Run: just test (regenerates METRICS.md)"
    echo "   Note: This is a warning, not an error (stale data acceptable)"
  else
    echo -e "${GREEN}✅ PASS${NC}: docs/METRICS.md is ${FILE_AGE_HOURS}h old (<24h)"
  fi
fi
echo ""

# =============================================================================
# CHECK 3: Timestamp format validation
# =============================================================================
echo "📅 Check 3: Timestamp format validation"

TIMESTAMP_ERRORS=0

# Find all markdown files with frontmatter timestamps
while IFS= read -r file; do
  # Extract last_updated or Generated timestamp from frontmatter
  TIMESTAMP=$(grep -E "^(last_updated|Generated):" "$file" | head -1 | cut -d: -f2- | xargs || echo "")

  if [[ -z "$TIMESTAMP" ]]; then
    # No timestamp found, skip
    continue
  fi

  # METRICS.md should have date+time (e.g., 2025-10-28T16:02)
  if [[ "$file" == "docs/METRICS.md" ]]; then
    if ! echo "$TIMESTAMP" | grep -qE "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$"; then
      echo -e "${RED}❌ FAIL${NC}: $file has invalid timestamp format: $TIMESTAMP"
      echo "   Expected: YYYY-MM-DDTHH:MM (date+time to minutes)"
      echo "   Example: 2025-10-28T16:02"
      TIMESTAMP_ERRORS=$((TIMESTAMP_ERRORS + 1))
    fi
  else
    # All other docs should have date-only (e.g., 2025-10-28)
    if ! echo "$TIMESTAMP" | grep -qE "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"; then
      echo -e "${RED}❌ FAIL${NC}: $file has invalid timestamp format: $TIMESTAMP"
      echo "   Expected: YYYY-MM-DD (date only, no time)"
      echo "   Example: 2025-10-28"
      TIMESTAMP_ERRORS=$((TIMESTAMP_ERRORS + 1))
    fi
  fi
done < <(find docs .claude -name "*.md" -type f 2>/dev/null || true)

if [[ $TIMESTAMP_ERRORS -eq 0 ]]; then
  echo -e "${GREEN}✅ PASS${NC}: All timestamps follow correct format"
  echo "   METRICS.md: date+time (YYYY-MM-DDTHH:MM)"
  echo "   Other docs: date only (YYYY-MM-DD)"
else
  echo -e "${RED}❌ FAIL${NC}: Found $TIMESTAMP_ERRORS timestamp format errors"
  ERRORS=$((ERRORS + TIMESTAMP_ERRORS))
fi
echo ""

# =============================================================================
# CHECK 4: No duplicate headers across key docs
# =============================================================================
echo "🔍 Check 4: No duplicate headers across key documentation"

DUPLICATE_ERRORS=0

# Check for specific duplicated content (test counts, coverage percentages)
KEY_FILES=(".claude/CLAUDE.md" "docs/CURRENT_PHASE.md" "docs/TESTING_STRATEGY.md")

for file in "${KEY_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  # Check for coverage percentages (should only be in METRICS.md)
  if [[ "$file" != "docs/METRICS.md" ]] && grep -qE "[0-9]+(\.[0-9]+)?%" "$file" 2>/dev/null; then
    # Allow "100%" or "80%+" in TESTING_STRATEGY.md (targets, not measurements)
    if [[ "$file" == "docs/TESTING_STRATEGY.md" ]]; then
      if grep -qE "[0-9]{2}\.[0-9]+%" "$file"; then
        echo -e "${RED}❌ FAIL${NC}: Found specific coverage % in $file"
        echo "   Coverage percentages should only appear in docs/METRICS.md"
        grep -nE "[0-9]{2}\.[0-9]+%" "$file" | head -3 || true
        DUPLICATE_ERRORS=$((DUPLICATE_ERRORS + 1))
      fi
    else
      # For other files, flag any percentage
      if grep -qE "[0-9]{2}\.[0-9]+%" "$file"; then
        echo -e "${RED}❌ FAIL${NC}: Found specific coverage % in $file"
        echo "   Coverage percentages should only appear in docs/METRICS.md"
        grep -nE "[0-9]{2}\.[0-9]+%" "$file" | head -3 || true
        DUPLICATE_ERRORS=$((DUPLICATE_ERRORS + 1))
      fi
    fi
  fi
done

if [[ $DUPLICATE_ERRORS -eq 0 ]]; then
  echo -e "${GREEN}✅ PASS${NC}: No duplicate metrics found in documentation"
else
  echo -e "${RED}❌ FAIL${NC}: Found $DUPLICATE_ERRORS duplicate metric instances"
  ERRORS=$((ERRORS + DUPLICATE_ERRORS))
fi
echo ""

# =============================================================================
# CHECK 5: Documentation links are valid
# =============================================================================
echo "🔗 Check 5: Internal documentation links are valid"

LINK_ERRORS=0

# Extract all markdown links to docs/ from key files
while IFS= read -r file; do
  # Find links like [text](./docs/FILE.md) or [text](docs/FILE.md)
  while IFS= read -r link; do
    # Extract the path from the link
    LINK_PATH=$(echo "$link" | sed -E 's/.*\((\.\/)?([^)]+)\).*/\2/')

    # Skip external links (http://, https://)
    if [[ "$LINK_PATH" =~ ^https?:// ]]; then
      continue
    fi

    # Skip anchor-only links (#something)
    if [[ "$LINK_PATH" =~ ^# ]]; then
      continue
    fi

    # Remove anchor if present (./docs/FILE.md#anchor → ./docs/FILE.md)
    LINK_PATH=$(echo "$LINK_PATH" | cut -d'#' -f1)

    # Resolve relative path
    FILE_DIR=$(dirname "$file")
    RESOLVED_PATH="$FILE_DIR/$LINK_PATH"

    # Normalize path (remove ./ and ../)
    RESOLVED_PATH=$(cd "$(dirname "$RESOLVED_PATH")" 2>/dev/null && pwd)/$(basename "$RESOLVED_PATH") || echo "$RESOLVED_PATH"

    # Check if file exists
    if [[ ! -f "$RESOLVED_PATH" ]] && [[ ! -f "$LINK_PATH" ]]; then
      echo -e "${RED}❌ FAIL${NC}: Broken link in $file"
      echo "   Link: $link"
      echo "   Target: $LINK_PATH"
      LINK_ERRORS=$((LINK_ERRORS + 1))
    fi
  done < <(grep -oE '\[([^\]]+)\]\(([^)]+)\)' "$file" 2>/dev/null || true)
done < <(find docs .claude -name "*.md" -type f 2>/dev/null || true)

if [[ $LINK_ERRORS -eq 0 ]]; then
  echo -e "${GREEN}✅ PASS${NC}: All internal documentation links are valid"
else
  echo -e "${RED}❌ FAIL${NC}: Found $LINK_ERRORS broken documentation links"
  ERRORS=$((ERRORS + LINK_ERRORS))
fi
echo ""

# =============================================================================
# SUMMARY
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $ERRORS -eq 0 ]]; then
  echo -e "${GREEN}✅ All documentation checks passed!${NC}"
  echo ""
  echo "Documentation system is healthy:"
  echo "  • No test counts in router document"
  echo "  • Metrics are fresh (<24h or acceptable)"
  echo "  • Timestamps follow correct format"
  echo "  • No duplicate metrics across docs"
  echo "  • All internal links are valid"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Documentation verification failed with $ERRORS error(s)${NC}"
  echo ""
  echo "Fix these issues before committing:"
  echo "  1. Remove test counts from .claude/CLAUDE.md"
  echo "  2. Regenerate metrics: just test"
  echo "  3. Fix timestamp formats (YYYY-MM-DD or YYYY-MM-DDTHH:MM)"
  echo "  4. Remove duplicate metrics from docs"
  echo "  5. Fix broken documentation links"
  echo ""
  echo "See: docs/META_DOCUMENTATION.md for documentation system rules"
  exit 1
fi
