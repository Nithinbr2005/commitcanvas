import React from 'react'
import { motion } from 'framer-motion'

function getLanguageColor(lang) {
  const map = {
    JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3776ab',
    Rust: '#ce422b', Go: '#00add8', Java: '#b07219', C: '#555555',
    'C++': '#f34b7d', 'C#': '#178600', Ruby: '#701516', Swift: '#fa7343',
    Kotlin: '#7f52ff', Vue: '#41b883', HTML: '#e34c26', CSS: '#563d7c',
    Shell: '#89e051', Dart: '#00b4ab', PHP: '#4f5d95', Scala: '#c22d40',
  }
  return map[lang] || '#64748b'
}

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function RepoHeader({ parsed, repoMeta, loading }) {
  const repoName = repoMeta?.full_name || repoMeta?.name || 'Repository'
  const description = repoMeta?.description || parsed?.description || ''
  const stars = repoMeta?.stargazers_count
  const forks = repoMeta?.forks_count
  const language = repoMeta?.language || (parsed?.languages?.[0]) || ''
  const defaultBranch = repoMeta?.default_branch || parsed?.defaultBranch || 'main'
  const lastCommitTs = parsed?.commits?.length
    ? Math.max(...parsed.commits.map(c => c.timestamp))
    : null
  const contributors = parsed?.contributors?.length || 0

  if (!parsed && !loading) return null

  const [owner, name] = repoName.includes('/') ? repoName.split('/') : ['', repoName]

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass rounded-2xl px-6 py-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
    >
      {/* Left — repo identity */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--theme-surface-elevated)', border: '1px solid var(--theme-border-hover)' }}>
          <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ color: 'var(--theme-primary)' }} fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {owner && <span className="text-white/40 text-base font-medium">{owner} /</span>}
            <span className="font-display font-bold text-xl text-white truncate">{name || repoName}</span>
          </div>
          {description && (
            <p className="text-sm text-white/40 mt-0.5 truncate max-w-xs">{description}</p>
          )}
        </div>
      </div>

      {/* Right — metadata pills */}
      <div className="flex items-center flex-wrap gap-2 flex-shrink-0">
        {stars !== undefined && (
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-yellow-400" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="text-xs font-semibold text-white/70">
              {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
            </span>
          </div>
        )}
        {forks !== undefined && (
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" />
              <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9M12 12v3" />
            </svg>
            <span className="text-xs font-semibold text-white/70">
              {forks >= 1000 ? `${(forks / 1000).toFixed(1)}k` : forks}
            </span>
          </div>
        )}
        {language && (
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getLanguageColor(language) }}
            />
            <span className="text-xs font-medium text-white/70">{language}</span>
          </div>
        )}
        {defaultBranch && (
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 3.314-5.373 6-12 6" />
            </svg>
            <span className="text-xs font-medium text-white/70 font-mono">{defaultBranch}</span>
          </div>
        )}
        {lastCommitTs && (
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white/40" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            <span className="text-xs text-white/50">{timeAgo(lastCommitTs)}</span>
          </div>
        )}
        {contributors > 0 && (
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" style={{ color: 'var(--theme-bright)' }} fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
            <span className="text-xs font-medium text-white/70">{contributors} contributors</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
