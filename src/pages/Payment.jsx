import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsent } from '../hooks/useConsent';

/* ── Vault Design Tokens ──────────────────────────────────────────────── */
const BG    = '#080B12';
const BG1   = '#0C1018';
const BG3   = '#141B26';
const GOLD  = '#C9A84C';
const TEAL  = '#1A8F69';
const TEAL2 = '#22A67E';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const FAINT = 'rgba(238,233,223,0.04)';
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const RED   = '#C45C5C';
const AMBER = '#C48A2A';

const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const TIERS = [
  {
    id:    'standard',
    name:  'Standard',
    price: 39,
    per:   'one-time',
    color: TEAL2,
    features: [
      '40-question knowledge assessment',
      'ATAC Call Readiness Simulator\u2122 (1 session)',
      'ERC-721 blockchain credential on pass',
      'PDF score report',
      'LinkedIn shareable badge',
    ],
    cta: 'Start for $39',
  },
  {
    id:    'pro',
    name:  'Pro',
    price: 59,
    per:   'one-time',
    color: '#5BA8D4',
    badge: 'Most Popular',
    features: [
      '40-question knowledge assessment',
      'ATAC Call Readiness Simulator\u2122 (1 session)',
      'ERC-721 blockchain credential on pass',
      'PDF score report',
      'LinkedIn shareable badge',
      'Personalized gap analysis',
      'Custom development roadmap',
      '$20 credit toward full CRSA ($149)',
      '90-day score validity',
    ],
    cta: 'Start for $59',
  },
  {
    id:    'team',
    name:  'Team',
    price: 49,
    per:   'per seat',
    color: GOLD,
    features: [
      'Everything in Pro',
      'Team analytics dashboard',
      'Comparative candidate scoring',
      'ATS webhook integration',
      'Minimum 10 seats',
    ],
    cta: '$49/seat \u2014 Min 10 seats',
  },
];

