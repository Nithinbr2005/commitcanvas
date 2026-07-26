import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

import CommitDetailsPanel from '../components/CommitDetailsPanel'
import { normalizeGitData } from '../utils/normalizeGitData'
import { analyzeRepository } from '../analytics/repositoryAnalytics'

/* ─────────────────────────────────────────
   Deterministic avatar color from name
───────────────────────────────────────── */
function avatarColor(name = '') {
  const h = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return `hsl(${h}, 60%, 50%)`
}
function initials(name = '') {
  return name.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase() || '?'
}

/* ─────────────────────────────────────────
   Date helpers
───────────────────────────────────────── */
function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
function fmtMonth(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/* ─────────────────────────────────────────
   Mini activity bar for a contributor
   Shows last N weeks (or month buckets)
───────────────────────────────────────── */
function ActivitySparkline({ commits, totalCommits }) {
  // Bucket by ISO week, then render bars
  const weeks = useMemo(() => {
    if (!commits.length) return []
    const sorted = [...commits].sort((a, b) => a.timestamp - b.timestamp)
    const first = sorted[0].timestamp
    const last  = sorted[sorted.length - 1].timestamp
    const totalWeeks = Math.max(1, Math.ceil((last - first) / (7 * 86400))) + 1

    // Build week index → count map
    const buckets = new Map()
    for (const c of sorted) {
      const weekIdx = Math.floor((c.timestamp - first) / (7 * 86400))
      buckets.set(weekIdx, (buckets.get(weekIdx) || 0) + 1)
    }

    const max = Math.max(...buckets.values(), 1)
    const weeks = []
    for (let i = 0; i <= Math.min(totalWeeks, 52); i++) {
      weeks.push({ count: buckets.get(i) || 0, max })
    }
    return weeks
  }, [commits])

  if (!weeks.length) return null

  return (
    <div className="flex items-end gap-0.5" style={{ height: 28 }}>
      {weeks.map((w, i) => (
        <div
          key={i}
          style={{
            width: Math.max(2, Math.floor(200 / weeks.length)),
            height: w.count === 0 ? 2 : Math.max(3, Math.round((w.count / w.max) * 28)),
            borderRadius: 2,
            background: w.count === 0
              ? 'rgba(255,255,255,0.06)'
              : `var(--theme-primary)`,
            opacity: w.count === 0 ? 1 : 0.4 + (w.count / w.max) * 0.6,
            transition: 'height 0.3s ease',
            flexShrink: 0,
          }}
          title={w.count ? `${w.count} commit(s)` : 'No commits'}
        />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────
   Contributor card (in the left list)
───────────────────────────────────────── */
function ContributorCard({ contributor, isActive, commitCount, rank, onSelect }) {
  const color = avatarColor(contributor.authorName)
  const pct   = commitCount > 0 ? Math.round((contributor.commits.length / commitCount) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: rank * 0.06 }}
      onClick={() => onSelect(contributor)}
      whileHover={{ y: -2 }}
      className="cursor-pointer rounded-2xl p-4 transition-all"
      style={{
        background: isActive
          ? `linear-gradient(135deg, ${color}15, rgba(255,255,255,0.04))`
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? color + '50' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isActive ? `0 4px 24px ${color}25` : 'none',
        transition: 'all 0.25s ease',
      }}
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 relative"
          style={{
            background: `linear-gradient(135deg, ${color}88, ${color}44)`,
            border: `2px solid ${isActive ? color : color + '40'}`,
            boxShadow: isActive ? `0 0 16px ${color}40` : 'none',
            transition: 'all 0.25s ease',
          }}
        >
          {initials(contributor.authorName)}
          {rank === 0 && (
            <div
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs"
              style={{ background: '#ffd740', color: '#000', fontWeight: 800, fontSize: 9 }}
              title="Top contributor"
            >
              ★
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div
              className="font-semibold text-sm truncate"
              style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.8)' }}
            >
              {contributor.authorName}
            </div>
            <div
              className="text-xs font-bold font-mono flex-shrink-0 px-2 py-0.5 rounded-lg"
              style={{
                background: `${color}18`,
                border: `1px solid ${color}30`,
                color,
              }}
            >
              {contributor.commits.length}
            </div>
          </div>

          {/* Share bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: rank * 0.06 + 0.2 }}
                className="h-full rounded-full"
                style={{ background: color }}
              />
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)', width: 32, textAlign: 'right' }}>
              {pct}%
            </span>
          </div>

          {/* Sparkline */}
          <div className="mt-2">
            <ActivitySparkline commits={contributor.commits} totalCommits={commitCount} />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
            <span>{fmtDate(contributor.firstTimestamp)}</span>
            {contributor.lastTimestamp !== contributor.firstTimestamp && (
              <>
                <span>→</span>
                <span>{fmtDate(contributor.lastTimestamp)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────
   Right panel: contributor detail + commit list + CommitDetailsPanel
───────────────────────────────────────── */
function ContributorDetailPanel({ contributor, parsedData, onViewInGraph }) {
  const [selectedCommit, setSelectedCommit] = useState(null)

  // Reset selected commit when contributor changes
  useEffect(() => {
    setSelectedCommit(null)
  }, [contributor?.authorLogin])

  if (!contributor) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-6 gap-4 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.4}
               style={{ color: 'rgba(255,255,255,0.2)' }}>
            <circle cx="9" cy="7" r="4" />
            <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Select a contributor<br />to see their journey
        </p>
      </div>
    )
  }

  const color = avatarColor(contributor.authorName)
  const sortedCommits = [...contributor.commits].sort((a, b) => b.timestamp - a.timestamp)

  // Stats for this contributor
  const mergeCount    = contributor.commits.filter(c => c.isMerge).length
  const filesChanged  = contributor.commits.reduce((acc, c) => acc + (c.files?.length || 0), 0)
  const activeDays    = contributor.lastTimestamp > contributor.firstTimestamp
    ? Math.round((contributor.lastTimestamp - contributor.firstTimestamp) / 86400)
    : 0

  return (
    <div className="flex flex-col h-full">
      {/* Contributor header */}
      <div
        className="flex-shrink-0 p-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${color}88, ${color}44)`,
              border: `2px solid ${color}60`,
              boxShadow: `0 0 20px ${color}30`,
            }}
          >
            {initials(contributor.authorName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-base text-white truncate">
              {contributor.authorName}
            </div>
            {contributor.authorLogin !== contributor.authorName && (
              <div className="text-xs font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {contributor.authorLogin}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: contributor.commits.length, l: 'Commits' },
            { v: mergeCount,                 l: 'Merges'  },
            { v: activeDays > 0 ? `${activeDays}d` : '—', l: 'Span' },
          ].map(({ v, l }) => (
            <div
              key={l}
              className="rounded-xl p-2 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="text-base font-bold font-display" style={{ color }}>
                {v}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{l}</div>
            </div>
          ))}
        </div>

        {/* First / Last */}
        <div className="flex gap-4 mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.25)' }}>First: </span>
            <span>{fmtDate(contributor.firstTimestamp)}</span>
          </div>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.25)' }}>Last: </span>
            <span>{fmtDate(contributor.lastTimestamp)}</span>
          </div>
        </div>
      </div>

      {/* Split: commit list (left-ish) + CommitDetails */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Selected commit details header */}
        {selectedCommit && (
          <div
            className="flex-shrink-0 px-4 py-2 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>
              Commit Details
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onViewInGraph(selectedCommit.sha)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                style={{
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                  color,
                }}
              >
                Graph
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M7 17 17 7M7 7h10v10" />
                </svg>
              </button>
              <button
                onClick={() => setSelectedCommit(null)}
                className="text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {selectedCommit ? (
          /* CommitDetailsPanel — existing component, zero modifications */
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <CommitDetailsPanel
                key={selectedCommit.sha}
                commit={selectedCommit}
                parsed={parsedData}
              />
            </AnimatePresence>
          </div>
        ) : (
          /* Commit list */
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2 flex items-center justify-between sticky top-0 z-10"
                 style={{ background: 'var(--theme-surface)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                {sortedCommits.length} commit{sortedCommits.length !== 1 ? 's' : ''} · click to inspect
              </span>
            </div>
            <div className="p-2 space-y-1">
              {sortedCommits.map((commit, i) => (
                <motion.button
                  key={commit.sha}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.025 }}
                  onClick={() => setSelectedCommit(commit)}
                  className="w-full text-left rounded-xl px-3 py-2.5 transition-all group"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${color}10`
                    e.currentTarget.style.borderColor = `${color}25`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                    e.currentTarget.style.borderColor = 'transparent'
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Merge / normal indicator */}
                    <div
                      className="flex-shrink-0 mt-0.5 w-2 h-2 rounded-full"
                      style={{
                        background: commit.isMerge ? '#ffd740' : color,
                        boxShadow: commit.isMerge ? '0 0 6px #ffd74060' : `0 0 4px ${color}40`,
                        marginTop: 5,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="font-mono text-xs font-medium"
                          style={{ color }}
                        >
                          {commit.sha.slice(0, 7)}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          {fmtDate(commit.timestamp)}
                        </span>
                      </div>
                      <div
                        className="text-xs mt-0.5 truncate leading-snug"
                        style={{ color: 'rgba(255,255,255,0.6)' }}
                      >
                        {commit.message?.split('\n')[0] || '—'}
                      </div>
                      {commit.isMerge && (
                        <span
                          className="inline-block text-xs px-1.5 py-0.5 rounded mt-0.5"
                          style={{
                            background: 'rgba(255,215,64,0.12)',
                            border: '1px solid rgba(255,215,64,0.25)',
                            color: '#ffd740',
                            fontSize: 10,
                          }}
                        >
                          merge
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Shared page header (nav tabs)
───────────────────────────────────────── */
function PageHeader({ owner, repo, parsedData, activeTab }) {
  const navigate = useNavigate()

  const tabs = [
    { id: 'graph',        label: 'Graph',        path: `/repository/${owner}/${repo}`              },
    { id: 'story',        label: 'Story',        path: `/repository/${owner}/${repo}/story`        },
    { id: 'contributors', label: 'Contributors', path: `/repository/${owner}/${repo}/contributors` },
    { id: 'files',        label: 'Files',        path: `/repository/${owner}/${repo}/files`        },
    { id: 'time-machine', label: 'Time Machine', path: `/repository/${owner}/${repo}/time-machine` },
  ]

  return (
    <header
      className="glass-strong sticky top-0 z-40"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="max-w-screen-2xl mx-auto px-5 h-14 flex items-center gap-4">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 flex-shrink-0 group"
          title="Back to home"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
            style={{ background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-bright))' }}
          >
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

        <div className="w-px h-5 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
          <span className="truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{owner}</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <span className="font-medium truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{repo}</span>
        </div>

        {/* Nav tabs */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {tabs.map(tab => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => !isActive && navigate(tab.path, { state: { data: parsedData } })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  color:      isActive ? 'var(--theme-bright)' : 'rgba(255,255,255,0.45)',
                  background: isActive ? 'var(--theme-surface-elevated)' : 'transparent',
                  border:     isActive ? '1px solid var(--theme-border-hover)' : '1px solid transparent',
                  cursor:     isActive ? 'default' : 'pointer',
                }}
                onMouseEnter={e => {
                  if (isActive) return
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
                }}
                onMouseLeave={e => {
                  if (isActive) return
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.45)'
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

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
      </div>
    </header>
  )
}

/* ─────────────────────────────────────────
   Main ContributorStoryPage
───────────────────────────────────────── */
export default function ContributorStoryPage() {
  const { owner, repo } = useParams()
  const location        = useLocation()
  const navigate        = useNavigate()

  const [parsedData, setParsedData]           = useState(null)
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState(null)
  const [activeContributor, setActiveContributor] = useState(null)

  // ── Load data ──
  useEffect(() => {
    if (location.state?.data) {
      setParsedData(location.state.data)
      return
    }
    const repoUrl = `https://github.com/${owner}/${repo}`
    setLoading(true)
    setError(null)
    axios
      .post('https://commit-canvas-api.onrender.com/api/repo/fetch', { repoUrl })
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

  // ── Derive contributor analytics ──
  const analytics = useMemo(() => {
    if (!parsedData) return null
    return analyzeRepository(parsedData)
  }, [parsedData])

  // Contributors sorted by commit count descending
  const contributors = useMemo(() => {
    if (!analytics) return []
    return [...analytics.contributorActivity].sort(
      (a, b) => b.commits.length - a.commits.length
    )
  }, [analytics])

  // Auto-select top contributor on load
  useEffect(() => {
    if (contributors.length > 0 && !activeContributor) {
      setActiveContributor(contributors[0])
    }
  }, [contributors, activeContributor])

  const totalCommits = analytics?.commitCount || 0

  const handleViewInGraph = useCallback((sha) => {
    navigate(`/repository/${owner}/${repo}`, {
      state: { data: parsedData, selectSha: sha },
    })
  }, [navigate, owner, repo, parsedData])

  return (
    <div
      className="min-h-screen flex flex-col bg-animated-grid"
      style={{ background: 'var(--bg-base)' }}
    >
      <PageHeader owner={owner} repo={repo} parsedData={parsedData} activeTab="contributors" />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-5 py-6">

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 glass rounded-2xl px-5 py-4"
            >
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"
                   style={{ color: 'var(--theme-primary)' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.25} />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
              </svg>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Fetching repository data…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl px-5 py-4 flex items-center justify-between gap-3 mb-4"
              style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.25)' }}
            >
              <div className="flex items-center gap-3">
                <span style={{ color: '#f87171' }}>⚠</span>
                <span className="text-sm" style={{ color: '#fca5a5' }}>{error}</span>
              </div>
              <button onClick={() => setError(null)} style={{ color: 'rgba(248,113,113,0.5)' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {parsedData && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {/* ── Page hero ── */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #00e67615, #00e67608)',
                    border: '1px solid rgba(0,230,118,0.2)',
                  }}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5}
                       style={{ color: '#00e676' }}>
                    <circle cx="9" cy="7" r="4" />
                    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-display font-bold text-2xl text-white tracking-tight">
                    Contributor Story
                  </h1>
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {owner}/{repo} — {contributors.length} contributor{contributors.length !== 1 ? 's' : ''} · {totalCommits} commits in loaded history
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── Two-column layout ── */}
            <div className="flex flex-col lg:flex-row gap-5" style={{ alignItems: 'flex-start' }}>

              {/* LEFT — Contributor list */}
              <div className="w-full lg:flex-shrink-0 space-y-3" style={{ flexBasis: '38%', maxWidth: 420 }}>
                {contributors.length === 0 ? (
                  <div
                    className="rounded-2xl px-6 py-12 text-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      No contributor data available in the loaded history.
                    </p>
                  </div>
                ) : (
                  contributors.map((c, i) => (
                    <ContributorCard
                      key={c.authorLogin}
                      contributor={c}
                      isActive={activeContributor?.authorLogin === c.authorLogin}
                      commitCount={totalCommits}
                      rank={i}
                      onSelect={setActiveContributor}
                    />
                  ))
                )}
              </div>

              {/* RIGHT — Contributor detail + commit list + CommitDetailsPanel */}
              <div
                className="lg:sticky flex-1 w-full rounded-2xl overflow-hidden flex flex-col"
                style={{
                  top: 80,
                  minHeight: 600,
                  background: 'var(--theme-surface)',
                  border: '1px solid var(--theme-border)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <ContributorDetailPanel
                  contributor={activeContributor}
                  parsedData={parsedData}
                  onViewInGraph={handleViewInGraph}
                />
              </div>

            </div>
          </motion.div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="py-4 text-center">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
          CommitCanvas — Contributor Story · Layer 2 Intelligence
        </span>
      </footer>
    </div>
  )
}
