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
        <div className="p-6 bg-red-900 text-white rounded">
          <h3 className="text-lg font-semibold">Something went wrong rendering the visualization</h3>
          <pre className="text-xs mt-2 whitespace-pre-wrap">{String(this.state.error)}</pre>
          <div className="mt-3">
            <button onClick={() => this.setState({ hasError: false, error: null })} className="px-3 py-1 bg-slate-700 rounded">Dismiss</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
