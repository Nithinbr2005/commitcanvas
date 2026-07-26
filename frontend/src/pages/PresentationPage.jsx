import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

import { normalizeGitData } from '../utils/normalizeGitData'
import { generatePresentationScenes } from '../presentation/presentationEngine'
import { usePlayback } from '../store/usePlayback'
import Visualizer from '../components/Visualizer'

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

export default function PresentationPage() {
  const { owner, repo } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [parsedData, setParsedData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Presentation State
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false) // Intro starts paused until "Begin" clicked
  const [sceneProgress, setSceneProgress] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

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

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    const handler = (e) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Generate scenes
  const scenes = useMemo(() => {
    if (!parsedData) return []
    return generatePresentationScenes(parsedData)
  }, [parsedData])

  const currentScene = scenes[currentSceneIdx] || null

  // Exit Presentation Mode cleanly preserving origin state
  const handleExit = useCallback(() => {
    usePlayback.getState().setTime(0)
    usePlayback.getState().setPlaying(false)
    const originPath = location.state?.from || `/repository/${owner}/${repo}`
    navigate(originPath, { state: { data: parsedData } })
  }, [navigate, owner, repo, parsedData, location.state])

  // Scene navigation controls
  const handleNextScene = useCallback(() => {
    if (currentSceneIdx < scenes.length - 1) {
      setCurrentSceneIdx(prev => prev + 1)
      setSceneProgress(0)
    }
  }, [currentSceneIdx, scenes.length])

  const handlePrevScene = useCallback(() => {
    if (currentSceneIdx > 0) {
      setCurrentSceneIdx(prev => prev - 1)
      setSceneProgress(0)
    }
  }, [currentSceneIdx])

  const handleTogglePlay = useCallback(() => {
    setIsPlaying(prev => !prev)
  }, [])

  // Begin Presentation from Intro Scene
  const handleBeginPresentation = useCallback(() => {
    setIsPlaying(true)
    handleNextScene()
  }, [handleNextScene])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNextScene() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrevScene() }
      else if (e.key === ' ') { e.preventDefault(); handleTogglePlay() }
      else if (e.key === 'Escape') { e.preventDefault(); handleExit() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNextScene, handlePrevScene, handleTogglePlay, handleExit])

  // Automated Scene Timer
  useEffect(() => {
    if (!isPlaying || !currentScene || !currentScene.duration) return

    const totalDurationMs = currentScene.duration
    const intervalMs = 100
    const step = (intervalMs / totalDurationMs) * 100

    const timer = setInterval(() => {
      setSceneProgress(prev => {
        if (prev + step >= 100) {
          if (currentSceneIdx < scenes.length - 1) {
            setCurrentSceneIdx(i => i + 1)
            return 0
          } else {
            setIsPlaying(false)
            return 100
          }
        }
        return prev + step
      })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [isPlaying, currentScene, currentSceneIdx, scenes.length])

  // Graph playback synchronization for Scene 3 (Evolution)
  useEffect(() => {
    if (currentScene?.type === 'evolution' && isPlaying) {
      usePlayback.getState().setPlaying(true)
    } else {
      usePlayback.getState().setPlaying(false)
    }
  }, [currentScene?.type, isPlaying])

  // Clean playback state on unmount
  useEffect(() => {
    return () => {
      usePlayback.getState().setTime(0)
      usePlayback.getState().setPlaying(false)
    }
  }, [])

  // Motion animation parameters respecting accessibility
  const transitionProps = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.3 } }
    : { initial: { opacity: 0, scale: 0.98, y: 10 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.98, y: -10 }, transition: { duration: 0.5 } }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-base)] text-white overflow-hidden flex flex-col justify-between select-none">
      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <svg className="animate-spin w-8 h-8 text-[var(--theme-primary)]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.25} />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          </svg>
          <span className="text-sm font-medium text-white/60">Preparing Repository Presentation…</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-red-400 font-bold text-lg mb-2">⚠ Failed to Load Presentation</div>
          <div className="text-sm text-white/50 max-w-md mb-6">{error}</div>
          <button onClick={handleExit} className="px-5 py-2.5 rounded-xl glass font-bold text-xs hover:bg-white/10">
            Exit Presentation Mode
          </button>
        </div>
      )}

      {/* Main Presentation View */}
      {parsedData && !loading && currentScene && (
        <>
          {/* Top Control Bar (Fixed) */}
          <div className="absolute top-0 left-0 right-0 z-40 p-5 flex items-center justify-between pointer-events-none">
            {/* Repo identity badge */}
            <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-xl glass border border-white/10 text-xs font-mono text-white/70">
              <span className="w-2 h-2 rounded-full bg-[var(--theme-bright)] animate-pulse" />
              <span>{owner} / {repo}</span>
            </div>

            {/* Top-Right Controls */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                onClick={handlePrevScene}
                disabled={currentSceneIdx === 0}
                className="px-3 py-1.5 rounded-xl glass border border-white/10 text-xs font-bold text-white/80 hover:text-white disabled:opacity-30"
                title="Previous Scene (Left Arrow)"
              >
                ← Prev
              </button>

              <button
                onClick={handleTogglePlay}
                disabled={currentScene.type === 'intro' || currentScene.type === 'final'}
                className="px-3.5 py-1.5 rounded-xl glass border border-white/10 text-xs font-bold text-white hover:text-[var(--theme-bright)] disabled:opacity-30"
                title="Pause/Resume (Spacebar)"
              >
                {isPlaying ? '⏸ Pause' : '▶ Resume'}
              </button>

              <button
                onClick={handleNextScene}
                disabled={currentSceneIdx === scenes.length - 1}
                className="px-3 py-1.5 rounded-xl glass border border-white/10 text-xs font-bold text-white/80 hover:text-white disabled:opacity-30"
                title="Next Scene (Right Arrow)"
              >
                Next →
              </button>

              <button
                onClick={handleExit}
                className="px-3.5 py-1.5 rounded-xl glass border border-white/10 text-xs font-bold text-white/60 hover:text-red-400"
                title="Exit Presentation Mode (Escape)"
              >
                ✕ Exit
              </button>
            </div>
          </div>

          {/* Central Scene Workspace */}
          <div className="flex-1 flex items-center justify-center relative p-6">
            <AnimatePresence mode="wait">
              {/* SCENE 1: INTRO */}
              {currentScene.type === 'intro' && (
                <motion.div key="intro" {...transitionProps} className="text-center max-w-xl mx-auto space-y-6">
                  <div className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest text-[var(--theme-bright)] uppercase bg-[var(--theme-primary)]15 border border-[var(--theme-primary)]30">
                    CommitCanvas Presentation
                  </div>
                  <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-white tracking-tight leading-tight">
                    {currentScene.repo}
                  </h1>
                  <p className="text-base text-white/50">{currentScene.subtitle}</p>

                  <div className="pt-6">
                    <button
                      onClick={handleBeginPresentation}
                      className="px-8 py-3.5 rounded-2xl font-bold text-sm text-white transition-all shadow-2xl hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-bright))',
                        boxShadow: '0 0 30px rgba(0,230,118,0.3)',
                      }}
                    >
                      ▶ Begin Presentation
                    </button>
                  </div>
                </motion.div>
              )}

              {/* SCENE 2: PROJECT ORIGIN */}
              {currentScene.type === 'origin' && (
                <motion.div key="origin" {...transitionProps} className="text-center max-w-lg mx-auto space-y-6">
                  <div className="text-xs font-mono font-bold text-[var(--theme-bright)] tracking-widest uppercase">
                    Project Begins
                  </div>
                  <div className="font-mono text-3xl font-bold text-white">{currentScene.dateStr}</div>
                  <div className="glass rounded-2xl p-6 border border-white/10 space-y-3">
                    <div className="text-xs text-white/40 uppercase font-mono">First Recorded Commit ({currentScene.sha})</div>
                    <div className="text-base font-semibold text-white">"{currentScene.message}"</div>
                    <div className="text-xs text-[var(--theme-bright)] font-mono">by {currentScene.author}</div>
                  </div>
                </motion.div>
              )}

              {/* SCENE 3: REPOSITORY EVOLUTION (Hero Scene with Git Graph) */}
              {currentScene.type === 'evolution' && (
                <motion.div key="evolution" {...transitionProps} className="w-full h-full flex flex-col justify-between relative pt-12">
                  <div className="absolute top-12 left-6 z-20 pointer-events-none">
                    <div className="text-xs font-mono font-bold text-[var(--theme-bright)] tracking-widest uppercase">
                      Repository Evolution
                    </div>
                    <div className="text-sm text-white/60 font-mono mt-0.5">
                      Visualizing recorded git graph history
                    </div>
                  </div>

                  {/* Git Graph Embed */}
                  <div className="w-full h-full flex-1 rounded-2xl overflow-hidden glass border border-white/10 relative">
                    <Visualizer parsed={parsedData} />
                  </div>
                </motion.div>
              )}

              {/* SCENE 4: CONTRIBUTORS */}
              {currentScene.type === 'contributors' && (
                <motion.div key="contributors" {...transitionProps} className="max-w-2xl w-full mx-auto space-y-6">
                  <div className="text-center space-y-1">
                    <div className="text-xs font-mono font-bold text-[var(--theme-bright)] tracking-widest uppercase">
                      The People Behind the Code
                    </div>
                    <h2 className="text-2xl font-bold text-white">Top Recorded Contributors</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentScene.topContributors.map((c, i) => (
                      <div key={i} className="glass rounded-2xl p-5 border border-white/10 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--theme-primary)] flex items-center justify-center font-bold text-white text-sm shadow">
                          {c.authorName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-white truncate">{c.authorName}</div>
                          <div className="text-xs text-[var(--theme-bright)] font-mono font-bold mt-0.5">
                            {c.commitCount} commits ({c.percentage}%)
                          </div>
                          <div className="text-[11px] text-white/40 mt-0.5">First seen: {c.firstDate}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white/50 text-center font-mono">
                    Most active contributor in analyzed history: <strong className="text-white">{currentScene.mostActive}</strong>
                  </div>
                </motion.div>
              )}

              {/* SCENE 5: CODEBASE EVOLUTION */}
              {currentScene.type === 'codebase' && (
                <motion.div key="codebase" {...transitionProps} className="max-w-2xl w-full mx-auto space-y-6">
                  <div className="text-center space-y-1">
                    <div className="text-xs font-mono font-bold text-[var(--theme-bright)] tracking-widest uppercase">
                      The Codebase Takes Shape
                    </div>
                    <h2 className="text-2xl font-bold text-white">{currentScene.fileCount} Observed Files Across {currentScene.dirCount} Directories</h2>
                  </div>

                  {/* Top Directories */}
                  <div className="glass rounded-2xl p-5 border border-white/10 space-y-3">
                    <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">Most Active Directories</div>
                    {currentScene.topDirectories.map((d, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-white/80">📁 {d.path || 'root'}/</span>
                          <span className="text-[var(--theme-bright)]">{d.touchCount} touches</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-[var(--theme-primary)]" style={{ width: `${Math.min(100, (d.touchCount / currentScene.topDirectories[0].touchCount) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {currentScene.mostTouchedFile && (
                    <div className="p-4 rounded-xl glass border border-white/5 text-center text-xs">
                      Most touched file: <strong className="font-mono text-[var(--theme-bright)]">{basename(currentScene.mostTouchedFile.filename)}</strong> ({currentScene.mostTouchedFile.touchCount} recorded touches)
                    </div>
                  )}
                </motion.div>
              )}

              {/* SCENE 6: ENGINEERING INSIGHTS */}
              {currentScene.type === 'insights' && (
                <motion.div key="insights" {...transitionProps} className="max-w-3xl w-full mx-auto space-y-6">
                  <div className="text-center space-y-1">
                    <div className="text-xs font-mono font-bold text-[var(--theme-bright)] tracking-widest uppercase">
                      What the History Reveals
                    </div>
                    <h2 className="text-2xl font-bold text-white">Repository Observations</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentScene.insights.map((item, i) => (
                      <div key={i} className="glass rounded-2xl p-5 border border-white/10 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{item.icon}</span>
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-bright)]">{item.title}</span>
                        </div>
                        <div className="font-mono text-base font-bold text-white truncate">{item.subject}</div>
                        <p className="text-xs text-white/60 leading-relaxed">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* SCENE 7: TIME MACHINE SEQUENCE */}
              {currentScene.type === 'time_machine' && (
                <motion.div key="time_machine" {...transitionProps} className="max-w-2xl w-full mx-auto space-y-6 text-center">
                  <div className="space-y-1">
                    <div className="text-xs font-mono font-bold text-[var(--theme-bright)] tracking-widest uppercase">
                      Watch the Repository Grow
                    </div>
                    <h2 className="text-2xl font-bold text-white">Historical Metric Progression</h2>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {currentScene.steps[Math.min(currentScene.steps.length - 1, Math.floor((sceneProgress / 100) * currentScene.steps.length))] && (
                      <>
                        <div className="glass rounded-2xl p-5 border border-white/10">
                          <div className="text-xs text-white/40 uppercase">Commits</div>
                          <div className="font-mono text-2xl font-bold text-[var(--theme-bright)] mt-1">
                            {currentScene.steps[Math.min(currentScene.steps.length - 1, Math.floor((sceneProgress / 100) * currentScene.steps.length))].commitsCount}
                          </div>
                        </div>
                        <div className="glass rounded-2xl p-5 border border-white/10">
                          <div className="text-xs text-white/40 uppercase">Contributors</div>
                          <div className="font-mono text-2xl font-bold text-white mt-1">
                            {currentScene.steps[Math.min(currentScene.steps.length - 1, Math.floor((sceneProgress / 100) * currentScene.steps.length))].contributorsCount}
                          </div>
                        </div>
                        <div className="glass rounded-2xl p-5 border border-white/10">
                          <div className="text-xs text-white/40 uppercase">Observed Files</div>
                          <div className="font-mono text-2xl font-bold text-white mt-1">
                            {currentScene.steps[Math.min(currentScene.steps.length - 1, Math.floor((sceneProgress / 100) * currentScene.steps.length))].observedFilesCount}
                          </div>
                        </div>
                        <div className="glass rounded-2xl p-5 border border-white/10">
                          <div className="text-xs text-white/40 uppercase">Directories</div>
                          <div className="font-mono text-2xl font-bold text-white mt-1">
                            {currentScene.steps[Math.min(currentScene.steps.length - 1, Math.floor((sceneProgress / 100) * currentScene.steps.length))].directoriesCount}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* SCENE 8: FINAL SCENE */}
              {currentScene.type === 'final' && (
                <motion.div key="final" {...transitionProps} className="max-w-xl mx-auto space-y-6 text-center">
                  <div className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest text-[var(--theme-bright)] uppercase bg-[var(--theme-primary)]15 border border-[var(--theme-primary)]30">
                    Repository Today
                  </div>
                  <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
                    {currentScene.repo}
                  </h2>
                  <p className="text-xs text-white/40 font-mono">From first commit to current state ({currentScene.repoAgeDays} days of recorded history)</p>

                  <div className="grid grid-cols-3 gap-3 py-4">
                    <div className="glass rounded-xl p-3 border border-white/5">
                      <div className="font-mono text-xl font-bold text-[var(--theme-bright)]">{currentScene.snapshot?.commitsCount || 0}</div>
                      <div className="text-[10px] text-white/40 uppercase mt-0.5">Commits</div>
                    </div>
                    <div className="glass rounded-xl p-3 border border-white/5">
                      <div className="font-mono text-xl font-bold text-white">{currentScene.snapshot?.contributorsCount || 0}</div>
                      <div className="text-[10px] text-white/40 uppercase mt-0.5">Contributors</div>
                    </div>
                    <div className="glass rounded-xl p-3 border border-white/5">
                      <div className="font-mono text-xl font-bold text-white">{currentScene.snapshot?.observedFilesCount || 0}</div>
                      <div className="text-[10px] text-white/40 uppercase mt-0.5">Observed Files</div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                    <button
                      onClick={handleExit}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs text-white transition-all shadow-xl hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-bright))',
                      }}
                    >
                      Explore Repository →
                    </button>
                    <button
                      onClick={() => { setCurrentSceneIdx(0); setIsPlaying(false); setSceneProgress(0); }}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs glass border border-white/10 text-white/80 hover:text-white"
                    >
                      Replay Presentation
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Progress Bar Indicator */}
          <div className="p-4 flex items-center justify-center gap-3 z-40 bg-black/30 border-t border-white/5">
            <div className="flex items-center gap-2">
              {scenes.map((s, idx) => (
                <div
                  key={s.id}
                  onClick={() => { setCurrentSceneIdx(idx); setSceneProgress(0); }}
                  className="w-2.5 h-2.5 rounded-full cursor-pointer transition-all"
                  style={{
                    background: idx === currentSceneIdx
                      ? 'var(--theme-bright)'
                      : idx < currentSceneIdx
                      ? 'var(--theme-primary)'
                      : 'rgba(255,255,255,0.15)',
                    transform: idx === currentSceneIdx ? 'scale(1.3)' : 'scale(1)',
                    boxShadow: idx === currentSceneIdx ? '0 0 10px var(--theme-glow)' : 'none',
                  }}
                  title={`Scene ${idx + 1}: ${s.type}`}
                />
              ))}
            </div>
            <span className="text-[11px] font-mono text-white/40 ml-2">
              {currentSceneIdx + 1} / {scenes.length}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
