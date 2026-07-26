import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const BRANCH_COLORS = {
  main:       '#00e5ff',
  master:     '#00e5ff',
  develop:    '#7c4dff',
  feature:    '#00e676',
  hotfix:     '#ff5252',
  release:    '#ffd740',
  experiment: '#ff6d00',
}
function branchColor(name) {
  if (!name) return '#8892b0'
  const n = name.toLowerCase()
  for (const [key, val] of Object.entries(BRANCH_COLORS)) {
    if (n.startsWith(key) || n.includes(key)) return val
  }
  return '#8892b0'
}

export default function CommitDetailsPanel({ commit, parsed, onClose }) {
  if (!commit) return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-6 gap-3">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-2">
        <svg viewBox="0 0 24 24" className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="4" />
          <path d="M2 12h6M16 12h6" />
        </svg>
      </div>
      <p className="text-white/20 text-sm text-center font-medium">Select a commit<br />on the graph</p>
    </div>
  )

  const short = commit.sha?.slice(0, 7) || ''
  const fullSha = commit.sha || ''
  const message = commit.message || ''
  const [firstLine, ...rest] = message.split('\n')
  const body = rest.join('\n').trim()
  const author = commit.authorName || 'Unknown'
  const authorEmail = commit.authorLogin || ''
  const ts = commit.timestamp
  const date = ts ? new Date(ts * 1000) : null
  const dateStr = date ? date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—'
  const timeStr = date ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''

  const isMerge = commit.parents && commit.parents.length > 1
  const parents = commit.parents || []
  const files = commit.files || []
  const added = files.filter(f => f.status === 'added' || f.change === 'A')
  const removed = files.filter(f => f.status === 'removed' || f.change === 'D')
  const modified = files.filter(f => !added.includes(f) && !removed.includes(f))

  const allCommits = parsed?.commits || []
  const children = allCommits.filter(c => c.parents?.includes(fullSha))

  const branch = (() => {
    const allBranches = parsed?.branches || []
    for (const b of allBranches) {
      if (b.tip === fullSha || b.head === fullSha) return b.name
    }
    return null
  })()

  const initials = author.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  const avatarColor = `hsl(${[...author].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360}, 60%, 50%)`

  return (
    <motion.div
      key={commit.sha}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="h-full overflow-y-auto"
    >
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {isMerge && (
              <span className="badge text-xs">
                <span className="text-yellow-400">★</span> Merge Commit
              </span>
            )}
            <h3 className="font-display font-semibold text-base text-white leading-snug">{firstLine}</h3>
            {body && (
              <p className="text-xs text-white/40 leading-relaxed">{body}</p>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0 mt-0.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Author */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${avatarColor}88, ${avatarColor}44)`, border: `1px solid ${avatarColor}44` }}
          >
            {initials}
          </div>
          <div>
            <div className="text-sm font-semibold text-white/90">{author}</div>
            {authorEmail && <div className="text-xs text-white/30 font-mono">{authorEmail}</div>}
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/4 rounded-xl p-3 border border-white/6">
            <div className="text-xs text-white/30 mb-1 font-medium uppercase tracking-wider">Hash</div>
            <div className="font-mono text-sm font-medium" style={{ color: 'var(--theme-bright)' }}>{short}</div>
          </div>
          <div className="bg-white/4 rounded-xl p-3 border border-white/6">
            <div className="text-xs text-white/30 mb-1 font-medium uppercase tracking-wider">Date</div>
            <div className="text-sm text-white/70">{dateStr}</div>
          </div>
          {branch && (
            <div className="bg-white/4 rounded-xl p-3 border border-white/6">
              <div className="text-xs text-white/30 mb-1 font-medium uppercase tracking-wider">Branch</div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: branchColor(branch) }} />
                <span className="text-sm font-mono text-white/70 truncate">{branch}</span>
              </div>
            </div>
          )}
          {timeStr && (
            <div className="bg-white/4 rounded-xl p-3 border border-white/6">
              <div className="text-xs text-white/30 mb-1 font-medium uppercase tracking-wider">Time</div>
              <div className="text-sm text-white/70 font-mono">{timeStr}</div>
            </div>
          )}
        </div>

        {/* Parents */}
        {parents.length > 0 && (
          <div>
            <div className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2">Parents ({parents.length})</div>
            <div className="space-y-1">
              {parents.map(p => (
                <div key={p} className="font-mono text-xs rounded-lg px-3 py-1.5"
                  style={{ color: 'var(--theme-text-primary)', background: 'var(--theme-surface-elevated)', border: '1px solid var(--theme-border)' }}>
                  {p.slice(0, 7)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Children */}
        {children.length > 0 && (
          <div>
            <div className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2">Children ({children.length})</div>
            <div className="space-y-1">
              {children.slice(0, 4).map(c => (
                <div key={c.sha} className="font-mono text-xs rounded-lg px-3 py-1.5"
                  style={{ color: 'var(--theme-bright)', background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-hover)' }}>
                  {c.sha.slice(0, 7)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files changed */}
        {files.length > 0 && (
          <div>
            <div className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2">
              Files Changed ({files.length})
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {added.slice(0, 10).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg hover:bg-white/4 transition-colors">
                  <span className="file-added font-bold flex-shrink-0">+</span>
                  <span className="font-mono text-white/60 truncate">{f.filename || f.path || f}</span>
                </div>
              ))}
              {removed.slice(0, 10).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg hover:bg-white/4 transition-colors">
                  <span className="file-removed font-bold flex-shrink-0">-</span>
                  <span className="font-mono text-white/60 truncate">{f.filename || f.path || f}</span>
                </div>
              ))}
              {modified.slice(0, 10).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg hover:bg-white/4 transition-colors">
                  <span className="file-modified font-bold flex-shrink-0">~</span>
                  <span className="font-mono text-white/60 truncate">{f.filename || f.path || f}</span>
                </div>
              ))}
            </div>
            {files.length > 30 && (
              <div className="text-xs text-white/30 mt-2 pl-2">+{files.length - 30} more files</div>
            )}
          </div>
        )}

        {/* Full SHA */}
        <div className="bg-white/4 border border-white/6 rounded-xl p-3">
          <div className="text-xs text-white/30 mb-1 font-medium uppercase tracking-wider">Full SHA</div>
          <div className="font-mono text-xs text-white/40 break-all">{fullSha}</div>
        </div>
      </div>
    </motion.div>
  )
}
