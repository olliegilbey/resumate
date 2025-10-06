import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { HTMLAttributes, forwardRef } from "react"

const glassPanelVariants = cva(
  "glass shadow-sm",
  {
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
      radius: {
        lg: "rounded-xl",
        "2xl": "rounded-2xl",
      },
    },
    defaultVariants: {
      padding: "md",
      align: "start",
      radius: "lg",
    },
  }
)

export interface GlassPanelProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassPanelVariants> {}

const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, padding, align, radius, ...props }, ref) => {
    return (
      <div
        className={cn(glassPanelVariants({ padding, align, radius, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
GlassPanel.displayName = "GlassPanel"

export { GlassPanel, glassPanelVariants }
