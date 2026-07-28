import React, { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../theme/ThemeContext'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getLevel(count, max) {
  if (!count) return 0
  
  // Normalize intensity to ensure we can distinguish levels even with high activity
  // If max is small (e.g. 1-2 commits), level appropriately.
  // Example levels: 1 commit = level 1, 2-3 = level 2, 4-6 = level 3, 7+ = level 4
  if (count === 0) return 0
  if (max <= 3) {
    if (count === 1) return 1
    if (count === 2) return 2
    return 3
  }
  
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

function getWeekData(commitCountsByDay, endDate) {
  const weeks = 52
  const days = weeks * 7
  const counts = new Array(days).fill(0)
  
  const base = new Date(endDate)
  base.setDate(base.getDate() - days + 1)
  base.setHours(0, 0, 0, 0)
  const baseTime = base.getTime()

  let maxCount = 1
  
  for (let i = 0; i < days; i++) {
    const time = baseTime + i * 86400000
    const count = commitCountsByDay.get(time) || 0
    counts[i] = count
    if (count > maxCount) maxCount = count
  }

  // Reorganize into columns (weeks), starting from Sunday
  const dayOfWeek = base.getDay()
  const grid = [] // grid[col][row] = count
  
  for (let col = 0; col < weeks; col++) {
    const week = []
    for (let row = 0; row < 7; row++) {
      const dayIdx = col * 7 + row - dayOfWeek
      week.push(dayIdx >= 0 && dayIdx < days ? counts[dayIdx] : null)
    }
    grid.push(week)
  }

  return { grid, max: maxCount, base }
}

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

  // 1 & 14. Aggregate commits by actual calendar date once
  const { commitCountsByDay, earliestDate, latestDate } = useMemo(() => {
    const map = new Map()
    if (commits.length === 0) return { commitCountsByDay: map, earliestDate: null, latestDate: null }

    let min = Infinity
    let max = -Infinity

    for (const c of commits) {
      const d = new Date(c.timestamp * 1000)
      d.setHours(0, 0, 0, 0)
      const time = d.getTime()
      map.set(time, (map.get(time) || 0) + 1)
      
      if (time < min) min = time
      if (time > max) max = time
    }

    return { 
      commitCountsByDay: map, 
      earliestDate: new Date(min), 
      latestDate: new Date(max) 
    }
  }, [commits])

  // Determine initial end date
  // 3 & 4. Shift to latest commit if nothing in the last 12 months
  const defaultEndDate = useMemo(() => {
    if (!latestDate) return new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const oneYearAgo = new Date(today)
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    if (latestDate < oneYearAgo) {
      return new Date(latestDate) // shift to latest commit
    }
    return today
  }, [latestDate])

  const [currentEndDate, setCurrentEndDate] = useState(defaultEndDate)

  // Reset if parsed changes
  useEffect(() => {
    setCurrentEndDate(defaultEndDate)
  }, [defaultEndDate])

  // 10. Handle zero commits
  if (commits.length === 0) {
    return (
      <div className="glass rounded-2xl p-5 flex items-center justify-center min-h-[160px]">
        <p className="text-sm text-white/50">No commit activity available.</p>
      </div>
    )
  }

  const { grid, max, base } = useMemo(() => {
    return getWeekData(commitCountsByDay, currentEndDate)
  }, [commitCountsByDay, currentEndDate])

  const streak = useMemo(() => {
    let s = 0
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let d = new Date(today)
    while (commitCountsByDay.has(d.getTime())) {
      s++
      d = new Date(d.getTime() - 86400000)
    }
    return s
  }, [commitCountsByDay])

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

  // Navigation handlers
  const handlePrevYear = () => {
    const newEnd = new Date(currentEndDate)
    newEnd.setFullYear(newEnd.getFullYear() - 1)
    setCurrentEndDate(newEnd)
  }

  const handleNextYear = () => {
    const newEnd = new Date(currentEndDate)
    newEnd.setFullYear(newEnd.getFullYear() + 1)
    // Don't go past today or the latest commit (whichever is later)
    // Wait, the defaultEndDate is the maximum we should sensibly show, 
    // but if they just want to go forward up to today:
    const maxDate = latestDate > new Date() ? latestDate : new Date()
    maxDate.setHours(0,0,0,0)
    
    if (newEnd > maxDate) {
      setCurrentEndDate(new Date(maxDate))
    } else {
      setCurrentEndDate(newEnd)
    }
  }

  const handleLatest = () => {
    setCurrentEndDate(defaultEndDate)
  }

  const isNextDisabled = () => {
    const maxDate = latestDate > new Date() ? latestDate : new Date()
    maxDate.setHours(0,0,0,0)
    return currentEndDate.getTime() >= maxDate.getTime()
  }
  
  const isPrevDisabled = () => {
    if (!earliestDate) return true
    const gridStart = new Date(base)
    return gridStart.getTime() <= earliestDate.getTime()
  }

  // Contextual label: "Showing repository activity: Apr 2022 - Mar 2023"
  const startMonth = MONTHS[base.getMonth()]
  const startYear = base.getFullYear()
  const endMonth = MONTHS[currentEndDate.getMonth()]
  const endYear = currentEndDate.getFullYear()

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="font-display font-semibold text-sm text-white/80">Activity Heatmap</h3>
          <p className="text-xs text-white/40 mt-1">
            Showing repository activity: {startMonth} {startYear} – {endMonth} {endYear}
          </p>
        </div>
        
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

      <div className="overflow-x-auto pb-1 mb-3">
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
                    const label = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}: ${count} commit${count !== 1 ? 's' : ''}`
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

      {/* Navigation */}
      <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/5">
        <button 
          onClick={handlePrevYear} 
          disabled={isPrevDisabled()}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors text-white/70"
        >
          [ &larr; Previous Year ]
        </button>
        <button 
          onClick={handleLatest} 
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/70"
        >
          [ Latest Activity ]
        </button>
        <button 
          onClick={handleNextYear} 
          disabled={isNextDisabled()}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors text-white/70"
        >
          [ Next Year &rarr; ]
        </button>
      </div>
    </div>
  )
}
