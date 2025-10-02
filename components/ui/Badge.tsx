import { cn } from "@/lib/utils"
import { Tag } from "@/types/resume"
import { getTagColorClass } from "@/lib/tags"

interface BadgeProps {
  tag: Tag
  allTags: string[]
  className?: string
}

export function Badge({ tag, allTags, className }: BadgeProps) {
  const colorClasses = getTagColorClass(tag, allTags)

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium glass-badge",
        colorClasses,
        className
      )}
    >
      {tag.replaceAll('-', ' ')}
    </span>
  )
}
