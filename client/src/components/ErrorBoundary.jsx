import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Last line of defence: if a screen throws while rendering, show a calm
 * message with a reload button instead of a blank window.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Screen error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center-screen">
        <div className="card" style={{ maxWidth: 460, padding: 28, textAlign: 'center' }}>
          <div className="stat-icon warning" style={{ margin: '0 auto 14px' }}>
            <AlertTriangle size={22} />
          </div>
          <h2>This screen had a problem</h2>
          <p className="muted mt-2">
            No data has been lost. Reload to continue working. If this keeps happening, please contact support.
          </p>
          <p className="mono muted small mt-2">{String(this.state.error?.message ?? '')}</p>
          <button className="btn btn-primary mt-3" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Reload
          </button>
        </div>
      </div>
    );
  }
}
