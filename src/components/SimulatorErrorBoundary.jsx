import { Component } from 'react';

/* Vault tokens (mirror the per-file convention) */
const BG    = '#080B12';
const BG1   = '#0C1018';
const GOLD  = '#C9A84C';
const RED   = '#C45C5C';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const BORDER = 'rgba(201,168,76,0.15)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

// Detects the class of failure where a lazy() chunk could not be fetched.
// Vite emits ChunkLoadError; some browsers surface as a TypeError with
// 'Failed to fetch dynamically imported module'. Stale index.html after a
// deploy is the dominant case. A full reload pulls a fresh index.html and
// resolves it deterministically.
function isChunkLoadError(error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const msg = String(error.message || '');
  return /Loading chunk|dynamically imported module|Importing a module script failed/i.test(msg);
}

export default class SimulatorErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Dev visibility. Production builds strip console in some configs but
    // keep .error per Vite default.
    console.error('[SimulatorErrorBoundary]', error, info);
    // Sentry hook: silent no-op until Sentry is integrated. When the
    // window.Sentry global exists (CDN init or @sentry/react), this fires.
    if (typeof window !== 'undefined' && window.Sentry && typeof window.Sentry.captureException === 'function') {
      try {
        window.Sentry.captureException(error, { extra: info });
      } catch (_) { /* never let telemetry break the UI */ }
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  handleDashboard = () => {
    if (typeof window !== 'undefined') window.location.assign('/dashboard');
  };

  render() {
    if (!this.state.error) return this.props.children;

    const chunkFailure = isChunkLoadError(this.state.error);
    const heading = chunkFailure
      ? 'A new version of the simulator is available'
      : 'Something went wrong starting the simulator';
    const body = chunkFailure
      ? 'Reload to fetch the latest version and continue. Your assessment progress is saved.'
      : 'We hit an unexpected error loading the simulator. Reload to try again, or return to your dashboard.';

    return (
      <div style={{
        minHeight: '100vh', background: BG, color: WHITE, fontFamily: VAULT_BODY,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div role="alert" style={{
          maxWidth: 480, background: BG1, border: `1px solid ${BORDER}`,
          borderRadius: 4, padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: RED, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14 }}>
            Simulator unavailable
          </div>
          <h2 style={{ fontFamily: VAULT_DISPLAY, fontSize: 22, fontWeight: 400, color: WHITE, margin: '0 0 12px', lineHeight: 1.2 }}>
            {heading}
          </h2>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, margin: '0 0 24px' }}>
            {body}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                background: GOLD, color: BG, border: 'none', borderRadius: 2,
                padding: '12px 22px', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
                fontFamily: VAULT_BODY,
              }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.handleDashboard}
              style={{
                background: 'transparent', color: WHITE, border: `1px solid ${BORDER}`,
                borderRadius: 2, padding: '11px 22px', fontSize: 11,
                letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
                fontFamily: VAULT_BODY,
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
