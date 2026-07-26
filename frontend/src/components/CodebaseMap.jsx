import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateCodebaseMap } from '../analytics/fileAnalytics'

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

/**
 * TreeNode
 * Recursive tree row component with collapsible state and hover stats.
 */
function TreeNode({ node, depth = 0, onViewEvolution, searchQuery }) {
  // Collapse by default if depth >= 2 to maintain performance on huge repositories
  const [expanded, setExpanded] = useState(depth < 2)
  const [showTooltip, setShowTooltip] = useState(false)

  const isDir = node.type === 'dir'
  const color = !isDir ? extColor(node.name) : '#ffd740'

  // If searchQuery is present, check if node or any children match
  const matchesSearch = useMemo(() => {
    if (!searchQuery?.trim()) return true
    const q = searchQuery.toLowerCase()
    if (node.name.toLowerCase().includes(q)) return true
    if (isDir && node.children) {
      const checkChild = (child) => {
        if (child.name.toLowerCase().includes(q)) return true
        if (child.children) return child.children.some(checkChild)
        return false
      }
      return node.children.some(checkChild)
    }
    return false
  }, [node, isDir, searchQuery])

  // Automatically expand if child matches search
  React.useEffect(() => {
    if (searchQuery?.trim() && matchesSearch && isDir) {
      setExpanded(true)
    }
  }, [searchQuery, matchesSearch, isDir])

  if (!matchesSearch) return null

  return (
    <div className="select-none font-mono text-xs">
      {/* Node Row */}
      <div
        onClick={() => {
          if (isDir) setExpanded(!expanded)
          else if (onViewEvolution) onViewEvolution(node.path)
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors relative group"
        style={{
          paddingLeft: `${depth * 20 + 8}px`,
          background: showTooltip ? 'rgba(255,255,255,0.06)' : 'transparent',
          borderLeft: depth > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isDir ? (
            <span className="w-4 h-4 flex items-center justify-center text-white/50 text-[10px] flex-shrink-0 transition-transform"
                  style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              ▶
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full flex-shrink-0 ml-1" style={{ background: color }} />
          )}

          <span className={`truncate font-medium ${isDir ? 'text-white/90 font-semibold' : 'text-white/70 group-hover:text-white'}`}>
            {node.name}
          </span>
          {isDir && (
            <span className="text-[10px] text-white/30 px-1.5 py-0.2 rounded bg-white/5">
              dir
            </span>
          )}
        </div>

        {/* Subtle Activity Indicator */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.04)', color: isDir ? 'var(--theme-bright)' : color }}>
            {node.touchCount} touches
          </span>
          <span className="text-[11px] text-white/40 hidden sm:inline-block w-24 text-right truncate">
            {fmtDate(node.latestTs)}
          </span>
        </div>

        {/* Hover Tooltip */}
        {showTooltip && (
          <div className="absolute right-4 bottom-full mb-1 z-50 glass-strong rounded-xl p-3 shadow-2xl border border-white/10 text-left w-64 pointer-events-none"
               style={{ background: 'var(--theme-surface-elevated)' }}>
            <div className="font-bold text-white mb-1 truncate">{node.path || node.name}</div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-white/70">
              <div>
                <span className="text-white/40 block">Recorded Touches:</span>
                <span className="font-bold text-[var(--theme-bright)]">{node.touchCount}</span>
              </div>
              <div>
                <span className="text-white/40 block">Contributors:</span>
                <span className="font-bold text-white">{node.contributorCount}</span>
              </div>
              <div className="col-span-2">
                <span className="text-white/40 block">Latest Recorded Change:</span>
                <span className="text-white font-mono">{fmtDate(node.latestTs)}</span>
              </div>
            </div>
            {!isDir && (
              <div className="mt-2 pt-1 border-t border-white/10 text-[10px] text-[var(--theme-bright)] text-center font-sans font-semibold">
                Click to view evolution timeline →
              </div>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onViewEvolution={onViewEvolution}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CodebaseMap({ parsedData, onViewEvolution }) {
  const [searchQuery, setSearchQuery] = useState('')

  const tree = useMemo(() => {
    if (!parsedData) return null
    return generateCodebaseMap(parsedData)
  }, [parsedData])

  if (!tree) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-white/40">
        No directory hierarchy observed in the loaded repository data.
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl border border-white/6 overflow-hidden">
      {/* Header Controls */}
      <div className="p-4 border-b border-white/6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/20">
        <div>
          <h2 className="text-lg font-bold text-white">Repository Hierarchy Map</h2>
          <p className="text-xs text-white/40 mt-0.5">
            Interactive folder explorer. Hover over nodes for activity stats; click file nodes to inspect evolution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter files/folders…"
            className="input-glass px-3 py-1.5 text-xs rounded-lg w-56"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-xs text-white/40 hover:text-white">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tree View */}
      <div className="p-4 max-h-[700px] overflow-y-auto space-y-0.5">
        <TreeNode node={tree} depth={0} onViewEvolution={onViewEvolution} searchQuery={searchQuery} />
      </div>
    </div>
  )
}
