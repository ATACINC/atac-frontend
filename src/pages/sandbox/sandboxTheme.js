/**
 * ATAC Platform - sandboxTheme.js
 * Path: frontend/src/pages/sandbox/sandboxTheme.js
 *
 * Single source of truth for the redesigned /sandbox flow: the theme tokens
 * (mirrored as CSS custom properties in index.css) and the shared CSS string
 * (keyframes + responsive rules) injected once per post-gate screen.
 *
 * Tokens follow the approved design: a brighter gold (#EFC03C) for the live
 * flow, with the gate's vault gold (#C9A84C) kept as goldVault for the shared
 * background. Typography is Playfair Display (display) + Hanken Grotesk (body),
 * loaded in index.css.
 */

export const T = {
  bg:        '#080B12',   // --vault-bg (shared with the gate background)
  navy1:     '#0E1B30',   // premium card gradient (top)
  navy2:     '#080D16',   // premium card gradient (bottom)
  panel:     'rgba(255,255,255,0.022)',
  panelLine: 'rgba(255,255,255,0.07)',
  gold:      '#EFC03C',
  goldBright:'#FFD86B',
  goldDeep:  '#CC9A2E',
  goldVault: '#C9A84C',
  goldSoft:  '#F2CB5C',
  ink:       '#F5F1E6',
  ink2:      '#E7E4DA',
  muted:     '#A9ACB6',
  faint:     '#82868F',
  faint2:    '#6E727C',
  red:       '#E5484D',
  redInk:    '#E98086',
  green:     '#7FCBA6',
  greenInk:  '#9FE0C2',
  avatarBg:  '#102A4C',
  fontDisplay: "'Playfair Display', Georgia, 'Times New Roman', serif",
  fontBody:    "'Hanken Grotesk', system-ui, -apple-system, sans-serif",
};

// Colour a score by its band (matches the approved preview score bands). Pure.
export function scoreBand(n) {
  const s = Number(n);
  if (!Number.isFinite(s)) return { dot: 'rgba(255,255,255,0.25)', bar: 'rgba(255,255,255,0.18)', scoreColor: T.muted, pillBg: 'rgba(255,255,255,0.06)', pillBorder: 'rgba(255,255,255,0.16)', pillInk: T.muted };
  if (s >= 90) return { dot: '#7FCBA6', bar: 'linear-gradient(90deg,#5FA98A,#7FCBA6)', scoreColor: '#9FE0C2', pillBg: 'rgba(127,203,166,0.12)', pillBorder: 'rgba(127,203,166,0.34)', pillInk: '#9FE0C2' };
  if (s >= 80) return { dot: '#EFC03C', bar: 'linear-gradient(90deg,#CC9A2E,#FFD86B)', scoreColor: '#FFD86B', pillBg: 'rgba(239,192,60,0.12)',  pillBorder: 'rgba(239,192,60,0.34)',  pillInk: '#FFD86B' };
  if (s >= 70) return { dot: '#E0A852', bar: 'linear-gradient(90deg,#C98A36,#E8B968)', scoreColor: '#E8B968', pillBg: 'rgba(224,168,82,0.12)',  pillBorder: 'rgba(224,168,82,0.34)',  pillInk: '#E8B968' };
  return         { dot: '#E5848A', bar: 'linear-gradient(90deg,#C45A60,#E5848A)', scoreColor: '#E98086', pillBg: 'rgba(229,72,77,0.12)',   pillBorder: 'rgba(229,72,77,0.32)',   pillInk: '#E98086' };
}

