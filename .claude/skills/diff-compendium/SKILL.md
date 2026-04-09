---
name: diff-compendium
description: Review and diff changes to the resume compendium JSON data. Use when updating, reviewing, or validating changes to resume-data.json before pushing to the gist.
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash(just *) Bash(python3 *) Bash(echo *) Bash(stat *) Bash(source *) Bash(gh api *) Bash(node *) Bash(ls *) Read Grep Glob AskUserQuestion
---

# Diff Compendium

You are reviewing changes to the resume compendium (`data/resume-data.json`). This file is PII — it is gitignored and stored as a private GitHub Gist. It must NEVER be committed to git. The staging file `data/resume-data-new.json` is also gitignored.

## Step 1: Ensure local data is fresh

Check whether the gist has been updated more recently than the local file. Compare the gist's `updated_at` timestamp against the local file's modification time.

```bash
# Get gist last-updated timestamp
source .env.local 2>/dev/null
GIST_ID=$(echo $RESUME_DATA_GIST_URL | grep -oE '[a-f0-9]{32}')
gh api "gists/$GIST_ID" --jq '.updated_at'
```

```bash
# Get local file modification time
stat -f "%Sm" data/resume-data.json
```

If the gist is newer than the local file, pull the latest before proceeding:

```bash
echo "y" | just data-pull
```

If the local file is newer or the same, skip the pull and continue.

## Step 2: Check for the candidate file

The candidate file must be at `data/resume-data-new.json`. Check if it exists and is non-empty:

```bash
ls -la data/resume-data-new.json
```

If the file is missing or empty, prompt the user:

> The candidate file `data/resume-data-new.json` is missing or empty. Please paste your updated compendium JSON into that file, then re-run `/diff-compendium`.

Stop here if the file is not ready. Do not proceed without a populated candidate file.

## Step 3: Validate the candidate

Run schema validation on the candidate file to catch structural errors before diffing:

```bash
node scripts/validate-compendium.mjs data/resume-data-new.json
```

If validation fails, report the errors clearly and stop. The user needs to fix them before reviewing.

## Step 4: Run the structural diff

```bash
python3 scripts/diff-compendium.py data/resume-data.json data/resume-data-new.json
```

This script produces a structured report covering:
- **Stats**: counts of experience entries, bullets, accomplishments, role profiles
- **Personal**: email, name, location changes
- **Summary & Tagline**: full-text changes
- **Skills**: added/removed per category (technical, soft)
- **Education**: coursework changes per degree
- **Accomplishments**: added/removed/modified/reordered
- **Role Profiles**: added/removed/modified (including tagWeight changes)
- **Experience**: new/removed companies, position changes, bullet adds/removes/modifications

## Step 5: Present the review

After running the diff, present a summary to the user organised by section. For each section with changes, highlight:

1. **What changed** — concise description
2. **Flags** — anything that looks like it could be an error or unintentional:
   - Fields that went from populated to empty/null
   - Significant priority drops (more than 2 points)
   - Removed content that seems important
   - Potential typos or inconsistencies
   - ID collisions or duplicate IDs
   - Tags that exist on bullets but don't appear in any role profile's tagWeights
   - Email or personal info changes (verify intentional)

End with a list of questions for the user about anything that looks ambiguous.

## Step 6: After user approval

Once the user is satisfied with the diff, tell them the next steps:

1. Copy the candidate over the current file: `cp data/resume-data-new.json data/resume-data.json`
2. Validate again: `just data-validate`
3. Test locally: `just dev` (verify the site renders correctly)
4. Push to gist: `just data-push`
5. Clean up: `rm data/resume-data-new.json`

Do NOT execute these steps automatically — the user drives this process.

## Important guidelines

- **NEVER commit data files to git.** `data/resume-data.json` and `data/resume-data-new.json` are private.
- **Do not modify the candidate file.** This is a review process, not an editing process. If changes are needed, tell the user what to fix.
- **Be thorough but concise.** The user needs to understand every change, but doesn't need the raw diff repeated verbatim.
- **Flag orphaned tags.** If a bullet uses tags that no role profile weights, that bullet will never score well. Point this out.
- **Check ID uniqueness.** Every ID across the entire compendium must be unique.
