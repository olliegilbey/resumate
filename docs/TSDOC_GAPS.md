# TSDoc Coverage Gaps

Files that need TSDoc added to exported functions/types, per AGENTS.md conventions.
Every exported symbol gets a one-line description.
Exported functions/methods get: `@param`, `@returns`, and `@example` where practical.
Exported types/constants/interfaces get a short description (no `@param`/`@returns`); add `@example` when practical.
This tracker also includes selected non-exported route helpers where documentation improves API maintainability.

**Current coverage: ~65% (60/93 exported symbols documented, 3 @example blocks)**

## Priority 1 — Core Logic

- [ ] `lib/selection.ts` — missing TSDoc on `reorderByCompanyChronology`; needs more `@example` blocks
- [ ] `lib/utils.ts` — missing TSDoc on `cn()` and `TextPart` interface (1/3 documented)
- [ ] `lib/ai/output-parser.ts` — 5 exported types undocumented: `SelectionConfig`, `ScoredBulletId`, `ParsedAIResponse`, `ParseResult`, `BulletHierarchy`
- [ ] `lib/ai/providers/types.ts` — 8 of 12 exports undocumented: `AIProvider`, `ProviderBackend`, `SelectionRequest`, `ScoredBulletSelection`, `SelectionResult`, `AIProviderInterface`, `SelectionOptions`, `DEFAULT_SELECTION_OPTIONS`

## Priority 2 — API Routes

- [ ] `app/api/resume/select/route.ts` — internal helpers undocumented: `loadResumeData`, `selectBullets`, `scoreBullet`, `calculateTagRelevance`, `calculateCompanyMultiplier`, `calculatePositionMultiplier`
- [ ] `app/api/resume/ai-select/route.ts` — `loadResumeData` helper undocumented
- [ ] `app/api/resume/prepare/route.ts` — `loadResumeData`, `generateToken` helpers undocumented
- [ ] `app/api/resume/log/route.ts` — `triggerN8nWebhook` helper undocumented
- [ ] `app/api/contact-card/route.ts` — `GET`/`POST` handlers and helpers lack formal TSDoc

## Priority 3 — Analytics & Providers

- [ ] `lib/analytics/types.ts` — 0% coverage, 15+ interface exports all undocumented
- [ ] `lib/analytics/events.ts` — type unions and `ANALYTICS_EVENTS` constant undocumented (3/15+ documented)
- [ ] `lib/ai/providers/cerebras.ts` — `CerebrasProvider` class and methods undocumented
- [ ] `lib/ai/providers/anthropic.ts` — `AnthropicProvider` class itself undocumented (methods have docs)
- [ ] `lib/ai/prompts/prompt.ts` — 3 exported constants undocumented: `SYSTEM_PROMPT`, `USER_PROMPT_TEMPLATE`, `AI_BULLET_BUFFER`
- [ ] `lib/posthog-server.ts` — `ResumePreparedProperties` type alias undocumented
- [ ] `lib/ai/errors.ts` — `ParseErrorCode` type union undocumented

## Already Well-Documented

- `lib/resume-metrics.ts` — 3/3 exports documented
- `lib/tags.ts` — 4/4 exports documented, 2 @example blocks
- `lib/rate-limit.ts` — 5/5 exports documented
- `lib/vcard.ts` — 4/4 exports documented
- `lib/ai/providers/index.ts` — 4/4 exports documented
- `lib/ai/errors.ts` — 5/8 exports documented (classes and functions)
- `lib/ai/prompts/prompt.ts` — 9/12 exports documented (functions)
