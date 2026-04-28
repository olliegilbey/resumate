/**
 * Monogram — circular Kanagawa-tinted glass orb.
 *
 * Used as the navbar logo (and visually mirrored by the favicon at
 * `app/icon.tsx`). Built from the same backdrop-blur + tinted wash + specular
 * layering as {@link Button}, just rounded to a circle and filled with a conic
 * blend of the three Kanagawa hues (sakuraPink → waveAqua2 → crystalBlue).
 *
 * @module components/ui/Monogram
 */
import { cn } from "@/lib/utils";

interface MonogramProps {
  /** 1-2 character label rendered inside the orb (e.g., "OG"). */
  initials: string;
  /** Pixel diameter. Defaults to 32 (navbar size). */
  size?: number;
  className?: string;
}

/**
 * Renders a glassy, gradient-tinted circular badge with initials.
 *
 * @example
 * <Monogram initials="OG" />
 * <Monogram initials="JD" size={48} />
 */
export function Monogram({ initials, size = 32, className }: MonogramProps) {
  return (
    <div
      className={cn(
        "relative isolate inline-flex items-center justify-center rounded-full",
        "shadow-[0_4px_10px_-4px_oklch(0.30_0.04_240/0.18),0_1px_1px_oklch(0.30_0.04_240/0.10)]",
        "dark:shadow-[0_4px_10px_-4px_oklch(0_0_0/0.5),0_1px_1px_oklch(0_0_0/0.3)]",
        "text-[oklch(0.20_0.010_250)] dark:text-[oklch(0.97_0.005_250)]",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {/* Layer 1 — backdrop blur (matches buttons + cards). */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden rounded-full",
          "[backdrop-filter:blur(8px)_saturate(140%)] [-webkit-backdrop-filter:blur(8px)_saturate(140%)]",
        )}
      />
      {/* Layer 2 — Kanagawa conic gradient blending all three hues. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full",
          // Light values default; dark values override under .dark.
          "bg-[conic-gradient(from_220deg,oklch(0.78_0.09_0/0.70),oklch(0.82_0.05_175/0.70),oklch(0.80_0.07_265/0.70),oklch(0.78_0.09_0/0.70))]",
          "dark:bg-[conic-gradient(from_220deg,oklch(0.55_0.10_0/0.65),oklch(0.58_0.06_175/0.65),oklch(0.58_0.10_265/0.65),oklch(0.55_0.10_0/0.65))]",
        )}
      />
      {/* Layer 3 — specular highlight + thin border (the glass-bubble cue). */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full",
          "shadow-[inset_0_1px_0_0_oklch(1_0_0/0.65),inset_0_0_0_1px_oklch(1_0_0/0.30),inset_0_-1px_0_0_oklch(0.30_0.04_240/0.10)]",
          "dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.30),inset_0_0_0_1px_oklch(1_0_0/0.08),inset_0_-1px_0_0_oklch(0_0_0/0.20)]",
        )}
      />
      <span
        className="relative z-[1] font-semibold tracking-[0.04em] leading-none"
        style={{ fontSize: Math.max(11, Math.round(size * 0.34)) }}
      >
        {initials}
      </span>
    </div>
  );
}
