// frontend/src/pages/Login.jsx
// ATAC Global CX — Login / Register page  ·  Vault Design System v3
// Routes:
//   /login                       → Sign In tab (default)
//   /login?action=register       → Register tab
//   /signup                      → Register tab (via SignupPage wrapper passing defaultAction="register")
//
// Functional contract (DO NOT BREAK):
//   - POST /api/auth/login            → { token, candidate } | employer redirect
//   - POST /api/auth/register         → { token, candidate } + termsAccepted/termsAcceptedAt
//   - localStorage.atac_token         → JWT
//   - localStorage.atac_candidate     → JSON candidate object
//   - Login redirects:
//       candidate.role === 'employer' → /employer
//       otherwise                     → /dashboard
//   - Register redirects → /payment
//   - Terms of Certification (v1.0) checkbox required before register
//
// v3 changes (May 2, 2026):
//   - Two-column desktop layout (brand pane + form card)
//   - Larger form fields, headings, labels, button text
//   - Header logo asset (atac-globalcx-logo-header.png)
//   - Certificate Authority seal (agcx-certificate-seal-cropped.png)
//   - Aligned with Verify.jsx / VerifyLanding.jsx / Dashboard visual language
//   - Email validation imported from shared utils/validation (single source of truth)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isValidEmail } from '../utils/validation';
import brandLogo from '../assets/atac-globalcx-logo-header.png';
import certificateSeal from '../assets/agcx-certificate-seal-cropped.png';

const API_BASE =
  import.meta.env.VITE_API_URL || 'https://atac-backend-production.up.railway.app';

const TERMS_VERSION = '1.0';
const TERMS_COPY =
  'I certify that I am the individual named above. I will personally complete all assessments. ' +
  'I understand that credential fraud voids my certification permanently and results in public ' +
  'revocation on the blockchain.';

/* ── Vault Design Tokens ─────────────────────────────────────────────── */
const BG       = '#080B12';
const BG1      = '#0C1018';
const BG2      = '#101520';
const GOLD     = '#C9A84C';
const GOLD_DIM = 'rgba(201,168,76,0.55)';
const TEAL     = '#1A8F69';
const WHITE    = '#EEE9DF';
const MUTED    = 'rgba(238,233,223,0.60)';
const FAINT    = 'rgba(238,233,223,0.38)';
const BORDER   = 'rgba(201,168,76,0.18)';
const BORDER2  = 'rgba(238,233,223,0.08)';
const RED      = '#E05C52';

const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', system-ui, sans-serif";

