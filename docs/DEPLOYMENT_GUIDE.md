---
last_updated: 2025-10-28
category: Deployment & Infrastructure
update_frequency: When deployment process changes
retention_policy: All versions preserved in git
---

# Deployment Guide

> **📍 Purpose:** Prescriptive guide for deploying the Resumate application.
> For current deployment status, see [CURRENT_PHASE.md](./CURRENT_PHASE.md)

---

## Environment Variables

### Server-Side Only (Never Exposed to Client)

| Variable | Purpose | Required |
|----------|---------|----------|
| `CONTACT_EMAIL_PERSONAL` | Primary email address | ✅ Yes |
| `CONTACT_EMAIL_PROFESSIONAL` | Work/professional email | ✅ Yes |
| `CONTACT_PHONE` | Phone number (international format) | ✅ Yes |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key | ✅ Yes |
| `RESUME_DATA_GIST_URL` | GitHub Gist raw URL for resume data | ✅ Yes |
| `N8N_WEBHOOK_URL` | N8N webhook for notifications | ⏳ Phase 8 |

### Client-Side (Public)

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | ✅ Yes |

**Security Note:** Phone and email are NEVER exposed to the client. They're only used server-side in the vCard generation API route.

---

## Initial Setup

### 1. Cloudflare Turnstile Setup

```bash
# 1. Sign up for Cloudflare Turnstile
open https://dash.cloudflare.com/turnstile

# 2. Create a "Managed" widget with "Invisible" mode
# 3. Copy site key and secret key

# 4. Set environment variables locally
cp .env.example .env.local
# Edit .env.local with your keys
```

### 2. Local Environment Configuration

```bash
# Copy template
cp .env.example .env.local

# Required variables in .env.local:
CONTACT_EMAIL_PERSONAL=your-email@example.com
CONTACT_EMAIL_PROFESSIONAL=work@example.com
CONTACT_PHONE=+1234567890
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAA...
TURNSTILE_SECRET_KEY=0x4BBB...
RESUME_DATA_GIST_URL=https://gist.githubusercontent.com/...
```

---

## Vercel Deployment

### 1. Set Environment Variables

**IMPORTANT:** Use `printf` to avoid trailing newlines:

```bash
# Set production environment variables
printf "%s" "your-email@example.com" | vercel env add CONTACT_EMAIL_PERSONAL production
printf "%s" "work@example.com" | vercel env add CONTACT_EMAIL_PROFESSIONAL production
printf "%s" "+1234567890" | vercel env add CONTACT_PHONE production
printf "%s" "0x4AAA..." | vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY production
printf "%s" "0x4BBB..." | vercel env add TURNSTILE_SECRET_KEY production
printf "%s" "https://gist.githubusercontent.com/..." | vercel env add RESUME_DATA_GIST_URL production

# Verify no newlines were added
vercel env ls production
```

### 2. Configure GitHub Action Secrets

For the auto-deploy workflow (`.github/workflows/gist-deploy-trigger.yml`):

```bash
# In GitHub repo → Settings → Secrets and variables → Actions

# Add these secrets:
VERCEL_TOKEN              # From https://vercel.com/account/tokens
VERCEL_PROJECT_ID         # From: vercel project inspect
VERCEL_DEPLOY_HOOK_URL    # From Vercel dashboard → Settings → Deploy Hooks
```

### 3. Deploy to Production

```bash
# First deployment
vercel --prod

# Subsequent deployments (automatic via git push or gist updates)
git push origin main
```

---

## Auto-Deploy Architecture

### Deployment Triggers

**Three ways to trigger deployment:**

1. **Git Push to Main Branch** (Standard Vercel Integration)
   - Vercel watches `main` branch automatically
   - Any push triggers automatic deployment
   - Built-in Vercel GitHub integration

2. **Gist Updates** (Hourly Auto-Deploy)
   - Workflow: `.github/workflows/gist-deploy-trigger.yml`
   - Schedule: Every hour at minute 0 (`cron: 0 * * * *`)
   - Can trigger manually from GitHub Actions UI

