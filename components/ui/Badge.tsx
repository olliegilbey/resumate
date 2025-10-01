import { cn } from "@/lib/utils"
import { Tag } from "@/types/resume"

interface BadgeProps {
  tag: Tag
  className?: string
}

const tagColors: Record<Tag, string> = {
  "developer-relations": "bg-purple-100 text-purple-800",
  "product-management": "bg-blue-100 text-blue-800",
  "technical-leadership": "bg-red-100 text-red-800",
  "business-development": "bg-orange-100 text-orange-800",
  "community-building": "bg-pink-100 text-pink-800",
  "event-management": "bg-fuchsia-100 text-fuchsia-800",
  "public-speaking": "bg-rose-100 text-rose-800",
  "technical-writing": "bg-teal-100 text-teal-800",
  "team-leadership": "bg-emerald-100 text-emerald-800",
  "cross-functional": "bg-cyan-100 text-cyan-800",
  "strategic-planning": "bg-amber-100 text-amber-800",
  "blockchain": "bg-yellow-100 text-yellow-800",
  "machine-learning": "bg-lime-100 text-lime-800",
  "growth-engineering": "bg-green-100 text-green-800",
  "data-driven": "bg-indigo-100 text-indigo-800",
  "entrepreneurship": "bg-red-200 text-red-900",
  "ecosystem-building": "bg-sky-100 text-sky-800",
  "content-creation": "bg-purple-200 text-purple-900",
}

export function Badge({ tag, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        tagColors[tag],
        className
      )}
    >
      {tag.replaceAll('-', ' ')}
    </span>
  )
}