import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

class StartupErrorBoundary extends React.Component<React.PropsWithChildren, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || String(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Omachy failed to render:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <main style={{ minHeight: '100vh', padding: 24, background: '#0b1119', color: '#e5edf3', font: '14px/1.5 sans-serif' }}>
        <h1 style={{ fontSize: 18 }}>Omachy could not render this screen</h1>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#d6b77f' }}>{this.state.error}</pre>
        <p>Check the terminal that launched Omachy for the full error details.</p>
      </main>;
    }
    return this.props.children;
  }
}

window.addEventListener('error', (event) => {
  console.error('Omachy JavaScript error:', event.message, event.filename, event.lineno);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('Omachy unhandled promise rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><StartupErrorBoundary><App /></StartupErrorBoundary></React.StrictMode>
);
