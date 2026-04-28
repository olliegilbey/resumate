/**
 * GlassPanel — refined liquid-glass surface.
 *
 * Pure CSS layered specular + edge inner shadow + saturation boost. Same
 * mechanism as the {@link Button} pill, used everywhere a content surface
 * needs the chrome look (about panels, resume cards, stat boxes).
 *
 * The visual treatment lives in the `.glass` utility (see globals.css).
 *
 * @module components/ui/GlassPanel
 */
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

const glassPanelVariants = cva("glass", {
  variants: {
    padding: {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
      xl: "p-8 md:p-10",
    },
    align: {
      start: "",
      center: "text-center",
    },
    // Radii ladder — `3xl` (28px) matches the lg pill button's corner curvature.
    radius: {
      lg: "rounded-xl",
      "2xl": "rounded-2xl",
      "3xl": "rounded-[28px]",
    },
  },
  defaultVariants: {
    padding: "md",
    align: "start",
    // 28px corner ladder matches the lg pill button — default for system v2.
    radius: "3xl",
  },
});

export interface GlassPanelProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof glassPanelVariants> {}

const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, padding, align, radius, ...props }, ref) => {
    return (
      <div
        className={cn(glassPanelVariants({ padding, align, radius, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
GlassPanel.displayName = "GlassPanel";

export { GlassPanel, glassPanelVariants };
