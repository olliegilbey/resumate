# Next.js Application Context

**You're reading this because you're working with:**
- Files in `app/`, `components/`, `lib/`, `middleware.ts`
- Next.js application code
- TypeScript/React components
- API routes

**Shared project context already loaded via root CLAUDE.md:**
- Architecture, workflows, status, todos, deployment, commands

**This file contains Next.js-specific patterns and conventions.**

---

## Next.js 15 App Router Patterns

### Directory Structure

See root `.claude/CLAUDE.md` for complete project structure.

### Routing Conventions
- `/` - Landing page
- `/resume` - Resume generation page
- `/resume/view` - Experience explorer (main Phase 1 feature)
- `/api/resume/select` - POST: Bullet selection
- `/api/resume/prepare` - POST: Full generation prep
- `/api/contact-card` - POST: vCard download

---

## API Routes

### POST /api/resume/select
**Purpose:** Select bullets for a role profile using hierarchical scoring

**Request:**
```typescript
{
  roleProfileId: string       // e.g., "developer-relations-lead"
  turnstileToken: string      // Cloudflare Turnstile token
  config?: {
    maxBullets?: number       // Default: 18
    maxPerCompany?: number    // Default: 6
    maxPerPosition?: number   // Default: 4
  }
}
```

**Response:**
```typescript
{
  success: true
  roleProfile: { id, name, description }
  config: SelectionConfig
  selected: Array<{
    bullet: BulletPoint
    score: number
    companyId: string
    companyName: string
    positionId: string
    positionRole: string
  }>
  count: number
  timestamp: number
}
```

**Rate Limit:** 10 requests/hour per IP
**Dev Mode:** Skips Turnstile verification

### POST /api/resume/prepare
**Purpose:** Prepare full resume generation payload

**Rate Limit:** 5 requests/hour per IP
**Implementation:** See app/api/resume/prepare/route.ts

### POST /api/contact-card
**Purpose:** Generate vCard file

**Rate Limit:** Standard middleware limits
**Security:** Turnstile protected, one-time token validation

---

## Component Architecture

### CVA Pattern (class-variance-authority)
Use CVA for component variants:

```typescript
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white hover:bg-blue-700',
        outline: 'border border-slate-300 bg-transparent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-sm',
        lg: 'h-12 px-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)
```

### Component Organization
- **ui/**: Reusable, generic components (buttons, badges, etc.)
- **data/**: Domain-specific components (resume explorer, bullet cards)

---

## Tailwind CSS v4

### Configuration
```javascript
// tailwind.config.ts
@import "tailwindcss";
@theme {
  --color-primary: #2563eb;
  --color-background: #f8fafc;
}
```

### Usage Patterns
- Use `cn()` utility for conditional classes
- Prefer Tailwind over custom CSS
- Use CVA for component variants
- Follow mobile-first responsive design

---

## Type Imports

### Resume Data Types
**ALWAYS import from** `types/resume.ts`:
```typescript
import type { ResumeData, BulletPoint, Company, RoleProfile } from '@/types/resume'
```

**DO NOT import directly from** `lib/types/generated-resume.ts` (that's generated code)

### Type Flow
1. Rust types (crates/shared-types/src/lib.rs)
2. JSON Schema (schemas/resume.schema.json)
3. Generated TS (lib/types/generated-resume.ts)
4. Re-exported (types/resume.ts) ← Import from here

---

## Environment Variables

### Client-Side (Public)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Cloudflare Turnstile site key

### Server-Side Only
- `CONTACT_EMAIL_PERSONAL` - Primary email
- `CONTACT_EMAIL_PROFESSIONAL` - Work email
- `CONTACT_PHONE` - Phone number (international format)
- `TURNSTILE_SECRET_KEY` - Cloudflare secret
- `RESUME_DATA_GIST_URL` - Gist raw URL

**IMPORTANT:** Never expose server-side env vars to client bundle!

---

## Testing

### Framework
- **Test Runner:** Vitest
- **React Testing:** @testing-library/react
- **Current Coverage:** 48 tests passing

### Test Locations
```
lib/__tests__/           # Unit tests for utilities
components/__tests__/    # Component tests
```

### Running Tests
```bash
just test        # Run all tests
just test-ts-watch  # Watch mode
```

---

## Development Server Behavior

### Hot Module Replacement (HMR) - Auto-updates
✅ React components (.tsx, .jsx)
✅ Tailwind CSS classes
✅ Page routes (app/ directory)
✅ Most TypeScript changes

### Requires Browser Refresh (`Cmd + R`)
🔄 API route changes (app/api/)
🔄 Middleware changes (middleware.ts)
🔄 Environment variable changes (.env.local)

### Requires Hard Refresh (`Cmd + Shift + R`)
💪 CSS seems stuck/cached
💪 Static assets not updating
💪 Cloudflare Turnstile widget issues

### Requires Dev Server Restart
⚙️ next.config.js changes
⚙️ tailwind.config.ts changes
⚙️ New environment variables added
⚙️ Package installations (bun install)

---

## Common Commands

```bash
just dev              # Start dev server (Turbopack)
just build            # Production build
just check-ts             # ESLint
just test             # Run tests
just check-ts        # TypeScript check (just check-ts)
```

---

## Security Patterns

### Rate Limiting
See `lib/rate-limit.ts` for implementation:
- In-memory store (consider Redis for multi-instance)
- IP-based limits
- Per-route configuration

### Middleware
See `middleware.ts`:
- Bot detection with allowlist (Googlebot, etc.)
- Security headers (CSP, X-Frame-Options)
- Rate limiting enforcement

### Turnstile Integration
- **Development:** Auto-skipped (NODE_ENV === 'development')
- **Production:** Required for /api/contact-card and /api/resume/*

---

## Common Patterns

### Data Loading
```typescript
// Server component (default)
export default async function Page() {
  const data = await loadData() // Can use async/await
  return <Component data={data} />
}

// Client component (when needed)
'use client'
export function InteractiveComponent() {
  const [state, setState] = useState()
  return <div onClick={() => setState(...)} />
}
```

### API Routes
```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Rate limiting
  const clientIP = getClientIP(request)
  const rateLimit = checkRateLimit(clientIP, { limit: 10, window: 3600000 })

  if (!rateLimit.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  // ... handle request
  return NextResponse.json({ success: true })
}
```

---

## Error Handling

### User-Facing Errors
- Show clear, actionable error messages
- Use toast notifications or error states
- Log to console.error for debugging

### API Errors
- Return appropriate HTTP status codes
- Include error messages in response body
- Add rate limit headers when applicable

---

## Notes for AI Assistants

**Before making changes:**
1. Run `just check-ts` for TypeScript validation
2. Run `just check-ts` for code quality
3. Test in browser with `just dev`

**Common tasks:**
- Adding new page → Create in `app/` with page.tsx
- Adding new API route → Create in `app/api/` with route.ts
- Adding new component → Create in `components/ui/` or `components/data/`
- Styling changes → Use Tailwind classes, run `just fmt --write` after

**For hybrid work (Next.js + Rust types):**
- Also read `doc-gen/CLAUDE.md` for Rust context
- Follow type sync patterns (Rust → Schema → TS)
- Run `just types-schema && just types-ts` after Rust changes
