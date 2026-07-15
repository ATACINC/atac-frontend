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
 * Backend: POST /api/sandbox/verify-access, /voice-start, /voice-score, and
 * GET /api/sandbox/scenario/:code (generic briefing config).
 *
 * State is kept in React only for the session. The email and access code are
 * never written to localStorage or sessionStorage.
 *
 * Post-gate visual flow follows the approved redesign (sandboxTheme +
 * SandboxBackground). The gate is NOT rebuilt; its background recipe is reused
 * and its typography is repointed to the shared Playfair/Hanken voice. The
 * scoring/transcript pipeline (transcript capture, ai->agent translation, the
 * voice-score POST, and the 202/422 handling) is unchanged.
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { getEmailError, normalizeEmail } from '../../utils/validation';
import brandLogo from '../../assets/atac-globalcx-logo-header.png';
import certificateSeal from '../../assets/agcx-certificate-seal-cropped.png';
import { T, scoreBand, goldCta, ghostCta } from './sandboxTheme';
import {
  SandboxFrame, SandboxConnecting, MicOrb, ScoreDonut, Dot,
  InfoIcon, CheckIcon, WarnIcon, ArrowIcon, MicIcon,
} from './SandboxBackground';

const VoiceCall = lazy(() => import('../simulator/VoiceCall'));

// Vault palette (per-file convention; the gate still uses these tokens).
const BG    = '#080B12';
const BG3   = '#141B26';
const GOLD  = '#C9A84C';
const RED   = '#C45C5C';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.6)';
const BORDER2 = 'rgba(238,233,223,0.07)';
// Reskinned to the shared sandbox type voice (Playfair Display + Hanken
// Grotesk). Type only; the gate's layout, colours, and wiring are unchanged.
const VAULT_DISPLAY = "'Playfair Display', Georgia, 'Times New Roman', serif";
const VAULT_BODY    = "'Hanken Grotesk', system-ui, -apple-system, sans-serif";

const API_BASE = import.meta.env.VITE_API_URL;
// Exact registration link for the real credential (not the base domain).
const REGISTER_URL = 'https://app.atacglobalcx.com/login?action=register';
const SANDBOX_SCENARIO_CODE = 'SC-002';

const DIMENSIONS = [
  { key: 'greeting',   label: 'Greeting' },
  { key: 'empathy',    label: 'Empathy' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'tone',       label: 'Tone' },
  { key: 'close',      label: 'Close' },
];

// Local fallback so the Briefing renders even if the scenario request fails.
// Mirrors the live SC-002 config; ASCII, no smart quotes or dashes.
const SCENARIO_FALLBACK = {
  code: 'SC-002',
  sector: 'Health Insurance',
  persona: { name: 'Linda', age: 67, descriptor: 'Retired widow, 11-year member', avatarInitial: 'L' },
  emotionalRead: 'Worried, apologetic',
  difficulty: 'MEDIUM',
  suggestedLength: '4-6 min',
  firstLine: 'Thank you for calling Member Services, this is [your name]. How can I help you today?',
  role: 'You are a Member Services Representative at a health insurance company. You help members understand their benefits, billing, and claims.',
  aboutCustomer: 'Linda, 67, is a retired widow who lives alone. She has been with this plan for 11 years, originally through her late husband\'s employer, now through her own Medicare supplemental coverage. She received an Explanation of Benefits letter showing an $847 charge for a doctor visit she thought was covered. She does not fully understand what the letter is saying; the medical and insurance terms confuse her. She is not angry, she is worried and apologetic.',
  whatGoodLooksLike: 'Explain what the charge means in plain language, without insurance jargon. Confirm whether she actually owes the money or whether it is a billing error. Be patient, slow down, and let her ask things twice if she needs to.',
  fiveMoves: [
    { n: 1, title: 'The specific reason', body: 'name the real cause using a proper term, not a vague summary.' },
    { n: 2, title: 'A reference number', body: 'give a case or confirmation ID the customer can keep.' },
    { n: 3, title: 'A concrete figure', body: 'state an actual dollar amount and timeline, never "we will bill you later".' },
    { n: 4, title: 'A verification or escalation path', body: 'tell her how to dispute, confirm, or follow up.' },
    { n: 5, title: 'A specific follow-up commitment', body: 'when and how you will be in touch, and what she gets in writing.' },
  ],
};

