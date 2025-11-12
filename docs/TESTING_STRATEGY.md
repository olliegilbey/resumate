---
last_updated: 2025-10-28
category: Testing Philosophy & Patterns
update_frequency: Quarterly (only when testing approach changes)
retention_policy: Keep all historical versions in git
---

# Testing Strategy & Philosophy

> **📍 System Directive:**
> This document describes **HOW** we test, not **WHAT** the current metrics are.
> For current test counts and coverage, see [METRICS.md](./METRICS.md)

---

## Core Philosophy: Test-Driven Development (TDD)

**Principle:** Tests define contracts, drive design, prevent regressions.

**Why TDD?**
- Tests written first force clear requirements
- Implementation guided by passing tests
- Refactoring safe with test safety net
- Documentation through executable examples

### Red → Green → Refactor Cycle

```
1. RED:     Write failing test (defines behavior)
2. GREEN:   Write minimal code to pass
3. REFACTOR: Improve while keeping tests green
```

**Rule:** Tests run fast enough (~7s full suite) to enable continuous TDD feedback loop.

---

## Test Types & When to Use

### 1. Unit Tests (80% of suite)

**Purpose:** Test single function/method in isolation

**Characteristics:**
- Fast (<1ms each)
- Isolated (mock dependencies)
- Focused (one assertion per test)

**Rust Pattern:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_descriptive_name() {
        // Arrange
        let input = setup_test_data();

        // Act
        let result = function_under_test(input);

        // Assert
        assert_eq!(result, expected);
    }
}
```

**TypeScript Pattern:**
```typescript
import { describe, it, expect } from 'vitest'

describe('Feature Name', () => {
  it('should do specific thing', () => {
    // Arrange
    const input = setupTestData()

    // Act
    const result = functionUnderTest(input)

    // Assert
    expect(result).toEqual(expected)
  })
})
```

**When to Use:**
- New functions added
- Bug fixes (write failing test first)
- Refactoring (tests prevent regressions)

---

### 2. Integration Tests (15% of suite)

**Purpose:** Test multiple modules working together

**Characteristics:**
- Slower (10-100ms each)
- Uses real data (not mocks)
- Tests interactions between systems

**Example Locations:**
- Rust: `crates/resume-core/tests/`
- TypeScript: `app/api/**/__tests__/route.test.ts`

**When to Use:**
- Testing API routes
- Testing data pipelines
- Testing cross-module interactions

**Key Pattern:** Use actual `resume-data.json` to catch schema drift

---

### 3. Property-Based Tests (3% of suite)

**Purpose:** Validate invariants across random inputs

**Tool:** `proptest` (Rust)

**Example:**
```rust
proptest! {
    #[test]
    fn test_scoring_is_deterministic(
        priority in 1u8..=10,
        tags in prop::collection::vec(any::<String>(), 0..5)
    ) {
        // Same inputs → always same output
        let score1 = calculate_score(priority, &tags);
        let score2 = calculate_score(priority, &tags);
        assert_eq!(score1, score2);
    }
}
```

**When to Use:**
- Testing algorithms with mathematical invariants
- Validating bounds (scores must be 0-1)
- Finding edge cases humans miss

---

### 4. Permutation Tests (2% of suite)

**Purpose:** Test all combinations of a feature

**Example:** `crates/resume-core/tests/pdf_permutation.rs`

**What It Does:**
- Generates PDFs for all 6 role profiles
- Analyzes PDF size, generation time, page count
- Saves baseline PDFs for visual inspection
- Validates consistency across profiles

**When to Use:**
- Features with multiple variants (role profiles)
- Ensuring consistency across configurations
- Regression detection (compare to baselines)

---

## Test Organization Patterns

### Co-Located Tests (Rust)

```
src/
├── lib.rs
├── scoring.rs      // Contains #[cfg(test)] mod tests
└── selector.rs     // Contains #[cfg(test)] mod tests
```

**Advantages:**
- Tests close to implementation
- Easy to find relevant tests
- Clear module boundaries

### Adjacent Tests (TypeScript)

```
lib/
├── rate-limit.ts
└── __tests__/
    └── rate-limit.test.ts

