import { Component, type ReactNode } from 'react';

/**
 * Catches render/runtime errors in a subtree so one crashing screen (e.g. the map) can't blank the
 * whole app. Shows the error text on screen — useful for diagnosing production-only crashes — plus a
 * way back. `onBack` lets the host return to a safe screen (Home).
 */
type Props = { children: ReactNode; onBack?: () => void; label?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface it in the console too (shows up in remote logs / devtools).
    console.error('[ErrorBoundary]', this.props.label || '', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        dir="rtl"
        style={{
          position: 'fixed', inset: 0, zIndex: 300, background: '#F3EFE9',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 14, padding: 24, textAlign: 'center', fontFamily: 'Heebo, sans-serif',
        }}
      >
        <div style={{ fontSize: 40 }}>😕</div>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#1C1917', margin: 0 }}>משהו השתבש במסך הזה</p>
        <p style={{ fontSize: 12.5, color: '#B91C1C', maxWidth: 320, direction: 'ltr', wordBreak: 'break-word', lineHeight: 1.4 }}>
          {error.message || String(error)}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          {this.props.onBack && (
            <button
              onClick={() => { this.setState({ error: null }); this.props.onBack?.(); }}
              style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', color: '#fff', fontWeight: 800, fontSize: 14, padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer' }}
            >
              חזרה לבית
            </button>
          )}
          <button
            onClick={() => this.setState({ error: null })}
            style={{ background: '#fff', color: '#374151', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 12, border: '1px solid #E5E7EB', cursor: 'pointer' }}
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }
}
