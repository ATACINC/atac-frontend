/**
 * ATAC Platform - SandboxPage.jsx
 * Path: frontend/src/pages/sandbox/SandboxPage.jsx
 *
 * Route: /sandbox  (PUBLIC, not behind PrivateRoute, not in the main nav)
 *
 * Invite-only voice demonstration for BPO and partner demos. An invitee
 * enters their email and a single-use access code, takes a live voice
 * demonstration of the ATAC Call Readiness Simulator, and sees a score
 * breakdown on screen. No credential is issued.
 *
 * Backend: POST /api/sandbox/verify-access, /voice-start, /voice-score.
 *
 * State is kept in React only for the session. The email and access code are
 * never written to localStorage or sessionStorage.
 *
 * The voice step (VoiceCall, which pulls the @elevenlabs/client SDK) is
 * lazy-loaded so the access gate's first paint stays light.
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { getEmailError, normalizeEmail } from '../../utils/validation';
import brandLogo from '../../assets/atac-globalcx-logo-header.png';
import certificateSeal from '../../assets/agcx-certificate-seal-cropped.png';

const VoiceCall = lazy(() => import('../simulator/VoiceCall'));

// Vault palette (per-file convention used across the app).
const BG    = '#080B12';
const BG1   = '#0C1018';
const BG3   = '#141B26';
const GOLD  = '#C9A84C';
const RED   = '#C45C5C';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.6)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const API_BASE = import.meta.env.VITE_API_URL;
// Exact registration link for the real credential (not the base domain).
const REGISTER_URL = 'https://app.atacglobalcx.com/login?action=register';

const DIMENSIONS = [
  { key: 'greeting',   label: 'Greeting' },
  { key: 'empathy',    label: 'Empathy' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'tone',       label: 'Tone' },
  { key: 'close',      label: 'Close' },
];

export default function SandboxPage() {
  const { showToast } = useToast();

  // phase: 'gate' | 'intro' | 'briefing' | 'call' | 'results'
  const [phase, setPhase] = useState('gate');

  // Gate inputs (React state only, never persisted).
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Assessment.
  const [starting, setStarting] = useState(false);
  const [signedUrl, setSignedUrl] = useState(null);
  const conversationIdRef = useRef(null);
  // Live transcript turns accumulated during the call, raw SDK shape
  // ({ source: 'user' | 'ai', message }). Ref only, never persisted.
  const transcriptRef = useRef([]);

  // Results. scoreState: { status: 'scoring' | 'finalizing' | 'done' | 'error', breakdown?, message? }
  const [scoreState, setScoreState] = useState({ status: 'scoring' });

  // ---------- Step B: access gate ----------
  async function handleVerify(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (verifying) return;

    const err = getEmailError(email);
    if (err) {
      setEmailError(err);
      return;
    }
    setEmailError('');
    if (!accessCode.trim()) {
      showToast('Please enter your access code.', { type: 'error' });
      return;
    }

    const normEmail = normalizeEmail(email);
    setVerifying(true);
    try {
      const res = await fetch(`${API_BASE}/api/sandbox/verify-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normEmail, accessCode: accessCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.allowed) {
        // Defensive read: accept camelCase or snake_case.
        const remaining = data.attemptsRemaining ?? data.attempts_remaining;
        if (typeof remaining === 'number' && remaining <= 0) {
          showToast('You have no demonstration attempts remaining.', { type: 'error' });
          return;
        }
        // Store the normalized email for the subsequent calls.
        setEmail(normEmail);
        setPhase('intro');
        return;
      }

      // Failure: surface the backend's clean message, never raw internals.
      showToast(
        data.error || 'We could not verify that access code. Please check your details and try again.',
        { type: 'error' }
      );
    } catch {
      showToast('Network error. Please try again.', { type: 'error' });
    } finally {
      setVerifying(false);
    }
  }

  // ---------- Step C: start the live demonstration ----------
  async function handleBegin() {
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetch(`${API_BASE}/api/sandbox/voice-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accessCode: accessCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        // Daily capacity reached. Return to the gate.
        showToast(data.error || 'The demonstration is at capacity for today. Please try again tomorrow.', { type: 'error' });
        setPhase('gate');
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'We could not start the demonstration. Please try again.', { type: 'error' });
        return;
      }

      // Normalize the signed URL (backend sends snake_case signed_url).
      const url = data.signed_url ?? data.signedUrl ?? null;
      if (!url) {
        showToast('We could not start the demonstration. Please try again.', { type: 'error' });
        return;
      }
      conversationIdRef.current = null;
      transcriptRef.current = [];
      setSignedUrl(url);
      setPhase('call');
    } catch {
      showToast('Network error. Please try again.', { type: 'error' });
    } finally {
      setStarting(false);
    }
  }

  // ---------- Step D: score the demonstration ----------
  // Sends the live transcript captured during the call so scoring does not
  // depend on the backend poll fallback. The live SDK source token "ai" (the
  // simulated customer) is translated to the backend role "agent"; "user"
  // (the person on the call) is sent unchanged. conversation_id is still
  // included so the backend poll fallback can run if the transcript is empty
  // or invalid.
  async function runScore(attempt = 0) {
    if (!conversationIdRef.current) {
      const msg = 'The demonstration did not capture a conversation to score. Please try again.';
      setScoreState({ status: 'error', message: msg });
      showToast(msg, { type: 'error' });
      return;
    }
    setScoreState({ status: attempt === 0 ? 'scoring' : 'finalizing' });

    // Translate each turn's live source token to the backend role token.
    const transcript = transcriptRef.current.map((turn) => ({
      role: turn.source === 'ai' ? 'agent' : turn.source,
      message: turn.message,
    }));

    try {
      const res = await fetch(`${API_BASE}/api/sandbox/voice-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          accessCode: accessCode.trim(),
          conversation_id: conversationIdRef.current,
          transcript,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 202 && data.pending) {
        // Backend still finalizing via its poll fallback. The client
        // transcript normally lets a quick retry succeed; after two retries
        // fall back to the manual Try Again affordance.
        if (attempt < 2) {
          setScoreState({ status: 'finalizing' });
          setTimeout(() => runScore(attempt + 1), 3000);
          return;
        }
        const msg = 'Scoring is taking longer than expected. Please try again.';
        setScoreState({ status: 'error', message: msg });
        showToast(msg, { type: 'warning' });
        return;
      }
      if (res.status === 422) {
        const msg = data.error || 'Your demonstration is still being processed. Please try again in a moment.';
        setScoreState({ status: 'error', message: msg });
        showToast(msg, { type: 'warning' });
        return;
      }
      if (!res.ok) {
        const msg = data.error || 'We could not score your demonstration. Please try again.';
        setScoreState({ status: 'error', message: msg });
        showToast(msg, { type: 'error' });
        return;
      }
      setScoreState({ status: 'done', breakdown: data });
    } catch {
      const msg = 'Network error. Please try again.';
      setScoreState({ status: 'error', message: msg });
      showToast(msg, { type: 'error' });
    }
  }

  // Score once when the call ends and we land on the results phase.
  useEffect(() => {
    if (phase !== 'results') return;
    runScore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---------- Render ----------
  if (phase === 'gate') {
    // On-brand entry gate (Vault tokens). The verify-access form wiring below
    // is unchanged: same handleVerify, email/accessCode state, emailError, and
    // verifying. Only the visual presentation differs from prior versions.
    const waveBars = Array.from({ length: 40 }, (_, i) => {
      const h = 14 + Math.round(24 * Math.abs(Math.sin(i * 0.5)) + 12 * Math.abs(Math.sin(i * 0.17 + 1)));
      return (
        <span
          key={i}
          style={{
            display: 'block', width: 3, height: h, borderRadius: 3, transformOrigin: 'bottom',
            background: 'linear-gradient(180deg, rgba(201,168,76,0), rgba(201,168,76,0.85))',
            animation: `sbxWave ${1.4 + (i % 7) * 0.12}s ease-in-out infinite`,
            animationDelay: `${i * 0.045}s`,
          }}
        />
      );
    });

    return (
      <div
        style={{
          position: 'relative',
          minHeight: '100vh',
          width: '100%',
          overflow: 'hidden',
          background:
            'radial-gradient(1100px 720px at 66% 6%, rgba(201,168,76,0.10), rgba(201,168,76,0) 60%), ' +
            'radial-gradient(900px 640px at 8% 92%, rgba(26,143,105,0.16), rgba(26,143,105,0) 62%), ' + BG,
          color: WHITE,
          fontFamily: VAULT_BODY,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <style>{gateCss}</style>

        {/* Top gold hairline */}
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.55), transparent)', zIndex: 5 }} />
        {/* Faint vertical grid */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.022) 0, rgba(255,255,255,0.022) 1px, transparent 1px, transparent 96px)', pointerEvents: 'none', zIndex: 0 }} />
        {/* Rotating seal watermark */}
        <img src={certificateSeal} alt="" aria-hidden="true" style={{ position: 'absolute', right: -180, top: '50%', width: 680, height: 'auto', opacity: 0.05, pointerEvents: 'none', userSelect: 'none', zIndex: 0, animation: 'sbxSpin 120s linear infinite' }} />
        {/* Bottom voice waveform */}
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 44, height: 64, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, opacity: 0.3, pointerEvents: 'none', zIndex: 0, WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)' }}>
          {waveBars}
        </div>

        {/* Header */}
        <header className="sbx-gate-header" style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 48px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <img src={brandLogo} alt="ATAC Global CX" style={{ height: 46, width: 'auto', display: 'block' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: '1px solid rgba(201,168,76,0.34)', borderRadius: 999 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD }}>Invitation required</span>
          </div>
        </header>

        {/* Main two-column */}
        <main className="sbx-gate-main" style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '52px 48px 86px' }}>
          <div className="sbx-gate-inner" style={{ width: '100%', maxWidth: 1200, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 64 }}>

            {/* LEFT */}
            <section className="sbx-gate-left" style={{ flex: '1 1 520px', minWidth: 300 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', border: '1px solid rgba(201,168,76,0.32)', borderRadius: 999 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, animation: 'sbxPulse 1.8s ease-in-out infinite' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: GOLD }}>LIVE</span>
                </span>
                <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 11 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} style={{ display: 'block', width: 2, height: 11, borderRadius: 2, transformOrigin: 'bottom', background: GOLD, animation: `sbxWave ${0.8 + i * 0.12}s ease-in-out infinite`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: MUTED }}>ATAC Call Readiness Simulator</span>
              </div>

              <h1 className="sbx-gate-h1" style={{ fontFamily: VAULT_DISPLAY, fontWeight: 500, fontSize: 'clamp(40px, 5vw, 60px)', lineHeight: 1.04, letterSpacing: '-0.01em', margin: '0 0 24px', color: WHITE }}>
                This is not a test.<br />
                <span style={{ fontStyle: 'italic', color: GOLD }}>It&apos;s a live call.</span>
              </h1>

              <p style={{ maxWidth: 524, fontSize: 18, lineHeight: 1.62, color: 'rgba(238,233,223,0.72)', margin: '0 0 32px' }}>
                You have been invited to a private voice demonstration. Handle a real customer scenario and watch ATAC score your empathy, tone, resolution, and call control, in real time, the way employers actually measure them.
              </p>

              {/* Illustrative sample card (decorative; not the user's actual scenario) */}
              <div style={{ maxWidth: 524, background: 'rgba(255,255,255,0.022)', border: `1px solid ${BORDER2}`, borderRadius: 16, padding: '18px 20px 16px', marginBottom: 30 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, animation: 'sbxPulse 1.8s ease-in-out infinite' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: GOLD }}>LIVE SIMULATION</span>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(238,233,223,0.4)' }}>ILLUSTRATIVE</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(238,233,223,0.4)' }}>SCORING, REAL TIME</span>
                </div>

                <div style={{ display: 'flex', gap: 11, marginBottom: 13 }}>
                  <div style={{ width: 26, height: 26, flex: '0 0 26px', borderRadius: '50%', background: 'rgba(26,143,105,0.25)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: WHITE }}>C</div>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: 'rgba(238,233,223,0.82)' }}>"I was charged for something I did not expect, and I need it sorted out today."</p>
                </div>
                <div style={{ display: 'flex', gap: 11 }}>
                  <div style={{ width: 26, height: 26, flex: '0 0 26px', borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: BG }}>A</div>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: WHITE }}>"I completely understand, and I am sorry. Let me pull up your account and make this right."</p>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  {[['Empathy', '86'], ['Resolution', '78'], ['Call Close', '84']].map(([label, val], i) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center', borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 20, color: GOLD }}>{val}</div>
                      <div style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'rgba(238,233,223,0.5)', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(238,233,223,0.42)', marginTop: 12, lineHeight: 1.5 }}>
                  Sample only. Your scenario is revealed after you enter.
                </div>
              </div>

              {/* Trust row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED }}>20+ Years CX Leadership</span>
                <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: '50%', background: GOLD }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED }}>Blockchain-Verified</span>
                <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: '50%', background: GOLD }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED }}>Multilingual by Design</span>
              </div>
            </section>

            {/* RIGHT / ACCESS CARD */}
            <section className="sbx-gate-right" style={{ position: 'relative', flex: '0 0 440px', maxWidth: 440, minWidth: 300 }}>
              <img src={certificateSeal} alt="ATAC Global CX Certification Authority" className="sbx-gate-seal" style={{ position: 'absolute', top: -30, right: -26, width: 100, height: 'auto', zIndex: 4, filter: 'drop-shadow(0 10px 22px rgba(0,0,0,0.6))' }} />
              <div style={{ position: 'relative', background: `linear-gradient(165deg, ${BG3}, ${BG})`, border: '1px solid rgba(201,168,76,0.22)', borderRadius: 18, padding: '34px 34px 30px', boxShadow: '0 40px 90px -36px rgba(0,0,0,0.85)', overflow: 'hidden' }}>
                <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, rgba(201,168,76,0), ${GOLD} 50%, rgba(201,168,76,0))` }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ width: 7, height: 7, background: GOLD, borderRadius: 2 }} />
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD }}>Invite-Only Demonstration</span>
                </div>

                <h2 style={{ fontFamily: VAULT_DISPLAY, fontWeight: 500, fontSize: 30, lineHeight: 1.1, margin: '0 0 9px', color: WHITE }}>Enter the simulator</h2>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: MUTED, margin: '0 0 26px' }}>Use the email and access code from your invitation to begin a live voice demonstration.</p>

                <form onSubmit={handleVerify} noValidate>
                  <label htmlFor="sandbox-email" style={gateFieldLabel}>Email</label>
                  <input
                    id="sandbox-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                    className="sbx-input"
                    style={{ ...gateInputStyle, borderColor: emailError ? RED : 'rgba(255,255,255,0.10)' }}
                    placeholder="you@company.com"
                  />
                  {emailError && <div style={{ fontSize: 13, color: RED, marginTop: 6 }}>{emailError}</div>}

                  <label htmlFor="sandbox-code" style={{ ...gateFieldLabel, marginTop: 18 }}>Access code</label>
                  <input
                    id="sandbox-code"
                    type="text"
                    autoComplete="one-time-code"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="sbx-input"
                    style={{ ...gateInputStyle, letterSpacing: '0.06em' }}
                    placeholder="Your invitation code"
                  />

                  <button type="submit" disabled={verifying} className="sbx-cta" style={gateCtaStyle(verifying)}>
                    {verifying ? 'Checking...' : 'Begin Demonstration'}
                  </button>
                </form>

                <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(238,233,223,0.5)', margin: '16px 0 0' }}>Private session. Nothing recorded without your consent.</p>
              </div>
            </section>

          </div>
        </main>

        {/* Footer */}
        <footer className="sbx-gate-footer" style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, letterSpacing: '0.08em', color: 'rgba(238,233,223,0.45)' }}>
          <span>2026 ATAC Global CX. Blockchain-verified credentials.</span>
          <span>app.atacglobalcx.com/sandbox</span>
        </footer>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <Shell>
        <div style={cardStyle}>
          <div style={eyebrowStyle}>Live demonstration</div>
          <h1 style={titleStyle}>You are about to start a live voice demonstration</h1>
          <p style={leadStyle}>
            This is a live demonstration of the ATAC Call Readiness Simulator. You will speak with a
            customer on a live voice call. Find a quiet spot, allow microphone access when prompted, and
            speak naturally.
          </p>
          <button type="button" onClick={() => setPhase('briefing')} style={primaryBtn(false)}>
            Continue
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === 'briefing') {
    // Fuller SC-002 briefing, mirroring the production candidate briefing for
    // the member-services scenario: overview, role, customer, intro script,
    // what good looks like, the five resolution moves with a worked example,
    // and quick reminders. The candidate scoring block is excluded entirely.
    return (
      <Shell wide>
        <div style={{ ...cardStyle, maxWidth: 640 }}>
          <div style={eyebrowStyle}>Overview</div>
          <p style={leadStyle}>This is a healthcare member services call. You will speak with a member about a billing question.</p>

          <div style={sectionLabelStyle}>Your Role</div>
          <p style={leadStyle}>You are a Member Services Representative at a health insurance company. You help members understand their benefits, billing, and claims.</p>

          <div style={sectionLabelStyle}>About Your Customer</div>
          <p style={leadStyle}>Linda, 67, retired widow, lives alone. She has been with this insurance plan for 11 years, originally through her late husband's employer and now through her own Medicare supplemental coverage. She received an Explanation of Benefits letter showing an $847 charge for a doctor visit she thought was covered. She doesn't fully understand what the letter is saying. The medical and insurance terms confuse her. She is not angry, she is worried and apologetic.</p>

          <div style={sectionLabelStyle}>You Speak First</div>
          <div style={openingCalloutStyle}>Thank you for calling Member Services, this is [your name]. How can I help you today?</div>
          <p style={leadStyle}>The customer is waiting for you to greet them. Start speaking as soon as the call begins.</p>

          <div style={sectionLabelStyle}>What Good Looks Like</div>
          <p style={leadStyle}>Explain what the charge means in plain language without insurance jargon. Confirm whether she actually owes the money or whether it's a billing error. Be patient, slow down, and let her ask things twice if she needs to.</p>

          <div style={sectionLabelStyle}>Five Moves to Nail Resolution</div>
          <p style={leadStyle}>Warm and clear is the hard part. To resolve the call well, make sure you land all five of these before the call ends.</p>
          <ol style={fiveMovesListStyle}>
            <li><strong>The specific reason:</strong> Name the real cause using a proper term, not a vague summary.</li>
            <li><strong>A reference number:</strong> Give a case or confirmation ID the customer can keep.</li>
            <li><strong>A concrete figure:</strong> State an actual dollar amount and timeline, never "we will bill you later".</li>
            <li><strong>A verification or escalation path:</strong> Tell them how to dispute, confirm, or follow up.</li>
            <li><strong>A specific follow-up commitment:</strong> When and how you will be in touch, and what they get in writing.</li>
          </ol>
          <div style={workedExampleStyle}>
            <div style={workedExampleLabelStyle}>What This Sounds Like for Linda</div>
            <p style={workedExampleTextStyle}>This $847 applies to your annual deductible, which is why your plan did not cover it. Your reference number is EOB-2026-04891. If you would like to dispute it, I can email you a claims-review form and you have 30 days to file. I can also set up a payment plan of $84.70 per month over 10 months starting July 1. I will send a written summary to your email today so you have everything in one place.</p>
          </div>

          <div style={sectionLabelStyle}>Quick Reminders</div>
          <ul style={quickRemindersListStyle}>
            <li>Speak first when the call begins</li>
            <li>Aim for 5 to 10 minutes of conversation</li>
            <li>Watch your mic indicator during the call</li>
          </ul>

          <button type="button" onClick={handleBegin} disabled={starting} style={primaryBtn(starting)}>
            {starting ? 'Starting...' : 'Begin the demonstration'}
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === 'call') {
    return (
      <Suspense fallback={<ConnectingScreen />}>
        <VoiceCall
          signedUrl={signedUrl}
          onConversationId={(id) => { conversationIdRef.current = id; }}
          onTranscriptTurn={(turn) => { transcriptRef.current.push(turn); }}
          onEnded={() => setPhase('results')}
        />
      </Suspense>
    );
  }

  // phase === 'results'
  return (
    <Shell wide>
      <DemoBanner />

      {(scoreState.status === 'scoring' || scoreState.status === 'finalizing') && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={eyebrowStyle}>{scoreState.status === 'finalizing' ? 'Finalizing' : 'Scoring'}</div>
          <p style={{ ...leadStyle, marginBottom: 0 }}>
            {scoreState.status === 'finalizing'
              ? 'Scoring is finalizing. This will just take a moment.'
              : 'Scoring your demonstration. This usually takes under a minute.'}
          </p>
        </div>
      )}

      {scoreState.status === 'error' && (
        <div style={cardStyle}>
          <div style={{ ...eyebrowStyle, color: GOLD }}>Almost there</div>
          <p style={leadStyle}>{scoreState.message}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => runScore()} style={primaryBtn(false)}>Try again</button>
            <button type="button" onClick={() => setPhase('intro')} style={secondaryBtn}>
              Start a new demonstration
            </button>
          </div>
        </div>
      )}

      {scoreState.status === 'done' && (
        <ResultsBreakdown breakdown={scoreState.breakdown} />
      )}
    </Shell>
  );
}

/* ============================================================
 * Results pieces
 * ============================================================ */

function DemoBanner() {
  return (
    <div
      role="status"
      style={{
        background: 'rgba(201,168,76,0.08)',
        border: `1px solid rgba(201,168,76,0.3)`,
        borderLeft: `3px solid ${GOLD}`,
        borderRadius: 4,
        padding: '14px 18px',
        marginBottom: 22,
        maxWidth: 760,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <div style={{ fontSize: 12, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>
        Demonstration
      </div>
      <div style={{ fontSize: 16, color: WHITE, lineHeight: 1.6 }}>
        This is a demonstration. No credential has been issued.
      </div>
    </div>
  );
}

function ResultsBreakdown({ breakdown }) {
  const data = breakdown || {};
  const feedback = (data.feedback && typeof data.feedback === 'object') ? data.feedback : {};
  // Overall is shown as a raw DEMONSTRATION score, never as a verdict.
  // pass_fail is intentionally not read or displayed.
  const overall = typeof data.overall === 'number' ? Math.round(data.overall) : null;

  return (
    <div style={{ ...cardStyle, maxWidth: 760 }}>
      <div style={eyebrowStyle}>Your demonstration results</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '6px 0 24px' }}>
        <span style={{ fontSize: 13, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
          Demonstration score
        </span>
        <span style={{ fontFamily: VAULT_DISPLAY, fontSize: 48, fontWeight: 600, color: GOLD, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {overall != null ? overall : 'NA'}
        </span>
      </div>

      <div style={{ fontSize: 12, color: MUTED, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14 }}>
        Breakdown
      </div>
      {DIMENSIONS.map((d) => (
        <DimensionRow
          key={d.key}
          label={d.label}
          score={typeof data[d.key] === 'number' ? Math.round(data[d.key]) : null}
          feedback={typeof feedback[d.key] === 'string' ? feedback[d.key] : ''}
        />
      ))}

      {/* Single call to action toward the real credential. */}
      <div
        style={{
          marginTop: 26,
          background: BG3,
          border: `1px solid ${BORDER2}`,
          borderRadius: 4,
          padding: '20px 22px',
        }}
      >
        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 24, fontWeight: 400, color: WHITE, marginBottom: 14, lineHeight: 1.25 }}>
          Want the real, blockchain-verified credential?
        </div>
        <a href={REGISTER_URL} style={{ ...primaryBtn(false), textDecoration: 'none', display: 'inline-block' }}>
          Get your credential
        </a>
      </div>
    </div>
  );
}

function DimensionRow({ label, score, feedback }) {
  return (
    <div style={{ padding: '12px 0', borderTop: `1px solid ${BORDER2}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 16, color: WHITE, fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: 'Consolas, Menlo, monospace', fontSize: 18, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
          {score != null ? score : 'NA'}
        </span>
      </div>
      {feedback && (
        <div style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, marginTop: 6, maxWidth: 620 }}>
          {feedback}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Layout + shared styles
 * ============================================================ */

function Shell({ children, wide }) {
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
        justifyContent: wide ? 'flex-start' : 'center',
        padding: wide ? '48px 20px 64px' : '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: wide ? 800 : 460 }}>{children}</div>
    </div>
  );
}

function ConnectingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: BG, color: MUTED, fontFamily: VAULT_BODY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Connecting...</div>
    </div>
  );
}

const cardStyle = {
  background: BG1,
  border: `1px solid ${BORDER2}`,
  borderRadius: 4,
  padding: '32px 30px',
  width: '100%',
  boxSizing: 'border-box',
  margin: '0 auto',
};

const eyebrowStyle = {
  fontSize: 13,
  color: GOLD,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  fontWeight: 700,
  marginBottom: 14,
};

const titleStyle = {
  fontFamily: VAULT_DISPLAY,
  fontSize: 32,
  fontWeight: 400,
  color: WHITE,
  margin: '0 0 14px',
  lineHeight: 1.2,
};

const leadStyle = {
  fontSize: 16,
  color: 'rgba(238,233,223,0.9)',
  lineHeight: 1.7,
  margin: '0 0 24px',
};

function primaryBtn(disabled) {
  return {
    width: '100%',
    marginTop: 24,
    background: disabled ? 'rgba(201,168,76,0.4)' : GOLD,
    color: BG,
    border: 'none',
    borderRadius: 2,
    padding: '15px 22px',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: VAULT_BODY,
  };
}

const secondaryBtn = {
  marginTop: 24,
  background: 'transparent',
  color: WHITE,
  border: `1px solid ${BORDER2}`,
  borderRadius: 2,
  padding: '15px 22px',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: VAULT_BODY,
};

