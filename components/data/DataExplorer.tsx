"use client"

import { useState, useMemo } from "react"
import { ResumeData, Tag, BulletPoint } from "@/types/resume"
import { SearchBar } from "./SearchBar"
import { TagFilter } from "./TagFilter"
import { CompanySection } from "./CompanySection"
import { cn } from "@/lib/utils"
import { extractAllTags } from "@/lib/tags"

interface DataExplorerProps {
  data: ResumeData
  className?: string
}

// Helper type for flattened filterable items (includes both descriptions and bullets)
interface FilterableItem {
  text: string
  tags: Tag[]
  companyId: string
  companyName: string
  role: string
}

export function DataExplorer({ data, className }: DataExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])

  // Extract all tags from resume data
  const allTags = useMemo(() => extractAllTags(data), [data])

  const handleTagToggle = (tag: Tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  // Flatten all companies → positions → (descriptions + bullets) for filtering
  const allFilterableItems = useMemo(() => {
    const items: FilterableItem[] = []

    data.companies.forEach(company => {
      company.positions.forEach(position => {
        // Add position description as a filterable item
        items.push({
          text: position.description,
          tags: position.descriptionTags,
          companyId: company.id,
          companyName: company.name,
          role: position.role,
        })

        // Add all position bullets as filterable items
        position.bullets.forEach(bullet => {
          items.push({
            text: bullet.text,
            tags: bullet.tags,
            companyId: company.id,
            companyName: company.name,
            role: position.role,
          })
        })
      })
    })

    return items
  }, [data.companies])

  // Filter items based on search query and selected tags
  const filteredItems = useMemo(() => {
    return allFilterableItems.filter(item => {
      // Search filter
      const matchesSearch = searchQuery === "" ||
        item.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

      // Tag filter (require ANY selected tag to be present - OR logic)
      const matchesTags = selectedTags.length === 0 ||
        selectedTags.some(tag => item.tags.includes(tag))

      return matchesSearch && matchesTags
    })
  }, [allFilterableItems, searchQuery, selectedTags])

  // Get companies that have matching filtered items AND set of filtered bullet IDs
  const { filteredCompanies, filteredBulletIds } = useMemo(() => {
    const matchingCompanyIds = new Set(filteredItems.map(item => item.companyId))

    // Build set of bullet IDs that passed the filter
    const bulletIds = new Set<string>()
    filteredItems.forEach(item => {
      // Find the matching bullet or description by matching text
      data.companies.forEach(company => {
        if (company.id !== item.companyId) return

        company.positions.forEach(position => {
          if (position.role !== item.role) return

          // Check if this is a description
          if (item.text === position.description) {
            bulletIds.add(`${position.id}-description`)
          }

          // Check if this is a bullet
          position.bullets.forEach(bullet => {
            if (bullet.text === item.text) {
              bulletIds.add(bullet.id)
            }
          })
        })
      })
    })

    const companies = data.companies
      .filter(company => matchingCompanyIds.has(company.id))
      .sort((a, b) => {
        // Sort by date (newest first)
        const getYear = (dateRange: string) => {
          const parts = dateRange.split(' – ')
          const endDate = parts[1] || parts[0]
          if (endDate.toLowerCase().includes('present') || endDate.toLowerCase().includes('current')) {
            return 9999
          }
          const match = endDate.match(/\d{4}/)
          return match ? parseInt(match[0]) : 2000
        }
        return getYear(b.dateRange) - getYear(a.dateRange)
      })

    return { filteredCompanies: companies, filteredBulletIds: bulletIds }
  }, [data.companies, filteredItems])

  // Calculate stats
  const stats = {
    totalBullets: filteredItems.length,
    companies: filteredCompanies.length,
    tagsUsed: [...new Set(filteredItems.flatMap(item => item.tags))].length
  }

  // Convert filterable items to BulletPoint format for TagFilter
  const bulletsForTagFilter = useMemo(() => {
    return allFilterableItems.map((item, idx) => ({
      id: `${item.companyId}-${idx}`,
      text: item.text,
      tags: item.tags,
      priority: 5,
    })) as BulletPoint[]
  }, [allFilterableItems])

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
          placeholder="Search experience, companies, roles, or tags..."
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-6">
            {/* Stats Card - Above Filter */}
            <div className="glass rounded-lg px-6 py-3 flex items-center justify-center gap-6">
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
            </div>

            {/* Filter by Tags */}
            <div className="glass rounded-lg p-4">
              <TagFilter
                selectedTags={selectedTags}
                onTagToggle={handleTagToggle}
                bullets={bulletsForTagFilter}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {filteredCompanies.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 2C6.477 2 2 6.477 2 12s4.477 10 10 10c1.563 0 3.049-.358 4.373-.989L19 19l-3-3zM13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No results found</h3>
              <p className="text-slate-500">
                Try adjusting your search terms or selected tags.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {filteredCompanies.map(company => (
                <CompanySection
                  key={company.id}
                  company={company}
                  filteredBulletIds={filteredBulletIds}
                  allTags={allTags}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
