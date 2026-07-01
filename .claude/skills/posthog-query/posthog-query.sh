#!/usr/bin/env bash
#
# Run a HogQL query against this project's PostHog (EU cloud) and print raw JSON.
#
# Usage:
#   .claude/skills/posthog-query/posthog-query.sh "SELECT 1"
#   .claude/skills/posthog-query/posthog-query.sh "$(cat query.sql)" | jq '.results'
#
# Why this wrapper exists (the "trick"):
#   1. The personal API key ($POSTHOG_PERSONAL_API_KEY, phx_...) is narrowly scoped:
#      it has `query:read` but NOT `project:read`. So endpoints like /api/projects/
#      return 403. The /query/ endpoint with the `@current` alias works anyway.
#   2. Python's urllib hits an SSL cert error on this macOS. curl does the network
#      call; python only assembles the JSON body (safe: no HTTP), sidestepping it.
#
# Reads POSTHOG_PERSONAL_API_KEY from the repo-root .env.local (gitignored PII).
# Override the env file with POSTHOG_ENV_FILE=/path/to/.env.local if needed.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${POSTHOG_ENV_FILE:-$HERE/../../../.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "posthog-query: env file not found: $ENV_FILE" >&2
  exit 1
fi

# Extract a single var without `source`-ing the file: .env.local holds unquoted
# values with spaces (e.g. CONTACT_PHONE) that bash would try to execute, and
# sourcing runs arbitrary lines. Read only what we need; strip one layer of quotes.
read_env() {
  local var="$1" file="$2" val
  val="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${var}=" "$file" | tail -1)"
  val="${val#*=}"
  [[ "$val" == \"*\" ]] && val="${val:1:${#val}-2}"
  [[ "$val" == \'*\' ]] && val="${val:1:${#val}-2}"
  printf '%s' "$val"
}

POSTHOG_PERSONAL_API_KEY="$(read_env POSTHOG_PERSONAL_API_KEY "$ENV_FILE")"
: "${POSTHOG_PERSONAL_API_KEY:?POSTHOG_PERSONAL_API_KEY not set in $ENV_FILE}"

HOST="$(read_env NEXT_PUBLIC_POSTHOG_HOST "$ENV_FILE")"
HOST="${HOST:-https://eu.i.posthog.com}"
# API host is the app domain, not the ingest (i.) subdomain.
API_HOST="${HOST/https:\/\/eu.i./https:\/\/eu.}"

HQL="${1:?usage: posthog-query.sh \"<HogQL>\"}"

BODY="$(HQL="$HQL" python3 -c 'import json,os; print(json.dumps({"query":{"kind":"HogQLQuery","query":os.environ["HQL"]}}))')"

curl -sS \
  -H "Authorization: Bearer $POSTHOG_PERSONAL_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST "$API_HOST/api/projects/@current/query/" \
  --data "$BODY"
