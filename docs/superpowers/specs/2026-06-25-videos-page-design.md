# Design: Video Portfolio Page (`/videos`)

**Date:** 2026-06-25
**Branch:** `feat/videos-page` (branched fresh from `main`)
**Status:** Approved design — pending implementation plan

---

## Goal

Add a new top-level page that showcases a video portfolio. For now it holds a
single embedded YouTube video, centered, working well on mobile and desktop.
The page must be a clean **base** that can grow to multiple videos later without
rework.

The video: <https://www.youtube.com/watch?v=fbFWHhN9E30> —
"The Interchain Developer Experience", a talk given at Cosmoverse
(Interchain Foundation).

---

## Decisions (locked with user)

| Decision     | Choice                                                                             |
| ------------ | ---------------------------------------------------------------------------------- |
| Route        | `/videos`                                                                          |
| Nav label    | `Videos`                                                                           |
| Nav icon     | `Clapperboard` (from `lucide-react`, the set already in use)                       |
| Embed style  | Standard responsive 16:9 iframe via `youtube-nocookie.com`                         |
| Page heading | `Video Portfolio`                                                                  |
| Caption      | `The Interchain Developer Experience — talk at Cosmoverse · Interchain Foundation` |

---

## Approach

**Chosen:** a small, reusable presentational `YouTubeEmbed` component consumed by
a thin `app/videos/page.tsx`.

Alternatives considered and rejected:

- **Inline iframe directly in the page** — fewer files, but the page does more,
  is harder to unit-test, and adding video #2 means duplicating embed markup.
- **Third-party lib** (`lite-youtube-embed`, `react-youtube`) — adds a dependency
  and bundle weight for what is one iframe. Overkill.

The component approach keeps every file well under the 250 effective-line cap,
is independently unit-testable, and makes adding more videos trivial.

---

## Components & files

### 1. `components/ui/YouTubeEmbed.tsx` (new)

Presentational, server-compatible (no `"use client"`).

- **Props:** `{ videoId: string; title: string; className?: string }`
- **Structure:**
  - Outer wrapper: `max-w-4xl mx-auto` (caps width on desktop, centers).
  - Aspect box: `relative aspect-video w-full overflow-hidden rounded-2xl`
    plus a subtle border/ring so it reads as a framed surface in light + dark.
  - `<iframe className="absolute inset-0 h-full w-full">` filling the box.
- **Source:** `https://www.youtube-nocookie.com/embed/{videoId}` (privacy domain —
  no YouTube cookies until playback).
- **Iframe attributes:** `title={title}` (a11y), `loading="lazy"`,
  `allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`,
  `allowFullScreen`, `referrerPolicy="strict-origin-when-cross-origin"`.
- Full TSDoc with an `@example` block (mandatory per AGENTS.md).

### 2. `app/videos/page.tsx` (new)

Server component, mirroring the shell of `app/resume/page.tsx`.

- `<main className="min-h-screen">` → centered `max-w-5xl mx-auto px-4 md:px-8 py-16`.
- `<h1>` "Video Portfolio" using the same heading styling as the resume page
  (`text-4xl font-bold tracking-tight ...`), centered, with breathing room below.
- `<YouTubeEmbed videoId="fbFWHhN9E30" title="The Interchain Developer Experience — talk at Cosmoverse" />`.
- Caption below the embed: muted, centered
  (`text-sm text-slate-600 dark:text-slate-400`), reading
  `The Interchain Developer Experience — talk at Cosmoverse · Interchain Foundation`.
- Exports a per-page `metadata` object (title + description) like `layout.tsx`.

### 3. `components/ui/Navbar.tsx` (edit)

- Import `Clapperboard` from `lucide-react`.
- Add `{ href: "/videos", label: "Videos", icon: Clapperboard }` to the `links`
  array (after Experience).
- No other change — the existing map handles icon-only on mobile, icon+label at
  ≥`sm`, and the active glass-pill state automatically.

### 4. `proxy.ts` (edit) — the one infra change

The current CSP locks `frame-src`/`child-src` to Cloudflare only, which would
**block the YouTube iframe**. Add the nocookie domain:

- `frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com;`
- `child-src https://challenges.cloudflare.com https://www.youtube-nocookie.com;`

No other CSP directive needs changing:

- `img-src` already allows `https:` (thumbnails fine).
- Fullscreen is already permitted (Permissions-Policy does not restrict it).
- The iframe's own network requests run under the iframe's origin, not our
  page's `connect-src`.

---

## Responsive behavior

- `aspect-video` guarantees a perfect 16:9 ratio at every viewport width — no
  fixed pixel heights, no letterboxing math.
- `max-w-4xl` caps and centers the video on desktop; on mobile it is full-bleed
  within the page's horizontal padding.
- Heading and caption are centered and scale with existing Tailwind type sizes.
- Verified in both light and dark themes.

---

## Testing & verification

### Unit (TDD — test first)

A Vitest + `@testing-library/react` test for `YouTubeEmbed` asserting:

- the iframe `src` is `https://www.youtube-nocookie.com/embed/<videoId>`,
- the `title` attribute matches the prop,
- `loading="lazy"` and `allowFullScreen` are present,
- the aspect-ratio wrapper class is applied.

Write the test before the component, watch it fail, then implement.

### Visual loop (subagent-driven)

1. Start the dev server on `:3002` (`just dev`).
2. Dispatch a Playwright subagent (Playwright is already a dev dependency) to:
   - load `/videos` at **mobile (375×812)** and **desktop (1280×800)**,
   - in **light and dark** themes,
   - screenshot each, and verify: the nav shows the Clapperboard icon, the iframe
     is present and centered, the frame is 16:9 with no horizontal overflow/scroll,
     and the caption is legible.
3. Subagent reports issues → fix → re-run until clean.

### Gate (must pass, no hook bypass)

- `just check` (fmt + TypeScript + Rust + lint).
- Existing test suite (`just test`) stays green.
- File-length, no-`console.log`, and TSDoc rules satisfied.

---

## Git

- Already branched: `main` → `git pull` (up to date) → `feat/videos-page`.
- Local tooling changes (`.claude/settings.json`, `.gitignore`) carried over and
  will be committed separately from / excluded from the feature commits as
  appropriate.
- Conventional commits throughout (`feat(ui): ...`, `docs: ...`).

---

## Out of scope (YAGNI)

- A multi-video gallery/grid, playlists, or filtering — the page is built to
  extend, but only one video is added now.
- Click-to-play facade / lazy-thumbnail loading — considered, not chosen.
- Any backend/API, analytics events, or data-model changes.
