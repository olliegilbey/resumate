"use client"

import { Tag, BulletPoint } from "@/types/resume"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

interface TagFilterProps {
  selectedTags: Tag[]
  onTagToggle: (tag: Tag) => void
  bullets: BulletPoint[]
  className?: string
}

export function TagFilter({ selectedTags, onTagToggle, bullets, className }: TagFilterProps) {
  // Get all unique tags and their counts
  const tagCounts = bullets.reduce((acc, bullet) => {
    bullet.tags.forEach(tag => {
      acc[tag] = (acc[tag] || 0) + 1
    })
    return acc
  }, {} as Record<Tag, number>)

  const allTags = Object.keys(tagCounts) as Tag[]

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-900">Filter by Tags</h3>
        {selectedTags.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedTags.forEach(tag => onTagToggle(tag))}
          >
            Clear All
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {allTags.map(tag => (
          <label
            key={tag}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={selectedTags.includes(tag)}
              onChange={() => onTagToggle(tag)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <Badge tag={tag} className="group-hover:opacity-80" />
              <span className="text-xs text-slate-500">({tagCounts[tag]})</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
