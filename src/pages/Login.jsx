// frontend/src/pages/Login.jsx
// ATAC Global CX — Login / Register page  ·  Vault Design System v4
// v4 (May 2, 2026) — Rebuilt to match the approved preview.
//
// Layout: Full-bleed 55/45 split (no centered max-width).
//   Left pane:  large logo top-left, kicker, big headline, paragraph,
//               4 stat cards in a row, 3 journey cards in a row, footer microcopy
//   Right pane: top-right tab pills (Create Account / Sign In),
//               large form card with seal in the heading row
//
// Routes:
//   /login                       → Sign In tab (default)
//   /login?action=register       → Register tab
//   /signup                      → Register tab (via SignupPage wrapper)
//
// Functional contract (PRESERVED):
//   - POST /api/auth/login            → { token, candidate }
//   - POST /api/auth/register         → { token, candidate } + termsAccepted/termsAcceptedAt
//   - localStorage.atac_token         → JWT
//   - localStorage.atac_candidate     → JSON candidate object
//   - Login: employer → /employer, otherwise → /dashboard
//   - Register: → /payment
//   - Terms of Certification (v1.0) checkbox required
//   - isValidEmail from ../utils/validation
//   - Confirm Password is FRONTEND-ONLY, never sent to API

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isValidEmail } from '../utils/validation';
import brandLogo from '../assets/atac-globalcx-logo-header.png';
import certificateSeal from '../assets/agcx-certificate-seal-cropped.png';
import COUNTRIES from '../data/countries';

const API_BASE =
  import.meta.env.VITE_API_URL || 'https://atac-backend-production.up.railway.app';

const TERMS_VERSION = '1.0';
const TERMS_COPY =
  'I certify that I am the individual named above. I will personally complete all assessments. ' +
  'I understand that credential fraud voids my certification permanently and may result in public ' +
  'revocation on the blockchain.';

/* ── Vault Design Tokens ─────────────────────────────────────────────── */
const BG       = '#080B12';
const BG1      = '#0C1018';
const BG2      = '#101520';
const BG3      = '#0A0E16';
const GOLD     = '#C9A84C';
const GOLD_DIM = 'rgba(201,168,76,0.55)';
const TEAL     = '#1A8F69';
const WHITE    = '#EEE9DF';
const MUTED    = 'rgba(238,233,223,0.62)';
const FAINT    = 'rgba(238,233,223,0.38)';
const BORDER   = 'rgba(201,168,76,0.18)';
const BORDER2  = 'rgba(238,233,223,0.08)';
const RED      = '#E05C52';

const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', system-ui, sans-serif";

