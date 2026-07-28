import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

import CommitDetailsPanel from '../components/CommitDetailsPanel'
import { normalizeGitData } from '../utils/normalizeGitData'
import { analyzeRepository } from '../analytics/repositoryAnalytics'
import { generateStory } from '../analytics/storyGenerator'
import RepositoryHealth from '../components/health/RepositoryHealth'

/* ─────────────────────────────────────────
   Milestone type config (colors + icons)
───────────────────────────────────────── */
const MILESTONE_CONFIG = {
  project_begins:  { accent: 'var(--theme-primary)', glow: 'var(--theme-glow)'       },
  activity_peak:   { accent: 'var(--theme-bright)',  glow: 'var(--theme-glow-strong)' },
  new_contributor: { accent: '#00e676',              glow: 'rgba(0,230,118,0.35)'     },
  major_merge:     { accent: '#ffd740',              glow: 'rgba(255,215,64,0.35)'    },
  large_change:    { accent: '#f472b6',              glow: 'rgba(244,114,182,0.35)'   },
  inactivity:      { accent: 'rgba(255,255,255,0.3)',glow: 'transparent'              },
  current_state:   { accent: 'var(--theme-bright)',  glow: 'var(--theme-glow-strong)' },
}

function getMilestoneConfig(type) {
  return MILESTONE_CONFIG[type] || MILESTONE_CONFIG.project_begins
}

