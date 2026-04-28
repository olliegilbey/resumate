/**
 * "Looking to Hire?" recruiter call-to-action section.
 *
 * Renders only the GlassPanel — the calling page is responsible for the
 * outer container so it can align the panel with sibling sections (e.g.,
 * the About panel right-shifted asymmetric column on the landing page).
 *
 * @module app/_sections/RecruiterCTA
 */

import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";

/** Static recruiter-focused CTA panel for the landing page. */
export function RecruiterCTA() {
  return (
    <GlassPanel padding="xl" align="center">
      <Briefcase className="h-12 w-12 text-aqua mx-auto mb-4" aria-hidden="true" />
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
        Looking to Hire?
      </h2>
      <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-lg mx-auto">
        View my full professional experience, download my resume, or explore my work history
        interactively.
      </p>
      <Link href="/resume">
        <Button size="lg" variant="primary">
          <span>View Professional Profile</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </Link>
    </GlassPanel>
  );
}
