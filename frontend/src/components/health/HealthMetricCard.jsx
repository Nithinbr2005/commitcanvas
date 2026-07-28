import React from 'react'
import { motion } from 'framer-motion'

export default function HealthMetricCard({ title, metric }) {
  if (!metric.available) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2 opacity-60">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-white/80">{title}</span>
          <span className="text-xs text-white/40">Not enough data</span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden" />
      </div>
    )
  }

  const { score } = metric

  let statusText = 'Poor'
  let color = '#ff1744'
  if (score >= 90) { statusText = 'Excellent'; color = '#00e676' }
  else if (score >= 75) { statusText = 'Healthy'; color = 'var(--theme-primary)' }
  else if (score >= 60) { statusText = 'Moderate'; color = '#ffd740' }
  else if (score >= 40) { statusText = 'Needs Attention'; color = '#ff5252' }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2 hover:bg-white/10 transition-colors">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-white/90">{title}</span>
        <span className="text-sm font-mono font-bold" style={{ color }}>{score}%</span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden relative">
        <motion.div 
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${score}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      
      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: `${color}cc` }}>
        {statusText}
      </div>
    </div>
  )
}