/* ============================================================
 * Gate (entry) styles
 * ============================================================ */

const gateFieldLabel = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(238,233,223,0.55)',
  marginBottom: 8,
};

const gateInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '14px 16px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10,
  color: WHITE,
  fontSize: 15,
  fontFamily: VAULT_BODY,
  outline: 'none',
  transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
};

function gateCtaStyle(disabled) {
  return {
    width: '100%',
    marginTop: 26,
    padding: 15,
    border: 'none',
    borderRadius: 10,
    background: disabled ? 'rgba(201,168,76,0.4)' : `linear-gradient(135deg, #D8BA63, ${GOLD} 55%, #B6912F)`,
    color: BG,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 14px 30px -12px rgba(201,168,76,0.6)',
    transition: 'transform 0.15s, box-shadow 0.15s, filter 0.15s',
  };
}

const gateCss = `
  @keyframes sbxPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.8)} }
  @keyframes sbxWave { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
  @keyframes sbxSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .sbx-input::placeholder { color: rgba(238,233,223,0.32); }
  .sbx-input:focus { border-color: rgba(201,168,76,0.6); box-shadow: 0 0 0 3px rgba(201,168,76,0.13); background: rgba(255,255,255,0.05); }
  .sbx-cta:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  @media (max-width: 980px) { .sbx-gate-inner { gap: 48px !important; } }
  @media (max-width: 768px) {
    .sbx-gate-header { padding: 18px 24px !important; }
    .sbx-gate-main { padding: 40px 24px 72px !important; }
    /* Action-first on mobile: lift the entry card above the hero and the */
    /* illustrative sample so an invitee reaches the form without scrolling. */
    .sbx-gate-left { flex: 1 1 100% !important; min-width: 0 !important; order: 2 !important; }
    .sbx-gate-right { flex: 1 1 100% !important; max-width: 520px !important; min-width: 0 !important; order: 1 !important; }
    .sbx-gate-seal { width: 80px !important; top: -20px !important; right: -4px !important; }
    .sbx-gate-footer { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; padding: 18px 24px !important; }
  }
  @media (max-width: 480px) {
    .sbx-gate-header { padding: 14px 16px !important; flex-wrap: wrap !important; gap: 12px !important; }
    .sbx-gate-main { padding: 28px 16px 56px !important; }
    .sbx-gate-h1 { font-size: 34px !important; }
    .sbx-gate-seal { width: 66px !important; top: -14px !important; }
  }
`;

