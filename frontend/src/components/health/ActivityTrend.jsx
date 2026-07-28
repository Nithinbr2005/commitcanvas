import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'

export default function ActivityTrend({ dailyCounts }) {
  const [period, setPeriod] = useState('30D')

  // Filter and aggregate data based on selected period
  const chartData = useMemo(() => {
    if (!dailyCounts || dailyCounts.length === 0) return []

    // Sort by date just in case
    const sorted = [...dailyCounts].sort((a, b) => a.date.localeCompare(b.date))
    
    let daysToKeep = 30
    if (period === '7D') daysToKeep = 7
    if (period === '90D') daysToKeep = 90
    if (period === 'ALL') daysToKeep = 9999

    // Get the most recent date in the dataset (or today, but dataset's max is better)
    const lastDateObj = new Date(sorted[sorted.length - 1].date)
    
    // We want to generate the last `daysToKeep` dates to ensure empty days are represented
    const results = []
    const actualDaysToKeep = period === 'ALL' ? sorted.length : daysToKeep // simplify ALL

    if (period === 'ALL') {
      return sorted // just return all available data
    }

    for (let i = actualDaysToKeep - 1; i >= 0; i--) {
      const d = new Date(lastDateObj.getTime() - i * 86400000)
      const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
      
      const existing = sorted.find(s => s.date === dateKey)
      results.push({
        date: dateKey,
        count: existing ? existing.count : 0
      })
    }

    return results
  }, [dailyCounts, period])

  if (!dailyCounts || dailyCounts.length === 0) return null

  const maxCount = Math.max(1, ...chartData.map(d => d.count))

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">
          Activity Trend
        </h3>
        <div className="flex gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
          {['7D', '30D', '90D', 'ALL'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                period === p 
                  ? 'bg-white/20 text-white' 
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="h-16 flex items-end gap-1 w-full justify-between">
        {chartData.map((day, idx) => {
          const heightPct = (day.count / maxCount) * 100
          
          return (
            <div 
              key={day.date} 
              className="flex-1 flex flex-col justify-end items-center group relative h-full"
            >
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, heightPct)}%` }}
                transition={{ duration: 0.5, delay: idx * 0.01 }}
                className="w-full bg-white/20 rounded-t-sm group-hover:bg-[var(--theme-primary)] transition-colors"
              />
              
              {/* Tooltip */}
              <div className="absolute -top-8 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 border border-white/10">
                {day.count} commits
                <br/>
                <span className="text-white/50">{day.date}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
