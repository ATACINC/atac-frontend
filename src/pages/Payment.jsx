import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsent } from '../hooks/useConsent';
import API from '../api/client';
import Header from '../components/chrome/Header';
import ContactSalesModal from '../components/ContactSalesModal';
import { color as ds, font as dsFont, radius as dsRadius, goldButton } from '../designSystem/tokens';

/* -- Vault Design Tokens ---------------------------------------------- */
const BG    = '#080B12';
const BG1   = '#0C1018';
const BG3   = '#141B26';
const GOLD  = '#C9A84C';
const TEAL  = '#1A8F69';
const TEAL2 = '#22A67E';
// Shown under the code entry and again after a successful resend. Plain text,
// no em or en dashes.
const SPAM_NOTICE =
  'Not in your inbox? Check your spam or junk folder, and your Promotions tab '
  + 'if you use Gmail. The message is from ATAC Global CX '
  + '<credentials@atacglobalcx.com>. If you find it there, mark it as not spam '
  + 'so future messages reach you.';

const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const FAINT = 'rgba(238,233,223,0.04)';
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const RED   = '#C45C5C';
const AMBER = '#C48A2A';

const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

// Presentation-only details that GET /api/stripe/plans does not carry (feature
// lists + accent colour), keyed by tier id. Names, prices, currency, interval,
// perSeat, and the popular flag all come from the API at runtime.
const TIER_PRESENTATION = {
  standard: {
    color: TEAL2,
    features: [
      '40-question knowledge assessment',
      'ATAC Call Readiness Simulator™ (1 session)',
      'Blockchain-verified credential on pass',
      'PDF score report',
      'LinkedIn shareable badge',
    ],
  },
  pro: {
    color: '#5BA8D4',
    features: [
      '40-question knowledge assessment',
      'ATAC Call Readiness Simulator™ (1 session)',
      'Blockchain-verified credential on pass',
      'PDF score report',
      'LinkedIn shareable badge',
      'Personalized gap analysis',
      'Custom development roadmap',
      '$20 credit toward full CRSA ($149)',
      '90-day score validity',
    ],
  },
  team: {
    color: GOLD,
    features: [
      'Everything in Pro',
      'Team analytics dashboard',
      'Comparative candidate scoring',
      'ATS webhook integration',
      'Minimum 10 seats',
    ],
  },
};

// The team checkout enforces a minimum seat count server-side; reflected here
// in the seat selector and CTA copy.
const TEAM_MIN_SEATS = 10;
const CURRENCY_SYMBOL = { usd: '$', cad: 'CA$', eur: '€', gbp: '£' };

