# Resumate - AI-Assisted Resume Curation System

## Project Overview

**Resumate** is an intelligent resume system that curates experience based on role types. This framework can be used as a personal portfolio site and will eventually be fully open-sourced.

## Meta-Project Philosophy

This project is a **meta-resume**: it demonstrates technical capabilities through its own creation. Key principles:

1. **Human-authored, AI-curated**: All bullet text written by you, AI only selects what's relevant
2. **Rust/WASM showcase**: Demonstrates systems programming, WebAssembly, performance optimization
3. **Agentic coding**: You oversee architecture, AI assists implementation (Anthropic hiring guideline compliant)
4. **Growth engineering**: Analytics-driven, iterated based on recruiter behavior data
5. **Fast & light**: Sub-5s generation time, no heavy servers, client-side compilation

## Phase 1 MVP - Complete ✅

Building a beautiful data explorer that shows all resume experience in a filterable, searchable interface, plus a simple download button for a static PDF resume.

### Tech Stack
- **Framework**: Next.js 15.5.4 (Turbopack) with App Router (TypeScript)
- **Styling**: Tailwind CSS v4
- **Deployment**: Vercel
- **Security**: Cloudflare Turnstile CAPTCHA
- **Design**: Clean, modern, inspired by Linear/Notion aesthetics
- **Color Palette**: Tailwind's slate/blue tones (Phase 2: liquid glass dark mode)

### Project Structure
```
resumate/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Landing page
│   ├── api/
│   │   └── contact-card/
│   │       └── route.ts            # vCard generation API
│   ├── resume/
│   │   ├── page.tsx                # Resume overview
│   │   └── view/
│   │       └── page.tsx            # Data explorer (MAIN FOCUS)
│   └── globals.css
├── components/
│   ├── data/
│   │   ├── DataExplorer.tsx        # Main component
│   │   ├── CompanySection.tsx      # Grouped by company
│   │   ├── BulletCard.tsx          # Individual bullet display
│   │   ├── TagFilter.tsx           # Multi-select tag filter
│   │   └── SearchBar.tsx           # Search functionality
│   └── ui/
│       ├── Badge.tsx               # For tags
│       ├── Button.tsx              # Reusable button
│       └── ContactLinks.tsx        # Contact download
├── scripts/
│   ├── fetch-gist-data.js          # Pull gist → local (prebuild)
│   ├── gist-push.js                # Push local → gist
│   └── gist-view.js                # View gist content
├── lib/
│   ├── utils.ts                    # Utilities
│   └── vcard.ts                    # vCard 3.0 generation
├── types/
│   └── resume.ts                   # TypeScript types
├── data/
│   ├── resume-data.json            # Your data (gitignored)
│   └── resume-data-template.json   # Template
├── .github/
│   └── workflows/
│       └── gist-deploy-trigger.yml # Hourly auto-deploy
├── middleware.ts                   # Security & rate limiting
└── .env.local                      # Secrets (gitignored)
```

## Key Features (Phase 1)
- **Data Explorer**: Beautiful, filterable view of all experience bullets
- **Search**: Filter bullets by text search (case-insensitive)
- **Tag Filter**: Multi-select checkboxes for tags
- **Company Grouping**: Group bullets by company with timeline
- **Priority Indicator**: Visual ranking of bullet importance
- **Metrics Highlight**: Emphasize quantifiable achievements
- **Responsive Design**: Mobile-first approach
- **vCard Download**: Cloudflare Turnstile-protected contact card

## Commands to Run

### Development
```bash
npm run dev        # Start development server with Turbopack
npm run build      # Build for production (auto-fetches gist via prebuild)
npm run lint       # Run ESLint
npm run start      # Start production server
npx prettier --write <file>  # Format code (use for CSS, TypeScript, JSON)
```

### Data Management (Gist Integration)
```bash
npm run data:pull  # Fetch latest from GitHub Gist → local
npm run data:push  # Push local changes → Gist
npm run data:view  # View gist content in terminal
```

### Deployment
```bash
vercel --prod      # Deploy to Vercel production
```

## Design System

### Colors (Tailwind)
- Primary: blue-600
- Background: slate-50
- Cards: white with slate-200 borders
- Text: slate-900 (headings), slate-600 (body)
- Tags: Various pastels (blue-100, green-100, purple-100, etc.)

