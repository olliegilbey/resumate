import type { Metadata } from "next";

import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";
import resumeData from "@/data/resume-data.json";

/**
 * Per-page metadata for the video portfolio route.
 *
 * A child `title` string fully overrides the root layout's branded title, so
 * we self-brand here with the owner's name (sourced from `resumeData`, same as
 * `layout.tsx`) to keep tab/social titles consistent across pages. The
 * description summarises the page (a growing portfolio), not the single current
 * video — so it stays accurate as more videos are added.
 */
export const metadata: Metadata = {
  title: `Video Portfolio · ${resumeData.personal.name}`,
  description: `Conference talks and video highlights from ${resumeData.personal.name}.`,
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
