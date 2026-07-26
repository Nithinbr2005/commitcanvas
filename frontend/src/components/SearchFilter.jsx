import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function SearchFilter({ parsed, onFilter, onClose }) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('all') // all | author | branch | hash | message
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!parsed?.commits) return
    const q = query.trim().toLowerCase()
    if (!q) {
      onFilter(null)
      return
    }
    const filtered = parsed.commits.filter(c => {
      if (mode === 'author') return (c.author?.name || '').toLowerCase().includes(q)
      if (mode === 'branch') {
        const branches = parsed.branches || []
        return branches.some(b => b.name?.toLowerCase().includes(q) && (b.commits?.includes(c.sha) || b.tip === c.sha))
      }
      if (mode === 'hash') return c.sha?.toLowerCase().startsWith(q)
      if (mode === 'message') return c.message?.toLowerCase().includes(q)
      // all
      return (
        c.sha?.toLowerCase().startsWith(q) ||
        c.message?.toLowerCase().includes(q) ||
        (c.author?.name || '').toLowerCase().includes(q)
      )
    })
    onFilter(filtered)
  }, [query, mode, parsed, onFilter])

  const modes = [
    { id: 'all',     label: 'All' },
    { id: 'message', label: 'Message' },
    { id: 'author',  label: 'Author' },
    { id: 'hash',    label: 'Hash' },
    { id: 'branch',  label: 'Branch' },
  ]

  const resultCount = (() => {
    if (!query.trim()) return null
    if (!parsed?.commits) return 0
    const q = query.trim().toLowerCase()
    return parsed.commits.filter(c => {
      if (mode === 'author') return (c.author?.name || '').toLowerCase().includes(q)
      if (mode === 'hash') return c.sha?.toLowerCase().startsWith(q)
      if (mode === 'message') return c.message?.toLowerCase().includes(q)
      return c.sha?.toLowerCase().startsWith(q) || c.message?.toLowerCase().includes(q) || (c.author?.name || '').toLowerCase().includes(q)
    }).length
  })()

  return (
    <div className="search-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="glass-strong rounded-2xl w-full max-w-xl mx-4 overflow-hidden"
        style={{ border: '1px solid var(--theme-border-hover)', boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 40px var(--theme-glow)' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/30 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/20 text-base"
            placeholder="Search commits, authors, hashes…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          />
          {resultCount !== null && (
            <span className="text-xs text-white/30 font-mono flex-shrink-0">{resultCount} results</span>
          )}
          <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode filters */}
        <div className="flex items-center gap-1 px-4 py-2.5 border-b border-white/4">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === m.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
              style={mode === m.id ? {
                background: 'var(--theme-surface-elevated)',
                color: 'var(--theme-text-primary)',
                border: '1px solid var(--theme-border-hover)'
              } : { border: '1px solid transparent' }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Hints */}
        {!query && (
          <div className="px-5 py-4 space-y-2">
            <div className="text-xs text-white/20 font-medium mb-3">Quick actions</div>
            {[
              ['Search by author name', 'Switch to Author mode'],
              ['Paste a commit hash', 'Switch to Hash mode'],
              ['Search commit messages', 'Switch to Message mode'],
              ['Esc', 'Close search'],
            ].map(([hint, action]) => (
              <div key={hint} className="flex items-center justify-between">
                <span className="text-xs text-white/40">{hint}</span>
                <span className="text-xs text-white/20">{action}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-white/2 border-t border-white/4">
          <div className="flex items-center gap-3 text-xs text-white/20">
            <span><kbd className="font-mono bg-white/8 px-1.5 py-0.5 rounded border border-white/10">Esc</kbd> close</span>
            <span><kbd className="font-mono bg-white/8 px-1.5 py-0.5 rounded border border-white/10">/</kbd> search</span>
          </div>
          <span className="text-xs text-white/20">CommitCanvas Search</span>
        </div>
      </motion.div>
    </div>
  )
}
