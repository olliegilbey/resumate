---
last_updated: 2025-11-03
category: Workflow Guide
update_frequency: When workflow changes
---

# Linear Project Management Workflow

> **📍 Purpose:** How to use Linear for task tracking with AI agents.
> Replaces markdown-based TODOS.md system (migrated 2025-11-03).

---

## Core Principles

### 1. Issue-Driven Sessions
Each AI session focuses on ONE Linear issue. Agent asks at start: "Which Linear issue?"

### 2. Ephemeral TodoWrite
TodoWrite tool used ONLY for current issue breakdown. Cleared between sessions.

### 3. 4-Hour Rule
Issues kept <4 hours to fit AI context window (~100k tokens). Break larger work into child issues.

### 4. Linear Hierarchy
```
Project (Resumate)
  ↓
Milestones (Phase 5.9, Phase 5.8, Phase 6, etc.)
  ↓
Issues (<4 hours each)
  ↓
Child Issues (if needed)
  ↓
TodoWrite (ephemeral, session-only)
```

---

## AI Agent Session Pattern

### Session Start
1. **Agent asks:** "Which Linear issue should I work on?"
2. **User provides:** Issue ID (e.g., "OLL-26" or "work on the PDF tests")
3. **Agent fetches:**
   ```
   mcp__linear__get_issue with id="OLL-26"
   ```
4. **Agent creates TodoWrite** with issue-specific breakdown
5. **Agent reads context:**
   - `docs/CURRENT_PHASE.md` - Phase status
   - Component `CLAUDE.md` - Tech-specific context
   - Issue description + comments from Linear

### During Work
- Update TodoWrite as tasks complete (mark items done immediately)
- Update Linear issue:
  - Add comments for progress/blockers
  - Change status (Backlog → In Progress → Done)
  - Link related issues/PRs
- Run tests frequently: `just test`
- Commit at logical checkpoints

### Session End
- Final Linear update:
  - Status change if complete
  - Summary comment if partial
  - Next steps if blocked
- Clear TodoWrite (next session starts fresh)
- Commit all changes

---

## Linear MCP Tools

### Issue Management
```bash
# Fetch issue details
mcp__linear__get_issue with id="OLL-26"

# List issues (filter by project, status, assignee, etc.)
mcp__linear__list_issues with project="Resumate" state="Backlog"

# Create new issue
mcp__linear__create_issue with
  title="Fix WASM loading"
  team="ollie"
  project="Resumate"
  labels=["wasm", "Bug"]
  priority=1

# Update issue
mcp__linear__update_issue with
  id="OLL-26"
  state="Done"

# Add comment
mcp__linear__create_comment with
  issueId="OLL-26"
  body="Completed PDF extraction tests. All 15 tests passing."
```

### Project Structure
```bash
# Get project details
mcp__linear__get_project with query="Resumate"

# List team info
mcp__linear__get_team with query="ollie"

# List labels
mcp__linear__list_issue_labels with team="ollie"

# List statuses
mcp__linear__list_issue_statuses with team="ollie"
```

---

## Issue Sizing Guidelines

### <2 Hours (Ideal)
- Single feature component
- Specific bug fix
- Documentation update
- Simple refactor

**Example:** "Add loading spinner to PDF generation button"

### 2-4 Hours (Good)
- Multi-file feature
- Complex bug investigation
- Test suite addition
- Integration work

**Example:** "Implement PostHog event tracking for resume generation"

### >4 Hours (Split into children)
- Large features
- Multiple integrations
- Complex refactors
- End-to-end flows

**Solution:** Create parent issue, add child issues with specific scopes

**Example:**
- Parent: "Add E2E tests with Playwright" (10h estimate)
- Child 1: "Set up Playwright infrastructure" (2h)
- Child 2: "Add CAPTCHA tests" (3h)
- Child 3: "Add error handling tests" (2h)
- Child 4: "Add role profile tests" (3h)

---

## Milestone Organization

Use milestones to group phase-related work:

- **Critical Path - Immediate**: Blockers and urgent fixes
- **Phase 5.9 - Testing & Polish**: Current phase work
- **Phase 5.8 - Observability**: PostHog + N8N integration
- **Phase 6 - Claude API Integration**: Future phase
- **Documentation & Maintenance**: Meta work

Milestones created manually in Linear UI (not available via MCP yet).

