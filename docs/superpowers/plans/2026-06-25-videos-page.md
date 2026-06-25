# Video Portfolio Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/videos` page showing one centered, responsive YouTube embed, reachable from a new Clapperboard nav entry.

**Architecture:** A small reusable presentational `YouTubeEmbed` component (responsive 16:9 `youtube-nocookie` iframe) consumed by a thin server-component page. The site CSP is widened to allow the nocookie frame; the navbar gains one link entry.

**Tech Stack:** Next.js 16 (App Router, server components), React 19, TypeScript 5, Tailwind 4, lucide-react, Vitest + @testing-library/react, Playwright (visual checks).

## Global Constraints

- Max **250 effective lines** per file (blank + comment lines skipped; enforced by ESLint `max-lines`). No `eslint-disable max-lines`.
- Every exported function/type gets **TSDoc with an `@example`** block.
- No `console.log` (use `console.warn`/`console.error`).
- **Conventional commits**: `<type>(<scope>)?: <subject>`, lowercase imperative subject, no trailing period.
- **Never bypass git hooks** (`--no-verify`, `HUSKY=0`, etc.). Fix root cause.
- Embed domain is **`https://www.youtube-nocookie.com`** (privacy domain), not `youtube.com`.
- Video id: `fbFWHhN9E30`. Caption: `The Interchain Developer Experience — talk at Cosmoverse · Interchain Foundation`. iframe `title`: `The Interchain Developer Experience — talk at Cosmoverse`.
- Tests run via `just test-ts` (or `bun run test`). Full gate: `just check`.

---

### Task 1: `YouTubeEmbed` component

**Files:**

- Create: `components/ui/YouTubeEmbed.tsx`
- Test: `components/__tests__/YouTubeEmbed.test.tsx`

**Interfaces:**

- Consumes: `cn` from `@/lib/utils`.
- Produces: `export function YouTubeEmbed(props: YouTubeEmbedProps)` and `export interface YouTubeEmbedProps { videoId: string; title: string; className?: string }`. Renders a centered `max-w-4xl` wrapper containing a `relative aspect-video` box with an absolutely-filled `<iframe>` whose `src` is `https://www.youtube-nocookie.com/embed/${videoId}`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/__tests__/YouTubeEmbed.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { YouTubeEmbed } from "../ui/YouTubeEmbed";

describe("YouTubeEmbed", () => {
  it("renders a privacy-domain iframe for the given videoId", () => {
    render(<YouTubeEmbed videoId="abc123" title="My talk" />);
    const frame = screen.getByTitle("My talk");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/abc123");
  });

  it("lazy-loads and allows fullscreen", () => {
    render(<YouTubeEmbed videoId="abc123" title="My talk" />);
    const frame = screen.getByTitle("My talk");
    expect(frame).toHaveAttribute("loading", "lazy");
    expect(frame).toHaveAttribute("allowfullscreen");
  });

  it("wraps the iframe in a 16:9 aspect box and centered max-width wrapper", () => {
    const { container } = render(<YouTubeEmbed videoId="abc123" title="My talk" />);
    // Outer wrapper centers + caps width.
    expect(container.firstChild).toHaveClass("mx-auto", "max-w-4xl");
    // Aspect box enforces 16:9.
    const aspectBox = container.querySelector(".aspect-video");
    expect(aspectBox).not.toBeNull();
  });

  it("merges a caller-supplied className onto the wrapper", () => {
    const { container } = render(
      <YouTubeEmbed videoId="abc123" title="My talk" className="mt-10" />,
    );
    expect(container.firstChild).toHaveClass("mt-10");
  });
});
```

> Note: `toHaveAttribute`/`toHaveClass` come from `@testing-library/jest-dom`, wired in `vitest.setup.ts` (same as `Button.test.tsx`). The lowercase `toHaveAttribute("allowfullscreen")` matches the rendered DOM attribute for React's `allowFullScreen`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- YouTubeEmbed`
Expected: FAIL — `Failed to resolve import "../ui/YouTubeEmbed"` (module does not exist yet).

