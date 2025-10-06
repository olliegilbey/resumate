import { describe, it, expect } from 'vitest'
import { extractAllTags, getTagColorClass, getSortedTags, getSortedTagsWithMetrics } from '@/lib/tags'
import { mockResumeData } from './fixtures/resume-data.fixture'

describe('extractAllTags', () => {
  it('should extract all unique tags from resume data', () => {
    const tags = extractAllTags(mockResumeData)

    expect(tags).toContain('leadership')
    expect(tags).toContain('cloud')
    expect(tags).toContain('performance')
    expect(tags).toContain('devops')
    expect(tags).toContain('mentorship')
    expect(tags).toContain('full-stack')
    expect(tags).toContain('product')
    expect(tags).toContain('scalability')
    expect(tags).toContain('backend')
    expect(tags).toContain('open-source')
    expect(tags).toContain('community')
  })

  it('should return sorted tags alphabetically', () => {
    const tags = extractAllTags(mockResumeData)
    const sortedTags = [...tags].sort()

    expect(tags).toEqual(sortedTags)
  })

  it('should not contain duplicates', () => {
    const tags = extractAllTags(mockResumeData)
    const uniqueTags = [...new Set(tags)]

    expect(tags.length).toBe(uniqueTags.length)
  })

  it('should handle empty companies array', () => {
    const emptyData = { ...mockResumeData, companies: [], accomplishments: [] }
    const tags = extractAllTags(emptyData)

    expect(tags).toEqual([])
  })
})

describe('getTagColorClass', () => {
  it('should return consistent color classes for tags', () => {
    const allTags = extractAllTags(mockResumeData)
    const firstTag = allTags[0]
    const colorClass = getTagColorClass(firstTag, allTags)

    expect(colorClass).toMatch(/^bg-tag-\d+ text-tag-\d+$/)
  })

  it('should cycle through 20 color classes', () => {
    const tags = Array.from({ length: 25 }, (_, i) => `tag-${i}`)

    const colorClasses = tags.map(tag => getTagColorClass(tag, tags))

    // First and 21st should have same color (0 % 20 = 0, 20 % 20 = 0)
    expect(colorClasses[0]).toBe(colorClasses[20])
  })

  it('should return fallback class for tags not in list', () => {
    const allTags = ['known-tag']
    const colorClass = getTagColorClass('unknown-tag', allTags)

    expect(colorClass).toBe('bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100')
  })

  it('should return same color for same tag position', () => {
    const allTags = ['first', 'second', 'third']

    const color1 = getTagColorClass('second', allTags)
    const color2 = getTagColorClass('second', allTags)

    expect(color1).toBe(color2)
  })
})

describe('getSortedTagsWithMetrics', () => {
  it('should calculate tag metrics correctly', () => {
    const metrics = getSortedTagsWithMetrics(mockResumeData)

    expect(metrics.length).toBeGreaterThan(0)

    // Each metric should have required fields
    metrics.forEach(metric => {
      expect(metric).toHaveProperty('tag')
      expect(metric).toHaveProperty('count')
      expect(metric).toHaveProperty('avgPriority')
      expect(metric).toHaveProperty('weight')
      expect(metric.count).toBeGreaterThan(0)
      expect(metric.avgPriority).toBeGreaterThan(0)
      expect(metric.weight).toBeGreaterThan(0)
    })
  })

  it('should sort tags by weight (count × avgPriority)', () => {
    const metrics = getSortedTagsWithMetrics(mockResumeData)

    // Verify descending order by weight
    for (let i = 0; i < metrics.length - 1; i++) {
      expect(metrics[i].weight).toBeGreaterThanOrEqual(metrics[i + 1].weight)
    }
  })

  it('should handle missing priorities with default value of 5', () => {
    const dataWithMissingPriority = {
      ...mockResumeData,
      companies: [{
        ...mockResumeData.companies[0],
        positions: [{
          ...mockResumeData.companies[0].positions[0],
          bullets: [{
            id: 'test',
            text: 'Test bullet',
            tags: ['test-tag'],
            priority: 0, // Zero priority should use default
          }]
        }]
      }]
    }

    const metrics = getSortedTagsWithMetrics(dataWithMissingPriority)
    const testMetric = metrics.find(m => m.tag === 'test-tag')

    expect(testMetric).toBeDefined()
    expect(testMetric?.avgPriority).toBe(5) // Should use default, not 0
  })
})

describe('getSortedTags', () => {
  it('should return tags sorted by weight', () => {
    const sortedTags = getSortedTags(mockResumeData)
    const metrics = getSortedTagsWithMetrics(mockResumeData)

    expect(sortedTags).toEqual(metrics.map(m => m.tag))
  })

  it('should return consistent order for color mapping', () => {
    const tags1 = getSortedTags(mockResumeData)
    const tags2 = getSortedTags(mockResumeData)

    expect(tags1).toEqual(tags2)
  })
})
