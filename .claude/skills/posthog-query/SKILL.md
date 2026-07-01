---
name: posthog-query
description: Use when checking PostHog analytics for this project — resume downloads, visitor geolocation, session/funnel reconstruction, or any ad-hoc HogQL query. Covers the EU query endpoint, the @current project trick, the narrow-scope personal API key, and filtering out self/dev traffic.
user-invocable: true
allowed-tools: Bash(.claude/skills/posthog-query/*) Bash(jq *) Read Grep Glob
---

# PostHog Query

Query this project's PostHog (EU cloud) analytics directly with HogQL — no dashboard needed.

## Key facts

- **Credentials:** `POSTHOG_PERSONAL_API_KEY` (`phx_...`) lives in the repo-root `.env.local` (gitignored). **Never** paste the key or the `phc_` project key into any tracked/public file.
- **Scope quirk:** the personal key has `query:read` but **not** `project:read`. `/api/projects/` and `/api/organizations/...` return `403 permission_denied`. The `/query/` endpoint with the **`@current`** alias works regardless — that's the whole trick.
- **SSL gotcha:** Python `urllib` fails cert verification on this macOS. Do the HTTP with `curl`; let Python only assemble the JSON body.

## Quick reference

The helper handles auth, `@current`, and JSON encoding. Pass one HogQL string, pipe the JSON to `jq`:

```bash
.claude/skills/posthog-query/posthog-query.sh "SELECT 1" | jq '.results'
```

Result shape: `.columns` (array of names) and `.results` (array of row arrays, same order).

## Common queries

**Recent resume downloads with geolocation** (the "who downloaded my resume, and where" question):

```bash
.claude/skills/posthog-query/posthog-query.sh "
SELECT timestamp,
       properties.\$geoip_city_name AS city,
       properties.\$geoip_subdivision_1_name AS region,
       properties.\$geoip_country_name AS country,
       properties.download_type AS download_type,
       properties.\$browser AS browser, properties.\$os AS os,
       properties.\$referrer AS referrer
FROM events
WHERE event = 'resume_downloaded'
  AND timestamp > now() - INTERVAL 90 DAY
ORDER BY timestamp DESC LIMIT 100" | jq '.results'
```

**Reconstruct one visitor's session** (get `$session_id` from a download row first):

```bash
.claude/skills/posthog-query/posthog-query.sh "
SELECT timestamp, event, properties.\$pathname AS path
FROM events WHERE properties.\$session_id = '<SESSION_ID>'
ORDER BY timestamp ASC LIMIT 300" | jq '.results'
```

**Did they leave contact info?** `email`/`linkedin` are optional props on `resume_downloaded`; the `resume_download_notified` event only fires if they used the notify step. Select `properties.email, properties.linkedin` to check.

## Filtering self / dev traffic

Most events are Ollie's own testing. Exclude them before calling anything a real lead:

- Dev geo: `$geoip_city_name` in Cape Town / Johannesburg.
- Dev referrers: `$referrer` containing `vercel.app` (preview deploys) or `github.com/olliegilbey`.
- **VPN self-tests:** "foreign" downloads that land on an application-submission day are usually Ollie checking the live site via Nord VPN (e.g. a London exit), not a real visitor. Cross-check the date against `~/jarvis/projects/applications` before concluding.

## Common mistakes

- Hitting `/api/projects/` to list projects → 403. Use `@current` on the `/query/` endpoint.
- Using the ingest host `eu.i.posthog.com` for the API → wrong; the API host is `eu.posthog.com`. The helper rewrites this for you.
- Escaping `$` in HogQL property names: inside a double-quoted bash string, write `\$geoip_country_name`.
- Reading `resume_downloaded` counts as leads without filtering self/dev/VPN traffic first.
