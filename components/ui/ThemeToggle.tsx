"use client"

import { useTheme } from "@/contexts/ThemeContext"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { theme, isOverride, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative p-2 rounded-lg transition-all duration-200",
        "hover:bg-slate-100 dark:hover:bg-slate-800",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-600",
        isOverride && "ring-1 ring-blue-500/30 dark:ring-blue-400/30"
      )}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={isOverride ? "Manual theme (click to reset to system)" : "Following system theme"}
    >
      {/* Show OPPOSITE icon (what clicking will switch TO) */}
      {theme === "dark" ? (
        <Sun className="h-5 w-5 text-slate-400 dark:text-slate-500" />
      ) : (
        <Moon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
      )}
    </button>
  )
}
