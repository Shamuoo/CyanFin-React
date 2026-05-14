import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0a0804', color: '#f0e8d5', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32, fontFamily: 'monospace' }}>
          <div style={{ fontSize: 32, color: '#c9a84c', letterSpacing: '0.4em' }}>CYANFIN</div>
          <div style={{ color: '#e74c3c', fontSize: 14 }}>Application error</div>
          <pre style={{ color: 'rgba(240,232,213,0.5)', fontSize: 11, maxWidth: 600, overflow: 'auto', background: 'rgba(255,255,255,0.04)', padding: 16, borderRadius: 8 }}>
            {String(this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', background: '#c9a84c', color: '#0a0804', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 700 }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </ErrorBoundary>
)
