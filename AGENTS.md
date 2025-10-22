# Repository Guidelines

## Project Structure & Module Organization
Resumate runs on Next.js 15 + TypeScript. `app/` owns route trees (`app/resume` powers the explorer). Shared UI lives in `components/`—domain widgets under `components/data`, primitives under `components/ui`—while providers stay in `contexts/` and helpers in `lib/`. Resume schema validation sits in `schema/resume.ts`; actual content belongs in `data/resume-data.json` (never commit personal copies). `doc-gen/` houses the Rust→WASM toolchain for document output, and `scripts/` holds Node utilities for GitHub Gist sync.

## Build, Test, and Development Commands
Use `npm run dev` for the Turbopack development server on `http://localhost:3000`. `npm run build` triggers the `prebuild` gist sync and compiles the production bundle; smoke-test with `npm run start`. `npm run lint` runs the flat ESLint config across `.ts/.tsx`. `npm run test`, `npm run test:watch`, and `npm run test:ui` execute the Vitest suite—append `--runTestsByPath` to isolate specs. Data workflows rely on `npm run data:pull`, `npm run data:push`, and `npm run data:view`.

## Coding Style & Naming Conventions
Keep components as typed React function components with PascalCase filenames. Place hooks and pure helpers in `lib/` using camelCase exports and share state via `contexts/`. Favor Tailwind utility classes; extend tokens in `app/globals.css` when design shifts are unavoidable. Resolve ESLint findings with `npm run lint -- --fix` before review. For Rust updates in `doc-gen/`, run `cargo fmt --all` and `cargo clippy --all -- -D warnings`.

## Testing Guidelines
Vitest runs in JSDOM with Testing Library helpers (`vitest.setup.ts`). Name specs `*.test.tsx` inside `__tests__` near the source and use the `@/` alias to mirror runtime imports. Cover explorer filtering, schema validation, and data transforms; add lightweight fixtures beside the tests. Run `npm run test` before pushing and note any intentional skips.

## Commit & Pull Request Guidelines
Follow the conventional commit style seen in history (`feat:`, `fix:`, `docs:`) with subjects under ~70 characters and optional descriptive bodies. Pull requests should link issues or roadmap phases, summarize functional impact, and attach UI screenshots or GIFs when visuals change. Confirm local lint and test runs, and list manual reviewer steps (e.g., Turnstile keys, gist sync).
