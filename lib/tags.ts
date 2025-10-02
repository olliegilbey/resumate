import { ResumeData } from "@/types/resume"

/**
 * Extract all unique tags from resume data
 * Searches through companies → positions → (descriptions + bullets) for all tags
 */
export function extractAllTags(data: ResumeData): string[] {
  const tagSet = new Set<string>()

  data.companies.forEach(company => {
    company.positions.forEach(position => {
      // Add description tags
      position.descriptionTags.forEach(tag => tagSet.add(tag))

      // Add bullet tags
      position.bullets.forEach(bullet => {
        bullet.tags.forEach(tag => tagSet.add(tag))
      })
    })
  })

  // Add accomplishment tags if they exist
  data.accomplishments?.forEach(accomplishment => {
    accomplishment.tags?.forEach(tag => tagSet.add(tag))
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
