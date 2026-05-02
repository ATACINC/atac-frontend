import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import brandLogo from '../assets/atac-globalcx-logo-header.png';
import certificateSeal from '../assets/agcx-certificate-seal-cropped.png';
import { isValidEmail } from '../utils/validation';

const API_BASE = import.meta.env.VITE_API_URL || 'https://atac-backend-production.up.railway.app';

// Hardcoded fallback sitekey is intentional — sitekeys are public-by-design
// and the production fallback ensures the form is captcha-protected even if
// the Vercel env var is missing. Mirrors the prior production behavior.
const HCAPTCHA_SITEKEY =
  import.meta.env.VITE_HCAPTCHA_SITE_KEY ||
  import.meta.env.VITE_HCAPTCHA_SITEKEY ||
  '29525f8e-3e9c-41be-a0a0-a50abd621964';

const CREDENTIAL_ID_REGEX = /^ATAC-C-\d{4}-\d{5}$/i;

const BG      = '#080B12';
const BG1     = '#0C1018';
const BG2     = '#111722';
const GOLD    = '#C9A84C';
const TEAL    = '#22A67E';
const WHITE   = '#EEE9DF';
const MUTED   = 'rgba(238,233,223,0.62)';
const SOFT    = 'rgba(238,233,223,0.42)';
const BORDER  = 'rgba(201,168,76,0.16)';
const BORDER2 = 'rgba(238,233,223,0.08)';
const RED     = '#E05C52';
const FONT_D  = '"Cormorant Garamond", Georgia, serif';
const FONT_B  = '"Syne", "DM Sans", sans-serif';

