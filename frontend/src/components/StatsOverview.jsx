import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const ICONS = {
  commits: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="4" />
      <path d="M2 12h6M16 12h6" />
    </svg>
  ),
  branches: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 3.314-5.373 6-12 6" />
    </svg>
  ),
  contributors: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  ),
  merges: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 3v12M18 3v5c0 3.314-5.373 6-12 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    </svg>
  ),
  releases: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="m9 12 2 2 4-4" />
      <path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z" />
      <path d="M22 19H2" />
    </svg>
  ),
  age: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  avgday: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9M13 17V5M8 17v-3" />
    </svg>
  ),
  topauthor: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
}

const CARD_COLORS = {
  commits:      { text: 'var(--theme-primary)', icon: 'text-[var(--theme-primary)]' },
  branches:     { text: 'var(--theme-bright)', icon: 'text-[var(--theme-bright)]' },
  contributors: { text: '#00e676', icon: 'text-[#00e676]' }, // Semantic green
  merges:       { text: '#fbbf24', icon: 'text-[#fbbf24]' }, // Semantic gold
  releases:     { text: 'var(--theme-bright)', icon: 'text-[var(--theme-bright)]' },
  age:          { text: 'var(--theme-highlight)', icon: 'text-[var(--theme-highlight)]' },
  avgday:       { text: 'var(--theme-primary)', icon: 'text-[var(--theme-primary)]' },
  topauthor:    { text: 'var(--theme-highlight)', icon: 'text-[var(--theme-highlight)]' },
}

function useCountUp(target, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0)
  const frame = useRef(null)

  useEffect(() => {
    if (typeof target !== 'number') return
    let start = null
    const step = (ts) => {
      if (!start) start = ts + delay
      const elapsed = Math.max(0, ts - start)
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(ease * target))
      if (progress < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration, delay])

  return value
}

function StatCard({ id, icon, label, value, sub, delay = 0, isVisible }) {
  const colors = CARD_COLORS[id] || CARD_COLORS.commits
  const numeric = typeof value === 'number' ? value : null
  const animated = useCountUp(isVisible ? (numeric ?? 0) : 0, 1400, delay)
  const display = numeric !== null ? animated.toLocaleString() : value

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: delay / 1000 }}
      className="stat-card group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-white/5 ${colors.icon}`}>
          {ICONS[id] || ICONS.commits}
        </div>
        {sub && (
          <span className="text-xs text-white/30 font-mono">{sub}</span>
        )}
      </div>
      <div
        className="text-3xl font-bold font-display tracking-tight mb-1"
        style={{ color: colors.text }}
      >
        {display}
      </div>
      <div className="text-xs text-white/50 font-medium uppercase tracking-wider">{label}</div>
    </motion.div>
  )
}

export default function StatsOverview({ parsed }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const commits = parsed?.commits || []
  const branches = parsed?.branches || []
  const contributors = parsed?.contributors || []
  const sorted = [...commits].sort((a, b) => a.timestamp - b.timestamp)

  const mergeCount = commits.filter(c => c.parents && c.parents.length > 1).length

  const repoAge = sorted.length >= 2
    ? Math.round((sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 86400)
    : 0

  const avgPerDay = repoAge > 0 ? (commits.length / repoAge).toFixed(1) : '—'

  const topAuthor = (() => {
    const map = {}
    for (const c of commits) {
      const name = c.author?.name || 'Unknown'
      map[name] = (map[name] || 0) + 1
    }
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0]?.split(' ')[0] || '—'
  })()

  const stats = [
    { id: 'commits',      label: 'Commits',        value: commits.length,      delay: 0 },
    { id: 'branches',     label: 'Branches',        value: branches.length,     delay: 80 },
    { id: 'contributors', label: 'Contributors',    value: contributors.length, delay: 160 },
    { id: 'merges',       label: 'Merge Commits',   value: mergeCount,          delay: 240 },
    { id: 'age',          label: 'Repo Age (days)', value: repoAge,             delay: 320 },
    { id: 'avgday',       label: 'Avg/Day',         value: isNaN(Number(avgPerDay)) ? 0 : Number(avgPerDay), sub: 'commits', delay: 400 },
    { id: 'topauthor',    label: 'Top Contributor', value: topAuthor,           delay: 480 },
    { id: 'releases',     label: 'Open Branches',   value: branches.length,     delay: 560 },
  ]

  return (
    <div ref={ref}>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {stats.map((s) => (
          <StatCard key={s.id} {...s} isVisible={visible} />
        ))}
      </div>
    </div>
  )
}