/* ── Inject Google Fonts + keyframes once ────────────────────────────── */
function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('atac-login-styles')) return;
  const style = document.createElement('style');
  style.id = 'atac-login-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Syne:wght@400;500;600;700&display=swap');
    @keyframes vault-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .vault-up-1 { animation: vault-up 600ms cubic-bezier(.2,.7,.2,1) both; animation-delay: 60ms; }
    .vault-up-2 { animation: vault-up 600ms cubic-bezier(.2,.7,.2,1) both; animation-delay: 120ms; }
    .vault-up-3 { animation: vault-up 600ms cubic-bezier(.2,.7,.2,1) both; animation-delay: 180ms; }
    .vault-up-4 { animation: vault-up 600ms cubic-bezier(.2,.7,.2,1) both; animation-delay: 240ms; }
    .atac-input {
      width: 100%;
      box-sizing: border-box;
      background: rgba(8,11,18,0.6);
      border: 1px solid ${BORDER2};
      border-radius: 3px;
      color: ${WHITE};
      font-family: ${VAULT_BODY};
      font-size: 16px;
      padding: 16px 18px;
      outline: none;
      transition: border-color 180ms ease, background 180ms ease;
    }
    .atac-input::placeholder { color: rgba(238,233,223,0.30); }
    .atac-input:focus { border-color: ${GOLD}; background: rgba(8,11,18,0.85); }
    .atac-input.err { border-color: ${RED}; }
    .atac-cta {
      width: 100%;
      padding: 18px 24px;
      border: none;
      border-radius: 3px;
      background: ${GOLD};
      color: ${BG};
      font-family: ${VAULT_BODY};
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      cursor: pointer;
      transition: transform 120ms ease, opacity 180ms ease, box-shadow 180ms ease;
    }
    .atac-cta:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(201,168,76,0.18); }
    .atac-cta:disabled { opacity: 0.4; cursor: not-allowed; }
    .atac-tab {
      flex: 1;
      padding: 14px 0;
      background: transparent;
      border: none;
      color: ${MUTED};
      font-family: ${VAULT_BODY};
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: color 180ms ease, border-color 180ms ease;
    }
    .atac-tab.active { color: ${WHITE}; border-bottom-color: ${GOLD}; }
    .atac-link { color: ${GOLD}; text-decoration: none; border-bottom: 1px solid ${GOLD_DIM}; }
    .atac-link:hover { border-bottom-color: ${GOLD}; }
    @media (max-width: 980px) {
      .atac-grid { grid-template-columns: 1fr !important; }
      .atac-brand-pane { padding: 56px 28px 28px !important; }
      .atac-form-pane  { padding: 28px !important; }
      .atac-h1 { font-size: 38px !important; }
    }
  `;
  document.head.appendChild(style);
}

/* ── Component ───────────────────────────────────────────────────────── */
export default function Login({ defaultAction }) {
  const navigate = useNavigate();
  injectStyles();

  // Determine starting tab: prop > query string > default 'login'
  const queryAction =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('action')
      : null;
  const initialTab =
    defaultAction === 'register' || queryAction === 'register' ? 'register' : 'login';

  const [tab, setTab] = useState(initialTab);

  // Login state
  const [loginEmail, setLoginEmail]     = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [regEmail,  setRegEmail]  = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Keep tab in sync if defaultAction prop changes
  useEffect(() => {
    if (defaultAction === 'register') setTab('register');
  }, [defaultAction]);

  const switchTab = (t) => {
    setTab(t);
    setError('');
  };

  /* ── Login handler ─────────────────────────────────────────────── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!loginEmail.trim() || !loginPassword) {
      setError('Email and password are required.');
      return;
    }
    if (!isValidEmail(loginEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.message || 'Sign in failed. Check your credentials.');
        setLoading(false);
        return;
      }

      // Persist auth
      if (data.token) localStorage.setItem('atac_token', data.token);
      if (data.candidate) {
        localStorage.setItem('atac_candidate', JSON.stringify(data.candidate));
      }

      // Route by role
      const role = data.candidate?.role;
      if (role === 'employer') {
        navigate('/employer');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('[login] error', err);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  /* ── Register handler ──────────────────────────────────────────── */
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !regEmail.trim() || !regPassword) {
      setError('All fields are required.');
      return;
    }
    if (!isValidEmail(regEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!termsAccepted) {
      setError('You must accept the Terms of Certification to continue.');
      return;
    }

    setLoading(true);
    const termsAcceptedAt = new Date().toISOString();

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName:  lastName.trim(),
          email:     regEmail.trim().toLowerCase(),
          password:  regPassword,
          termsAccepted: true,
          termsAcceptedAt,
          termsVersion: TERMS_VERSION,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.message || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      if (data.token) localStorage.setItem('atac_token', data.token);
      if (data.candidate) {
        localStorage.setItem('atac_candidate', JSON.stringify(data.candidate));
      }

      navigate('/payment');
    } catch (err) {
      console.error('[register] error', err);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: WHITE,
        fontFamily: VAULT_BODY,
        backgroundImage: `
          radial-gradient(1200px 600px at 80% -10%, rgba(201,168,76,0.06), transparent 60%),
          radial-gradient(900px 500px at -10% 110%, rgba(26,143,105,0.05), transparent 60%)
        `,
      }}
    >
      {/* Top bar */}
      <header
        style={{
          padding: '22px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${BORDER2}`,
          background: 'rgba(8,11,18,0.7)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <a
          href="https://atacglobalcx.com"
          style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <img
            src={brandLogo}
            alt="ATAC Global CX"
            style={{ height: 44, width: 'auto', display: 'block' }}
          />
        </a>
        <nav style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          <a
            href="https://atacglobalcx.com/verify"
            style={{
              color: MUTED,
              textDecoration: 'none',
              fontSize: 12,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            Verify a Credential
          </a>
        </nav>
      </header>

      {/* Main grid */}
      <main
        className="atac-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 520px',
          maxWidth: 1240,
          margin: '0 auto',
          minHeight: 'calc(100vh - 88px)',
        }}
      >
        {/* ── LEFT: Brand / value proposition ────────────────────── */}
        <section
          className="atac-brand-pane"
          style={{
            padding: '80px 60px 60px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            className="vault-up-1"
            style={{
              fontSize: 11,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: GOLD,
              marginBottom: 28,
              fontWeight: 500,
            }}
          >
            Remote CX Certification
          </div>

          <h1
            className="atac-h1 vault-up-2"
            style={{
              fontFamily: VAULT_DISPLAY,
              fontSize: 56,
              lineHeight: 1.05,
              fontWeight: 400,
              margin: 0,
              marginBottom: 24,
              color: WHITE,
              letterSpacing: '-0.01em',
            }}
          >
            The standard for{' '}
            <span style={{ fontStyle: 'italic', color: GOLD }}>remote CX</span>{' '}
            excellence.
          </h1>

          <p
            className="vault-up-3"
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: MUTED,
              margin: 0,
              marginBottom: 44,
              maxWidth: 520,
            }}
          >
            ATAC Global CX issues blockchain-verified credentials for remote customer
            experience professionals. One assessment. One designation. A network employers
            can verify in seconds.
          </p>

          {/* Candidate journey */}
          <div
            className="vault-up-4"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              maxWidth: 520,
            }}
          >
            <JourneyStep
              num="01"
              title="Create your account"
              body="Pick your tier — Standard, Pro, or Team — and get instant access."
            />
            <JourneyStep
              num="02"
              title="Complete the assessment"
              body="40 questions across five CX domains. Results scored and minted on the blockchain."
            />
            <JourneyStep
              num="03"
              title="Share your credential"
              body="Add the CRSA designation to your profile. Employers verify it in seconds."
            />
          </div>

          {/* Trust strip */}
          <div
            className="vault-up-4"
            style={{
              marginTop: 56,
              display: 'flex',
              gap: 28,
              flexWrap: 'wrap',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: FAINT,
            }}
          >
            <TrustItem label="Blockchain-verified" />
            <TrustItem label="Built for 10,000+ CX professionals" />
            <TrustItem label="Employer-ready" />
          </div>
        </section>

        {/* ── RIGHT: Form card ───────────────────────────────────── */}
        <section
          className="atac-form-pane"
          style={{
            padding: '80px 48px 60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="vault-up-2"
            style={{
              width: '100%',
              maxWidth: 460,
              background: `linear-gradient(180deg, ${BG1} 0%, ${BG2} 100%)`,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: '40px 36px 36px',
              position: 'relative',
              boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
            }}
          >
            {/* Top-right seal */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -28,
                right: -28,
                width: 96,
                height: 96,
                pointerEvents: 'none',
              }}
            >
              <img
                src={certificateSeal}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  opacity: 0.95,
                  filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))',
                }}
              />
            </div>

            {/* Context label */}
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: GOLD,
                marginBottom: 12,
                fontWeight: 500,
              }}
            >
              {tab === 'register' ? 'Candidate Access' : 'Credential Portal'}
            </div>

            {/* Heading */}
            <h2
              style={{
                fontFamily: VAULT_DISPLAY,
                fontSize: 32,
                lineHeight: 1.15,
                fontWeight: 400,
                margin: 0,
                marginBottom: 6,
                color: WHITE,
              }}
            >
              {tab === 'register' ? 'Create your account' : 'Sign in'}
            </h2>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: MUTED,
                margin: 0,
                marginBottom: 28,
              }}
            >
              {tab === 'register'
                ? 'Begin your CRSA certification journey.'
                : 'Welcome back. Continue your certification.'}
            </p>

            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: `1px solid ${BORDER2}`,
                marginBottom: 28,
              }}
            >
              <button
                type="button"
                className={`atac-tab ${tab === 'login' ? 'active' : ''}`}
                onClick={() => switchTab('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`atac-tab ${tab === 'register' ? 'active' : ''}`}
                onClick={() => switchTab('register')}
              >
                Register
              </button>
            </div>

            {/* Forms */}
            {tab === 'login' ? (
              <form onSubmit={handleLogin} noValidate>
                <Field label="Email">
                  <input
                    type="email"
                    className="atac-input"
                    placeholder="you@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    className="atac-input"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <button
                  type="submit"
                  className="atac-cta"
                  disabled={loading}
                  style={{ marginTop: 8 }}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>

                <p
                  style={{
                    marginTop: 20,
                    fontSize: 13,
                    color: MUTED,
                    textAlign: 'center',
                  }}
                >
                  New to ATAC?{' '}
                  <button
                    type="button"
                    className="atac-link"
                    onClick={() => switchTab('register')}
                    style={{
                      background: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: VAULT_BODY,
                    }}
                  >
                    Create an account
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} noValidate>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="First name">
                    <input
                      type="text"
                      className="atac-input"
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      maxLength={60}
                      autoFocus
                    />
                  </Field>
                  <Field label="Last name">
                    <input
                      type="text"
                      className="atac-input"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                      maxLength={60}
                    />
                  </Field>
                </div>

                <Field label="Email">
                  <input
                    type="email"
                    className="atac-input"
                    placeholder="you@company.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    autoComplete="email"
                    maxLength={254}
                  />
                </Field>

                <Field label="Password" helper="Minimum 8 characters.">
                  <input
                    type="password"
                    className="atac-input"
                    placeholder="At least 8 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </Field>

                {/* Terms of Certification — REQUIRED */}
                <label
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    margin: '12px 0 18px',
                    padding: '14px 16px',
                    background: 'rgba(8,11,18,0.5)',
                    border: `1px solid ${BORDER2}`,
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    style={{
                      marginTop: 3,
                      width: 16,
                      height: 16,
                      accentColor: GOLD,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, lineHeight: 1.55, color: MUTED }}>
                    {TERMS_COPY}
                  </span>
                </label>

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <button
                  type="submit"
                  className="atac-cta"
                  disabled={loading || !termsAccepted}
                  style={{ marginTop: 4 }}
                >
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>

                <p
                  style={{
                    marginTop: 20,
                    fontSize: 13,
                    color: MUTED,
                    textAlign: 'center',
                  }}
                >
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="atac-link"
                    onClick={() => switchTab('login')}
                    style={{
                      background: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: VAULT_BODY,
                    }}
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${BORDER2}`,
          padding: '20px 32px',
          fontSize: 11,
          letterSpacing: '0.14em',
          color: FAINT,
          textAlign: 'center',
          textTransform: 'uppercase',
        }}
      >
        © {new Date().getFullYear()} ATAC Anagenesis Inc. · ATAC Global CX™
      </footer>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */
function Field({ label, helper, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'block',
          fontFamily: VAULT_BODY,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: MUTED,
          marginBottom: 10,
        }}
      >
        {label}
      </label>
      {children}
      {helper && (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 12,
            color: FAINT,
            fontStyle: 'italic',
          }}
        >
          {helper}
        </p>
      )}
    </div>
  );
}

function ErrorBanner({ children }) {
  return (
    <div
      role="alert"
      style={{
        margin: '12px 0 16px',
        padding: '12px 14px',
        background: 'rgba(224,92,82,0.08)',
        border: `1px solid rgba(224,92,82,0.35)`,
        borderRadius: 3,
        color: RED,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function JourneyStep({ num, title, body }) {
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      <div
        style={{
          fontFamily: VAULT_DISPLAY,
          fontStyle: 'italic',
          fontSize: 22,
          color: GOLD,
          lineHeight: 1,
          paddingTop: 2,
          minWidth: 36,
        }}
      >
        {num}
      </div>
      <div>
        <div
          style={{
            fontFamily: VAULT_BODY,
            fontSize: 15,
            fontWeight: 600,
            color: WHITE,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: MUTED }}>{body}</div>
      </div>
    </div>
  );
}

function TrustItem({ label }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M1 5L4 8L9 2"
          stroke={TEAL}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{label}</span>
    </div>
  );
}
