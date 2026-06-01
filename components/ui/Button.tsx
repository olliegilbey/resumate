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
 * - `aqua`     → waveAqua2 accent glass (Kanagawa wave accent — used by the Nalu CTA)
 *
 * @module components/ui/Button
 */
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { AnchorHTMLAttributes, ButtonHTMLAttributes, ElementType, forwardRef } from "react";

// Per-tint layer classes. Light values default, dark values override under
// the global `.dark` variant (configured in globals.css via @variant dark).
const tintWashClasses: Record<"neutral" | "accent" | "aqua", string> = {
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
  // Aqua glass — waveAqua2 (hue 175). Stronger wash than the steel accent so the
  // lone aqua pill stands out against the two neutral CTAs above it.
  aqua: cn(
    "bg-[linear-gradient(180deg,oklch(0.72_0.07_175/0.22),oklch(0.64_0.07_175/0.28))]",
    "dark:bg-[linear-gradient(180deg,oklch(0.70_0.08_175/0.32),oklch(0.60_0.08_175/0.42))]",
  ),
};

const tintFgClasses: Record<"neutral" | "accent" | "aqua", string> = {
  neutral: "text-[oklch(0.22_0.012_250)] dark:text-[oklch(0.96_0.003_250)]",
  accent: "text-[oklch(0.22_0.08_240)] dark:text-[oklch(0.96_0.04_240)]",
  aqua: "text-[oklch(0.30_0.06_175)] dark:text-[oklch(0.97_0.03_175)]",
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
        aqua: "",
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

function tintForVariant(variant: ButtonProps["variant"]): "neutral" | "accent" | "aqua" {
  if (variant === "aqua") return "aqua";
  return variant === "secondary" || variant === "outline" ? "accent" : "neutral";
}

/**
 * Props accepted by {@link Button} — standard button attrs, the anchor
 * attributes needed for link CTAs (`href`/`target`/`rel`/`download`), and CVA
 * variants.
 *
 * The button is polymorphic: it defaults to a native `<button>`, but `as`
 * lets it render as another element so a link CTA is a *single* interactive
 * element rather than a `<button>` nested inside an `<a>` (invalid HTML, and a
 * duplicated control in the accessibility tree).
 */
export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target" | "rel" | "download">,
    VariantProps<typeof buttonVariants> {
  /**
   * Element or component to render as. Defaults to `"button"`. Use `"a"` for
   * external links or a router component (e.g. Next's `Link`) for internal
   * navigation — the glass layers render identically inside either.
   */
  as?: ElementType;
}

/**
 * Renders a tinted glass pill, as a `<button>` by default or as the element
 * given by `as` (e.g. `"a"` / Next `Link`) for link CTAs.
 *
 * @param className - Extra Tailwind classes merged via `cn()`.
 * @param variant - `primary` (clear glass, default) | `secondary` | `outline` | `gradient` | `aqua`.
 * @param size - `sm` | `md` (default) | `lg`.
 * @param as - Element/component to render as. Defaults to `"button"`.
 * @param type - HTML button type. Defaults to `"button"` (applied only when
 *   rendering as a native `<button>`) so an unspecified `<Button>` inside a
 *   form does not accidentally submit it.
 * @param children - Button content (icons, label text).
 * @param props - Any other attributes valid on the rendered element (e.g.
 *   `onClick`, `disabled` for buttons; `href`, `target`, `rel` for links).
 * @returns Forward-ref'd glass pill rendered as `as` (default `<button>`).
 *
 * @example
 * <Button variant="primary" size="lg">Get contact card</Button>
 * <Button as="a" href="https://example.com" target="_blank" rel="noopener noreferrer">Visit</Button>
 * <Button as={Link} href="/resume" variant="primary">View profile</Button>
 */
const Button = forwardRef<HTMLElement, ButtonProps>(
  ({ className, variant, size, as, type, children, ...props }, ref) => {
    const tint = tintForVariant(variant);
    const Comp = as ?? "button";
    // `type` is only meaningful on a native button; never leak it onto an
    // anchor/router element (would render an invalid `type` attribute).
    const buttonOnlyProps = Comp === "button" ? { type: type ?? "button" } : {};
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), tintFgClasses[tint], className)}
        {...buttonOnlyProps}
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
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button };
