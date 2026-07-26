import React from 'react'

/**
 * SkeletonCard
 * Lightweight placeholder card for metrics and stats.
 */
export function SkeletonCard({ height = 110, className = '' }) {
  return (
    <div
      className={`glass rounded-2xl p-4 border border-white/6 animate-pulse ${className}`}
      style={{ height, background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="w-1/3 h-3 rounded bg-white/10 mb-3" />
      <div className="w-2/3 h-6 rounded bg-white/15 mb-2" />
      <div className="w-1/2 h-3 rounded bg-white/5" />
    </div>
  )
}

/**
 * SkeletonGraph
 * Placeholder for Git Graph canvas during loading.
 */
export function SkeletonGraph({ height = 480 }) {
  return (
    <div
      className="w-full rounded-2xl glass border border-white/6 p-6 flex flex-col justify-between animate-pulse relative overflow-hidden"
      style={{ height, background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex justify-between items-center">
        <div className="w-48 h-4 rounded bg-white/10" />
        <div className="w-24 h-4 rounded bg-white/10" />
      </div>

      {/* Simulated node connection skeleton */}
      <div className="flex items-center justify-around my-auto">
        <div className="w-8 h-8 rounded-full bg-[var(--theme-primary)] opacity-30" />
        <div className="w-20 h-0.5 bg-white/10" />
        <div className="w-10 h-10 rounded-full bg-[var(--theme-bright)] opacity-40" />
        <div className="w-20 h-0.5 bg-white/10" />
        <div className="w-8 h-8 rounded-full bg-[var(--theme-primary)] opacity-30" />
      </div>

      <div className="flex justify-between text-xs text-white/20">
        <div className="w-32 h-3 rounded bg-white/5" />
        <div className="w-24 h-3 rounded bg-white/5" />
      </div>
    </div>
  )
}

/**
 * EmptyState
 * Polished component for missing/empty history, metrics, or searches.
 */
export function EmptyState({
  icon = '📂',
  title = 'No Data Observed',
  description = 'No history or metadata recorded for this selection in the analyzed commits.',
  actionLabel,
  onAction,
}) {
  return (
    <div className="glass rounded-2xl p-8 sm:p-12 text-center border border-white/6 max-w-lg mx-auto my-6 space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mx-auto">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-white text-base">{title}</h3>
        <p className="text-xs text-white/50 mt-1 leading-relaxed max-w-sm mx-auto">{description}</p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-2">
          <button
            onClick={onAction}
            className="px-4 py-2 rounded-xl text-xs font-bold glass hover:bg-white/10 text-white border border-white/10"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  )
}
