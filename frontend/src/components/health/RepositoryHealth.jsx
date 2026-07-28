import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { calculateRepositoryHealth } from '../../analytics/healthAnalytics'
import HealthScore from './HealthScore'
import HealthMetricCard from './HealthMetricCard'
import HealthInsights from './HealthInsights'
import ActivityTrend from './ActivityTrend'
import HealthExplanation from './HealthExplanation'

export default function RepositoryHealth({ parsedData }) {
  // Memoize health calculation so it only runs when parsedData changes
  const healthData = useMemo(() => {
    return calculateRepositoryHealth(parsedData)
  }, [parsedData])

  if (!healthData || healthData.score === 0 && !healthData.metrics.commitActivity) {
    return (
      <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center text-white/50 mb-8">
        Not enough data to calculate repository health.
      </div>
    )
  }

  const { score, status, metrics, insights, activityTrend } = healthData

  // Define display order and titles for metrics
  const displayMetrics = [
    { key: 'commitActivity', title: 'Commit Activity' },
    { key: 'contributorHealth', title: 'Contributor Health' },
    { key: 'consistency', title: 'Development Consistency' },
    { key: 'collaboration', title: 'Collaboration' },
    { key: 'codeChangeHealth', title: 'Code Change Health' },
    { key: 'momentum', title: 'Repository Momentum' }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full mb-10"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 border border-white/20 text-white">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <h2 className="font-display font-bold text-xl text-white tracking-tight">
          Repository Health
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Score and Insights */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <HealthScore score={score} status={status} />
          
          <HealthInsights insights={insights} />
        </div>

        {/* Right Column: Metrics and Trends */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {displayMetrics.map(({ key, title }) => (
              <HealthMetricCard 
                key={key} 
                title={title} 
                metric={metrics[key]} 
              />
            ))}
          </div>

          <ActivityTrend dailyCounts={activityTrend} />
        </div>
      </div>

      <HealthExplanation />
      
    </motion.div>
  )
}
