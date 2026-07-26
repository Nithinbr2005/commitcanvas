import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import axios from 'axios'

import Visualizer       from '../components/Visualizer'
import PlaybackControls from '../components/PlaybackControls'
import CommitDetailsPanel from '../components/CommitDetailsPanel'
import ActivityHeatmap  from '../components/ActivityHeatmap'
import SearchFilter     from '../components/SearchFilter'
import ErrorBoundary    from '../components/ErrorBoundary'
import ThemeSelector    from '../components/ThemeSelector'
import { normalizeGitData } from '../utils/normalizeGitData'
import { usePlayback }      from '../store/usePlayback'

/* ─────────────────────────────────────────
   Export helpers
───────────────────────────────────────── */
function exportJSON(parsed) {
  const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'commits.json'
  a.click()
  URL.revokeObjectURL(url)
}

function exportPNG() {
  const canvas = document.querySelector('.graph-canvas-wrap canvas')
  if (!canvas) return
  const url = canvas.toDataURL('image/png')
  const a   = document.createElement('a')
  a.href    = url
  a.download = 'commitcanvas.png'
  a.click()
}

/* ─────────────────────────────────────────
   Time helpers
───────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60)      return 'just now'
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/* ─────────────────────────────────────────
   Repo header bar (owner / repo + badges)
───────────────────────────────────────── */
function RepoBar({ owner, repo, parsed }) {
  const commits    = parsed?.commits || []
  const branches   = parsed?.branches || []
  const contributors = parsed?.contributors || []
  const lastTs     = commits.length ? Math.max(...commits.map(c => c.timestamp)) : null
  const defaultBranch = parsed?.meta?.default_branch || parsed?.defaultBranch || 'main'

  const badges = [
    { value: defaultBranch, color: '#00e676', icon: (
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 3.314-5.373 6-12 6" />
      </svg>
    )},
    { value: lastTs ? timeAgo(lastTs) : '—', color: '#a78bfa', icon: (
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    )},
    { value: `${contributors.length || '?'} contributor${contributors.length !== 1 ? 's' : ''}`, color: '#00e5ff', icon: (
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    )},
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl px-6 py-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/40 to-cyan-600/30 border border-white/10 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-violet-300" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-white/40 font-medium text-sm">{owner}</span>
            <span className="text-white/40 text-sm">/</span>
            <span className="font-display font-bold text-lg text-white">{repo}</span>
          </div>
          {parsed?.meta?.description && (
            <p className="text-xs text-white/35 mt-0.5 truncate max-w-sm">{parsed.meta.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2">
        {badges.map((b, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: `${b.color}12`, border: `1px solid ${b.color}25` }}>
            <span style={{ color: b.color }}>{b.icon}</span>
            <span className="text-xs font-medium" style={{ color: b.color }}>{b.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────
   Stats row — exactly 6 metrics
───────────────────────────────────────── */
const STAT_DEFS = [
  { id: 'commits',      label: 'Commits',        color: '#7c4dff' },
  { id: 'branches',     label: 'Branches',        color: '#00e5ff' },
  { id: 'contributors', label: 'Contributors',    color: '#00e676' },
  { id: 'merges',       label: 'Merge Commits',   color: '#ffd740' },
  { id: 'age',          label: 'Repo Age (days)', color: '#f472b6' },
  { id: 'avgday',       label: 'Avg / Day',       color: '#60a5fa' },
]

function StatCard({ label, value, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className="glass rounded-2xl p-5 flex flex-col gap-2 hover:scale-[1.02] transition-transform cursor-default"
      style={{ border: `1px solid ${color}20` }}
    >
      <div className="text-3xl font-bold font-display tracking-tight" style={{ color }}>{value}</div>
      <div className="text-xs text-white/45 uppercase tracking-wider font-medium">{label}</div>
    </motion.div>
  )
}

function StatsRow({ parsed }) {
  const commits      = parsed?.commits || []
  const branches     = parsed?.branches || []
  const contributors = parsed?.contributors || []
  const sorted       = [...commits].sort((a, b) => a.timestamp - b.timestamp)

  const mergeCount = commits.filter(c => c.isMerge).length
  const repoAge    = sorted.length >= 2
    ? Math.round((sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 86400)
    : 0
  const avgPerDay  = repoAge > 0 ? (commits.length / repoAge).toFixed(1) : '—'

  const values = {
    commits:      commits.length,
    branches:     branches.length,
    contributors: contributors.length,
    merges:       mergeCount,
    age:          repoAge,
    avgday:       avgPerDay,
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {STAT_DEFS.map((s, i) => (
        <StatCard
          key={s.id}
          label={s.label}
          value={values[s.id]}
          color={s.color}
          delay={i * 0.06}
        />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────
   Main RepositoryPage
───────────────────────────────────────── */
export default function RepositoryPage() {
  const { owner, repo } = useParams()
  const location        = useLocation()
  const navigate        = useNavigate()

  const [parsedData, setParsedData]   = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [selectedCommit, setSelectedCommit] = useState(null)
  const [filteredCommits, setFilteredCommits] = useState(null)
  const [searchOpen, setSearchOpen]   = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef(null)

  // ── Story → Graph: select commit by SHA when arriving from Story page ──────
  const pendingSelectSha = location.state?.selectSha || null
  const pendingPlayFile  = location.state?.playFile  || null

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); setSearchOpen(true)
      }
      if (e.key === 'Escape') { setSearchOpen(false); setExportMenuOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Close export on outside click ──
  useEffect(() => {
    if (!exportMenuOpen) return
    const handler = (e) => { if (!exportMenuRef.current?.contains(e.target)) setExportMenuOpen(false) }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [exportMenuOpen])

  // ── Load data ──
  useEffect(() => {
    // If navigated with state, use it directly
    if (location.state?.data) {
      setParsedData(location.state.data)
      return
    }

    // Otherwise re-fetch (browser refresh or direct URL)
    const repoUrl = `https://github.com/${owner}/${repo}`
    setLoading(true)
    setError(null)
    axios.post('https://commit-canvas-api.onrender.com/api/repo/fetch', { repoUrl })
      .then(r => {
        const data = r.data.data
        if (!data || !data.commits || !Array.isArray(data.commits)) {
          setError('Failed to fetch repository data.')
          return
        }
        setParsedData(normalizeGitData(data))
      })
      .catch(err => {
        setError(
          typeof err?.response?.data?.error === 'string'
            ? err.response.data.error
            : err?.message || 'Failed to load repository'
        )
      })
      .finally(() => setLoading(false))
  }, [owner, repo, location.state])

  // ── Apply pending selectSha once parsedData is ready ──────────────────────
  useEffect(() => {
    if (!pendingSelectSha || !parsedData?.commits) return
    const target = parsedData.commits.find(c => c.sha === pendingSelectSha)
    if (target) setSelectedCommit(target)
  }, [pendingSelectSha, parsedData])

  // ── File History Playback: filter graph by file and auto-select commits ────
  useEffect(() => {
    if (!pendingPlayFile || !parsedData?.commits) return
    const shas = new Set()
    const targetCommits = []
    for (const c of parsedData.commits) {
      if (Array.isArray(c.files) && c.files.some(f => (f.filename || f.path || f) === pendingPlayFile)) {
        shas.add(c.sha)
        targetCommits.push(c)
      }
    }
    if (shas.size > 0) {
      setFilteredCommits(shas)
      if (targetCommits.length > 0 && !pendingSelectSha && !selectedCommit) {
        setSelectedCommit(targetCommits[targetCommits.length - 1])
      }
    }
  }, [pendingPlayFile, pendingSelectSha, parsedData])

  // ── Auto-sync Commit Details during File History playback ──────────────────
  useEffect(() => {
    if (!filteredCommits || !parsedData?.commits) return
    return usePlayback.subscribe((state) => {
      if (!state.playing) return
      const minTs = parsedData.commits[0]?.timestamp || 0
      const currentTs = minTs + state.time
      let latestMatch = null
      for (const c of parsedData.commits) {
        if (c.timestamp <= currentTs && filteredCommits.has(c.sha)) {
          latestMatch = c
        } else if (c.timestamp > currentTs) {
          break
        }
      }
      if (latestMatch && latestMatch.sha !== selectedCommit?.sha) {
        setSelectedCommit(latestMatch)
      }
    })
  }, [filteredCommits, parsedData, selectedCommit?.sha])

  const handleFilter = useCallback((commits) => {
    if (!commits) { setFilteredCommits(null); return }
    setFilteredCommits(new Set(commits.map(c => c.sha)))
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-animated-grid" style={{ background: 'var(--bg-base)' }}>
      {/* ── Header ── */}
      <header className="glass-strong sticky top-0 z-40 border-b border-white/6">
        <div className="max-w-screen-2xl mx-auto px-5 h-14 flex items-center gap-4">
          {/* Logo / back */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 flex-shrink-0 group"
            title="Back to home"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center transition-transform group-hover:scale-105">
              <svg viewBox="0 0 20 20" className="w-4 h-4 text-white" fill="none">
                <circle cx="4"  cy="10" r="2.5" fill="currentColor" opacity="0.9" />
                <circle cx="10" cy="6"  r="2.5" fill="currentColor" opacity="0.9" />
                <circle cx="16" cy="10" r="2.5" fill="currentColor" opacity="0.9" />
                <path d="M6.5 10 Q8 6 10 6" stroke="currentColor" strokeWidth="1" fill="none" strokeOpacity="0.6"/>
                <path d="M10 6 Q13 6 13.5 10" stroke="currentColor" strokeWidth="1" fill="none" strokeOpacity="0.6"/>
              </svg>
            </div>
            <span className="font-display font-bold text-base text-white tracking-tight">CommitCanvas</span>
          </button>

          <div className="w-px h-5 bg-white/10 flex-shrink-0" />

          {/* Owner/Repo breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
            <span className="text-white/35 truncate">{owner}</span>
            <span className="text-white/20">/</span>
            <span className="text-white/70 font-medium truncate">{repo}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Nav tabs: Graph (active) | Story | Contributors */}
            <div className="flex items-center gap-1 mr-1">
              {[
                { id: 'graph',        label: 'Graph',        active: true,  path: null },
                { id: 'story',        label: 'Story',        active: false, path: `/repository/${owner}/${repo}/story` },
                { id: 'contributors', label: 'Contributors', active: false, path: `/repository/${owner}/${repo}/contributors` },
                { id: 'files',        label: 'Files',        active: false, path: `/repository/${owner}/${repo}/files` },
                { id: 'time-machine', label: 'Time Machine', active: false, path: `/repository/${owner}/${repo}/time-machine` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => !tab.active && parsedData && navigate(tab.path, { state: { data: parsedData } })}
                  disabled={!tab.active && !parsedData}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    color:      tab.active ? 'var(--theme-bright)' : 'rgba(255,255,255,0.45)',
                    background: tab.active ? 'var(--theme-surface-elevated)' : 'transparent',
                    border:     tab.active ? '1px solid var(--theme-border-hover)' : '1px solid transparent',
                    cursor:     tab.active ? 'default' : 'pointer',
                  }}
                  onMouseEnter={e => {
                    if (tab.active) return
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
                  }}
                  onMouseLeave={e => {
                    if (tab.active) return
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.45)'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Showcase Action — Present */}
            <button
              onClick={() => parsedData && navigate(`/repository/${owner}/${repo}/present`, { state: { data: parsedData, from: location.pathname } })}
              disabled={!parsedData}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg disabled:opacity-30 flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-bright))',
                color: '#fff',
                boxShadow: '0 0 15px rgba(0, 230, 118, 0.25)',
              }}
              title="Start Cinematic Presentation"
            >
              <span className="text-xs">▶</span> Present
            </button>

            <ThemeSelector />


            <button
              id="search-btn"
              onClick={() => setSearchOpen(true)}
              disabled={!parsedData}
              className="btn-ghost flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Search commits (/)"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline font-mono text-white/20 text-xs bg-white/8 px-1 py-0.5 rounded border border-white/10">/</kbd>
            </button>

            <div className="relative" ref={exportMenuRef}>
              <button
                id="export-btn"
                onClick={() => setExportMenuOpen(v => !v)}
                disabled={!parsedData}
                className="btn-ghost flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span className="hidden sm:inline">Export</span>
              </button>
              <AnimatePresence>
                {exportMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 glass-strong rounded-xl overflow-hidden z-50 w-44"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {[
                      { label: 'Export as PNG',  action: exportPNG, icon: '🖼️' },
                      { label: 'Export as JSON', action: () => exportJSON(parsedData), icon: '📄' },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={() => { item.action(); setExportMenuOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/6 hover:text-white transition-colors text-left"
                      >
                        <span>{item.icon}</span><span>{item.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-5 py-5 space-y-4">

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="glass rounded-2xl px-5 py-4 flex items-center gap-3">
              <svg className="animate-spin w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.25} />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
              </svg>
              <span className="text-sm text-white/60">Fetching repository data…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl px-5 py-4 flex items-center justify-between gap-3"
              style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.25)' }}>
              <div className="flex items-center gap-3">
                <span className="text-red-400">⚠</span>
                <span className="text-sm text-red-300">{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-300 transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {parsedData && (
          <ErrorBoundary>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              {/* 1 — Repo identity bar */}
              <RepoBar owner={owner} repo={repo} parsed={parsedData} />

              {/* 2 — Primary metrics */}
              <StatsRow parsed={parsedData} />

              {/* 3 — Git Graph + Commit Details */}
              <div className="glass rounded-2xl overflow-hidden" style={{ minHeight: 540 }}>
                <div className="flex h-full" style={{ minHeight: 540 }}>
                  {/* Graph — flex 1 */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <Visualizer
                      parsed={parsedData}
                      onCommitSelect={setSelectedCommit}
                      filteredShas={filteredCommits}
                      selectedSha={selectedCommit?.sha}
                    />
                  </div>

                  {/* Details panel — fixed width */}
                  <div
                    className="details-panel flex-shrink-0 overflow-y-auto"
                    style={{ width: '30%', minWidth: 260, maxWidth: 380 }}
                  >
                    <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
                      <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Commit Details</span>
                      {selectedCommit && (
                        <button onClick={() => setSelectedCommit(null)} className="text-white/25 hover:text-white/60 transition-colors">
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <AnimatePresence mode="wait">
                      <CommitDetailsPanel
                        key={selectedCommit?.sha || 'empty'}
                        commit={selectedCommit}
                        parsed={parsedData}
                      />
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* 4 — Repository Story Playback */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Repository Story Playback</span>
                </div>
                <PlaybackControls parsed={parsedData} onCommitSelect={setSelectedCommit} />
              </div>

              {/* 5 — Activity Heatmap */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Activity Heatmap</span>
                </div>
                <ActivityHeatmap parsed={parsedData} />
              </div>

            </motion.div>
          </ErrorBoundary>
        )}
      </main>

      <footer className="border-t border-white/5 py-4 text-center">
        <span className="text-xs text-white/15">CommitCanvas — Built with PixiJS, D3, and React</span>
      </footer>

      {/* Search overlay */}
      <AnimatePresence>
        {searchOpen && parsedData && (
          <SearchFilter
            parsed={parsedData}
            onFilter={handleFilter}
            onClose={() => { setSearchOpen(false); setFilteredCommits(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
