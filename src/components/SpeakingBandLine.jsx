/**
 * Speaking band (estimated) indicator.
 * File: src/components/SpeakingBandLine.jsx
 *
 * One line: "Speaking band (estimated): B2", plus a one-line note that
 * pronunciation is not yet assessed. Renders nothing unless the
 * VITE_SPEAKING_BAND_ENABLED flag is on AND a band is present, so every
 * existing page is unchanged by default.
 *
 * Wording rules: "speaking band", "estimated", "indicator". The band is
 * aligned to language descriptors; it is never described as a certificate
 * or an official level, and no vendor is named.
 */

import { SPEAKING_BAND_ENABLED } from '../utils/featureFlags';

const BANDS = ['A2', 'B1', 'B2', 'C1'];

export const SPEAKING_BAND_NOTE = 'Estimated from the words in the call transcript. Pronunciation is not yet assessed.';

export default function SpeakingBandLine({
  band,
  color = '#EEE9DF',
  muted = 'rgba(238,233,223,0.62)',
  accent = '#C9A84C',
  fontFamily,
  align = 'left',
  style,
}) {
  if (!SPEAKING_BAND_ENABLED) return null;
  if (!BANDS.includes(band)) return null;

  return (
    <div
      data-testid="speaking-band-line"
      style={{ textAlign: align, fontFamily, lineHeight: 1.5, ...style }}
    >
      <div style={{ fontSize: 14, color }}>
        Speaking band (estimated):{' '}
        <strong style={{ color: accent, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>{band}</strong>
      </div>
      <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
        {SPEAKING_BAND_NOTE}
      </div>
    </div>
  );
}
