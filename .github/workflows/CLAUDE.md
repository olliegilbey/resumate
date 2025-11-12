# CI/CD & GitHub Actions Context

**You're reading this because you're working with:**
- Files in `.github/workflows/`
- GitHub Actions workflows
- CI/CD automation
- Deployment triggers

**Shared project context already loaded via root CLAUDE.md:**
- Architecture, workflows, status, todos, deployment

**This file contains CI/CD-specific patterns and conventions.**

---

## Workflows Overview

```
.github/workflows/
└── gist-deploy-trigger.yml     # Hourly auto-deploy on gist updates
```

---

## gist-deploy-trigger.yml

**Purpose:** Automatically deploy to Vercel when resume gist is updated

**Trigger Schedule:**
- **Cron**: Every hour at minute 0 (`0 * * * *`)
- **Manual**: Can be triggered from GitHub Actions UI (`workflow_dispatch`)

**Why Hourly:**
- Balance between responsiveness and API rate limits
- Gist updates are infrequent (manual edits only)
- Reduces unnecessary Vercel builds
- GitHub Actions has generous free tier for this frequency

---

## Workflow Steps Breakdown

### Step 1: Fetch Gist Metadata

```yaml
- name: Fetch gist metadata
  run: |
    GIST_ID="${{ secrets.RESUME_DATA_GIST_ID }}"
    # Use grep instead of jq to handle control characters in gist content
    UPDATED_AT=$(curl -s -H "Accept: application/vnd.github.v3+json" \
      "https://api.github.com/gists/${GIST_ID}" | \
      grep -o '"updated_at":"[^"]*"' | \
      cut -d'"' -f4)
    echo "updated_at=$UPDATED_AT" >> $GITHUB_OUTPUT
```

**What it does:**
- Fetches gist metadata from GitHub API
- Extracts `updated_at` timestamp (ISO 8601 format)
- Passes to next steps via `GITHUB_OUTPUT`

**API Endpoint:** `https://api.github.com/gists/{gist_id}`

**No authentication needed:** Public gist, read-only access

---

### Step 2: Validate Gist with Schema

```yaml
- name: Validate gist with schema
  run: |
    GIST_ID="${{ secrets.RESUME_DATA_GIST_ID }}"
    USERNAME="${{ github.repository_owner }}"
    GIST_URL="https://gist.githubusercontent.com/${USERNAME}/${GIST_ID}/raw/resume-data.json"
    curl -s "$GIST_URL" -o /tmp/gist-data.json

    # Validate JSON syntax first
    if ! jq empty /tmp/gist-data.json 2>/dev/null; then
      echo "❌ JSON syntax is invalid!"
      echo "valid=false" >> $GITHUB_OUTPUT
      exit 0
    fi

    # Validate against schema
    if bun scripts/validate-compendium.mjs /tmp/gist-data.json; then
      echo "✅ Schema validation passed"
      echo "valid=true" >> $GITHUB_OUTPUT
    else
      echo "❌ Schema validation failed!"
      echo "valid=false" >> $GITHUB_OUTPUT
    fi
```

**What it does:**
- Fetches raw gist content to temp file
- Validates JSON syntax with `jq empty`
- **Validates against full schema** using `validate-compendium.mjs`
- Sets `valid` output flag with detailed error messages
- **Fail-fast**: Prevents deployment if data doesn't match schema

**Why validate here:**
- Prevents Vercel build failures from invalid data
- Catches schema violations early (not just JSON syntax)
- Provides clear error in GitHub Actions UI
- Saves Vercel build minutes
- Same validation as local `just data-validate`

**Dependencies:**
- Requires repository checkout (`actions/checkout@v4`)
- Requires bun setup (`oven-sh/setup-bun@v2`)
- Requires dependencies installed (`bun install --frozen-lockfile`)

**Error Handling:**
- Invalid JSON syntax → Skip deploy, fail workflow with syntax error
- Schema validation failure → Skip deploy, fail workflow with detailed schema errors
- Network error → Workflow fails (retry on next hourly run)

**Example Errors Caught:**
- Missing required fields (e.g., `personal.name`)
- Invalid priority values (outside 1-10 range)
- Malformed date formats (not YYYY or YYYY-MM)
- Empty or invalid tag arrays
- Type mismatches (string vs number)

---

### Step 3: Get Last Vercel Deployment Time

```yaml
- name: Get last Vercel deployment time
  if: steps.validate.outputs.valid == 'true'
  run: |
    VERCEL_RESPONSE=$(curl -s -H "Authorization: Bearer ${{ secrets.VERCEL_TOKEN }}" \
      "https://api.vercel.com/v6/deployments?projectId=${{ secrets.VERCEL_PROJECT_ID }}&limit=1&state=READY")

    LAST_DEPLOY=$(echo "$VERCEL_RESPONSE" | jq -r '.deployments[0].created')
    LAST_DEPLOY_ISO=$(date -u -d @$((LAST_DEPLOY / 1000)) +"%Y-%m-%dT%H:%M:%SZ")
    echo "last_deploy=$LAST_DEPLOY_ISO" >> $GITHUB_OUTPUT
```