components/
├── TagFilter.tsx
└── __tests__/
    └── TagFilter.test.tsx
```

**Advantages:**
- Clear separation of test code
- Easy to exclude from production builds
- Follows Next.js conventions

### Separate Integration Tests

```
crates/resume-core/tests/
├── common/          // Shared test utilities
│   └── mod.rs
├── integration_test.rs
├── roundtrip.rs
└── pdf_permutation.rs
```

**Advantages:**
- Heavy tests separated from fast unit tests
- Shared test utilities
- Can run independently

---

## Test Naming Conventions

### Rust

**Pattern:** `test_<what>_<scenario>`

**Examples:**
- `test_tag_relevance_perfect_match()`
- `test_company_multiplier_min_priority()`
- `test_select_bullets_respects_max_count()`

### TypeScript

**Pattern:** `it('should <expected behavior>')`

**Examples:**
- `it('should allow first request')`
- `it('should block requests after limit exceeded')`
- `it('should reset after window expires')`

**Key:** Test names should describe behavior, not implementation

---

## Coverage Philosophy

### Target Coverage by Category

| Category | Target | Rationale |
|----------|--------|-----------|
| **Core Business Logic** | 100% | Scoring, selection - mission critical |
| **API Routes** | 80%+ | User-facing, security critical |
| **Utilities** | 75%+ | Reusable, high leverage |
| **Components** | 60%+ | UI will be tested via E2E (planned - Phase 5.9) + unit |
| **Generated Code** | 0% | Don't test generated files |
| **Scripts** | 0% | Deployment tools, not production |

### What NOT to Test

**Excluded from Coverage:**
- Generated TypeScript types (`lib/types/generated-*.ts`)
- Next.js pages (`app/**/page.tsx` - integration tested)
- Static metadata (`app/icon.tsx`, `app/robots.ts`)
- Build scripts (`scripts/**`)
- WASM display components (browser tested)

**Rationale:** Not all code needs unit tests. UI components will be better tested with E2E (Phase 5.9 - Playwright). Deployment scripts tested in production.

---

## Security-Focused Testing

### XSS Prevention

**Test Pattern:**
```typescript
it('sanitizes javascript: protocol', () => {
  const malicious = '[Link](javascript:alert(1))'
  const sanitized = parseMarkdownLinks(malicious)
  expect(sanitized).not.toContain('javascript:')
})
```

### Rate Limiting

**Test Pattern:**
```typescript
it('blocks requests after limit exceeded', async () => {
  // Make 5 requests (limit)
  for (let i = 0; i < 5; i++) {
    await checkRateLimit(ip)
  }

  // 6th request should be blocked
  const result = await checkRateLimit(ip)
  expect(result.allowed).toBe(false)
})
```

### CAPTCHA Verification

**Test Pattern:** Mock Turnstile responses for both success and failure cases

---

## Test Data Strategy

### Real Data Testing

**Philosophy:** Integration tests use actual `resume-data.json`

**Why?**
- Catches schema mismatches immediately
- Validates with real structure complexity
- Detects drift between Rust ↔ TypeScript types

**Implementation:**
```rust
pub fn load_resume_data() -> ResumeData {
    // Loads actual data/resume-data.json
}
```

### Sanitized Test Data

**For sensitive data (contact info):**
```typescript
export async function loadSanitizedResumeData() {
  const data = await import('@/data/resume-data.json')
  // Replace real email with test@example.com
  return sanitize(data)
}
```

---

## Pre-Commit Testing Requirements

**NON-NEGOTIABLE:** Before ANY commit

1. ✅ `just test` - All tests pass
2. ✅ `just check` - TypeScript + Rust type checks
3. ✅ `cargo clippy --all -- -D warnings` - Zero warnings
4. ✅ `cargo fmt --check` - Code formatted
5. ✅ If types changed: `just types-sync`
6. ✅ If data changed: `just data-validate`

**Automated:** Pre-commit hooks enforce these requirements

---

## Test Execution Speed

**Targets:**
- Unit tests: <1ms each
- Integration tests: <100ms each
- Full suite: <10s total

**Why Speed Matters:**
- Enables continuous testing during development
- Fast feedback loop = TDD-friendly
- No excuse not to run frequently

**Current Performance:** See [METRICS.md](./METRICS.md) for measured speeds

---

## Mocking Strategy

### Rust: Minimal Mocking

**Philosophy:** Use real data where possible

**When to Mock:**
- External API calls (if any)
- File system operations (sometimes)

**Example:**
```rust
// Don't mock - use real data
let resume = load_resume_data();

// Mock only unavoidable external deps
```

### TypeScript: Strategic Mocking

**What to Mock:**
- Cloudflare Turnstile responses
- Environment variables (secrets)
- Fetch API (external services)
- Rate limit state (per-test isolation)

**What NOT to Mock:**
- Domain logic (test the real thing)
- Data structures (use real resume data)

**Implementation:**
```typescript
// Mock external dependency
export function mockTurnstileSuccess() {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => ({ success: true })
    })
  )
}

// Use real domain logic
import { scoreResumeBullet } from '@/lib/scoring'
const score = scoreResumeBullet(bullet, profile) // Real function
```

---

## Coverage Tools & Commands

### Rust Coverage

**Tool:** `cargo-llvm-cov`

**Installation:**
```bash
cargo install cargo-llvm-cov
```

**Commands:**
```bash
just coverage-rust        # Generate HTML report
just coverage-rust-open   # Open in browser
```

**Output:** `target/llvm-cov/html/index.html`

### TypeScript Coverage

**Tool:** Vitest built-in (v8)

**Configuration:** `vitest.config.ts`

**Commands:**
```bash
just coverage-ts          # Generate HTML report
just coverage-ts-open     # Open in browser
```

**Output:** `coverage/index.html`

---

## Test Fixtures & Helpers

### Shared Test Utilities (Rust)

**Location:** `crates/resume-core/tests/common/mod.rs`

**Utilities:**
```rust
pub fn get_project_root() -> PathBuf
pub fn get_resume_data_path() -> PathBuf
pub fn load_resume_data() -> ResumeData
```

**Self-Testing:** Utilities have their own tests

### Test Helpers (TypeScript)

**Location:** `lib/__tests__/helpers/`

**Utilities:**
- `mock-data.ts` - Resume data loading with sanitization
- `mock-fetch.ts` - HTTP mocking for Turnstile
- `mock-env.ts` - Environment variable mocking
- `rate-limit-helper.ts` - Rate limit cleanup

---

## Continuous Integration

### Pre-Commit Hooks

**Enforced via Husky + lint-staged:**
- ESLint auto-fix
- TypeScript type check
- Vitest run
- Coverage check
- Full build
- Rust formatting
- Rust clippy

**Total time:** ~37s per commit

### GitHub Actions

**Triggers:**
- Every push to main
- Every pull request

**Checks:**
- All tests pass
- Coverage thresholds met
- Type drift detection
- Build succeeds

---

## Future Testing Enhancements

### Planned Additions

1. **E2E Tests** (Playwright)
   - Full resume generation flow
   - CAPTCHA verification
   - PDF download
   - Error states

2. **Visual Regression**
   - PDF output comparison
   - Component snapshot testing

3. **Performance Benchmarks**
   - PDF generation time tracking
   - WASM load time monitoring

4. **Accessibility Testing**
   - axe-core for component accessibility
   - Keyboard navigation tests

---

## Related Documentation

- **[METRICS.md](./METRICS.md)** - Current test counts and coverage (auto-generated)
- **[CURRENT_PHASE.md](./CURRENT_PHASE.md)** - Active development phase
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design
- **[DATA_SCHEMA.md](./DATA_SCHEMA.md)** - Type system details

---

**Last Updated:** 2025-10-28
**Next Review:** Quarterly or when testing approach changes
**Owner:** Development team
