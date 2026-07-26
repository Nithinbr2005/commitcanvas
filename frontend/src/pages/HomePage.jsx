import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { normalizeGitData } from '../utils/normalizeGitData'
import { parseGitHubUrl, formatApiError } from '../utils/apiHelpers'
import ThemeSelector from '../components/ThemeSelector'

function GraphIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      <path d="M12 32 Q22 16 32 16" stroke="#7c4dff" strokeWidth="1.8" strokeOpacity="0.7" fill="none"/>
      <path d="M32 16 Q44 16 52 24" stroke="#00e5ff" strokeWidth="1.8" strokeOpacity="0.7" fill="none"/>
      <path d="M52 24 Q56 32 52 40" stroke="#00e676" strokeWidth="1.5" strokeOpacity="0.5" fill="none"/>
      <path d="M12 32 Q16 40 24 40" stroke="#ffd740" strokeWidth="1.5" strokeOpacity="0.5" fill="none"/>
      <path d="M24 40 Q36 40 44 48" stroke="#7c4dff" strokeWidth="1.5" strokeOpacity="0.5" fill="none"/>
      <circle cx="12"  cy="32" r="5" fill="#7c4dff" opacity="0.9"/>
      <circle cx="32"  cy="16" r="5" fill="#00e5ff" opacity="0.95"/>
      <circle cx="52"  cy="24" r="4" fill="#00e676" opacity="0.85"/>
      <circle cx="52"  cy="40" r="4" fill="#ff5252" opacity="0.85"/>
      <circle cx="24"  cy="40" r="4" fill="#ffd740" opacity="0.9"/>
      <circle cx="44"  cy="48" r="3.5" fill="#ff6d00" opacity="0.8"/>
      <circle cx="32" cy="16" r="9" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.35" fill="none"/>
    </svg>
  )
}

function FeaturePill({ icon, label, color }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ background: `${color}12`, border: `1px solid ${color}30`, color }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  )
}

