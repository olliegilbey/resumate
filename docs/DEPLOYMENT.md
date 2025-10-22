## Deployment

**Status:** Deployed to ollie.gg via Vercel with full gist integration and auto-deploy.

### Environment Variables

Required environment variables (see `.env.example` for template):

**Server-Side Only:**
- `CONTACT_EMAIL_PERSONAL` - Your primary email address
- `CONTACT_EMAIL_PROFESSIONAL` - Your work/professional email address
- `CONTACT_PHONE` - Your phone number (international format)
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile secret key
- `RESUME_DATA_GIST_URL` - GitHub Gist raw URL for resume data
- `N8N_WEBHOOK_URL` - N8N webhook for notifications (Phase 8)

**Client-Side (Public):**
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Cloudflare Turnstile site key

**Setup Instructions:**
1. Copy `.env.example` to `.env.local`
2. Sign up for [Cloudflare Turnstile](https://dash.cloudflare.com/turnstile)
3. Create a "Managed" widget with "Invisible" mode
4. Copy site key and secret key to `.env.local`
5. Add your contact information

**Security Note:** Phone and email are NEVER exposed to the client. They're only used server-side in the vCard generation API route.

### Vercel Setup

1. **Environment Variables** - Set using Vercel CLI with `printf` to avoid newlines:
   ```bash
   printf "%s" "value" | vercel env add VAR_NAME production
   ```
   Required vars: `CONTACT_EMAIL_PERSONAL`, `CONTACT_EMAIL_PROFESSIONAL`, `CONTACT_PHONE`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RESUME_DATA_GIST_URL`

2. **GitHub Action Secrets** - For auto-deploy workflow:
   - `VERCEL_TOKEN` - API token from https://vercel.com/account/tokens
   - `VERCEL_PROJECT_ID` - From `vercel project inspect`
   - `VERCEL_DEPLOY_HOOK_URL` - Deploy hook from Vercel dashboard

3. **Deploy Command**:
   ```bash
   vercel --prod
   ```

### Auto-Deploy Architecture

#### How Deployments Are Triggered

**1. Git Push to GitHub (Standard Vercel Behavior):**
- Vercel watches your main branch automatically
- Any push to `main` triggers automatic deployment
- This is the standard Vercel GitHub integration

**2. Gist Updates (Hourly Auto-Deploy):**
- **Workflow**: `.github/workflows/gist-deploy-trigger.yml`
- **Schedule**: Runs every hour at minute 0 (cron: `0 * * * *`)
- **Can also trigger manually** from GitHub Actions UI

**Hourly Check Process:**
1. Fetch gist metadata from GitHub API
2. **Validate JSON format** with `jq` (fail-fast if invalid)
3. Query Vercel API for last deployment timestamp
4. Compare gist `updated_at` vs Vercel last deploy time
5. If gist is newer → trigger Vercel deploy hook
6. If JSON invalid → fail with error, skip deploy

**3. Manual Deployment:**
- Run `vercel --prod` locally
- Or trigger deploy from Vercel dashboard UI

#### Important Notes

- **No git commits required** - timestamps tracked via Vercel API, not repo state
- **Prebuild always fetches gist** - `package.json` has `"prebuild": "node scripts/fetch-gist-data.js --force"`
- **Gist filename must be** `resume-data.json` (generic for all users)
- **JSON validation is strict** - malformed JSON blocks deployment to prevent build failures

### Checklist
- ✅ Deployed to ollie.gg
- ✅ Environment variables set correctly (no newlines!)
- ✅ GitHub Action running hourly
- ✅ JSON validation in workflow
- ✅ Turnstile working on production
- ✅ Auto-deploy tested and functional

---