// Injected once per post-gate screen. Keyframes are sbx-prefixed and identical
// in shape to the gate's, so the two never conflict across phases.
export const SANDBOX_CSS = `
  @keyframes sbxWave { 0%,100%{transform:scaleY(.30)} 50%{transform:scaleY(1)} }
  @keyframes sbxSpin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  @keyframes sbxGlowDrift { 0%,100%{transform:translate(0,0) scale(1);opacity:.5} 50%{transform:translate(-28px,18px) scale(1.08);opacity:.78} }
  @keyframes sbxPulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.8)} }
  @keyframes sbxFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sbxRingPulse { 0%{box-shadow:0 0 0 0 rgba(239,192,60,.34)} 70%{box-shadow:0 0 0 18px rgba(239,192,60,0)} 100%{box-shadow:0 0 0 0 rgba(239,192,60,0)} }
  @keyframes sbxShimmer { 0%{background-position:-160% 0} 100%{background-position:160% 0} }
  @keyframes sbxDots { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
  .sbx-fade { animation: sbxFadeUp .5s ease both; }
  .sbx-cta:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); box-shadow: 0 18px 38px -12px rgba(239,192,60,.72); }
  .sbx-cta:active:not(:disabled) { transform: translateY(0); }
  .sbx-ghost:hover { background: rgba(255,255,255,.05) !important; border-color: rgba(239,192,60,.4) !important; }
  .sbx-end:hover { background: rgba(229,72,77,.22) !important; }
  /* Customer account card (sandbox call screen). The card is always open on a */
  /* desktop width: the toggle is hidden and the body is forced visible, so a */
  /* card collapsed on a phone cannot stay hidden after a rotate to a wider */
  /* viewport. Only at 640 and below does the toggle appear and collapse. */
  .sbx-cpc-toggle { display: none; }
  .sbx-cpc-body { display: flex !important; }
  /* Desktop widening (the min-width side of the existing 880 family). The
     call screen widens; with an account card present it becomes a two-column
     grid, card in a sticky rail beside the internally-scrolling transcript so
     the card stays fully visible and End Call stays on screen. The debrief
     widens and scales its type so all five dimensions read without zooming.
     Nothing here fires at or below 880, so phone and tablet keep today's
     single column and the card collapse pattern. */
  @media (min-width: 881px) {
    .sbx-call-wrap { max-width: 1200px !important; }
    .sbx-call-wrap.sbx-call-has-rail {
      display: grid !important;
      grid-template-columns: 340px minmax(0, 1fr);
      column-gap: 28px;
      max-width: 1360px !important;
    }
    .sbx-call-has-rail .sbx-call-rail { align-self: start; position: sticky; top: 84px; }
    .sbx-turn-body { font-size: 19px !important; }
    .sbx-debrief-wrap { max-width: 1120px !important; }
    .sbx-debrief-wrap .sbx-dim-name { font-size: 18px !important; }
    .sbx-debrief-wrap .sbx-dim-bar { width: 300px !important; }
    .sbx-debrief-wrap .sbx-dim-feedback { font-size: 17px !important; max-width: 900px !important; }
  }
  @media (max-width: 640px) {
    .sbx-cpc-toggle { display: inline-flex; }
    .sbx-cpc-body.is-collapsed { display: none !important; }
    .sbx-cpc-row { flex-direction: column; align-items: flex-start !important; gap: 3px !important; }
    .sbx-cpc-row span:last-child { text-align: left !important; }
  }
  @media (max-width: 880px) {
    .sbx-chrome { padding-left: 22px !important; padding-right: 22px !important; }
    .sbx-brief-grid { grid-template-columns: 1fr !important; }
    .sbx-brief-rail { position: static !important; }
    .sbx-steps-labels { display: none !important; }
  }
  /* Below 640 the shield logo is brand enough; drop the wordmark so the header */
  /* logo and the step indicator never collide on a phone. */
  @media (max-width: 640px) {
    .sbx-wordmark { display: none !important; }
  }
  @media (max-width: 560px) {
    .sbx-chrome { padding-left: 16px !important; padding-right: 16px !important; gap: 10px !important; }
    .sbx-pad { padding-left: 16px !important; padding-right: 16px !important; }
    .sbx-h { font-size: 30px !important; }
    .sbx-wave-band { transform: scaleY(0.6); transform-origin: bottom; }
    .sbx-logo { height: 30px !important; }
    /* Compact step indicator: four small dots that always fit; active is gold. */
    .sbx-step-dot { width: 8px !important; height: 8px !important; border: none !important; color: transparent !important; }
    .sbx-step-dot svg { display: none !important; }
    .sbx-step-cur { background: #EFC03C !important; }
    .sbx-step-done { background: rgba(239,192,60,0.5) !important; }
    .sbx-step-future { background: rgba(255,255,255,0.18) !important; }
  }
`;

/* Shared button styles (kept here, not in the component file, so Fast Refresh
   only sees component exports there). */
export const goldCta = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  padding: 16, border: 'none', borderRadius: 11,
  background: `linear-gradient(135deg, ${T.goldBright}, ${T.gold} 55%, ${T.goldDeep})`,
  color: '#1A1206', fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
  cursor: 'pointer', fontFamily: T.fontBody,
  boxShadow: '0 14px 30px -12px rgba(239,192,60,0.6)',
  transition: 'transform 0.15s, filter 0.15s, box-shadow 0.15s',
};

export const ghostCta = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  padding: 16, borderRadius: 11, border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(255,255,255,0.02)', color: '#D5D7DE',
  fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
  cursor: 'pointer', fontFamily: T.fontBody,
  transition: 'background 0.16s, border-color 0.16s',
};
