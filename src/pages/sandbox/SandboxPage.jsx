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

const labelStyle = {
  display: 'block',
  fontSize: 13,
  color: MUTED,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 600,
  marginBottom: 8,
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '14px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${BORDER2}`,
  borderRadius: 2,
  color: WHITE,
  fontSize: 16,
  fontFamily: VAULT_BODY,
  outline: 'none',
};

const fieldErrorStyle = {
  fontSize: 13,
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
