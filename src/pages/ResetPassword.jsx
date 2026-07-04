// frontend/src/pages/ResetPassword.jsx
// ATAC Global CX — self-service password reset · set-new-password step  ·  Vault Design System v4
//
// Public route: /reset-password?token=…
//
// Contract:
//   - POST /api/auth/reset-password { token, newPassword }
//   - Success → navigate('/login', { state: { flash: 'Password updated. Please sign in.' } })
//     No auto-login: we never store a session token here.
//   - Missing token → invalid/expired state with a link to /forgot-password.
//   - Any error → generic message + "Request a new link".
//
// SECURITY:
//   - The token is read once into component state and then STRIPPED from the URL
//     via history.replaceState so it never persists in history / referrer.
//   - The token is never logged, never persisted (no localStorage), never sent
//     to analytics. It exists only in memory until the request is made.
//   - /reset-password is served with `Referrer-Policy: no-referrer` (vercel.json);
//     a matching <meta> is injected here as defense-in-depth.
//
// Styling is byte-identical to Login.jsx via the shared ./auth/authStyles tokens
// and injector. Shell/Card/Field are reused from ForgotPassword.jsx.

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { injectAuthStyles, MUTED, RED } from './auth/authStyles';
import { PageShell, Card, Field } from './ForgotPassword';

const API_BASE =
  import.meta.env.VITE_API_URL || 'https://atac-backend-production.up.railway.app';

// Capture the token from the URL synchronously, before any effect runs, so a
// re-render never re-reads a URL we are about to strip.
function readTokenFromUrl() {
  if (typeof window === 'undefined') return '';
  try {
    return new URLSearchParams(window.location.search).get('token') || '';
  } catch {
    return '';
  }
}

export default function ResetPassword() {
  injectAuthStyles();
  const navigate = useNavigate();

  const [token] = useState(readTokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false); // request rejected → offer a new link

  // Strip the token from the URL + set a no-referrer meta as soon as we mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (!document.querySelector('meta[name="referrer"]')) {
      const meta = document.createElement('meta');
      meta.name = 'referrer';
      meta.content = 'no-referrer';
      document.head.appendChild(meta);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFailed(false);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      if (res.ok) {
        // No auto-login — send them to sign in with a one-time flash.
        navigate('/login', { state: { flash: 'Password updated. Please sign in.' } });
        return;
      }
      setError('This reset link is invalid or has expired.');
      setFailed(true);
    } catch {
      setError('Something went wrong. Please request a new reset link.');
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  // No token in the URL → dead-end state with a path back to request one.
  if (!token) {
    return (
      <PageShell>
        <Card kicker="Link expired" heading="This link is invalid.">
          <p style={{ fontSize: 14, lineHeight: 1.6, color: MUTED, margin: '0 0 28px' }}>
            This password reset link is invalid or has expired. Request a new one
            and we’ll email you a fresh link.
          </p>
          <Link
            to="/forgot-password"
            className="atac-cta"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}
          >
            Request a new link
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card kicker="Credential Portal" heading="Set a new password.">
        <p style={{ fontSize: 14, lineHeight: 1.6, color: MUTED, margin: '0 0 28px' }}>
          Choose a new password for your account. Must be at least 8 characters.
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <Field label="New Password">
            <input
              type="password"
              className="atac-input"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
            />
          </Field>
          <Field label="Confirm Password">
            <input
              type="password"
              className="atac-input"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>

          {error && (
            <div
              role="alert"
              style={{
                margin: '12px 0 16px',
                padding: '12px 14px',
                background: 'rgba(224,92,82,0.08)',
                border: '1px solid rgba(224,92,82,0.35)',
                borderRadius: 3,
                color: RED,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {error}
              {failed && (
                <>
                  {' '}
                  <Link to="/forgot-password" className="atac-link" style={{ textDecoration: 'none' }}>
                    Request a new link
                  </Link>
                </>
              )}
            </div>
          )}

          <button
            type="submit"
            className="atac-cta"
            disabled={submitting}
            style={{ marginTop: 8 }}
          >
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </Card>
    </PageShell>
  );
}
