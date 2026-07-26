import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { generateGrowthCharts } from '../analytics/fileAnalytics'

/**
 * BarChart
 * Interactive SVG bar chart with hover tooltips and clean gridlines.
 */
function BarChart({ title, subtitle, data, color = 'var(--theme-primary)', unit = '', icon = '📊' }) {
  const [hoverIdx, setHoverIdx] = useState(null)

  const maxVal = useMemo(() => {
    if (!data || data.length === 0) return 1
    return Math.max(...data.map(d => d.count), 1)
  }, [data])

  if (!data || data.length === 0) return null

  return (
    <div className="glass rounded-2xl p-5 border border-white/6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-base">{icon}</span>
            <h3 className="font-bold text-white text-base">{title}</h3>
          </div>
          {hoverIdx !== null && data[hoverIdx] && (
            <div className="font-mono text-xs px-2.5 py-1 rounded bg-white/10 border border-white/15 text-[var(--theme-bright)]">
              {data[hoverIdx].label}: <strong className="text-white">{data[hoverIdx].count}</strong> {unit}
            </div>
          )}
        </div>
        <p className="text-xs text-white/40 mb-6">{subtitle}</p>
      </div>

      {/* SVG Bar Chart Area */}
      <div className="h-44 w-full relative flex items-end gap-1 pt-4 pb-6 border-b border-white/10">
        {data.map((item, idx) => {
          const heightPct = Math.max(8, (item.count / maxVal) * 100)
          const isHovered = hoverIdx === idx
          return (
            <div
              key={idx}
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
              className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative"
            >
              {/* Bar */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{ duration: 0.5, delay: idx * 0.01 }}
                className="w-full max-w-[28px] rounded-t-sm transition-all"
                style={{
                  background: isHovered
                    ? 'var(--theme-bright)'
                    : `linear-gradient(180deg, ${color}, ${color}70)`,
                  boxShadow: isHovered ? '0 0 12px var(--theme-bright)' : 'none',
                  opacity: hoverIdx !== null && !isHovered ? 0.4 : 1,
                }}
              />
              {/* Label below bar */}
              {(idx === 0 || idx === Math.floor(data.length / 2) || idx === data.length - 1) && (
                <span className="absolute -bottom-5 text-[10px] font-mono text-white/40 truncate max-w-full">
                  {item.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * LineChart
 * Interactive SVG area chart for cumulative metrics like observed files and contributors.
 */
function AreaChart({ title, subtitle, data, color = '#00e676', unit = '', icon = '📈' }) {
  const [hoverIdx, setHoverIdx] = useState(null)

  const maxVal = useMemo(() => {
    if (!data || data.length === 0) return 1
    return Math.max(...data.map(d => d.count), 1)
  }, [data])

  if (!data || data.length === 0) return null

  // Calculate polygon points
  const points = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * 100
    const y = 100 - (d.count / maxVal) * 85 // reserve top 15%
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `0,100 ${points} 100,100`

  return (
    <div className="glass rounded-2xl p-5 border border-white/6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-base">{icon}</span>
            <h3 className="font-bold text-white text-base">{title}</h3>
          </div>
          {hoverIdx !== null && data[hoverIdx] && (
            <div className="font-mono text-xs px-2.5 py-1 rounded bg-white/10 border border-white/15 text-[var(--theme-bright)]">
              {data[hoverIdx].label}: <strong className="text-white">{data[hoverIdx].count}</strong> {unit}
            </div>
          )}
        </div>
        <p className="text-xs text-white/40 mb-6">{subtitle}</p>
      </div>

      {/* SVG Chart */}
      <div className="h-44 w-full relative pt-4 pb-6 border-b border-white/10">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          {/* Grid lines */}
          <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="2" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="2" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="2" />

          {/* Area gradient */}
          <defs>
            <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill={`url(#grad-${title})`} />

          {/* Line stroke */}
          <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

          {/* Interactive dots */}
          {data.map((d, i) => {
            const x = (i / Math.max(1, data.length - 1)) * 100
            const y = 100 - (d.count / maxVal) * 85
            const isHovered = hoverIdx === i
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={isHovered ? 3.5 : 1.5}
                fill={isHovered ? '#fff' : color}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
            )
          })}
        </svg>

        {/* X-axis labels */}
        <div className="absolute left-0 right-0 -bottom-5 flex justify-between text-[10px] font-mono text-white/40">
          <span>{data[0]?.label}</span>
          <span>{data[Math.floor(data.length / 2)]?.label}</span>
          <span>{data[data.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  )
}

export default function GrowthCharts({ parsedData }) {
  const charts = useMemo(() => {
    if (!parsedData) return null
    return generateGrowthCharts(parsedData)
  }, [parsedData])

  if (!charts) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-white/40">
        Insufficient repository history to calculate time-series growth charts.
      </div>
    )
  }

  const periodLabel = charts.isWeekly ? 'Weekly' : 'Monthly'

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="glass rounded-2xl p-5 border border-white/6">
        <h2 className="text-lg font-bold text-white">Codebase Observation Charts</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Visualizes real cumulative observations and velocity across {periodLabel.toLowerCase()} buckets in the loaded commit history.
        </p>
      </div>

      {/* The 3 Core Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AreaChart
          title="Files Observed Over Time"
          subtitle={`Cumulative unique files touched across ${periodLabel.toLowerCase()} intervals.`}
          data={charts.filesOverTime}
          color="var(--theme-bright)"
          unit="files"
          icon="📁"
        />

        <AreaChart
          title="Contributors Over Time"
          subtitle={`Cumulative active authors observed across ${periodLabel.toLowerCase()} intervals.`}
          data={charts.contributorsOverTime}
          color="#61dafb"
          unit="devs"
          icon="👥"
        />

        <BarChart
          title={`Commit Velocity (${periodLabel})`}
          subtitle={`Recorded commit frequency per ${periodLabel.toLowerCase()} interval.`}
          data={charts.commitVelocity}
          color="var(--theme-primary)"
          unit="commits"
          icon="⚡"
        />
      </div>
    </div>
  )
}
