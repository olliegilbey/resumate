import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { HTMLAttributes, forwardRef } from "react"

const iconBadgeVariants = cva(
  "flex items-center justify-center rounded-lg",
  {
    variants: {
      size: {
        sm: "w-6 h-6",
        md: "w-8 h-8",
        lg: "w-10 h-10",
      },
      variant: {
        default: "bg-slate-100 dark:bg-slate-700",
        primary: "bg-blue-100 dark:bg-blue-900/30",
        secondary: "bg-purple-100 dark:bg-purple-900/30",
        success: "bg-green-100 dark:bg-green-900/30",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
)

export interface IconBadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconBadgeVariants> {}

const IconBadge = forwardRef<HTMLDivElement, IconBadgeProps>(
  ({ className, size, variant, ...props }, ref) => {
    return (
      <div
        className={cn(iconBadgeVariants({ size, variant, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
IconBadge.displayName = "IconBadge"

export { IconBadge, iconBadgeVariants }
