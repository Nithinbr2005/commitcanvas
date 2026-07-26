import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

import { normalizeGitData } from '../utils/normalizeGitData'
import { analyzeFileEvolution } from '../analytics/fileAnalytics'
import CodebaseMap from '../components/CodebaseMap'
import DirectoryHeatmap from '../components/DirectoryHeatmap'
import GrowthCharts from '../components/GrowthCharts'
import EngineeringInsights from '../components/EngineeringInsights'

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
   Shared Page Header
───────────────────────────────────────── */
function PageHeader({ owner, repo, parsedData, activeTab }) {
  const navigate = useNavigate()
  const tabs = [
    { id: 'graph', label: 'Graph', path: `/repository/${owner}/${repo}` },
    { id: 'story', label: 'Story', path: `/repository/${owner}/${repo}/story` },
    { id: 'contributors', label: 'Contributors', path: `/repository/${owner}/${repo}/contributors` },
    { id: 'files', label: 'Files', path: `/repository/${owner}/${repo}/files` },
    { id: 'time-machine', label: 'Time Machine', path: `/repository/${owner}/${repo}/time-machine` },
  ]
  return (
    <header className="glass-strong sticky top-0 z-40" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-screen-2xl mx-auto px-5 h-14 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5 flex-shrink-0 group" title="Back to home">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
               style={{ background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-bright))' }}>
            <svg viewBox="0 0 20 20" className="w-4 h-4 text-white" fill="none">
              <circle cx="4" cy="10" r="2.5" fill="currentColor" opacity="0.9" />
              <circle cx="10" cy="6" r="2.5" fill="currentColor" opacity="0.9" />
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
                  color: isActive ? 'var(--theme-bright)' : 'rgba(255,255,255,0.45)',
                  background: isActive ? 'var(--theme-surface-elevated)' : 'transparent',
                  border: isActive ? '1px solid var(--theme-border-hover)' : '1px solid transparent',
                  cursor: isActive ? 'default' : 'pointer',
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
   File Card Component
───────────────────────────────────────── */
function FileCard({ file, onViewEvolution }) {
  const color = extColor(file.filename)
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="glass rounded-xl p-4 flex flex-col justify-between transition-all group"
      style={{ border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="font-mono text-sm font-semibold truncate text-white group-hover:text-[var(--theme-bright)] transition-colors" title={file.filename}>
            {basename(file.filename)}
          </div>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded flex-shrink-0"
                style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
            {file.touchCount}× touches
          </span>
        </div>
        <div className="text-xs font-mono truncate mb-3" style={{ color: 'rgba(255,255,255,0.35)' }} title={file.directory}>
          {file.directory}/
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs mb-3 py-2 px-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.3)' }}>First observed</div>
            <div className="font-mono text-white/70 mt-0.5">{fmtDate(file.firstTs)}</div>
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.3)' }}>Latest change</div>
            <div className="font-mono text-white/70 mt-0.5">{fmtDate(file.latestTs)}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Contributors:</span>
          <div className="flex -space-x-1.5 overflow-hidden">
            {file.contributors.slice(0, 5).map((c, i) => (
              <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold uppercase text-white shadow"
                   style={{ background: 'var(--theme-primary)', border: '1px solid var(--theme-surface)' }}
                   title={c}>
                {c.slice(0, 2)}
              </div>
            ))}
            {file.contributors.length > 5 && (
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white/70"
                   style={{ background: 'rgba(255,255,255,0.1)' }}>
                +{file.contributors.length - 5}
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => onViewEvolution(file.filename)}
        className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--theme-bright)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--theme-surface-elevated)'
          e.currentTarget.style.borderColor = 'var(--theme-border-hover)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
        }}
      >
        View Evolution
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </motion.div>
  )
}