/* ─────────────────────────────────────────
   Milestone card
───────────────────────────────────────── */
function MilestoneCard({ milestone, isActive, isFirst, isLast, onSelect }) {
  const cfg = getMilestoneConfig(milestone.type)
  const hasCommit      = !!milestone.commitSha
  const isInactivity   = milestone.type === 'inactivity'
  const isCurrentState = milestone.type === 'current_state'

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="relative flex gap-5 group"
    >
      {/* ── Vertical connector line ── */}
    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
        {/* Top line */}
        <div
          className="w-px flex-1"
          style={{
            background: isFirst ? 'transparent' : 'rgba(255,255,255,0.1)',
            minHeight: 16,
          }}
        />

        {/* Node dot — larger + diamond for current_state */}
        <motion.div
          onClick={() => onSelect(milestone)}
          whileHover={{ scale: 1.25 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex items-center justify-center cursor-pointer flex-shrink-0 z-10"
          style={{
            width:  isCurrentState ? 44 : 36,
            height: isCurrentState ? 44 : 36,
            borderRadius: isCurrentState ? '10px' : '50%',
            transform: isCurrentState ? 'rotate(45deg)' : 'none',
            background: isActive
              ? `radial-gradient(circle, ${cfg.accent}40, ${cfg.accent}15)`
              : isCurrentState
                ? `radial-gradient(circle, ${cfg.accent}20, ${cfg.accent}06)`
                : 'rgba(255,255,255,0.05)',
            border: `2px solid ${
              isActive ? cfg.accent
              : isCurrentState ? cfg.accent + '60'
              : 'rgba(255,255,255,0.12)'
            }`,
            boxShadow: isActive
              ? `0 0 28px ${cfg.glow}, 0 0 8px ${cfg.glow}`
              : isCurrentState
                ? `0 0 14px ${cfg.glow}`
                : 'none',
            transition: 'all 0.25s ease',
          }}
        >
          <span style={{
            fontSize: isCurrentState ? 16 : 14,
            lineHeight: 1,
            transform: isCurrentState ? 'rotate(-45deg)' : 'none',
            display: 'block',
          }}>
            {milestone.icon}
          </span>
          {isActive && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{
                position: 'absolute',
                inset: -2,
                borderRadius: isCurrentState ? '10px' : '50%',
                border: `1px solid ${cfg.accent}`,
                pointerEvents: 'none',
              }}
            />
          )}
        </motion.div>

        {/* Bottom line */}
        <div
          className="w-px flex-1"
          style={{
            background: isLast ? 'transparent' : 'rgba(255,255,255,0.1)',
            minHeight: 24,
          }}
        />
      </div>

      {/* ── Content card ── */}
      <motion.div
        onClick={() => onSelect(milestone)}
        whileHover={{ x: 4 }}
        transition={{ duration: 0.2 }}
        className="flex-1 mb-2 cursor-pointer rounded-2xl p-4 transition-all"
        style={{
          background: isActive
            ? `linear-gradient(135deg, ${cfg.accent}12, rgba(255,255,255,0.04))`
            : isCurrentState
              ? `linear-gradient(135deg, ${cfg.accent}07, rgba(255,255,255,0.02))`
              : 'rgba(255,255,255,0.03)',
          border: `1px solid ${
            isActive ? cfg.accent + '45'
            : isCurrentState ? cfg.accent + '28'
            : 'rgba(255,255,255,0.07)'
          }`,
          boxShadow: isActive
            ? `0 4px 28px ${cfg.glow}`
            : isCurrentState
              ? `0 2px 16px ${cfg.glow}`
              : 'none',
          transition: 'all 0.25s ease',
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: cfg.accent }}
              >
                {milestone.label}
              </span>
              {isInactivity && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {milestone.meta?.gapDays}d gap
                </span>
              )}
              {milestone.type === 'activity_peak' && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-mono"
                  style={{
                    background: 'var(--theme-surface-elevated)',
                    border: '1px solid var(--theme-border-hover)',
                    color: 'var(--theme-bright)',
                  }}
                >
                  {milestone.meta?.commitCount} commits
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {milestone.date}
            </div>
          </div>

          {/* SHA badge */}
          {hasCommit && (
            <div
              className="text-xs font-mono px-2 py-0.5 rounded-lg flex-shrink-0"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              {milestone.commitSha.slice(0, 7)}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {milestone.description}
        </p>

        {/* Inactivity boundary details */}
        {isInactivity && milestone.meta && (
          <div className="flex gap-3 mt-3 flex-wrap">
            {milestone.meta.previousCommitSha && (
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                After <span className="font-mono">{milestone.meta.previousCommitSha.slice(0, 7)}</span>
              </div>
            )}
            {milestone.meta.nextCommitSha && (
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Before <span className="font-mono">{milestone.meta.nextCommitSha.slice(0, 7)}</span>
              </div>
            )}
          </div>
        )}

        {/* Current state stat grid */}
        {isCurrentState && milestone.meta && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { v: milestone.meta.commitCount,          l: 'Commits'      },
                { v: milestone.meta.contributorCount,     l: 'Contributors' },
                { v: milestone.meta.branchCount,          l: 'Branches'     },
                { v: `${milestone.meta.repoAgeInDays}d`,  l: 'History'      },
              ].map(({ v, l }) => (
                <div
                  key={l}
                  className="rounded-xl p-2 text-center"
                  style={{
                    background: `${cfg.accent}08`,
                    border: `1px solid ${cfg.accent}20`,
                  }}
                >
                  <div className="text-base font-bold font-display" style={{ color: cfg.accent }}>
                    {v}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{l}</div>
                </div>
              ))}
            </div>
            {/* Latest commit row */}
            {milestone.meta.latestCommitSha7 && (
              <div
                className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{
                  background: `${cfg.accent}06`,
                  border: `1px solid ${cfg.accent}18`,
                }}
              >
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Latest commit</span>
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: cfg.accent }}
                >
                  {milestone.meta.latestCommitSha7}
                </span>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────
   Commit Details sidebar
───────────────────────────────────────── */
function StoryDetailsPanel({ activeMilestone, parsedData, onViewInGraph }) {
  const isInactivity = activeMilestone?.type === 'inactivity'
  const hasCommit    = activeMilestone?.commitSha != null
  const cfg = activeMilestone ? getMilestoneConfig(activeMilestone.type) : null

  // Find the commit object for the active milestone
  const commit = useMemo(() => {
    if (!hasCommit || !parsedData?.commits) return null
    return parsedData.commits.find(c => c.sha === activeMilestone.commitSha) || null
  }, [activeMilestone, hasCommit, parsedData])

  if (!activeMilestone) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-6 gap-4 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.4}
               style={{ color: 'rgba(255,255,255,0.2)' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Select a milestone<br />to inspect its commit
        </p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
          Story milestones are derived from<br />real repository history
        </p>
      </div>
    )
  }

  // Inactivity milestones have no commit
  if (isInactivity) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {activeMilestone.icon}
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {activeMilestone.label}
            </div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {activeMilestone.date}
            </div>
          </div>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {activeMilestone.description}
        </p>

        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="text-xs font-medium uppercase tracking-wider mb-2"
               style={{ color: 'rgba(255,255,255,0.3)' }}>
            Gap Details
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Duration</span>
            <span className="text-sm font-mono font-semibold" style={{ color: cfg?.accent }}>
              {activeMilestone.meta?.gapDays} days
            </span>
          </div>
          {activeMilestone.meta?.previousCommitSha && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Before pause</span>
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {activeMilestone.meta.previousCommitSha.slice(0, 7)}
              </span>
            </div>
          )}
          {activeMilestone.meta?.nextCommitSha && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>After pause</span>
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {activeMilestone.meta.nextCommitSha.slice(0, 7)}
              </span>
            </div>
          )}
        </div>

        {/* Navigate to boundary commit in graph */}
        {(activeMilestone.meta?.previousCommitSha || activeMilestone.meta?.nextCommitSha) && (
          <button
            onClick={() => onViewInGraph(activeMilestone.meta.nextCommitSha || activeMilestone.meta.previousCommitSha)}
            className="w-full btn-ghost flex items-center justify-center gap-2 mt-2"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            View in Graph
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M7 17 17 7M7 7h10v10" />
            </svg>
          </button>
        )}
      </div>
    )
  }

  // Normal commit milestone
  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-xs font-medium uppercase tracking-wider"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
          Commit Details
        </span>
        {hasCommit && (
          <button
            onClick={() => onViewInGraph(activeMilestone.commitSha)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105"
            style={{
              background: `${cfg?.accent}15`,
              border: `1px solid ${cfg?.accent}30`,
              color: cfg?.accent,
            }}
          >
            View in Graph
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M7 17 17 7M7 7h10v10" />
            </svg>
          </button>
        )}
      </div>

      {/* CommitDetailsPanel — existing component, zero modifications */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <CommitDetailsPanel
            key={activeMilestone.commitSha || 'no-commit'}
            commit={commit}
            parsed={parsedData}
          />
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Story page loading / error states
───────────────────────────────────────── */
function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 glass rounded-2xl px-5 py-4"
    >
      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"
           style={{ color: 'var(--theme-primary)' }}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.25} />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      </svg>
      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
        Fetching repository data…
      </span>
    </motion.div>
  )
}

