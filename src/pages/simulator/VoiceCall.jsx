/**
 * ATAC Platform - VoiceCall.jsx
 * Path: frontend/src/pages/simulator/VoiceCall.jsx
 *
 * Presentational live-voice component. Owns ONLY the mechanical concerns of a
 * live call: the @elevenlabs/client Conversation.startSession lifecycle, the
 * silence banner, the mic activity meter, the duration timer, and the
 * transcript UI.
 *
 * It owns NO side effects. It surfaces two events to its parent:
 *   onConversationId(id): called once when the SDK provides the conversation
 *     id. The parent decides whether and where to persist it.
 *   onEnded(): called on End Call, disconnect, or error. The parent decides
 *     where to go next.
 *
 * Props:
 *   signedUrl            signed WebSocket URL used to connect (required)
 *   personaName          display name for the customer persona
 *   onConversationId(id) notified once the conversation id is known
 *   onEnded()            notified when the call ends (any reason)
 *
 * Extracted from Call.jsx so both the candidate call page and the invite-only
 * sandbox can drive the same call experience without duplicating SDK logic.
 */

import { useEffect, useRef, useState } from 'react';
import { Conversation } from '@elevenlabs/client';
import i18n from '../../i18n';

const BG    = '#080B12';
const BG1   = '#0C1018';
const BG3   = '#141B26';
const GOLD  = '#C9A84C';
const TEAL2 = '#22A67E';
const RED   = '#C45C5C';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

// SDK mode tokens
const MODE_LISTENING = 'listening';
const MODE_SPEAKING  = 'speaking';

export default function VoiceCall({ signedUrl, personaName, onConversationId, onEnded, onTranscriptTurn }) {
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
  const endedRef = useRef(false);
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

  // ---------- End the call (idempotent) ----------
  // Tears down the active SDK conversation and notifies the parent. The
  // parent owns what happens next (navigation, scoring, etc.).
  const handleEnded = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (conversationRef.current) {
      try { conversationRef.current.endSession(); } catch (_) { /* ignore */ }
      conversationRef.current = null;
    }
    if (typeof onEnded === 'function') onEnded();
  };

  // ---------- Start the conversation once a signed URL is available ----------
  useEffect(() => {
    const url = signedUrl || null;
    if (!url) {
      setErrorText('This session is missing a signed connection URL. Please return to the dashboard and try again.');
      setConnectionStatus('error');
      return undefined;
    }

    let cancelled = false;

    (async () => {
      // Map the candidate's UI language to the ElevenLabs conversation override.
      // Read once at session start (not at render time). For English, omit the
      // overrides key entirely; the SDK errors if you override a field that
      // doesn't need overriding. Non-English: pass { agent: { language: lang } }.
      // Agents that have not been configured for ES/FR will throw at startSession;
      // the catch below surfaces a clear user-facing message.
      const lang = (i18n.language || 'en').split('-')[0].toLowerCase();

      try {
        const startOpts = {
          signedUrl: url,

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
            // Surface the conversation id to the parent (fire-and-forget; the
            // parent decides whether to persist it). Only when present.
            if (conversationId && typeof onConversationId === 'function') {
              onConversationId(conversationId);
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
            // Optional: surface the raw turn (native SDK source + text) to a
            // parent that wants it. The candidate wrapper does not pass this
            // prop, so this is a no-op on the candidate path.
            if (typeof onTranscriptTurn === 'function') {
              onTranscriptTurn({ source: src, message: text });
            }
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
            // Any disconnect (user-initiated or unexpected) ends the call.
            handleEnded();
          },

          onError: (err) => {
            if (cancelled) return;
            setErrorText(err?.message || 'The call encountered an error. We will take you to your results.');
            setConnectionStatus('error');
            // Give the user a moment to read the error before ending.
            setTimeout(handleEnded, 2500);
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
  }, [signedUrl]);

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
        console.warn('[VoiceCall] mic monitor getUserMedia failed', err?.name || err?.message);
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) { /* */ } });
        return;
      }
      micStreamRef.current = stream;

      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        console.warn('[VoiceCall] Web Audio API unavailable; mic meter disabled');
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

  // ---------- User clicks End Call ----------
  const onEndCall = async () => {
    if (connectionStatus === 'ending' || endedRef.current) return;
    setConnectionStatus('ending');
    if (conversationRef.current) {
      try { await conversationRef.current.endSession(); } catch (_) { /* ignore */ }
      conversationRef.current = null;
    }
    handleEnded();
  };

  // ---------- Render ----------
  const persona = personaName || 'your customer';

  const statusLabel =
    connectionStatus === 'connecting' ? 'Connecting' :
    connectionStatus === 'live'       ? `Live · ${persona}` :
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
                <TranscriptTurn key={`${turn.ts}-${i}`} turn={turn} personaName={persona} />
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
          disabled={connectionStatus === 'connecting' || connectionStatus === 'ending' || endedRef.current}
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
