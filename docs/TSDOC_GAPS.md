# TSDoc Coverage Gaps

Files that need TSDoc added to exported functions/types, per AGENTS.md conventions.
Every exported symbol gets a one-line description.
Exported functions/methods get: `@param`, `@returns`, and `@example` where practical.
Exported types/constants/interfaces get a short description (no `@param`/`@returns`); add `@example` when practical.

**Current coverage: 100% — all tracked gaps closed (Issue #24).**

## History

Gaps closed in `docs(tsdoc): close coverage gaps from Issue #24`:

- **Priority 1 — Core Logic**
  - `lib/selection.ts` — `reorderByCompanyChronology` documented with `@example`; `selectBulletsWithConstraints` gained an `@example` block
  - `lib/utils.ts` — `cn()` and `TextPart` documented
  - `lib/ai/output-parser.ts` — `SelectionConfig`, `ScoredBulletId`, `ParsedAIResponse`, `ParseResult`, `BulletHierarchy` documented
  - `lib/ai/providers/types.ts` — `AIProvider`, `ProviderBackend`, `SelectionRequest`, `ScoredBulletSelection`, `SelectionResult`, `AIProviderInterface`, `SelectionOptions`, `DEFAULT_SELECTION_OPTIONS` documented

- **Priority 2 — API Routes**
  - `app/api/resume/select/route.ts` — `loadResumeData`, `selectBullets`, `scoreBullet`, `calculateTagRelevance`, `calculateCompanyMultiplier`, `calculatePositionMultiplier` documented
  - `app/api/resume/ai-select/route.ts` — `loadResumeData` documented
  - `app/api/resume/prepare/route.ts` — `loadResumeData`, `generateToken` documented
  - `app/api/resume/log/route.ts` — `triggerN8nWebhook` documented
  - `app/api/contact-card/route.ts` — `GET`, `POST`, `verifyTurnstileToken`, `loadResumeData`, `generateContactCardResponse` documented

- **Priority 3 — Analytics & Providers**
  - `lib/analytics/types.ts` — all exported interfaces/unions documented
  - `lib/analytics/events.ts` — `ANALYTICS_EVENTS`, type unions, `EnvironmentContext` documented
  - `lib/ai/providers/cerebras.ts` — `CerebrasProvider` class documented with `@example`
  - `lib/ai/providers/anthropic.ts` — `AnthropicProvider` class documented with `@example`
  - `lib/ai/prompts/prompt.ts` — `SYSTEM_PROMPT` documented (`AI_BULLET_BUFFER` already documented)
  - `lib/posthog-server.ts` — `ResumePreparedProperties` documented
  - `lib/ai/errors.ts` — `ParseErrorCode` documented

- **Components (PR #15 review)**
  - `components/ui/ContactLinks.tsx` — `ContactLinks` documented with `@example`
  - `components/ui/IconBadge.tsx` — `iconBadgeVariants`, `IconBadgeProps`, `IconBadge` documented with `@example`
