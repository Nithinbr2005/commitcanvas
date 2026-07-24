import React, { useState } from 'react'
import axios from 'axios'

export default function RepoInput({ onResult, setLoading, setError }) {
  const [repoUrl, setRepoUrl] = useState('')

  const tryExample = (key) => {
    setError(null)
    setLoading(true)
    axios.post('https://commit-canvas-api.onrender.com/api/repo/fetch', { repoUrl: key })
      .then(r => {
        onResult(r.data.data)
      })
      .catch(e => {
        console.error(e)
        setError(e?.response?.data?.error || e.message)
      })
      .finally(() => setLoading(false))
  }

  const handleFetch = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const r = await axios.post('https://commit-canvas-api.onrender.com/api/repo/fetch', { repoUrl: repoUrl.trim() })
      const data = r.data.data
      if (!data || !data.commits || !Array.isArray(data.commits)) {
        setError('Failed to fetch or parse repository commits')
        return
      }
      onResult(data)
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[var(--panel)] p-4 rounded-md">
      <form onSubmit={handleFetch} className="flex gap-2">
        <input className="flex-1 p-2 bg-transparent border border-slate-700 rounded text-sm" placeholder="https://github.com/owner/repo or example:small" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
        <button type="submit" className="px-3 py-1 bg-[var(--accent)] rounded text-sm">Fetch</button>
      </form>

      <div className="mt-3 flex gap-2">
        <button className="px-3 py-1 rounded bg-slate-700 text-sm" onClick={() => tryExample('example:small')}>Try small example</button>
        <button className="px-3 py-1 rounded bg-slate-700 text-sm" onClick={() => tryExample('example:medium')}>Try medium example</button>
        <button className="px-3 py-1 rounded bg-slate-700 text-sm" onClick={() => tryExample('example:large')}>Try large example</button>
      </div>
    </div>
  )
}
