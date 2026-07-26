import React, { useState } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'

const EXAMPLES = [
  { label: 'Small', key: 'example:small' },
  { label: 'Medium', key: 'example:medium' },
  { label: 'Large', key: 'example:large' },
]

export default function RepoInput({ onResult, setLoading, setError }) {
  const [repoUrl, setRepoUrl] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [fetching, setFetching] = useState(false)

  const doFetch = async (url) => {
    setError(null)
    setLoading(true)
    setFetching(true)
    try {
      const r = await axios.post('https://commit-canvas-api.onrender.com/api/repo/fetch', { repoUrl: url })
      const data = r.data.data
      if (!data || !data.commits || !Array.isArray(data.commits)) {
        setError('Failed to fetch or parse repository commits')
        return
      }
      onResult(data)
    } catch (err) {
      console.error(err)
      setError(
        typeof err?.response?.data?.error === 'string'
          ? err.response.data.error
          : err?.message || 'Something went wrong'
      )
    } finally {
      setLoading(false)
      setFetching(false)
    }
  }

  const handleFetch = (e) => {
    e.preventDefault()
    if (!repoUrl.trim()) return
    doFetch(repoUrl.trim())
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleFetch} className="flex-1 flex gap-2">
          <div className="flex-1 relative flex items-center rounded-xl transition-all duration-200"
            style={{ 
              background: 'var(--theme-bg-secondary)', 
              border: '1px solid var(--theme-border)',
              boxShadow: isFocused ? '0 0 0 2px var(--theme-glow)' : 'none',
              borderColor: isFocused ? 'var(--theme-primary)' : 'var(--theme-border)'
            }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/25 ml-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            <input
              id="repo-url-input"
              type="text"
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/20 text-sm px-3 py-2.5 font-mono"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            {repoUrl && (
              <button type="button" onClick={() => setRepoUrl('')} className="mr-2 text-white/20 hover:text-white/50 transition-colors">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <button
            id="repo-fetch-btn"
            type="submit"
            disabled={fetching || !repoUrl.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fetching ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.25} />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
                </svg>
                <span>Fetching…</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span>Visualize</span>
              </>
            )}
          </button>
        </form>

        {/* Example buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/25 hidden sm:block flex-shrink-0">Try:</span>
          {EXAMPLES.map(ex => (
            <button
              key={ex.key}
              id={`example-${ex.label.toLowerCase()}`}
              onClick={() => doFetch(ex.key)}
              disabled={fetching}
              className="btn-ghost text-xs disabled:opacity-50"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
