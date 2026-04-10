---
name: diff-compendium
description: Review and diff changes to the resume compendium JSON data. Use when updating, reviewing, or validating changes to resume-data.json before pushing to the gist.
user-invocable: true
allowed-tools: Bash(just *) Bash(python3 *) Bash(echo *) Bash(stat *) Bash(source *) Bash(gh api *) Bash(node *) Bash(ls *) Bash(jq *) Bash(diff *) Bash(cp *) Bash(rm *) Read Grep Glob AskUserQuestion
---

# Diff Compendium

Review changes to the resume compendium (`data/resume-data.json`). Both `data/resume-data.json` and `data/resume-data-new.json` are PII, gitignored, and stored as a private GitHub Gist. NEVER commit them to git.

## Step 1: Ensure local data is fresh

Compare the gist's `updated_at` timestamp against the local file's modification time.

```bash
source .env.local 2>/dev/null
GIST_ID=$(echo $RESUME_DATA_GIST_URL | grep -oE '[a-f0-9]{32}')
gh api "gists/$GIST_ID" --jq '.updated_at'
```

```bash
stat -f "%Sm" data/resume-data.json
```

If the gist is newer, pull before proceeding:

```bash
echo "y" | just data-pull
```

If local is newer or the same, skip the pull.

## Step 2: Check for the candidate file

```bash
ls -la data/resume-data-new.json
```

If missing or empty, stop and tell the user:

> The candidate file `data/resume-data-new.json` is missing or empty. Place your updated compendium JSON there, then re-run `/diff-compendium`.

## Step 3: Validate the candidate

```bash
node scripts/validate-compendium.mjs data/resume-data-new.json
```

If validation fails, report errors and stop.

## Step 4: Normalize formatting

Before diffing, normalize both files through `jq` so whitespace/formatting differences don't pollute results. Write to temp files — never overwrite the originals.

```bash
jq --sort-keys . data/resume-data.json > /tmp/resumate-old-fmt.json
jq --sort-keys . data/resume-data-new.json > /tmp/resumate-new-fmt.json
```

## Step 5: Run the structural diff

```bash
python3 scripts/diff-compendium.py /tmp/resumate-old-fmt.json /tmp/resumate-new-fmt.json
```

This produces a structured report covering: stats, personal, summary, tagline, skills, education, accomplishments, role profiles, and experience (companies → positions → bullets).

## Step 6: Visual diff

Offer the user a colored line-level diff via `delta` for a magit/VS Code-like review experience. Run it so the output appears in their terminal:

```bash
diff -u /tmp/resumate-old-fmt.json /tmp/resumate-new-fmt.json | delta
```

Note: this output is large for JSON files. If the user only wants a specific section, use `jq` to extract that section from both temp files first, then diff those.

## Step 7: Present the review

Summarise the structural diff by section. For each section with changes:

1. **What changed** — concise description
2. **Flags** — anything that could be an error or unintentional:
   - Fields that went from populated to empty/null
   - Priority drops > 2 points
   - Removed content that seems important
   - Potential typos or inconsistencies
   - ID collisions or duplicate IDs
   - Orphaned tags (tags on bullets that no role profile weights — these bullets will never score well)
   - Personal info changes (email, name — verify intentional)

End with questions about anything ambiguous.

## Step 8: After user approval

Once the user is satisfied, present these steps and **ask before executing any of them**:

1. `cp data/resume-data-new.json data/resume-data.json`
2. `just data-validate`
3. User tests locally: `just dev`
4. `just data-push`
5. `rm data/resume-data-new.json`

The push script validates against the schema before uploading. After push, the hourly GitHub Action (`gist-deploy-trigger.yml`) validates the gist again and triggers a Vercel deploy if the gist is newer than the last deployment.

## Guidelines

- **NEVER commit data files to git.**
- **Do not modify the candidate file.** This is review, not editing. Tell the user what to fix.
- **Clean up temp files** (`/tmp/resumate-*-fmt.json`) when done.
