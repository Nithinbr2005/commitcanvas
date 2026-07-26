import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtMonthYear(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', year: '2-digit',
  })
}

export default function TimeMachineSlider({
  timeline,
  selectedTs,
  onChangeTimestamp,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
}) {
  const { commits, minTs, maxTs, eventMarkers } = timeline
  const [snapMode, setSnapMode] = useState('COMMIT') // 'COMMIT' | 'CONTINUOUS'
  const [hoverMarker, setHoverMarker] = useState(null)
  const [activeToast, setActiveToast] = useState(null)
  const lastToastTsRef = useRef(0)

  // Derive tick marks (max 6-8 month/year labels across total span)
  const tickMarks = useMemo(() => {
    if (!minTs || !maxTs || minTs === maxTs) return []
    const count = 6
    const step = (maxTs - minTs) / count
    const ticks = []
    for (let i = 0; i <= count; i++) {
      ticks.push(minTs + i * step)
    }
    return ticks
  }, [minTs, maxTs])

  // Current commit index
  const currentCommitIndex = useMemo(() => {
    if (!commits || commits.length === 0) return 0
    let idx = 0
    for (let i = 0; i < commits.length; i++) {
      if (commits[i].timestamp <= selectedTs) idx = i
      else break
    }
    return idx
  }, [commits, selectedTs])

  // Playback step interval logic
  useEffect(() => {
    if (!isPlaying || !commits || commits.length === 0) return

    const baseMs = 1200 / playbackSpeed
    const interval = setInterval(() => {
      const nextIdx = currentCommitIndex + 1
      if (nextIdx < commits.length) {
        const nextTs = commits[nextIdx].timestamp
        onChangeTimestamp(nextTs)

        // Check if crossing an event marker to show toast overlay
        const matchedMarker = eventMarkers.find(m => m.commitSha === commits[nextIdx].sha)
        if (matchedMarker && matchedMarker.timestamp !== lastToastTsRef.current) {
          lastToastTsRef.current = matchedMarker.timestamp
          setActiveToast(matchedMarker)
          setTimeout(() => setActiveToast(null), 2500)
        }
      } else {
        onTogglePlay(false) // stop at HEAD
      }
    }, baseMs)

    return () => clearInterval(interval)
  }, [isPlaying, commits, currentCommitIndex, playbackSpeed, eventMarkers, onChangeTimestamp, onTogglePlay])

  // Handle slider drag change
  const handleSliderChange = useCallback((e) => {
    const rawVal = parseFloat(e.target.value)

    if (snapMode === 'COMMIT' && commits && commits.length > 0) {
      // Find nearest commit timestamp
      let nearest = commits[0]
      let minDiff = Math.abs(commits[0].timestamp - rawVal)
      for (let i = 1; i < commits.length; i++) {
        const diff = Math.abs(commits[i].timestamp - rawVal)
        if (diff < minDiff) {
          minDiff = diff
          nearest = commits[i]
        }
      }
      onChangeTimestamp(nearest.timestamp)
    } else {
      onChangeTimestamp(rawVal)
    }
  }, [snapMode, commits, onChangeTimestamp])

  // Quick navigation handlers
  const handleNavBeginning = () => minTs && onChangeTimestamp(minTs)
  const handleNavLatest = () => maxTs && onChangeTimestamp(maxTs)
  const handleNavPrevCommit = () => {
    if (currentCommitIndex > 0) onChangeTimestamp(commits[currentCommitIndex - 1].timestamp)
  }
  const handleNavNextCommit = () => {
    if (currentCommitIndex < commits.length - 1) onChangeTimestamp(commits[currentCommitIndex + 1].timestamp)
  }

  const pct = useMemo(() => {
    if (!minTs || !maxTs || maxTs === minTs) return 100
    return Math.min(100, Math.max(0, ((selectedTs - minTs) / (maxTs - minTs)) * 100))
  }, [selectedTs, minTs, maxTs])

  return (
    <div className="glass rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl relative overflow-visible">
      {/* Toast Event Overlay */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl glass-strong border border-[var(--theme-bright)] text-xs font-semibold text-white shadow-2xl flex items-center gap-2 pointer-events-none"
            style={{ background: 'var(--theme-surface-elevated)', boxShadow: '0 0 20px rgba(0,230,118,0.3)' }}
          >
            <span className="text-base">{activeToast.icon}</span>
            <span className="font-bold text-[var(--theme-bright)] uppercase tracking-wider">{activeToast.label}:</span>
            <span className="text-white/80">{activeToast.description}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Play & Speed Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onTogglePlay(!isPlaying)}
            className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg"
            style={{
              background: isPlaying
                ? 'rgba(255,82,82,0.2)'
                : 'linear-gradient(135deg, var(--theme-primary), var(--theme-bright))',
              color: isPlaying ? '#ff5252' : '#fff',
              border: isPlaying ? '1px solid #ff5252' : 'none',
              boxShadow: isPlaying ? 'none' : '0 0 15px rgba(0, 230, 118, 0.25)',
            }}
          >
            <span className="text-sm">{isPlaying ? '⏸' : '▶'}</span>
            {isPlaying ? 'Pause Playback' : 'Play Time Machine'}
          </button>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl glass bg-black/20 border border-white/5">
            {[0.5, 1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold font-mono transition-all"
                style={{
                  background: playbackSpeed === s ? 'var(--theme-surface-elevated)' : 'transparent',
                  color: playbackSpeed === s ? 'var(--theme-bright)' : 'rgba(255,255,255,0.45)',
                  border: playbackSpeed === s ? '1px solid var(--theme-border-hover)' : '1px solid transparent',
                }}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Snap Mode & Quick Nav */}
        <div className="flex items-center gap-2">
          {/* Snap Mode Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl glass bg-black/20 border border-white/5 text-xs">
            {['COMMIT', 'CONTINUOUS'].map(m => (
              <button
                key={m}
                onClick={() => setSnapMode(m)}
                className="px-2.5 py-1 rounded-lg font-semibold transition-all"
                style={{
                  background: snapMode === m ? 'var(--theme-surface-elevated)' : 'transparent',
                  color: snapMode === m ? 'var(--theme-bright)' : 'rgba(255,255,255,0.45)',
                  border: snapMode === m ? '1px solid var(--theme-border-hover)' : '1px solid transparent',
                }}
              >
                {m} Snap
              </button>
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-1">
            <button onClick={handleNavBeginning} className="px-2 py-1 rounded-lg glass text-xs text-white/70 hover:text-white" title="Beginning">|←</button>
            <button onClick={handleNavPrevCommit} className="px-2 py-1 rounded-lg glass text-xs text-white/70 hover:text-white" title="Previous Commit">←</button>
            <button onClick={handleNavNextCommit} className="px-2 py-1 rounded-lg glass text-xs text-white/70 hover:text-white" title="Next Commit">→</button>
            <button onClick={handleNavLatest} className="px-2 py-1 rounded-lg glass text-xs text-white/70 hover:text-white" title="Latest HEAD">→|</button>
          </div>
        </div>
      </div>

      {/* Main Slider Track */}
      <div className="relative pt-6 pb-4">
        {/* Track Line */}
        <div className="h-2 w-full rounded-full bg-white/10 relative">
          {/* Filled Progress Line */}
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--theme-primary), var(--theme-bright))',
              boxShadow: '0 0 10px var(--theme-glow)',
            }}
          />

          {/* Event Markers on Slider */}
          {eventMarkers.map((m) => {
            if (!minTs || !maxTs || maxTs === minTs) return null
            const mPct = ((m.timestamp - minTs) / (maxTs - minTs)) * 100
            return (
              <div
                key={m.id}
                onClick={() => onChangeTimestamp(m.timestamp)}
                onMouseEnter={() => setHoverMarker(m)}
                onMouseLeave={() => setHoverMarker(null)}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer transition-transform hover:scale-125 z-10"
                style={{ left: `${mPct}%` }}
              >
                <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] shadow"
                     style={{ background: 'var(--theme-bright)', color: '#000' }}>
                  {m.icon}
                </div>
              </div>
            )
          })}
        </div>

        {/* HTML Input Range Overlay */}
        <input
          type="range"
          min={minTs || 0}
          max={maxTs || 100}
          step={snapMode === 'CONTINUOUS' ? 86400 : 1}
          value={selectedTs || minTs || 0}
          onChange={handleSliderChange}
          className="absolute top-6 left-0 w-full h-2 opacity-0 cursor-pointer z-20"
        />

        {/* Event Marker Tooltip */}
        {hoverMarker && (
          <div
            className="absolute bottom-full mb-3 z-40 glass-strong rounded-xl p-2.5 shadow-2xl border border-white/10 text-left w-56 pointer-events-none -translate-x-1/2"
            style={{
              left: `${((hoverMarker.timestamp - minTs) / (maxTs - minTs)) * 100}%`,
              background: 'var(--theme-surface-elevated)',
            }}
          >
            <div className="font-bold text-white text-xs flex items-center gap-1.5">
              <span>{hoverMarker.icon}</span> {hoverMarker.label}
            </div>
            <div className="text-[11px] text-white/50 font-mono mt-0.5">{fmtDate(hoverMarker.timestamp)}</div>
            <p className="text-[11px] text-white/70 mt-1">{hoverMarker.description}</p>
          </div>
        )}

        {/* Month/Year Axis Labels */}
        <div className="flex justify-between text-[11px] font-mono text-white/40 mt-3 px-1">
          {tickMarks.map((t, idx) => (
            <span key={idx}>{fmtMonthYear(t)}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
