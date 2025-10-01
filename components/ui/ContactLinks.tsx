"use client"

import { Linkedin, Github, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

interface ContactLink {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description?: string
  target?: string
}

interface ContactLinksProps {
  linkedin: string
  github: string
  location: string
  className?: string
  variant?: "compact" | "full"
}

export function ContactLinks({
  linkedin,
  github,
  location,
  className,
  variant = "compact"
}: ContactLinksProps) {
  const links: ContactLink[] = [
    {
      href: `https://linkedin.com/in/${linkedin}`,
      icon: Linkedin,
      label: "LinkedIn",
      description: `@${linkedin}`,
      target: "_blank",
    },
    {
      href: `https://github.com/${github}`,
      icon: Github,
      label: "GitHub",
      description: `@${github}`,
      target: "_blank",
    },
  ]

  // Non-clickable location display
  const locationDisplay = {
    icon: MapPin,
    label: "Location",
    description: location,
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap justify-center gap-4", className)}>
        {links.map((link) => {
          const Icon = link.icon
          return (
            <a
              key={link.href}
              href={link.href}
              target={link.target}
              rel={link.target === "_blank" ? "noopener noreferrer" : undefined}
              className="flex items-center text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Icon className="h-5 w-5 mr-2" />
              {link.label}
            </a>
          )
        })}
        <span className="flex items-center text-slate-600">
          <MapPin className="h-5 w-5 mr-2" />
          {location}
        </span>
      </div>
    )
  }

  // Full Linktree-style layout
  return (
    <div className={cn("w-full max-w-md mx-auto space-y-3", className)}>
      {links.map((link) => {
        const Icon = link.icon
        
        return (
          <a
            key={link.href}
            href={link.href}
            target={link.target}
            rel={link.target === "_blank" ? "noopener noreferrer" : undefined}
            className="block w-full"
          >
            <div className="group w-full bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Icon className="h-5 w-5 text-slate-600 group-hover:text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-slate-900">{link.label}</div>
                    {link.description && (
                      <div className="text-sm text-slate-500">{link.description}</div>
                    )}
                  </div>
                </div>
                <svg
                  className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </a>
        )
      })}

      {/* Location (non-clickable) */}
      <div className="w-full bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
            <MapPin className="h-5 w-5 text-slate-600" />
          </div>
          <div className="text-left">
            <div className="font-medium text-slate-900">{locationDisplay.label}</div>
            <div className="text-sm text-slate-500">{locationDisplay.description}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
