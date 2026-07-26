import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../theme/ThemeContext'

export default function ThemeSelector() {
  const { 
    dashboardThemeId, setDashboardThemeId, dashboardTheme, dashboardThemes,
    graphThemeId, setGraphThemeId, graphTheme, graphThemes,
    intensity, setIntensity 
  } = useTheme()
  
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)

  // Close panel on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    window.addEventListener('touchstart', handler)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('touchstart', handler)
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleReset = () => {
    setDashboardThemeId('electric_blue')
    setGraphThemeId('electric_blue')
    setIntensity('balanced')
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Theme Trigger Button */}
      <button
        id="theme-selector-btn"
        onClick={() => setIsOpen(v => !v)}
        className="btn-ghost flex items-center gap-2 text-xs font-medium"
        style={{
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-primary)'
        }}
        aria-label="Appearance and theme settings"
        aria-expanded={isOpen}
      >
        <span
          className="w-3 h-3 rounded-full flex-shrink-0 transition-colors"
          style={{
            backgroundColor: dashboardTheme.colors.primary,
            boxShadow: `0 0 8px ${dashboardTheme.colors.primary}`
          }}
        />
        <span className="hidden sm:inline">Theme</span>
        <span className="text-white/40 text-xs">▼</span>
      </button>

      {/* Popover / Bottom Sheet Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 z-50 w-72 sm:w-80 glass-strong rounded-2xl p-4 border shadow-2xl space-y-4"
            style={{ borderColor: 'rgba(255, 255, 255, 0.12)', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/80 font-display">Appearance</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/40 hover:text-white/80 text-xs p-1"
              >
                ✕
              </button>
            </div>

            {/* DASHBOARD THEME */}
            <div className="space-y-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-white/60 mb-0.5">INTERFACE</div>
                <div className="text-[10px] text-white/40 mb-2">Choose your dashboard atmosphere</div>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {Object.values(dashboardThemes).map(t => {
                  const isSelected = t.id === dashboardThemeId
                  return (
                    <button
                      key={t.id}
                      onClick={() => setDashboardThemeId(t.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-white/10 border-white/30 shadow-md'
                          : 'bg-white/3 border-white/5 hover:bg-white/6 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-black/40 px-1.5 py-1 rounded-lg border border-white/5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.colors.primary }} />
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.colors.bright }} />
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.colors.highlight }} />
                        </div>
                        <span className="text-xs font-medium text-white/90">{t.name}</span>
                      </div>
                      {isSelected && (
                        <span className="text-xs font-bold" style={{ color: t.colors.bright }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* GRAPH THEME */}
            <div className="space-y-2 border-t border-white/10 pt-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-white/60 mb-0.5">GRAPH</div>
                <div className="text-[10px] text-white/40 mb-2">Customize repository visualization</div>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {Object.values(graphThemes).map(t => {
                  const isSelected = t.id === graphThemeId
                  const toHex = (num) => '#' + num.toString(16).padStart(6, '0')
                  return (
                    <button
                      key={t.id}
                      onClick={() => setGraphThemeId(t.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-white/10 border-white/30 shadow-md'
                          : 'bg-white/3 border-white/5 hover:bg-white/6 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: toHex(t.normalCore) }} />
                          <span className="w-2.5 h-0.5" style={{ backgroundColor: toHex(t.edge) }} />
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: toHex(t.normalCenter) }} />
                          <span className="w-2.5 h-0.5" style={{ backgroundColor: toHex(t.edge) }} />
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: toHex(t.headCore) }} />
                        </div>
                        <span className="text-xs font-medium text-white/90">{t.name}</span>
                      </div>
                      {isSelected && (
                        <span className="text-xs font-bold" style={{ color: toHex(t.normalCenter) }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Graph Glow */}
            <div className="border-t border-white/10 pt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60 font-medium">Graph Glow</span>
                <span className="text-xs font-mono uppercase tracking-wider text-white/40">{intensity}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/30 rounded-xl border border-white/5">
                {['subtle', 'balanced', 'luminous'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setIntensity(lvl)}
                    className={`py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                      intensity === lvl
                        ? 'bg-white/15 text-white shadow-sm font-semibold'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset */}
            <div className="border-t border-white/10 pt-3">
              <button
                onClick={handleReset}
                className="w-full py-2 text-xs font-medium text-white/50 hover:text-white/90 hover:bg-white/5 rounded-lg transition-all"
              >
                Reset Appearance
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
