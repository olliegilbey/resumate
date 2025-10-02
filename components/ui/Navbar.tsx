"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, Briefcase, Eye } from "lucide-react"
import { ThemeToggle } from "./ThemeToggle"
import resumeData from "@/data/resume-data.json"

export function Navbar() {
  const pathname = usePathname()
  const fullName = resumeData.personal.name

  // Generate initials from name (e.g., "John Doe" → "JD")
  const initials = fullName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) // Maximum 2 letters

  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/resume", label: "Resume", icon: Briefcase },
    { href: "/resume/view", label: "Explore", icon: Eye },
  ]

  return (
    <nav className="sticky top-0 z-50 w-full glass-light border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 dark:from-blue-600 dark:to-purple-600 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
              <span className="text-white font-bold text-sm">{initials}</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100 hidden sm:block">
              {fullName}
            </span>
          </Link>

          {/* Navigation Links + Theme Toggle */}
          <div className="flex items-center space-x-1">
            {links.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-label={link.label}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium outline-none focus:outline-none",
                    isActive
                      ? "glass text-slate-900 dark:text-slate-100 shadow-sm transition-none"
                      : "text-slate-700 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/40 dark:hover:text-slate-100 transition-colors duration-200"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              )
            })}
            <div className="ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