**What it does:**
- Queries Vercel API for last successful deployment
- Converts millisecond timestamp to ISO 8601
- Handles case where no deployment exists (first deploy)

**API Endpoint:** `https://api.vercel.com/v6/deployments`

**Required Secrets:**
- `VERCEL_TOKEN` - API token from https://vercel.com/account/tokens
- `VERCEL_PROJECT_ID` - From `vercel project inspect`

**Permissions:** Read-only access to deployments list

---

### Step 4: Check if Gist Changed

```yaml
- name: Check if gist changed since last deploy
  run: |
    GIST_UPDATE="${{ steps.gist.outputs.updated_at }}"
    LAST_DEPLOY="${{ steps.vercel.outputs.last_deploy }}"

    if [ "$LAST_DEPLOY" = "0" ] || [[ "$GIST_UPDATE" > "$LAST_DEPLOY" ]]; then
      echo "changed=true" >> $GITHUB_OUTPUT
    else
      echo "changed=false" >> $GITHUB_OUTPUT
    fi
```

**What it does:**
- Compares gist `updated_at` vs Vercel `last_deploy` timestamps
- String comparison (ISO 8601 strings are lexicographically sortable)
- Sets `changed` flag for next step

**Logic:**
- `LAST_DEPLOY = "0"` → First deploy, always trigger
- `GIST_UPDATE > LAST_DEPLOY` → Gist updated since last deploy, trigger
- Otherwise → No changes, skip deploy

**Edge Cases:**
- First deployment: `LAST_DEPLOY` set to "0", always triggers
- Same-minute updates: ISO 8601 includes seconds, handles this
- Clock skew: GitHub/Vercel both use UTC, no issue

---

### Step 5: Trigger Vercel Deployment

```yaml
- name: Trigger Vercel deployment
  if: steps.check.outputs.changed == 'true'
  run: |
    HTTP_STATUS=$(curl -X POST "${{ secrets.VERCEL_DEPLOY_HOOK_URL }}" \
      -o /dev/null -w "%{http_code}" -s)

    if [ "$HTTP_STATUS" -eq 201 ] || [ "$HTTP_STATUS" -eq 200 ]; then
      echo "✅ Deploy triggered successfully"
    else
      echo "❌ Deploy trigger failed (HTTP $HTTP_STATUS)"
      exit 1
    fi
```

**What it does:**
- Sends POST request to Vercel deploy hook
- Checks HTTP status code
- Exits with error if deploy fails

**Required Secret:**
- `VERCEL_DEPLOY_HOOK_URL` - From Vercel project settings

**Success Codes:**
- `201 Created` - Deploy queued successfully
- `200 OK` - Also acceptable

**Vercel Deploy Hook:**
- Created in Vercel dashboard: Settings → Git → Deploy Hooks
- Each POST triggers a new production deployment
- Deployment fetches latest gist via `prebuild` hook

---

### Step 6: Notify on Validation Failure

```yaml
- name: Notify on validation failure
  if: steps.validate.outputs.valid == 'false'
  run: |
    echo "::error title=Invalid Resume Data in Gist::Resume data gist failed validation and deploy was skipped."
    echo ""
    echo "Validation errors:"
    echo "${{ steps.validate.outputs.error_msg }}"
    echo ""
    echo "Please fix the gist data and it will be automatically deployed on the next hourly check."
    exit 1
```

**What it does:**
- Creates GitHub Actions error annotation with detailed error message
- Shows full validation errors from schema validator
- Visible in workflow run UI
- Fails workflow to prevent silent failures

**Error Format:**
```
::error title={title}::{message}
```

**Error Details Include:**
- JSON syntax errors (if applicable)
- Schema validation errors (field names, expected types, constraint violations)
- Guidance on next steps (fix gist, automatic retry)

**Why fail the workflow:**
- Alerts user to problem immediately
- Prevents silent data corruption
- Easy to spot in GitHub Actions UI
- Provides actionable error messages for debugging

---

## Required GitHub Secrets

Set these in GitHub repository settings: Settings → Secrets and variables → Actions

| Secret | Description | How to get |
|--------|-------------|------------|
| `RESUME_DATA_GIST_ID` | Gist ID (hash only, not full URL) | From your gist URL: `https://gist.github.com/user/{THIS_PART}` |
| `VERCEL_TOKEN` | Vercel API token | https://vercel.com/account/tokens |
| `VERCEL_PROJECT_ID` | Project identifier | `vercel project inspect` |
| `VERCEL_DEPLOY_HOOK_URL` | Deploy trigger webhook | Vercel dashboard → Settings → Git → Deploy Hooks |

**Note:** GitHub username is automatically extracted from `github.repository_owner` context variable.

**Security Notes:**
- `VERCEL_TOKEN` has read-only deployment access (scoped to project)
- `VERCEL_DEPLOY_HOOK_URL` can only trigger deploys, not read data
- GitHub Actions secrets encrypted at rest
- Secrets not exposed in workflow logs

