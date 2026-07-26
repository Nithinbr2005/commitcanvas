import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="p-6 rounded-2xl flex flex-col gap-3"
          style={{ background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.2)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-lg">⚠</span>
            <h3 className="font-display font-semibold text-white/80">Something went wrong rendering the visualization</h3>
          </div>
          <pre className="text-xs text-red-300/70 bg-black/20 rounded-xl p-3 overflow-auto whitespace-pre-wrap font-mono">
            {String(this.state.error)}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-ghost self-start"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