function tierHeading(tier) {
  const s = String(tier || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Plan';
}

// 3900 + 'usd' -> "$39"; whole amounts drop the cents, others keep two places.
function formatPrice(unitAmount, currency) {
  const major = (Number(unitAmount) || 0) / 100;
  const num = Number.isInteger(major) ? String(major) : major.toFixed(2);
  const sym = CURRENCY_SYMBOL[String(currency || '').toLowerCase()];
  return sym ? `${sym}${num}` : `${num} ${String(currency || '').toUpperCase()}`;
}

// perSeat wins ("/ seat"); a recurring interval maps to "/mo" etc.; a null
// interval (one-time) renders no suffix at all.
function priceSuffix(plan) {
  if (plan.perSeat) return '/ seat';
  if (!plan.interval) return '';
  const m = String(plan.interval).toLowerCase();
  return m === 'month' ? '/mo' : m === 'year' ? '/yr' : m === 'week' ? '/wk' : m === 'day' ? '/day' : `/${m}`;
}

const injectKF = () => {
  if (document.getElementById('vault-pay-kf')) return;
  const s = document.createElement('style');
  s.id = 'vault-pay-kf';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Syne:wght@400;500;600&display=swap');
    @keyframes vault-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes tier-pulse { 0% { box-shadow: 0 0 0 0 rgba(201,168,76,0.45); } 70% { box-shadow: 0 0 0 14px rgba(201,168,76,0); } 100% { box-shadow: 0 0 0 0 rgba(201,168,76,0); } }
    .vault-up { animation: vault-up 0.45s ease both; }
    .tier-card { transition: border-color 0.18s, transform 0.16s, box-shadow 0.16s; }
    .tier-card:hover { border-color: rgba(239,192,60,0.28) !important; transform: translateY(-3px); }
    .tier-card-highlighted { border-color: rgba(239,192,60,0.55) !important; transform: translateY(-4px); box-shadow: 0 18px 40px -22px rgba(239,192,60,0.4); }
    .otp-box { transition: border-color 0.18s, box-shadow 0.18s; }
    .otp-box:focus { border-color: rgba(239,192,60,0.6) !important; box-shadow: 0 0 0 3px rgba(239,192,60,0.18); }
    .ds-cta-btn:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
    .pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: stretch; }
    @keyframes tier-shimmer { 0%,100% { opacity: 0.35; } 50% { opacity: 0.7; } }
    .tier-skel-bar { background: rgba(255,255,255,0.06); border-radius: 6px; animation: tier-shimmer 1.4s ease-in-out infinite; }
    @media (max-width: 980px) { .pricing-grid { grid-template-columns: 1fr !important; max-width: 420px; margin-left: auto; margin-right: auto; } }
    @media (prefers-reduced-motion: reduce) { .tier-skel-bar { animation: none; } .tier-card { transition: none !important; } .tier-card:hover { transform: none !important; } .tier-card-highlighted { transform: none !important; } .otp-box { transition: none !important; } .ds-cta-btn { transition: none !important; } .ds-cta-btn:hover:not(:disabled) { transform: none !important; } }
    ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.15); }
  `;
  document.head.appendChild(s);
};

export default function Payment() {
  const navigate   = useNavigate();
  const [loading,  setLoading]  = useState(null);
  const [error,    setError]    = useState('');
  const [seats,    setSeats]    = useState(10);
  // Charter entitlement: the /api/stripe/checkout response flags pre-June-30
  // Charter accounts whose seat is already covered ($0, no card). When true we
  // show a covered state instead of the price/CTA UI, then continue the flow.
  const [charterCovered, setCharterCovered] = useState(false);
  const [charterUrl, setCharterUrl] = useState(null); // $0 Stripe checkout URL, redirected on the covered CTA click

  // -- Live pricing from GET /api/stripe/plans (via the shared axios client) --
  // plans === null while loading; [] or array once resolved; plansError set on
  // failure (page stays usable, Retry re-fetches). The checkout POST is
  // unchanged: handlePay still sends the tier string to /api/stripe/checkout.
  const [plans,      setPlans]      = useState(null);
  const [plansError, setPlansError] = useState('');
  const [plansNonce, setPlansNonce] = useState(0);
  // Team / contact-only plans open a lead form instead of Stripe checkout.
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPlans(null);
    setPlansError('');
    API.get('/api/stripe/plans')
      .then((res) => {
        if (cancelled) return;
        setPlans(Array.isArray(res.data?.plans) ? res.data.plans : []);
      })
      .catch(() => {
        if (!cancelled) setPlansError('We could not load pricing right now. Please try again.');
      });
    return () => { cancelled = true; };
  }, [plansNonce]);

  // -- Consent gate hook (B2C: 4 docs required at checkout) -------------
  const consent = useConsent({
    required: ['tos', 'privacy', 'refund', 'blockchain'],
  });

  // -- Fix #3 -- Email Verification State -------------------------------
  const [needsVerification, setNeedsVerification] = useState(false);
  const [selectedTier,      setSelectedTier]      = useState(null);
  const [verificationCode,  setVerificationCode]  = useState('');
  const [verifying,         setVerifying]         = useState(false);
  const [verifyError,       setVerifyError]       = useState('');
  const [resendCooldown,    setResendCooldown]    = useState(0);
  const [resendStatus,      setResendStatus]      = useState('');

  // -- NEW: URL tier auto-select state + refs ---------------------------
  const [highlightedTier, setHighlightedTier] = useState(null);
  const tierRefs = useRef({ standard: null, pro: null, team: null });
  const autoTriggeredRef = useRef(false);
  // Per-box refs for the 6-digit verification code, so typing/backspace/paste
  // can move focus between boxes. Backed by the same verificationCode string.
  const otpRefs = useRef([]);

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

  // -- NEW: On page load, check ?tier=X URL param -----------------------
  // Behavior:
  //   1. Read ?tier=... from URL (valid values: standard, pro, team)
  //   2. Highlight + scroll to that tier card
  //   3. After 900ms (let user see scroll + highlight), auto-trigger
  //      handlePay(tier) which opens the consent modal
  //   4. Use autoTriggeredRef to ensure this only fires once per mount
  //      (prevents re-trigger on consent modal cancel + retry)
  useEffect(() => {
    if (autoTriggeredRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const preselect = params.get('tier');
    if (!preselect || !['standard', 'pro', 'team'].includes(preselect)) return;

    // Skip auto-trigger if this is a post-cancel return from Stripe
    if (params.get('cancelled')) return;

    autoTriggeredRef.current = true;
    setHighlightedTier(preselect);

    // Scroll to the tier card once refs are set
    const scrollTimeout = setTimeout(() => {
      const el = tierRefs.current[preselect];
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);

    // Auto-trigger the checkout flow for this tier after user has had
    // time to see the scroll + highlight animation
    const triggerTimeout = setTimeout(() => {
      handlePay(preselect);
    }, 900);

    return () => {
      clearTimeout(scrollTimeout);
      clearTimeout(triggerTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run exactly once on mount

  // -- Checkout handler -------------------------------------------------
  async function handlePay(tierId) {
    if (!candidateId) {
      setError('Session expired. Please log in again.');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    // Ensure highlight matches the tier being purchased
    setHighlightedTier(tierId);

    // -- Consent gate: verify all 4 docs accepted BEFORE Stripe --------
    // Shows ConsentModal if anything missing; resolves true once accepted
    // or false if user cancels. Server-side requireConsent middleware
    // enforces the same check as a second line of defense.
    const consentOk = await consent.ensure('checkout');
    if (!consentOk) {
      // User cancelled the consent modal -- abort, page stays as-is
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

      // Charter entitlement: the seat is already covered ($0, no card). Show a
      // clear covered state on our step and let the user proceed on their own
      // terms via an explicit button (see the covered panel) — no auto-redirect,
      // so they can read it and defuse any payment anxiety. The hosted $0 Stripe
      // checkout then skips card entry on its own. When the flag is absent/false
      // this branch is skipped and the paid flow + redirect are unchanged.
      if (data.charterCovered === true) {
        setCharterCovered(true);
        setCharterUrl(data.url);
        setLoading(null);
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(null);
    }
  }

  // -- Fix #3 -- Submit the 6-digit verification code -------------------
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

      // Success -- update token with fresh emailVerified: true claim
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

  // -- Fix #3 -- Request a new verification code ------------------------
  async function handleResendCode() {
    if (resendCooldown > 0) return;
    setResendStatus('');
    // Anti-abuse: disable + start the visible countdown the instant the
    // button is pressed (not after the round-trip), so rapid repeats are
    // impossible. A real error below resets it so a transient failure does
    // not strand the candidate; a 429 honors the server's wait window.
    setResendCooldown(60);
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
        setResendCooldown(0);
        setResendStatus(data.error || 'Could not resend code. Please try again.');
        return;
      }

      setResendStatus('New code sent. Check your inbox and spam folder.');
      setVerifyError('');
    } catch {
      setResendCooldown(0);
      setResendStatus('Network error. Please try again.');
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: dsFont.body, color: ds.body, overflowX: 'hidden',
      background: 'radial-gradient(1100px 720px at 78% 0%, rgba(239,192,60,0.10), rgba(239,192,60,0) 60%), '
        + 'radial-gradient(900px 640px at 4% 100%, rgba(20,52,96,0.28), rgba(20,52,96,0) 62%), '
        + 'repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 96px), '
        + ds.bg }}>

      {/* 2px gold top hairline (ambient) */}
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(239,192,60,0.55), transparent)', zIndex: 30 }} />

      {/* -- Topbar (shared chrome) -- */}
      <Header variant="lite" right={<div style={{ fontSize: 10, color: ds.muted, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Blockchain-Verified CX Certification</div>} />

      {/* -- Hero -- */}
      <div className="vault-up" style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '64px 24px 40px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ds.eyebrow, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>
          {needsVerification ? 'Almost There' : 'Choose Your Path'}
        </div>
        <h1 style={{ fontFamily: dsFont.display, fontSize: 'clamp(34px, 4.4vw, 52px)', fontWeight: 500, color: ds.heading, lineHeight: 1.08, letterSpacing: '-0.01em', margin: '0 0 14px' }}>
          {needsVerification ? 'Verify your email' : 'Begin Your Certification'}
        </h1>
        <div style={{ width: 40, height: 1, background: ds.gold, opacity: 0.4, margin: '0 auto 20px' }} />
        <div style={{ fontSize: 15, color: ds.body, maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
          {needsVerification
            ? 'Enter the 6-digit code we just sent to your inbox to continue to secure payment.'
            : 'Complete your 40-question assessment and ATAC Call Readiness Simulator™ session. Pass and earn a blockchain-verified credential.'}
        </div>
      </div>

      {/* -- Cancelled banner -- */}
      {cancelled && !needsVerification && (
        <div style={{ background: 'rgba(196,138,42,0.08)', border: `1px solid rgba(196,138,42,0.25)`, borderRadius: 3, padding: '12px 24px', margin: '0 auto 24px', maxWidth: 600, textAlign: 'center', fontSize: 13, color: AMBER }}>
          Payment cancelled. No charge was made. Choose a tier below to continue.
        </div>
      )}

      {/* -- Error -- */}
      {error && !needsVerification && (
        <div style={{ background: 'rgba(196,92,92,0.08)', border: `1px solid rgba(196,92,92,0.25)`, borderRadius: 3, padding: '12px 24px', margin: '0 auto 24px', maxWidth: 600, textAlign: 'center', fontSize: 13, color: RED }}>
          {error}
        </div>
      )}

      {/* -- Charter-covered state (entitled $0 seat) OR verification OR tiers -- */}
      {charterCovered ? (
        <div className="vault-up" style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto 48px', padding: '0 24px' }}>
          <div
            role="status"
            aria-live="polite"
            style={{
              background: ds.panel,
              border: '1px solid rgba(127,203,166,0.4)',
              borderRadius: dsRadius.card,
              padding: '40px 36px',
              textAlign: 'center',
              boxShadow: '0 30px 70px -42px rgba(0,0,0,0.85)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: ds.greenText, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>
              Charter Cohort · Covered
            </div>
            <div style={{ fontFamily: dsFont.display, fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 500, color: ds.heading, lineHeight: 1.1, marginBottom: 10 }}>
              Charter seat covered
            </div>
            <div style={{ fontFamily: dsFont.display, fontSize: 52, color: ds.greenText, fontWeight: 500, lineHeight: 1, marginBottom: 16 }}>
              $0.00
            </div>
            <div style={{ fontSize: 15, color: ds.body, lineHeight: 1.7, marginBottom: 24 }}>
              No payment needed: your Charter entitlement covers this seat. You won't be asked for a card.
            </div>
            <button
              type="button"
              onClick={() => { if (charterUrl) window.location.href = charterUrl; }}
              disabled={!charterUrl}
              style={{ ...goldButton, width: '100%', padding: '15px 0', borderRadius: dsRadius.sm }}
            >
              Continue, no payment needed
            </button>
          </div>
        </div>
      ) : needsVerification ? (
        <div className="vault-up" style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto 48px', padding: '0 24px' }}>
          <div style={{ background: ds.panel, border: `1px solid ${ds.border}`, borderRadius: dsRadius.card, padding: '40px 36px', boxShadow: '0 30px 70px -42px rgba(0,0,0,0.85)' }}>

            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ds.eyebrow, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>
                Enter Verification Code
              </div>
              <div style={{ fontSize: 14, color: ds.body, lineHeight: 1.6 }}>
                Code sent to<br/>
                <span style={{ color: ds.gold, fontFamily: 'Consolas, monospace', fontSize: 13 }}>{candidateObj.email || 'your email'}</span>
              </div>
            </div>

            {/* Code input: six single-digit boxes, all backed by the same
                verificationCode string. The verify submit logic, the 6-digit
                format, and the verifyError gate are unchanged. */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    aria-label={`Verification code digit ${i + 1}`}
                    maxLength={1}
                    autoFocus={i === 0}
                    value={verificationCode[i] || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, '');
                      if (!d) return;
                      const next = (verificationCode.slice(0, i) + d.slice(-1) + verificationCode.slice(i + 1)).slice(0, 6);
                      setVerificationCode(next);
                      if (verifyError) setVerifyError('');
                      if (i < 5) otpRefs.current[i + 1]?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace') {
                        e.preventDefault();
                        if (verificationCode[i]) {
                          setVerificationCode(verificationCode.slice(0, i) + verificationCode.slice(i + 1));
                          if (verifyError) setVerifyError('');
                        } else if (i > 0) {
                          setVerificationCode(verificationCode.slice(0, i - 1) + verificationCode.slice(i));
                          otpRefs.current[i - 1]?.focus();
                        }
                      } else if (e.key === 'ArrowLeft' && i > 0) {
                        otpRefs.current[i - 1]?.focus();
                      } else if (e.key === 'ArrowRight' && i < 5) {
                        otpRefs.current[i + 1]?.focus();
                      } else if (e.key === 'Enter' && verificationCode.length === 6) {
                        handleVerifyEmail();
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
                      if (!pasted) return;
                      setVerificationCode(pasted);
                      if (verifyError) setVerifyError('');
                      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
                    }}
                    className="otp-box"
                    style={{
                      width: 48,
                      height: 58,
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${verifyError ? RED : ds.border}`,
                      borderRadius: dsRadius.sm,
                      color: ds.heading,
                      fontSize: 26,
                      fontFamily: 'Consolas, monospace',
                      fontWeight: 600,
                      textAlign: 'center',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>
              {verifyError && (
                <div style={{ fontSize: 12, color: RED, marginTop: 12, textAlign: 'center' }}>
                  {verifyError}
                </div>
              )}
            </div>

            {/* SPAM NOTICE. Visible by default, deliberately not behind a
                "having trouble?" toggle: the people who need it are the least
                likely to go looking for it. Adrian confirmed on 2026-08-31 that
                some confirmation emails did land in spam, so this is a
                statement of fact, not a hedge.

                The "mark it as not spam" ask is not a courtesy line. Each one is
                a positive engagement signal at the receiving provider and it
                improves delivery for everyone behind this user. */}
            <div style={{
              fontSize: 12, lineHeight: 1.6, color: MUTED,
              border: `1px solid ${FAINT}`, borderRadius: 6,
              padding: '10px 12px', margin: '12px 0 0',
            }}>
              {SPAM_NOTICE}
            </div>

            {/* Verify button */}
            <button
              onClick={handleVerifyEmail}
              disabled={verificationCode.length !== 6 || verifying}
              className="ds-cta-btn"
              style={{
                ...goldButton,
                width: '100%',
                padding: '15px 0',
                borderRadius: dsRadius.sm,
                marginBottom: 20,
                cursor: (verificationCode.length !== 6 || verifying) ? 'not-allowed' : 'pointer',
                ...((verificationCode.length !== 6 || verifying) ? { background: 'rgba(255,255,255,0.08)', color: ds.muted, boxShadow: 'none' } : {}),
              }}>
              {verifying ? 'Verifying…' : 'Verify & Continue to Payment'}
            </button>

            {/* Resend + spam-folder stopgap. Purely additive: the verify
                submit logic and the 6-digit code format are untouched. */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              {/* Live region so the resend confirmation/error is announced to
                  screen readers. Kept always-mounted so content changes fire. */}
              <div role="status" aria-live="polite">
                {resendStatus && (
                  <div style={{ fontSize: 12, color: resendStatus.includes('sent') ? ds.greenText : ds.muted, marginBottom: 10 }}>
                    {resendStatus}
                  </div>
                )}
                {/* Repeated after a successful resend: someone who just asked
                    for another copy is exactly the person who could not find the
                    first one. */}
                {resendStatus && resendStatus.includes('sent') && (
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: MUTED, marginBottom: 10 }}>
                    {SPAM_NOTICE}
                  </div>
                )}
              </div>
              <p style={{ fontSize: 12, color: ds.muted, lineHeight: 1.6, margin: '0 0 8px' }}>
                Didn't get the email? Check your spam folder, it may be there. Still nothing?
              </p>
              <button
                onClick={handleResendCode}
                disabled={resendCooldown > 0}
                aria-disabled={resendCooldown > 0 ? 'true' : undefined}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 ? ds.muted : ds.gold,
                  fontSize: 12,
                  fontFamily: dsFont.body,
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  padding: 0,
                  textDecoration: resendCooldown > 0 ? 'none' : 'underline',
                  textUnderlineOffset: 3,
                }}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>

            {/* Back */}
            <div style={{ textAlign: 'center', borderTop: `1px solid ${ds.border}`, paddingTop: 18 }}>
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
                  color: ds.muted,
                  fontSize: 12,
                  fontFamily: dsFont.body,
                  cursor: 'pointer',
                  padding: 0,
                }}>
                ← Back to plans
              </button>
            </div>

          </div>
        </div>
      ) : plansError ? (
        <div className="vault-up" style={{ maxWidth: 600, margin: '0 auto 48px', padding: '0 24px' }}>
          <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '30px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'rgba(238,233,223,0.82)', lineHeight: 1.6, marginBottom: 18 }}>{plansError}</div>
            <button
              onClick={() => setPlansNonce(n => n + 1)}
              style={{ background: GOLD, color: BG, border: 'none', borderRadius: 2, padding: '12px 28px', fontFamily: VAULT_BODY, fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="pricing-grid" style={{ position: 'relative', zIndex: 1, padding: '0 24px', maxWidth: 1060, margin: '0 auto 48px' }}>
          {plans === null
            ? [0, 1, 2].map((i) => <PlanSkeleton key={i} delay={i * 80} />)
            : plans.map((plan, i) => {
                const pres   = TIER_PRESENTATION[plan.tier] || { color: GOLD, features: [] };
                const isHighlighted = highlightedTier === plan.tier;
                // Contact-only (Team, or any plan flagged contactOnly): no price,
                // no seat selector, no Stripe checkout; never read unitAmount.
                const isContact = plan.contactOnly === true || plan.tier === 'team';
                const price  = isContact ? null : formatPrice(plan.unitAmount, plan.currency);
                const suffix = isContact ? '' : priceSuffix(plan);
                const cta    = isContact
                  ? null
                  : (plan.perSeat
                      ? `${price} / seat (Min ${TEAM_MIN_SEATS} seats)`
                      : `Start for ${price}`);
                return (
                  <div
                    key={plan.tier}
                    ref={el => { tierRefs.current[plan.tier] = el; }}
                    className={`tier-card vault-up${isHighlighted ? ' tier-card-highlighted' : ''}`}
                    style={{
                      background: ds.panel,
                      border: `1px solid ${plan.popular ? 'rgba(111,163,224,0.45)' : ds.border}`,
                      borderRadius: dsRadius.card,
                      padding: '30px 26px',
                      width: '100%',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: plan.popular ? '0 0 0 1px rgba(111,163,224,0.12), 0 30px 70px -42px rgba(0,0,0,0.85)' : 'none',
                      animationDelay: `${i * 80}ms`,
                    }}>

                    {/* Most Popular badge (blue token) */}
                    {plan.popular && (
                      <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: ds.popular, color: '#08121E', padding: '4px 16px', borderRadius: dsRadius.pill, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        Most Popular
                      </div>
                    )}

                    {/* Heading (capitalized tier) + full Stripe name as descriptor */}
                    <div style={{ fontSize: 10, fontWeight: 700, color: ds.eyebrow, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>{tierHeading(plan.tier)}</div>
                    {plan.name && (
                      <div style={{ fontSize: 11, color: ds.secondary2, lineHeight: 1.4, marginBottom: 12 }}>{plan.name}</div>
                    )}

                    {/* Price (omitted for contact-only plans) */}
                    {!isContact && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                        <span style={{ fontFamily: dsFont.display, fontSize: 52, color: ds.gold, fontWeight: 500, lineHeight: 1 }}>{price}</span>
                        {suffix && <span style={{ fontSize: 13, color: ds.body }}>{suffix}</span>}
                      </div>
                    )}

                    {/* Seat selector (per-seat, non-contact plans only; min enforced) */}
                    {plan.perSeat && !isContact && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 16px', background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '10px 12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: MUTED }}>Seats</span>
                        <input type="number" min={TEAM_MIN_SEATS} value={seats}
                          onChange={e => setSeats(Math.max(TEAM_MIN_SEATS, parseInt(e.target.value) || TEAM_MIN_SEATS))}
                          style={{ width: 56, padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER2}`, borderRadius: 2, color: WHITE, fontSize: 13, textAlign: 'center', fontFamily: VAULT_BODY, outline: 'none' }}
                        />
                        <span style={{ fontSize: 11, color: GOLD, fontFamily: VAULT_DISPLAY }}>= {formatPrice(seats * (Number(plan.unitAmount) || 0), plan.currency)} total</span>
                      </div>
                    )}

                    {/* Divider */}
                    <div style={{ height: 1, background: ds.border, margin: '16px 0' }} />

                    {/* Features (presentation-only; not carried by the API) */}
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flexGrow: 1 }}>
                      {pres.features.map((f, fi) => (
                        <li key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: ds.body, lineHeight: 1.55 }}>
                          <span style={{ color: ds.gold, flexShrink: 0, marginTop: 1 }}>◆</span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA: contact-only opens the lead form; Standard/Pro keep the
                        existing Stripe checkout (posts the tier string), unchanged. */}
                    {isContact ? (
                      <button
                        type="button"
                        onClick={() => setContactOpen(true)}
                        className="ds-cta-btn"
                        style={{ ...goldButton, width: '100%', padding: '14px 0', borderRadius: dsRadius.sm }}>
                        Contact sales
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePay(plan.tier)}
                        disabled={!!loading}
                        className="ds-cta-btn"
                        style={{
                          ...goldButton, width: '100%', padding: '14px 0', borderRadius: dsRadius.sm,
                          cursor: loading ? 'not-allowed' : 'pointer',
                          opacity: loading && loading !== plan.tier ? 0.4 : 1,
                          ...(loading === plan.tier ? { background: 'rgba(255,255,255,0.1)', color: ds.muted, boxShadow: 'none' } : {}),
                        }}>
                        {loading === plan.tier ? 'Redirecting to Stripe…' : cta}
                      </button>
                    )}
                  </div>
                );
              })}
        </div>
      )}

      {/* -- Trust strip (hidden for covered Charter seats — no payment context) -- */}
      {!charterCovered && (
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', fontSize: 11, color: ds.muted2, paddingBottom: 48, letterSpacing: '0.08em' }}>
          Secured by Stripe &nbsp;·&nbsp; Blockchain-verified &nbsp;·&nbsp; No subscription
        </div>
      )}

      {/* -- Consent modal (renders when consent.ensure() is pending) -- */}
      {consent.modal}

      {/* -- Team "Contact sales" lead form (built on ModalShell) -- */}
      <ContactSalesModal open={contactOpen} onClose={() => setContactOpen(false)} />

    </div>
  );
}

// Loading placeholder shown while GET /api/stripe/plans is in flight. Mirrors
// the tier-card shell; bars pulse (and hold static under reduced motion).
function PlanSkeleton({ delay = 0 }) {
  const bar = (w, h, mb) => (
    <div className="tier-skel-bar" style={{ width: w, height: h, marginBottom: mb }} />
  );
  return (
    <div
      className="tier-card vault-up"
      style={{ background: ds.panel, border: `1px solid ${ds.border}`, borderRadius: dsRadius.card, padding: '30px 26px', width: '100%', display: 'flex', flexDirection: 'column', animationDelay: `${delay}ms` }}
      aria-hidden="true"
    >
      {bar('40%', 10, 16)}
      {bar('55%', 44, 18)}
      <div style={{ height: 1, background: ds.border, margin: '16px 0' }} />
      {bar('90%', 12, 12)}
      {bar('80%', 12, 12)}
      {bar('85%', 12, 12)}
      {bar('70%', 12, 28)}
      {bar('100%', 42, 0)}
    </div>
  );
}


