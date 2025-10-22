import { Company, BulletPoint, Tag } from "@/types/resume"
import { BulletCard } from "./BulletCard"
import { GlassPanel } from "@/components/ui/GlassPanel"
import { IconBadge } from "@/components/ui/IconBadge"
import { cn } from "@/lib/utils"
import { Building2, Briefcase } from "lucide-react"

interface CompanySectionProps {
  company: Company
  allTags: string[]
  onTagClick?: (tag: Tag) => void
  className?: string
}

export function CompanySection({ company, allTags, onTagClick, className }: CompanySectionProps) {
  // Collect all bullets from all positions (already filtered by DataExplorer)
  const allBullets: BulletPoint[] = []

  company.children.forEach(position => {
    position.children.forEach(bullet => {
      allBullets.push(bullet)
    })
  })

  // Sort by priority (highest first)
  const displayBullets = allBullets.sort((a, b) => b.priority - a.priority)

  // Format date range from dateStart and dateEnd
  const formatDateRange = (start: string, end?: string | null) => {
    if (!end) return `${start} – Present`
    return `${start} – ${end}`
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Company Header */}
      <GlassPanel padding="sm" className="space-y-3">
        <div className="flex items-center space-x-3">
          <IconBadge>
            <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </IconBadge>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              {company.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>{formatDateRange(company.dateStart, company.dateEnd)}</span>
              {company.location && (
                <>
                  <span>•</span>
                  <span>{company.location}</span>
                </>
              )}
            </div>
            {company.description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{company.description}</p>
            )}
          </div>
        </div>

        {/* List all positions */}
        <div className="ml-11 space-y-1">
          {company.children.map(position => (
            <div key={position.id} className="flex items-center space-x-2 text-sm">
              <Briefcase className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span className="font-medium text-slate-700 dark:text-slate-200">{position.name}</span>
              <span className="text-slate-400 dark:text-slate-500">•</span>
              <span className="text-slate-500 dark:text-slate-400">{formatDateRange(position.dateStart, position.dateEnd)}</span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Filtered bullets, sorted by priority */}
      <div className="space-y-3">
        {displayBullets.map(bullet => (
          <BulletCard
            key={bullet.id}
            bullet={bullet}
            allTags={allTags}
            onTagClick={onTagClick}
          />
        ))}
      </div>
    </div>
  )
}
