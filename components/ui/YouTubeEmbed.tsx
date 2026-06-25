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
 * Security: the iframe is sandboxed to deny the third-party player the
 * default full browser-context access. The granted tokens are the minimum the
 * YouTube player needs to stay functional — `allow-scripts`/`allow-same-origin`
 * for the player itself (cross-origin, so it cannot escape to *our* origin),
 * `allow-presentation` for fullscreen/PiP, and `allow-popups` +
 * `allow-popups-to-escape-sandbox` so "Watch on YouTube"/share still open.
 * Notably absent: top-navigation, forms, pointer-lock, and plugins.
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
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  );
}
