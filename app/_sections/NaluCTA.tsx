/**
 * Nalu CTA — the "product chip" third hero call-to-action.
 *
 * A waveAqua2-tinted glass card holding a full-width aqua {@link Button}
 * ("🌊 Try Nalu") with a short pitch beneath it. Sits below the two neutral
 * contact CTAs in the hero column; the lone aqua tint is what draws the eye,
 * while the pitch — not the button label — carries the "what is this" so the
 * pill stays a crisp verb.
 *
 * The card uses 5px padding and a 29px corner so its radius stays concentric
 * with the inner pill's `rounded-full` corner (24px inner + 5px padding), and
 * its corner curvature reads as one family with the `lg` pills above it.
 *
 * Nalu = "wave" in Hawaiian, which is why the Kanagawa wave accent (aqua,
 * hue 175) is the natural tint here.
 *
 * @module app/_sections/NaluCTA
 */
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** Public URL of the Nalu learning app. Opened in a new tab. */
const NALU_URL = "https://nalu.ollie.gg";

/**
 * Static aqua "product chip" linking out to the Nalu app.
 *
 * Intended as the third item in the hero CTA column (after "Get Contact Card"
 * and "Book in my Cal"), so it inherits that column's `w-[230px]` width.
 *
 * @returns The aqua glass Nalu CTA card.
 *
 * @example
 * <div className="flex flex-col gap-2.5 md:w-[230px]">
 *   <Button>Get Contact Card</Button>
 *   <NaluCTA />
 * </div>
 */
export function NaluCTA() {
  return (
    // Aqua glass card — 5px pad / 29px radius keeps the frame concentric with
    // the inner pill. Aqua wash + border + soft aqua glow, tuned per theme.
    <div
      className={cn(
        "rounded-[29px] p-[5px]",
        "border border-[oklch(0.66_0.05_175/0.45)] dark:border-[oklch(0.78_0.06_175/0.35)]",
        "bg-[linear-gradient(180deg,oklch(0.90_0.05_175/0.45),oklch(0.85_0.06_175/0.55))]",
        "dark:bg-[linear-gradient(180deg,oklch(0.40_0.05_175/0.22),oklch(0.30_0.05_175/0.30))]",
        "shadow-[0_10px_30px_-16px_oklch(0.66_0.06_175/0.5)] dark:shadow-[0_10px_30px_-16px_oklch(0.70_0.08_175/0.7)]",
      )}
    >
      {/* The pill is the link itself (a single interactive element). Slightly
          shorter than the lg CTAs above (h-12 vs 54px) so it reads as nested. */}
      <Button
        as="a"
        href={NALU_URL}
        target="_blank"
        rel="noopener noreferrer"
        variant="aqua"
        size="lg"
        className="w-full h-12 text-sm"
        aria-label="Try Nalu — Duolingo for Anything (opens in a new tab)"
      >
        <span aria-hidden="true">🌊</span>
        <span>Try Nalu</span>
      </Button>

      {/* Pitch — bold hook on its own line, description beneath. Aqua-tinted to
          tie into the card; the button label, not this copy, is the CTA. */}
      <p className="px-2 pt-2 pb-1 text-center text-xs leading-relaxed text-[oklch(0.42_0.05_175)] dark:text-[oklch(0.84_0.04_175)]">
        <span className="block font-semibold text-[oklch(0.34_0.07_175)] dark:text-[oklch(0.92_0.05_175)]">
          Duolingo for Anything.
        </span>
        A side project turning any topic into a gamified, AI-built course with progress-tracking.
      </p>
    </div>
  );
}
