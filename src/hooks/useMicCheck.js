/**
 * ATAC Platform - useMicCheck.js
 * Path: frontend/src/hooks/useMicCheck.js
 *
 * Shared microphone-check logic: permission request, input-device
 * enumeration, a live level meter driven by an AnalyserNode (the same
 * approach and math as the in-call monitor in VoiceCall.jsx), and cleanup on
 * every exit path. Extracted from the sandbox MicCheckStep so the
 * credentialed briefing can run the identical check under its own skin,
 * following the customerProfile.js precedent of sharing logic, not skin.
 *
 * The hook never leaves a stream open: stop() runs on unmount and callers
 * invoke it on confirm/back. A run counter guards every async continuation,
 * so a stale grant arriving after a re-start or unmount is released
 * immediately instead of leaking.
 *
 * Error copy lives here so both surfaces speak the same language about the
 * same failures (originally from the credentialed briefing's checkMic).
 */

import { useEffect, useRef, useState } from 'react';

export const METER_BARS = 12;
const UI_UPDATE_INTERVAL_MS = 100; // 10Hz, matching the in-call monitor

export const MIC_UNSUPPORTED_MSG =
  'This browser does not support microphone access. Please use a recent version of Chrome, Edge, Firefox, or Safari.';

// getUserMedia error name -> plain-language message.
export function messageForMicError(name) {
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

/**
 * @returns {{
 *   status: 'idle'|'requesting'|'ready'|'failed',
 *   errorText: string,
 *   errorName: string,
 *   devices: MediaDeviceInfo[],
 *   selectedId: string,
 *   level: number,           // 0..100
 *   start: (deviceId?: string) => Promise<void>,
 *   stop: () => void,
 *   selectDevice: (deviceId: string) => void,
 *   confirmedDeviceId: () => (string|undefined),  // undefined = browser default
 * }}
 */
export function useMicCheck() {
  const [status, setStatus] = useState('idle');
  const [errorText, setErrorText] = useState('');
  const [errorName, setErrorName] = useState('');
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [level, setLevel] = useState(0);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const lastUiRef = useRef(0);
  const runRef = useRef(0); // increments per (re)start so stale async work bails

  const stop = () => {
    runRef.current += 1;
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
    stop();
    const run = ++runRef.current;
    setStatus('requesting');
    setErrorText('');
    setErrorName('');
    setLevel(0);

    if (typeof navigator?.mediaDevices?.getUserMedia !== 'function') {
      setStatus('failed');
      setErrorName('unsupported');
      setErrorText(MIC_UNSUPPORTED_MSG);
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
      setErrorName(err?.name || '');
      setErrorText(messageForMicError(err?.name || ''));
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

    // Meter: AnalyserNode averaged across bins, throttled to 10Hz.
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

  const selectDevice = (deviceId) => {
    setSelectedId(deviceId);
    start(deviceId);
  };

  // 'default' is the browser's pseudo-device; callers pass undefined onward so
  // the voice SDK keeps its own default selection and startOpts stays
  // byte-identical to a no-choice run.
  const confirmedDeviceId = () =>
    (selectedId && selectedId !== 'default' ? selectedId : undefined);

  // Unmount: never leave a stream open.
  useEffect(() => stop, []);

  return { status, errorText, errorName, devices, selectedId, level, start, stop, selectDevice, confirmedDeviceId };
}
