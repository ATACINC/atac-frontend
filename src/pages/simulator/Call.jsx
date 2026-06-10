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
import i18n from '../../i18n';

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

  // Launch-day Phase 1 Change 3 + 4: mic activity meter + silence banner.
  // The candidate's mic is captured by the ElevenLabs SDK; we open a
  // parallel getUserMedia stream specifically for the analyser so we
  // never interfere with the SDK's own pipeline. Modern browsers share
  // the same underlying hardware track between concurrent consumers.
  const [micLevel, setMicLevel] = useState(0);        // 0..100 scaled
  const [micActive, setMicActive] = useState(false);  // above silence threshold right now
  const [showSilenceBanner, setShowSilenceBanner] = useState(false);

  const conversationRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(null);
  const navigatedAwayRef = useRef(false);
  const transcriptEndRef = useRef(null);

  // Mic-monitoring refs (no re-renders per frame)
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafIdRef = useRef(null);
  const silenceStartRef = useRef(null);              // ms timestamp first frame below threshold
  const silenceClearTimeoutRef = useRef(null);
  const lastUiUpdateRef = useRef(0);                 // throttle setState to ~10Hz
  // Live mirror of `mode` for the rAF silence loop. tick() closes over a
  // single render's scope, so reading the `mode` state directly would be
  // stale. A ref is mutable and always reads the latest value written by
  // onModeChange, which is how the silence accumulator knows whether the
  // agent is currently speaking (candidate correctly listening) vs the
  // candidate's own turn.
  const modeRef = useRef(MODE_LISTENING);

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

    const signedUrl = session.signedUrl || null;
    if (!signedUrl) {
      setErrorText('This session is missing a signed connection URL. Please return to the dashboard and try again.');
      setConnectionStatus('error');
      return;
    }

    let cancelled = false;

    (async () => {
      // Map the candidate's UI language to the ElevenLabs conversation override.
      // Read once at session start (not at render time). For English, omit the
      // overrides key entirely — the SDK errors if you override a field that
      // doesn't need overriding. Non-English: pass { agent: { language: lang } }.
      // Agents that have not been configured for ES/FR will throw at startSession;
      // the catch below surfaces a clear user-facing message.
      const lang = (i18n.language || 'en').split('-')[0].toLowerCase();

      try {
        const startOpts = {
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
              // Write the ref synchronously so the silence-detector rAF
              // loop reads the live mode (not a stale render closure)
              // before its next frame.
              modeRef.current = next;
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
        };

        if (lang !== 'en') {
          startOpts.overrides = { agent: { language: lang } };
        }

        const conv = await Conversation.startSession(startOpts);

        if (cancelled) {
          // Component unmounted before startSession resolved. Tear down.
          try { conv.endSession(); } catch (_) { /* ignore */ }
          return;
        }

        conversationRef.current = conv;
      } catch (err) {
        if (cancelled) return;
        // Override / agent-language failures land here when the candidate's
        // selected language isn't yet enabled for this scenario's agent.
        // Detect by the SDK error message and surface a clear, candidate-
        // friendly line instead of the raw SDK string.
        const msg = (err && err.message) ? String(err.message) : '';
        const isLanguageFailure =
          lang !== 'en' && /override|language|agent/i.test(msg);
        if (isLanguageFailure) {
          setErrorText('This scenario is not yet available in your selected language.');
        } else {
          setErrorText(msg || 'We could not start the call.');
        }
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

  // ---------- Mic activity meter + silence detection ----------
  // Runs only while the call is live. Opens a separate getUserMedia
  // track so the ElevenLabs SDK's own capture is untouched. Updates
  // UI state at ~10Hz (throttled) and tracks silence duration in refs
  // to avoid per-frame re-renders.
  useEffect(() => {
    if (connectionStatus !== 'live') return undefined;

    const SILENCE_THRESHOLD = 18;           // 0..255 byte freq avg, ~ -40 dB
    const SILENCE_TRIGGER_MS = 25_000;      // 25s of continuous quiet on the
                                            // candidate's OWN turn before banner
    const SILENCE_CLEAR_DELAY_MS = 3_000;   // banner fades 3s after voice returns
    const UI_UPDATE_INTERVAL_MS = 100;      // throttle setState to 10Hz

    let cancelled = false;

    (async () => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        // Mic capture failed at the OS level. Surface as warning but do
        // not break the call (ElevenLabs SDK has its own stream and may
        // still be working). Log for debugging.
        console.warn('[Call] mic monitor getUserMedia failed', err?.name || err?.message);
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) { /* */ } });
        return;
      }
      micStreamRef.current = stream;

      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        console.warn('[Call] Web Audio API unavailable; mic meter disabled');
        return;
      }
      const ctx = new AudioCtor();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bins = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(bins);

        // Average across all bins as a coarse loudness proxy.
        let sum = 0;
        for (let i = 0; i < bins.length; i++) sum += bins[i];
        const avg = sum / bins.length;

        // Silence tracking. Only accumulate quiet while it is the
        // candidate's OWN turn (mode === MODE_LISTENING). When the agent
        // is speaking (MODE_SPEAKING), the candidate is correctly silent
        // and listening, so an agent monologue must never count toward
        // the banner. Reading modeRef (not the captured `mode` state)
        // keeps this live inside the rAF loop.
        const now = Date.now();
        const isCandidateTurn = modeRef.current === MODE_LISTENING;
        if (avg < SILENCE_THRESHOLD && isCandidateTurn) {
          if (silenceStartRef.current == null) {
            silenceStartRef.current = now;
          } else if (now - silenceStartRef.current >= SILENCE_TRIGGER_MS) {
            setShowSilenceBanner(true);
          }
        } else {
          // Candidate is producing audio, OR the agent is speaking
          // (candidate correctly listening). Either way stop accumulating
          // and let any visible banner fade after the clear delay.
          silenceStartRef.current = null;
          setShowSilenceBanner((current) => {
            if (current) {
              if (silenceClearTimeoutRef.current) {
                clearTimeout(silenceClearTimeoutRef.current);
              }
              silenceClearTimeoutRef.current = setTimeout(() => {
                setShowSilenceBanner(false);
                silenceClearTimeoutRef.current = null;
              }, SILENCE_CLEAR_DELAY_MS);
            }
            return current;
          });
        }

        // Throttled UI updates (10Hz, not 60Hz)
        if (now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
          lastUiUpdateRef.current = now;
          // Scale 0..255 -> 0..100 (roughly clamped at 80 since real
          // speech rarely fills the upper bins).
          const scaled = Math.min(100, Math.round((avg / 80) * 100));
          setMicLevel(scaled);
          setMicActive(avg >= SILENCE_THRESHOLD);
        }

        rafIdRef.current = requestAnimationFrame(tick);
      };

      rafIdRef.current = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (silenceClearTimeoutRef.current) {
        clearTimeout(silenceClearTimeoutRef.current);
        silenceClearTimeoutRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => {
          try { t.stop(); } catch (_) { /* ignore */ }
        });
        micStreamRef.current = null;
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) { /* ignore */ }
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      silenceStartRef.current = null;
      setShowSilenceBanner(false);
      setMicLevel(0);
      setMicActive(false);
    };
  }, [connectionStatus]);

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
  const personaName = session?.personaName || 'your customer';

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
          {connectionStatus === 'live' && (
            <MicIndicator level={micLevel} active={micActive} />
          )}
        </div>
      </div>

      {showSilenceBanner && (
        <div
          role="alert"
          style={{
            background: 'rgba(196,138,42,0.14)',
            borderBottom: '1px solid rgba(196,138,42,0.5)',
            color: '#F0C975',
            padding: '12px 28px',
            fontSize: 13,
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AlertTriangleSvg />
          <span>
            It's your turn to speak. If you've already started, your microphone may be muted - check the mic icon in your browser's address bar. Your recording is still running either way, and this message does not affect your score.
          </span>
        </div>
      )}

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

// ─── Mic indicator + inline SVG icons (Phase 1 launch-day fix) ─────
// Inline SVG keeps us off lucide-react (not in package.json deps; the
// brief said it was, but a fresh check showed otherwise). Four icons
// needed: Mic, MicOff, AlertTriangle, Check are easily small enough
// to inline without bloat.

function MicIndicator({ level, active }) {
  const color = active ? TEAL2 : MUTED;
  // Volume meter: 12 vertical bars whose lit count is proportional
  // to the level.
  const TOTAL_BARS = 12;
  const litCount = Math.max(0, Math.min(TOTAL_BARS, Math.round((level / 100) * TOTAL_BARS)));
  return (
    <span
      role="status"
      aria-label={active ? 'Microphone active' : 'Microphone silent'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        marginLeft: 12,
        paddingLeft: 12,
        borderLeft: `1px solid ${BORDER2}`,
      }}
    >
      {active ? <MicSvg color={color} /> : <MicOffSvg color={color} />}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'flex-end',
          gap: 2,
          height: 14,
        }}
      >
        {Array.from({ length: TOTAL_BARS }).map((_, i) => {
          const lit = i < litCount;
          const minH = 3;
          const maxH = 14;
          const targetH = minH + ((i + 1) / TOTAL_BARS) * (maxH - minH);
          return (
            <span
              key={i}
              style={{
                width: 2,
                height: lit ? targetH : minH,
                background: lit ? color : 'rgba(238,233,223,0.18)',
                borderRadius: 1,
                transition: 'height 0.08s linear, background 0.12s',
              }}
            />
          );
        })}
      </span>
    </span>
  );
}

function MicSvg({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function MicOffSvg({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function AlertTriangleSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F0C975" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

