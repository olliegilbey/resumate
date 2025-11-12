#!/usr/bin/env bash
# Temporary script to measure pre-commit hook duration
# Usage: bash scripts/time-pre-commit.sh

set -euo pipefail

echo "⏱️  Testing pre-commit hook duration..."
echo ""

START=$(date +%s)

# Run pre-commit hook
if [ -f ".husky/pre-commit" ]; then
  bash .husky/pre-commit
  EXIT_CODE=$?
else
  echo "❌ Pre-commit hook not found"
  exit 1
fi

END=$(date +%s)
DURATION=$((END - START))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏱️  Pre-commit duration: ${DURATION}s"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $DURATION -le 15 ]; then
  echo "✅ Fast path (<15s)"
elif [ $DURATION -le 60 ]; then
  echo "⚠️  Medium path (15-60s)"
elif [ $DURATION -le 90 ]; then
  echo "⚠️  Slow path (60-90s)"
else
  echo "❌ Very slow (>90s) - investigate performance"
fi

exit $EXIT_CODE
