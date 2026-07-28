import React from 'react'
import { motion } from 'framer-motion'

export default function HealthInsights({ insights }) {
  if (!insights || insights.length === 0) return null

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">
        Engineering Insights
      </h3>
      <div className="space-y-3">
        {insights.map((insight, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex items-start gap-3"
          >
            <div className="flex-shrink-0 mt-0.5">
              {insight.type === 'positive' && (
                <span style={{ color: '#00e676' }}>✓</span>
              )}
              {insight.type === 'negative' && (
                <span style={{ color: '#ffd740' }}>⚠</span>
              )}
              {insight.type === 'neutral' && (
                <span style={{ color: 'var(--theme-primary)' }}>•</span>
              )}
            </div>
            <div className="text-sm text-white/80 leading-relaxed">
              {insight.text}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
