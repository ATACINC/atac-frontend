/**
 * ATAC Platform - Call.jsx
 * Path: frontend/src/pages/simulator/Call.jsx
 *
 * Route: /simulator/call/:sessionId
 *
 * Live voice call with the ATAC Call Readiness Simulator persona. Wraps
 * the @elevenlabs/client Conversation SDK.
 *
 * Lifecycle:
 *   1. Mount: read session payload from sessionStorage (set by SimulatorEntry
 *      or ScenarioPicker after /api/sim-live/assign).
 *   2. Start Conversation.startSession with the signed WebSocket URL from
 *      the assign response.
 *   3. onConnect: read conversationId from the callback payload (or fall
 *      back to conversation.getId()) and PATCH it to
 *      /api/sim-live/session/:sessionId/conversation so the backend can
 *      correlate the live conversation with the session row.
 *   4. onMessage: append each turn to the local transcript display.
 *   5. onModeChange: drive the speaking/listening UI indicator.
 *   6. End Call (user) -> endSession() then navigate to /simulator/results/:sessionId.
 *   7. onDisconnect or onError (unexpected) -> same navigation; Results polls
 *      backend status to figure out what actually happened.
 *
 * Component unmount calls endSession() defensively to release the mic and
 * close the WebSocket. The camera and mic LEDs should be observably off
 * once the candidate is no longer on the Call route.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Conversation } from '@elevenlabs/client';
import { patchConversation } from '../../api/client';

const BG    = '#080B12';
const BG1   = '#0C1018';
const BG3   = '#141B26';
const GOLD  = '#C9A84C';
const TEAL2 = '#22A67E';
const RED   = '#C45C5C';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

// SDK mode tokens
const MODE_LISTENING = 'listening';
const MODE_SPEAKING  = 'speaking';

export default function Call() {
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams();

  const [session, setSession] = useState(null);
  const [transcript, setTranscript] = useState([]); // [{ source, message, ts }]
  const [mode, setMode] = useState(MODE_LISTENING);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | live | ending | ended | error
  const [durationSec, setDurationSec] = useState(0);
  const [errorText, setErrorText] = useState('');

  const conversationRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(null);
  const navigatedAwayRef = useRef(false);
  const transcriptEndRef = useRef(null);

  // ---------- Load session from sessionStorage ----------
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

  // ---------- Start the conversation once session is loaded ----------
  useEffect(() => {
    if (!session) return;

    const signedUrl = session.signedUrl || session.signed_url || null;
    if (!signedUrl) {
      setErrorText('This session is missing a signed connection URL. Please return to the dashboard and try again.');
      setConnectionStatus('error');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const conv = await Conversation.startSession({
          signedUrl,

          onConnect: (payload) => {
            if (cancelled) return;
            // Some SDK versions pass { conversationId }; others require a
            // .getId() lookup. Try both.
            let conversationId = payload && (payload.conversationId || payload.conversation_id);
            if (!conversationId && conv && typeof conv.getId === 'function') {
              try { conversationId = conv.getId(); } catch (_) { /* tolerate */ }
            }
            setConnectionStatus('live');
            startedAtRef.current = Date.now();
            // Persist conversation_id to backend (fire-and-forget; errors
            // here do not block the candidate from continuing the call).
            if (conversationId) {
              patchConversation(routeSessionId, conversationId).catch((err) => {
                // Soft-log; do not surface to the user.
                console.warn('[Call] patchConversation failed', err?.message || err);
              });
            }
          },

          onMessage: (msg) => {
            if (cancelled) return;
            const src = msg && (msg.source || msg.role) || 'unknown';
            const text = msg && (msg.message || msg.text) || '';
            if (!text) return;
            setTranscript((prev) => [
              ...prev,
              { source: src, message: text, ts: Date.now() },
            ]);
          },

          onModeChange: (m) => {
            if (cancelled) return;
            const next = m && (m.mode || m) || MODE_LISTENING;
            if (next === MODE_SPEAKING || next === MODE_LISTENING) {
              setMode(next);
            }
          },

          onDisconnect: () => {
            if (cancelled) return;
            // Any disconnect (user-initiated or unexpected) advances to
            // results. Results.jsx polls backend status to differentiate.
            handleAdvanceToResults();
          },

          onError: (err) => {
            if (cancelled) return;
            setErrorText(err?.message || 'The call encountered an error. We will take you to your results.');
            setConnectionStatus('error');
            // Give the user a moment to read the error before advancing.
            setTimeout(handleAdvanceToResults, 2500);
          },
        });

        if (cancelled) {
          // Component unmounted before startSession resolved. Tear down.
          try { conv.endSession(); } catch (_) { /* ignore */ }
          return;
        }

        conversationRef.current = conv;
      } catch (err) {
        if (cancelled) return;
        setErrorText(err?.message || 'We could not start the call.');
        setConnectionStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      // Defensive teardown on unmount: end the conversation (releases mic
      // and closes the WebSocket).
      if (conversationRef.current) {
        try { conversationRef.current.endSession(); } catch (_) { /* ignore */ }
        conversationRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ---------- Duration timer (runs while connection is live) ----------
  useEffect(() => {
    if (connectionStatus !== 'live') return undefined;
    timerRef.current = setInterval(() => {
      if (startedAtRef.current) {
        setDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [connectionStatus]);

  // ---------- Auto-scroll transcript to the latest turn ----------
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [transcript]);

  // ---------- Advance to results (idempotent) ----------
  const handleAdvanceToResults = () => {
    if (navigatedAwayRef.current) return;
    navigatedAwayRef.current = true;
    // Tear down active conversation if still around.
    if (conversationRef.current) {
      try { conversationRef.current.endSession(); } catch (_) { /* ignore */ }
      conversationRef.current = null;
    }
    navigate(`/simulator/results/${routeSessionId}`, { replace: true });
  };

  // ---------- User clicks End Call ----------
  const onEndCall = async () => {
    if (connectionStatus === 'ending' || navigatedAwayRef.current) return;
    setConnectionStatus('ending');
    if (conversationRef.current) {
      try { await conversationRef.current.endSession(); } catch (_) { /* ignore */ }
      conversationRef.current = null;
    }
    handleAdvanceToResults();
  };

  // ---------- Render ----------
  const scenario = session?.scenario || {};
  const personaName = scenario.persona_name || scenario.personaName || session?.persona_name || 'your customer';

  const statusLabel =
    connectionStatus === 'connecting' ? 'Connecting' :
    connectionStatus === 'live'       ? `Live · ${personaName}` :
    connectionStatus === 'ending'     ? 'Ending call' :
    connectionStatus === 'error'      ? 'Connection error' :
    'Ended';

  const statusColor =
    connectionStatus === 'live'  ? RED :
    connectionStatus === 'error' ? RED :
    GOLD;

  const modeLabel = mode === MODE_SPEAKING ? 'Customer is speaking' : 'Your turn to speak';

  return (
    <div style={{ minHeight: '100vh', background: BG, color: WHITE, fontFamily: VAULT_BODY }}>
      {/* Top status bar */}
      <div
        style={{
          background: BG3,
          borderBottom: `1px solid ${BORDER2}`,
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
          ATAC Call Readiness Simulator
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: statusColor,
              animation: connectionStatus === 'live' ? 'sim-pulse 1.2s infinite' : 'none',
            }}
          />
          <span style={{ fontSize: 11, color: statusColor, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {statusLabel}
          </span>
          {connectionStatus === 'live' && (
            <span style={{ fontSize: 11, color: MUTED, letterSpacing: '0.1em', marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(durationSec)}
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 48px' }}>
        {/* Mode indicator */}
        <div
          style={{
            background: BG1,
            border: `1px solid ${BORDER2}`,
            borderRadius: 3,
            padding: '14px 18px',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: mode === MODE_SPEAKING ? RED : TEAL2,
              animation: connectionStatus === 'live' ? 'sim-pulse 1.4s infinite' : 'none',
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 13, color: WHITE, letterSpacing: '0.06em' }}>
            {connectionStatus === 'live' ? modeLabel : 'Waiting for connection...'}
          </div>
        </div>

        {/* Transcript */}
        <div
          style={{
            background: BG1,
            border: `1px solid ${BORDER2}`,
            borderRadius: 3,
            minHeight: 280,
            maxHeight: 460,
            overflowY: 'auto',
            padding: '20px 22px',
            marginBottom: 22,
          }}
        >
          {transcript.length === 0 ? (
            <div style={{ fontSize: 13, color: MUTED, textAlign: 'center', padding: '40px 0' }}>
              The conversation will appear here as it happens.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {transcript.map((turn, i) => (
                <TranscriptTurn key={`${turn.ts}-${i}`} turn={turn} personaName={personaName} />
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>

        {/* Error banner (if any) */}
        {errorText && (
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
              marginBottom: 16,
            }}
          >
            {errorText}
          </div>
        )}

        {/* End call CTA */}
        <button
          type="button"
          onClick={onEndCall}
          disabled={connectionStatus === 'connecting' || connectionStatus === 'ending' || navigatedAwayRef.current}
          style={{
            width: '100%',
            background:
              connectionStatus === 'connecting' || connectionStatus === 'ending'
                ? 'rgba(196,92,92,0.4)'
                : RED,
            color: WHITE,
            border: 'none',
            borderRadius: 2,
            padding: '14px 18px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            cursor:
              connectionStatus === 'connecting' || connectionStatus === 'ending'
                ? 'not-allowed'
                : 'pointer',
            fontFamily: VAULT_BODY,
          }}
        >
          {connectionStatus === 'ending' ? 'Ending Call...' : 'End Call'}
        </button>
      </div>

      <style>{`@keyframes sim-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.32; } }`}</style>
    </div>
  );
}

function TranscriptTurn({ turn, personaName }) {
  const isUser = turn.source === 'user';
  const label = isUser ? 'You' : (personaName || 'Customer');
  const fg    = isUser ? TEAL2 : RED;
  const bg    = isUser ? 'rgba(34,166,126,0.08)' : 'rgba(196,92,92,0.07)';
  const borderColor = isUser ? 'rgba(34,166,126,0.22)' : 'rgba(196,92,92,0.18)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: fg,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          maxWidth: '82%',
          background: bg,
          border: `1px solid ${borderColor}`,
          borderRadius: 3,
          padding: '10px 14px',
          fontSize: 13,
          color: WHITE,
          lineHeight: 1.6,
          fontFamily: VAULT_BODY,
        }}
      >
        {turn.message}
      </div>
    </div>
  );
}

function formatDuration(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