/* ─────────────────────────────────────────
   Main RepositoryStoryPage
───────────────────────────────────────── */
export default function RepositoryStoryPage() {
  const { owner, repo }  = useParams()
  const location         = useLocation()
  const navigate         = useNavigate()

  const [parsedData, setParsedData] = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [activeMilestone, setActiveMilestone] = useState(null)

  // ── Load data (re-fetch on direct URL, use state if navigated) ──────────────
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

  // ── Analytics + story generation ────────────────────────────────────────────
  const milestones = useMemo(() => {
    if (!parsedData) return []
    const analytics = analyzeRepository(parsedData)
    if (!analytics) return []
    return generateStory(analytics, { owner, repo })
  }, [parsedData, owner, repo])

  // Auto-select first commit milestone on load
  useEffect(() => {
    if (milestones.length > 0 && !activeMilestone) {
      const first = milestones.find(m => m.commitSha !== null) || milestones[0]
      setActiveMilestone(first)
    }
  }, [milestones, activeMilestone])

  // ── Navigate to graph with selected commit ───────────────────────────────────
  const handleViewInGraph = useCallback((sha) => {
    navigate(`/repository/${owner}/${repo}`, {
      state: { data: parsedData, selectSha: sha },
    })
  }, [navigate, owner, repo, parsedData])

  // ── Handle milestone selection ───────────────────────────────────────────────
  const handleSelectMilestone = useCallback((milestone) => {
    setActiveMilestone(milestone)
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col bg-animated-grid"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="glass-strong sticky top-0 z-40" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-screen-2xl mx-auto px-5 h-14 flex items-center gap-4">
          {/* Logo / back to home */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 flex-shrink-0 group"
            title="Back to home"
          >
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

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
            <span className="truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{owner}</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span className="font-medium truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{repo}</span>
          </div>

          {/* Nav tabs */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {[
              { id: 'graph',        label: 'Graph',        active: false, path: `/repository/${owner}/${repo}`              },
              { id: 'story',        label: 'Story',        active: true,  path: null                                        },
              { id: 'contributors', label: 'Contributors', active: false, path: `/repository/${owner}/${repo}/contributors` },
              { id: 'files',        label: 'Files',        active: false, path: `/repository/${owner}/${repo}/files`        },
              { id: 'time-machine', label: 'Time Machine', active: false, path: `/repository/${owner}/${repo}/time-machine` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => !tab.active && navigate(tab.path, { state: { data: parsedData } })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
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


      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-5 py-6">

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingState />
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
              <button onClick={() => setError(null)} style={{ color: 'rgba(248,113,113,0.5)' }}
                      className="hover:text-red-300 transition-colors">
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
            {/* ── Page hero ──────────────────────────────────────────────── */}
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
                    background: 'linear-gradient(135deg, var(--theme-primary)20, var(--theme-bright)10)',
                    border: '1px solid var(--theme-border-hover)',
                  }}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5}
                       style={{ color: 'var(--theme-bright)' }}>
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <h1
                    className="font-display font-bold text-2xl text-white tracking-tight"
                  >
                    Repository Story
                  </h1>
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {owner}/{repo} — based on loaded repository history
                  </p>
                </div>
              </div>

              {milestones.length > 0 && (
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <span
                    className="text-xs px-3 py-1 rounded-full font-medium"
                    style={{
                      background: 'var(--theme-surface-elevated)',
                      border: '1px solid var(--theme-border)',
                      color: 'var(--theme-text-secondary)',
                    }}
                  >
                    {milestones.length} milestones
                  </span>
                  {[...new Set(milestones.map(m => m.type))].map(type => {
                    const cfg = getMilestoneConfig(type)
                    const icon = milestones.find(m => m.type === type)?.icon
                    return (
                      <span
                        key={type}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: `${cfg.accent}12`,
                          border: `1px solid ${cfg.accent}25`,
                          color: cfg.accent,
                        }}
                      >
                        {icon} {type.replace(/_/g, ' ')}
                      </span>
                    )
                  })}
                </div>
              )}
            </motion.div>

            {/* ── Repository Health ──────────────────────────────────────── */}
            <RepositoryHealth parsedData={parsedData} />

            {/* ── Two-column layout ──────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-5" style={{ alignItems: 'flex-start' }}>

              {/* LEFT — Timeline (60%) */}
              <div className="flex-1 min-w-0" style={{ flexBasis: '60%' }}>
                {milestones.length === 0 ? (
                  <div
                    className="rounded-2xl px-6 py-12 text-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      No story milestones could be derived from the loaded history.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {milestones.map((milestone, i) => (
                      <MilestoneCard
                        key={milestone.id}
                        milestone={milestone}
                        isActive={activeMilestone?.id === milestone.id}
                        isFirst={i === 0}
                        isLast={i === milestones.length - 1}
                        onSelect={handleSelectMilestone}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT — CommitDetailsPanel (sticky, 40%) */}
              <div
                className="lg:sticky w-full rounded-2xl overflow-hidden flex flex-col"
                style={{
                  top: 80,
                  flexBasis: '38%',
                  minWidth: 280,
                  maxWidth: 440,
                  minHeight: 520,
                  background: 'var(--theme-surface)',
                  border: '1px solid var(--theme-border)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                <StoryDetailsPanel
                  activeMilestone={activeMilestone}
                  parsedData={parsedData}
                  onViewInGraph={handleViewInGraph}
                />
              </div>

            </div>
          </motion.div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="py-4 text-center">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
          CommitCanvas — Repository Story · Layer 2 Intelligence
        </span>
      </footer>
    </div>
  )
}
