import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { generateEngineeringInsights } from '../analytics/fileAnalytics'

export default function EngineeringInsights({ parsedData, onViewEvolution }) {
  const insights = useMemo(() => {
    if (!parsedData) return []
    return generateEngineeringInsights(parsedData)
  }, [parsedData])

  if (!insights || insights.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-white/40">
        No engineering observations could be derived from the loaded repository history.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="glass rounded-2xl p-5 border border-white/6">
        <h2 className="text-lg font-bold text-white">Repository Observations & Insights</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Factual, evidence-based observations derived from recorded commit and file-touch activity.
        </p>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {insights.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ y: -3 }}
            className="glass rounded-2xl p-6 border border-white/6 flex flex-col justify-between transition-all group"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
            }}
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl p-2 rounded-xl bg-white/5 border border-white/10">{item.icon}</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider text-[var(--theme-bright)] bg-[var(--theme-primary)]15 border border-[var(--theme-primary)]30">
                    {item.title}
                  </span>
                </div>
              </div>

              <div className="font-mono text-lg font-bold text-white mb-2 break-all group-hover:text-[var(--theme-bright)] transition-colors">
                {item.subject}
              </div>

              <p className="text-xs text-white/60 leading-relaxed mb-6">
                {item.description}
              </p>
            </div>

            <div className="pt-4 border-t border-white/6 flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-[var(--theme-bright)] px-2.5 py-1 rounded bg-black/20 border border-white/5">
                {item.metric}
              </span>

              {item.targetFile && onViewEvolution && (
                <button
                  onClick={() => onViewEvolution(item.targetFile)}
                  className="text-xs font-semibold text-white/70 hover:text-white flex items-center gap-1 transition-colors underline"
                >
                  Inspect File →
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
        <p className="text-[11px] text-white/40">
          ℹ Note: Observations reflect only the recorded metadata within the loaded commit history. Actual code ownership or engineering quality cannot be inferred from commit frequency alone.
        </p>
      </div>
    </div>
  )
}
