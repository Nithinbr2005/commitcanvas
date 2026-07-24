import React, { useState } from 'react'
import RepoInput from './components/RepoInput'
import Visualizer from './components/Visualizer'
import PlaybackControls from './components/PlaybackControls'
import ErrorBoundary from './components/ErrorBoundary'
import CommitList from './components/CommitList'

export default function App() {
  const [parsedData, setParsedData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold">CommitCanvas</h1>
          <div className="text-sm text-slate-400">Living Git History Visualizer (Scaffold)</div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto p-6">
        <RepoInput onResult={(data) => setParsedData(data)} setLoading={setLoading} setError={setError} />

        {loading && <div className="mt-6 text-slate-400">Loading parsed repo data...</div>}
        {error && <div className="mt-6 text-red-400">Error: {error}</div>}

        {parsedData ? (
          <>
            <ErrorBoundary>
              <Visualizer parsed={parsedData} />
              <div className="mt-4">
                <PlaybackControls parsed={parsedData} />
              </div>
              <div className="mt-4">
                <CommitList parsed={parsedData} />
              </div>
            </ErrorBoundary>
          </>
        ) : (
          <div className="mt-8 text-slate-500">Paste a GitHub URL or try an example to begin.</div>
        )}
      </main>

      <footer className="p-4 text-slate-500 text-sm border-t border-slate-800 text-center">Scaffold demo — full features to be implemented</footer>
    </div>
  )
}
