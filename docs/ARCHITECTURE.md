## Architecture Overview

### Data Flow (Security-Conscious)

```
┌─────────────────────────────────────────────────────────────┐
│ BUILD TIME (Server)                                          │
├─────────────────────────────────────────────────────────────┤
│ • prebuild hook: fetch-gist-data.js                         │
│ • Full resume-data.json cached at build time                │
│ • Server has complete data (never exposed to client)        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ USER INTERACTION                                             │
├─────────────────────────────────────────────────────────────┤
│ 1. User visits /resume page                                 │
│ 2. Sees role dropdown (from roleProfiles[])                 │
│ 3. Selects role (e.g., "Product Manager")                  │
│ 4. Clicks "Generate Resume"                                 │
│ 5. Turnstile CAPTCHA appears                                │
│ 6. User completes verification                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
                 POST /api/resume/prepare
         { roleId: "product-manager", turnstileToken }
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ SERVER (Next.js API Route)                                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Verify Turnstile token with Cloudflare                   │
│ 2. Rate limit check (5 generations/hour/IP)                 │
│ 3. Load resume-data.json from build-time cache              │
│ 4. Find RoleProfile by roleId                               │
│ 5. Extract all bullets from companies                       │
│ 6. Run heuristic selection:                                 │
│    • Score bullets (priority + tags + metrics)             │
│    • Apply diversity constraints                            │
│    • Select top 10-15 bullets                               │
│ 7. Build GenerationPayload:                                 │
│    {                                                         │
│      personal: PersonalInfo,        // Full contact info    │
│      selectedBullets: Bullet[],     // Only selected        │
│      roleProfile: RoleProfile,      // Role config          │
│      metadata: { ids, timestamp }                           │
│    }                                                         │
│ 8. Log to PostHog & N8N (store IDs for reconstruction)     │
│ 9. Return GenerationPayload to client                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ CLIENT (WASM Generation)                                     │
├─────────────────────────────────────────────────────────────┤
│ Progress UI:                                                │
│ ✨ "Initializing resume compiler..."          (~500ms)     │
│ 🧠 "Analyzing your curated experience..."     (~200ms)     │
│ 📄 "Compiling Typst template..."              (~800ms)     │
│ 📄 "Generating PDF (ATS-optimized)..."        (~700ms)     │
│ ⚡ "Finalizing download..."                   (~200ms)     │
│                                                              │
│ → PDF download via Typst                                    │
│ → Track completion in PostHog                               │
└─────────────────────────────────────────────────────────────┘
```

**Security Guarantees:**
- ✅ Full resume JSON stored server-side only (build-time cache)
- ✅ Client receives ONLY selected bullets post-curation
- ✅ Turnstile prevents automated abuse
- ✅ Rate limiting (5 generations/hour/IP)
- ✅ No client-side manipulation of selection

---

## Project Structure

```
resumate/
├── doc-gen/                           # Rust/WASM workspace
│   ├── Cargo.toml                     # Workspace config
│   ├── crates/
│   │   ├── core/                      # Core types & selection
│   │   │   ├── Cargo.toml
│   │   │   └── src/
│   │   │       ├── lib.rs
│   │   │       ├── types.rs           # Data structures
│   │   │       ├── scoring.rs         # Bullet scoring
│   │   │       └── selector.rs        # Selection algorithms
│   │   │
│   │   ├── typst/                     # Typst PDF generation (NEW)
│   │   │   ├── Cargo.toml
│   │   │   ├── src/
│   │   │   │   ├── lib.rs             # Public API
│   │   │   │   ├── compiler.rs        # Typst compiler wrapper
│   │   │   │   ├── template.rs        # Template rendering
│   │   │   │   └── fonts.rs           # Font management
│   │   │   ├── templates/
│   │   │   │   └── resume.typ         # Main resume template
│   │   │   └── fonts/                 # Embedded fonts
│   │   │       └── *.ttf              # Linux Libertine, etc.
│   │   │
│   │   └── wasm/                      # WASM bindings
│   │       ├── Cargo.toml
│   │       ├── build.rs               # Build-time git hash/timestamp
│   │       └── src/
│   │           └── lib.rs             # wasm_bindgen exports
│   │
│   ├── examples/
│   │   └── reconstruct.rs             # CLI for PDF reconstruction
│   │
│   └── fixtures/
│       └── sample_resume.json         # Test data
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx                       # Landing page
│   ├── api/
│   │   ├── contact-card/
│   │   │   └── route.ts               # vCard generation
│   │   └── resume/
│   │       └── prepare/
│   │           └── route.ts           # Curation + selection API
│   ├── resume/
│   │   ├── page.tsx                   # Resume generation page
│   │   └── view/
│   │       └── page.tsx               # Experience explorer
│   └── globals.css
│
├── components/
│   ├── data/                          # Explorer components
│   │   ├── DataExplorer.tsx
│   │   ├── CompanySection.tsx
│   │   ├── BulletCard.tsx
│   │   ├── TagFilter.tsx
│   │   └── SearchBar.tsx
│   ├── resume/                        # Generation components
│   │   ├── RoleSelector.tsx           # Role dropdown
│   │   ├── TurnstileGate.tsx          # CAPTCHA modal
│   │   ├── GenerationProgress.tsx     # Animated progress UI
│   │   └── PDFGenerator.tsx           # Main orchestration
│   └── ui/                            # Shared UI components
│       ├── Badge.tsx
│       ├── Button.tsx
│       ├── GlassPanel.tsx
│       └── ContactLinks.tsx
│
├── lib/
│   ├── wasm/                          # WASM integration
│   │   ├── loader.ts                  # Initialize WASM
│   │   ├── types.ts                   # TypeScript types
│   │   └── errors.ts                  # Error handling
│   ├── security/
│   │   ├── turnstile.ts               # Verification
│   │   └── rate-limit.ts              # Rate limiting
│   ├── analytics/
│   │   ├── posthog.ts                 # Event tracking
│   │   └── n8n.ts                     # Webhook integration
│   ├── utils.ts
│   ├── tags.ts                        # Tag utilities
│   └── vcard.ts                       # vCard generation
│
├── types/
│   └── resume.ts                      # TypeScript types (canonical)
│
├── scripts/
│   ├── fetch-gist-data.js             # Prebuild: fetch gist
│   ├── gist-push.js                   # Push local → gist
│   ├── gist-view.js                   # View gist
│   ├── codegen/
│   │   └── validate-types.ts          # CI: TS ↔ Rust validation
│   └── test/
│
├── data/
│   ├── resume-data.json               # Full resume (gitignored)
│   └── resume-data-template.json      # Template/schema
│
├── .github/
│   └── workflows/
│       └── gist-deploy-trigger.yml    # Hourly auto-deploy
│
├── middleware.ts                      # Security & rate limiting
└── .env.local                         # Secrets (gitignored)
```

---

