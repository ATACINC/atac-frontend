/**
 * ATAC Platform - LanguageBands.jsx
 * Path: frontend/src/pages/sandbox/LanguageBands.jsx
 *
 * Sandbox debrief panel: speaking and fluency bands (estimated) for access
 * codes with language bands switched on. Renders nothing when the voice-score
 * response carries no `language` block, so every other code is unchanged.
 *
 * The fluency band is measured from the call audio after the call ends, so it
 * usually arrives 30 to 90 seconds after the debrief. While it is pending this
 * panel polls GET /api/sandbox/language/:token?email= every 5 seconds, for at
 * most 5 minutes.
 *
 * The speaking row is shown only when the response includes `speaking`; a
 * code set to fluency only leaves it out on the server.
 *
 * Copy rules: "estimated", "aligned to CEFR descriptors". Never "certified" or
 * "certificate" as a claim. No vendor names. No dashes.
 */

import { useEffect, useState } from 'react';
import { T } from './sandboxTheme';

const API_BASE = import.meta.env.VITE_API_URL;
const POLL_MS = 5000;
const POLL_LIMIT_MS = 5 * 60 * 1000;

const SCALE_LABELS = [
  ['range', 'Range'],
  ['accuracy', 'Accuracy'],
  ['interaction', 'Interaction'],
  ['coherence', 'Coherence'],
];

export default function LanguageBands({ initial, attemptToken, email }) {
  const [lang, setLang] = useState(initial || null);
  const [gaveUp, setGaveUp] = useState(false);

  const pending = !!(lang && lang.fluency && lang.fluency.status === 'pending');

  useEffect(() => {
    if (!pending || !attemptToken || !email) return undefined;
    let cancelled = false;
    const started = Date.now();
    let timer = null;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - started > POLL_LIMIT_MS) { setGaveUp(true); return; }
      try {
        const res = await fetch(`${API_BASE}/api/sandbox/language/${encodeURIComponent(attemptToken)}?email=${encodeURIComponent(email)}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (!cancelled && data && data.fluency) {
            setLang(data);
            if (data.fluency.status !== 'pending') return;
          }
        }
      } catch { /* keep polling */ }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [pending, attemptToken, email]);

  if (!lang) return null;

  const sp = lang.speaking || null;
  const fl = lang.fluency || {};
  const scaleLine = sp && sp.scales
    ? SCALE_LABELS.filter(([k]) => sp.scales[k]).map(([k, label]) => `${label} ${sp.scales[k]}`).join(', ')
    : '';

  let fluencyBand = null;
  let fluencyNote = '';
  if (fl.status === 'ok') {
    fluencyBand = fl.band;
    const m = fl.measures || {};
    const parts = [];
    if (m.words_per_minute != null) parts.push(`${m.words_per_minute} words per minute`);
    if (m.words_between_pauses != null) parts.push(`${m.words_between_pauses} words between pauses`);
    if (m.long_pauses_per_minute != null) parts.push(`${m.long_pauses_per_minute} long pauses per minute`);
    if (m.fillers_per_100_words != null) parts.push(`${m.fillers_per_100_words} filler words per 100 words`);
    fluencyNote = parts.join(', ');
  } else if (fl.status === 'pending' && !gaveUp) {
    fluencyNote = 'Measuring from your call audio. This usually takes about a minute.';
  } else if (fl.status === 'insufficient_speech') {
    fluencyNote = 'Not enough speech on this call to measure fluency.';
  } else {
    fluencyNote = 'Fluency could not be measured for this call.';
  }

  return (
    <div className="sbx-fade">
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.goldSoft, marginBottom: 4 }}>Language Bands (Estimated)</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sp && (
          <BandRow
            first
            name="Speaking"
            band={sp.status === 'ok' ? sp.band : null}
            note={sp.status === 'ok' ? scaleLine : 'The speaking band could not be estimated for this call.'}
          />
        )}
        <BandRow
          first={!sp}
          name="Fluency"
          band={fluencyBand}
          measuring={fl.status === 'pending' && !gaveUp}
          note={fluencyNote}
        />
        <BandRow
          name="Pronunciation"
          band={null}
          label="Not yet assessed"
          note="When added, this will assess how clearly you are understood, not your accent."
        />
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.55, color: T.faint }}>
        Estimated from this one call and aligned to CEFR descriptors. This is an indicator for screening, not a CEFR certificate.
      </p>
    </div>
  );
}

function BandRow({ name, band, label, note, measuring = false, first = false }) {
  const shown = band || label || (measuring ? 'Measuring' : 'Not available');
  const isBand = !!band;
  return (
    <div style={{ padding: first ? '8px 0 12px' : '12px 0', borderTop: first ? 'none' : `1px solid ${T.panelLine}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginBottom: note ? 5 : 0 }}>
        <span style={{ fontSize: 19, fontWeight: 700, color: '#EFEADD' }}>{name}</span>
        <span
          aria-live={measuring ? 'polite' : undefined}
          style={isBand
            ? { fontFamily: T.fontDisplay, fontSize: 32, lineHeight: 1, color: T.goldBright, minWidth: 40, textAlign: 'right' }
            : { fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.muted, textAlign: 'right' }}
        >
          {shown}
          {measuring && <span aria-hidden="true" style={{ display: 'inline-block', width: 7, height: 7, marginLeft: 9, borderRadius: '50%', background: T.goldSoft, animation: 'sbxPulseDot 1.4s ease-in-out infinite', verticalAlign: 'middle' }} />}
        </span>
      </div>
      {note && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: T.muted, maxWidth: 640 }}>{note}</p>}
    </div>
  );
}
