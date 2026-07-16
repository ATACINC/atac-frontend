/**
 * ATAC Platform - MicCheckStep.jsx
 * Path: frontend/src/pages/sandbox/MicCheckStep.jsx
 *
 * Pre-call microphone check for the sandbox. Shown after "Begin the call" on
 * the briefing and BEFORE voice-start fires, so a broken microphone never
 * burns a signed URL or an attempt token. A step inside the briefing phase,
 * not a new phase: the header step indicator does not change.
 *
 * Flow: request permission on mount, show a live level meter driven by an
 * AnalyserNode (the same approach as the in-call monitor in VoiceCall.jsx),
 * list input devices when there is more than one (a one-item dropdown is
 * furniture), and confirm. Fast path is a single click when the default
 * device is fine. Confirm hands back the chosen deviceId, or undefined for
 * the browser default; the caller threads it into the voice SDK.
 *
 * Error copy mirrors the credentialed briefing's checkMic cases so the two
 * flows speak the same language about the same failures. Every exit path
 * (confirm, back, retry, unmount) stops the meter stream and closes the
 * audio context; this component never leaves a stream open.
 */

import { useEffect, useRef, useState } from 'react';
import { T, goldCta, ghostCta } from './sandboxTheme';

const METER_BARS = 12;
const UI_UPDATE_INTERVAL_MS = 100; // 10Hz, matching the in-call monitor

// getUserMedia error name -> plain-language message (from Briefing.checkMic).
function messageForError(name) {
  if (name === 'NotAllowedError') {
    return 'Microphone access was blocked. Grant permission in your browser settings and try again.';
  }
  if (name === 'NotFoundError') {
    return 'We could not find a microphone on this device. Connect one and try again.';
  }
  if (name === 'NotReadableError') {
    return 'Your microphone appears to be in use by another application. Close other apps that use audio (video calls, recorders) and try again.';
  }
  return 'Something went wrong starting your microphone. Try again or use a different browser.';
}