const isNoAttempts = (status, data) => status === 403 && /no attempts/i.test((data && data.error) || '');

export default function SandboxPage() {
  const { showToast } = useToast();

  // phase: 'gate' | 'intro' | 'briefing' | 'call' | 'results' | 'exhausted'
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

  // Scenario briefing config (fetched once after entry; SC-002 fallback).
  const [scenario, setScenario] = useState(null);

  // Server-minted attempt token from voice-start (the backend's move to
  // count-attempts-on-score). React state only; lives for the session across
  // intro -> call -> results. Backward-compatible: stays null until/unless the
  // backend returns one, and nothing is gated on its presence.
  const [attemptToken, setAttemptToken] = useState(null);

  // Scenario selection. verify-access returns allowedScenarios [{ code, name,
  // sector }]: one entry for a normal invite, several for an internal QA code.
  // scenarioCode is the chosen (multi) or single code; it drives the briefing
  // fetch, voice-start, and voice-score. It stays null only while a
  // multi-scenario invitee has not yet picked on the Ready screen.
  const [allowedScenarios, setAllowedScenarios] = useState([]);
  const [scenarioCode, setScenarioCode] = useState(null);

  // CRM-style customer account card from voice-start. Populated for the
  // vulnerability scenarios, null for SC-002 and legacy scenarios (and null
  // whenever a start fails). Display only: it is handed to the call screen and
  // read by nothing else -- never scored, never persisted.
  const [customerProfile, setCustomerProfile] = useState(null);

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
          setPhase('exhausted');
          return;
        }
        // Store the allowed scenarios. One entry (or none, on an older backend)
        // keeps the no-picker flow and its single code; more than one shows the
        // Ready-screen picker and leaves scenarioCode null until the invitee
        // chooses.
        const scenarios = Array.isArray(data.allowedScenarios) ? data.allowedScenarios : [];
        setAllowedScenarios(scenarios);
        if (scenarios.length <= 1) {
          setScenarioCode(scenarios[0]?.code || SANDBOX_SCENARIO_CODE);
        }
        // Store the normalized email for the subsequent calls.
        setEmail(normEmail);
        setPhase('intro');
        return;
      }

      // Out of attempts: show the dedicated exhausted screen, not a toast.
      if (isNoAttempts(res.status, data)) {
        setPhase('exhausted');
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
    // Clear any previous card up front: a start that fails below must never
    // leave the last call's account facts on screen.
    setCustomerProfile(null);
    try {
      const res = await fetch(`${API_BASE}/api/sandbox/voice-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accessCode: accessCode.trim(), scenarioCode }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        // Daily capacity reached. Return to the gate.
        showToast(data.error || 'The demonstration is at capacity for today. Please try again tomorrow.', { type: 'error' });
        setPhase('gate');
        return;
      }
      if (isNoAttempts(res.status, data)) {
        setPhase('exhausted');
        return;
      }
      // A scenario whose agent is not yet provisioned returns 503. Surface a
      // plain-language message and keep the invitee on the briefing so they can
      // pick another; attempts are counted on score, so nothing is spent here.
      if (res.status === 503) {
        showToast('This scenario is not available yet. Please try another, or check back shortly.', { type: 'error' });
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
      // Hold the attempt token if voice-start minted one (else stay null).
      setAttemptToken(data.attempt_token ?? data.attemptToken ?? null);
      // Optional account card. Absent or null for scenarios without one.
      setCustomerProfile(data.customer_profile ?? data.customerProfile ?? null);
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
          // The scored scenario, required by the backend v2 scoring path.
          scenarioCode,
          // Echo the attempt token when present; omitted entirely otherwise so
          // the current backend behaves exactly as it does today.
          ...(attemptToken ? { attempt_token: attemptToken } : {}),
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

  // Fetch the briefing config for the chosen scenario once the invitee is past
  // the gate and a code is resolved. Waits for scenarioCode (null while a
  // multi-scenario invitee has not yet picked). The render uses the SC-002
  // fallback until (or unless) this resolves; picking a different scenario
  // clears `scenario` so this re-fetches for the new code.
  useEffect(() => {
    if (!scenarioCode || phase === 'gate' || phase === 'exhausted' || scenario) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sandbox/scenario/${scenarioCode}`);
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!cancelled && data && typeof data === 'object' && data.persona) setScenario(data);
      } catch { /* keep the fallback */ }
    })();
    return () => { cancelled = true; };
  }, [phase, scenario, scenarioCode]);

  // ---------- Render ----------
  if (phase === 'gate') {
    // On-brand entry gate (Vault tokens). The verify-access form wiring below
    // is unchanged: same handleVerify, email/accessCode state, emailError, and
    // verifying. Only the visual presentation differs from prior versions.
    // Full-width signature waveform. Many bars distributed edge to edge via
    // justify-content: space-between on a left:0/right:0 band (full viewport
    // width within the unconstrained gate root). Heights scaled up for a
    // taller, more confident band; the band is shortened on mobile by a CSS
    // transform (see gateCss) rather than re-rendering fewer bars.
    const waveBars = Array.from({ length: 88 }, (_, i) => {
      const h = 16 + Math.round(46 * Math.abs(Math.sin(i * 0.5)) + 22 * Math.abs(Math.sin(i * 0.17 + 1)));
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
        {/* Full-width signature waveform: spans the entire bottom edge of the
            viewport as an ambient horizontal band. Sits at zIndex 0 behind the
            content; the access card is opaque and the footer carries a dark
            scrim, so legibility is preserved. */}
        <div aria-hidden="true" className="sbx-wave" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 112, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', opacity: 0.28, pointerEvents: 'none', zIndex: 0, WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 2.5%, #000 97.5%, transparent 100%)', maskImage: 'linear-gradient(90deg, transparent 0, #000 2.5%, #000 97.5%, transparent 100%)' }}>
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
        <main className="sbx-gate-main" style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '72px 48px 100px' }}>
          <div className="sbx-gate-inner" style={{ width: '100%', maxWidth: 1320, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 64 }}>

            {/* LEFT */}
            <section className="sbx-gate-left" style={{ flex: '1 1 520px', minWidth: 300 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
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

              <h1 className="sbx-gate-h1" style={{ fontFamily: VAULT_DISPLAY, fontWeight: 500, fontSize: 'clamp(38px, 6vw, 80px)', lineHeight: 1.04, letterSpacing: '-0.01em', margin: '0 0 28px', color: WHITE }}>
                This is not a test.<br />
                <span style={{ fontStyle: 'italic', color: GOLD }}>It&apos;s a live call.</span>
              </h1>

              <p style={{ maxWidth: 560, fontSize: 21, lineHeight: 1.62, color: 'rgba(238,233,223,0.72)', margin: '0 0 40px' }}>
                You have been invited to a private voice demonstration. Handle a real customer scenario and watch ATAC score your empathy, tone, resolution, and call control, in real time, the way employers actually measure them.
              </p>

              {/* Illustrative sample card (decorative; not the user's actual scenario) */}
              <div style={{ maxWidth: 560, background: 'rgba(255,255,255,0.022)', border: `1px solid ${BORDER2}`, borderRadius: 16, padding: '18px 20px 16px', marginBottom: 40 }}>
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
                  <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5, color: 'rgba(238,233,223,0.82)' }}>"I was charged for something I did not expect, and I need it sorted out today."</p>
                </div>
                <div style={{ display: 'flex', gap: 11 }}>
                  <div style={{ width: 26, height: 26, flex: '0 0 26px', borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: BG }}>A</div>
                  <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5, color: WHITE }}>"I completely understand, and I am sorry. Let me pull up your account and make this right."</p>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  {[['Empathy', '86'], ['Resolution', '78'], ['Call Close', '84']].map(([label, val], i) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center', borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 22, color: GOLD }}>{val}</div>
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
            <section className="sbx-gate-right" style={{ position: 'relative', flex: '0 0 512px', maxWidth: 512, minWidth: 300 }}>
              <img src={certificateSeal} alt="ATAC Global CX Certification Authority" className="sbx-gate-seal" style={{ position: 'absolute', top: -30, right: -26, width: 100, height: 'auto', zIndex: 4, filter: 'drop-shadow(0 10px 22px rgba(0,0,0,0.6))' }} />
              <div style={{ position: 'relative', background: `linear-gradient(165deg, ${BG3}, ${BG})`, border: '1px solid rgba(201,168,76,0.22)', borderRadius: 18, padding: '34px 34px 30px', boxShadow: '0 40px 90px -36px rgba(0,0,0,0.85)', overflow: 'hidden' }}>
                <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, rgba(201,168,76,0), ${GOLD} 50%, rgba(201,168,76,0))` }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ width: 7, height: 7, background: GOLD, borderRadius: 2 }} />
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD }}>Invite-Only Demonstration</span>
                </div>

                <h2 style={{ fontFamily: VAULT_DISPLAY, fontWeight: 500, fontSize: 38, lineHeight: 1.1, margin: '0 0 10px', color: WHITE }}>Enter the simulator</h2>
                <p style={{ fontSize: 15.5, lineHeight: 1.55, color: MUTED, margin: '0 0 28px' }}>Use the email and access code from your invitation to begin a live voice demonstration.</p>

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
        <footer className="sbx-gate-footer" style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(0deg, rgba(8,11,18,0.96), rgba(8,11,18,0.6))', fontSize: 11, letterSpacing: '0.08em', color: 'rgba(238,233,223,0.45)' }}>
          <span>2026 ATAC Global CX. Blockchain-verified credentials.</span>
          <span>app.atacglobalcx.com/sandbox</span>
        </footer>
      </div>
    );
  }

  const sc = scenario || SCENARIO_FALLBACK;

  if (phase === 'intro') {
    return (
      <SandboxFrame step={0}>
        <ReadyScreen
          allowedScenarios={allowedScenarios}
          scenarioCode={scenarioCode}
          onPick={(code) => { setScenarioCode(code); setScenario(null); }}
          onContinue={() => setPhase('briefing')}
        />
      </SandboxFrame>
    );
  }

  if (phase === 'briefing') {
    return (
      <SandboxFrame step={1}>
        <BriefingScreen scenario={sc} starting={starting} onBegin={handleBegin} />
      </SandboxFrame>
    );
  }

  if (phase === 'call') {
    return (
      <Suspense fallback={<SandboxFrame step={2} headerRight={<span />}><SandboxConnecting /></SandboxFrame>}>
        <VoiceCall
          variant="sandbox"
          signedUrl={signedUrl}
          personaName={sc?.persona?.name}
          customerProfile={customerProfile}
          onConversationId={(id) => { conversationIdRef.current = id; }}
          onTranscriptTurn={(turn) => { transcriptRef.current.push(turn); }}
          onEnded={() => { setCustomerProfile(null); setPhase('results'); }}
        />
      </Suspense>
    );
  }

  if (phase === 'exhausted') {
    return (
      <SandboxFrame step={null}>
        <ExhaustedScreen />
      </SandboxFrame>
    );
  }

  // phase === 'results'
  return (
    <SandboxFrame step={3}>
      {(scoreState.status === 'scoring' || scoreState.status === 'finalizing') && (
        <FinalizingScreen status={scoreState.status} />
      )}
      {scoreState.status === 'error' && (
        <ErrorScreen
          onRetry={() => runScore()}
          onRestart={() => setPhase('intro')}
        />
      )}
      {scoreState.status === 'done' && (
        <DebriefScreen
          breakdown={scoreState.breakdown}
          onTryAgain={() => setPhase('briefing')}
          onRestart={() => setPhase('intro')}
        />
      )}
    </SandboxFrame>
  );
}

/* ============================================================
 * Post-gate screens (redesign)
 * ============================================================ */

function ReadyScreen({ allowedScenarios = [], scenarioCode, onPick, onContinue }) {
  const preps = [
    { title: 'Find a quiet space', body: 'Background noise affects how the customer hears you.', icon: <HeadsetIcon /> },
    { title: 'Allow microphone access', body: 'Your browser will ask once the call connects.', icon: <MicIcon size={15} color={T.goldBright} /> },
    { title: 'Speak naturally', body: 'Talk to the customer the way you would on a real call.', icon: <ChatIcon /> },
  ];
  // More than one allowed scenario (an internal QA code) requires a choice
  // before Continue; a single-scenario invite shows no picker and continues
  // freely on today's single code.
  const multi = Array.isArray(allowedScenarios) && allowedScenarios.length > 1;
  const needsChoice = multi && !scenarioCode;
  return (
    <section className="sbx-fade sbx-pad" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 40px 72px' }}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <MicOrb />
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: T.goldSoft, margin: '30px 0 16px' }}>Live Demonstration</div>
        <h1 className="sbx-h" style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontSize: 'clamp(32px, 4.4vw, 46px)', lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 18px', color: T.ink }}>
          You are about to start a<br />
          <span style={{ fontStyle: 'italic', color: T.goldSoft }}>live voice demonstration</span>
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.62, color: T.muted, margin: '0 auto 34px', maxWidth: 470 }}>
          You will speak with a customer on a live voice call. Find a quiet spot, allow microphone access when prompted, and speak naturally.
        </p>

        {multi && (
          <div style={{ maxWidth: 440, margin: '0 auto 30px', textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.goldSoft, marginBottom: 12, textAlign: 'center' }}>Choose your scenario</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allowedScenarios.map((s) => {
                const selected = s.code === scenarioCode;
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => onPick(s.code)}
                    aria-pressed={selected}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                      width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: T.fontBody,
                      padding: '15px 17px', borderRadius: 12,
                      background: selected ? 'rgba(239,192,60,0.1)' : T.panel,
                      border: `1px solid ${selected ? T.gold : T.panelLine}`,
                      transition: 'border-color 160ms ease, background 160ms ease',
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: T.ink2 }}>{s.name}</span>
                      <span style={{ display: 'block', fontSize: 13, color: T.faint, marginTop: 2 }}>{s.sector}</span>
                    </span>
                    <span aria-hidden="true" style={{ width: 18, height: 18, flex: '0 0 18px', borderRadius: '50%', border: `2px solid ${selected ? T.gold : 'rgba(255,255,255,0.22)'}`, background: selected ? T.gold : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selected && <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.bg }} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 440, margin: '0 auto 34px', textAlign: 'left' }}>
          {preps.map((p) => (
            <div key={p.title} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', background: T.panel, border: `1px solid ${T.panelLine}`, borderRadius: 12 }}>
              <span style={{ width: 30, height: 30, flex: '0 0 30px', borderRadius: 8, background: 'rgba(239,192,60,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.icon}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.ink2 }}>{p.title}</div>
                <div style={{ fontSize: 13.5, color: T.faint }}>{p.body}</div>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={onContinue} disabled={needsChoice} className="sbx-cta" style={{ ...goldCta, width: '100%', maxWidth: 440, opacity: needsChoice ? 0.45 : 1, cursor: needsChoice ? 'not-allowed' : 'pointer' }}>
          Continue <ArrowIcon />
        </button>
        {needsChoice && (
          <p style={{ fontSize: 12.5, color: T.faint, margin: '12px 0 0' }}>Choose a scenario to continue.</p>
        )}
        <p style={{ fontSize: 12.5, color: T.faint2, margin: '16px 0 0', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Private session <Dot /> This is a demonstration, not a graded assessment
        </p>
      </div>
    </section>
  );
}

function BriefingScreen({ scenario, starting, onBegin }) {
  const p = scenario.persona || {};
  const diffMap = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  const filled = diffMap[String(scenario.difficulty || '').toUpperCase()] ?? 2;
  const moves = Array.isArray(scenario.fiveMoves) && scenario.fiveMoves.length ? scenario.fiveMoves : SCENARIO_FALLBACK.fiveMoves;

  const briefRow = (label, body) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.goldSoft, marginBottom: 11 }}>{label}</div>
      <p style={{ margin: 0, fontSize: 18, lineHeight: 1.66, color: '#BFC2CB' }}>{body}</p>
    </div>
  );
  const divider = <div aria-hidden="true" style={{ height: 1, background: T.panelLine }} />;

  return (
    <section className="sbx-fade sbx-pad" style={{ flex: 1, padding: '40px 40px 56px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: T.goldSoft }}>Your Scenario</span>
          <Dot />
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.faint2 }}>{scenario.sector}</span>
        </div>
        <h1 className="sbx-h" style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontSize: 'clamp(30px, 3.6vw, 42px)', lineHeight: 1.12, margin: '0 0 28px', color: T.ink }}>Read the brief, then take the call</h1>

        <div className="sbx-brief-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 34, alignItems: 'start' }}>
          {/* LEFT RAIL */}
          <aside className="sbx-brief-rail" style={{ position: 'sticky', top: 96, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: `linear-gradient(165deg, ${T.navy1}, ${T.navy2})`, border: '1px solid rgba(239,192,60,0.2)', borderRadius: 16, padding: 22, boxShadow: '0 30px 70px -34px rgba(0,0,0,0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, flex: '0 0 48px', borderRadius: '50%', background: T.avatarBg, border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.fontDisplay, fontSize: 19, color: '#D7E0EF' }}>{p.avatarInitial || (p.name || '?').charAt(0)}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F1ECDF' }}>{p.name}{p.age ? `, ${p.age}` : ''}</div>
                  <div style={{ fontSize: 13, color: T.faint }}>{p.descriptor}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, paddingTop: 14, borderTop: `1px solid ${T.panelLine}` }}>
                <BriefStat label="Sector" value={scenario.sector} />
                <BriefStat label="Emotional read" value={scenario.emotionalRead} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: T.faint }}>Difficulty</span>
                  <span style={{ display: 'inline-flex', gap: 3 }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i < filled ? T.gold : 'rgba(255,255,255,0.15)' }} />
                    ))}
                  </span>
                </div>
                <BriefStat label="Suggested length" value={scenario.suggestedLength} />
              </div>
            </div>

            <div style={{ background: 'rgba(239,192,60,0.05)', border: '1px solid rgba(239,192,60,0.22)', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldSoft, marginBottom: 10 }}>You speak first</div>
              <p style={{ margin: 0, fontFamily: T.fontDisplay, fontStyle: 'italic', fontSize: 18, lineHeight: 1.5, color: '#EFEADD' }}>"{scenario.firstLine}"</p>
            </div>

            <button type="button" onClick={onBegin} disabled={starting} className="sbx-cta" style={{ ...goldCta, opacity: starting ? 0.6 : 1, cursor: starting ? 'not-allowed' : 'pointer' }}>
              {starting ? 'Starting...' : <>Begin the call <ArrowIcon /></>}
            </button>
          </aside>

          {/* RIGHT BRIEF */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            {briefRow('Your role', scenario.role)}
            {divider}
            {briefRow('About your customer', scenario.aboutCustomer)}
            {divider}
            {briefRow('What good looks like', scenario.whatGoodLooksLike)}
            {divider}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.goldSoft, marginBottom: 6 }}>Five moves to nail resolution</div>
              <p style={{ margin: '0 0 18px', fontSize: 16, lineHeight: 1.55, color: '#8E9099' }}>Warm and clear is the hard part. To resolve the call well, land all five before it ends.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {moves.map((m) => (
                  <div key={m.n} style={{ display: 'flex', gap: 14, padding: '15px 17px', background: T.panel, border: `1px solid ${T.panelLine}`, borderRadius: 13 }}>
                    <span style={{ width: 27, height: 27, flex: '0 0 27px', borderRadius: '50%', background: 'rgba(239,192,60,0.12)', border: '1px solid rgba(239,192,60,0.34)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.fontDisplay, fontSize: 14, color: T.goldBright }}>{m.n}</span>
                    <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: '#C7CAD2' }}>
                      <strong style={{ color: '#EFEADD', fontWeight: 600 }}>{m.title}.</strong> {m.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BriefStat({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12.5, color: T.faint }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#D7D9DF', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function FinalizingScreen({ status }) {
  return (
    <section className="sbx-fade sbx-pad" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 40px 72px' }}>
      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <MicOrb />
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: T.goldSoft, margin: '30px 0 14px' }}>{status === 'finalizing' ? 'Finalizing' : 'Scoring'}</div>
        <h1 className="sbx-h" style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontSize: 'clamp(28px, 3.6vw, 40px)', lineHeight: 1.12, margin: '0 0 16px', color: T.ink }}>Scoring your call</h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: T.muted, margin: '0 auto 26px', maxWidth: 420 }}>
          {status === 'finalizing'
            ? 'Almost done. Please keep this tab open while we finish.'
            : 'This usually takes under a minute. Please keep this tab open while we finish.'}
        </p>
        <div aria-hidden="true" style={{ width: '100%', maxWidth: 340, height: 6, margin: '0 auto', borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '100%', borderRadius: 3, backgroundImage: `linear-gradient(90deg, rgba(239,192,60,0) 0%, ${T.gold} 45%, ${T.goldBright} 50%, ${T.gold} 55%, rgba(239,192,60,0) 100%)`, backgroundSize: '160% 100%', animation: 'sbxShimmer 1.4s linear infinite' }} />
        </div>
      </div>
    </section>
  );
}

function ErrorScreen({ onRetry, onRestart }) {
  return (
    <section className="sbx-fade sbx-pad" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px 64px' }}>
      <div style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
        <DemoBanner />
        <div style={{ width: 84, height: 84, margin: '8px auto 26px', borderRadius: '50%', background: 'radial-gradient(circle at 50% 38%, #2a2310, #15110a)', border: '1px solid rgba(232,185,104,0.34)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <WarnIcon size={34} />
        </div>
        <h1 className="sbx-h" style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontSize: 'clamp(28px, 3.6vw, 40px)', lineHeight: 1.12, margin: '0 0 16px', color: T.ink }}>That call did not record cleanly</h1>
        <p style={{ fontSize: 18, lineHeight: 1.62, color: T.muted, margin: '0 auto 22px', maxWidth: 440 }}>
          Something interrupted the recording before we could score it. No problem, you can try again.
        </p>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 15px', borderRadius: 999, background: 'rgba(127,203,166,0.12)', border: '1px solid rgba(127,203,166,0.34)', marginBottom: 30 }}>
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: T.green }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.greenInk }}>This did not count against your attempts.</span>
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 440, margin: '0 auto' }}>
          <button type="button" onClick={onRetry} className="sbx-cta" style={goldCta}>Try again</button>
          <button type="button" onClick={onRestart} className="sbx-ghost" style={ghostCta}>Start a new demonstration</button>
        </div>
      </div>
    </section>
  );
}

function ExhaustedScreen() {
  return (
    <section className="sbx-fade sbx-pad" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px 64px' }}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <DemoBanner />
        <div style={{ width: 84, height: 84, margin: '8px auto 26px', borderRadius: '50%', background: 'radial-gradient(circle at 50% 38%, #14233c, #0a1322)', border: '1px solid rgba(239,192,60,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckIcon size={34} color={T.goldBright} />
        </div>
        <h1 className="sbx-h" style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontSize: 'clamp(28px, 3.6vw, 42px)', lineHeight: 1.12, margin: '0 0 16px', color: T.ink }}>You have used both attempts</h1>
        <p style={{ fontSize: 18, lineHeight: 1.62, color: T.muted, margin: '0 auto 30px', maxWidth: 460 }}>
          That is all the demonstration attempts for this invitation. Nothing was issued or saved, this was a demonstration only.
        </p>
        <CredentialUpsell />
      </div>
    </section>
  );
}

function DebriefScreen({ breakdown, onTryAgain, onRestart }) {
  const data = breakdown || {};
  const overall = typeof data.overall === 'number' ? Math.round(data.overall) : null;
  const band = data.band || '';
  const summary = data.summary || '';
  const pill = scoreBand(overall);

  const dims = (Array.isArray(data.dimensions) && data.dimensions.length)
    ? data.dimensions
    : DIMENSIONS.map((d) => ({ name: d.label, score: data[d.key], feedback: (data.feedback || {})[d.key] || '' }));

  return (
    <section className="sbx-fade sbx-pad" style={{ flex: 1, padding: '40px 40px 60px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <DemoBanner />

        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: T.goldSoft, marginBottom: 10 }}>Your Debrief</div>
        <h1 className="sbx-h" style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontSize: 'clamp(30px, 3.8vw, 44px)', lineHeight: 1.1, margin: '0 0 26px', color: T.ink }}>Here is how that call landed</h1>

        {/* Overall */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', background: `linear-gradient(165deg, ${T.navy1}, ${T.navy2})`, border: '1px solid rgba(239,192,60,0.2)', borderRadius: 18, padding: '26px 30px', marginBottom: 8, boxShadow: '0 30px 70px -36px rgba(0,0,0,0.8)' }}>
          <div style={{ flex: '0 0 auto', width: 122, height: 122, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ScoreDonut value={overall} />
          </div>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.goldSoft, marginBottom: 11 }}>Demonstration Score</div>
            {band && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 13px', borderRadius: 999, background: pill.pillBg, border: `1px solid ${pill.pillBorder}`, marginBottom: 13 }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: pill.dot }} />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: pill.pillInk }}>{band}</span>
              </span>
            )}
            {summary && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.62, color: T.muted }}>{summary}</p>}
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.goldSoft, margin: '30px 0 0' }}>Breakdown</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 30 }}>
          {dims.map((d, i) => (
            <DimensionRow key={`${d.name}-${i}`} name={d.name} score={typeof d.score === 'number' ? Math.round(d.score) : null} feedback={typeof d.feedback === 'string' ? d.feedback : ''} />
          ))}
        </div>

        <CredentialUpsell />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 440 }}>
          <button type="button" onClick={onTryAgain} className="sbx-cta" style={goldCta}>Try this scenario again</button>
          <button type="button" onClick={onRestart} className="sbx-ghost" style={ghostCta}>Start a new demonstration</button>
        </div>
      </div>
    </section>
  );
}

function DimensionRow({ name, score, feedback }) {
  const c = scoreBand(score);
  const pct = typeof score === 'number' ? `${Math.max(0, Math.min(100, score))}%` : '0%';
  return (
    <div style={{ padding: '21px 0', borderTop: `1px solid ${T.panelLine}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span aria-hidden="true" style={{ width: 9, height: 9, flex: '0 0 9px', borderRadius: '50%', background: c.dot }} />
          <span style={{ fontSize: 16.5, fontWeight: 700, color: '#EFEADD' }}>{name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15, flex: '0 0 auto' }}>
          <span aria-hidden="true" style={{ width: 124, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', display: 'block', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: pct, background: c.bar, borderRadius: 3 }} />
          </span>
          <span style={{ fontFamily: T.fontDisplay, fontSize: 23, lineHeight: 1, color: c.scoreColor, minWidth: 34, textAlign: 'right' }}>{score != null ? score : 'NA'}</span>
        </div>
      </div>
      {feedback && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.64, color: T.muted, maxWidth: 640 }}>{feedback}</p>}
    </div>
  );
}

