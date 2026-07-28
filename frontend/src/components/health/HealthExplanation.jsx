import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function HealthExplanation() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="mt-6">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-center text-xs text-white/40 hover:text-white/70 transition-colors uppercase tracking-widest font-bold py-3"
      >
        {isOpen ? 'Close Explanation ▲' : 'How is this calculated? ▼'}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-2 space-y-6 text-sm text-white/70">
              
              <div>
                <h4 className="text-white/90 font-bold mb-2">Overall Score Calculation</h4>
                <p>
                  The repository health score is deterministic and calculated exclusively from available Git history. 
                  It is heavily weighted towards consistent, active development practices.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white/90">Commit Activity</span>
                    <span className="text-xs font-mono text-white/50">25%</span>
                  </div>
                  <p className="text-xs">Based on total commits, commits per day, and recent activity levels.</p>
                </div>

                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white/90">Contributor Health</span>
                    <span className="text-xs font-mono text-white/50">20%</span>
                  </div>
                  <p className="text-xs">Evaluates contributor count and activity distribution. Solo projects are scored on consistent personal activity rather than team size.</p>
                </div>

                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white/90">Development Consistency</span>
                    <span className="text-xs font-mono text-white/50">20%</span>
                  </div>
                  <p className="text-xs">Looks for absence of large inactive periods and consistency of commit days.</p>
                </div>

                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white/90">Collaboration</span>
                    <span className="text-xs font-mono text-white/50">15%</span>
                  </div>
                  <p className="text-xs">Presence of branches, merge commits, and team collaboration patterns.</p>
                </div>

                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white/90">Code Change Health</span>
                    <span className="text-xs font-mono text-white/50">10%</span>
                  </div>
                  <p className="text-xs">Analyzes distribution of modified files to check for unusually massive commits.</p>
                </div>

                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white/90">Repository Momentum</span>
                    <span className="text-xs font-mono text-white/50">10%</span>
                  </div>
                  <p className="text-xs">Compares recent commit volume to the repository's historical median volume.</p>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-blue-200/80 text-xs">
                <strong>Note on unavailable data:</strong> If a metric cannot be calculated (e.g., missing file-change statistics), its weight is proportionally redistributed among the remaining available metrics to ensure a fair final score.
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
