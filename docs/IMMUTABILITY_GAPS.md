# Immutability Gaps

Files with mutation patterns flagged by `eslint-plugin-functional`, applied
globally with typed linting and tuned options (see `eslint.config.mjs`).

Listed in priority order (highest-count first).

**Current lint warnings: 209 (150 immutable-data, 58 no-let, 1 other)**
**Severity: `warn`. Will promote to `error` once hotspots are worked down.**

Tuning options in effect:

- `ignoreNonConstDeclarations: true` — mutations on `let`/`var` are caught by
  `no-let`; don't double-flag.
- `ignoreClasses: true` — class field assignment is idiomatic OOP, not drift.
- `ignoreMapsAndSets: true` — `Map`/`Set` have no immutable API.

## Top hotspots — fix these first

| Warnings | File                                            | Notes                                              |
| -------: | ----------------------------------------------- | -------------------------------------------------- |
|       18 | `app/api/resume/log/route.ts`                   | Analytics payload built via property assignment    |
|       17 | `lib/vcard.ts`                                  | Builds vCard via `lines.push()` — template literal |
|       17 | `app/page.tsx`                                  | Landing page state/DOM interactions                |
|       14 | `components/data/ResumeDownload.tsx`            | Also file-disabled for `max-lines`                 |
|       11 | `app/api/resume/select/__tests__/route.test.ts` | Test mutation — lower priority                     |
|       10 | `lib/__tests__/rate-limit.test.ts`              | Test mutation — lower priority                     |
|        9 | `lib/selection.ts`                              | `.push()`/`.sort()` on fresh arrays in selection   |
|        9 | `lib/analytics/errors.ts`                       | Error object construction                          |
|        8 | `scripts/transform-resume-data.ts`              | Data transformation script                         |
|        8 | `app/api/resume/select/route.ts`                | Scoring loop accumulation                          |
|        7 | `lib/utils.ts`                                  | Regex parsing loop state                           |
|        7 | `lib/ai/prompts/prompt.ts`                      | Array building for prompt sections                 |
|        6 | `lib/ai/output-parser.ts`                       | `.push()` on parse results                         |
|        6 | `lib/ai/errors.ts`                              | Array building in error formatting                 |

## Patterns to watch

### Array mutation (`.push`, `.sort` on `const` arrays)

Most common pattern. Usually `.push()` on a locally-created array inside a
single function scope — low risk, but noisy enough to prefer spread or
functional builders (`reduce`, `flatMap`).

### Object property assignment (response building)

Heaviest in `app/api/resume/log/route.ts` and `lib/analytics/errors.ts`.
Build the object up-front as one literal, or fold with `reduce`.

### `let` declarations

58 warnings for legitimate loop accumulators, regex parsing state, provider
selection state. Often convertible to `const` + functional transforms, but
not always worth it.

## Promotion criteria

Promote `functional/immutable-data` from `warn` → `error` when:

- Top 5 hotspots are under 3 warnings each, **and**
- Total count is below 50, **and**
- Remaining warnings have been triaged (this document updated with per-file
  justifications for any legitimate "allow" cases).

`functional/no-let` promotion gated separately on the same 50-total bar.

## Out of scope (handled by config)

- WASM boundary code is immutable by design (serialised payloads).
- `Map`/`Set` mutation is ignored — no immutable alternative.
- Class field assignment is ignored — OOP is the intent.
- `let` mutations are counted once via `no-let`, not double-flagged by
  `immutable-data`.
