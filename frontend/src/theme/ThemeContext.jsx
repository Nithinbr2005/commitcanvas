import React, { createContext, useContext, useState, useEffect } from 'react'
import { DASHBOARD_THEMES, GRAPH_THEMES } from './themes'

const LEGACY_STORAGE_KEY = 'commitcanvas-theme'
const DASHBOARD_STORAGE_KEY = 'commitcanvas-dashboard-theme'
const GRAPH_STORAGE_KEY = 'commitcanvas-graph-theme'
const INTENSITY_KEY = 'commitcanvas-graph-intensity'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [dashboardThemeId, setDashboardThemeId] = useState(() => {
    try {
      const savedDash = localStorage.getItem(DASHBOARD_STORAGE_KEY)
      if (savedDash && DASHBOARD_THEMES[savedDash]) return savedDash
      
      // Migration from legacy key
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacy && DASHBOARD_THEMES[legacy]) return legacy

      return 'electric_blue'
    } catch (e) {
      return 'electric_blue'
    }
  })

  const [graphThemeId, setGraphThemeId] = useState(() => {
    try {
      const savedGraph = localStorage.getItem(GRAPH_STORAGE_KEY)
      if (savedGraph && GRAPH_THEMES[savedGraph]) return savedGraph
      
      // Migration from legacy key
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacy && GRAPH_THEMES[legacy]) return legacy

      return 'electric_blue'
    } catch (e) {
      return 'electric_blue'
    }
  })

  const [intensity, setIntensity] = useState(() => {
    try {
      const saved = localStorage.getItem(INTENSITY_KEY)
      return saved || 'balanced' // subtle, balanced, luminous
    } catch (e) {
      return 'balanced'
    }
  })

  const dashboardTheme = DASHBOARD_THEMES[dashboardThemeId] || DASHBOARD_THEMES.electric_blue
  const graphTheme = GRAPH_THEMES[graphThemeId] || GRAPH_THEMES.electric_blue

  // Persist dashboard theme & apply CSS custom properties
  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_STORAGE_KEY, dashboardThemeId)
    } catch (e) {}

    const root = document.documentElement
    const { colors } = dashboardTheme

    root.style.setProperty('--theme-bg', colors.bg)
    root.style.setProperty('--theme-bg-secondary', colors.bgSecondary)
    root.style.setProperty('--theme-surface', colors.surface)
    root.style.setProperty('--theme-surface-elevated', colors.surfaceElevated)
    
    root.style.setProperty('--theme-border', colors.border)
    root.style.setProperty('--theme-border-hover', colors.borderHover)
    
    root.style.setProperty('--theme-primary', colors.primary)
    root.style.setProperty('--theme-bright', colors.primaryBright || colors.bright)
    root.style.setProperty('--theme-highlight', colors.primaryHighlight || colors.highlight)
    root.style.setProperty('--theme-deep', colors.primaryDeep || colors.deep)
    
    root.style.setProperty('--theme-text-primary', colors.textPrimary)
    root.style.setProperty('--theme-text-secondary', colors.textSecondary)
    root.style.setProperty('--theme-text-muted', colors.textMuted)
    
    root.style.setProperty('--theme-glow', colors.glow)
    root.style.setProperty('--theme-glow-strong', colors.glowStrong)
    
    // Add missing variables for components
    root.style.setProperty('--theme-button', colors.button)
    root.style.setProperty('--theme-button-hover', colors.buttonHover)
    root.style.setProperty('--theme-head', colors.head)
    root.style.setProperty('--theme-selection', colors.selection)
    
    // Ambient glows for background
    root.style.setProperty('--theme-ambient-1', colors.ambientGlow1)
    root.style.setProperty('--theme-ambient-2', colors.ambientGlow2)

    // Legacy (to not break things until fully migrated)
    root.style.setProperty('--accent-primary', colors.primary)
    root.style.setProperty('--accent-bright', colors.bright)
    root.style.setProperty('--accent-highlight', colors.highlight)
    root.style.setProperty('--accent-deep', colors.deep)
    root.style.setProperty('--accent-head', colors.head)
    root.style.setProperty('--accent-glow-color', colors.glow)
    root.style.setProperty('--accent-shadow-glow', colors.accentGlow)
    root.style.setProperty('--accent-border-color', colors.accentBorder)
    root.style.setProperty('--accent-bg-color', colors.accentBg)
  }, [dashboardThemeId, dashboardTheme])

  // Persist graph theme
  useEffect(() => {
    try {
      localStorage.setItem(GRAPH_STORAGE_KEY, graphThemeId)
    } catch (e) {}
  }, [graphThemeId])

  // Persist intensity
  useEffect(() => {
    try {
      localStorage.setItem(INTENSITY_KEY, intensity)
    } catch (e) {}
  }, [intensity])

  return (
    <ThemeContext.Provider value={{
      dashboardThemeId,
      setDashboardThemeId,
      dashboardTheme,
      graphThemeId,
      setGraphThemeId,
      graphTheme,
      intensity,
      setIntensity,
      dashboardThemes: DASHBOARD_THEMES,
      graphThemes: GRAPH_THEMES,
      // Provide currentTheme to avoid breaking dashboard components that still use it for non-graph properties
      currentTheme: dashboardTheme
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