function CredentialUpsell() {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #13223d, #0a1320)', border: '1px solid rgba(239,192,60,0.3)', borderRadius: 18, padding: '30px 32px', marginBottom: 34, boxShadow: '0 30px 70px -36px rgba(0,0,0,0.8)' }}>
      <img src={certificateSeal} alt="" aria-hidden="true" style={{ position: 'absolute', right: -46, top: '50%', transform: 'translateY(-50%)', width: 200, height: 'auto', opacity: 0.12, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', maxWidth: 540 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: T.goldSoft, marginBottom: 12 }}>Make it count</div>
        <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontSize: 26, lineHeight: 1.18, margin: '0 0 12px', color: T.ink }}>Want the real, blockchain-verified credential?</h3>
        <p style={{ margin: '0 0 22px', fontSize: 16, lineHeight: 1.62, color: '#AEB1BA' }}>
          This was a demonstration. Take the full assessment to earn a CRSA(TM) credential you can share with employers, verifiable on-chain and issued by ATAC Global CX.
        </p>
        <a href={REGISTER_URL} className="sbx-cta" style={{ ...goldCta, textDecoration: 'none' }}>
          Get your credential <ArrowIcon />
        </a>
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 18px', background: 'rgba(239,192,60,0.06)', border: '1px solid rgba(239,192,60,0.26)', borderRadius: 12, marginBottom: 28, textAlign: 'left' }}>
      <InfoIcon size={17} color={T.goldSoft} />
      <span style={{ fontSize: 14, lineHeight: 1.5, color: '#E9D9AE' }}>
        <strong style={{ color: T.goldSoft, fontWeight: 700 }}>This is a demonstration.</strong> No credential has been issued. This debrief is for your eyes only.
      </span>
    </div>
  );
}

/* ---------- small inline icons used only by the Ready prep cards ---------- */
function HeadsetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.goldBright} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.goldBright} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/* ============================================================
 * Gate (entry) styles
 * ============================================================ */

const gateFieldLabel = {
  display: 'block',
  fontSize: 12,
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
  fontSize: 17,
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
    fontSize: 15,
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
    /* Keep the signature waveform full-width on mobile but shorter, so it */
    /* frames the bottom without crowding the stacked content. */
    .sbx-wave { transform: scaleY(0.66); transform-origin: bottom; }
  }
  @media (max-width: 480px) {
    .sbx-gate-header { padding: 14px 16px !important; flex-wrap: wrap !important; gap: 12px !important; }
    .sbx-gate-main { padding: 28px 16px 56px !important; }
    .sbx-gate-h1 { font-size: 34px !important; }
    .sbx-gate-seal { width: 66px !important; top: -14px !important; }
    .sbx-wave { transform: scaleY(0.5); transform-origin: bottom; }
  }
`;