// 1-Click Verified Demo Repositories
const DEMO_REPOS = [
  { label: 'CommitCanvas (Primary Demo)', owner: 'Nithinbr2005', repo: 'commit-canvas-project', size: 'Small' },
  { label: 'Vite', owner: 'vitejs', repo: 'vite', size: 'Medium' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [urlInput, setUrlInput] = useState('')
  const [isFocused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorInfo, setErrorInfo] = useState(null)

  const handleFetchRepo = useCallback(async (targetUrl) => {
    const parsed = parseGitHubUrl(targetUrl)
    if (!parsed) {
      setErrorInfo({
        title: 'Invalid Repository Format',
        message: 'Please enter a valid GitHub URL or repository path (e.g. https://github.com/owner/repo or owner/repo).',
        canRetry: false,
      })
      return
    }

    setErrorInfo(null)
    setLoading(true)

    try {
      const r = await axios.post('https://commit-canvas-api.onrender.com/api/repo/fetch', { repoUrl: parsed.repoUrl })
      const data = r.data.data
      if (!data || !data.commits || !Array.isArray(data.commits)) {
        setErrorInfo({
          title: 'Repository Data Missing',
          message: 'No commit data returned for this repository.',
          canRetry: true,
        })
        return
      }
      const normalized = normalizeGitData(data)
      navigate(`/repository/${parsed.owner}/${parsed.repo}`, { state: { data: normalized } })
    } catch (err) {
      setErrorInfo(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (loading || !urlInput.trim()) return
    handleFetchRepo(urlInput)
  }

  const features = [
    { icon: '⬤', label: 'Git Graph', color: '#00e5ff' },
    { icon: '★', label: 'Repository Story', color: '#ffd740' },
    { icon: '◆', label: 'Contributor Journey', color: '#00e676' },
    { icon: '●', label: 'File Evolution', color: '#7c4dff' },
    { icon: '⏱', label: 'Time Machine', color: '#ff6d00' },
    { icon: '▶', label: 'Presentation Mode', color: '#ff5252' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-animated-grid" style={{ background: 'var(--bg-base)' }}>
      {/* ── Header ── */}
      <header className="glass-strong sticky top-0 z-40 border-b border-white/6">
        <div className="max-w-screen-xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-bright))' }}>
              <svg viewBox="0 0 20 20" className="w-4 h-4 text-white" fill="none">
                <circle cx="4"  cy="10" r="2.5" fill="currentColor" opacity="0.9" />
                <circle cx="10" cy="6"  r="2.5" fill="currentColor" opacity="0.9" />
                <circle cx="16" cy="10" r="2.5" fill="currentColor" opacity="0.9" />
                <path d="M6.5 10 Q8 6 10 6" stroke="currentColor" strokeWidth="1" fill="none" strokeOpacity="0.6"/>
                <path d="M10 6 Q13 6 13.5 10" stroke="currentColor" strokeWidth="1" fill="none" strokeOpacity="0.6"/>
              </svg>
            </div>
            <span className="font-display font-bold text-base text-white tracking-tight">CommitCanvas</span>
          </div>

          <ThemeSelector />
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-16">
        <motion.div
          className="flex flex-col items-center gap-8 w-full max-w-2xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Logo mark */}
          <motion.div
            className="relative w-24 h-24 sm:w-28 sm:h-28"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: 'backOut' }}
          >
            <div className="absolute inset-0 rounded-3xl border border-white/10 flex items-center justify-center p-4" style={{ background: 'var(--theme-bg-secondary)' }}>
              <GraphIcon />
            </div>
            <div className="absolute inset-0 rounded-3xl blur-3xl opacity-40 -z-10" style={{ background: 'linear-gradient(to bottom right, var(--theme-primary), var(--theme-bright))' }} />
          </motion.div>

          {/* Headline & Subtitle */}
          <div className="text-center space-y-3">
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-white leading-tight tracking-tight uppercase">
              SEE HOW CODE EVOLVES.
            </h1>
            <p className="text-sm sm:text-base text-white/60 max-w-lg mx-auto leading-relaxed">
              Transform Git history into interactive stories, contributor journeys, file evolution, repository intelligence, and cinematic presentations.
            </p>
          </div>

          {/* URL Input Form */}
          <div className="w-full glass rounded-2xl p-4 sm:p-5 space-y-3 border border-white/10">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <div
                className="flex-1 flex items-center rounded-xl transition-all duration-200"
                style={{ 
                  background: 'var(--theme-bg-secondary)', 
                  border: '1px solid var(--theme-border)',
                  boxShadow: isFocused ? '0 0 0 2px var(--theme-glow)' : 'none',
                  borderColor: isFocused ? 'var(--theme-primary)' : 'var(--theme-border)'
                }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/25 ml-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
                <input
                  id="repo-url-input"
                  type="text"
                  disabled={loading}
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/25 text-xs sm:text-sm px-3 py-3 font-mono disabled:opacity-50"
                  placeholder="https://github.com/owner/repo or owner/repo"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
                {urlInput && !loading && (
                  <button type="button" onClick={() => setUrlInput('')} className="mr-2 text-white/20 hover:text-white/50 transition-colors">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              <button
                id="visualize-btn"
                type="submit"
                disabled={loading || !urlInput.trim()}
                className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.25} />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
                    </svg>
                    <span>Analyzing Repo…</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span>Explore Repository</span>
                  </>
                )}
              </button>
            </form>

            {/* Error Notification */}
            <AnimatePresence>
              {errorInfo && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-xl p-3 text-xs space-y-1"
                  style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.25)', color: '#fca5a5' }}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-red-300">
                      <span>⚠</span> {errorInfo.title}
                    </span>
                    <button onClick={() => setErrorInfo(null)} className="text-red-400/60 hover:text-red-300">✕</button>
                  </div>
                  <p className="text-white/70 leading-relaxed">{errorInfo.message}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Try Demo Repositories Section */}
            <div className="pt-2 border-t border-white/5">
              <div className="text-[11px] font-mono text-white/40 mb-2 text-center uppercase tracking-wider">
                Try Demo Repositories (1-Click Showcase)
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {DEMO_REPOS.map(demo => (
                  <button
                    key={demo.repo}
                    disabled={loading}
                    onClick={() => {
                      setUrlInput(`https://github.com/${demo.owner}/${demo.repo}`)
                      handleFetchRepo(`https://github.com/${demo.owner}/${demo.repo}`)
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 glass hover:bg-white/10 border border-white/10 disabled:opacity-50"
                  >
                    <span className="text-[var(--theme-bright)]">⚡</span>
                    <span className="text-white/80 font-bold">{demo.owner}/{demo.repo}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-white/40">{demo.size}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feature pills */}
          <motion.div
            className="flex flex-wrap justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {features.map(f => <FeaturePill key={f.label} {...f} />)}
          </motion.div>
        </motion.div>
      </main>

      <footer className="border-t border-white/5 py-4 text-center">
        <span className="text-xs text-white/20">
          CommitCanvas — GitHub manages repositories. CommitCanvas explains how they evolved.
        </span>
      </footer>
    </div>
  )
}