---

## How Deployments Work

### Deployment Flow

```
Hourly Cron (GitHub Actions)
  ↓
Fetch gist metadata (GitHub API)
  ↓
Validate JSON format (jq)
  ↓
Get last Vercel deployment (Vercel API)
  ↓
Compare timestamps
  ↓
Gist newer? → Trigger Vercel deploy hook
  ↓
Vercel Build Process:
  1. prebuild: Fetch gist data (--force)
  2. Build Next.js app
  3. Deploy to production
```

### Key Points

**No git commits required:**
- Timestamps tracked via APIs, not repo state
- Gist updates don't create commits in this repo
- Clean separation: resume data vs application code

**Prebuild always fetches gist:**
```json
{
  "scripts": {
    "prebuild": "node scripts/fetch-gist-data.js --force"
  }
}
```
- Ensures production always has latest data
- `--force` flag skips prompts (non-interactive)
- Build fails if gist unreachable or invalid

**Gist filename must be `resume-data.json`:**
- Hardcoded in workflow and scripts
- Generic name (works for any user fork)

---

## Testing the Workflow

### Manual Trigger

1. Go to GitHub → Actions tab
2. Select "Gist Update Deploy Trigger"
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow" button

**Use Cases:**
- Testing workflow changes
- Force deploy without waiting for cron
- Debugging deployment issues

### Testing Locally

**Simulate gist fetch:**
```bash
just data-pull -- --force
```

**Validate JSON:**
```bash
jq empty data/resume-data.json
```

**Test build:**
```bash
just build
```

---

## Monitoring & Debugging

### Where to Check Status

**GitHub Actions:**
- Repository → Actions tab
- See all workflow runs (success/failure)
- Click run for detailed logs

**Vercel Deployments:**
- Vercel dashboard → Deployments tab
- See build logs, deploy status
- Click deployment for full details

### Common Issues

**Issue: Workflow runs but doesn't deploy**
- **Cause**: Gist `updated_at` hasn't changed since last deploy
- **Solution**: This is expected behavior, no action needed

**Issue: "Invalid JSON" error**
- **Cause**: Syntax error in gist (missing comma, bracket, etc.)
- **Solution**: Edit gist, fix JSON, wait for next hourly run or trigger manually

**Issue: "Deploy trigger failed (HTTP 500)"**
- **Cause**: Vercel API issue or deploy hook URL incorrect
- **Solution**: Check `VERCEL_DEPLOY_HOOK_URL` secret, try manual trigger

**Issue: Build succeeds but old data shown**
- **Cause**: Prebuild didn't fetch latest gist
- **Solution**: Check Vercel build logs, verify `RESUME_DATA_GIST_URL` env var

---

## Performance & Cost

### GitHub Actions Usage

**Free Tier:**
- 2,000 minutes/month for private repos
- Unlimited for public repos

**This Workflow:**
- ~1-2 minutes per run (mostly API calls)
- 24 runs/day × 30 days = 720 runs/month
- ~720-1440 minutes/month (well within free tier)

**Optimization:**
- Early exit if JSON invalid (saves Vercel build minutes)
- Only triggers deploy if gist changed (prevents unnecessary builds)

### Vercel Deployments

**Free Tier (Hobby):**
- 100 GB-hours/month build time
- 100 deployments/day

**This Workflow:**
- ~1-2 builds/day (only when gist updated)
- Each build: ~2-3 minutes
- Well within free tier limits

---

## Future Enhancements

**Potential Improvements:**

1. **Slack/Discord Notifications:**
   ```yaml
   - name: Notify on deploy
     run: |
       curl -X POST "${{ secrets.SLACK_WEBHOOK }}" \
         -d '{"text": "Resume deployed! Gist updated at ${{ steps.gist.outputs.updated_at }}"}'
   ```

2. **Schema Validation:**
   ```yaml
   - name: Validate against schema
     run: |
       bun install --frozen-lockfile
       just data-validate
   ```

3. **Diff Detection:**
   - Store hash of last deployed data
   - Only deploy if content changed (not just timestamp)

4. **Multiple Environments:**
   - Separate workflows for staging/production
   - Different gists for different environments

---

## Notes for AI Assistants

**When modifying workflows:**
1. Test with `workflow_dispatch` (manual trigger) first
2. Check GitHub Actions logs for each step
3. Verify secrets are set correctly
4. Test failure cases (invalid JSON, network errors)

**Common tasks:**
- Add new workflow → Create YAML in `.github/workflows/`
- Test workflow → Use workflow_dispatch trigger
- Debug workflow → Check Actions tab logs
- Update secrets → Repository settings → Secrets

**For hybrid work (workflows + app):**
- Workflows are bash/curl, not Node.js or Next.js
- Use GitHub API, Vercel API, curl for external calls
- Environment: Ubuntu latest, pre-installed tools (jq, curl, git)
- Secrets accessible via `${{ secrets.SECRET_NAME }}`
