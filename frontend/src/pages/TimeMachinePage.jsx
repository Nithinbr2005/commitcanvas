import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

import { normalizeGitData } from '../utils/normalizeGitData'
import {
  buildRepositoryTimeline,
  getSnapshotAtTime,
  getComparisonWithLatest,
} from '../analytics/timeMachineAnalytics'
import { usePlayback } from '../store/usePlayback'

import Visualizer from '../components/Visualizer'
import CommitDetailsPanel from '../components/CommitDetailsPanel'
import TimeMachineSlider from '../components/TimeMachineSlider'
import TimeMachineSnapshot from '../components/TimeMachineSnapshot'
import CompareLatestModal from '../components/CompareLatestModal'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
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

export default function TimeMachinePage() {
  const { owner, repo } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [parsedData, setParsedData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [selectedTs, setSelectedTs] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [selectedCommit, setSelectedCommit] = useState(null)

  const [compareModalOpen, setCompareModalOpen] = useState(false)
  const [copiedNotification, setCopiedNotification] = useState(false)

  // Fetch or retrieve parsed data
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

  // Build repository timeline info
  const timeline = useMemo(() => {
    return buildRepositoryTimeline(parsedData)
  }, [parsedData])

  // Initialize selected timestamp to HEAD (latest commit) when data loads
  useEffect(() => {
    if (timeline.maxTs && selectedTs === null) {
      setSelectedTs(timeline.maxTs)
    }
  }, [timeline.maxTs, selectedTs])

  // Derive snapshot at selected timestamp
  const snapshot = useMemo(() => {
    if (!parsedData || !selectedTs) return null
    return getSnapshotAtTime(parsedData, selectedTs)
  }, [parsedData, selectedTs])

  // Synchronize playback store safely for Visualizer graph rendering
  useEffect(() => {
    if (!timeline.minTs || !selectedTs) return
    const setTime = usePlayback.getState().setTime
    const setPlaying = usePlayback.getState().setPlaying

    // Offset time by minTs. Small 0.001 offset ensures time=0 evaluates currentTs=minTs
    const offsetTime = Math.max(0.001, selectedTs - timeline.minTs)
    setTime(offsetTime)
    setPlaying(isPlaying)

    return () => {
      // Clean up playback state on unmount so normal playback is preserved
      setTime(0)
      setPlaying(false)
    }
  }, [selectedTs, timeline.minTs, isPlaying])

  // Sync selected commit for technical inspection
  useEffect(() => {
    if (snapshot?.latestCommit) {
      setSelectedCommit(snapshot.latestCommit)
    }
  }, [snapshot?.latestCommit])

  const handleSelectCommitSha = useCallback((sha) => {
    if (!parsedData?.commits) return
    const target = parsedData.commits.find(c => c.sha === sha)
    if (target) {
      setSelectedTs(target.timestamp)
      setSelectedCommit(target)
    }
  }, [parsedData])

  // Copy plain text snapshot summary to clipboard
  const handleCopySnapshot = useCallback(() => {
    if (!snapshot) return
    const text = `CommitCanvas Repository Snapshot
Repository: ${owner}/${repo}
Date: ${fmtDate(snapshot.timestamp)}

Commits observed: ${snapshot.commitsCount}
Contributors: ${snapshot.contributorsCount}
Observed files: ${snapshot.observedFilesCount}
Directories: ${snapshot.directoriesCount}
Merges: ${snapshot.mergesCount}
History age: ${snapshot.historyAgeDays} days

Most active contributor: ${snapshot.mostActiveContributor}
Most active directory: ${snapshot.mostActiveDirectory}`

    navigator.clipboard.writeText(text)
    setCopiedNotification(true)
    setTimeout(() => setCopiedNotification(false), 2500)
  }, [snapshot, owner, repo])

  const comparison = useMemo(() => {
    if (!parsedData || !selectedTs) return null
    return getComparisonWithLatest(parsedData, selectedTs)
  }, [parsedData, selectedTs])

  return (
    <div className="min-h-screen flex flex-col bg-animated-grid" style={{ background: 'var(--bg-base)' }}>
      <PageHeader owner={owner} repo={repo} parsedData={parsedData} activeTab="time-machine" />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-5 py-6">
        {loading && (
          <div className="flex items-center gap-3 glass rounded-2xl px-5 py-4">
            <svg className="animate-spin w-4 h-4 text-[var(--theme-primary)]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.25} />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            </svg>
            <span className="text-sm text-white/60">Initializing Time Machine analysis…</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl px-5 py-4 flex items-center justify-between gap-3 mb-4 bg-red-500/10 border border-red-500/25 text-red-300">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {parsedData && !loading && (
          <div className="space-y-6">
            {/* Top Hero & Action Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass rounded-2xl p-6 border border-white/6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">⏱</span>
                  <h1 className="font-display font-bold text-2xl text-white tracking-tight">Repository Time Machine</h1>
                </div>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Reconstruct and explore repository state from historical commits up to{' '}
                  <strong className="text-[var(--theme-bright)] font-mono">{fmtDate(selectedTs)}</strong>.
                </p>
              </div>

              {/* Toolbar Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCompareModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold glass hover:bg-white/10 text-white flex items-center gap-1.5 border border-white/10"
                >
                  <span>📊</span> Compare with Latest
                </button>

                <button
                  onClick={handleCopySnapshot}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold glass hover:bg-white/10 text-white flex items-center gap-1.5 border border-white/10"
                >
                  <span>📋</span> {copiedNotification ? 'Copied to Clipboard!' : 'Copy Snapshot'}
                </button>
              </div>
            </div>

            {/* Main Interactive Timeline Slider */}
            <TimeMachineSlider
              timeline={timeline}
              selectedTs={selectedTs}
              onChangeTimestamp={setSelectedTs}
              isPlaying={isPlaying}
              onTogglePlay={setIsPlaying}
              playbackSpeed={playbackSpeed}
              onChangeSpeed={setPlaybackSpeed}
            />

            {/* Reconstructed Historical Snapshot HUD */}
            <TimeMachineSnapshot
              parsedData={parsedData}
              snapshot={snapshot}
              onSelectCommit={handleSelectCommitSha}
            />

            {/* Historical Git Graph + Technical Inspection Workspace */}
            <div className="glass rounded-2xl overflow-hidden border border-white/6" style={{ minHeight: 540 }}>
              <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--theme-bright)] animate-pulse" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Historical Git Graph ({fmtDate(selectedTs)})
                  </span>
                </div>
                <span className="text-xs text-white/40 font-mono">
                  Bright = Current Time Commit | Dim = Future Commits
                </span>
              </div>

              <div className="flex flex-col lg:flex-row h-full" style={{ minHeight: 500 }}>
                {/* Graph View (Flex 1) */}
                <div className="flex-1 min-w-0 flex flex-col relative" style={{ minHeight: 480 }}>
                  <Visualizer
                    parsed={parsedData}
                    onCommitSelect={setSelectedCommit}
                    selectedSha={selectedCommit?.sha}
                  />
                </div>

                {/* Untouched CommitDetailsPanel (Fixed Width / 35%) */}
                <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-white/6 flex-shrink-0 bg-black/20 overflow-y-auto" style={{ maxHeight: 620 }}>
                  <div className="p-3 border-b border-white/6 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Historical Commit Inspection</span>
                  </div>
                  <AnimatePresence mode="wait">
                    {selectedCommit ? (
                      <CommitDetailsPanel
                        key={selectedCommit.sha}
                        commit={selectedCommit}
                        parsed={parsedData}
                      />
                    ) : (
                      <div className="p-8 text-center text-white/40 text-xs">
                        Select a commit on the graph to inspect technical details.
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Compare Modal */}
      <AnimatePresence>
        {compareModalOpen && (
          <CompareLatestModal
            comparison={comparison}
            onClose={() => setCompareModalOpen(false)}
          />
        )}
      </AnimatePresence>

      <footer className="py-4 text-center border-t border-white/5 text-xs text-white/20">
        CommitCanvas — Repository Time Machine
      </footer>
    </div>
  )
}
