---
last_updated: 2025-11-13
category: Deployment & Infrastructure
update_frequency: When deployment process changes
retention_policy: All versions preserved in git
---

# Deployment Guide

> **Purpose:** Environment setup and Vercel deployment configuration.
> **For build process:** See [BUILD_PIPELINE.md](./BUILD_PIPELINE.md)
> **For current status:** See [CURRENT_PHASE.md](./CURRENT_PHASE.md)

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

**Workflow:** `.github/workflows/gist-deploy-trigger.yml`

**Process:**
1. Fetch gist metadata (GitHub API)
2. Validate JSON syntax + schema
3. Query Vercel API for last deployment
4. Compare timestamps
5. If gist newer → trigger deploy

**For complete details:** See [BUILD_PIPELINE.md](./BUILD_PIPELINE.md#github-actions-gist-watcher-only)

---

## Build Process

**For complete build details:** See [BUILD_PIPELINE.md](./BUILD_PIPELINE.md)

**Quick reference:**
- Local: `just build` (full build)
- Vercel: Automatic (prebuild hook validates WASM + fetches gist)
- Philosophy: WASM compiled locally once, validated everywhere

**Current build times:** See [METRICS.md](./METRICS.md) (auto-generated)

---

## Troubleshooting

### Build Failures

**Problem:** WASM binaries missing in build

**Solution:**
```bash
just wasm                        # Build locally
ls -lh public/wasm/*.wasm       # Verify artifacts
git add public/wasm/
git commit -m "chore: update WASM binaries"
```

**Note:** Pre-commit validates freshness automatically. Server validates existence only.

**For build details:** See [BUILD_PIPELINE.md](./BUILD_PIPELINE.md#wasm-build-strategy)

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

- **[BUILD_PIPELINE.md](./BUILD_PIPELINE.md)** - Build process, CI/CD, pre-commit hooks
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - WASM pipeline, system design
- **[METRICS.md](./METRICS.md)** - Current build times, sizes (auto-generated)
- **[CURRENT_PHASE.md](./CURRENT_PHASE.md)** - Current deployment status

---

**Last Updated:** 2025-11-13
**Next Review:** When deployment process changes
