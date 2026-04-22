// frontend/src/pages/VerifyLanding.jsx
// Employer verification portal landing page — Vault Design System v2
// Route: /verify (app.atacglobalcx.com/verify)
// v2 changes: typography scaled up across the board for readability

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoUrl from '../assets/agcx-logo.png';

const API_BASE = import.meta.env.VITE_API_URL || 'https://atac-backend-production.up.railway.app';

const CREDENTIAL_ID_REGEX = /^ATAC-C-\d{4}-\d{5}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Vault Design Tokens ─────────────────────────────────── */
const BG      = '#080B12';
const BG1     = '#0C1018';
const BG2     = '#101520';
const GOLD    = '#C9A84C';
const TEAL    = '#1A8F69';
const WHITE   = '#EEE9DF';
const MUTED   = 'rgba(238,233,223,0.60)';
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const RED     = '#E05C52';

const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

export default function VerifyLanding() {
  const navigate = useNavigate();
  const [credentialId, setCredentialId] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    const cleanId = credentialId.trim().toUpperCase();
    if (!cleanId) e.credentialId = 'Credential ID required';
    else if (!CREDENTIAL_ID_REGEX.test(cleanId)) {
      e.credentialId = 'Format: ATAC-C-YYYY-NNNNN';
    }
    if (!email.trim()) e.email = 'Email required';
    else if (!EMAIL_REGEX.test(email.trim())) e.email = 'Valid email required';
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
          source: 'verify_landing',
          userAgent: navigator.userAgent,
      source: 'verify_landing',
      userAgent: navigator.userAgent,
    }),
  });
  if (!response.ok) {
    console.warn('Lead capture returned:', response.status);
  }
} catch (err) {
  console.warn('Lead capture failed:', err);
}

    navigate(`/verify/${cleanId}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: BG,
      color: WHITE,
      fontFamily: VAULT_BODY,
      position: 'relative',
    }}>

      {/* ═══ HEADER BAND ═══ */}
      <header style={{
        borderBottom: `1px solid ${BORDER2}`,
        background: `linear-gradient(180deg, ${BG1} 0%, ${BG} 100%)`,
        position: 'relative',
        zIndex: 2,
      }}>
        <div style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <a href="https://atacglobalcx.com" style={{
  textDecoration: 'none',
  color: WHITE,
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
}}>
  <div style={{
    background: WHITE,
    borderRadius: '6px',
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    boxShadow: `0 0 0 1px ${BORDER}`,
  }}>
    <img
      src={logoUrl}
      alt="ATAC Global CX"
      style={{ height: '32px', width: 'auto', display: 'block' }}
    />
  </div>
  <span style={{
    fontFamily: VAULT_BODY,
    fontSize: '10px',
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    color: MUTED,
  }}>
    Certification
    <br />
    Authority
  </span>
</a>
          <a href="https://atacglobalcx.com/employers"
             style={{
               fontFamily: VAULT_BODY,
               fontSize: '11px',
               letterSpacing: '0.22em',
               textTransform: 'uppercase',
               color: MUTED,
               textDecoration: 'none',
               transition: 'color 0.2s',
             }}
             onMouseOver={(e) => e.target.style.color = GOLD}
             onMouseOut={(e) => e.target.style.color = MUTED}
          >
            For Enterprise →
          </a>
        </div>
      </header>

      {/* ═══ MAIN HERO ═══ */}
      <main style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '80px 32px 60px',
        position: 'relative',
        zIndex: 2,
      }}>

        {/* Eyebrow */}
        <div className="vault-up-0" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '32px',
        }}>
          <span style={{
            width: '28px',
            height: '1px',
            background: GOLD,
            opacity: 0.5,
          }} />
          <span style={{
            fontSize: '12px',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: GOLD,
            fontWeight: 500,
          }}>
            Blockchain-Verified Credentials
          </span>
        </div>

        {/* Headline */}
        <h1 className="vault-up-1" style={{
          fontFamily: VAULT_DISPLAY,
          fontSize: 'clamp(44px, 6.5vw, 64px)',
          lineHeight: 1.05,
          fontWeight: 400,
          letterSpacing: '-0.01em',
          marginBottom: '24px',
          color: WHITE,
        }}>
          Verify an{' '}
          <span style={{ fontStyle: 'italic', color: GOLD }}>
            ATAC Global CX
          </span>{' '}
          credential.
        </h1>

        {/* Deck */}
        <p className="vault-up-2" style={{
          fontFamily: VAULT_BODY,
          fontSize: '18px',
          lineHeight: 1.6,
          color: MUTED,
          maxWidth: '580px',
          marginBottom: '48px',
          fontWeight: 400,
        }}>
          Every credential is minted on the blockchain and cryptographically sealed.
          Paste the credential ID below to confirm authenticity, score, and validity
          in seconds.
        </p>

        {/* Gold rule */}
        <hr className="vault-up-3 vault-rule" style={{ marginBottom: '40px' }} />

        {/* ═══ VERIFICATION FORM ═══ */}
        <form onSubmit={handleSubmit} className="vault-up-3" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
        }}>

          {/* Credential ID field */}
          <div>
            <label htmlFor="credentialId" style={labelStyle}>
              Credential ID
            </label>
            <input
              id="credentialId"
              type="text"
              className="vault-input"
              placeholder="ATAC-C-2026-00001"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              style={{
                fontFamily: 'SF Mono, Consolas, monospace',
                fontSize: '16px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                padding: '16px 18px',
                borderColor: errors.credentialId ? RED : undefined,
              }}
              autoComplete="off"
              autoCapitalize="characters"
            />
            {errors.credentialId && (
              <p style={errorStyle}>{errors.credentialId}</p>
            )}
          </div>

          {/* Email field */}
          <div>
            <label htmlFor="email" style={labelStyle}>
              Work Email
            </label>
            <input
              id="email"
              type="email"
              className="vault-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                fontSize: '15px',
                padding: '16px 18px',
                borderColor: errors.email ? RED : undefined,
              }}
              autoComplete="email"
            />
            <p style={helperStyle}>
              We'll send the verification record to your inbox.
            </p>
            {errors.email && <p style={errorStyle}>{errors.email}</p>}
          </div>

          {/* Company field */}
          <div>
            <label htmlFor="company" style={labelStyle}>
              Company <span style={{ color: MUTED, fontSize: '10px', marginLeft: '6px', letterSpacing: '0.18em' }}>— Optional</span>
            </label>
            <input
              id="company"
              type="text"
              className="vault-input"
              placeholder="Acme BPO Services"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              style={{
                fontSize: '15px',
                padding: '16px 18px',
              }}
              autoComplete="organization"
            />
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={loading}
            className="vault-btn-gold"
            style={{
              padding: '18px 32px',
              fontSize: '12px',
              letterSpacing: '0.22em',
              marginTop: '16px',
              width: '100%',
            }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  width: '14px',
                  height: '14px',
                  border: `2px solid ${BG}`,
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'vault-spin 0.8s linear infinite',
                }} />
                Verifying
              </span>
            ) : (
              <>Verify Credential →</>
            )}
          </button>

          {/* Trust footer row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '28px',
            marginTop: '12px',
            flexWrap: 'wrap',
          }}>
            <TrustBadge label="Free verification" />
            <DotDivider />
            <TrustBadge label="No account required" />
            <DotDivider />
            <TrustBadge label="Under 10 seconds" />
          </div>
        </form>

        {/* ═══ HOW IT WORKS ═══ */}
        <section className="vault-up-4" style={{ marginTop: '112px' }}>
          <hr className="vault-rule-full" style={{ marginBottom: '36px' }} />

          <div style={{
            fontSize: '12px',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: GOLD,
            fontWeight: 500,
            marginBottom: '40px',
          }}>
            How It Works
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '40px',
          }}>
            <Step
              num="01"
              title="Paste credential ID"
              body="Find it on the candidate's certificate PDF or LinkedIn profile."
            />
            <Step
              num="02"
              title="On-chain lookup"
              body="We verify against the public blockchain record in real time."
            />
            <Step
              num="03"
              title="Instant result"
              body="Score breakdown, validity dates, and downloadable proof."
            />
          </div>
        </section>

        {/* ═══ ENTERPRISE CTA ═══ */}
        <section className="vault-up-5" style={{
          marginTop: '112px',
          padding: '48px',
          background: `linear-gradient(135deg, ${BG1} 0%, ${BG2} 100%)`,
          border: `1px solid ${BORDER}`,
          borderRadius: '4px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Gold corner accent */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '100px',
            height: '1px',
            background: `linear-gradient(90deg, transparent, ${GOLD})`,
            opacity: 0.6,
          }} />

          <div style={{
            fontSize: '12px',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: GOLD,
            fontWeight: 500,
            marginBottom: '20px',
          }}>
            For Hiring Teams
          </div>
          <h3 style={{
            fontFamily: VAULT_DISPLAY,
            fontSize: '34px',
            lineHeight: 1.15,
            fontWeight: 400,
            marginBottom: '16px',
            color: WHITE,
          }}>
            Hiring <span style={{ fontStyle: 'italic', color: GOLD }}>at scale?</span>
          </h3>
          <p style={{
            fontSize: '16px',
            lineHeight: 1.6,
            color: MUTED,
            marginBottom: '28px',
            maxWidth: '520px',
          }}>
            API access, bulk verification, and a branded employer dashboard
            for your recruiting team.
          </p>
          <a
            href="mailto:sales@atacglobalcx.com?subject=Enterprise Verification Access"
            className="vault-btn-ghost"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 26px',
              fontSize: '12px',
              letterSpacing: '0.18em',
              textDecoration: 'none',
            }}
          >
            Talk to Sales →
          </a>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        maxWidth: '1180px',
        margin: '0 auto',
        padding: '48px 32px 56px',
        borderTop: `1px solid ${BORDER2}`,
        marginTop: '96px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        fontSize: '12px',
        color: MUTED,
        letterSpacing: '0.06em',
      }}>
        <div>
          © 2026 ATAC Anagenesis Inc. · ATAC Global CX™
        </div>
        <div style={{ display: 'flex', gap: '28px' }}>
          <a href="https://atacglobalcx.com/privacy" style={footerLinkStyle}>Privacy</a>
          <a href="https://atacglobalcx.com/terms" style={footerLinkStyle}>Terms</a>
          <a href="https://atacglobalcx.com/contact" style={footerLinkStyle}>Contact</a>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function Step({ num, title, body }) {
  return (
    <div>
      <div style={{
        fontFamily: VAULT_DISPLAY,
        fontSize: '32px',
        fontStyle: 'italic',
        color: GOLD,
        fontWeight: 400,
        marginBottom: '12px',
        letterSpacing: '0.02em',
      }}>
        {num}
      </div>
      <h4 style={{
        fontFamily: VAULT_BODY,
        fontSize: '15px',
        fontWeight: 600,
        color: WHITE,
        letterSpacing: '0.02em',
        marginBottom: '10px',
      }}>
        {title}
      </h4>
      <p style={{
        fontSize: '14px',
        lineHeight: 1.6,
        color: MUTED,
      }}>
        {body}
      </p>
    </div>
  );
}

function TrustBadge({ label }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '9px',
      fontSize: '13px',
      color: MUTED,
      letterSpacing: '0.04em',
    }}>
      <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
        <path d="M1 5L4 8L9 2" stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {label}
    </div>
  );
}

function DotDivider() {
  return (
    <span style={{
      width: '3px',
      height: '3px',
      borderRadius: '50%',
      background: BORDER2,
    }} />
  );
}

/* ── Shared style objects ────────────────────────────────── */

const labelStyle = {
  display: 'block',
  fontFamily: VAULT_BODY,
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: MUTED,
  marginBottom: '12px',
};

const helperStyle = {
  marginTop: '10px',
  fontSize: '13px',
  color: MUTED,
  letterSpacing: '0.02em',
  fontStyle: 'italic',
};

const errorStyle = {
  marginTop: '10px',
  fontSize: '13px',
  color: RED,
  letterSpacing: '0.04em',
};

const footerLinkStyle = {
  color: MUTED,
  textDecoration: 'none',
  letterSpacing: '0.08em',
  fontSize: '12px',
  transition: 'color 0.2s',
};

