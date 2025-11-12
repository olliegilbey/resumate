import { ResumeData } from "@/types/resume"

/**
 * Metrics for a single tag across all resume data
 */
export interface TagMetrics {
  tag: string
  count: number           // Number of times tag appears
  totalPriority: number   // Sum of all priorities for this tag
  avgPriority: number     // Average priority (totalPriority / count)
  weight: number          // count × avgPriority (used for sorting)
}

/**
 * Calculate metrics for all tags and sort by weight (count × avgPriority)
 *
 * Sorting Algorithm:
 * 1. Primary: weight (descending) - tags with high frequency AND high priority rank highest
 * 2. Secondary: count (descending) - if weights are equal, more frequent tags rank higher
 * 3. Tertiary: alphabetical (ascending) - deterministic tiebreaker
 *
 * Priority Handling:
 * - Missing or zero priorities default to 5 (mid-range on 1-10 scale)
 * - This prevents tags from disappearing when priority isn't set
 *
 * Weight Formula: count × avgPriority
 * - A tag appearing 10 times with priority 8 (weight: 80) ranks higher than
 *   a tag appearing 5 times with priority 10 (weight: 50)
 * - This balances frequency and importance
 *
 * @param data - Full resume data structure
 * @returns Array of TagMetrics sorted by weight (descending)
 *
 * @example
 * const metrics = getSortedTagsWithMetrics(resumeData)
 * // [
 * //   { tag: 'leadership', count: 8, avgPriority: 9, weight: 72 },
 * //   { tag: 'typescript', count: 12, avgPriority: 6, weight: 72 },
 * //   { tag: 'design', count: 4, avgPriority: 7, weight: 28 }
 * // ]
 */
export function getSortedTagsWithMetrics(data: ResumeData): TagMetrics[] {
  const tagData = new Map<string, { count: number; totalPriority: number }>()

  // Collect tag counts and total priorities
  data.experience.forEach(company => {
    company.children.forEach(position => {
      // Position tags (from description)
      position.tags.forEach(tag => {
        const existing = tagData.get(tag) || { count: 0, totalPriority: 0 }
        tagData.set(tag, {
          count: existing.count + 1,
          totalPriority: existing.totalPriority + (position.priority || 5), // Default priority: 5
        })
      })

      // Bullet tags
      position.children.forEach(bullet => {
        bullet.tags.forEach(tag => {
          const existing = tagData.get(tag) || { count: 0, totalPriority: 0 }
          tagData.set(tag, {
            count: existing.count + 1,
            totalPriority: existing.totalPriority + (bullet.priority || 5), // Default priority: 5
          })
        })
      })
    })
  })

  // Calculate metrics and sort by weight
  const metrics: TagMetrics[] = Array.from(tagData.entries()).map(([tag, data]) => {
    const avgPriority = data.totalPriority / data.count
    return {
      tag,
      count: data.count,
      totalPriority: data.totalPriority,
      avgPriority,
      weight: data.count * avgPriority,
    }
  })

  // Sort by weight (descending), then by count (descending), then alphabetically
  return metrics.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight
    if (b.count !== a.count) return b.count - a.count
    return a.tag.localeCompare(b.tag)
  })
}

/**
 * Get sorted tags (by weight) as a simple string array
 *
 * This is the primary function used for tag display ordering throughout the app.
 * Tags are sorted by weight (count × avgPriority), ensuring:
 * - Most important/frequent tags appear first in filter sidebars
 * - Consistent color mapping (colors based on array index)
 * - Single source of truth for tag order
 *
 * @param data - Full resume data structure
 * @returns Array of tag strings sorted by importance (weight descending)
 *
 * @example
 * const sortedTags = getSortedTags(resumeData)
 * // ['leadership', 'typescript', 'react', 'design', ...]
 */
export function getSortedTags(data: ResumeData): string[] {
  return getSortedTagsWithMetrics(data).map(m => m.tag)
}

/**
 * Extract all unique tags from resume data (alphabetically sorted)
 * @deprecated Use getSortedTags() for priority-weighted sorting
 */
export function extractAllTags(data: ResumeData): string[] {
  const tagSet = new Set<string>()

  data.experience.forEach(company => {
    company.children.forEach(position => {
      // Add position tags
      position.tags.forEach(tag => tagSet.add(tag))

      // Add bullet tags
      position.children.forEach(bullet => {
        bullet.tags.forEach(tag => tagSet.add(tag))
      })
    })
  })

  return Array.from(tagSet).sort()
}

/**
 * Get tag color classes based on its position in all tags
 * Returns Tailwind classes with dark mode variants
 */
export function getTagColorClass(tag: string, allTags: string[]): string {
  const index = allTags.indexOf(tag)

  // Fallback for tags not in main list
  if (index === -1) {
    return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
  }

  const colorIndex = index % 20

  // Explicit class map - CSS variables change in dark mode automatically
  const classMap: Record<number, string> = {
    0: 'bg-tag-0 text-tag-0',
    1: 'bg-tag-1 text-tag-1',
    2: 'bg-tag-2 text-tag-2',
    3: 'bg-tag-3 text-tag-3',
    4: 'bg-tag-4 text-tag-4',
    5: 'bg-tag-5 text-tag-5',
    6: 'bg-tag-6 text-tag-6',
    7: 'bg-tag-7 text-tag-7',
    8: 'bg-tag-8 text-tag-8',
    9: 'bg-tag-9 text-tag-9',
    10: 'bg-tag-10 text-tag-10',
    11: 'bg-tag-11 text-tag-11',
    12: 'bg-tag-12 text-tag-12',
    13: 'bg-tag-13 text-tag-13',
    14: 'bg-tag-14 text-tag-14',
    15: 'bg-tag-15 text-tag-15',
    16: 'bg-tag-16 text-tag-16',
    17: 'bg-tag-17 text-tag-17',
    18: 'bg-tag-18 text-tag-18',
    19: 'bg-tag-19 text-tag-19',
  }

  return classMap[colorIndex]
}
