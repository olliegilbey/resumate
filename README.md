# Resumate - Experience Curation Framework

**Your career story, authentically presented.**

Resumate helps you curate your human-written professional experiences for different audiences. You write your career history once; AI helps you select and organize what's most relevant for each opportunity.

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Philosophy: Human-Written, AI-Curated

> **You create the content. AI selects what's relevant.**

This framework follows [Anthropic's AI guidance principles](https://www.anthropic.com/candidate-ai-guidance):

✅ **All experiences**: Human-written by you
✅ **All selection**: AI-assisted curation
✅ **All content**: Authentic and real
❌ **Never fabricates** career history or achievements

Resumate is **not** an AI resume generator. It's a curation system that helps you present your authentic professional story effectively. You write your bullets once, with all the detail and context. When you need a resume for a specific role, AI helps you select which experiences are most relevant—never generating or fabricating content.

**Compliant with Anthropic's candidate AI guidance.**

---

## Features

### 🎯 Core Functionality
- **Experience Data Explorer** - Beautiful, filterable view of all your career history
- **Smart Search** - Filter experiences by text across all fields
- **Tag-Based Filtering** - Multi-select tags with AND logic (requires all selected tags)
- **Company Timeline** - Hierarchical structure: Company → Position → Achievements
- **Priority System** - Manually rank importance of each bullet (1-10)
- **Metrics Highlighting** - Emphasize quantifiable achievements

### 🔒 Security & Privacy
- **Protected Contact Info** - Email and phone never exposed to client-side code
- **Cloudflare Turnstile** - CAPTCHA protection for vCard downloads
- **Server-Side vCard Generation** - Contact details only used in API routes
- **Bot Detection** - Middleware blocks scrapers while allowing legitimate search engines
- **Rate Limiting** - IP-based throttling (30 req/min, 100 req/min for Googlebot)
- **Security Headers** - CSP, X-Frame-Options, X-Content-Type-Options

### 📱 User Experience
- **Auto-Download** - vCard download triggers automatically after verification (works in Chrome & Arc)
- **Fallback Button** - Manual download option if auto-download fails
- **Mobile-First** - Responsive design with Tailwind CSS
- **Accessible** - ARIA labels, keyboard navigation, semantic HTML

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/resumate.git
cd resumate
npm install
```

### 2. Configure Your Data

```bash
# Copy the template to create your personal resume data
cp data/resume-data-template.json data/resume-data.json

# Copy environment variables template
cp .env.example .env.local
```

### 3. Write Your Experiences

Edit `data/resume-data.json` with YOUR career story:
- Write bullet points in your own words
- Add context, metrics, and links
- Tag each experience with relevant categories
- Prioritize manually (1-10 scale)

**Remember**: Write everything yourself. This is your authentic career history.

### 4. Add Your Contact Info

Edit `.env.local`:

```env
CONTACT_EMAIL_PERSONAL=your-email@example.com
CONTACT_EMAIL_PROFESSIONAL=your-work@example.com
CONTACT_PHONE=+1234567890

# Get free Turnstile keys from https://dash.cloudflare.com/turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key-here
TURNSTILE_SECRET_KEY=your-secret-key-here
```

### 5. Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

**Routes**:
- `/` - Landing page with contact links
- `/resume` - Resume overview
- `/resume/view` - Full data explorer (search, filter, explore all experiences)

---

## Cloudflare Turnstile Setup

### Why Turnstile?
Free, privacy-friendly CAPTCHA that protects your contact information from bots.

### Setup Steps

1. **Create Account**
   - Go to [https://dash.cloudflare.com/turnstile](https://dash.cloudflare.com/turnstile)
   - Sign in or create free account

2. **Add Widget**
   - Click "Add Site"
   - Domain: `localhost` (development) or your production domain
   - Widget Mode: **Managed**
   - Widget Type: **Invisible** (best UX)

3. **Copy Keys**
   - Site Key: Starts with `0x4AAAA...` (public, safe to expose)
   - Secret Key: Private, add to `.env.local` only

4. **Add to Environment**
   ```env
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key
   TURNSTILE_SECRET_KEY=your-secret-key
   ```

### Testing Keys (Development Only)
Cloudflare provides test keys that always pass:
```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

---

## Data Structure

Resumate uses a hierarchical JSON structure:

```json
{
  "personal": {
    "name": "Your Name",
    "fullName": "Your Full Name",
    "location": "City, Country",
    "linkedin": "username",
    "github": "username",
    "website": "yourdomain.com"
  },
  "companies": [
    {
      "name": "Company Name",
      "positions": [
        {
          "role": "Your Role",
          "description": "What you did (human-written)",
          "bullets": [
            {
              "text": "Achievement or responsibility (human-written)",
              "tags": ["developer-relations", "team-leadership"],
              "priority": 9,
              "metrics": "20% increase",
              "link": "https://..."
            }
          ]
        }
      ]
    }
  ]
}
```

See `data/TEMPLATE_GUIDE.md` for complete documentation.

---

## Code Quality & Review

### CodeRabbit CLI

This project uses [CodeRabbit](https://coderabbit.ai) for AI-powered code reviews.

**Installation**:
```bash
npm install -g @coderabbit/cli
coderabbit auth
```

**Usage**:
```bash
# Review uncommitted changes with context from CLAUDE.md
coderabbit review --plain --type uncommitted --config CLAUDE.md

# Review all files
coderabbit review --plain --type all

# Review specific commit
coderabbit review --plain --type committed
```

**When to run**:
- ✅ Before committing (catch issues early)
- ✅ After major refactors (verify quality)
- ✅ When stuck (get AI suggestions)
- ✅ Regular check-ins (maintain code health)

Claude Code and Warp editors should run this extensively when making changes.

---

## Deployment

### Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "feat: personal resume site"
   git push
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Vercel auto-detects Next.js

3. **Add Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.local`
   - Add for Production, Preview, and Development

4. **Deploy**
   - Vercel automatically deploys on push
   - Visit your deployment URL

### Security Checklist
- ✅ Environment variables configured in Vercel dashboard
- ✅ `.env.local` is gitignored (verify)
- ✅ No secrets committed to repository
- ✅ Build succeeds: `npm run build`
- ✅ Turnstile keys working (test download)

---

## Personal Data Management

### Your Resume Data (Not a Backup)

Your personal resume data (`data/resume-data.json`) is **gitignored** to keep it private. For editing from anywhere (not just your local machine), use a **private GitHub Gist**:

#### Setup Private Gist (Recommended)

1. **Create Secret Gist**
   - Go to https://gist.github.com
   - Click "New gist"
   - Filename: `resume-data-[yourname].json`
   - Content: Paste your `data/resume-data.json`
   - **Select "Create secret gist"** (keeps it private)

2. **Get Raw URL**
   - Click "Raw" button in your new gist
   - Copy URL: `https://gist.githubusercontent.com/[user]/[hash]/raw/[hash]/resume-data-[yourname].json`
   - This URL stays stable even when you edit

3. **Optional: Add to .env.local** (for future gist-fetch feature)
   ```env
   RESUME_DATA_GIST_URL=https://gist.githubusercontent.com/...
   ```

4. **Edit from Anywhere**
   - Go to https://gist.github.com/[your-username]
   - Find your resume gist
   - Click "Edit" - full editor available
   - Changes are immediate

**Benefits**:
- ✅ Edit your resume from any device
- ✅ GitHub's editor with syntax highlighting
- ✅ Private and secure (secret gist)
- ✅ Version history built-in
- ✅ No database needed

**How to use**:
- **Local dev**: Edit `data/resume-data.json` directly
- **Remote editing**: Edit the gist, then pull changes locally
- **Future**: App can fetch directly from gist (optional enhancement)

---

## Project Structure

```
resumate/
├── app/
│   ├── page.tsx              # Landing page
│   ├── layout.tsx            # Root layout
│   ├── robots.ts             # Dynamic robots.txt (pulls from data)
│   ├── api/
│   │   └── contact-card/
│   │       └── route.ts      # vCard generation API (server-side only)
│   └── resume/
│       ├── page.tsx          # Resume overview
│       └── view/
│           └── page.tsx      # Data explorer
├── components/
│   ├── ui/                   # Reusable UI components
│   │   ├── Navbar.tsx
│   │   ├── Button.tsx
│   │   └── ContactLinks.tsx
│   └── data/                 # Data visualization components
│       ├── DataExplorer.tsx
│       ├── CompanySection.tsx
│       └── BulletCard.tsx
├── lib/
│   ├── vcard.ts              # vCard 3.0 generation with escaping
│   └── utils.ts              # Utilities
├── types/
│   └── resume.ts             # TypeScript types
├── data/
│   ├── resume-data.json      # YOUR data (gitignored)
│   ├── resume-data-template.json  # Template for others
│   └── TEMPLATE_GUIDE.md     # Data structure docs
├── middleware.ts             # Security (bot detection, rate limiting)
└── .env.local                # Your secrets (gitignored)
```

---

## Tech Stack

- **Framework**: Next.js 15.5.4 (Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **Security**: Cloudflare Turnstile
- **Icons**: Lucide React
- **Deployment**: Vercel

---

## AI Philosophy in Practice

### What You Do (Human)
1. ✍️ Write every bullet point yourself
2. 📝 Add context, metrics, links
3. 🏷️ Tag each experience with categories
4. ⭐ Prioritize manually (1-10)

### What AI Does (Curation)
1. 🔍 Helps you find relevant experiences for a role
2. 📊 Suggests which bullets are most applicable
3. 🎯 Organizes content by relevance
4. ✨ Refines presentation (never content)

### What AI NEVER Does
- ❌ Generate bullet points
- ❌ Fabricate achievements
- ❌ Create experiences you haven't had
- ❌ Replace your authentic voice

This distinction is crucial for compliance with Anthropic's guidance and maintaining authenticity in professional representation.

---

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Run CodeRabbit review before committing
4. Submit a pull request

See `CLAUDE.md` for development guidelines.

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built with [Claude Code](https://claude.com/claude-code) following best practices for AI-assisted development.

**Philosophy**: Human creativity, AI enhancement. Never the other way around.

---

## Support

For questions or issues:
- 📖 Check `data/TEMPLATE_GUIDE.md` for data structure help
- 🔒 See `SECURITY.md` for security details
- 💻 See `CLAUDE.md` for development notes
- 🐛 Open an issue on GitHub

---

**Remember**: This is YOUR resume, YOUR career story, YOUR authentic experiences. Resumate just helps you present them effectively.