### Typography
- Headings: font-semibold, tracking-tight
- Body: font-normal, leading-relaxed
- Bullet text: text-base, leading-7
- Meta info: text-sm, text-slate-500

## Data Structure

Resume data is stored in `data/resume-data.json` with the following structure:

- **Personal Info**: Contact details, links
- **Summary**: Brief professional summary
- **Bullets**: Array of experience bullets with:
  - Company, role, date range
  - Bullet text
  - Tags (product-management, developer-relations, etc.)
  - Priority (1-10)
  - Metrics (extracted numbers for emphasis)
  - Context (additional detail for future AI use)
- **Skills**: Technical and soft skills
- **Education**: Degree information

## Code Quality Tools

### CodeRabbit CLI

This project uses [CodeRabbit](https://coderabbit.ai) for AI-powered code reviews. Claude Code and Warp should run this extensively when making changes.

**Installation**:
```bash
npm install -g @coderabbit/cli
coderabbit auth
```

**Commands**:
```bash
# Review uncommitted changes with context from CLAUDE.md
coderabbit review --plain --type uncommitted --config CLAUDE.md

# Review all files
coderabbit review --plain --type all

# Review committed changes
coderabbit review --plain --type committed --config CLAUDE.md

# Check specific files
coderabbit review --plain --type uncommitted --files "app/**/*.tsx"
```

**When to run**:
- ✅ Before committing (check for issues, security vulnerabilities)
- ✅ After major refactors (verify quality, catch regressions)
- ✅ When stuck or debugging (get AI suggestions)
- ✅ Regular check-ins (maintain code health, spot patterns)
- ✅ Before opening PRs (ensure review-ready code)

**Why use it**:
- Catches security issues, race conditions, accessibility problems
- Suggests performance improvements
- Identifies code smells and anti-patterns
- Provides context-aware suggestions (uses CLAUDE.md for project understanding)
- Faster than manual review, more thorough than linters

**Integration**:
Both Claude Code and Warp editors should invoke CodeRabbit:
- When making significant changes
- Before marking tasks as complete
- When quality concerns arise
- As part of the development workflow

## Current Status (Phase 1 Enhanced - Production Ready)

✅ **PHASE 1 MVP IS COMPLETE AND PRODUCTION-READY**

All core Phase 1 features have been implemented with security hardening:

### Core Features
- ✅ Landing page with hero section and contact links
- ✅ **vCard Contact Download** with Cloudflare Turnstile protection
  - Server-side vCard generation (contact info never exposed to client)
  - Auto-download functionality (works in Arc & Chrome)
  - Multiple email support (personal + professional)
  - One-time token validation with replay attack prevention
- ✅ Resume overview page
- ✅ Full data explorer at `/resume/view` with:
  - ✅ Search functionality (text-based filtering)
  - ✅ Tag filtering (AND logic - requires all selected tags)
  - ✅ Company grouping with timeline
  - ✅ Priority indicators (star rating)
  - ✅ Metrics highlighting
  - ✅ Responsive design
  - ✅ Clean slate/blue aesthetic
  - ✅ Hierarchical data structure (Company → Position → Bullets)

### Security Features
- ✅ **Contact Info Protection**
  - Phone and email removed from client-side bundle
  - Server-side environment variables for sensitive data
  - Turnstile CAPTCHA before vCard download
- ✅ **Middleware Security**
  - Bot detection with allowlist for legitimate crawlers
  - Rate limiting (30 req/min, 100 req/min for Googlebot)
  - Security headers (CSP, X-Frame-Options, X-Content-Type-Options)
  - IP-based rate limiting with spoofing mitigation notes
- ✅ **vCard Generation**
  - Full vCard 3.0 spec compliance
  - Special character escaping (backslash, semicolon, comma, newlines)
  - LinkedIn/GitHub URL sanitization
  - Unicode-safe encoding

### Code Quality
- ✅ Build: Zero errors, zero warnings
- ✅ TypeScript: Full type safety throughout
- ✅ Security audit: No secrets in build output
- ✅ Accessibility: ARIA labels on icon-only links
- ✅ Error handling: Null safety for data properties
- ✅ Race condition prevention: Auto-download timer management

### To Test
```bash
npm run dev  # Visit http://localhost:3000
```

**Key Routes:**
- `/` - Landing page with hero and preview
- `/resume` - Resume download page (explains Resumate concept)
- `/resume/view` - **Main data explorer** (the core MVP feature)

### Ready for Deployment
The application is production-ready and can be deployed to Vercel immediately.

### Known Considerations
1. **Date format** - TEMPLATE_GUIDE.md shows both abbreviated and full month names for flexibility
2. **Rate limiting** - In-memory implementation; consider Redis for multi-instance deployments
3. **IP detection** - Currently logs warning for missing IP; acceptable for single-instance Vercel

### Future Enhancements
1. **Add static PDF** - Generate/add `public/resume.pdf` (optional static version)
2. **Tighten CSP** - Consider using nonces instead of 'unsafe-inline'/'unsafe-eval'
3. **Add animations** - Consider framer-motion for smooth transitions
4. **JSON Schema validation** - Add formal schema for resume-data.json
5. **Deploy to Vercel** - Connect to your custom domain

### Architecture Notes for Future Development
- **Clean separation**: UI components in `/components/ui`, data components in `/components/data`
- **Type safety**: All data strongly typed in `types/resume.ts`
- **Server components**: Used where possible, client components marked with "use client"
- **Scalable**: Easy to add new tag types, bullet fields, or filtering logic
- **Performance**: Efficient filtering with useMemo, minimal re-renders

## Environment Variables

Required environment variables (see `.env.example` for template):

### Server-Side Only
- `CONTACT_EMAIL_PERSONAL` - Your primary email address
- `CONTACT_EMAIL_PROFESSIONAL` - Your work/professional email address
- `CONTACT_PHONE` - Your phone number (international format)
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile secret key

### Client-Side (Public)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Cloudflare Turnstile site key

### Setup Instructions
1. Copy `.env.example` to `.env.local`
2. Sign up for [Cloudflare Turnstile](https://dash.cloudflare.com/turnstile)
3. Create a "Managed" widget with "Invisible" mode
4. Copy site key and secret key to `.env.local`
5. Add your contact information

**Security Note:** Phone and email are NEVER exposed to the client. They're only used server-side in the vCard generation API route.

### GitHub Gist Integration (Remote Data Editing)

Your `data/resume-data.json` is gitignored. **Implemented**: GitHub Gist as remote data source.

**Setup**:
1. Create secret gist at https://gist.github.com
2. Get raw URL and add to `.env.local`:
   ```env
   RESUME_DATA_GIST_URL=https://gist.githubusercontent.com/[user]/[hash]/raw/resume-data.json
   ```

**Workflow**:
```bash
npm run data:pull  # Fetch gist → local (also runs on prebuild)
npm run data:push  # Push local → gist (requires gh CLI)
npm run data:view  # View gist in terminal
```

**Auto-deploy**:
- GitHub Action (`.github/workflows/gist-deploy-trigger.yml`) runs hourly
- Checks gist `updated_at` timestamp vs last Vercel deployment
- Validates JSON format
- Triggers Vercel deploy hook if changed
- Uses Vercel API (not git commits) for timestamp tracking

## Development Workflow & Error Handling

### Error Detection Strategy
**Key principle**: Claude proactively catches errors before user testing whenever possible.

**When Claude makes changes:**
- **Automatic type-checking** before major refactors: `npx tsc --noEmit`
- **Lint checks** when modifying multiple files: `npm run lint`
- **Proactive validation** for TypeScript interface changes, new imports, or dependency updates

**User's role:**
- Keep `npm run dev` running in terminal (monitor for errors)
- Watch browser for error overlay (Next.js shows red screen with stack trace)
- Report any errors to Claude with terminal output or browser console logs

### Development Server Behavior

**Hot Module Replacement (HMR)** - Auto-updates without refresh:
- ✅ React components (.tsx, .jsx)
- ✅ Tailwind CSS classes
- ✅ Page routes (app/ directory)
- ✅ Most TypeScript changes

**Requires browser refresh** (`Cmd + R`):
- 🔄 API route changes (app/api/)
- 🔄 Middleware changes (middleware.ts)
- 🔄 Environment variable changes (.env.local)

**Requires hard refresh** (`Cmd + Shift + R` or `Shift + Click` refresh):
- 💪 CSS seems stuck/cached
- 💪 Static assets not updating
- 💪 Cloudflare Turnstile widget issues

**Requires dev server restart** (`Ctrl+C` then `npm run dev`):
- ⚙️ next.config.js changes
- ⚙️ tailwind.config.ts changes
- ⚙️ New environment variables added
- ⚙️ Package installations (npm install)

**NEVER needed in development:**
- ❌ `npm run build` (only for production testing/deployment)
- ❌ Vercel handles builds automatically on deploy

### Claude's Responsibilities
1. Run type-checks proactively when making structural changes
2. Inform user of expected refresh behavior after edits
3. Validate code before user begins testing
4. Fix errors as they arise based on user feedback

### User's Responsibilities
1. Monitor terminal output for red text/errors
2. Check browser DevTools console when needed
3. Share error messages with Claude for rapid fixing
4. Test UI/UX behavior after changes

**Goal**: User experiences minimal errors during testing; Claude catches issues preemptively.

---

## Deployment

**Status**: Deployed to ollie.gg via Vercel with full gist integration and auto-deploy.

### Vercel Setup (Completed)

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

**Flow**:
1. Edit gist on phone/browser → gist `updated_at` changes
2. GitHub Action runs hourly (cron: `0 * * * *`)
3. Fetches gist metadata via GitHub API
4. Validates JSON with `jq`
5. Queries Vercel API for last deployment timestamp
6. Compares timestamps (gist vs Vercel)
7. Triggers Vercel deploy hook if gist is newer

**No git commits** - timestamps tracked via Vercel API, not repo state.

### Checklist
- ✅ Deployed to ollie.gg
- ✅ Environment variables set correctly (no newlines!)
- ✅ GitHub Action running hourly
- ✅ JSON validation in workflow
- ✅ Turnstile working on production
- ✅ Auto-deploy tested and functional

---

# Development Roadmap (Phase 2+)

## Phase 2: Bug Fixes & Tag System (Days 1-4)

### Critical Bug Fixes (Days 1-2)

#### Bug 1: Tag Filtering Display Logic ⚠️ URGENT
**Root Cause**: DataExplorer correctly filters `filteredItems`, but CompanySection receives full company object and renders ALL bullets.

**The Issue**:
```
DataExplorer → filteredItems (correct) → filteredCompanies (by ID)
                                       ↓
CompanySection receives full company.positions[].bullets (WRONG!)
```

**Fix**:
1. DataExplorer: Compute `Set<string>` of filtered bullet IDs from `filteredItems`
2. Pass `filteredBulletIds` prop to CompanySection
3. CompanySection: Filter `allBullets` with `filteredBulletIds.has(bullet.id)` before rendering

**Files**:
- `components/data/DataExplorer.tsx`: Add filteredBulletIds computation, pass to CompanySection
- `components/data/CompanySection.tsx`: Accept filteredBulletIds prop, filter before render

#### Bug 2: vCard Download Speed
**Current**: 800ms delay (line 132, app/page.tsx)
**Fix**: Reduce to 300ms - still shows success UI, feels snappier

#### Bug 3: Turnstile Popup Fallback
**Current**: Modal auto-closes 1.5s after download starts
**Risk**: If auto-download fails, fallback button disappears
**Fix**:
- Keep modal open if `downloadInitiated === false` after 3s
- Add manual "Close" button
- Only auto-close on confirmed download

### Tag System Refactor (Days 3-4)

**Problem**: Hardcoded Tag union type (18 tags) + hardcoded colors in Badge.tsx

**Solution**: CSS-Based Dynamic Tag Colors

1. **Remove Tag union type**:
```typescript
// types/resume.ts
export type Tag = string; // was: union of literals
```

2. **Tag extraction utility**:
```typescript
// lib/tags.ts (new)
export function extractAllTags(data: ResumeData): string[]
export function getTagColorClass(tag: string, allTags: string[]): string
```

3. **CSS color system** (20 OKLCH colors + gradient overflow)
4. **Badge.tsx refactor**: Dynamic color assignment

---

## Phase 3: Liquid Glass Dark Mode (Days 5-8)

### Design System: Modern, Fast, Apple-Inspired

**Color Philosophy**:
- OKLCH color space (perceptually uniform)
- Dark mode default
- Liquid glass aesthetic: frosted backgrounds, subtle gradients, depth through blur

**CSS Architecture**:
- 20 predefined tag colors
- Glass morphism components
- Performance-optimized animations (GPU-accelerated only)
- NEVER animate: width, height, top, left, margin, padding
- ONLY animate: transform, opacity, filter

**Performance Budget**:
- First Contentful Paint: < 1.2s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- First Input Delay: < 100ms
- Lighthouse Performance Score: ≥ 95

---

## Phase 4: Page Unification (Days 9-11)

### Goal: Single "Experience" Page

**New Routes**:
- `/` - Landing (hero, quick links, about)
- `/experience` - Unified resume + explorer (replaces /resume and /resume/view)

**Unified Experience Page Structure**:
1. Hero: Name, Location, Tagline
2. Professional Summary (2-3 lines)
3. Stats Bar: Years experience, companies, key achievements (animated counters)
4. Resume Generation Section:
   - Role selector dropdown
   - "Generate Resume" button
   - Quick Actions: LinkedIn, GitHub, 📅 Book Call (cal.com/ollie)
5. Full Experience Explorer (inline, not separate page)
6. What is Resumate? (explanation + GitHub link)

---

## Phase 5: Rust/WASM Resume Compiler (Days 12-22) 🦀

### Why Rust?
1. **Performance**: <5s generation time (target: 2-3s)
2. **Showcase**: Demonstrates systems programming mastery
3. **Dual format**: PDF + DOCX from single codebase
4. **Client-side**: Zero server cost, infinite scaling

### Tech Stack
- `pdf-writer` - Low-level PDF generation
- `docx-rs` - DOCX generation
- `wasm-bindgen` - JS interop
- `serde` - JSON serialization
- `wasm-pack` - Build tooling

### Heuristic Algorithm
```rust
pub fn score_bullet(bullet: &Bullet, role: &RoleMapping) -> f32 {
    let tag_score = /* tag relevance 0-1 */;
    let priority_score = bullet.priority / 10.0;
    let metrics_bonus = if bullet.metrics.is_some() { 0.1 } else { 0.0 };

    (tag_score * 0.6) + (priority_score * 0.3) + metrics_bonus
}
```

### 20-Second Constraint
- WASM initialization: ~500ms (cached)
- Bullet selection: ~100ms
- PDF/DOCX generation: ~2-3s
- **Total: 2.5-4s** ✅ (well under 20s)

---

## Phase 6: PostHog Analytics (Days 23-24)

### Event Tracking (No Database Needed!)

**Key Events**:
```typescript
posthog.capture('resume_generated', {
  role: 'developer-relations',
  format: 'pdf',
  bullet_count: 18,
  bullet_ids: [...],
  bullet_texts: [...], // Full text for reference
  generation_time_ms: 2340,
});

posthog.capture('resume_ai_curated', {
  job_description_length: 1200,
  ai_processing_time_ms: 4500,
});

posthog.capture('tag_filter_applied', { tags: [...], results_count: 12 });
posthog.capture('search_performed', { query: '...', results_count: 8 });
posthog.capture('calendar_link_clicked', { source: 'experience_page' });
```

**User Properties** (auto-captured):
- Device type, OS, browser
- Screen resolution
- Location (city, country)
- Session duration
- UTM parameters

**Session Replay**: Enabled for all downloads

---

## Phase 7: N8N Notifications (Days 25-26)

### Workflow: PostHog → N8N → Notification

**Architecture**:
```
Resume Downloaded (PostHog event)
      ↓
PostHog Webhook → N8N Workflow
      ↓
1. Enrich with session replay URL
2. Store in Airtable/Notion
3. Send Slack/Telegram notification
```

**Notification Format**:
```
🎯 New Resume Downloaded

Role: Developer Relations
Format: PDF
Location: San Francisco, US
Device: Desktop - Chrome
Referrer: LinkedIn Job Post

📊 View Session Replay: [link]
📄 View Bullets: [link]
```

**Storage Schema** (Airtable):
- Download ID, Timestamp
- Role, Format
- User metadata (IP, location, device)
- Bullet IDs + texts
- Session replay URL
- Generation time

---

## Phase 8: AI Curation - Claude API (Days 27-35)

### Secure, Cost-Controlled AI Selection

**20-Second Constraint**:
- Claude API: ~3-5s
- WASM generation: ~2-3s
- **Total: 5-8s** ✅

### Input Validation & Sanitization

```typescript
// lib/prompt-sanitization.ts
const MAX_JOB_DESC_LENGTH = 5000;
const INJECTION_PATTERNS = [
  /ignore (previous|all) (instructions|prompts)/i,
  /system prompt/i,
  /forget (everything|all)/i,
];

export function sanitizeJobDescription(input: string): string {
  // 1. Length check
  // 2. Injection pattern detection
  // 3. Strip code blocks
  // 4. Special character ratio check
  // 5. Normalize whitespace
}
```

### Claude API Integration

```typescript
const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2000,
  temperature: 0.2,

  system: `You are a resume curator. Select 15-20 most relevant bullets.

  RULES:
  1. Respond with ONLY JSON array of bullet IDs
  2. Do NOT modify any text
  3. Do NOT write new content

  OUTPUT: { "bullet_ids": ["id1", "id2", ...] }`,

  messages: [{
    role: 'user',
    content: `Job Description:\n${sanitized}\n\nExperience:\n${JSON.stringify(bullets)}`
  }],
});
```

### Rate Limiting
- 5 requests per hour per IP
- Track in middleware.ts
- Return 429 if exceeded

### Cost Management
- Claude Sonnet: ~$0.02 per request
- 5 req/hour/IP limit: ~$0.10/hour per user
- Anthropic API spending cap: $100/month
- Real estimate: ~10 requests/day = $6/month

---

## Testing Strategy

### Unit Tests
- Tag extraction logic
- Bullet scoring algorithm
- Prompt sanitization functions

### Integration Tests
- API routes (vCard, curate, notifications)
- External services (PostHog, N8N, Claude)

### E2E Tests (Playwright)
- Full download flow (Turnstile → PDF)
- Tag filtering accuracy
- AI curation end-to-end
- Dark mode rendering

### Performance Tests
- Lighthouse: Target 95+ performance score
- WASM load time < 500ms
- PDF generation < 3s
- Tag filter response < 100ms

---

## Timeline

| Phase | Duration | Dependencies | Milestone |
|-------|----------|--------------|-----------|
| 2: Bug Fixes | 2 days | None | Filtering works correctly |
| 2: Tag System | 2 days | After bug fixes | Dynamic tags, extensible |
| 3: Dark Mode | 4 days | After tags | Liquid glass aesthetic |
| 4: Page Unification | 3 days | After dark mode | Single experience page |
| 5: Rust/WASM | 11 days | After unification | PDF + DOCX generation |
| 6: PostHog | 2 days | Parallel with WASM | Analytics live |
| 7: N8N | 2 days | After PostHog | Notifications working |
| 8: Claude API | 9 days | After WASM | AI curation live |

**Total: ~35 days (5 weeks)**

**Milestone Schedule**:
- Week 1: Bugs fixed, tags dynamic, dark mode live
- Week 2: Unified page, WASM scaffold, PostHog tracking
- Week 3: PDF generation working, DOCX generation, N8N notifications
- Week 4: Polish, testing, performance optimization
- Week 5: AI curation, security hardening, production launch

---

## Code Quality & Formatting

**Always use Prettier for formatting** - saves tokens and ensures consistency:
```bash
npx prettier --write <file>  # Format specific file
npx prettier --write app/    # Format directory
```

Use prettier instead of manual formatting for:
- CSS/SCSS files (especially after large edits)
- TypeScript/JavaScript
- JSON files
- Markdown

Pre-commit hooks: Not implemented yet (fast iteration phase). Will add when stabilizing for production.

---

## Project Documentation (for Recruiters)

This project demonstrates:
- **Rust/WASM**: Client-side document generation
- **AI-assisted curation**: Human-written content, AI only selects
- **Growth engineering**: Analytics-driven iteration
- **Agentic coding**: Human oversight + AI assistance (Anthropic compliant)

### Technical Highlights
- Sub-5s resume generation (Rust/WASM)
- Client-side compilation, zero server cost
- Dual format (PDF + DOCX) from single codebase
- OKLCH colors, liquid glass design
- PostHog analytics, N8N automation

### Compliance
✅ All experience bullets: Human-written
✅ AI role: Selection only, no content generation
✅ Transparency: Recruiters see full experience history
✅ Verifiable: GitHub commit history shows agentic development
