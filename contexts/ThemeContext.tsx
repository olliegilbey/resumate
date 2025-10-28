"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

type Theme = "light" | "dark"
type ThemeContextType = {
  theme: Theme
  systemTheme: Theme
  isOverride: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize system theme from media query
  const [systemTheme, setSystemTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    return "light"
  })

  // Initialize override from localStorage
  const [overrideTheme, setOverrideTheme] = useState<Theme | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem("theme-override")
      if (stored === "light" || stored === "dark") {
        return stored
      }
    }
    return null
  })

  // Detect system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = (e: MediaQueryListEvent) => {
      const newSystemTheme = e.matches ? "dark" : "light"
      setSystemTheme(newSystemTheme)

      // If override matches new system theme, reset to auto-follow
      const stored = localStorage.getItem("theme-override")
      if (stored === newSystemTheme) {
        localStorage.removeItem("theme-override")
        setOverrideTheme(null)
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  // Apply theme to document
  const currentTheme = overrideTheme || systemTheme
  useEffect(() => {
    if (currentTheme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [currentTheme])

  const toggleTheme = () => {
    const newTheme = currentTheme === "dark" ? "light" : "dark"

    // If toggling to match system, reset to auto-follow
    if (newTheme === systemTheme) {
      localStorage.removeItem("theme-override")
      setOverrideTheme(null)
    } else {
      // Override system preference
      localStorage.setItem("theme-override", newTheme)
      setOverrideTheme(newTheme)
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        systemTheme,
        isOverride: overrideTheme !== null,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
