import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { generateDirectoryHeatmap } from '../analytics/fileAnalytics'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function DirectoryHeatmap({ parsedData }) {
  const [filterTier, setFilterTier] = useState('All')

  const heatmap = useMemo(() => {
    if (!parsedData) return null
    return generateDirectoryHeatmap(parsedData)
  }, [parsedData])

  const filtered = useMemo(() => {
    if (!heatmap) return []
    if (filterTier === 'All') return heatmap
    return heatmap.filter(d => d.tier === filterTier)
  }, [heatmap, filterTier])

  if (!heatmap || heatmap.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-white/40">
        No directory activity observed in the loaded repository data.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="glass rounded-2xl p-5 border border-white/6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Directory Activity Heatmap</h2>
          <p className="text-xs text-white/40 mt-0.5">
            Observes recorded file-touch frequency across repository folders. Styled dynamically via Dashboard Theme.
          </p>
        </div>

        {/* Tier Filter Buttons */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/20 border border-white/5">
          {['All', 'High', 'Medium', 'Low'].map(tier => {
            const isActive = filterTier === tier
            return (
              <button
                key={tier}
                onClick={() => setFilterTier(tier)}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: isActive ? 'var(--theme-surface-elevated)' : 'transparent',
                  color: isActive ? 'var(--theme-bright)' : 'rgba(255,255,255,0.45)',
                  border: isActive ? '1px solid var(--theme-border-hover)' : '1px solid transparent',
                }}
              >
                {tier}
              </button>
            )
          })}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((dir, idx) => {
          const isHigh = dir.tier === 'High'
          const isMed = dir.tier === 'Medium'
          
          return (
            <motion.div
              key={dir.path || 'root'}
              whileHover={{ y: -3, scale: 1.01 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className="glass rounded-2xl p-5 flex flex-col justify-between transition-all relative overflow-hidden"
              style={{
                border: isHigh
                  ? '1px solid var(--theme-bright)'
                  : isMed
                  ? '1px solid var(--theme-primary)'
                  : '1px solid rgba(255,255,255,0.08)',
                background: isHigh
                  ? 'linear-gradient(135deg, var(--theme-primary)25, var(--theme-surface))'
                  : isMed
                  ? 'linear-gradient(135deg, var(--theme-primary)10, var(--theme-surface))'
                  : 'rgba(255,255,255,0.02)',
                boxShadow: isHigh ? '0 0 20px rgba(0, 230, 118, 0.15)' : 'none',
              }}
            >
              {/* Top Row: Path & Tier Badge */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-mono text-sm font-bold text-white truncate break-all" title={dir.path || 'root'}>
                    📁 {dir.path || 'root'}/
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase flex-shrink-0"
                    style={{
                      background: isHigh ? 'var(--theme-bright)' : isMed ? 'var(--theme-primary)' : 'rgba(255,255,255,0.1)',
                      color: isHigh ? '#000' : isMed ? '#000' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {dir.tier} Activity
                  </span>
                </div>

                <div className="text-xs text-white/50 mb-4 font-mono">
                  {dir.fileCount} observed {dir.fileCount === 1 ? 'file' : 'files'}
                </div>
              </div>

              {/* Bottom Row: Metrics */}
              <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-white/40 block text-[10px] uppercase">Recorded Touches</span>
                  <span className="font-mono font-bold text-sm text-[var(--theme-bright)]">
                    {dir.touchCount}×
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px] uppercase">Contributors</span>
                  <span className="font-mono font-bold text-sm text-white">
                    {dir.contributorCount} {dir.contributorCount === 1 ? 'dev' : 'devs'}
                  </span>
                </div>
                <div className="col-span-2 mt-1">
                  <span className="text-white/40 text-[10px] uppercase">Latest Observed Change: </span>
                  <span className="font-mono text-white/70 text-[11px]">{fmtDate(dir.latestTs)}</span>
                </div>
              </div>

              {/* Glowing Background Accent for High Activity */}
              {isHigh && (
                <div
                  className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full pointer-events-none blur-xl opacity-40"
                  style={{ background: 'var(--theme-bright)' }}
                />
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
