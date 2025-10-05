/**
 * Theme initialization script
 * Runs before page render to prevent flash of unstyled content
 * Moved to external file to comply with CSP (no 'unsafe-inline')
 */
(function () {
  try {
    const stored = localStorage.getItem('theme-override')
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const systemTheme = systemDark ? 'dark' : 'light'

    // If stored override matches system, remove it (reset to auto-follow)
    if (stored === systemTheme) {
      localStorage.removeItem('theme-override')
    }

    const theme = stored && stored !== systemTheme ? stored : systemTheme

    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    }
  } catch (error) {
    // Fail silently - theme will default to light mode
    console.warn('Theme initialization failed:', error)
  }
})()