---

## Labels & Priority

### Labels by Category
- **Tech:** `rust`, `typescript`, `wasm`, `deployment`
- **Domain:** `analytics`, `testing`
- **Type:** `Bug`, `Feature`, `Improvement`

### Priority Mapping
- **1 (Urgent)**: Blockers, critical bugs, immediate needs
- **2 (High)**: Current phase work, important features
- **3 (Medium)**: Nice-to-have, polish, documentation
- **4 (Low)**: Future work, backlog items

---

## Common Workflows

### Starting New Work
```bash
# 1. Check what's available
mcp__linear__list_issues with project="Resumate" state="Backlog" priority=1

# 2. Pick an issue
"I'll work on OLL-26"

# 3. Fetch details
mcp__linear__get_issue with id="OLL-26"

# 4. Update status
mcp__linear__update_issue with id="OLL-26" state="In Progress"

# 5. Create TodoWrite for breakdown
TodoWrite with issue-specific tasks
```

### Completing Work
```bash
# 1. Run tests
just test

# 2. Commit changes
git add . && git commit -m "feat: add PDF text extraction tests"

# 3. Update Linear
mcp__linear__update_issue with id="OLL-26" state="Done"

# 4. Add completion comment
mcp__linear__create_comment with
  issueId="OLL-26"
  body="✅ Complete. Added 15 PDF extraction tests. All passing. Coverage: 92%."
```

### Blocked Work
```bash
# 1. Add comment explaining blocker
mcp__linear__create_comment with
  issueId="OLL-29"
  body="⚠️ Blocked: Need PostHog API key from user before continuing."

# 2. Keep status as "In Progress" (or move to "Blocked" if available)

# 3. Work on different issue while waiting
```

---

## Differences from TODOS.md

| Aspect | Old (TODOS.md) | New (Linear) |
|--------|----------------|--------------|
| **Storage** | Markdown file | Cloud (Linear) |
| **Persistence** | Git history | Always accessible |
| **Cross-session** | Shared state | Issue-driven, clean slate |
| **Organization** | Flat list | Hierarchical (milestones, issues, children) |
| **Collaboration** | Single file | Multi-user, comments, assignments |
| **AI context** | Must read full file | Fetch specific issue only |
| **Timestamps** | Manual ISO dates | Automatic tracking |
| **Status** | Text markers | Workflow states |

---

## Best Practices

### ✅ DO
- Ask "Which issue?" at session start
- Fetch issue details via MCP
- Update issue status in real-time
- Add comments for progress/blockers
- Keep issues <4 hours
- Break large work into children
- Clear TodoWrite between sessions
- Commit frequently

### ❌ DON'T
- Work without Linear issue
- Carry TodoWrite across sessions
- Create issues >4 hours without breaking down
- Update docs without updating Linear
- Skip status changes
- Forget to add completion comments
- Work on multiple issues simultaneously

---

## Migration Notes (2025-11-03)

### What Changed
- Task tracking moved from `docs/TODOS.md` to Linear
- `scripts/archive-todos.sh` no longer needed
- All historical tasks preserved in git history
- 9 initial issues created (OLL-26 through OLL-35)
- 7 child issues created for complex work (OLL-69 through OLL-75)

### What Stayed Same
- TodoWrite tool still used (but ephemeral)
- Same workflow principles
- Documentation system intact
- Testing strategy unchanged

### Files Removed
- `docs/TODOS.md` - Replaced by Linear issues
- `scripts/archive-todos.sh` - No longer applicable

### Files Updated
- `.claude/CLAUDE.md` - Updated workflow section
- `docs/CURRENT_PHASE.md` - Points to Linear
- `docs/META_DOCUMENTATION.md` - Removed TODOS.md references
- `app/CLAUDE.md`, `scripts/CLAUDE.md` - Added Linear references
- `README.md` - Added Linear to docs list

---

## Related Documentation

- [.claude/CLAUDE.md](../.claude/CLAUDE.md) - Project router
- [CURRENT_PHASE.md](./CURRENT_PHASE.md) - Active phase
- [META_DOCUMENTATION.md](./META_DOCUMENTATION.md) - Doc system
- Linear project - https://linear.app/olliegg/project/resumate-66ec0bda8b63

---

**Last Updated:** 2025-11-03
**Next Review:** When workflow or tooling changes
