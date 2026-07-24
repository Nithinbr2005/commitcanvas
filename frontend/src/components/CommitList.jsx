import React from 'react'

export default function CommitList({ parsed }) {
  const commits = parsed?.commits || []
  return (
    <div className="mt-4 p-4 bg-[var(--panel)] rounded">
      <div className="text-sm text-slate-300 mb-2">Commit summary ({commits.length}) — fallback view</div>
      <ul className="text-slate-400 text-sm list-disc pl-5 max-h-48 overflow-auto">
        {commits.slice().reverse().map(c => (
          <li key={c.sha} className="mb-1">
            <div className="font-medium text-slate-200">{c.message.split('\n')[0]}</div>
            <div className="text-xs text-slate-400">{c.author?.name} • {new Date(c.timestamp*1000).toISOString().split('T')[0]}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
