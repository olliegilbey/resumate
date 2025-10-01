import { BulletPoint } from "@/types/resume"
import { Badge } from "@/components/ui/Badge"
import { cn, parseMarkdownLinks } from "@/lib/utils"
import { Star } from "lucide-react"

interface BulletCardProps {
  bullet: BulletPoint
  className?: string
}

export function BulletCard({ bullet, className }: BulletCardProps) {
  const priorityStars = Math.min(Math.max(Math.round(bullet.priority / 2), 1), 5)

  return (
    <div className={cn(
      "bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow",
      className
    )}>
      <div className="flex gap-4">
        {/* Priority stars and tags on the left */}
        <div className="flex flex-col gap-2 min-w-[140px]">
          {/* Priority stars at the top */}
          <div className="flex items-center space-x-1 pb-1">
            {Array.from({ length: priorityStars }).map((_, i) => (
              <Star
                key={i}
                className="h-3 w-3 fill-yellow-400 text-yellow-400"
              />
            ))}
          </div>

          {/* Tags below stars */}
          {bullet.tags.map(tag => (
            <Badge key={tag} tag={tag} />
          ))}
        </div>

        {/* Content on the right */}
        <div className="flex-1">
          <div className="mb-3">
            <p className="text-base leading-7 text-slate-700">
              {parseMarkdownLinks(bullet.text).map((part) => {
                if (part.type === 'link' && part.url) {
                  return (
                    <a
                      key={part.key}
                      href={part.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {part.content}
                    </a>
                  )
                }
                return <span key={part.key}>{part.content}</span>
              })}
            </p>

            {/* Hidden metrics for SEO */}
            {bullet.metrics && (
              <span className="sr-only">
                Metrics: {bullet.metrics}
              </span>
            )}
          </div>

          {bullet.context && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-sm text-slate-500 italic">
                {bullet.context}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}