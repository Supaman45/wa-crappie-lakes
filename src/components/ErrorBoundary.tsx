import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

/** Last line of defense: show what broke and a reload button instead of a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string }) { console.error('App crashed', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="gate">
        <div className="card">
          <h1>Something broke</h1>
          <div className="note" style={{ margin: '10px 0' }}>{String(this.state.error.message || this.state.error)}</div>
          <div className="row">
            <button className="btn primary" onClick={() => location.reload()}>Reload</button>
            <button className="btn" onClick={async () => { try { const regs = await navigator.serviceWorker?.getRegistrations(); for (const r of regs || []) await r.unregister(); const keys = await caches.keys(); for (const k of keys) await caches.delete(k); } catch { /* ignore */ } location.reload(); }}>Clear cache and reload</button>
          </div>
        </div>
      </div>
    );
  }
}
