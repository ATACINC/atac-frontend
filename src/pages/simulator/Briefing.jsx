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
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ background: BG1, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '32px 34px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 2, height: 16, background: GOLD, borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: GOLD, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
              {scenarioCode ? `${scenarioCode} · ${industry}` : `ATAC Call Readiness Simulator`}
            </span>
          </div>

          <h1 style={{ fontFamily: VAULT_DISPLAY, fontSize: 34, fontWeight: 400, color: WHITE, margin: '0 0 16px', lineHeight: 1.15 }}>
            You are about to speak with {personaName}.
          </h1>

          {/* Scenario metadata row: industry / difficulty / expected duration. */}
          {(session.industry || session.difficulty || session.expectedDurationMin || session.expectedDurationMax) && (
            <div className="sim-meta-row">
              {session.industry && (
                <div className="sim-meta-item">
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontFamily: VAULT_BODY }}>
                    Industry
                  </div>
                  <div style={{ fontSize: 14, color: WHITE, fontFamily: VAULT_BODY }}>
                    {session.industry}
                  </div>
                </div>
              )}
              {session.difficulty && (
                <div className="sim-meta-item">
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontFamily: VAULT_BODY }}>
                    Difficulty
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      border: `1px solid ${difficultyColor(session.difficulty)}`,
                      color: difficultyColor(session.difficulty),
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
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
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontFamily: VAULT_BODY }}>
                    Expected Duration
                  </div>
                  <div style={{ fontSize: 14, color: WHITE, fontFamily: VAULT_BODY }}>
                    {formatDuration(session.expectedDurationMin, session.expectedDurationMax)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Your Role - left-accent gold border. */}
          {session.agentRole && (
            <div
              style={{
                borderLeft: `3px solid ${GOLD}`,
                padding: '4px 0 4px 14px',
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontFamily: VAULT_BODY }}>
                Your Role
              </div>
              <div style={{ fontSize: 14, color: WHITE, fontFamily: VAULT_BODY, lineHeight: 1.5 }}>
                {session.agentRole}
              </div>
            </div>
          )}

          {/* About Your Customer - left-accent teal border. */}
          {(session.personaBio || session.scenarioContext) && (
            <div
              style={{
                borderLeft: `3px solid ${TEAL}`,
                padding: '4px 0 4px 14px',
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontFamily: VAULT_BODY }}>
                About Your Customer
              </div>
              <div style={{ fontSize: 14, color: WHITE, fontFamily: VAULT_BODY, lineHeight: 1.5 }}>
                {[session.personaBio, session.scenarioContext].filter(Boolean).join(' ')}
              </div>
            </div>
          )}

          {/* You Speak First - high-priority gold callout. Launch-day Change 2:
              heading reworded from "Recommended Opening" so candidates understand
              they must initiate the call. Customer is silent until they hear a
              greeting. */}
          {session.recommendedOpening && (
            <div
              style={{
                background: 'rgba(201,168,76,0.08)',
                border: `1px solid ${GOLD}`,
                borderRadius: 4,
                padding: '18px 20px',
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 14, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>
                You Speak First. Open With:
              </div>
              <div
                style={{
                  fontFamily: VAULT_DISPLAY,
                  fontStyle: 'italic',
                  fontSize: 16,
                  color: WHITE,
                  lineHeight: 1.4,
                  marginBottom: 10,
                }}
              >
                {session.recommendedOpening}
              </div>
              <div
                style={{
                  fontFamily: VAULT_BODY,
                  fontSize: 12,
                  color: MUTED,
                  lineHeight: 1.55,
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
              padding: '14px 18px',
              marginBottom: 18,
              fontSize: 13,
              color: WHITE,
              lineHeight: 1.65,
            }}
          >
            <div style={{ fontSize: 10, color: RED, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
              Your objective
            </div>
            {objective}
          </div>

          {/* What Good Looks Like (success criteria) - left-accent muted border. */}
          {session.successCriteria && (
            <div
              style={{
                borderLeft: `2px solid ${MUTED}`,
                padding: '4px 0 4px 14px',
                marginBottom: 22,
              }}
            >
              <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontFamily: VAULT_BODY }}>
                What Good Looks Like
              </div>
              <div style={{ fontSize: 13, color: WHITE, fontFamily: VAULT_BODY, lineHeight: 1.5 }}>
                {session.successCriteria}
              </div>
            </div>
          )}

          {/* How You'll Be Scored - now with weights and threshold summary. */}
          <div
            style={{
              background: 'rgba(238,233,223,0.02)',
              border: `1px solid ${BORDER2}`,
              borderRadius: 3,
              padding: '16px 20px',
              marginBottom: 24,
            }}
          >
            <h2
              style={{
                fontFamily: VAULT_DISPLAY,
                fontSize: 18,
                fontWeight: 400,
                color: WHITE,
                margin: '0 0 12px',
                lineHeight: 1.2,
              }}
            >
              How You&apos;ll Be Scored
            </h2>
            {SCORING_DIMENSIONS.map((d, i) => (
              <div
                key={d.name}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '8px 0',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div
                  style={{
                    fontFamily: VAULT_DISPLAY,
                    fontSize: 13,
                    fontWeight: 600,
                    color: GOLD,
                    minWidth: 92,
                  }}
                >
                  {d.name}
                </div>
                <span
                  style={{
                    display: 'inline-block',
                    minWidth: 36,
                    textAlign: 'center',
                    fontSize: 10,
                    color: MUTED,
                    fontFamily: VAULT_BODY,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    border: `1px solid ${BORDER2}`,
                    borderRadius: 999,
                    padding: '1px 6px',
                  }}
                >
                  {d.weight}%
                </span>
                <div
                  style={{
                    fontFamily: VAULT_BODY,
                    fontSize: 12,
                    color: WHITE,
                    lineHeight: 1.55,
                    flex: 1,
                  }}
                >
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
              Pass with an overall score of {session?.passThreshold ?? 70} or higher. Resolution and Empathy weigh the most.
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 12 }}>
              Microphone check
            </div>

            {micState === MIC_UNCHECKED && (
              <button
                type="button"
                onClick={checkMic}
                className="sim-mic-pulse"
                style={{ ...outlinedBtn(false), borderColor: GOLD, color: WHITE }}
              >
                Check Microphone Access
              </button>
            )}

            {micState === MIC_CHECKING && (
              <div style={{ fontSize: 13, color: MUTED }}>Requesting microphone access...</div>
            )}

            {micState === MIC_GRANTED && (
              <div style={{ fontSize: 13, color: TEAL2, fontWeight: 600 }}>
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
                  <button type="button" onClick={checkMic} style={outlinedBtn(false)}>
                    Try Again
                  </button>
                )}
              </>
            )}

            {/* Launch-day Change 1: explicit "required" note so candidates
                understand the mic check is not optional. */}
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

          {/* Launch-day Change 2: pre-flight checklist. All three items
              plus the mic check must resolve before Begin Call enables.
              Mic-tested auto-checks from micState. */}
          <div
            style={{
              background: 'rgba(238,233,223,0.02)',
              border: `1px solid ${BORDER2}`,
              borderRadius: 3,
              padding: '16px 20px',
              marginBottom: 22,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: MUTED,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 600,
                marginBottom: 12,
                fontFamily: VAULT_BODY,
              }}
            >
              Before You Begin
            </div>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={beginCall}
              disabled={!canBeginCall}
              style={primaryBtn(!canBeginCall)}
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
              Return to dashboard
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .sim-meta-row {
          display: flex;
          align-items: stretch;
          border-top: 1px solid ${BORDER2};
          border-bottom: 1px solid ${BORDER2};
          padding: 16px 0;
          margin-bottom: 22px;
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
        /* Launch-day Change 1: visual nudge on the mic check button so
           candidates notice it before BEGIN CALL. Removes itself once
           the mic check passes. */
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
