import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

import CommitDetailsPanel from '../components/CommitDetailsPanel'
import { normalizeGitData } from '../utils/normalizeGitData'
import { analyzeFiles } from '../analytics/repositoryAnalytics'

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtDateShort(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/** Return a colour for a file extension */
const EXT_COLORS = {
  '.js':   '#f0db4f', '.jsx':  '#61dafb', '.ts':   '#3178c6', '.tsx':  '#61dafb',
  '.css':  '#264de4', '.scss': '#cd6799', '.html': '#e34c26', '.json': '#ffd740',
  '.md':   '#00e676', '.py':   '#3572A5', '.go':   '#00acd7', '.rs':   '#dea584',
  '.sh':   '#89e051', '.yml':  '#cb171e', '.yaml': '#cb171e', '.env':  '#ffd740',
  '.svg':  '#ff9800', '.png':  '#f472b6', '.jpg':  '#f472b6',
}
function extColor(ext) {
  return EXT_COLORS[ext] || 'var(--theme-primary)'
}

/** Extract the short basename of a path */
function basename(path) {
  if (!path) return '—'
  return path.split('/').pop()
}

/** Status color */
function statusColor(status) {
  if (status === 'added')   return '#00e676'
  if (status === 'removed') return '#ff5252'
  return '#ffd740'
}
function statusLabel(status) {
  if (status === 'added')   return 'A'
  if (status === 'removed') return 'D'
  return 'M'
}

/* ─────────────────────────────────────────
   Mini heat strip for a file
   Shows relative activity across its lifetime
───────────────────────────────────────── */
function FileHeatStrip({ events, totalEvents }) {
  if (!events.length) return null

  // Bucket by month
  const monthMap = new Map()
  const sortedEvents = [...events].sort((a, b) => a.commit.timestamp - b.commit.timestamp)
  const firstTs = sortedEvents[0].commit.timestamp
  const lastTs  = sortedEvents[sortedEvents.length - 1].commit.timestamp
  const spanMonths = Math.max(1, Math.ceil((lastTs - firstTs) / (30 * 86400))) + 1

  for (const ev of sortedEvents) {
    const mIdx = Math.floor((ev.commit.timestamp - firstTs) / (30 * 86400))
    monthMap.set(mIdx, (monthMap.get(mIdx) || 0) + 1)
  }

  const maxVal = Math.max(...monthMap.values(), 1)
  const strips = []
  for (let i = 0; i < Math.min(spanMonths, 24); i++) {
    strips.push(monthMap.get(i) || 0)
  }

  return (
    <div className="flex items-end gap-px" style={{ height: 18 }}>
      {strips.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: v === 0 ? 2 : Math.max(3, Math.round((v / maxVal) * 18)),
            background: v === 0 ? 'rgba(255,255,255,0.06)' : 'var(--theme-primary)',
            opacity: v === 0 ? 1 : 0.35 + (v / maxVal) * 0.65,
            borderRadius: 2,
          }}
          title={v ? `${v} touch(es)` : 'No activity'}
        />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────
   File row in the left list
───────────────────────────────────────── */
function FileRow({ fileData, isActive, rank, totalEvents, onSelect }) {
  const ext    = fileData.filename.includes('.') ? '.' + fileData.filename.split('.').pop().toLowerCase() : 'other'
  const color  = extColor(ext)
  const pct    = totalEvents > 0 ? Math.round((fileData.touchCount / totalEvents) * 100) : 0

  // Status breakdown
  const added    = fileData.events.filter(e => e.status === 'added').length
  const removed  = fileData.events.filter(e => e.status === 'removed').length
  const modified = fileData.events.filter(e => e.status === 'modified').length

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: Math.min(rank * 0.04, 0.5) }}
      onClick={() => onSelect(fileData)}
      whileHover={{ x: 3 }}
      className="cursor-pointer rounded-xl p-3.5 transition-all"
      style={{
        background: isActive
          ? `linear-gradient(135deg, ${color}12, rgba(255,255,255,0.03))`
          : 'rgba(255,255,255,0.025)',
        border: `1px solid ${isActive ? color + '40' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isActive ? `0 4px 20px ${color}20` : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Top row: ext badge + filename + touch count */}
      <div className="flex items-start gap-2.5">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{
            background: `${color}18`,
            border: `1px solid ${color}30`,
            color,
            fontSize: 9,
            letterSpacing: '0.05em',
          }}
        >
          {ext === 'other' ? '?' : ext.replace('.', '').toUpperCase().slice(0, 3)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-sm font-medium font-mono truncate"
              style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.75)' }}
              title={fileData.filename}
            >
              {basename(fileData.filename)}
            </span>
            <span
              className="text-xs font-bold font-mono flex-shrink-0 px-1.5 py-0.5 rounded"
              style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
            >
              {fileData.touchCount}×
            </span>
          </div>

          {/* Path (directory part) */}
          {fileData.filename.includes('/') && (
            <div
              className="text-xs font-mono mt-0.5 truncate"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              title={fileData.filename}
            >
              {fileData.filename.substring(0, fileData.filename.lastIndexOf('/'))}
            </div>
          )}

          {/* Share bar */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct, 2)}%` }}
                transition={{ duration: 0.7, delay: rank * 0.04 }}
                className="h-full rounded-full"
                style={{ background: color }}
              />
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)', width: 28, textAlign: 'right' }}>
              {pct}%
            </span>
          </div>

          {/* Heat strip */}
          <div className="mt-2">
            <FileHeatStrip events={fileData.events} totalEvents={totalEvents} />
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-1.5 mt-2">
            {added > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#00e67615', color: '#00e676', fontSize: 10 }}>
                +{added} added
              </span>
            )}
            {modified > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#ffd74015', color: '#ffd740', fontSize: 10 }}>
                ~{modified} mod
              </span>
            )}
            {removed > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#ff525215', color: '#ff5252', fontSize: 10 }}>
                -{removed} del
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────
   File event timeline in the right panel
───────────────────────────────────────── */
function FileEventList({ fileData, parsedData, onCommitSelect, selectedCommit }) {
  if (!fileData) return null

  const ext   = fileData.filename.includes('.') ? '.' + fileData.filename.split('.').pop().toLowerCase() : 'other'
  const color = extColor(ext)

  // Events sorted newest first
  const events = [...fileData.events].sort((a, b) => b.commit.timestamp - a.commit.timestamp)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* File path header */}
      <div
        className="px-4 py-3 sticky top-0 z-10"
        style={{ background: 'var(--theme-surface)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="text-xs font-mono break-all leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          {fileData.filename}
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs" style={{ color }}>
            {fileData.touchCount} touch{fileData.touchCount !== 1 ? 'es' : ''} across {events.length} commit{events.length !== 1 ? 's' : ''}
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {fmtDate(events[events.length - 1]?.commit.timestamp)} → {fmtDate(events[0]?.commit.timestamp)}
          </span>
        </div>
      </div>

      {/* Event list */}
      <div className="p-2 space-y-1">
        {events.map((ev, i) => {
          const isSelected = selectedCommit?.sha === ev.commit.sha
          const sColor = statusColor(ev.status)
          const sLabel = statusLabel(ev.status)

          return (
            <motion.button
              key={`${ev.commit.sha}-${i}`}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.02 }}
              onClick={() => onCommitSelect(ev.commit)}
              className="w-full text-left rounded-xl px-3 py-2.5 transition-all"
              style={{
                background: isSelected ? `${color}12` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isSelected ? color + '35' : 'transparent'}`,
              }}
              onMouseEnter={e => {
                if (isSelected) return
                e.currentTarget.style.background = `${color}08`
                e.currentTarget.style.borderColor = `${color}20`
              }}
              onMouseLeave={e => {
                if (isSelected) return
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <div className="flex items-start gap-2.5">
                {/* Status badge */}
                <div
                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ background: `${sColor}18`, color: sColor, border: `1px solid ${sColor}30`, fontSize: 10 }}
                >
                  {sLabel}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-medium" style={{ color }}>
                      {ev.commit.sha.slice(0, 7)}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {fmtDate(ev.commit.timestamp)}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {ev.commit.message?.split('\n')[0] || '—'}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {ev.commit.authorName}
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Right panel (file event list + CommitDetails)
───────────────────────────────────────── */
function FileDetailPanel({ activeFile, parsedData, onViewInGraph }) {
  const [selectedCommit, setSelectedCommit] = useState(null)

  // Reset selected commit when active file changes
  useEffect(() => { setSelectedCommit(null) }, [activeFile?.filename])

  if (!activeFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-6 gap-4 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.4}
               style={{ color: 'rgba(255,255,255,0.2)' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Select a file<br />to trace its evolution
        </p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
          Only files with recorded change data<br />appear in this view
        </p>
      </div>
    )
  }

  const ext   = activeFile.filename.includes('.') ? '.' + activeFile.filename.split('.').pop().toLowerCase() : 'other'
  const color = extColor(ext)

  return (
    <div className="flex flex-col h-full">
      {selectedCommit ? (
        /* ── Commit details view ── */
        <>
          <div
            className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <button
              onClick={() => setSelectedCommit(null)}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back to file history
            </button>
            <button
              onClick={() => onViewInGraph(selectedCommit.sha)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105"
              style={{
                background: `${color}15`,
                border: `1px solid ${color}30`,
                color,
              }}
            >
              View in Graph
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M7 17 17 7M7 7h10v10" />
              </svg>
            </button>
          </div>

          {/* CommitDetailsPanel — existing component, zero modifications */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <CommitDetailsPanel
                key={selectedCommit.sha}
                commit={selectedCommit}
                parsed={parsedData}
              />
            </AnimatePresence>
          </div>
        </>
      ) : (
        /* ── File event timeline ── */
        <FileEventList
          fileData={activeFile}
          parsedData={parsedData}
          onCommitSelect={setSelectedCommit}
          selectedCommit={selectedCommit}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────
   Extension breakdown bar
───────────────────────────────────────── */
function ExtensionBar({ breakdown, total }) {
  if (!breakdown?.length) return null
  return (
    <div className="glass rounded-2xl p-4 mb-5">
      <div className="text-xs font-medium uppercase tracking-wider mb-3"
           style={{ color: 'rgba(255,255,255,0.35)' }}>
        File Types (by change events)
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
        {breakdown.map(({ ext, count }) => (
          <motion.div
            key={ext}
            initial={{ flex: 0 }}
            animate={{ flex: count }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ background: extColor(ext), minWidth: 2 }}
            title={`${ext}: ${count} events`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {breakdown.map(({ ext, count }) => (
          <div key={ext} className="flex items-center gap-1.5 text-xs">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: extColor(ext) }} />
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>{ext}</span>
            <span className="font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Shared 4-tab page header
───────────────────────────────────────── */
function PageHeader({ owner, repo, parsedData, activeTab }) {
  const navigate = useNavigate()
  const tabs = [
    { id: 'graph',        label: 'Graph',        path: `/repository/${owner}/${repo}`              },
    { id: 'story',        label: 'Story',        path: `/repository/${owner}/${repo}/story`        },
    { id: 'contributors', label: 'Contributors', path: `/repository/${owner}/${repo}/contributors` },
    { id: 'files',        label: 'Files',        path: `/repository/${owner}/${repo}/files`        },
  ]
  return (
    <header className="glass-strong sticky top-0 z-40"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-screen-2xl mx-auto px-5 h-14 flex items-center gap-4">
        <button onClick={() => navigate('/')}
                className="flex items-center gap-2.5 flex-shrink-0 group" title="Back to home">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
               style={{ background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-bright))' }}>
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

        <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
          <span className="truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{owner}</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <span className="font-medium truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{repo}</span>
        </div>

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
      </div>
    </header>
  )
}

/* ─────────────────────────────────────────
   Main FileEvolutionPage
───────────────────────────────────────── */
export default function FileEvolutionPage() {
  const { owner, repo } = useParams()
  const location        = useLocation()
  const navigate        = useNavigate()

  const [parsedData, setParsedData] = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [activeFile, setActiveFile] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Load data ──
  useEffect(() => {
    if (location.state?.data) { setParsedData(location.state.data); return }
    const repoUrl = `https://github.com/${owner}/${repo}`
    setLoading(true); setError(null)
    axios.post('https://commit-canvas-api.onrender.com/api/repo/fetch', { repoUrl })
      .then(r => {
        const data = r.data.data
        if (!data || !data.commits || !Array.isArray(data.commits)) {
          setError('Failed to fetch repository data.'); return
        }
        setParsedData(normalizeGitData(data))
      })
      .catch(err => setError(
        typeof err?.response?.data?.error === 'string'
          ? err.response.data.error
          : err?.message || 'Failed to load repository'
      ))
      .finally(() => setLoading(false))
  }, [owner, repo, location.state])

  // ── File analytics ──
  const fileAnalytics = useMemo(() => analyzeFiles(parsedData), [parsedData])

  // ── Filter by search ──
  const filteredFiles = useMemo(() => {
    if (!fileAnalytics?.topFiles) return []
    if (!searchQuery.trim()) return fileAnalytics.topFiles
    const q = searchQuery.toLowerCase()
    return fileAnalytics.files.filter(f => f.filename.toLowerCase().includes(q)).slice(0, 30)
  }, [fileAnalytics, searchQuery])

  // Auto-select first file
  useEffect(() => {
    if (filteredFiles.length > 0 && !activeFile) {
      setActiveFile(filteredFiles[0])
    }
  }, [filteredFiles, activeFile])

  const handleViewInGraph = useCallback((sha) => {
    navigate(`/repository/${owner}/${repo}`, { state: { data: parsedData, selectSha: sha } })
  }, [navigate, owner, repo, parsedData])

  const handleSelectFile = useCallback((fileData) => {
    setActiveFile(fileData)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-animated-grid" style={{ background: 'var(--bg-base)' }}>
      <PageHeader owner={owner} repo={repo} parsedData={parsedData} activeTab="files" />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-5 py-6">

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 glass rounded-2xl px-5 py-4">
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
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl px-5 py-4 flex items-center justify-between gap-3 mb-4"
              style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.25)' }}>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>

            {/* ── Hero ── */}
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }} className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: 'linear-gradient(135deg, #f472b615, #f472b608)', border: '1px solid rgba(244,114,182,0.2)' }}>
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5}
                       style={{ color: '#f472b6' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-display font-bold text-2xl text-white tracking-tight">File Evolution</h1>
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {owner}/{repo}
                    {fileAnalytics
                      ? ` — ${fileAnalytics.fileCount} file${fileAnalytics.fileCount !== 1 ? 's' : ''} · ${fileAnalytics.totalFileEvents} recorded change events`
                      : ' — based on loaded history'}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── No file data fallback ── */}
            {!fileAnalytics ? (
              <div className="glass rounded-2xl px-6 py-16 text-center">
                <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                     style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5}
                       style={{ color: 'rgba(255,255,255,0.25)' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  No file-change data available
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  The loaded commits do not include file-change records.<br />
                  File Evolution requires per-commit file data from the API.
                </p>
              </div>
            ) : (
              <>
                {/* Extension breakdown */}
                <ExtensionBar breakdown={fileAnalytics.extensionBreakdown} total={fileAnalytics.totalFileEvents} />

                {/* Two-column layout */}
                <div className="flex flex-col lg:flex-row gap-5" style={{ alignItems: 'flex-start' }}>

                  {/* LEFT — file list */}
                  <div className="w-full lg:flex-shrink-0" style={{ flexBasis: '40%', maxWidth: 440 }}>
                    {/* Search bar */}
                    <div className="mb-3 relative">
                      <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                           fill="none" stroke="currentColor" strokeWidth={2}
                           style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                      </svg>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setActiveFile(null) }}
                        placeholder="Filter files…"
                        className="input-glass w-full pl-10 text-sm"
                        style={{ height: 38 }}
                      />
                    </div>

                    {/* Count label */}
                    <div className="text-xs mb-2 px-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {searchQuery
                        ? `${filteredFiles.length} result${filteredFiles.length !== 1 ? 's' : ''}`
                        : `Top ${filteredFiles.length} most-changed files`}
                    </div>

                    <div className="space-y-2">
                      {filteredFiles.length === 0 ? (
                        <div className="rounded-xl px-4 py-8 text-center"
                             style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No files match "{searchQuery}"</p>
                        </div>
                      ) : (
                        filteredFiles.map((f, i) => (
                          <FileRow
                            key={f.filename}
                            fileData={f}
                            isActive={activeFile?.filename === f.filename}
                            rank={i}
                            totalEvents={fileAnalytics.totalFileEvents}
                            onSelect={handleSelectFile}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* RIGHT — file timeline + CommitDetailsPanel */}
                  <div
                    className="lg:sticky flex-1 w-full rounded-2xl overflow-hidden flex flex-col"
                    style={{
                      top: 80,
                      minHeight: 560,
                      background: 'var(--theme-surface)',
                      border: '1px solid var(--theme-border)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                    }}
                  >
                    <FileDetailPanel
                      activeFile={activeFile}
                      parsedData={parsedData}
                      onViewInGraph={handleViewInGraph}
                    />
                  </div>

                </div>
              </>
            )}

          </motion.div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="py-4 text-center">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
          CommitCanvas — File Evolution · Layer 2 Intelligence
        </span>
      </footer>
    </div>
  )
}