/* ─────────────────────────────────────────
   Main FilesPage
───────────────────────────────────────── */
export default function FilesPage() {
  const { owner, repo } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [parsedData, setParsedData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeSection, setActiveSection] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')

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

  const evolution = useMemo(() => analyzeFileEvolution(parsedData), [parsedData])

  const filteredFiles = useMemo(() => {
    if (!evolution?.files) return []
    if (!searchQuery.trim()) return evolution.files.slice(0, 30)
    const q = searchQuery.toLowerCase()
    return evolution.files.filter(f => f.filename.toLowerCase().includes(q)).slice(0, 30)
  }, [evolution, searchQuery])

  const handleViewEvolution = useCallback((filename) => {
    navigate(`/repository/${owner}/${repo}/files/detail?path=${encodeURIComponent(filename)}`, {
      state: { data: parsedData }
    })
  }, [navigate, owner, repo, parsedData])

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'map', label: 'Codebase Map' },
    { id: 'activity', label: 'Directory Activity' },
    { id: 'growth', label: 'Growth' },
    { id: 'insights', label: 'Insights' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-animated-grid" style={{ background: 'var(--bg-base)' }}>
      <PageHeader owner={owner} repo={repo} parsedData={parsedData} activeTab="files" />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-5 py-6">
        {loading && (
          <div className="flex items-center gap-3 glass rounded-2xl px-5 py-4">
            <svg className="animate-spin w-4 h-4 text-[var(--theme-primary)]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.25} />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            </svg>
            <span className="text-sm text-white/60">Analyzing file history…</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl px-5 py-4 flex items-center justify-between gap-3 mb-4 bg-red-500/10 border border-red-500/25 text-red-300">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {parsedData && !loading && (
          <div>
            {/* Page Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display font-bold text-2xl text-white tracking-tight">File Evolution</h1>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Explore how the repository's codebase has evolved across {evolution?.fileCount || 0} observed files.
                </p>
              </div>

              {/* Section Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl glass" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                {sections.map(sec => {
                  const isActive = sec.id === activeSection
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setActiveSection(sec.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: isActive ? 'var(--theme-surface-elevated)' : 'transparent',
                        color: isActive ? 'var(--theme-bright)' : 'rgba(255,255,255,0.45)',
                        border: isActive ? '1px solid var(--theme-border-hover)' : '1px solid transparent',
                      }}
                    >
                      {sec.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {!evolution ? (
              <div className="glass rounded-2xl px-6 py-16 text-center text-white/40">
                No file-change metadata observed in the loaded commit history.
              </div>
            ) : (
              <div>
                {/* ── SECTION 1: OVERVIEW ── */}
                {activeSection === 'overview' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                    {/* Top Section Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Most Changed File */}
                      {evolution.mostChangedFiles[0] && (
                        <div className="glass rounded-2xl p-4 border border-white/6">
                          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Most Changed File</div>
                          <div className="font-mono text-base font-bold text-white truncate" title={evolution.mostChangedFiles[0].filename}>
                            {basename(evolution.mostChangedFiles[0].filename)}
                          </div>
                          <div className="text-xs text-white/50 mt-1 font-mono">{evolution.mostChangedFiles[0].directory}/</div>
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-[var(--theme-bright)] font-bold">{evolution.mostChangedFiles[0].touchCount} touches</span>
                            <button onClick={() => handleViewEvolution(evolution.mostChangedFiles[0].filename)} className="text-white/60 hover:text-white underline">Inspect →</button>
                          </div>
                        </div>
                      )}

                      {/* Most Active Directory */}
                      {evolution.mostActiveDirectories[0] && (
                        <div className="glass rounded-2xl p-4 border border-white/6">
                          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Most Active Directory</div>
                          <div className="font-mono text-base font-bold text-white truncate" title={evolution.mostActiveDirectories[0].path}>
                            {evolution.mostActiveDirectories[0].path || 'root'}/
                          </div>
                          <div className="text-xs text-white/50 mt-1 font-mono">{evolution.mostActiveDirectories[0].fileCount} observed files</div>
                          <div className="mt-3 text-xs text-[var(--theme-bright)] font-bold">{evolution.mostActiveDirectories[0].touchCount} total touches</div>
                        </div>
                      )}

                      {/* Largest Change Commit */}
                      {evolution.largestChangeCommit && (
                        <div className="glass rounded-2xl p-4 border border-white/6">
                          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Largest Recorded Change</div>
                          <div className="font-mono text-base font-bold text-[var(--theme-bright)] truncate">
                            Commit {evolution.largestChangeCommit.sha.slice(0, 7)}
                          </div>
                          <div className="text-xs text-white/50 mt-1 truncate">{evolution.largestChangeCommit.message?.split('\n')[0]}</div>
                          <div className="mt-3 text-xs text-white/70 font-mono">{evolution.largestChangeCommit.files.length} files affected</div>
                        </div>
                      )}

                      {/* Recently Modified */}
                      {evolution.recentlyModifiedFiles[0] && (
                        <div className="glass rounded-2xl p-4 border border-white/6">
                          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Recently Modified</div>
                          <div className="font-mono text-base font-bold text-white truncate" title={evolution.recentlyModifiedFiles[0].filename}>
                            {basename(evolution.recentlyModifiedFiles[0].filename)}
                          </div>
                          <div className="text-xs text-white/50 mt-1">{fmtDate(evolution.recentlyModifiedFiles[0].latestTs)}</div>
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-white/60">by {evolution.recentlyModifiedFiles[0].latestCommit?.authorName}</span>
                            <button onClick={() => handleViewEvolution(evolution.recentlyModifiedFiles[0].filename)} className="text-white/60 hover:text-white underline">Inspect →</button>
                          </div>
                        </div>
                      )}

                      {/* Newest Observed File */}
                      {evolution.newestFiles[0] && (
                        <div className="glass rounded-2xl p-4 border border-white/6">
                          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Newest Observed File</div>
                          <div className="font-mono text-base font-bold text-white truncate" title={evolution.newestFiles[0].filename}>
                            {basename(evolution.newestFiles[0].filename)}
                          </div>
                          <div className="text-xs text-white/50 mt-1">First seen {fmtDate(evolution.newestFiles[0].firstTs)}</div>
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-[var(--theme-bright)]">{evolution.newestFiles[0].touchCount} touches</span>
                            <button onClick={() => handleViewEvolution(evolution.newestFiles[0].filename)} className="text-white/60 hover:text-white underline">Inspect →</button>
                          </div>
                        </div>
                      )}

                      {/* Oldest Observed File */}
                      {evolution.oldestFiles[0] && (
                        <div className="glass rounded-2xl p-4 border border-white/6">
                          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Oldest Observed File</div>
                          <div className="font-mono text-base font-bold text-white truncate" title={evolution.oldestFiles[0].filename}>
                            {basename(evolution.oldestFiles[0].filename)}
                          </div>
                          <div className="text-xs text-white/50 mt-1">Observed {fmtDate(evolution.oldestFiles[0].firstTs)}</div>
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-[var(--theme-bright)]">{evolution.oldestFiles[0].touchCount} touches</span>
                            <button onClick={() => handleViewEvolution(evolution.oldestFiles[0].filename)} className="text-white/60 hover:text-white underline">Inspect →</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* File Cards Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">Observed Codebase Files</h2>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search files…"
                          className="input-glass px-3 py-1.5 text-xs rounded-lg w-64"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredFiles.map(file => (
                          <FileCard key={file.filename} file={file} onViewEvolution={handleViewEvolution} />
                        ))}
                      </div>
                      {filteredFiles.length === 0 && (
                        <div className="text-center py-12 text-white/30 text-sm">No files matching "{searchQuery}"</div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── SECTION 2: CODEBASE MAP ── */}
                {activeSection === 'map' && <CodebaseMap parsedData={parsedData} onViewEvolution={handleViewEvolution} />}

                {/* ── SECTION 3: DIRECTORY ACTIVITY ── */}
                {activeSection === 'activity' && <DirectoryHeatmap parsedData={parsedData} />}

                {/* ── SECTION 4: GROWTH ── */}
                {activeSection === 'growth' && <GrowthCharts parsedData={parsedData} />}

                {/* ── SECTION 5: INSIGHTS ── */}
                {activeSection === 'insights' && <EngineeringInsights parsedData={parsedData} onViewEvolution={handleViewEvolution} />}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-4 text-center border-t border-white/5 text-xs text-white/20">
        CommitCanvas — File Evolution & Codebase Intelligence
      </footer>
    </div>
  )
}
