## Development Workflow & Guidelines

### Error Detection Strategy
**Key principle**: Claude proactively catches errors before user testing whenever possible.

**When Claude makes changes:**
- **Automatic type-checking** before major refactors: `just check-ts`
- **Lint checks** when modifying multiple files: `just check-ts`
- **Proactive validation** for TypeScript interface changes, new imports, or dependency updates

**User's role:**
- Keep `just dev` running in terminal (monitor for errors)
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

**Requires dev server restart** (`Ctrl+C` then `just dev`):
- ⚙️ next.config.js changes
- ⚙️ tailwind.config.ts changes
- ⚙️ New environment variables added
- ⚙️ Package installations (bun install)

**NEVER needed in development:**
- ❌ `just build` (only for production testing/deployment)
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

### Testing Philosophy
- **TDD for Rust** - Write tests first, then implementation
- **Property-based tests** for type validation (proptest)
- **Integration tests** for full PDF/DOCX generation
- **Visual parity tests** - Compare PDF and DOCX output

---
