// frontend/src/pages/ForgotPassword.jsx
// ATAC Global CX — self-service password reset · request step  ·  Vault Design System v4
//
// Public route: /forgot-password
//
// Contract:
//   - POST /api/auth/forgot-password { email }
//   - ALWAYS renders the same confirmation regardless of 2xx / 4xx / network
//     outcome. No account-existence leak, no error state. The request is
//     fire-and-forget; the UI never branches on its result.
//
// Styling is byte-identical to Login.jsx via the shared ./auth/authStyles tokens
// and injector (`.atac-input` / `.atac-cta` / `.atac-link` / `.vault-up-*`).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import brandLogo from '../assets/atac-globalcx-logo-header.png';
import {
  injectAuthStyles,
  BG, BG1, BG2, GOLD, WHITE, MUTED, BORDER,
  VAULT_DISPLAY, VAULT_BODY,
} from './auth/authStyles';

const API_BASE =
  import.meta.env.VITE_API_URL || 'https://atac-backend-production.up.railway.app';

const PAGE_BG_IMAGE = `
  radial-gradient(900px 500px at 80% -10%, rgba(201,168,76,0.05), transparent 60%),
  radial-gradient(800px 500px at -10% 110%, rgba(26,143,105,0.04), transparent 60%)
`;

export default function ForgotPassword() {
  injectAuthStyles();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Show the confirmation immediately and identically for every outcome, then
    // fire the request in the background. We deliberately ignore the response —
    // success, 4xx, and network errors must be indistinguishable to the caller.
    setSubmitted(true);
    try {
      fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {});
    } catch {
      /* swallow — never surface request outcome */
    }
  };

  return (
    <PageShell>
      <Card kicker={submitted ? 'Check your inbox' : 'Credential Portal'}
            heading={submitted ? 'Link on its way.' : 'Reset your password.'}>
        {submitted ? (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: MUTED, margin: '0 0 28px' }}>
              If an account exists for that email, a reset link is on its way.
              Check your inbox.
            </p>
            <Link
              to="/login"
              className="atac-cta"
              style={{
                display: 'block',
                textAlign: 'center',
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: MUTED, margin: '0 0 28px' }}>
              Enter the email associated with your account and we’ll send a link
              to reset your password.
            </p>
            <form onSubmit={handleSubmit} noValidate>
              <Field label="Email Address">
                <input
                  type="email"
                  className="atac-input"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  maxLength={254}
                />
              </Field>
              <button type="submit" className="atac-cta" style={{ marginTop: 8 }}>
                Send reset link
              </button>
            </form>
            <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', margin: '20px 0 0' }}>
              Remembered it?{' '}
              <Link to="/login" className="atac-link" style={{ textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </Card>
    </PageShell>
  );
}

/* ── Shared shell + card (inlined; styling copied from Login.jsx) ───────── */
export function PageShell({ children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: WHITE,
        fontFamily: VAULT_BODY,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '56px 24px 64px',
        backgroundImage: PAGE_BG_IMAGE,
      }}
    >
      <div className="vault-up-1" style={{ marginBottom: 40 }}>
        <a href="https://atacglobalcx.com" style={{ display: 'inline-block', textDecoration: 'none' }}>
          <img src={brandLogo} alt="ATAC Global CX" style={{ height: 72, width: 'auto', display: 'block' }} />
        </a>
      </div>
      {children}
    </div>
  );
}

export function Card({ kicker, heading, children }) {
  return (
    <div
      className="vault-up-2"
      style={{
        width: '100%',
        maxWidth: 480,
        background: `linear-gradient(180deg, ${BG1} 0%, ${BG2} 100%)`,
        border: `1px solid ${BORDER}`,
        borderRadius: 4,
        padding: '40px 44px 40px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: GOLD,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        {kicker}
      </div>
      <h2
        style={{
          fontFamily: VAULT_DISPLAY,
          fontSize: 38,
          lineHeight: 1.1,
          fontWeight: 400,
          margin: '0 0 20px',
          color: WHITE,
          letterSpacing: '-0.01em',
        }}
      >
        {heading}
      </h2>
      {children}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'block',
          fontFamily: VAULT_BODY,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: MUTED,
          marginBottom: 10,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