export default function MicCheckStep({ onConfirm, onBack }) {
  // status: 'requesting' | 'ready' | 'failed'
  const [status, setStatus] = useState('requesting');
  const [errorText, setErrorText] = useState('');
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [level, setLevel] = useState(0);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const lastUiRef = useRef(0);
  const runRef = useRef(0); // increments per (re)start so stale async work bails

  const stopMeter = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
  };

  // Open (or reopen) the meter stream, optionally pinned to one device.
  const start = async (deviceId) => {
    const run = ++runRef.current;
    stopMeter();
    setStatus('requesting');
    setErrorText('');
    setLevel(0);

    if (typeof navigator?.mediaDevices?.getUserMedia !== 'function') {
      setStatus('failed');
      setErrorText('This browser does not support microphone access. Please use a recent version of Chrome, Edge, Firefox, or Safari.');
      return;
    }

    let stream;
    try {
      const constraints = deviceId
        ? { audio: { deviceId: { exact: deviceId } } }
        : { audio: true };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (run !== runRef.current) return;
      setStatus('failed');
      setErrorText(messageForError(err?.name || ''));
      return;
    }
    if (run !== runRef.current) {
      stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
      return;
    }
    streamRef.current = stream;

    // Device labels are only populated after a grant, so enumerate now.
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      if (run === runRef.current) {
        const inputs = all.filter((d) => d.kind === 'audioinput');
        setDevices(inputs);
        if (!deviceId) {
          const def = inputs.find((d) => d.deviceId === 'default') || inputs[0];
          setSelectedId(def ? def.deviceId : '');
        }
      }
    } catch { /* device list is a nicety; the meter still works without it */ }

    // Meter: AnalyserNode averaged across bins, throttled to 10Hz. Mirrors
    // the in-call monitor in VoiceCall.jsx so the two read the same way.
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      // No Web Audio: permission worked, so allow confirm without a meter.
      if (run === runRef.current) setStatus('ready');
      return;
    }
    const ctx = new AudioCtor();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    const bins = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (run !== runRef.current) return;
      analyser.getByteFrequencyData(bins);
      let sum = 0;
      for (let i = 0; i < bins.length; i++) sum += bins[i];
      const avg = sum / bins.length;
      const now = Date.now();
      if (now - lastUiRef.current >= UI_UPDATE_INTERVAL_MS) {
        lastUiRef.current = now;
        setLevel(Math.min(100, Math.round((avg / 80) * 100)));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    setStatus('ready');
  };

  useEffect(() => {
    start();
    return () => {
      runRef.current += 1;
      stopMeter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeviceChange = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    start(id);
  };

  const handleConfirm = () => {
    if (status !== 'ready') return;
    runRef.current += 1;
    stopMeter();
    // 'default' is the browser's pseudo-device; passing nothing lets the
    // voice SDK use its own default selection.
    onConfirm(selectedId && selectedId !== 'default' ? selectedId : undefined);
  };

  const handleBack = () => {
    runRef.current += 1;
    stopMeter();
    onBack();
  };

  const lit = Math.max(0, Math.min(METER_BARS, Math.round((level / 100) * METER_BARS)));
  const speaking = level >= 8;

  return (
    <section className="sbx-fade sbx-pad" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px 64px' }}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: T.goldSoft, marginBottom: 14 }}>
          Microphone check
        </div>
        <h2 className="sbx-h" style={{ fontFamily: T.fontDisplay, fontSize: 38, fontWeight: 500, color: T.ink, margin: '0 0 12px', lineHeight: 1.12 }}>
          Can we hear you?
        </h2>

        {status === 'requesting' && (
          <p style={{ fontSize: 16, lineHeight: 1.6, color: T.muted, margin: '0 0 30px' }}>
            Waiting for microphone permission. Allow access when your browser asks.
          </p>
        )}

        {status === 'failed' && (
          <div>
            <div role="alert" style={{ textAlign: 'left', padding: '14px 18px', background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.32)', borderRadius: 12, color: T.redInk, fontSize: 15, lineHeight: 1.6, margin: '0 0 26px' }}>
              {errorText}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button type="button" className="sbx-cta" style={{ ...goldCta, width: '100%' }} onClick={() => start(selectedId || undefined)}>
                Try Again
              </button>
              <button type="button" className="sbx-ghost" style={{ ...ghostCta, width: '100%' }} onClick={handleBack}>
                Back to the Briefing
              </button>
            </div>
          </div>
        )}

        {status === 'ready' && (
          <div>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: T.muted, margin: '0 0 26px' }}>
              Say a few words. The meter should move while you speak.
            </p>

            {/* Live level meter */}
            <div
              role="status"
              aria-label={speaking ? 'Microphone is picking up sound' : 'Microphone is silent'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 44, padding: '0 18px', background: T.panel, border: `1px solid ${T.panelLine}`, borderRadius: 12, marginBottom: 22 }}
            >
              {Array.from({ length: METER_BARS }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 5,
                    height: 8 + i * 2,
                    borderRadius: 2,
                    background: i < lit ? T.green : 'rgba(255,255,255,0.14)',
                    transition: 'background 0.1s',
                  }}
                />
              ))}
              <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: speaking ? T.greenInk : T.faint }}>
                {speaking ? 'Hearing you' : 'Quiet'}
              </span>
            </div>

            {/* Device picker: only when there is a real choice to make. */}
            {devices.length > 1 && (
              <div style={{ textAlign: 'left', marginBottom: 26 }}>
                <label htmlFor="sbx-mic-select" style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>
                  Microphone
                </label>
                <select
                  id="sbx-mic-select"
                  value={selectedId}
                  onChange={handleDeviceChange}
                  style={{ width: '100%', padding: '12px 14px', background: T.bg, color: T.ink, border: `1px solid ${T.panelLine}`, borderRadius: 10, fontSize: 15, fontFamily: T.fontBody }}
                >
                  {devices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button type="button" className="sbx-cta" style={{ ...goldCta, width: '100%' }} onClick={handleConfirm}>
                Sounds Good, Start the Call
              </button>
              <button type="button" className="sbx-ghost" style={{ ...ghostCta, width: '100%' }} onClick={handleBack}>
                Back to the Briefing
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
