import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function HealthScore({ score, status }) {
  const [displayScore, setDisplayScore] = useState(0)

  useEffect(() => {
    let start = 0
    const duration = 1000 // 1s
    const startTime = performance.now()

    const animate = (time) => {
      const elapsed = time - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function: easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4)
      
      setDisplayScore(Math.floor(easeProgress * score))

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    requestAnimationFrame(animate)
  }, [score])

  // Map status to a color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Excellent': return '#00e676'
      case 'Healthy': return 'var(--theme-primary)'
      case 'Moderate': return '#ffd740'
      case 'Needs Attention': return '#ff5252'
      case 'Poor': return '#ff1744'
      default: return 'var(--theme-text-secondary)'
    }
  }

  const color = getStatusColor(status)

  // Calculate stroke dasharray for the SVG circle
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (displayScore / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-2xl border border-white/10 relative overflow-hidden">
      {/* Background Glow */}
      <div 
        className="absolute inset-0 opacity-20 blur-2xl" 
        style={{ background: `radial-gradient(circle at center, ${color}, transparent 60%)` }}
      />
      
      <div className="relative w-32 h-32 flex items-center justify-center mb-4">
        {/* Background Track */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 transform">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            fill="none"
          />
          {/* Animated Progress */}
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ strokeDasharray: circumference }}
          />
        </svg>
        
        {/* Score Text */}
        <div className="flex flex-col items-center justify-center relative z-10">
          <div className="flex items-baseline">
            <span className="text-4xl font-display font-bold text-white">{displayScore}</span>
          </div>
          <div className="text-xs text-white/50">/100</div>
        </div>
      </div>

      <div 
        className="text-sm font-bold tracking-widest uppercase"
        style={{ color }}
      >
        {status}
      </div>
    </div>
  )
}
