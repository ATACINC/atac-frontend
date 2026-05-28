/**
 * ATAC Platform - Briefing.jsx
 * Path: frontend/src/pages/simulator/Briefing.jsx
 *
 * Route: /simulator/briefing/:sessionId
 *
 * Reads the simulator session from sessionStorage (stashed by
 * SimulatorEntry or ScenarioPicker after /api/sim-live/assign succeeded).
 * Shows scenario context, persona briefing, and a microphone permission
 * check. On Begin Call, navigates to /simulator/call/:sessionId.
 *
 * If the sessionStorage payload is missing or stale, redirect back to
 * /simulator so the entry component can re-assign or resume cleanly.
 */

// Launch-day Phase 1 UX hardening.
//
// Today's launch revealed silent audio-capture failures: candidates
// (Kimberly Woodlock, Sashakay Bramwell) saw "Not this time. 0/70"
// scores with empty transcripts, indicating their mic never reached
// the scoring service. This file gates the call entry behind a
// mandatory mic test plus a 3-item readiness checklist so the failure
// surfaces BEFORE the call starts rather than after it.
//
// Companion change in Call.jsx: in-call mic activity indicator and
// 15-second silence detection banner.
//
// Smoke test plan (manual, fresh incognito):
//   1. Open /simulator/briefing/[sessionId] with mic permission ungranted
//   2. Verify BEGIN CALL is disabled (gold dim with not-allowed cursor)
//   3. Click "Check Microphone Access" -> deny permission ->
//      verify the bulleted troubleshooting list renders
//   4. Reload, click "Check Microphone Access" -> allow permission ->
//      verify the green "Microphone Ready" line shows
//   5. Verify BEGIN CALL is still disabled because the two manual
//      checklist boxes are unchecked
//   6. Tick "Quiet environment" and "I know my opening line"
//   7. Verify BEGIN CALL enables (gold solid, pointer cursor)
//   8. Click BEGIN CALL -> verify navigation to /simulator/call/[id]

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const BG    = '#080B12';
const BG1   = '#0C1018';
const GOLD  = '#C9A84C';
const TEAL  = '#1A8F69';
const TEAL2 = '#22A67E';
const RED   = '#C45C5C';
const RED2  = '#C84747';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

// Microphone permission states.
const MIC_UNCHECKED = 'unchecked';
const MIC_CHECKING  = 'checking';
const MIC_GRANTED   = 'granted';
const MIC_DENIED    = 'denied';
const MIC_NO_DEVICE = 'no_device';
const MIC_ERROR     = 'error';

// Static scoring rubric content (scenario-agnostic). Scenario-specific
// content (persona bio, opening line, success criteria) lives in a
// separate content-authoring pass.
const SCORING_DIMENSIONS = [
  { name: 'Greeting',   weight: 10, description: 'Warm, professional opening that sets the tone' },
  { name: 'Empathy',    weight: 25, description: "Acknowledging the customer's situation and emotions" },
  { name: 'Resolution', weight: 30, description: 'Identifying the issue and moving toward a clear outcome' },
  { name: 'Tone',       weight: 20, description: 'Calm, confident delivery throughout the call' },
  { name: 'Close',      weight: 15, description: 'Confirming next steps and ending the call cleanly' },
];

// Five Concrete Moves coaching content. Resolution is the systematic
// weak dimension across failing simulator attempts: transcripts show
// warm, clear service but candidates miss the five specific moves the
// Resolution rubric rewards. This panel surfaces those moves and a
// scenario-tailored worked example so candidates see the bar before
// they take their first attempt. We are NOT lowering the rubric; we
// are coaching candidates to hit the existing bar.
const FIVE_MOVES = [
  {
    label: 'The specific reason',
    desc: 'Name the real cause using a proper term, not a vague summary.',
  },
  {
    label: 'A reference number',
    desc: 'Give a case or confirmation ID the customer can keep.',
  },
  {
    label: 'A concrete figure',
    desc: 'State an actual dollar amount and timeline, never "we will bill you later".',
  },
  {
    label: 'A verification or escalation path',
    desc: 'Tell them how to dispute, confirm, or follow up.',
  },
  {
    label: 'A specific follow-up commitment',
    desc: 'When and how you will be in touch, and what they get in writing.',
  },
];

