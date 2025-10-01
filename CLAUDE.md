# Resumate - AI-Assisted Resume Curation System

## Project Overview

**Resumate** is an intelligent resume system that curates experience based on role types. This framework can be used as a personal portfolio site and will eventually be fully open-sourced.

## Phase 1 MVP - Current Focus

Building a beautiful data explorer that shows all resume experience in a filterable, searchable interface, plus a simple download button for a static PDF resume.

### Tech Stack
- **Framework**: Next.js 15.5.4 (Turbopack) with App Router (TypeScript)
- **Styling**: Tailwind CSS v4
- **Deployment**: Vercel
- **Security**: Cloudflare Turnstile CAPTCHA
- **Design**: Clean, modern, inspired by Linear/Notion aesthetics
- **Color Palette**: Tailwind's slate/blue tones

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
- **Static PDF Download**: Simple fallback resume

## Commands to Run

### Development
```bash
npm run dev        # Start development server with Turbopack
npm run build      # Build for production (auto-fetches gist via prebuild)
npm run lint       # Run ESLint
npm run start      # Start production server
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

## Future Phases (Not in Phase 1)

- Claude API integration for intelligent curation
- Rust/WASM PDF generation
- Role-based resume customization
- Job description analysis
- Analytics tracking
- Open-source framework extraction

## Development Notes

- Focus on quality over speed
- Mobile-first responsive design
- Full TypeScript type safety
- Server components where possible
- Accessibility with proper ARIA labels
- Clean, professional aesthetics
- Performance optimized

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

### Phase 2 Features (Not Started)
- Claude API integration for role-based curation
- Rust/WASM PDF generation
- Job description analysis
- Role type selector
- AI bullet selection

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
