"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { ResumeData, Tag, BulletPoint } from "@/types/resume"
import { SearchBar } from "./SearchBar"
import { TagFilter } from "./TagFilter"
import { CompanySection } from "./CompanySection"
import { GlassPanel } from "@/components/ui/GlassPanel"
import { cn } from "@/lib/utils"
import { getSortedTags } from "@/lib/tags"
import { useTrackEvent } from "@/lib/posthog-client"

interface DataExplorerProps {
  data: ResumeData
  className?: string
}

export function DataExplorer({ data, className }: DataExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])
  const trackEvent = useTrackEvent()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMount = useRef(true)

  // Extract all tags from resume data, sorted by weight (count × avgPriority)
  const allTags = useMemo(() => getSortedTags(data), [data])

  const handleTagToggle = (tag: Tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  // Helper function to extract year from dateStart/dateEnd for sorting
  const getYear = (dateStart: string, dateEnd?: string | null): number => {
    // If no dateEnd, it's current (return very high value for sorting to top)
    if (!dateEnd) {
      return 9999
    }
    // Extract year from dateEnd (format: YYYY-MM or YYYY)
    const match = dateEnd.match(/(\d{4})/)
    return match ? parseInt(match[1]) : 2000
  }

  // Filter companies directly on the JSON structure
  const filteredData = useMemo(() => {
    const companies = data.experience
      .map(company => ({
        ...company,
        children: company.children
          .map(position => ({
            ...position,
            children: position.children.filter(bullet => {
              // Search filter across all fields
              const matchesSearch = searchQuery === "" ||
                bullet.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (company.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                position.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                bullet.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

              // Tag filter (OR logic - any selected tag matches)
              const matchesTags = selectedTags.length === 0 ||
                selectedTags.some(tag => bullet.tags.includes(tag))

              return matchesSearch && matchesTags
            })
          }))
          .filter(position => position.children.length > 0)
      }))
      .filter(company => company.children.length > 0)
      .sort((a, b) => getYear(b.dateStart, b.dateEnd) - getYear(a.dateStart, a.dateEnd))

    return companies
  }, [data.experience, searchQuery, selectedTags])

  // Calculate stats from filtered data
  const stats = useMemo(() => {
    let bulletCount = 0
    const tagSet = new Set<string>()

    filteredData.forEach(company => {
      company.children.forEach(position => {
        bulletCount += position.children.length
        position.children.forEach(bullet => {
          bullet.tags.forEach(tag => tagSet.add(tag))
        })
      })
    })

    return {
      totalBullets: bulletCount,
      companies: filteredData.length,
      tagsUsed: tagSet.size
    }
  }, [filteredData])

  // Track tag filter changes with 1s debounce
  useEffect(() => {
    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Don't track empty tag selections (user is resetting)
    if (selectedTags.length === 0) {
      return
    }

    // Set new debounced timer
    debounceTimerRef.current = setTimeout(() => {
      trackEvent('tag_filter_changed', {
        tags: [...selectedTags],
        tag_count: selectedTags.length,
        result_count: stats.totalBullets,
      })
    }, 1000)

    // Cleanup on unmount or before next effect
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [selectedTags, stats.totalBullets, trackEvent])

  // Handle search blur for tracking
  const handleSearchBlur = useCallback(() => {
    if (searchQuery.trim()) {
      trackEvent('search_performed', {
        query: searchQuery,
        result_count: stats.totalBullets,
      })
    }
  }, [searchQuery, stats.totalBullets, trackEvent])

  // Get all bullets from original data for TagFilter counts
  const allBulletsForTagFilter = useMemo(() => {
    const bullets: BulletPoint[] = []
    data.experience.forEach(company => {
      company.children.forEach(position => {
        bullets.push(...position.children)
      })
    })
    return bullets
  }, [data.experience])

  return (
    <div className={cn("max-w-7xl mx-auto px-4 md:px-8 py-8", className)}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 mb-2">
          Full Experience Compendium
        </h1>
        <p className="text-slate-600 dark:text-slate-300">
          All achievements and experience, filterable by tag and searchable by keyword.
        </p>
      </div>

      {/* Search Bar - Full Width */}
      <div className="mb-6">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onBlur={handleSearchBlur}
          placeholder="Search experience, companies, roles, or tags..."
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-6">
            {/* Stats Card - Above Filter */}
            <GlassPanel padding="none" className="px-6 py-3 flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{stats.totalBullets}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Bullets</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{stats.companies}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Companies</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{stats.tagsUsed}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Tags</div>
              </div>
            </GlassPanel>

            {/* Filter by Tags */}
            <GlassPanel padding="sm">
              <TagFilter
                selectedTags={selectedTags}
                onTagToggle={handleTagToggle}
                bullets={allBulletsForTagFilter}
                allTags={allTags}
              />
            </GlassPanel>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {filteredData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 2C6.477 2 2 6.477 2 12s4.477 10 10 10c1.563 0 3.049-.358 4.373-.989L19 19l-3-3zM13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No results found</h3>
              <p className="text-slate-500 dark:text-slate-400">
                Try adjusting your search terms or selected tags.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {filteredData.map(company => (
                <CompanySection
                  key={company.id}
                  company={company}
                  allTags={allTags}
                  onTagClick={handleTagToggle}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
