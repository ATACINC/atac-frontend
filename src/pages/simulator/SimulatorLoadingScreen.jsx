/**
 * ATAC Platform - SimulatorLoadingScreen.jsx
 * Path: frontend/src/pages/simulator/SimulatorLoadingScreen.jsx
 *
 * Suspense fallback rendered while the lazy-loaded /simulator chunk
 * downloads. Vault-themed centered spinner. Kept intentionally tiny so it
 * adds zero meaningful weight to the main bundle.
 */

const BG    = '#080B12';
const GOLD  = '#C9A84C';
const MUTED = 'rgba(238,233,223,0.45)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

export default function SimulatorLoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: '#EEE9DF',
        fontFamily: VAULT_BODY,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          aria-hidden="true"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: `2px solid rgba(201,168,76,0.18)`,
            borderTopColor: GOLD,
            margin: '0 auto 18px',
            animation: 'sim-spin 0.9s linear infinite',
          }}
        />
        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Loading
        </div>
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 6 }}>
          ATAC Call Readiness Simulator
        </div>
      </div>
      <style>{`@keyframes sim-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
