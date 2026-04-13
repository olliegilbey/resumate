/**
 * "Looking to Hire?" recruiter call-to-action section.
 *
 * Linked to the /resume page (experience explorer + download flow).
 *
 * @module app/_sections/RecruiterCTA
 */

import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";

/**
 * Static recruiter-focused CTA panel for the landing page.
 */
export function RecruiterCTA() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 pb-16">
      <GlassPanel padding="xl" radius="2xl" align="center">
        <Briefcase className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
          Looking to Hire?
        </h2>
        <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-lg mx-auto">
          View my full professional experience, download my resume, or explore my work history
          interactively.
        </p>
        <Link href="/resume">
          <Button size="lg" variant="gradient">
            View Professional Profile
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </GlassPanel>
    </div>
  );
}
