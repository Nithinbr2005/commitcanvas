import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../theme/ThemeContext'

function getWeekData(commits) {
  // Build a map of date -> count for the last 52 weeks
  const now = new Date()
  const weeks = 52
  const days = weeks * 7
  const counts = new Array(days).fill(0)
  const base = new Date(now)
  base.setDate(base.getDate() - days + 1)
  base.setHours(0, 0, 0, 0)

  for (const c of commits) {
    const d = new Date(c.timestamp * 1000)
    d.setHours(0, 0, 0, 0)
    const idx = Math.floor((d - base) / 86400000)
    if (idx >= 0 && idx < days) counts[idx]++
  }

  // Reorganize into columns (weeks), starting from Sunday
  const dayOfWeek = base.getDay()
  const grid = [] // grid[col][row] = count
  const totalCols = weeks + (dayOfWeek > 0 ? 1 : 0)

  for (let col = 0; col < weeks; col++) {
    const week = []
    for (let row = 0; row < 7; row++) {
      const dayIdx = col * 7 + row - dayOfWeek
      week.push(dayIdx >= 0 && dayIdx < days ? counts[dayIdx] : null)
    }
    grid.push(week)
  }

  const max = Math.max(...counts, 1)
  return { grid, max, counts, base }
}

function getLevel(count, max) {
  if (!count) return 0
  const ratio = count / max
  if (ratio < 0.15) return 1
  if (ratio < 0.4) return 2
  if (ratio < 0.7) return 3
  return 4
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ActivityHeatmap({ parsed }) {
  const { dashboardTheme } = useTheme()
  const heatmapColors = dashboardTheme.heatmap || ['#151b35', '#1e3a8a', '#2563eb', '#3b82f6', '#38bdf8']

  const levelStyles = useMemo(() => [
    { background: heatmapColors[0] || 'rgba(255,255,255,0.04)' },
    { background: heatmapColors[1] || 'rgba(59,130,246,0.3)' },
    { background: heatmapColors[2] || 'rgba(59,130,246,0.5)' },
    { background: heatmapColors[3] || 'rgba(59,130,246,0.75)' },
    { background: heatmapColors[4] || 'rgba(56,189,248,0.95)' },
  ], [heatmapColors])
  const commits = parsed?.commits || []
  const { grid, max, base } = useMemo(() => getWeekData(commits), [commits])

  const streak = useMemo(() => {
    let s = 0
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const dateSet = new Set(commits.map(c => {
      const d = new Date(c.timestamp * 1000); d.setHours(0, 0, 0, 0); return d.getTime()
    }))
    let d = new Date(today)
    while (dateSet.has(d.getTime())) {
      s++
      d = new Date(d.getTime() - 86400000)
    }
    return s
  }, [commits])

  // Compute month labels based on which column starts a new month
  const monthLabels = useMemo(() => {
    const labels = []
    let lastMonth = -1
    for (let col = 0; col < grid.length; col++) {
      const dayOffset = col * 7
      const d = new Date(base.getTime() + dayOffset * 86400000)
      const month = d.getMonth()
      if (month !== lastMonth) {
        labels.push({ col, label: MONTHS[month] })
        lastMonth = month
      }
    }
    return labels
  }, [grid, base])

  const CELL = 13
  const GAP = 3

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm text-white/80">Activity Heatmap</h3>
        <div className="flex items-center gap-4 text-xs text-white/40">
          {streak > 0 && (
            <span className="text-orange-400 font-medium">🔥 {streak}-day streak</span>
          )}
          <div className="flex items-center gap-1.5">
            <span>Less</span>
            {levelStyles.map((s, i) => (
              <span
                key={i}
                className="heatmap-cell"
                style={{ width: 10, height: 10, display: 'inline-block', ...s }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div style={{ minWidth: grid.length * (CELL + GAP) + 32 }}>
          {/* Month labels */}
          <div className="flex mb-1" style={{ paddingLeft: 30 }}>
            {grid.map((_, col) => {
              const label = monthLabels.find(l => l.col === col)
              return (
                <div key={col} style={{ width: CELL + GAP, flexShrink: 0 }}>
                  {label ? <span className="text-xs text-white/30" style={{ fontSize: 10 }}>{label.label}</span> : null}
                </div>
              )
            })}
          </div>

          <div className="flex gap-0">
            {/* Day labels */}
            <div className="flex flex-col" style={{ gap: GAP, marginRight: 4, paddingTop: 2 }}>
              {DAYS.map((d, i) => (
                <div key={d} style={{ height: CELL, width: 26, fontSize: 9, color: 'rgba(255,255,255,0.25)', lineHeight: `${CELL}px`, textAlign: 'right', paddingRight: 4 }}>
                  {i % 2 === 1 ? d.slice(0, 3) : ''}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex" style={{ gap: GAP }}>
              {grid.map((week, col) => (
                <div key={col} className="flex flex-col" style={{ gap: GAP }}>
                  {week.map((count, row) => {
                    if (count === null) {
                      return <div key={row} style={{ width: CELL, height: CELL }} />
                    }
                    const level = getLevel(count, max)
                    const dayIdx = col * 7 + row
                    const d = new Date(base.getTime() + dayIdx * 86400000)
                    const label = `${MONTHS[d.getMonth()]} ${d.getDate()}: ${count} commit${count !== 1 ? 's' : ''}`
                    return (
                      <div
                        key={row}
                        className="heatmap-cell"
                        style={{ width: CELL, height: CELL, ...levelStyles[level] }}
                        title={label}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
