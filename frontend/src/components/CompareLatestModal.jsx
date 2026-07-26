import React from 'react'
import { motion } from 'framer-motion'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function CompareLatestModal({ comparison, onClose }) {
  if (!comparison) return null

  const { current, latest, deltas } = comparison

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-strong rounded-2xl p-6 max-w-lg w-full border border-white/10 shadow-2xl space-y-6"
        style={{ background: 'var(--theme-surface-elevated)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <span>📊</span> Compare with Latest State
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              Differences between historical snapshot ({fmtDate(current.timestamp)}) and latest HEAD.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white glass hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Comparison Grid */}
        <div className="space-y-3">
          {/* Table Header */}
          <div className="grid grid-cols-3 text-xs font-semibold text-white/40 uppercase tracking-wider px-2">
            <span>Metric</span>
            <span className="text-center">{fmtDate(current.timestamp)}</span>
            <span className="text-right">Latest HEAD</span>
          </div>

          {/* Metric Rows */}
          {[
            { label: 'Commits', cur: current.commitsCount, lat: latest.commitsCount, delta: deltas.commits },
            { label: 'Contributors', cur: current.contributorsCount, lat: latest.contributorsCount, delta: deltas.contributors },
            { label: 'Files Observed', cur: current.observedFilesCount, lat: latest.observedFilesCount, delta: deltas.files },
            { label: 'Directories', cur: current.directoriesCount, lat: latest.directoriesCount, delta: deltas.directories },
            { label: 'Merges', cur: current.mergesCount, lat: latest.mergesCount, delta: deltas.merges },
          ].map((row, i) => (
            <div key={i} className="grid grid-cols-3 items-center py-2.5 px-3 rounded-xl glass border border-white/5 text-xs">
              <span className="font-medium text-white/80">{row.label}</span>
              <span className="text-center font-mono font-bold text-white">{row.cur}</span>
              <div className="text-right font-mono">
                <span className="font-bold text-white">{row.lat}</span>
                {row.delta > 0 && (
                  <span className="ml-1.5 text-[11px] font-semibold text-[var(--theme-bright)]">
                    (+{row.delta})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary Footer */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white/60 text-center font-mono">
          Observed growth: <strong className="text-[var(--theme-bright)]">+{deltas.commits} commits</strong>, <strong className="text-white">+{deltas.contributors} devs</strong>, <strong className="text-white">+{deltas.files} files</strong> since selected point.
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold glass hover:bg-white/10 text-white"
          >
            Close Comparison
          </button>
        </div>
      </motion.div>
    </div>
  )
}