3. **Manual Deployment**
   - Run `vercel --prod` locally
   - Or trigger from Vercel dashboard UI

### Hourly Gist Check Process

```
1. Fetch gist metadata from GitHub API
2. Validate JSON format with `jq` (fail-fast if invalid)
3. Query Vercel API for last deployment timestamp
4. Compare gist `updated_at` vs Vercel last deploy time
5. If gist newer → trigger Vercel deploy hook
6. If JSON invalid → fail with error, skip deploy
```

**Key Features:**
- No git commits required (timestamps tracked via Vercel API)
- Prebuild always fetches gist: `package.json` → `"prebuild": "node scripts/fetch-gist-data.js --force"`
- Gist filename must be `resume-data.json`
- JSON validation is strict (malformed JSON blocks deployment)

---

## Build Process

### Local Build

```bash
# Full production build
just build

# Build includes:
# 1. WASM validation (scripts/check-wasm.sh --exists)
# 2. Gist data fetch (scripts/fetch-gist-data.js --force)
# 3. Next.js build
```

### Vercel Build Process

Vercel runs automatically:

```json
{
  "scripts": {
    "prebuild": "bash scripts/check-wasm.sh --exists && bun scripts/fetch-gist-data.js --force",
    "build": "next build"
  }
}
```

**Build Steps:**
1. Install dependencies (`bun install`)
2. Run prebuild hook:
   - Validate WASM binaries exist (pre-built locally, committed to git)
   - Fetch latest gist data
3. Build Next.js app
4. Deploy to Vercel edge network

**Build Time:** ~2-3 minutes total (WASM validation: <1s, never rebuilds on server)

**Philosophy:** WASM compiled locally once, validated everywhere, deployed fast

---

## Troubleshooting

### Build Failures

**Problem:** WASM binaries missing in build

**Solution:** WASM never builds on server - must be committed locally:
```bash
# Build locally
just wasm

# Verify artifacts exist
ls -lh public/wasm/*.wasm

# Commit binaries (pre-commit will validate freshness)
git add public/wasm/
git commit -m "chore: update WASM binaries"
git push

# Server validates existence only (check-wasm.sh --exists)
```

**Problem:** Gist data not updating

**Solution:** Check prebuild hook runs successfully:
```bash
# Test locally
bun scripts/fetch-gist-data.js --force
# Should output: ✅ Resume data fetched and validated
```

**Problem:** Environment variables not working

**Solution:** Verify no trailing newlines:
```bash
# Check variable length
vercel env pull .env.vercel.json
cat .env.vercel.json | jq '.CONTACT_EMAIL_PERSONAL | length'
# Should match string length exactly
```

### Deployment Not Triggering

**Problem:** Gist updated but no deployment

**Solution:** Check GitHub Action logs:
```bash
# GitHub repo → Actions → "Check Gist and Trigger Deploy"
# Verify:
# 1. Workflow ran (hourly cron)
# 2. JSON validation passed
# 3. Gist timestamp newer than last deploy
# 4. Deploy hook called successfully
```

**Problem:** Deploy hook not working

**Solution:** Regenerate deploy hook in Vercel dashboard:
```bash
# Vercel dashboard → Settings → Deploy Hooks
# Delete old hook, create new one
# Update VERCEL_DEPLOY_HOOK_URL secret in GitHub
```

---

## Verification Checklist

After deployment, verify:

- [ ] Site loads at production URL
- [ ] Environment variables set correctly (no newlines)
- [ ] Turnstile CAPTCHA works
- [ ] vCard download functional
- [ ] WASM loads and generates PDF
- [ ] Auto-deploy workflow running hourly
- [ ] JSON validation in workflow active
- [ ] Gist changes trigger deployments

---

## Related Documentation

- **[CURRENT_PHASE.md](./CURRENT_PHASE.md)** - Current deployment status
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and data flow
- **[TESTING_STRATEGY.md](./TESTING_STRATEGY.md)** - Testing requirements

---

**Last Updated:** 2025-10-28
**Next Review:** When deployment process changes
