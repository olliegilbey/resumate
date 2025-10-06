"use client"

import { Tag, BulletPoint } from "@/types/resume"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

interface TagFilterProps {
  selectedTags: Tag[]
  onTagToggle: (tag: Tag) => void
  bullets: BulletPoint[]
  allTags: string[]
  className?: string
}

export function TagFilter({ selectedTags, onTagToggle, bullets, allTags, className }: TagFilterProps) {
  // Get tag counts for display
  const tagCounts = bullets.reduce((acc, bullet) => {
    bullet.tags.forEach(tag => {
      acc[tag] = (acc[tag] || 0) + 1
    })
    return acc
  }, {} as Record<Tag, number>)

  // Filter to only tags that have bullets (with counts), preserving sorted order
  const displayTags = allTags.filter(tag => tagCounts[tag] > 0)

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between min-h-[32px]">
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Filter by Tags</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectedTags.forEach(tag => onTagToggle(tag))}
          className={cn(
            "transition-opacity",
            selectedTags.length === 0 && "opacity-0 pointer-events-none"
          )}
        >
          Clear All
        </Button>
      </div>

      <div className="space-y-2">
        {displayTags.map(tag => (
          <label
            key={tag}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={selectedTags.includes(tag)}
              onChange={() => onTagToggle(tag)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 dark:bg-slate-700 dark:border-slate-600 dark:checked:bg-blue-500 dark:checked:border-blue-500"
            />
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <Badge tag={tag} allTags={allTags} className="group-hover:opacity-80" />
              <span className="text-xs text-slate-500 dark:text-slate-400">({tagCounts[tag]})</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