// Briefing-specific styles. Section labels reuse the eyebrow treatment with
// top spacing so the longer briefing stays skimmable, not a wall of text.
const sectionLabelStyle = { ...eyebrowStyle, marginTop: 30 };

const openingCalloutStyle = {
  background: 'rgba(201,168,76,0.08)',
  border: '1px solid rgba(201,168,76,0.35)',
  borderRadius: 4,
  padding: '16px 18px',
  margin: '0 0 14px',
  fontFamily: VAULT_DISPLAY,
  fontStyle: 'italic',
  fontSize: 19,
  color: WHITE,
  lineHeight: 1.45,
};

const fiveMovesListStyle = {
  margin: '0 0 18px',
  paddingLeft: 22,
  color: 'rgba(238,233,223,0.9)',
  fontSize: 16,
  lineHeight: 1.7,
};

const workedExampleStyle = {
  background: 'rgba(34,166,126,0.07)',
  border: '1px solid rgba(34,166,126,0.3)',
  borderRadius: 6,
  padding: '18px 20px',
  marginBottom: 4,
};

const workedExampleLabelStyle = {
  fontSize: 12,
  color: '#22A67E',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  fontWeight: 700,
  marginBottom: 10,
};

const workedExampleTextStyle = {
  fontFamily: VAULT_DISPLAY,
  fontStyle: 'italic',
  fontSize: 17,
  color: WHITE,
  lineHeight: 1.5,
  margin: 0,
};

const quickRemindersListStyle = {
  margin: '0 0 4px',
  paddingLeft: 22,
  color: 'rgba(238,233,223,0.9)',
  fontSize: 16,
  lineHeight: 1.9,
};