/* ── Inject fonts + keyframes once ───────────────────────────────────── */
function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('atac-login-styles-v4')) return;
  const style = document.createElement('style');
  style.id = 'atac-login-styles-v4';
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
    .atac-cta {
      width: 100%;
      padding: 18px 24px;
      border: none;
      border-radius: 3px;
      background: ${GOLD};
      color: ${BG};
      font-family: ${VAULT_BODY};
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      cursor: pointer;
      transition: transform 120ms ease, opacity 180ms ease, box-shadow 180ms ease;
    }
    .atac-cta:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(201,168,76,0.20); }
    .atac-cta:disabled { opacity: 0.4; cursor: not-allowed; }
    .atac-tab {
      padding: 12px 22px;
      background: transparent;
      border: 1px solid ${BORDER2};
      border-radius: 3px;
      color: ${MUTED};
      font-family: ${VAULT_BODY};
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 180ms ease;
    }
    .atac-tab:hover { color: ${WHITE}; border-color: ${BORDER}; }
    .atac-tab.active {
      background: ${GOLD};
      color: ${BG};
      border-color: ${GOLD};
    }
    .atac-link { color: ${GOLD}; background: none; border: none; padding: 0; cursor: pointer;
                 font-family: ${VAULT_BODY}; font-size: 13px; border-bottom: 1px solid ${GOLD_DIM}; }
    .atac-link:hover { border-bottom-color: ${GOLD}; }

    /* Stat card */
    .atac-stat {
      background: ${BG3};
      border: 1px solid ${BORDER2};
      border-radius: 3px;
      padding: 18px 16px;
      min-width: 0;
    }
    .atac-stat-num {
      font-family: ${VAULT_DISPLAY};
      font-size: 32px;
      font-weight: 400;
      color: ${GOLD};
      line-height: 1;
      margin-bottom: 8px;
      letter-spacing: -0.01em;
    }
    .atac-stat-label {
      font-family: ${VAULT_BODY};
      font-size: 10px;
      font-weight: 600;
      color: ${MUTED};
      letter-spacing: 0.22em;
      text-transform: uppercase;
      line-height: 1.35;
    }

    /* Journey card */
    .atac-journey {
      background: ${BG3};
      border: 1px solid ${BORDER2};
      border-radius: 3px;
      padding: 20px;
    }
    .atac-journey-title {
      font-family: ${VAULT_BODY};
      font-size: 11px;
      font-weight: 700;
      color: ${GOLD};
      letter-spacing: 0.22em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .atac-journey-body {
      font-size: 13px;
      line-height: 1.55;
      color: ${MUTED};
    }

    /* Responsive */
    @media (max-width: 1100px) {
      .atac-split { grid-template-columns: 1fr !important; }
      .atac-left  { padding: 48px 32px !important; min-height: auto !important; }
      .atac-right { padding: 48px 32px !important; min-height: auto !important; }
      .atac-h1    { font-size: 44px !important; }
      .atac-tabs-row { justify-content: flex-start !important; }
    }
    @media (max-width: 720px) {
      .atac-stats-grid   { grid-template-columns: repeat(2, 1fr) !important; }
      .atac-journey-grid { grid-template-columns: 1fr !important; }
      .atac-h1           { font-size: 36px !important; }
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
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [firstName, setFirstName]         = useState('');
  const [lastName,  setLastName]          = useState('');
  const [country,   setCountry]           = useState('');
  const [regEmail,  setRegEmail]          = useState('');
  const [regPassword, setRegPassword]     = useState('');
  const [regConfirm, setRegConfirm]       = useState('');
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
    // Sync URL so TitleSetter can title the page correctly.
    // replace: true keeps tab toggles out of the browser history stack.
    navigate(t === 'register' ? '/login?action=register' : '/login', { replace: true });
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

      if (data.token) localStorage.setItem('atac_token', data.token);
      if (data.candidate) {
        localStorage.setItem('atac_candidate', JSON.stringify(data.candidate));
      }

      const role = data.candidate?.role;
      if (role === 'employer') navigate('/employer');
      else                     navigate('/dashboard');
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
    if (regPassword !== regConfirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!termsAccepted) {
      setError('You must accept the Terms of Certification to continue.');
      return;
    }
    if (!country) { setError('Please select your country'); return; }

    setLoading(true);
    const termsAcceptedAt = new Date().toISOString();

    try {
      // NOTE: regConfirm is intentionally NOT sent to the API.
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName:  lastName.trim(),
          countryCode: country,
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
      className="atac-split"
      style={{
        minHeight: '100vh',
        background: BG,
        color: WHITE,
        fontFamily: VAULT_BODY,
        display: 'grid',
        gridTemplateColumns: '55fr 45fr',
        backgroundImage: `
          radial-gradient(900px 500px at 80% -10%, rgba(201,168,76,0.05), transparent 60%),
          radial-gradient(800px 500px at -10% 110%, rgba(26,143,105,0.04), transparent 60%)
        `,
      }}
    >
      {/* ═══════════════════ LEFT PANE ═══════════════════ */}
      <section
        className="atac-left"
        style={{
          padding: '56px 72px 48px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          borderRight: `1px solid ${BORDER2}`,
        }}
      >
        {/* Logo */}
        <div className="vault-up-1" style={{ marginBottom: 56 }}>
          <a
            href="https://atacglobalcx.com"
            style={{ display: 'inline-block', textDecoration: 'none' }}
          >
            <img
              src={brandLogo}
              alt="ATAC Global CX"
              style={{ height: 80, width: 'auto', display: 'block' }}
            />
          </a>
        </div>

        {/* Kicker */}
        <div
          className="vault-up-2"
          style={{
            fontSize: 11,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: GOLD,
            fontWeight: 600,
            marginBottom: 24,
          }}
        >
          · Remote CX Certification
        </div>

        {/* Headline */}
        <h1
          className="atac-h1 vault-up-2"
          style={{
            fontFamily: VAULT_DISPLAY,
            fontSize: 64,
            lineHeight: 1.05,
            fontWeight: 400,
            margin: 0,
            marginBottom: 28,
            color: WHITE,
            letterSpacing: '-0.015em',
            maxWidth: 620,
          }}
        >
          The standard for{' '}
          <span style={{ fontStyle: 'italic', color: GOLD }}>remote CX</span>{' '}
          excellence.
        </h1>

        {/* Supporting paragraph */}
        <p
          className="vault-up-3"
          style={{
            fontSize: 16,
            lineHeight: 1.65,
            color: MUTED,
            margin: 0,
            marginBottom: 40,
            maxWidth: 580,
          }}
        >
          Join a blockchain-verified credential network built for remote
          customer experience professionals, hiring teams, and global service
          operations.
        </p>

        {/* Stat cards */}
        <div
          className="atac-stats-grid vault-up-3"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 28,
            maxWidth: 720,
          }}
        >
          <StatCard num="40"      label="Questions" />
          <StatCard num="70%"     label={<>Pass<br />Threshold</>} />
          <StatCard num="ERC-721" label="Credential" small />
          <StatCard num="2026"    label={<>Cohort<br />Open</>} />
        </div>

        {/* Journey cards */}
        <div
          className="atac-journey-grid vault-up-4"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 36,
            maxWidth: 720,
          }}
        >
          <JourneyCard
            title="Create Account"
            body="Set up your candidate profile and consent record."
          />
          <JourneyCard
            title="Complete Assessment"
            body="Take the remote CX readiness assessment."
          />
          <JourneyCard
            title="Share Credential"
            body="Use your public verification link after passing."
          />
        </div>

        {/* Footer microcopy */}
        <div
          className="vault-up-4"
          style={{
            marginTop: 'auto',
            paddingTop: 24,
            fontSize: 11,
            letterSpacing: '0.14em',
            color: FAINT,
            textTransform: 'uppercase',
          }}
        >
          © {new Date().getFullYear()} ATAC Anagenesis Inc. · ATAC Global CX™
          {'  ·  '}Blockchain-verified credentials
        </div>
      </section>

      {/* ═══════════════════ RIGHT PANE ═══════════════════ */}
      <section
        className="atac-right"
        style={{
          padding: '56px 64px 48px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        {/* Top-right tab pills */}
        <div
          className="atac-tabs-row vault-up-1"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginBottom: 48,
          }}
        >
          <button
            type="button"
            className={`atac-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Create Account
          </button>
          <button
            type="button"
            className={`atac-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Sign In
          </button>
        </div>

        {/* Form card */}
        <div
          className="vault-up-2"
          style={{
            width: '100%',
            maxWidth: 560,
            margin: '0 auto',
            background: `linear-gradient(180deg, ${BG1} 0%, ${BG2} 100%)`,
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            padding: '40px 44px 40px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Heading row: text + seal */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 14,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
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
                {tab === 'register' ? 'Candidate Access' : 'Credential Portal'}
              </div>
              <h2
                style={{
                  fontFamily: VAULT_DISPLAY,
                  fontSize: 38,
                  lineHeight: 1.1,
                  fontWeight: 400,
                  margin: 0,
                  color: WHITE,
                  letterSpacing: '-0.01em',
                }}
              >
                {tab === 'register' ? 'Join the network.' : 'Welcome back.'}
              </h2>
            </div>
            <img
              src={certificateSeal}
              alt=""
              aria-hidden="true"
              style={{
                width: 84,
                height: 84,
                objectFit: 'contain',
                flexShrink: 0,
                filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))',
              }}
            />
          </div>

          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: MUTED,
              margin: 0,
              marginBottom: 28,
            }}
          >
            {tab === 'register'
              ? 'Create your account to start the certification flow and unlock the assessment.'
              : 'Sign in to continue your certification journey.'}
          </p>

          {/* Forms */}
          {tab === 'login' ? (
            <form onSubmit={handleLogin} noValidate>
              <Field label="Email Address">
                <input
                  type="email"
                  className="atac-input"
                  placeholder="you@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  maxLength={254}
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

              <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', margin: '14px 0 0' }}>
                Forgot your password? Email{' '}
                <a
                  href="mailto:tugs@atacglobalcx.com?subject=Password%20reset%20request%3A%20ATAC%20Global%20CX"
                  className="atac-link"
                  style={{ textDecoration: 'none' }}
                >
                  tugs@atacglobalcx.com
                </a>
                {' '}for help.
              </p>

              <Divider />

              <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', margin: 0 }}>
                New to ATAC?{' '}
                <button type="button" className="atac-link" onClick={() => switchTab('register')}>
                  Create an account
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} noValidate>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="First Name">
                  <input
                    type="text"
                    className="atac-input"
                    placeholder="First"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    maxLength={60}
                    autoFocus
                  />
                </Field>
                <Field label="Last Name">
                  <input
                    type="text"
                    className="atac-input"
                    placeholder="Last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    maxLength={60}
                  />
                </Field>
              </div>

              <Field label="Country">
                <select
                  className="atac-input"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                  style={{
                    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                    paddingRight: 44, cursor: 'pointer',
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%23C9A84C' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E\")",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                  }}
                >
                  <option value="" disabled>Select your country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code} style={{ background: '#0C1018', color: '#EEE9DF' }}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Email Address">
                <input
                  type="email"
                  className="atac-input"
                  placeholder="you@email.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  autoComplete="email"
                  maxLength={254}
                />
              </Field>

              <Field label="Create Password">
                <input
                  type="password"
                  className="atac-input"
                  placeholder="Minimum 8 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </Field>

              <Field label="Confirm Password">
                <input
                  type="password"
                  className="atac-input"
                  placeholder="Re-enter password"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </Field>

              {/* Terms */}
              <label
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  margin: '8px 0 18px',
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
              >
                {loading ? 'Creating account…' : 'Apply for Access'}
              </button>

              <Divider />

              <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', margin: 0 }}>
                Already have an account?{' '}
                <button type="button" className="atac-link" onClick={() => switchTab('login')}>
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */
function Field({ label, children }) {
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

function Divider() {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        margin: '20px 0 16px',
      }}
    >
      <div style={{ flex: 1, height: 1, background: BORDER2 }} />
      <span
        style={{
          fontSize: 10,
          letterSpacing: '0.32em',
          color: FAINT,
          textTransform: 'uppercase',
        }}
      >
        or
      </span>
      <div style={{ flex: 1, height: 1, background: BORDER2 }} />
    </div>
  );
}

function StatCard({ num, label, small }) {
  return (
    <div className="atac-stat">
      <div
        className="atac-stat-num"
        style={small ? { fontSize: 22, lineHeight: 1.1 } : undefined}
      >
        {num}
      </div>
      <div className="atac-stat-label">{label}</div>
    </div>
  );
}

function JourneyCard({ title, body }) {
  return (
    <div className="atac-journey">
      <div className="atac-journey-title">{title}</div>
      <div className="atac-journey-body">{body}</div>
    </div>
  );
}
