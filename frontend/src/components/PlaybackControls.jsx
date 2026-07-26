import React, { useEffect, useState, useRef, useCallback } from 'react'
import { usePlayback } from '../store/usePlayback'

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateShort(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export default function PlaybackControls({ parsed, onCommitSelect }) {
  const playing    = usePlayback(s => s.playing)
  const time       = usePlayback(s => s.time)
  const speed      = usePlayback(s => s.speed)
  const duration   = usePlayback(s => s.duration)
  const setPlaying = usePlayback(s => s.setPlaying)
  const setTime    = usePlayback(s => s.setTime)
  const setSpeed   = usePlayback(s => s.setSpeed)
  const setDuration = usePlayback(s => s.setDuration)

  const [minTs, setMinTs] = useState(0)
  const [sorted, setSorted] = useState([])
  const [hovered, setHovered] = useState(null) // { commit, x }
  const trackRef = useRef(null)

  useEffect(() => {
    if (!parsed?.commits?.length) return
    const s = [...parsed.commits].sort((a, b) => a.timestamp - b.timestamp)
    setSorted(s)
    const min = s[0].timestamp
    const max = s[s.length - 1].timestamp
    setMinTs(min)
    setDuration(max - min)
    setTime(0)
  }, [parsed, setDuration, setTime])

  // Playback loop
  useEffect(() => {
    let raf = null
    let last = performance.now()
    function tick(now) {
      const dt = (now - last) / 1000
      last = now
      if (playing) {
        const cur = usePlayback.getState().time
        const newTime = Math.min(cur + dt * speed * (duration / Math.max(sorted.length, 1) * 4), duration)
        setTime(newTime)
        if (newTime >= duration) setPlaying(false)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, duration, sorted.length, setTime, setPlaying])

  const currentTs = minTs + time
  const activeIdx = sorted.reduce((acc, c, i) => c.timestamp <= currentTs ? i : acc, -1)

  // Click on track to scrub
  const onTrackClick = useCallback((e) => {
    if (!trackRef.current || !duration) return
    const rect = trackRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setTime(pct * duration)
    setPlaying(false)
  }, [duration, setTime, setPlaying])

  // Year labels
  const yearLabels = (() => {
    const seen = new Set()
    const labels = []
    for (const c of sorted) {
      const yr = new Date(c.timestamp * 1000).getFullYear()
      if (!seen.has(yr)) {
        seen.add(yr)
        const pct = (c.timestamp - minTs) / Math.max(duration, 1)
        labels.push({ year: yr, pct })
      }
    }
    return labels
  })()

  const progressPct = duration > 0 ? (time / duration) * 100 : 0

  // Limit dots shown to avoid performance hit
  const maxDots = 200
  const step = Math.max(1, Math.floor(sorted.length / maxDots))
  const dotCommits = sorted.filter((_, i) => i % step === 0)

  const speeds = [0.5, 1, 2, 4, 8]

  return (
    <div className="glass rounded-2xl px-5 py-4 space-y-3">
      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Skip to start */}
        <button
          onClick={() => { setTime(0); setPlaying(false) }}
          className="text-white/40 hover:text-white/80 transition-colors"
          title="Go to start"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
          </svg>
        </button>

        {/* Play / Pause */}
        <button
          id="playback-toggle-btn"
          onClick={() => setPlaying(!playing)}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
          style={{
            background: playing ? 'var(--theme-button)' : 'transparent',
            border: `1px solid ${playing ? 'transparent' : 'var(--theme-border-hover)'}`,
            boxShadow: playing ? '0 0 16px var(--theme-glow)' : 'none',
          }}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Skip to end */}
        <button
          onClick={() => { setTime(duration); setPlaying(false) }}
          className="text-white/40 hover:text-white/80 transition-colors"
          title="Go to end"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zm2-6 6-3.27v6.54L8 12zM16 6h2v12h-2z" />
          </svg>
        </button>

        {/* Speed */}
        <div className="flex items-center gap-1 ml-2">
          {speeds.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${
                speed === s
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-white/25 hover:text-white/50'
              }`}
              style={{
                background: speed === s ? 'var(--theme-surface-elevated)' : '',
                borderColor: speed === s ? 'var(--theme-border-hover)' : 'transparent',
                color: speed === s ? 'var(--theme-text-primary)' : ''
              }}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Current date */}
        <div className="ml-auto text-xs font-mono text-white/35">
          {sorted[activeIdx]
            ? formatDate(sorted[activeIdx].timestamp)
            : sorted[0] ? formatDate(sorted[0].timestamp) : '—'}
        </div>

        {/* Commit counter */}
        {activeIdx >= 0 && (
          <div className="text-xs text-white/25">
            #{activeIdx + 1} / {sorted.length}
          </div>
        )}
      </div>

      {/* Timeline track with dots */}
      <div className="relative select-none" style={{ paddingBottom: 20 }}>
        {/* Clickable track */}
        <div
          ref={trackRef}
          className="relative h-1 rounded-full cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          onClick={onTrackClick}
        >
          {/* Progress fill */}
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-none"
            style={{
              width: `${progressPct}%`,
              background: 'var(--theme-primary)',
              boxShadow: '0 0 8px var(--theme-glow)',
            }}
          />

          {/* Commit dots */}
          {dotCommits.map((c, i) => {
            const pct = duration > 0 ? ((c.timestamp - minTs) / duration) * 100 : 0
            const isPassed = c.timestamp <= currentTs
            const isActive = sorted[activeIdx]?.sha === c.sha
            return (
              <div
                key={c.sha}
                className="timeline-dot absolute -translate-y-1/2"
                style={{
                  left: `${pct}%`,
                  top: '50%',
                  marginLeft: -4,
                  borderColor: isPassed ? (isActive ? 'var(--theme-bright)' : 'var(--theme-primary)') : undefined,
                  background: isPassed ? (isActive ? 'var(--theme-bright)' : 'var(--theme-surface-elevated)') : undefined,
                  boxShadow: isActive ? '0 0 8px var(--theme-glow-strong)' : undefined,
                  transform: isActive ? 'translateY(-50%) scale(1.8)' : 'translateY(-50%)',
                }}
                title={`${c.author?.name || 'Unknown'} · ${formatDate(c.timestamp)}\n${c.message?.split('\n')[0]}`}
                onMouseEnter={e => setHovered({ commit: c, x: e.currentTarget.getBoundingClientRect().left })}
                onMouseLeave={() => setHovered(null)}
                onClick={e => {
                  e.stopPropagation()
                  setTime(c.timestamp - minTs)
                  setPlaying(false)
                  onCommitSelect?.(c)
                }}
              />
            )
          })}

          {/* Playhead */}
          <div
            className="absolute -translate-y-1/2 pointer-events-none"
            style={{
              left: `${progressPct}%`,
              top: '50%',
              width: 2,
              height: 16,
              marginLeft: -1,
              background: 'var(--theme-bright)',
              borderRadius: 2,
              boxShadow: '0 0 6px var(--theme-glow-strong)',
            }}
          />
        </div>

        {/* Year labels */}
        <div className="relative h-4 mt-2">
          {yearLabels.map(({ year, pct }) => (
            <div
              key={year}
              className="absolute text-xs font-mono text-white/20 -translate-x-1/2"
              style={{ left: `${pct * 100}%`, top: 0, fontSize: 10 }}
            >
              {year}
            </div>
          ))}
        </div>
      </div>

      {/* Hovered commit tooltip */}
      {hovered && (
        <div
          className="glass rounded-xl px-3 py-2 text-xs space-y-0.5 pointer-events-none"
          style={{ position: 'absolute', bottom: 80, left: 20, zIndex: 100, maxWidth: 200 }}
        >
          <div className="font-mono font-medium" style={{ color: 'var(--theme-bright)' }}>{hovered.commit.sha.slice(0, 7)}</div>
          <div className="text-white/70 truncate">{hovered.commit.message?.split('\n')[0]}</div>
          <div className="text-white/35">{hovered.commit.authorName} · {formatDate(hovered.commit.timestamp)}</div>
        </div>
      )}
    </div>
  )
}
