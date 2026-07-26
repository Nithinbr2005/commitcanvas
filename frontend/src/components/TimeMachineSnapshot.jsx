import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  getStorySoFarAtTime,
  getContributorStateAtTime,
  getFileStateAtTime,
} from '../analytics/timeMachineAnalytics'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function basename(path) {
  if (!path) return '—'
  return path.split('/').pop()
}

export default function TimeMachineSnapshot({ parsedData, snapshot, onSelectCommit }) {
  const [activeTab, setActiveTab] = useState('story') // 'story' | 'contributors' | 'codebase'

  const timestamp = snapshot?.timestamp || 0

  const storySoFar = useMemo(() => {
    if (!parsedData || !timestamp) return []
    return getStorySoFarAtTime(parsedData, timestamp)
  }, [parsedData, timestamp])

  const contributorsSoFar = useMemo(() => {
    if (!parsedData || !timestamp) return []
    return getContributorStateAtTime(parsedData, timestamp)
  }, [parsedData, timestamp])

  const codebaseSoFar = useMemo(() => {
    if (!parsedData || !timestamp) return { observedFiles: [], mostTouchedFile: null, recentlyChangedFiles: [] }
    return getFileStateAtTime(parsedData, timestamp)
  }, [parsedData, timestamp])

  if (!snapshot) return null

  return (
    <div className="space-y-6">
      {/* ── Metric HUD Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass rounded-2xl p-4 border border-white/6 text-center">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Commits Observed</div>
          <div className="font-mono text-xl font-bold text-[var(--theme-bright)]">{snapshot.commitsCount}</div>
        </div>

        <div className="glass rounded-2xl p-4 border border-white/6 text-center">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Contributors</div>
          <div className="font-mono text-xl font-bold text-white">{snapshot.contributorsCount}</div>
        </div>

        <div className="glass rounded-2xl p-4 border border-white/6 text-center">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Files Observed</div>
          <div className="font-mono text-xl font-bold text-white">{snapshot.observedFilesCount}</div>
        </div>

        <div className="glass rounded-2xl p-4 border border-white/6 text-center">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Directories</div>
          <div className="font-mono text-xl font-bold text-white">{snapshot.directoriesCount}</div>
        </div>

        <div className="glass rounded-2xl p-4 border border-white/6 text-center">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Merges Observed</div>
          <div className="font-mono text-xl font-bold text-white">{snapshot.mergesCount}</div>
        </div>

        <div className="glass rounded-2xl p-4 border border-white/6 text-center">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">History Age</div>
          <div className="font-mono text-xl font-bold text-white/80">{snapshot.historyAgeDays} days</div>
        </div>
      </div>

      {/* ── Sub-Section Tabs ── */}
      <div className="glass rounded-2xl border border-white/6 overflow-hidden">
        <div className="p-4 border-b border-white/6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/20">
          <div>
            <h3 className="font-bold text-white text-base">Historical Repository Context</h3>
            <p className="text-xs text-white/40 mt-0.5">
              Reconstructed story, contributors, and codebase history observed up to {fmtDate(timestamp)}.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl glass border border-white/10">
            {[
              { id: 'story', label: 'Story So Far' },
              { id: 'contributors', label: 'Contributors' },
              { id: 'codebase', label: 'Codebase Observed' },
            ].map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: isActive ? 'var(--theme-surface-elevated)' : 'transparent',
                    color: isActive ? 'var(--theme-bright)' : 'rgba(255,255,255,0.45)',
                    border: isActive ? '1px solid var(--theme-border-hover)' : '1px solid transparent',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Contents */}
        <div className="p-5">
          {/* TAB 1: STORY SO FAR */}
          {activeTab === 'story' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                Milestones Status at Selected Timestamp
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {storySoFar.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    onClick={() => m.commitSha && onSelectCommit?.(m.commitSha)}
                    className="glass rounded-xl p-4 border transition-all cursor-pointer"
                    style={{
                      borderColor: m.unlocked ? 'rgba(0,230,118,0.3)' : 'rgba(255,255,255,0.06)',
                      opacity: m.unlocked ? 1 : 0.45,
                      background: m.unlocked ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{m.icon}</span>
                        <span className="font-bold text-xs text-white">{m.label}</span>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase"
                        style={{
                          background: m.unlocked ? 'var(--theme-primary)20' : 'rgba(255,255,255,0.05)',
                          color: m.unlocked ? 'var(--theme-bright)' : 'rgba(255,255,255,0.4)',
                        }}
                      >
                        {m.unlocked ? '✓ Unlocked' : '🔒 Locked / Future'}
                      </span>
                    </div>
                    <p className="text-xs text-white/70 line-clamp-2">{m.description}</p>
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/40">
                      <span>{fmtDate(m.milestoneTs)}</span>
                      {m.commitSha && <span className="text-white/60">SHA: {m.commitSha.slice(0, 7)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: CONTRIBUTORS */}
          {activeTab === 'contributors' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                Active Contributors On or Before Selected Timestamp ({contributorsSoFar.length})
              </div>
              {contributorsSoFar.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-xs">No active contributors observed at this point.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {contributorsSoFar.map((c, i) => (
                    <div key={i} className="glass rounded-xl p-4 border border-white/6 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold uppercase text-white shadow bg-[var(--theme-primary)] flex-shrink-0">
                        {c.authorName.slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-white truncate">{c.authorName}</div>
                        <div className="text-[11px] text-white/50 mt-0.5">
                          {c.count} {c.count === 1 ? 'commit' : 'commits'} ({c.percentage}%)
                        </div>
                        <div className="text-[10px] text-white/35 mt-0.5">First: {fmtDate(c.firstTs)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CODEBASE OBSERVED */}
          {activeTab === 'codebase' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Most Touched File So Far */}
                <div className="glass rounded-xl p-4 border border-white/6">
                  <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                    Most Touched File So Far
                  </div>
                  {codebaseSoFar.mostTouchedFile ? (
                    <div>
                      <div className="font-mono text-sm font-bold text-white truncate">
                        {basename(codebaseSoFar.mostTouchedFile.filename)}
                      </div>
                      <div className="text-xs font-mono text-white/40 mt-0.5">
                        {codebaseSoFar.mostTouchedFile.directory}/
                      </div>
                      <div className="mt-3 text-xs font-bold text-[var(--theme-bright)]">
                        {codebaseSoFar.mostTouchedFile.touchCount} touches up to this point
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-white/40">None observed yet.</div>
                  )}
                </div>

                {/* Most Active Directory So Far */}
                <div className="glass rounded-xl p-4 border border-white/6">
                  <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                    Most Active Directory So Far
                  </div>
                  <div className="font-mono text-sm font-bold text-white truncate">
                    📁 {snapshot.mostActiveDirectory}/
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">Highest recorded file touches so far</div>
                </div>
              </div>

              {/* Recently Changed Files */}
              <div>
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Recently Changed Observed Files ({codebaseSoFar.recentlyChangedFiles.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {codebaseSoFar.recentlyChangedFiles.map((f, i) => (
                    <div key={i} className="glass rounded-lg p-2.5 flex items-center justify-between text-xs border border-white/5">
                      <span className="font-mono text-white/80 truncate">{basename(f.filename)}</span>
                      <span className="font-mono text-white/40 text-[11px] flex-shrink-0 ml-2">{fmtDate(f.latestTs)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