const injectKF = () => {
  if (document.getElementById('vault-pay-kf')) return;
  const s = document.createElement('style');
  s.id = 'vault-pay-kf';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Syne:wght@400;500;600&display=swap');
    @keyframes vault-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    .vault-up { animation: vault-up 0.45s ease both; }
    .tier-card:hover { border-color: rgba(201,168,76,0.2) !important; }
    ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.15); }
  `;
  document.head.appendChild(s);
};

export default function Payment() {
  const navigate   = useNavigate();
  const [loading,  setLoading]  = useState(null);
  const [error,    setError]    = useState('');
  const [seats,    setSeats]    = useState(10);

  // ── Consent gate hook (B2C: 4 docs required at checkout) ──────────────
  const consent = useConsent({
    required: ['tos', 'privacy', 'refund', 'blockchain'],
  });

  // ── Fix #3 — Email Verification State ─────────────────────────────────
  const [needsVerification, setNeedsVerification] = useState(false);
  const [selectedTier,      setSelectedTier]      = useState(null);
  const [verificationCode,  setVerificationCode]  = useState('');
  const [verifying,         setVerifying]         = useState(false);
  const [verifyError,       setVerifyError]       = useState('');
  const [resendCooldown,    setResendCooldown]    = useState(0);
  const [resendStatus,      setResendStatus]      = useState('');

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const candidateObj = JSON.parse(localStorage.getItem('atac_candidate') || '{}');
  const candidateId  = candidateObj.id || localStorage.getItem('atac_candidate_id');
  const token        = localStorage.getItem('atac_token');

  const cancelled = new URLSearchParams(window.location.search).get('cancelled');

  // Inject fonts once
  if (typeof document !== 'undefined') injectKF();

  // ── Checkout handler ──────────────────────────────────────────────────
  async function handlePay(tierId) {
    if (!candidateId) {
      setError('Session expired. Please log in again.');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    // ── Consent gate: verify all 4 docs accepted BEFORE Stripe ─────────
    // Shows ConsentModal if anything missing; resolves true once accepted
    // or false if user cancels. Server-side requireConsent middleware
    // enforces the same check as a second line of defense.
    const consentOk = await consent.ensure('checkout');
    if (!consentOk) {
      // User cancelled the consent modal — abort, page stays as-is
      return;
    }

    setLoading(tierId);
    setError('');
    try {
      const body = { candidateId, tier: tierId };
      if (tierId === 'team') body.seats = seats;
      const res  = await fetch(
        `${import.meta.env.VITE_API_URL}/api/stripe/checkout`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) }
      );
      const data = await res.json();

      // Fix #3: Detect email verification gate
      if (res.status === 403 && data.code === 'EMAIL_NOT_VERIFIED') {
        setSelectedTier(tierId);
        setNeedsVerification(true);
        setLoading(null);
        setError('');
        return;
      }

      // Defensive: if server returns 428 CONSENT_REQUIRED (shouldn't happen
      // because we ensured consent above, but cookie clear or stale token
      // could trigger it), re-prompt and retry.
      if (res.status === 428 && data.error === 'CONSENT_REQUIRED') {
        const retryOk = await consent.ensure('checkout');
        setLoading(null);
        if (retryOk) return handlePay(tierId);
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Payment failed');
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(null);
    }
  }

  // ── Fix #3 — Submit the 6-digit verification code ─────────────────────
  async function handleVerifyEmail() {
    if (verificationCode.length !== 6) {
      setVerifyError('Please enter all 6 digits');
      return;
    }
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/verify-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ code: verificationCode }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.error || 'Verification failed. Please try again.');
        setVerificationCode('');
        setVerifying(false);
        return;
      }

      // Success — update token with fresh emailVerified: true claim
      if (data.token) {
        localStorage.setItem('atac_token', data.token);
      }

      // Clear verification state and auto-retry the original checkout
      setNeedsVerification(false);
      setVerificationCode('');
      setVerifying(false);

      if (selectedTier) {
        handlePay(selectedTier);
      }
    } catch (err) {
      setVerifyError(err.message || 'Network error. Please try again.');
      setVerifying(false);
    }
  }

  // ── Fix #3 — Request a new verification code ──────────────────────────
  async function handleResendCode() {
    if (resendCooldown > 0) return;
    setResendStatus('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/resend-verification`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await res.json();

      if (res.status === 429 && data.waitSeconds) {
        setResendCooldown(data.waitSeconds);
        setResendStatus('Please wait before requesting another code.');
        return;
      }

      if (!res.ok) {
        setResendStatus(data.error || 'Could not resend code.');
        return;
      }

      setResendCooldown(60);
      setResendStatus('New code sent \u2014 check your inbox.');
      setVerifyError('');
    } catch (err) {
      setResendStatus('Network error. Please try again.');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: VAULT_BODY, color: WHITE }}>

      {/* ── Topbar ── */}
      <div style={{ background: BG3, borderBottom: `1px solid ${BORDER2}`, padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src="/logo.png" alt="ATAC Global CX" style={{ height: 40, objectFit: 'contain' }} />
        <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Blockchain-Verified CX Certification
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="vault-up" style={{ textAlign: 'center', padding: '56px 24px 40px' }}>
        <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 16 }}>
          {needsVerification ? 'Almost There' : 'Choose Your Path'}
        </div>
        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 44, fontWeight: 300, color: WHITE, lineHeight: 1.1, marginBottom: 14 }}>
          {needsVerification ? 'Verify your email' : 'Begin Your Certification'}
        </div>
        <div style={{ width: 40, height: 1, background: GOLD, opacity: 0.3, margin: '0 auto 20px' }} />
        <div style={{ fontSize: 14, color: MUTED, maxWidth: 520, margin: '0 auto', lineHeight: 1.8 }}>
          {needsVerification
            ? 'Enter the 6-digit code we just sent to your inbox to continue to secure payment.'
            : 'Complete your 40-question assessment and ATAC Call Readiness Simulator\u2122 session. Pass and earn a blockchain-verified credential.'}
        </div>
      </div>

      {/* ── Cancelled banner ── */}
      {cancelled && !needsVerification && (
        <div style={{ background: 'rgba(196,138,42,0.08)', border: `1px solid rgba(196,138,42,0.25)`, borderRadius: 3, padding: '12px 24px', margin: '0 auto 24px', maxWidth: 600, textAlign: 'center', fontSize: 13, color: AMBER }}>
          Payment cancelled \u2014 no charge was made. Choose a tier below to continue.
        </div>
      )}

      {/* ── Error ── */}
      {error && !needsVerification && (
        <div style={{ background: 'rgba(196,92,92,0.08)', border: `1px solid rgba(196,92,92,0.25)`, borderRadius: 3, padding: '12px 24px', margin: '0 auto 24px', maxWidth: 600, textAlign: 'center', fontSize: 13, color: RED }}>
          {error}
        </div>
      )}

      {/* ── Fix #3: Verification panel OR Tier cards ── */}
      {needsVerification ? (
        <div className="vault-up" style={{ maxWidth: 520, margin: '0 auto 48px', padding: '0 24px' }}>
          <div style={{ background: BG1, border: `1px solid ${GOLD}35`, borderRadius: 3, padding: '40px 32px' }}>

            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14 }}>
                Enter Verification Code
              </div>
              <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>
                Code sent to<br/>
                <span style={{ color: GOLD, fontFamily: 'Consolas, monospace', fontSize: 13 }}>{candidateObj.email || 'your email'}</span>
              </div>
            </div>

            {/* Code input */}
            <div style={{ marginBottom: 20 }}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={verificationCode}
                maxLength={6}
                autoFocus
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerificationCode(digits);
                  if (verifyError) setVerifyError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && verificationCode.length === 6) handleVerifyEmail();
                }}
                style={{
                  width: '100%',
                  padding: '18px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${verifyError ? RED : BORDER2}`,
                  borderRadius: 2,
                  color: WHITE,
                  fontSize: 28,
                  fontFamily: 'Consolas, monospace',
                  fontWeight: 600,
                  letterSpacing: '0.4em',
                  textAlign: 'center',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
              />
              {verifyError && (
                <div style={{ fontSize: 12, color: RED, marginTop: 8, textAlign: 'center' }}>
                  {verifyError}
                </div>
              )}
            </div>

            {/* Verify button */}
            <button
              onClick={handleVerifyEmail}
              disabled={verificationCode.length !== 6 || verifying}
              style={{
                width: '100%',
                padding: '14px 0',
                border: 'none',
                borderRadius: 2,
                fontFamily: VAULT_BODY,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                cursor: (verificationCode.length !== 6 || verifying) ? 'not-allowed' : 'pointer',
                background: (verificationCode.length !== 6 || verifying) ? 'rgba(255,255,255,0.1)' : GOLD,
                color: (verificationCode.length !== 6 || verifying) ? MUTED : BG,
                transition: 'all 0.2s',
                marginBottom: 20,
              }}>
              {verifying ? 'Verifying\u2026' : 'Verify & Continue to Payment'}
            </button>

            {/* Resend */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              {resendStatus && (
                <div style={{ fontSize: 12, color: resendStatus.includes('sent') ? TEAL2 : MUTED, marginBottom: 8 }}>
                  {resendStatus}
                </div>
              )}
              <button
                onClick={handleResendCode}
                disabled={resendCooldown > 0}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 ? MUTED : GOLD,
                  fontSize: 12,
                  fontFamily: VAULT_BODY,
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  padding: 0,
                  textDecoration: resendCooldown > 0 ? 'none' : 'underline',
                  textUnderlineOffset: 3,
                }}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Didn\u2019t get it? Resend code'}
              </button>
            </div>

            {/* Back */}
            <div style={{ textAlign: 'center', borderTop: `1px solid ${BORDER2}`, paddingTop: 18 }}>
              <button
                onClick={() => {
                  setNeedsVerification(false);
                  setVerificationCode('');
                  setVerifyError('');
                  setResendStatus('');
                  setSelectedTier(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: MUTED,
                  fontSize: 12,
                  fontFamily: VAULT_BODY,
                  cursor: 'pointer',
                  padding: 0,
                }}>
                \u2190 Back to plans
              </button>
            </div>

          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', padding: '0 24px', maxWidth: 1060, margin: '0 auto 48px' }}>
          {TIERS.map((tier, i) => (
            <div key={tier.id} className="tier-card vault-up"
              style={{ background: BG1, border: `1px solid ${tier.badge ? tier.color + '35' : BORDER2}`, borderRadius: 3, padding: '32px 28px', width: 310, position: 'relative', display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s', animationDelay: `${i * 80}ms` }}>

              {/* Most Popular badge */}
              {tier.badge && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: tier.color, color: BG, padding: '4px 16px', borderRadius: 1, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {tier.badge}
                </div>
              )}

              {/* Tier name */}
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>{tier.name}</div>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                <span style={{ fontFamily: VAULT_DISPLAY, fontSize: 52, color: tier.color, fontWeight: 300, lineHeight: 1 }}>${tier.price}</span>
                <span style={{ fontSize: 13, color: MUTED }}>/{tier.per}</span>
              </div>

              {/* Seat selector */}
              {tier.id === 'team' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 16px', background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '10px 12px' }}>
                  <span style={{ fontSize: 11, color: MUTED }}>Seats</span>
                  <input type="number" min={10} value={seats}
                    onChange={e => setSeats(Math.max(10, parseInt(e.target.value) || 10))}
                    style={{ width: 56, padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER2}`, borderRadius: 2, color: WHITE, fontSize: 13, textAlign: 'center', fontFamily: VAULT_BODY, outline: 'none' }}
                  />
                  <span style={{ fontSize: 11, color: GOLD, fontFamily: VAULT_DISPLAY }}>= ${(seats * 49).toLocaleString()} total</span>
                </div>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: BORDER2, margin: '16px 0' }} />

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flexGrow: 1 }}>
                {tier.features.map((f, fi) => (
                  <li key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'rgba(238,233,223,0.75)', lineHeight: 1.5 }}>
                    <span style={{ color: tier.color, flexShrink: 0, marginTop: 1 }}>\u25C6</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handlePay(tier.id)}
                disabled={!!loading}
                style={{
                  width: '100%', padding: '14px 0', border: 'none', borderRadius: 2,
                  fontFamily: VAULT_BODY, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.16em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading === tier.id ? 'rgba(255,255,255,0.1)' : tier.color,
                  color: loading === tier.id ? MUTED : BG,
                  opacity: loading && loading !== tier.id ? 0.4 : 1,
                  transition: 'all 0.2s',
                }}>
                {loading === tier.id ? 'Redirecting to Stripe\u2026' : tier.cta}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Trust line ── */}
      <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(238,233,223,0.25)', paddingBottom: 48, letterSpacing: '0.06em' }}>
        \uD83D\uDD12 Secured by Stripe &nbsp;\u00B7&nbsp; Blockchain credential on Mainnet &nbsp;\u00B7&nbsp; No subscription
      </div>

      {/* ── Consent modal (renders when consent.ensure() is pending) ── */}
      {consent.modal}

    </div>
  );
}