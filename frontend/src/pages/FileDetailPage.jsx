import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

import { normalizeGitData } from '../utils/normalizeGitData'
import { analyzeSingleFile } from '../analytics/fileAnalytics'
import CommitDetailsPanel from '../components/CommitDetailsPanel'

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const EXT_COLORS = {
  '.js': '#f0db4f', '.jsx': '#61dafb', '.ts': '#3178c6', '.tsx': '#61dafb',
  '.css': '#264de4', '.scss': '#cd6799', '.html': '#e34c26', '.json': '#ffd740',
  '.md': '#00e676', '.py': '#3572A5', '.go': '#00acd7', '.rs': '#dea584',
}
function extColor(filename) {
  if (!filename || !filename.includes('.')) return 'var(--theme-primary)'
  const ext = '.' + filename.split('.').pop().toLowerCase()
  return EXT_COLORS[ext] || 'var(--theme-primary)'
}

function basename(path) {
  if (!path) return '—'
  return path.split('/').pop()
}

/* ─────────────────────────────────────────
   Main FileDetailPage
───────────────────────────────────────── */
export default function FileDetailPage() {
  const { owner, repo } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const filepath = queryParams.get('path')

  const [parsedData, setParsedData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCommit, setSelectedCommit] = useState(null)

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

  const fileData = useMemo(() => {
    if (!parsedData || !filepath) return null
    return analyzeSingleFile(parsedData, filepath)
  }, [parsedData, filepath])

  // Set default selected commit to latest commit when fileData loads
  useEffect(() => {
    if (fileData && !selectedCommit && fileData.latestCommit) {
      setSelectedCommit(fileData.latestCommit)
    }
  }, [fileData, selectedCommit])

  const handlePlayEvolution = useCallback(() => {
    if (!parsedData || !filepath) return
    // Step 8: Play File History integration
    navigate(`/repository/${owner}/${repo}`, {
      state: {
        data: parsedData,
        playFile: filepath,
        selectSha: fileData?.latestCommit?.sha,
      }
    })
  }, [navigate, owner, repo, parsedData, filepath, fileData])

  const color = extColor(filepath)

  return (
    <div className="min-h-screen flex flex-col bg-animated-grid" style={{ background: 'var(--bg-base)' }}>
      {/* Header Bar */}
      <header className="glass-strong sticky top-0 z-40" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-screen-2xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/repository/${owner}/${repo}/files`, { state: { data: parsedData } })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold glass hover:bg-white/10 transition-all text-white/80 hover:text-white"
              title="Back to Files Overview"
            >
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 15l-5-5 5-5" />
              </svg>
              Files
            </button>

            <div className="w-px h-5 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

            <div className="flex items-center gap-1.5 text-sm min-w-0 font-mono">
              <span className="text-white/40 truncate">{owner}</span>
              <span className="text-white/20">/</span>
              <span className="text-white/70 truncate">{repo}</span>
              <span className="text-white/20">/</span>
              <span className="font-bold text-white truncate" title={filepath}>{basename(filepath)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handlePlayEvolution}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg"
              style={{
                background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-bright))',
                color: '#fff',
                boxShadow: '0 0 15px rgba(0, 230, 118, 0.25)',
              }}
            >
              <span className="text-sm">▶</span> Play Evolution
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-5 py-6">
        {loading && (
          <div className="flex items-center gap-3 glass rounded-2xl px-5 py-4">
            <svg className="animate-spin w-4 h-4 text-[var(--theme-primary)]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.25} />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            </svg>
            <span className="text-sm text-white/60">Analyzing file history for {filepath}…</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl px-5 py-4 flex items-center justify-between gap-3 mb-4 bg-red-500/10 border border-red-500/25 text-red-300">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {parsedData && !loading && !fileData && (
          <div className="glass rounded-2xl px-6 py-16 text-center">
            <h2 className="text-lg font-bold text-white mb-2">File Not Observed</h2>
            <p className="text-sm text-white/50 max-w-md mx-auto mb-6">
              No commit history recorded for "<span className="font-mono text-white/70">{filepath}</span>" in the loaded repository data.
            </p>
            <button
              onClick={() => navigate(`/repository/${owner}/${repo}/files`, { state: { data: parsedData } })}
              className="px-4 py-2 rounded-xl text-xs font-semibold glass hover:bg-white/10"
            >
              ← Return to Files Overview
            </button>
          </div>
        )}

        {fileData && (
          <div>
            {/* File Hero Section */}
            <div className="glass rounded-2xl p-5 mb-6 border border-white/6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
                  <h1 className="font-mono font-bold text-xl text-white tracking-tight break-all">
                    {fileData.filename}
                  </h1>
                </div>
                <div className="text-xs font-mono text-white/40">
                  Directory: <span className="text-white/70">{fileData.directory}/</span>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 px-4 rounded-xl bg-black/20 border border-white/5 text-xs">
                <div>
                  <div className="text-white/40">First Appearance</div>
                  <div className="font-mono text-white font-semibold mt-0.5">{fmtDate(fileData.firstTs)}</div>
                </div>
                <div>
                  <div className="text-white/40">Latest Change</div>
                  <div className="font-mono text-white font-semibold mt-0.5">{fmtDate(fileData.latestTs)}</div>
                </div>
                <div>
                  <div className="text-white/40">Recorded Touches</div>
                  <div className="font-mono text-[var(--theme-bright)] font-bold mt-0.5">{fileData.touchCount} commits</div>
                </div>
                <div>
                  <div className="text-white/40">Contributors</div>
                  <div className="flex -space-x-1 mt-1 overflow-hidden">
                    {fileData.contributors.slice(0, 4).map((c, i) => (
                      <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold uppercase text-white shadow bg-[var(--theme-primary)] border border-black"
                           title={c}>
                        {c.slice(0, 2)}
                      </div>
                    ))}
                    {fileData.contributors.length > 4 && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white/70 bg-white/10">
                        +{fileData.contributors.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Two-Column Workspace: Left Timeline, Right CommitDetailsPanel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Timeline (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Evolution Timeline ({fileData.events.length} Recorded Events)
                  </h2>
                </div>

                {/* Key Milestones Section */}
                {fileData.milestones.length > 0 && (
                  <div className="mb-6 space-y-3">
                    <div className="text-xs font-semibold text-[var(--theme-bright)] uppercase tracking-wider px-1">
                      Key File Milestones
                    </div>
                    {fileData.milestones.map((ms) => {
                      const isSelected = selectedCommit?.sha === ms.commit.sha
                      return (
                        <motion.div
                          key={ms.id}
                          onClick={() => setSelectedCommit(ms.commit)}
                          whileHover={{ x: 3 }}
                          className="glass rounded-xl p-4 cursor-pointer transition-all border"
                          style={{
                            borderColor: isSelected ? 'var(--theme-bright)' : 'rgba(255,255,255,0.08)',
                            background: isSelected ? 'var(--theme-surface-elevated)' : 'rgba(255,255,255,0.03)',
                            boxShadow: isSelected ? '0 0 20px rgba(0,230,118,0.15)' : 'none',
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">{ms.icon}</span>
                              <div>
                                <span className="text-xs font-bold px-2 py-0.5 rounded tracking-wide uppercase"
                                      style={{ background: 'var(--theme-primary)20', color: 'var(--theme-bright)', border: '1px solid var(--theme-primary)40' }}>
                                  {ms.label}
                                </span>
                                <div className="text-xs text-white/50 mt-1 font-mono">{ms.date}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/5 text-white/70 border border-white/10">
                                {ms.commit.sha.slice(0, 7)}
                              </span>
                              <div className="text-[11px] text-white/40 mt-1">by {ms.commit.authorName}</div>
                            </div>
                          </div>
                          <p className="text-xs text-white/70 mt-2 leading-relaxed">{ms.description}</p>
                        </motion.div>
                      )
                    })}
                  </div>
                )}

                {/* Full Chronological Log */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 mb-2">
                    All Recorded Touches ({fileData.events.length})
                  </div>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {fileData.events.map((ev, idx) => {
                      const isSelected = selectedCommit?.sha === ev.commit.sha
                      const statusColor = ev.status === 'added' ? '#00e676' : ev.status === 'removed' ? '#ff5252' : '#61dafb'
                      return (
                        <div
                          key={ev.commit.sha + idx}
                          onClick={() => setSelectedCommit(ev.commit)}
                          className="glass rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/5 transition-all border"
                          style={{
                            borderColor: isSelected ? 'var(--theme-bright)' : 'rgba(255,255,255,0.05)',
                            background: isSelected ? 'var(--theme-surface-elevated)' : 'transparent',
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor }} title={`Status: ${ev.status}`} />
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-white/90 truncate">{ev.commit.message?.split('\n')[0]}</div>
                              <div className="text-[11px] text-white/40 mt-0.5 flex items-center gap-2">
                                <span>{fmtDate(ev.timestamp)}</span>
                                <span>•</span>
                                <span>{ev.commit.authorName}</span>
                              </div>
                            </div>
                          </div>
                          <div className="font-mono text-xs text-white/60 px-2 py-1 rounded bg-black/30 border border-white/5 flex-shrink-0">
                            {ev.commit.sha.slice(0, 7)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Existing CommitDetailsPanel (5 cols) */}
              <div className="lg:col-span-5 sticky top-20">
                <div className="glass rounded-2xl overflow-hidden border border-white/10" style={{ minHeight: 480, maxHeight: 680 }}>
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Commit Technical Inspection</span>
                    {selectedCommit && (
                      <button
                        onClick={() => navigate(`/repository/${owner}/${repo}`, { state: { data: parsedData, selectSha: selectedCommit.sha } })}
                        className="text-xs text-[var(--theme-bright)] hover:underline flex items-center gap-1"
                      >
                        View in Graph ↗
                      </button>
                    )}
                  </div>

                  <div className="p-1 overflow-y-auto" style={{ maxHeight: 620 }}>
                    <AnimatePresence mode="wait">
                      {selectedCommit ? (
                        <CommitDetailsPanel
                          key={selectedCommit.sha}
                          commit={selectedCommit}
                          parsed={parsedData}
                        />
                      ) : (
                        <div className="p-8 text-center text-white/40 text-xs">
                          Select any milestone or event on the left to inspect commit details.
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