// Scenario-tailored worked example for the "What this sounds like"
// callout. Keyed by scenario_code. The framework is constant; the
// example changes so candidates can see the five moves applied to
// their specific scenario.
const RESOLUTION_WORKED_EXAMPLES = {
  'SC-001': 'Mr. [last name], you have called us twice on this and gotten nothing back, and that is on us. I am crediting both duplicate charges from the 3rd and the 17th back to your account today. Your reference number for the credit is TEL-2026-77412, and I am personally flagging your account so any future call goes to a senior care specialist instead of starting over. The credit will post within 2 business days; if you do not see it by [day-of-week plus 2 business days], call back with that reference and any agent can see exactly what I did. I am also sending you a written summary on the email on file before we hang up.',
  'SC-002': 'This $847 applies to your annual deductible, which is why your plan did not cover it. Your reference number is EOB-2026-04891. If you would like to dispute it, I can email you a claims-review form and you have 30 days to file. I can also set up a payment plan of $84.70 per month over 10 months starting July 1. I will send a written summary to your email today so you have everything in one place.',
  'SC-003': 'David, I have you down for cancellation. Before I process, is there anything specific about the workflow fit that, if we changed it tomorrow, would keep your team? No pressure either way. [If he declines:] Understood, I will not push it. I am processing the cancellation now. You will not be billed again. Your team retains access through the end of your current paid period, and your confirmation number is SAAS-2026-33015. I am sending the cancellation confirmation email in the next two minutes so it is in your inbox before your meeting. If you ever want to reactivate, that same number lets any agent restore your settings.',
  'SC-004': 'Ms. [last name], thank you for escalating this to me directly. What happened two nights ago is not an inconvenience, it is a failure on our part. A confirmed-in-writing executive suite was not available when you arrived with senior partners and your client. That should never happen, and the 50 percent refund you were offered does not reflect the weight of what we did. Here is what I am doing personally, today. Reference number CR-2026-88204. First: I am refunding the full stay, not 50 percent. Second: I am applying a credit of 2 complimentary nights at executive-suite tier at any property in our chain, valid for 24 months, with no blackout dates. Third: I am personally writing you a letter of apology you can share with the partners and your client; you will have it by end of business [day-of-week plus 1]. Fourth: I am assigning your firm a named Corporate Relations Manager so you have a direct line, not a queue, for all future bookings. I will call you back in 48 hours to confirm the credit has posted and that the named manager has reached out. If anything I have just promised falls short, my direct extension is [4-digit].',
};

const RESOLUTION_FALLBACK_EXAMPLE = 'Name the specific reason, give a reference number, state the exact amount and timeline, offer a way to verify or dispute, and commit to a specific follow-up.';