- [ ] **Step 3: Write the component**

```tsx
// components/ui/YouTubeEmbed.tsx
import { cn } from "@/lib/utils";

/** Props for {@link YouTubeEmbed}. */
export interface YouTubeEmbedProps {
  /** The YouTube video id (the `v=` value), e.g. `"fbFWHhN9E30"`. */
  videoId: string;
  /** Accessible title for the iframe — announced to screen readers. */
  title: string;
  /** Extra classes merged onto the outer (centering) wrapper. */
  className?: string;
}

/**
 * Responsive, privacy-friendly YouTube embed.
 *
 * Renders a centered, width-capped 16:9 iframe via `youtube-nocookie.com`
 * (no YouTube cookies until the viewer presses play). The aspect ratio is
 * held by Tailwind's `aspect-video`, so it scales cleanly from mobile to
 * desktop with no fixed pixel heights.
 *
 * Note: the embed requires `frame-src https://www.youtube-nocookie.com` in
 * the site CSP (see `proxy.ts`) or the iframe is blocked at runtime.
 *
 * @example
 * <YouTubeEmbed videoId="fbFWHhN9E30" title="The Interchain Developer Experience" />
 */
export function YouTubeEmbed({ videoId, title, className }: YouTubeEmbedProps) {
  // Privacy domain: defers all YouTube cookies/tracking until playback.
  const src = `https://www.youtube-nocookie.com/embed/${videoId}`;

  return (
    <div className={cn("mx-auto w-full max-w-4xl", className)}>
      {/* aspect-video locks 16:9; the iframe fills it absolutely. */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-700/70 shadow-[0_8px_30px_-12px_oklch(0.30_0.04_240/0.25)]">
        <iframe
          src={src}
          title={title}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- YouTubeEmbed`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/YouTubeEmbed.tsx components/__tests__/YouTubeEmbed.test.tsx
git commit -m "feat(ui): add responsive YouTubeEmbed component"
```

---

### Task 2: Allow the nocookie frame in CSP

**Files:**

- Modify: `proxy.ts` (the `Content-Security-Policy` header, ~lines 145-156)

**Interfaces:**

- Consumes: nothing.
- Produces: a CSP whose `frame-src` and `child-src` include `https://www.youtube-nocookie.com` alongside the existing `https://challenges.cloudflare.com`.

> `proxy.ts` is excluded from unit-test coverage and is middleware (no unit test). It is verified by header inspection here and by the visual loop in Task 4. **Restart the dev server after this change** — proxy edits are not hot-reloaded.

- [ ] **Step 1: Edit the CSP `frame-src` line**

Change:

```ts
      "frame-src https://challenges.cloudflare.com; " +
```

to:

```ts
      "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com; " +
```

- [ ] **Step 2: Edit the CSP `child-src` line**

Change:

```ts
      "child-src https://challenges.cloudflare.com;",
```

to:

```ts
      "child-src https://challenges.cloudflare.com https://www.youtube-nocookie.com;",
```

- [ ] **Step 3: Verify type/lint stays clean**

Run: `bun run lint && bunx tsc --noEmit` (or `just check` later in Task 4).
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add proxy.ts
git commit -m "fix(security): allow youtube-nocookie frames in CSP"
```

---

### Task 3: `/videos` page + navbar entry

**Files:**

- Create: `app/videos/page.tsx`
- Modify: `components/ui/Navbar.tsx` (import + `links` array, ~lines 6 & 32-36)

**Interfaces:**

- Consumes: `YouTubeEmbed` from Task 1; `Clapperboard` from `lucide-react`.
- Produces: a route at `/videos`; a navbar link `{ href: "/videos", label: "Videos", icon: Clapperboard }`.

> Pages and Navbar are excluded from unit-test coverage by `vitest.config` (integration/E2E-tested). They are verified by the visual loop in Task 4.

- [ ] **Step 1: Create the page**

```tsx
// app/videos/page.tsx
import type { Metadata } from "next";

import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";

/** Per-page metadata for the video portfolio route. */
export const metadata: Metadata = {
  title: "Video Portfolio",
  description: "Talks and video highlights — Oliver Gilbey.",
};

/**
 * Video portfolio page.
 *
 * A clean base that currently shows a single centered, responsive YouTube
 * embed with a caption. Built to extend to multiple videos later without
 * structural change.
 */
export default function VideosPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-16">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
            Video Portfolio
          </h1>
        </div>

        <YouTubeEmbed
          videoId="fbFWHhN9E30"
          title="The Interchain Developer Experience — talk at Cosmoverse"
        />

        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          The Interchain Developer Experience — talk at Cosmoverse · Interchain Foundation
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add the navbar import**

In `components/ui/Navbar.tsx`, change:

```ts
import { Home, Briefcase, Eye } from "lucide-react";
```

to:

```ts
import { Home, Briefcase, Eye, Clapperboard } from "lucide-react";
```

- [ ] **Step 3: Add the navbar link**

Change the `links` array:

```ts
const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/resume", label: "Resume", icon: Briefcase },
  { href: "/resume/view", label: "Experience", icon: Eye },
];
```

to:

```ts
const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/resume", label: "Resume", icon: Briefcase },
  { href: "/resume/view", label: "Experience", icon: Eye },
  { href: "/videos", label: "Videos", icon: Clapperboard },
];
```

- [ ] **Step 4: Smoke-check the route compiles**

Run: `bunx tsc --noEmit`
Expected: no errors. (Full visual check is Task 4.)

- [ ] **Step 5: Commit**

```bash
git add app/videos/page.tsx components/ui/Navbar.tsx
git commit -m "feat(ui): add /videos page with navbar entry"
```

---

### Task 4: Verification loop + full gate

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server (fresh, so the new proxy CSP is active)**

Run: `just dev` (serves on `:3002`). Run in background.

- [ ] **Step 2: Dispatch a Playwright subagent for visual verification**

The subagent writes a throwaway Playwright script (Chromium) under the scratchpad and checks `http://localhost:3002/videos`:

- viewports: mobile **375×812** and desktop **1280×800**;
- themes: light and dark (toggle via the `dark` class / theme toggle);
- assertions: nav shows the Clapperboard icon and links to `/videos`; the iframe (`youtube-nocookie.com/embed/fbFWHhN9E30`) is present and visible; the embed is centered with no horizontal overflow (`document.documentElement.scrollWidth <= clientWidth`); the caption text is visible.
- It captures one screenshot per (viewport × theme) and reports PASS/FAIL with concrete observations + screenshot paths.

Fix any issues found, then re-dispatch until clean.

- [ ] **Step 3: Confirm no CSP console errors**

In the subagent run, collect browser console messages and assert there is no `Content Security Policy` / `Refused to frame` error for `youtube-nocookie.com`.

- [ ] **Step 4: Run the full gate**

Run: `just check`
Expected: fmt + TypeScript + Rust + lint all pass.

Run: `just test`
Expected: all tests pass (including the new `YouTubeEmbed` tests).

- [ ] **Step 5: Final commit (only if Step 4 produced fmt/lint fixes)**

```bash
git add -A
git commit -m "chore: formatting and lint fixes for /videos page"
```

---

## Self-Review

**Spec coverage:**

- `/videos` route → Task 3. ✔
- `YouTubeEmbed` component (nocookie, 16:9, lazy, fullscreen, a11y title) → Task 1. ✔
- Navbar `Videos` + `Clapperboard` entry → Task 3. ✔
- CSP `frame-src`/`child-src` widening → Task 2. ✔
- Heading + caption copy (exact strings) → Task 3 + Global Constraints. ✔
- Responsive 16:9, centered, light+dark → Task 1 (component) + Task 4 (visual proof). ✔
- TDD unit test → Task 1. ✔
- Visual subagent loop + `just check`/`just test` gate → Task 4. ✔

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. ✔

**Type consistency:** `YouTubeEmbedProps { videoId, title, className? }` defined in Task 1 and consumed with exactly those prop names in Task 3. iframe `title` string and caption string match the Global Constraints verbatim. ✔
