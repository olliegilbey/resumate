# Testing Strategy

## Setup

- **Framework**: Vitest (fast, ESM-native, Vite-compatible)
- **Component Testing**: @testing-library/react
- **Environment**: jsdom (for React components)

## Running Tests

```bash
npm test              # Run once
just test-ts-watch    # Watch mode
just test-ts-ui       # Visual UI (install @vitest/ui if needed)
```

## Structure

```
lib/__tests__/
├── fixtures/
│   └── resume-data.fixture.ts    # Mock resume data (doesn't rely on gist)
├── tags.test.ts                  # Tag extraction/coloring tests
└── README.md                     # This file
```

## Testing Philosophy

**Current Approach** (Barebones):
- ✅ Test pure functions (tag utilities, vCard generation, etc.)
- ✅ Use fixtures instead of gist data for deterministic tests
- ⏸️  Component tests deferred until UX stabilizes
- ❌ No E2E tests yet (too early in development)

**Future Additions**:
- Component smoke tests when UI stabilizes
- Rust unit tests (`cargo test`) for WASM logic
- Permutation testing for resume generation variants

## Fixtures

Test fixtures are in `fixtures/` directory and provide:
- **Deterministic data** - Tests don't break when gist changes
- **Minimal examples** - Fast test execution
- **Type safety** - Uses same TypeScript types as production

## Rust Testing Integration

When we add Rust/WASM:
- Rust tests live in `rust-wasm/` directory
- Run with `cargo test`
- WASM bindings tested via Vitest after compilation
- Permutation tests will validate all resume generation combinations
