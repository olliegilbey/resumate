# Immutability Gaps

Files with mutation patterns flagged by `eslint-plugin-functional`.
Listed in priority order (core logic first, utilities last).

**Current lint warnings: 106 (84 immutable-data, 22 no-let)**

Enforced by `functional/immutable-data` and `functional/no-let` as warnings.
Scoped to `lib/`, `app/api/`, and root `.ts` files (excluding tests, components, scripts).

## Pattern: Array Mutation (.push, .sort on const arrays)

These are the highest-count warnings. Most are `.push()` on locally-created arrays
within a single function scope — acceptable but could use spread or functional builders.

- [ ] `lib/vcard.ts` — 17 warnings. Builds vCard string via `lines.push()`. Could use template literal or array spread.
- [ ] `lib/selection.ts` — 9 warnings. `.push()` and `.sort()` on freshly-created arrays in `selectBulletsWithConstraints`, `applyDiversityConstraints`, `reorderByCompanyChronology`. Local arrays, not shared state.
- [ ] `lib/analytics/errors.ts` — 9 warnings. Object construction with property assignment in error builder functions.
- [ ] `lib/ai/prompts/prompt.ts` — 7 warnings. Array building for prompt sections.
- [ ] `lib/ai/errors.ts` — 6 warnings. Array building in error formatting functions.
- [ ] `lib/ai/output-parser.ts` — 3 warnings. `.push()` on result arrays during JSON parsing.
- [ ] `lib/tags.ts` — 1 warning. Single mutation in tag metrics aggregation.
- [ ] `lib/rate-limit.ts` — 1 warning. Map entry update in rate limiter.

## Pattern: Object Property Assignment (building response objects)

- [ ] `app/api/resume/log/route.ts` — 18 warnings. Builds analytics payload via property assignment. Highest-count file.
- [ ] `app/api/resume/select/route.ts` — 5 warnings. Accumulation in scoring loop.
- [ ] `app/api/debug/posthog/route.ts` — 4 warnings. PostHog event construction.
- [ ] `app/api/resume/ai-select/route.ts` — 3 warnings. Response object building.
- [ ] `app/api/contact-card/route.ts` — 3 warnings. vCard data construction.
- [ ] `lib/posthog-server.ts` — 1 warning.

## Pattern: Let Declarations (could be const)

- [ ] `lib/utils.ts:98,100` — `let lastIndex`, `let match` in regex parsing loop. Legitimate loop state.
- [ ] `lib/ai/output-parser.ts:180,219,318` — `let` for parsing state variables.
- [ ] `app/api/resume/select/route.ts:341,342,381` — `let` for loop accumulators.
- [ ] `lib/ai/providers/index.ts` — 2 `let` declarations for provider selection logic.
- [ ] `app/api/resume/ai-select/route.ts` — `let` for retry logic.
- [ ] `app/api/contact-card/route.ts` — 1 `let`.
- [ ] `proxy.ts` — 1 `let`.

## Out of Scope (excluded from lint)

These files are excluded from functional lint rules but listed for awareness:

- **Test files** (`**/__tests__/**`, `**/*.test.*`) — ~80 additional warnings from mock setup, test assertions, state tracking. Mutation in tests is idiomatic.
- **React components** (`components/**`, `app/page.tsx`, `app/layout.tsx`) — ~40 additional warnings from state management, refs, event handlers. React patterns are inherently stateful.
- **Scripts** (`scripts/**`) — ~15 additional warnings from data transformation utilities.

## Notes

- React component state mutations (useState setters, refs) are fine — don't refactor these.
- WASM boundary code is already immutable by design (serialised payloads).
- Local array `.push()` in a single function scope is low-risk. Prioritise shared-state mutations.
- The `ignoreNonConstDeclarations`, `ignoreClasses`, and `ignoreMapsAndSets` options are enabled to reduce noise from idiomatic patterns.