export default function Briefing() {
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams();

  const [session, setSession] = useState(null);
  const [micState, setMicState] = useState(MIC_UNCHECKED);
  const [micErrorText, setMicErrorText] = useState('');
  // Pre-flight checklist (launch-day fix Phase 1, Change 2). All three
  // items plus a successful mic check must resolve before Begin Call
  // enables. The mic-tested item auto-checks when micState === MIC_GRANTED.
  const [quietRoomChecked, setQuietRoomChecked] = useState(false);
  const [openingLineChecked, setOpeningLineChecked] = useState(false);

  // Load stashed session on mount. If missing or mismatched, bounce back
  // to /simulator so the entry can either resume or assign fresh.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('atac_sim_session');
      if (!raw) {
        // Session state lost or corrupted. Send user to dashboard rather than
        // attempting auto-reassign, which would issue a different scenario than
        // the one they originally started.
        navigate('/dashboard', { replace: true });
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed.sessionId || parsed.sessionId !== routeSessionId) {
        // Session state lost or corrupted. Send user to dashboard rather than
        // attempting auto-reassign, which would issue a different scenario than
        // the one they originally started.
        navigate('/dashboard', { replace: true });
        return;
      }
      setSession(parsed);
    } catch (_) {
      // Session state lost or corrupted. Send user to dashboard rather than
      // attempting auto-reassign, which would issue a different scenario than
      // the one they originally started.
      navigate('/dashboard', { replace: true });
    }
  }, [routeSessionId, navigate]);

  const checkMic = async () => {
    if (micState === MIC_CHECKING) return;
    setMicState(MIC_CHECKING);
    setMicErrorText('');

    if (typeof navigator?.mediaDevices?.getUserMedia !== 'function') {
      setMicState(MIC_NO_DEVICE);
      setMicErrorText('This browser does not support microphone access. Please use a recent version of Chrome, Edge, Firefox, or Safari.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the test stream immediately. Call.jsx will request its own
      // stream via the ElevenLabs SDK when the call actually starts.
      stream.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) { /* ignore */ }
      });
      setMicState(MIC_GRANTED);
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError') {
        setMicState(MIC_DENIED);
        setMicErrorText('Microphone access was blocked. Grant permission in your browser settings and try again.');
      } else if (name === 'Not' + 'F' + 'oundError') {
        setMicState(MIC_NO_DEVICE);
        setMicErrorText('We could not find a microphone on this device. Connect one and try again.');
      } else if (name === 'NotReadableError') {
        setMicState(MIC_ERROR);
        setMicErrorText('Your microphone appears to be in use by another application. Close other apps that use audio (video calls, recorders) and try again.');
      } else {
        setMicState(MIC_ERROR);
        setMicErrorText('Something went wrong starting your microphone. Try again or use a different browser.');
      }
    }
  };

  // Derived gate: all three checklist items plus mic must pass.
  const canBeginCall =
    micState === MIC_GRANTED && quietRoomChecked && openingLineChecked;

  const beginCall = () => {
    if (!canBeginCall) return;
    navigate(`/simulator/call/${routeSessionId}`);
  };

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: MUTED, fontFamily: VAULT_BODY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Loading briefing...</div>
      </div>
    );
  }

  // Scenario context is read from the canonical camelCase fields the
  // writer normalizes (see stashSimulatorSession in SimulatorEntry.jsx).
  const personaName    = session.personaName || 'your customer';
  const industry       = session.industry || '';
  const scenarioCode   = session.scenarioCode || '';
  const objective      = 'Listen carefully and handle the call professionally.';

  return (
    <div style={{ minHeight: '100vh', background: BG, color: WHITE, fontFamily: VAULT_BODY, padding: '48px 24px 60px' }}>
      <div className="sim-briefing-shell">

        {/* Top header row (above the two-column grid). At desktop the
            scenario context spans full width; columns split below. */}
        <div className="sim-briefing-card sim-briefing-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 2, height: 16, background: GOLD, borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: GOLD, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
              {scenarioCode ? `${scenarioCode} · ${industry}` : `ATAC Call Readiness Simulator`}
            </span>
          </div>

          <h1 className="sim-briefing-h1">
            You are about to speak with {personaName}.
          </h1>

          {/* Scenario metadata row: industry / difficulty / expected duration.
              Typography upsized for desktop-first layout (14px labels,
              18px values per spec). */}
          {(session.industry || session.difficulty || session.expectedDurationMin || session.expectedDurationMax) && (
            <div className="sim-meta-row sim-meta-row-desktop">
              {session.industry && (
                <div className="sim-meta-item">
                  <div className="sim-meta-label">Industry</div>
                  <div className="sim-meta-value">{session.industry}</div>
                </div>
              )}
              {session.difficulty && (
                <div className="sim-meta-item">
                  <div className="sim-meta-label">Difficulty</div>
                  <span
                    style={{
                      display: 'inline-block',
                      border: `1px solid ${difficultyColor(session.difficulty)}`,
                      color: difficultyColor(session.difficulty),
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: 13,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontFamily: VAULT_BODY,
                      fontWeight: 600,
                    }}
                  >
                    {session.difficulty}
                  </span>
                </div>
              )}
              {(session.expectedDurationMin || session.expectedDurationMax) && (
                <div className="sim-meta-item">
                  <div className="sim-meta-label">Expected Duration</div>
                  <div className="sim-meta-value">
                    {formatDuration(session.expectedDurationMin, session.expectedDurationMax)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Two-column grid: scenario context (60%) + action panel (40%) on
            desktop; single column on tablet/mobile with the action panel
            stacked BELOW so users finish reading context before they act. */}
        <div className="sim-briefing-grid">

          <div className="sim-briefing-card sim-briefing-left">

            {/* Your Role - left-accent gold border. Body bumped to 16px. */}
            {session.agentRole && (
              <div
                style={{
                  borderLeft: `3px solid ${GOLD}`,
                  padding: '4px 0 4px 18px',
                  marginBottom: 22,
                }}
              >
                <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, fontFamily: VAULT_BODY, fontWeight: 700 }}>
                  Your Role
                </div>
                <div style={{ fontSize: 16, color: WHITE, fontFamily: VAULT_BODY, lineHeight: 1.6 }}>
                  {session.agentRole}
                </div>
              </div>
            )}

            {/* About Your Customer - left-accent teal border. Body 16px. */}
            {(session.personaBio || session.scenarioContext) && (
              <div
                style={{
                  borderLeft: `3px solid ${TEAL}`,
                  padding: '4px 0 4px 18px',
                  marginBottom: 22,
                }}
              >
                <div style={{ fontSize: 11, color: TEAL, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, fontFamily: VAULT_BODY, fontWeight: 700 }}>
                  About Your Customer
                </div>
                <div style={{ fontSize: 16, color: WHITE, fontFamily: VAULT_BODY, lineHeight: 1.6 }}>
                  {[session.personaBio, session.scenarioContext].filter(Boolean).join(' ')}
                </div>
              </div>
            )}

            {/* You Speak First - left-column centerpiece. Upsized opening
                line, gold callout. Carries the "you go first" emphasis
                added in e04b95c with bigger, harder-to-miss typography. */}
            {session.recommendedOpening && (
              <div
                style={{
                  background: 'rgba(201,168,76,0.08)',
                  border: `1px solid ${GOLD}`,
                  borderRadius: 6,
                  padding: '28px',
                  marginBottom: 22,
                }}
              >
                <div className="sim-you-speak-first-label">
                  You Speak First. Open With:
                </div>
                <div className="sim-you-speak-first-line">
                  {session.recommendedOpening}
                </div>
                <div
                  style={{
                    fontFamily: VAULT_BODY,
                    fontSize: 15,
                    color: MUTED,
                    lineHeight: 1.5,
                  }}
                >
                  The customer is waiting for you to greet them. Start speaking as soon as the call begins.
                </div>
              </div>
            )}

            {/* Your Objective - existing red panel. */}
            <div
              style={{
                background: 'rgba(196,92,92,0.06)',
                border: '1px solid rgba(196,92,92,0.2)',
                borderRadius: 3,
                padding: '16px 20px',
                marginBottom: 18,
                fontSize: 14,
                color: WHITE,
                lineHeight: 1.65,
              }}
            >
              <div style={{ fontSize: 11, color: RED, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>
                Your Objective
              </div>
              {objective}
            </div>

            {/* What Good Looks Like (success criteria) - left-accent muted border. */}
            {session.successCriteria && (
              <div
                style={{
                  borderLeft: `2px solid ${MUTED}`,
                  padding: '4px 0 4px 18px',
                }}
              >
                <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, fontFamily: VAULT_BODY, fontWeight: 700 }}>
                  What Good Looks Like
                </div>
                <div style={{ fontSize: 14, color: WHITE, fontFamily: VAULT_BODY, lineHeight: 1.6 }}>
                  {session.successCriteria}
                </div>
              </div>
            )}

            {/* Five Moves to Nail Resolution - coaching panel (left-column).
                Resolution is the systematic weak dimension across simulator
                attempts. The framework is constant; the worked example below
                is scenario-tailored via RESOLUTION_WORKED_EXAMPLES lookup. */}
            <div style={{ marginTop: 26 }}>
              <div
                style={{
                  fontSize: 11,
                  color: GOLD,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                  fontFamily: VAULT_BODY,
                  fontWeight: 700,
                }}
              >
                Five Moves to Nail Resolution
              </div>
              <p
                style={{
                  fontSize: 15,
                  color: MUTED,
                  lineHeight: 1.6,
                  margin: '0 0 18px',
                  fontFamily: VAULT_BODY,
                }}
              >
                Warm and clear is the hard part, and you have it. To score well on Resolution, make sure you land all five of these before the call ends.
              </p>
              <ol
                style={{
                  margin: '0 0 22px',
                  padding: 0,
                  listStyle: 'none',
                }}
              >
                {FIVE_MOVES.map((m, i) => (
                  <li
                    key={m.label}
                    style={{
                      display: 'flex',
                      gap: 12,
                      marginBottom: 12,
                      fontFamily: VAULT_BODY,
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        minWidth: 22,
                        fontSize: 13,
                        color: GOLD,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {i + 1}.
                    </span>
                    <span>
                      <span style={{ fontSize: 14, color: WHITE, fontWeight: 600 }}>
                        {m.label}.
                      </span>{' '}
                      <span style={{ fontSize: 14, color: MUTED }}>{m.desc}</span>
                    </span>
                  </li>
                ))}
              </ol>

              {/* Scenario-tailored worked example callout (teal-tinted,
                  matches Quick Reminders styling from the right column). */}
              <div
                style={{
                  background: 'rgba(26,143,105,0.06)',
                  border: '1px solid rgba(26,143,105,0.3)',
                  borderRadius: 8,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: TEAL2,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: 10,
                    fontFamily: VAULT_BODY,
                  }}
                >
                  What This Sounds Like for {session.personaName || 'Your Customer'}
                </div>
                <div
                  style={{
                    fontFamily: VAULT_DISPLAY,
                    fontStyle: 'italic',
                    fontSize: 17,
                    color: WHITE,
                    lineHeight: 1.5,
                  }}
                >
                  {RESOLUTION_WORKED_EXAMPLES[session.scenarioCode] || RESOLUTION_FALLBACK_EXAMPLE}
                </div>
              </div>
            </div>

          </div>

          <aside className="sim-briefing-card sim-briefing-right">

            {/* How You'll Be Scored - compact rail format. Reference info,
                not focal: name in WHITE 14px, weight in GOLD 13px mono,
                description in MUTED 12px. */}
            <div className="sim-rail-block">
              <div className="sim-rail-label">How You&apos;ll Be Scored</div>
              {SCORING_DIMENSIONS.map((d, i) => (
                <div
                  key={d.name}
                  style={{
                    padding: '8px 0',
                    borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2 }}>
                    <span style={{ fontFamily: VAULT_BODY, fontSize: 14, color: WHITE, fontWeight: 600, flex: 1 }}>
                      {d.name}
                    </span>
                    <span style={{ fontFamily: 'Consolas, Menlo, monospace', fontSize: 13, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
                      {d.weight}%
                    </span>
                  </div>
                  <div style={{ fontFamily: VAULT_BODY, fontSize: 12, color: MUTED, lineHeight: 1.45 }}>
                    {d.description}
                  </div>
                </div>
              ))}
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  fontFamily: VAULT_BODY,
                  fontStyle: 'italic',
                  fontSize: 12,
                  color: MUTED,
                  lineHeight: 1.5,
                }}
              >
                Pass with an overall score of {session?.passThreshold ?? 70} or higher.
              </div>
            </div>

            {/* Microphone Check - existing logic from e04b95c preserved exactly. */}
            <div className="sim-rail-block">
              <div className="sim-rail-label">Microphone Check</div>

              {micState === MIC_UNCHECKED && (
                <button
                  type="button"
                  onClick={checkMic}
                  className="sim-mic-pulse"
                  style={{ ...outlinedBtn(false), borderColor: GOLD, color: WHITE, width: '100%' }}
                >
                  Check Microphone Access
                </button>
              )}

              {micState === MIC_CHECKING && (
                <div style={{ fontSize: 13, color: MUTED }}>Requesting microphone access...</div>
              )}

              {micState === MIC_GRANTED && (
                <div style={{ fontSize: 14, color: TEAL2, fontWeight: 600 }}>
                  ✓ Microphone Ready
                </div>
              )}

              {(micState === MIC_DENIED || micState === MIC_NO_DEVICE || micState === MIC_ERROR) && (
                <>
                  <div
                    role="alert"
                    style={{
                      padding: '14px 16px',
                      background: 'rgba(196,92,92,0.08)',
                      border: '1px solid rgba(196,92,92,0.32)',
                      borderRadius: 3,
                      color: WHITE,
                      fontSize: 13,
                      lineHeight: 1.55,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ color: RED, fontWeight: 600, marginBottom: 8 }}>
                      {micErrorText}
                    </div>
                    <div style={{ color: WHITE, marginBottom: 6 }}>
                      We could not access your microphone. Please:
                    </div>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 20, color: MUTED, lineHeight: 1.6 }}>
                      <li>Check that your browser has microphone permission for this site (click the lock icon in the address bar)</li>
                      <li>Try using Chrome or Edge on a desktop or laptop</li>
                      <li>Make sure no other application is using your microphone</li>
                      <li>Plug in a headset if your built-in mic is not working</li>
                    </ul>
                  </div>
                  {micState !== MIC_NO_DEVICE && (
                    <button type="button" onClick={checkMic} style={{ ...outlinedBtn(false), width: '100%' }}>
                      Try Again
                    </button>
                  )}
                </>
              )}

              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: MUTED,
                  letterSpacing: '0.04em',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}
              >
                Required. We cannot score your call without working audio.
              </div>
            </div>

            {/* Before You Begin - existing checklist from e04b95c preserved
                exactly. canBeginCall gate (mic + 2 manual boxes) intact. */}
            <div className="sim-rail-block">
              <div className="sim-rail-label">Before You Begin</div>
              <ChecklistItem
                checked={micState === MIC_GRANTED}
                label="Microphone tested"
                auto
              />
              <ChecklistItem
                checked={quietRoomChecked}
                onToggle={() => setQuietRoomChecked((v) => !v)}
                label="Quiet environment"
              />
              <ChecklistItem
                checked={openingLineChecked}
                onToggle={() => setOpeningLineChecked((v) => !v)}
                label="I know my opening line"
              />
            </div>

            {/* Quick Reminders - NEW teal-tinted reinforcement panel. */}
            <div
              style={{
                background: 'rgba(26,143,105,0.06)',
                border: '1px solid rgba(26,143,105,0.3)',
                borderRadius: 4,
                padding: '16px 20px',
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: TEAL2,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginBottom: 10,
                  fontFamily: VAULT_BODY,
                }}
              >
                Quick Reminders
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontFamily: VAULT_BODY,
                  fontSize: 14,
                  color: WHITE,
                  lineHeight: 1.5,
                }}
              >
                <li style={{ marginBottom: 4 }}>Speak first when the call begins</li>
                <li style={{ marginBottom: 4 }}>Aim for 4 to 6 minutes of conversation</li>
                <li>Watch your mic indicator during the call</li>
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={beginCall}
                disabled={!canBeginCall}
                style={{ ...primaryBtn(!canBeginCall), padding: '18px 24px', fontSize: 12 }}
              >
                Begin Call
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'transparent',
                  color: MUTED,
                  border: 'none',
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  padding: '6px 0',
                  fontFamily: VAULT_BODY,
                }}
              >
                Return to Dashboard
              </button>
            </div>

          </aside>

        </div>

      </div>
      <style>{`
        /* === Desktop-first two-column shell ============================ */
        .sim-briefing-shell {
          max-width: 1400px;
          margin: 0 auto;
        }
        .sim-briefing-card {
          background: ${BG1};
          border: 1px solid ${BORDER};
          border-radius: 4px;
          padding: 28px 30px;
        }
        .sim-briefing-header {
          margin-bottom: 28px;
        }
        .sim-briefing-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 28px;
          align-items: start;
        }
        .sim-briefing-left,
        .sim-briefing-right {
          min-width: 0; /* allow children to shrink in grid items */
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .sim-briefing-shell {
            max-width: 720px;
          }
        }
        @media (min-width: 1024px) {
          .sim-briefing-card {
            padding: 32px 36px;
          }
          .sim-briefing-grid {
            grid-template-columns: minmax(0, 60fr) minmax(0, 40fr);
            gap: 48px;
          }
          .sim-briefing-right {
            position: sticky;
            top: 80px;
          }
        }

        /* === Header h1 (responsive) ===================================== */
        .sim-briefing-h1 {
          font-family: ${VAULT_DISPLAY};
          font-size: 28px;
          font-weight: 400;
          color: ${WHITE};
          margin: 0 0 18px;
          line-height: 1.1;
        }
        @media (min-width: 768px) {
          .sim-briefing-h1 {
            font-size: 36px;
            margin-bottom: 22px;
          }
        }
        @media (min-width: 1024px) {
          .sim-briefing-h1 {
            font-size: 48px;
            margin-bottom: 24px;
          }
        }

        /* === Metadata row labels/values (upsized) ======================= */
        .sim-meta-label {
          font-size: 12px;
          color: ${MUTED};
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-family: ${VAULT_BODY};
          font-weight: 600;
        }
        .sim-meta-value {
          font-size: 18px;
          color: ${WHITE};
          font-family: ${VAULT_BODY};
          font-weight: 500;
        }
        @media (min-width: 1024px) {
          .sim-meta-label {
            font-size: 14px;
          }
        }

        /* === You Speak First panel typography =========================== */
        .sim-you-speak-first-label {
          font-size: 16px;
          color: ${GOLD};
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 14px;
          font-family: ${VAULT_BODY};
        }
        .sim-you-speak-first-line {
          font-family: ${VAULT_DISPLAY};
          font-style: italic;
          font-size: 20px;
          color: ${WHITE};
          line-height: 1.35;
          margin-bottom: 14px;
        }
        @media (min-width: 768px) {
          .sim-you-speak-first-label { font-size: 18px; }
          .sim-you-speak-first-line { font-size: 22px; }
        }
        @media (min-width: 1024px) {
          .sim-you-speak-first-label { font-size: 20px; }
          .sim-you-speak-first-line { font-size: 28px; line-height: 1.3; }
        }

        /* === Right column rail blocks =================================== */
        .sim-rail-block {
          margin-bottom: 24px;
        }
        .sim-rail-block:last-of-type {
          margin-bottom: 22px;
        }
        .sim-rail-label {
          font-size: 11px;
          color: ${MUTED};
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 12px;
          font-family: ${VAULT_BODY};
        }

        /* === Existing metadata-row flex (preserved) ===================== */
        .sim-meta-row {
          display: flex;
          align-items: stretch;
          border-top: 1px solid ${BORDER2};
          border-bottom: 1px solid ${BORDER2};
          padding: 16px 0;
          margin-bottom: 0;
        }
        .sim-meta-item {
          flex: 1 1 0;
          padding: 0 18px;
        }
        .sim-meta-item:first-child {
          padding-left: 0;
        }
        .sim-meta-item:last-child {
          padding-right: 0;
        }
        .sim-meta-item + .sim-meta-item {
          border-left: 1px solid ${BORDER2};
        }
        @media (max-width: 600px) {
          .sim-meta-row {
            flex-direction: column;
            gap: 14px;
            padding: 14px 0;
          }
          .sim-meta-item {
            padding: 0;
          }
          .sim-meta-item + .sim-meta-item {
            border-left: none;
            border-top: 1px solid ${BORDER2};
            padding-top: 14px;
          }
        }

        /* === Existing mic-check pulse (preserved from e04b95c) ========== */
        @keyframes sim-mic-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(201,168,76,0.25);
            border-color: rgba(201,168,76,0.45);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(201,168,76,0);
            border-color: ${GOLD};
          }
        }
        .sim-mic-pulse {
          animation: sim-mic-pulse 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function ChecklistItem({ checked, label, onToggle, auto }) {
  const interactive = !auto;
  const baseStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
    fontFamily: VAULT_BODY,
    fontSize: 13,
    color: WHITE,
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    cursor: interactive ? 'pointer' : 'default',
  };
  const box = (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 3,
        border: `1px solid ${checked ? TEAL2 : MUTED}`,
        background: checked ? 'rgba(34,166,126,0.15)' : 'transparent',
        color: TEAL2,
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {checked ? '✓' : ''}
    </span>
  );
  if (interactive) {
    return (
      <button type="button" onClick={onToggle} style={baseStyle} aria-pressed={checked}>
        {box}
        <span>{label}</span>
      </button>
    );
  }
  return (
    <div style={baseStyle} aria-label={`${label} (auto-checked when mic test passes)`}>
      {box}
      <span style={{ color: checked ? WHITE : MUTED }}>{label}</span>
      {!checked && (
        <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTED, fontStyle: 'italic' }}>
          waiting for mic check
        </span>
      )}
    </div>
  );
}

function difficultyColor(difficulty) {
  const d = String(difficulty || '').toUpperCase();
  if (d === 'EASY' || d === 'EASY-MEDIUM') return TEAL;
  if (d === 'MEDIUM') return GOLD;
  if (d === 'HARD' || d === 'HARD-PLUS') return RED2;
  return MUTED;
}

function formatDuration(min, max) {
  if (min && max) return `${min} to ${max} minutes`;
  if (min) return `${min} minutes`;
  if (max) return `${max} minutes`;
  return '';
}

// ---------- Shared button styles (kept inline for component portability)

function primaryBtn(disabled) {
  return {
    width: '100%',
    background: disabled ? 'rgba(201,168,76,0.4)' : GOLD,
    color: BG,
    border: 'none',
    borderRadius: 2,
    padding: '13px 18px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: VAULT_BODY,
  };
}

function outlinedBtn(disabled) {
  return {
    background: 'transparent',
    color: WHITE,
    border: `1px solid ${BORDER2}`,
    borderRadius: 2,
    padding: '11px 18px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: VAULT_BODY,
  };
}
