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
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-12">
      <GlassPanel padding="xl" radius="2xl">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">About Me</h2>
        <div className="prose prose-slate max-w-none">
          <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed mb-4">
            {summary ||
              `Professional with expertise in various domains. Based in ${location || "various locations"}.`}
          </p>
          {interests && interests.length > 0 && (
            <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed">
              When not working, you&apos;ll find me exploring: {interests.join(", ")}.
            </p>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