export default function VerifyLanding() {
  const navigate = useNavigate();
  const [credentialId, setCredentialId] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot — real users leave empty, bots fill it
  const [captchaToken, setCaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const captchaRef = useRef(null);
  const captchaWidgetId = useRef(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Syne:wght@400;600;700;800&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; background: ${BG}; }
      @keyframes vault-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      .vault-up { animation: vault-up 0.5s ease both; }
      .verify-link:hover { color: ${GOLD}; }
      .verify-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
      .verify-input::placeholder { color: rgba(238,233,223,0.25); }
      @media (max-width: 980px) {
        .verify-hero, .verify-grid { grid-template-columns: 1fr !important; }
        .verify-card { padding: 28px 22px !important; }
        .verify-title { font-size: 50px !important; }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    if (!captchaRef.current) return;

    const renderCaptcha = () => {
      if (!window.hcaptcha || !captchaRef.current || captchaWidgetId.current !== null) return;
      try {
        captchaWidgetId.current = window.hcaptcha.render(captchaRef.current, {
          sitekey: HCAPTCHA_SITEKEY,
          theme: 'dark',
          callback: token => {
            setCaptchaToken(token);
            setErrors(prev => ({ ...prev, captcha: '' }));
          },
          'expired-callback': () => setCaptchaToken(''),
          'error-callback': () => setCaptchaToken(''),
        });
      } catch (err) {
        console.error('[hCaptcha] render error:', err);
      }
    };

    if (window.hcaptcha) {
      renderCaptcha();
      return;
    }

    const existing = document.querySelector('script[src^="https://js.hcaptcha.com/1/api.js"]');
    if (existing) {
      const interval = setInterval(() => {
        if (window.hcaptcha) {
          clearInterval(interval);
          renderCaptcha();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = renderCaptcha;
    document.head.appendChild(script);
  }, []);

  const resetCaptcha = () => {
    setCaptchaToken('');
    if (window.hcaptcha && captchaWidgetId.current !== null) {
      try { window.hcaptcha.reset(captchaWidgetId.current); } catch { /* ignore */ }
    }
  };

  const validate = () => {
    const e = {};
    const cleanId = credentialId.trim().toUpperCase();

    if (!cleanId) e.credentialId = 'Credential ID required';
    else if (!CREDENTIAL_ID_REGEX.test(cleanId)) e.credentialId = 'Format: ATAC-C-YYYY-NNNNN';

    if (!email.trim()) e.email = 'Work email required';
    else if (!isValidEmail(email.trim())) e.email = 'Please enter a valid email address';

    if (!captchaToken) e.captcha = 'Complete the hCaptcha check';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const cleanId = credentialId.trim().toUpperCase();

    try {
      const response = await fetch(`${API_BASE}/api/employer-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId: cleanId,
          email: email.trim(),
          company: company.trim() || null,
          website,                    // Honeypot — backend rejects if non-empty
          hcaptchaToken: captchaToken,
          source: 'verify_landing',
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        if (response.status === 400) {
          resetCaptcha();
          setErrors(prev => ({ ...prev, captcha: 'Verification failed. Please try the captcha again.' }));
          setLoading(false);
          return;
        }
        console.warn('Lead capture returned:', response.status);
      }
    } catch (err) {
      console.warn('Lead capture failed:', err);
    }

    navigate(`/verify/${cleanId}`);
  };

  const s = {
    page: {
      minHeight: '100vh',
      background: `radial-gradient(circle at 50% 0%, rgba(201,168,76,0.08), transparent 34%), ${BG}`,
      color: WHITE,
      fontFamily: FONT_B,
    },
    header: {
      height: 92,
      borderBottom: `1px solid ${BORDER2}`,
      background: `linear-gradient(180deg, ${BG1} 0%, rgba(8,11,18,0.92) 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 42px',
    },
    wrap: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '64px 32px 0',
    },
    panel: {
      background: `linear-gradient(145deg, rgba(17,23,34,0.98), rgba(9,12,19,0.98))`,
      border: `1px solid ${BORDER2}`,
      borderRadius: 5,
      boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
    },
    kicker: {
      color: GOLD,
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
    },
  };

  return (
    <div style={s.page}>
      <header style={s.header}>
        <a href="https://atacglobalcx.com" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src={brandLogo} alt="ATAC Global CX" style={{ height: 62, width: 230, objectFit: 'contain', objectPosition: 'left center' }} />
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a className="verify-link" href="#verify-form" style={navLink}>Verify Credential</a>
          <a className="verify-link" href="#employer-verification" style={{ ...navLink, color: GOLD }}>For Employers</a>
        </div>
      </header>

      <main style={s.wrap}>
        <section className="verify-hero vault-up" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.08fr) 430px', gap: 30, alignItems: 'stretch' }}>
          <div className="verify-card" style={{ ...s.panel, padding: '46px 50px', borderColor: 'rgba(26,143,105,0.24)', background: 'linear-gradient(135deg, rgba(26,143,105,0.10), rgba(17,23,34,0.98) 45%, rgba(8,11,18,0.98))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,166,126,0.12)', border: '1px solid rgba(34,166,126,0.38)', color: TEAL, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800 }}>V</div>
              <div>
                <div style={{ fontSize: 12, color: TEAL, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>ATAC Credential Verification</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Confirm a candidate credential before you hire, shortlist, or share.</div>
              </div>
            </div>

            <h1 className="verify-title" style={{ fontFamily: FONT_D, fontSize: 72, lineHeight: 1.02, fontWeight: 300, margin: '0 0 18px', color: WHITE }}>
              Verify an ATAC Global CX credential.
            </h1>
            <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.75, maxWidth: 760, margin: '0 0 30px' }}>
              Enter a credential ID to confirm the holder, certification program, score, issue date, expiration date, and blockchain verification record.
            </p>

            <div className="verify-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
              <TrustMetric value="Live" label="Status Check" />
              <TrustMetric value="ERC-721" label="Blockchain Standard" />
              <TrustMetric value="Instant" label="Verification Result" />
            </div>
          </div>

          <aside className="verify-card" style={{ ...s.panel, padding: 34 }}>
            <div style={{ ...s.kicker, marginBottom: 20 }}>Authority Seal</div>
            <div style={{ background: 'radial-gradient(circle at 50% 45%, rgba(201,168,76,0.14), rgba(0,0,0,0) 58%)', border: `1px solid ${BORDER}`, borderRadius: 4, minHeight: 286, display: 'grid', placeItems: 'center', padding: 22 }}>
              <img src={certificateSeal} alt="ATAC Global CX Certification Authority" style={{ width: 210, height: 210, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${GOLD}`, boxShadow: '0 0 0 6px rgba(201,168,76,0.08), 0 0 56px rgba(201,168,76,0.34)' }} />
            </div>
          </aside>
        </section>

        <section id="verify-form" className="verify-grid vault-up" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 430px', gap: 30, marginTop: 30 }}>
          <form onSubmit={handleSubmit} style={{ ...s.panel, padding: '34px 38px' }}>
            <div style={{ ...s.kicker, marginBottom: 24 }}>Verify Credential</div>

            <Field
              label="Credential ID"
              error={errors.credentialId}
              input={(
                <input
                  className="verify-input"
                  value={credentialId}
                  onChange={(e) => setCredentialId(e.target.value)}
                  placeholder="ATAC-C-2026-00001"
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={32}
                  style={{ ...inputStyle, fontFamily: 'Consolas, monospace', textTransform: 'uppercase' }}
                />
              )}
            />

            <Field
              label="Work Email"
              helper="Used to send or associate the verification record."
              error={errors.email}
              input={(
                <input
                  className="verify-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  maxLength={254}
                  style={inputStyle}
                />
              )}
            />

            <Field
              label="Company"
              helper="Optional"
              input={(
                <input
                  className="verify-input"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme BPO Services"
                  autoComplete="organization"
                  maxLength={120}
                  style={inputStyle}
                />
              )}
            />

            {/* Honeypot — hidden from real users, bots fill it. Backend rejects if non-empty. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              aria-hidden="true"
            />

            <div style={{ margin: '4px 0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div ref={captchaRef} />
              {errors.captcha && <div style={{ color: RED, fontSize: 12 }}>{errors.captcha}</div>}
            </div>

            <button type="submit" disabled={loading || !captchaToken} className="verify-btn" style={{ marginTop: 8, width: '100%', background: GOLD, border: 'none', color: BG, padding: '16px 18px', borderRadius: 2, cursor: (loading || !captchaToken) ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', transition: '0.18s ease', opacity: (loading || !captchaToken) ? 0.6 : 1 }}>
              {loading ? 'Verifying...' : 'Verify Credential'}
            </button>
          </form>

          <div id="employer-verification" style={{ display: 'grid', gap: 18 }}>
            <InfoCard title="For Employers" body="Use ATAC verification as independent proof that a candidate completed the readiness assessment and holds a current credential." />
            <InfoCard title="For Agents" body="Use the public verification link on resumes, LinkedIn profiles, job applications, and client-facing profiles." />
            <InfoCard title="What Gets Confirmed" body="The verification record can show holder name, program, credential ID, score, issue date, expiration date, and blockchain standard." />
          </div>
        </section>

        {/* ═══ Talk to Sales — BPO/enterprise lead capture ═══ */}
        <section className="vault-up" style={{
          marginTop: 60,
          padding: '48px',
          background: `linear-gradient(135deg, ${BG1} 0%, ${BG2} 100%)`,
          border: `1px solid ${BORDER}`,
          borderRadius: 4,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '100px',
            height: '1px',
            background: `linear-gradient(90deg, transparent, ${GOLD})`,
            opacity: 0.6,
          }} />
          <div style={{ ...s.kicker, marginBottom: 20 }}>For Hiring Teams</div>
          <h3 style={{
            fontFamily: FONT_D,
            fontSize: 34,
            lineHeight: 1.15,
            fontWeight: 400,
            margin: '0 0 16px',
            color: WHITE,
          }}>
            Hiring <span style={{ fontStyle: 'italic', color: GOLD }}>at scale?</span>
          </h3>
          <p style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: MUTED,
            margin: '0 0 28px',
            maxWidth: 520,
          }}>
            API access, bulk verification, and a branded employer dashboard for your recruiting team.
          </p>
          {/* TODO: swap to sales@atacglobalcx.com once Tugs creates that inbox */}
          <a
            href="mailto:tugs@atacglobalcx.com?subject=Enterprise%20Verification%20Access"
            className="verify-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 26px',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              color: GOLD,
              border: `1px solid ${GOLD}`,
              borderRadius: 2,
              background: 'transparent',
              transition: '0.18s ease',
            }}
          >
            Talk to Sales →
          </a>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        maxWidth: 1280,
        margin: '70px auto 0',
        padding: '32px 32px 56px',
        borderTop: `1px solid ${BORDER2}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        fontSize: 12,
        color: MUTED,
        letterSpacing: '0.06em',
      }}>
        <div>© 2026 ATAC Anagenesis Inc. · ATAC Global CX™</div>
        <div style={{ display: 'flex', gap: 28 }}>
          <a href="https://atacglobalcx.com/privacy" style={footerLinkStyle}>Privacy</a>
          <a href="https://atacglobalcx.com/terms" style={footerLinkStyle}>Terms</a>
        </div>
      </footer>
    </div>
  );
}

function TrustMetric({ value, label }) {
  return (
    <div style={{ background: 'rgba(238,233,223,0.025)', border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '18px 16px', minHeight: 92 }}>
      <div style={{ fontFamily: FONT_D, fontSize: 28, color: value === 'Live' ? TEAL : WHITE, lineHeight: 1 }}>{value}</div>
      <div style={{ color: SOFT, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 10 }}>{label}</div>
    </div>
  );
}

function Field({ label, helper, error, input }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <label style={{ color: SOFT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</label>
        {helper && <span style={{ color: MUTED, fontSize: 11 }}>{helper}</span>}
      </div>
      {input}
      {error && <div style={{ color: RED, fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function InfoCard({ title, body }) {
  return (
    <div style={{ background: BG2, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '24px 26px' }}>
      <div style={{ color: GOLD, fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{body}</p>
    </div>
  );
}

const navLink = {
  color: MUTED,
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%',
  background: 'rgba(238,233,223,0.035)',
  border: `1px solid ${BORDER2}`,
  borderRadius: 3,
  color: WHITE,
  fontFamily: FONT_B,
  fontSize: 14,
  padding: '15px 16px',
  outline: 'none',
};

const footerLinkStyle = {
  color: MUTED,
  textDecoration: 'none',
  letterSpacing: '0.08em',
  fontSize: 12,
  transition: 'color 0.2s',
};
