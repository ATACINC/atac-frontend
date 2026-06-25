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

const VoiceCall = lazy(() => import('../simulator/VoiceCall'));

// Vault palette (per-file convention used across the app).
const BG    = '#080B12';
const BG1   = '#0C1018';
const BG3   = '#141B26';
const GOLD  = '#C9A84C';
const RED   = '#C45C5C';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
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

  // Results. scoreState: { status: 'scoring' | 'done' | 'error', breakdown?, message? }
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
      setSignedUrl(url);
      setPhase('call');
    } catch {
      showToast('Network error. Please try again.', { type: 'error' });
    } finally {
      setStarting(false);
    }
  }

  // ---------- Step D: score the demonstration ----------
  async function runScore() {
    if (!conversationIdRef.current) {
      const msg = 'The demonstration did not capture a conversation to score. Please try again.';
      setScoreState({ status: 'error', message: msg });
      showToast(msg, { type: 'error' });
      return;
    }
    setScoreState({ status: 'scoring' });
    try {
      const res = await fetch(`${API_BASE}/api/sandbox/voice-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          accessCode: accessCode.trim(),
          conversation_id: conversationIdRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));

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
    return (
      <Shell>
        <div style={cardStyle}>
          <div style={eyebrowStyle}>ATAC Call Readiness Simulator</div>
          <h1 style={titleStyle}>Invite-only demonstration</h1>
          <p style={leadStyle}>
            Enter your email and the access code from your invitation to begin a live voice demonstration.
          </p>

          <form onSubmit={handleVerify} noValidate>
            <label style={labelStyle} htmlFor="sandbox-email">Email</label>
            <input
              id="sandbox-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
              style={{ ...inputStyle, borderColor: emailError ? RED : BORDER2 }}
              placeholder="you@example.com"
            />
            {emailError && <div style={fieldErrorStyle}>{emailError}</div>}

            <label style={{ ...labelStyle, marginTop: 18 }} htmlFor="sandbox-code">Access code</label>
            <input
              id="sandbox-code"
              type="text"
              autoComplete="one-time-code"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              style={inputStyle}
              placeholder="Your invitation code"
            />

            <button type="submit" disabled={verifying} style={primaryBtn(verifying)}>
              {verifying ? 'Checking...' : 'Continue'}
            </button>
          </form>
        </div>
      </Shell>
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
    // Light pre-call briefing. The three blocks below are reused verbatim
    // from the candidate pre-call briefing (Briefing.jsx): Your Objective,
    // the "you speak first" reminder, and Quick Reminders. No scenario,
    // scoring, mic-test, or credential copy is brought across.
    return (
      <Shell>
        <div style={cardStyle}>
          <div style={eyebrowStyle}>Your Objective</div>
          <p style={leadStyle}>Listen carefully and handle the call professionally.</p>

          <p style={{ ...leadStyle, marginBottom: 26 }}>
            The customer is waiting for you to greet them. Start speaking as soon as the call begins.
          </p>

          <div style={{ ...eyebrowStyle, marginBottom: 12 }}>Quick Reminders</div>
          <ul style={{ margin: '0 0 4px', paddingLeft: 20, color: 'rgba(238,233,223,0.76)', fontSize: 14, lineHeight: 1.8 }}>
            <li>Speak first when the call begins</li>
            <li>Aim for 4 to 6 minutes of conversation</li>
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
          onEnded={() => setPhase('results')}
        />
      </Suspense>
    );
  }

  // phase === 'results'
  return (
    <Shell wide>
      <DemoBanner />

      {scoreState.status === 'scoring' && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={eyebrowStyle}>Scoring</div>
          <p style={{ ...leadStyle, marginBottom: 0 }}>Scoring your demonstration. This usually takes under a minute.</p>
        </div>
      )}

      {scoreState.status === 'error' && (
        <div style={cardStyle}>
          <div style={{ ...eyebrowStyle, color: GOLD }}>Almost there</div>
          <p style={leadStyle}>{scoreState.message}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={runScore} style={primaryBtn(false)}>Try again</button>
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
      <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
        Demonstration
      </div>
      <div style={{ fontSize: 14, color: WHITE, lineHeight: 1.55 }}>
        This is a demonstration. No credential has been issued.
      </div>
    </div>
  );
}

function ResultsBreakdown({ breakdown }) {
  const data = breakdown || {};
  const feedback = (data.feedback && typeof data.feedback === 'object') ? data.feedback : {};
  // Overall is shown as a raw DEMONSTRATION score, never as a verdict or
  // against a threshold. pass_fail is intentionally not read or displayed.
  const overall = typeof data.overall === 'number' ? Math.round(data.overall) : null;

  return (
    <div style={{ ...cardStyle, maxWidth: 760 }}>
      <div style={eyebrowStyle}>Your demonstration results</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '6px 0 24px' }}>
        <span style={{ fontSize: 11, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
          Demonstration score
        </span>
        <span style={{ fontFamily: VAULT_DISPLAY, fontSize: 44, fontWeight: 600, color: GOLD, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {overall != null ? overall : 'NA'}
        </span>
      </div>

      <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14 }}>
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
        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 22, fontWeight: 400, color: WHITE, marginBottom: 14, lineHeight: 1.25 }}>
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
        <span style={{ fontSize: 14, color: WHITE, fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: 'Consolas, Menlo, monospace', fontSize: 16, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
          {score != null ? score : 'NA'}
        </span>
      </div>
      {feedback && (
        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginTop: 6, maxWidth: 620 }}>
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
      <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Connecting...</div>
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
  fontSize: 11,
  color: GOLD,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight: 700,
  marginBottom: 14,
};

const titleStyle = {
  fontFamily: VAULT_DISPLAY,
  fontSize: 30,
  fontWeight: 400,
  color: WHITE,
  margin: '0 0 14px',
  lineHeight: 1.15,
};

const leadStyle = {
  fontSize: 14,
  color: 'rgba(238,233,223,0.76)',
  lineHeight: 1.7,
  margin: '0 0 24px',
};

const labelStyle = {
  display: 'block',
  fontSize: 11,
  color: MUTED,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  fontWeight: 600,
  marginBottom: 8,
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '13px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${BORDER2}`,
  borderRadius: 2,
  color: WHITE,
  fontSize: 15,
  fontFamily: VAULT_BODY,
  outline: 'none',
};

const fieldErrorStyle = {
  fontSize: 12,
  color: RED,
  marginTop: 6,
};

function primaryBtn(disabled) {
  return {
    width: '100%',
    marginTop: 24,
    background: disabled ? 'rgba(201,168,76,0.4)' : GOLD,
    color: BG,
    border: 'none',
    borderRadius: 2,
    padding: '14px 22px',
    fontSize: 12,
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
  padding: '14px 22px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: VAULT_BODY,
};
