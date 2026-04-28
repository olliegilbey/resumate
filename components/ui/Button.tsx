/**
 * Button — tinted glass pill.
 *
 * Each variant is a different colored piece of glass: a backdrop-blurred,
 * tinted, layered surface with a thin top specular and a thin bottom inner
 * shadow. Same render mechanism as `GlassPanel` (no SVG displacement —
 * cleaner against gradient backdrops).
 *
 * Variant mapping (design system v2):
 * - `primary`  → clear/neutral glass (the lead CTA reads as crystalline)
 * - `secondary`→ steel-blue accent glass
 * - `outline`  → steel-blue accent glass (back-compat)
 * - `gradient` → clear/neutral glass (back-compat for existing call sites)
 *
 * @module components/ui/Button
 */
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

// Per-tint layer classes. Light values default, dark values override under
// the global `.dark` variant (configured in globals.css via @variant dark).
const tintWashClasses: Record<"neutral" | "accent", string> = {
  // Clear glass — primary CTA. Light wash so the backdrop reads through.
  neutral: cn(
    "bg-[linear-gradient(180deg,oklch(1_0_0/0.30),oklch(0.96_0.005_240/0.22))]",
    "dark:bg-[linear-gradient(180deg,oklch(0.42_0.012_250/0.28),oklch(0.30_0.010_250/0.32))]",
  ),
  // Steel-blue glass — secondary CTA, replaces previous purple gradient.
  accent: cn(
    "bg-[linear-gradient(180deg,oklch(0.70_0.14_240/0.18),oklch(0.62_0.14_240/0.22))]",
    "dark:bg-[linear-gradient(180deg,oklch(0.70_0.14_240/0.24),oklch(0.62_0.14_240/0.30))]",
  ),
};

const tintFgClasses: Record<"neutral" | "accent", string> = {
  neutral: "text-[oklch(0.22_0.012_250)] dark:text-[oklch(0.96_0.003_250)]",
  accent: "text-[oklch(0.22_0.08_240)] dark:text-[oklch(0.96_0.04_240)]",
};

const buttonVariants = cva(
  cn(
    "relative isolate inline-flex items-center justify-center whitespace-nowrap rounded-full",
    "font-semibold tracking-tight",
    "transition-[transform,box-shadow] duration-200 ease-out",
    "active:translate-y-px",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    // Token-based so dark mode picks up the --accent-steel override from globals.css.
    "focus-visible:ring-[var(--accent-steel)] focus-visible:ring-offset-transparent",
    "disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
    // Outer ambient drop. Kept low so it doesn't fight the inner specular.
    "shadow-[0_5px_12px_-6px_oklch(0.30_0.04_240/0.14),0_1px_1px_oklch(0.30_0.04_240/0.08)]",
    "dark:shadow-[0_6px_14px_-6px_oklch(0_0_0/0.30),0_1px_1px_oklch(0_0_0/0.20)]",
    "hover:shadow-[0_7px_16px_-6px_oklch(0.30_0.04_240/0.18),0_1px_1px_oklch(0.30_0.04_240/0.10)]",
    "dark:hover:shadow-[0_8px_18px_-6px_oklch(0_0_0/0.35),0_1px_1px_oklch(0_0_0/0.22)]",
  ),
  {
    variants: {
      // Maps to a glass tint internally — see tintForVariant().
      variant: {
        primary: "",
        secondary: "",
        outline: "",
        gradient: "",
      },
      // Gap is applied to the inner content span (see render below) since the
      // outer button's flex children are absolutely-positioned glass layers.
      size: {
        sm: "h-[34px] px-[18px] text-[13px]",
        md: "h-11 px-[22px] text-sm",
        lg: "h-[54px] px-7 text-[15px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

function tintForVariant(variant: ButtonProps["variant"]): "neutral" | "accent" {
  return variant === "secondary" || variant === "outline" ? "accent" : "neutral";
}

/** Props accepted by {@link Button} — standard button attrs plus CVA variants. */
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

/**
 * Renders a tinted glass pill button.
 *
 * @param className - Extra Tailwind classes merged via `cn()`.
 * @param variant - `primary` (clear glass, default) | `secondary` | `outline` | `gradient`.
 * @param size - `sm` | `md` (default) | `lg`.
 * @param type - HTML button type. Defaults to `"button"` so an unspecified
 *   `<Button>` inside a form does not accidentally submit it.
 * @param children - Button content (icons, label text).
 * @param props - Any other `HTMLButtonElement` attributes (e.g., `onClick`, `disabled`).
 * @returns Forward-ref'd `<button>` rendered as a layered glass pill.
 *
 * @example
 * <Button variant="primary" size="lg">Get contact card</Button>
 * <Button variant="secondary">Sign in</Button>
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", children, ...props }, ref) => {
    const tint = tintForVariant(variant);
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), tintFgClasses[tint], className)}
        {...props}
      >
        {/* Layer 1 — backdrop blur. Same recipe as GlassPanel. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden rounded-full",
            "[backdrop-filter:blur(8px)_saturate(140%)] [-webkit-backdrop-filter:blur(8px)_saturate(140%)]",
          )}
        />
        {/* Layer 2 — colored glass tint, top→bottom wash. */}
        <span
          aria-hidden
          className={cn("pointer-events-none absolute inset-0 rounded-full", tintWashClasses[tint])}
        />
        {/* Layer 3 — thin top highlight + thin bottom inset shadow (thickness). */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full",
            "shadow-[inset_0_1px_0_0_oklch(1_0_0/0.55),inset_0_0_0_1px_oklch(1_0_0/0.22),inset_0_-1px_0_0_oklch(0.30_0.04_240/0.10)]",
            "dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.18),inset_0_0_0_1px_oklch(1_0_0/0.06),inset_0_-1px_0_0_oklch(0_0_0/0.18)]",
          )}
        />
        <span
          className={cn(
            "relative z-[1] inline-flex items-center justify-center",
            size === "sm" ? "gap-1.5" : "gap-2",
          )}
        >
          {children}
        </span>
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
