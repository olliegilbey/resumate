"use client"

import { createContext, useContext, useEffect, useSyncExternalStore, ReactNode } from "react"

type Theme = "light" | "dark"
type ThemeContextType = {
  theme: Theme
  systemTheme: Theme
  isOverride: boolean
  isMounted: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// --- System theme store (matchMedia) ---
const DARK_QUERY = "(prefers-color-scheme: dark)"

function subscribeSystemTheme(callback: () => void) {
  const mq = window.matchMedia(DARK_QUERY)
  mq.addEventListener("change", callback)
  return () => mq.removeEventListener("change", callback)
}

function getSystemThemeSnapshot(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
}

function getSystemThemeServerSnapshot(): Theme {
  return "light"
}

// --- Override theme store (localStorage) ---
let overrideListeners: Set<() => void> = new Set()

function subscribeOverride(callback: () => void) {
  overrideListeners.add(callback)
  return () => { overrideListeners.delete(callback) }
}

function getOverrideSnapshot(): Theme | null {
  const stored = localStorage.getItem("theme-override")
  return stored === "light" || stored === "dark" ? stored : null
}

function getOverrideServerSnapshot(): Theme | null {
  return null
}

function setOverride(value: Theme | null) {
  if (value) {
    localStorage.setItem("theme-override", value)
  } else {
    localStorage.removeItem("theme-override")
  }
  overrideListeners.forEach(cb => cb())
}

// --- Provider ---
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    getSystemThemeServerSnapshot
  )

  const overrideTheme = useSyncExternalStore(
    subscribeOverride,
    getOverrideSnapshot,
    getOverrideServerSnapshot
  )

  // Track mount via useSyncExternalStore (server=false, client=true)
  const isMounted = useSyncExternalStore(
    () => () => {}, // no-op subscribe (value never changes after mount)
    () => true,     // client snapshot
    () => false     // server snapshot
  )

  const currentTheme = overrideTheme ?? systemTheme

  // Auto-reset override when system matches
  useEffect(() => {
    if (overrideTheme === systemTheme) {
      setOverride(null)
    }
  }, [systemTheme, overrideTheme])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.toggle("dark", currentTheme === "dark")
  }, [currentTheme])

  const toggleTheme = () => {
    const newTheme = currentTheme === "dark" ? "light" : "dark"
    // Reset to auto-follow if toggling to match system
    setOverride(newTheme === systemTheme ? null : newTheme)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        systemTheme,
        isOverride: overrideTheme !== null,
        isMounted,
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
