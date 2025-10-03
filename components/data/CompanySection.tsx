import { Company, BulletPoint } from "@/types/resume"
import { BulletCard } from "./BulletCard"
import { cn } from "@/lib/utils"
import { Building2, Briefcase } from "lucide-react"

interface CompanySectionProps {
  company: Company
  filteredBulletIds?: Set<string>
  allTags: string[]
  className?: string
}

export function CompanySection({ company, filteredBulletIds, allTags, className }: CompanySectionProps) {
  // Collect all bullets from all positions (position descriptions are NOT displayed as bullets)
  const allBullets: BulletPoint[] = []

  company.positions.forEach(position => {
    // Only add actual experience bullets, not position descriptions
    position.bullets.forEach(bullet => {
      allBullets.push(bullet)
    })
  })

  // Filter bullets if filteredBulletIds is provided
  const displayBullets = filteredBulletIds
    ? allBullets.filter(bullet => filteredBulletIds.has(bullet.id))
    : allBullets

  // Sort by priority (highest first)
  displayBullets.sort((a, b) => b.priority - a.priority)

  return (
    <div className={cn("space-y-6", className)}>
      {/* Company Header */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              {company.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>{company.dateRange}</span>
              {company.location && (
                <>
                  <span>•</span>
                  <span>{company.location}</span>
                </>
              )}
            </div>
            {company.context && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{company.context}</p>
            )}
          </div>
        </div>

        {/* List all positions */}
        <div className="ml-11 space-y-1">
          {company.positions.map(position => (
            <div key={position.id} className="flex items-center space-x-2 text-sm">
              <Briefcase className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span className="font-medium text-slate-700 dark:text-slate-200">{position.role}</span>
              <span className="text-slate-400 dark:text-slate-500">•</span>
              <span className="text-slate-500 dark:text-slate-400">{position.dateRange}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filtered bullets, sorted by priority */}
      <div className="space-y-3">
        {displayBullets.map(bullet => (
          <BulletCard key={bullet.id} bullet={bullet} allTags={allTags} />
        ))}
      </div>
    </div>
  )
}
