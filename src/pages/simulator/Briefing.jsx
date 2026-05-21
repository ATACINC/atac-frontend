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

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const BG    = '#080B12';
const BG1   = '#0C1018';
const GOLD  = '#C9A84C';
const TEAL2 = '#22A67E';
const RED   = '#C45C5C';
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

export default function Briefing() {
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams();

  const [session, setSession] = useState(null);
  const [micState, setMicState] = useState(MIC_UNCHECKED);
  const [micErrorText, setMicErrorText] = useState('');

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

  const beginCall = () => {
    if (micState !== MIC_GRANTED) return;
    navigate(`/simulator/call/${routeSessionId}`);
  };

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: MUTED, fontFamily: VAULT_BODY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Loading briefing...</div>
      </div>
    );
  }

  // Scenario context falls back gracefully if backend response shape varies.
  const scenario = session.scenario || {};
  const personaName    = scenario.persona_name || scenario.personaName || session.persona_name || 'your customer';
  const industry       = scenario.industry || session.industry || '';
  const scenarioCode   = scenario.scenario_code || scenario.scenarioCode || session.scenario_code || '';
  const personaContext = scenario.persona_context || scenario.personaContext || scenario.description || session.persona_context || '';
  const objective      = scenario.objective || session.objective || 'Listen carefully and handle the call professionally.';

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

          {personaContext && (
            <p style={{ fontSize: 14, color: WHITE, lineHeight: 1.7, margin: '0 0 18px' }}>
              {personaContext}
            </p>
          )}

          <div
            style={{
              background: 'rgba(196,92,92,0.06)',
              border: '1px solid rgba(196,92,92,0.2)',
              borderRadius: 3,
              padding: '14px 18px',
              marginBottom: 24,
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

          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 12 }}>
              Microphone check
            </div>

            {micState === MIC_UNCHECKED && (
              <button
                type="button"
                onClick={checkMic}
                style={outlinedBtn(false)}
              >
                Check Microphone Access
              </button>
            )}

            {micState === MIC_CHECKING && (
              <div style={{ fontSize: 13, color: MUTED }}>Requesting microphone access...</div>
            )}

            {micState === MIC_GRANTED && (
              <div style={{ fontSize: 13, color: TEAL2, fontWeight: 600 }}>
                ✓ Microphone ready
              </div>
            )}

            {(micState === MIC_DENIED || micState === MIC_NO_DEVICE || micState === MIC_ERROR) && (
              <>
                <div
                  role="alert"
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(196,92,92,0.08)',
                    border: '1px solid rgba(196,92,92,0.32)',
                    borderRadius: 3,
                    color: RED,
                    fontSize: 13,
                    lineHeight: 1.55,
                    marginBottom: 12,
                  }}
                >
                  {micErrorText}
                </div>
                {micState !== MIC_NO_DEVICE && (
                  <button type="button" onClick={checkMic} style={outlinedBtn(false)}>
                    Try Again
                  </button>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={beginCall}
              disabled={micState !== MIC_GRANTED}
              style={primaryBtn(micState !== MIC_GRANTED)}
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
    </div>
  );
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
