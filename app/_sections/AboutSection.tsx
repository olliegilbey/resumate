/**
 * "About Me" landing-page section.
 *
 * Renders the summary paragraph and optional interests list from the resume
 * data. Pure presentational — no client state or analytics.
 *
 * @module app/_sections/AboutSection
 */

import { GlassPanel } from "@/components/ui/GlassPanel";

interface AboutSectionProps {
  summary?: string | null;
  interests?: readonly string[] | null;
  location?: string | null;
}

/**
 * Static About Me panel for the landing page.
 *
 * @param summary - Pre-written summary paragraph; falls back to a generic
 *   description that mentions the location when absent.
 * @param interests - Optional list of personal interests.
 * @param location - Used only for the fallback summary text.
 */
export function AboutSection({ summary, interests, location }: AboutSectionProps) {
  return (
    <GlassPanel padding="xl" radius="3xl">
      <div className="text-[11px] font-semibold tracking-[0.05em] uppercase text-slate-500 dark:text-slate-400 mb-3">
        About
      </div>
      <p className="text-[15px] leading-[1.6] text-slate-700 dark:text-slate-200 [text-wrap:pretty] mb-4">
        {summary ||
          `Professional with expertise in various domains. Based in ${location || "various locations"}.`}
      </p>
      {interests && interests.length > 0 && (
        <p className="text-[15px] leading-[1.6] text-slate-700 dark:text-slate-200 [text-wrap:pretty]">
          When not working, you&apos;ll find me exploring: {interests.join(", ")}.
        </p>
      )}
    </GlassPanel>
  );
}
