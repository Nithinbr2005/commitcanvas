import React, { useEffect, useState } from 'react'
import { usePlayback } from '../store/usePlayback'

export default function PlaybackControls({ parsed }) {
  const playing = usePlayback((s) => s.playing)
  const time = usePlayback((s) => s.time)
  const speed = usePlayback((s) => s.speed)
  const duration = usePlayback((s) => s.duration)
  const setPlaying = usePlayback((s) => s.setPlaying)
  const setTime = usePlayback((s) => s.setTime)
  const setSpeed = usePlayback((s) => s.setSpeed)
  const setDuration = usePlayback((s) => s.setDuration)

  const [minTs, setMinTs] = useState(0)
  const [maxTs, setMaxTs] = useState(1)

  useEffect(() => {
    if (!parsed) return
    const commits = parsed.commits || []
    if (commits.length === 0) return
    const sorted = [...commits].sort((a,b)=>a.timestamp-b.timestamp)
    const min = sorted[0].timestamp
    const max = sorted[sorted.length-1].timestamp
    setMinTs(min)
    setMaxTs(max)
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
        const delta = dt * speed
        const newTime = Math.min((time + delta), duration)
        setTime(newTime)
        if (newTime >= duration) setPlaying(false)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, time, duration, setTime, setPlaying])

  const onSlider = (e) => {
    const v = Number(e.target.value)
    setTime(v)
  }

  const onSpeed = (e) => setSpeed(Number(e.target.value))

  return (
    <div className="mt-4 p-3 bg-[var(--panel)] rounded-md flex items-center gap-4">
      <button onClick={() => setPlaying(!playing)} className="px-3 py-1 bg-slate-700 rounded">{playing ? 'Pause' : 'Play'}</button>

      <div className="flex-1">
        <input type="range" min={0} max={duration} value={time} onChange={onSlider} className="w-full" />
        <div className="flex justify-between text-xs text-slate-400">
          <div>{new Date((minTs + Math.floor(time)) * 1000).toISOString().split('T')[0]}</div>
          <div>{new Date((minTs + Math.ceil(time)) * 1000).toISOString().split('T')[0]}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-slate-400 text-xs">Speed</label>
        <select value={speed} onChange={onSpeed} className="bg-slate-800 rounded p-1 text-sm">
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
          <option value={8}>8x</option>
        </select>
      </div>

      <div className="text-slate-400 text-xs">{Math.floor(time)}s / {Math.floor(duration)}s</div>
    </div>
  )
}
