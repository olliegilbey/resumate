import { Company, BulletPoint, Tag } from "@/types/resume"
import { BulletCard } from "./BulletCard"
import { cn } from "@/lib/utils"
import { Building2, Briefcase } from "lucide-react"

interface CompanySectionProps {
  company: Company
  className?: string
}

interface ExtendedBullet extends BulletPoint {
  isDescription?: boolean
  descriptionTags?: Tag[]
  descriptionPriority?: number
  descriptionMetrics?: string
}

export function CompanySection({ company, className }: CompanySectionProps) {
  // Combine all bullets from all positions (descriptions + bullets) and sort by priority
  const allBullets: ExtendedBullet[] = []

  company.positions.forEach(position => {
    // Add position description as a bullet
    allBullets.push({
      id: `${position.id}-description`,
      text: position.description,
      tags: position.descriptionTags,
      priority: position.descriptionPriority,
      metrics: position.descriptionMetrics,
      context: position.descriptionContext,
      link: position.descriptionLink,
      isDescription: true,
    })

    // Add all position bullets
    position.bullets.forEach(bullet => {
      allBullets.push(bullet)
    })
  })

  // Sort by priority (highest first)
  allBullets.sort((a, b) => b.priority - a.priority)

  return (
    <div className={cn("space-y-6", className)}>
      {/* Company Header */}
      <div className="space-y-3 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-slate-100 rounded-lg">
            <Building2 className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
              {company.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>{company.dateRange}</span>
              {company.location && (
                <>
                  <span>•</span>
                  <span>{company.location}</span>
                </>
              )}
            </div>
            {company.context && (
              <p className="text-sm text-slate-600 mt-1">{company.context}</p>
            )}
          </div>
        </div>

        {/* List all positions */}
        <div className="ml-11 space-y-1">
          {company.positions.map(position => (
            <div key={position.id} className="flex items-center space-x-2 text-sm">
              <Briefcase className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-medium text-slate-700">{position.role}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">{position.dateRange}</span>
            </div>
          ))}
        </div>
      </div>

      {/* All bullets combined, sorted by priority */}
      <div className="space-y-3">
        {allBullets.map(bullet => (
          <BulletCard key={bullet.id} bullet={bullet} />
        ))}
      </div>
    </div>
  )
}