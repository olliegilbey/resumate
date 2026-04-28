import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

const iconBadgeVariants = cva("flex items-center justify-center rounded-lg", {
  variants: {
    size: {
      sm: "w-6 h-6",
      md: "w-8 h-8",
      lg: "w-10 h-10",
    },
    variant: {
      default: "bg-slate-100 dark:bg-slate-700",
      // Kanagawa aqua-green soft. Used for icon containers in cards.
      primary: "bg-aqua-soft",
      // Steel-blue accent (replaces previous purple — design system v2 drops purple).
      secondary: "bg-steel-soft",
      success: "bg-aqua-soft",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "default",
  },
});

export interface IconBadgeProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof iconBadgeVariants> {}

const IconBadge = forwardRef<HTMLDivElement, IconBadgeProps>(
  ({ className, size, variant, ...props }, ref) => {
    return (
      <div className={cn(iconBadgeVariants({ size, variant, className }))} ref={ref} {...props} />
    );
  },
);
IconBadge.displayName = "IconBadge";

export { IconBadge, iconBadgeVariants };
