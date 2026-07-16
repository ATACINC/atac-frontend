/**
 * ATAC Platform - MicCheckStep.jsx
 * Path: frontend/src/pages/sandbox/MicCheckStep.jsx
 *
 * Pre-call microphone check for the sandbox. Shown after "Begin the call" on
 * the briefing and BEFORE voice-start fires, so a broken microphone never
 * burns a signed URL or an attempt token. A step inside the briefing phase,
 * not a new phase: the header step indicator does not change.
 *
 * The check logic (permission, device enumeration, analyser meter, cleanup)
 * lives in the shared useMicCheck hook; this file is only the sandbox skin.
 * Confirm hands back the chosen deviceId, or undefined for the browser
 * default; the caller threads it into the voice SDK.
 */

import { useEffect } from 'react';
import { T, goldCta, ghostCta } from './sandboxTheme';
import { useMicCheck, METER_BARS } from '../../hooks/useMicCheck';

export default function MicCheckStep({ onConfirm, onBack }) {
  const mic = useMicCheck();

  useEffect(() => {
    mic.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = () => {
    if (mic.status !== 'ready') return;
    const deviceId = mic.confirmedDeviceId();
    mic.stop();
    onConfirm(deviceId);
  };

  const handleBack = () => {
    mic.stop();
    onBack();
  };

  const lit = Math.max(0, Math.min(METER_BARS, Math.round((mic.level / 100) * METER_BARS)));
  const speaking = mic.level >= 8;

  return (
    <section className="sbx-fade sbx-pad" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px 64px' }}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: T.goldSoft, marginBottom: 14 }}>
          Microphone check
        </div>
        <h2 className="sbx-h" style={{ fontFamily: T.fontDisplay, fontSize: 38, fontWeight: 500, color: T.ink, margin: '0 0 12px', lineHeight: 1.12 }}>
          Can we hear you?
        </h2>

        {mic.status === 'requesting' && (
          <p style={{ fontSize: 16, lineHeight: 1.6, color: T.muted, margin: '0 0 30px' }}>
            Waiting for microphone permission. Allow access when your browser asks.
          </p>
        )}

        {mic.status === 'failed' && (
          <div>
            <div role="alert" style={{ textAlign: 'left', padding: '14px 18px', background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.32)', borderRadius: 12, color: T.redInk, fontSize: 15, lineHeight: 1.6, margin: '0 0 26px' }}>
              {mic.errorText}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button type="button" className="sbx-cta" style={{ ...goldCta, width: '100%' }} onClick={() => mic.start(mic.selectedId || undefined)}>
                Try Again
              </button>
              <button type="button" className="sbx-ghost" style={{ ...ghostCta, width: '100%' }} onClick={handleBack}>
                Back to the Briefing
              </button>
            </div>
          </div>
        )}

        {mic.status === 'ready' && (
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
            {mic.devices.length > 1 && (
              <div style={{ textAlign: 'left', marginBottom: 26 }}>
                <label htmlFor="sbx-mic-select" style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>
                  Microphone
                </label>
                <select
                  id="sbx-mic-select"
                  value={mic.selectedId}
                  onChange={(e) => mic.selectDevice(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', background: T.bg, color: T.ink, border: `1px solid ${T.panelLine}`, borderRadius: 10, fontSize: 15, fontFamily: T.fontBody }}
                >
                  {mic.devices.map((d, i) => (
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
