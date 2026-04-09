/**
 * ATAC Global CX — "Vault" Design System
 * src/theme.js
 *
 * Luxury dark aesthetic — private bank meets Bloomberg terminal.
 * Import this into every page component for consistent tokens.
 *
 * Typography:
 *   Display: Cormorant Garamond — old-money serif, razor sharp
 *   Body:    Syne — precise, authoritative, technical
 *
 * Usage:
 *   import { T, C, F } from '../theme';
 */

// ── Color palette ─────────────────────────────────────────────────────────────
export const C = {
  // Backgrounds — layered depth
  bg:       '#080B12',   // true near-black, not navy
  bg1:      '#0C1018',   // card surface
  bg2:      '#101520',   // elevated surface
  bg3:      '#141B26',   // topbar / sidebar
  bg4:      '#1A2235',   // hover states

  // Gold — refined, like actual gold leaf, not yellow
  gold:     '#C9A84C',
  gold2:    '#D4B86A',
  gold3:    '#E8D49A',   // highlights
  goldDim:  'rgba(201,168,76,0.12)',
  goldBorder:'rgba(201,168,76,0.18)',

  // Teal — muted, professional
  teal:     '#1A8F69',
  teal2:    '#22B589',
  tealDim:  'rgba(26,143,105,0.12)',
  tealBorder:'rgba(26,143,105,0.2)',

  // Status
  red:      '#C0392B',
  redDim:   'rgba(192,57,43,0.12)',
  amber:    '#D4851A',
  amberDim: 'rgba(212,133,26,0.12)',

  // Typography
  white:    '#EEE9DF',   // warm white — not pure white, like cream paper
  muted:    'rgba(238,233,223,0.45)',
  faint:    'rgba(238,233,223,0.18)',
  ghost:    'rgba(238,233,223,0.08)',

  // Borders
  border:   'rgba(201,168,76,0.15)',   // gold-tinted hair line
  border2:  'rgba(238,233,223,0.07)',  // neutral hair line
  border3:  'rgba(238,233,223,0.03)',  // barely visible separator
};

// ── Typography ────────────────────────────────────────────────────────────────
export const F = {
  display: "'Cormorant Garamond', 'Times New Roman', serif",
  body:    "'Syne', 'DM Sans', sans-serif",
};

// ── Google Fonts import string ─────────────────────────────────────────────────
// Add to index.html or inject via component
export const FONT_IMPORT = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Syne:wght@400;500;600;700&display=swap');
`;

// ── Spacing scale ─────────────────────────────────────────────────────────────
export const S = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  40,
  xxl: 64,
};

// ── Shared component styles ───────────────────────────────────────────────────
export const T = {
  // Page wrapper
  page: {
    minHeight: '100vh',
    background: C.bg,
    fontFamily: F.body,
    color: C.white,
    position: 'relative',
    overflow: 'hidden',
  },

  // Noise texture overlay — inject as ::before pseudo on page
  // (handled via global CSS in index.css)

  // Topbar
  topbar: {
    background: C.bg3,
    borderBottom: `1px solid ${C.border}`,
    padding: '0 32px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(12px)',
  },

  // Brand wordmark
  brand: {
    fontFamily: F.display,
    fontSize: 17,
    fontWeight: 500,
    color: C.gold,
    letterSpacing: '0.08em',
    lineHeight: 1,
  },

  // Section eyebrow
  eyebrow: {
    fontFamily: F.body,
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: C.gold,
    marginBottom: 12,
  },

  // Display heading
  heading: {
    fontFamily: F.display,
    fontSize: 28,
    fontWeight: 400,
    color: C.white,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },

  // Subheading
  subhead: {
    fontFamily: F.display,
    fontSize: 18,
    fontWeight: 400,
    color: C.white,
    lineHeight: 1.3,
  },

  // Body text
  body: {
    fontFamily: F.body,
    fontSize: 13,
    color: C.muted,
    lineHeight: 1.7,
  },

  // Cards
  card: {
    background: C.bg1,
    border: `1px solid ${C.border2}`,
    borderRadius: 4,
    padding: '20px 24px',
  },

  cardElevated: {
    background: C.bg2,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    padding: '24px 28px',
  },

  // Gold rule — the signature detail
  goldRule: {
    height: 1,
    background: `linear-gradient(90deg, ${C.gold} 0%, transparent 100%)`,
    border: 'none',
    margin: '0',
    width: '100%',
  },

  // Buttons
  btnGold: {
    background: C.gold,
    color: C.bg,
    border: 'none',
    borderRadius: 3,
    padding: '12px 28px',
    fontFamily: F.body,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  btnGhost: {
    background: 'transparent',
    color: C.muted,
    border: `1px solid ${C.border2}`,
    borderRadius: 3,
    padding: '10px 20px',
    fontFamily: F.body,
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  btnTeal: {
    background: C.teal,
    color: C.white,
    border: 'none',
    borderRadius: 3,
    padding: '12px 28px',
    fontFamily: F.body,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  // Input fields
  input: {
    width: '100%',
    background: C.ghost,
    border: `1px solid ${C.border2}`,
    borderRadius: 3,
    padding: '12px 16px',
    fontFamily: F.body,
    fontSize: 13,
    color: C.white,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },

  // Badge / pill
  badge: (type) => {
    const map = {
      pass:    { bg: 'rgba(26,143,105,0.12)',  border: 'rgba(26,143,105,0.25)',  color: '#22B589' },
      fail:    { bg: 'rgba(192,57,43,0.12)',   border: 'rgba(192,57,43,0.25)',   color: '#E05C52' },
      pending: { bg: 'rgba(212,133,26,0.12)',  border: 'rgba(212,133,26,0.25)',  color: '#D4851A' },
      valid:   { bg: 'rgba(26,143,105,0.12)',  border: 'rgba(26,143,105,0.25)',  color: '#22B589' },
      active:  { bg: 'rgba(201,168,76,0.10)',  border: 'rgba(201,168,76,0.25)',  color: '#C9A84C' },
    };
    const c = map[type] || map.pending;
    return {
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      padding: '3px 9px',
      borderRadius: 2,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.color,
      whiteSpace: 'nowrap',
      display: 'inline-block',
    };
  },

  // Toast
  toast: (show, err) => ({
    position: 'fixed',
    top: 24,
    right: 24,
    background: err ? '#3D1010' : '#0D2B1F',
    border: `1px solid ${err ? 'rgba(192,57,43,0.4)' : 'rgba(26,143,105,0.4)'}`,
    color: err ? '#E05C52' : '#22B589',
    fontFamily: "'Syne', sans-serif",
    fontSize: 12,
    letterSpacing: '0.05em',
    padding: '12px 20px',
    borderRadius: 3,
    opacity: show ? 1 : 0,
    transform: show ? 'translateY(0)' : 'translateY(-8px)',
    transition: 'all 0.3s',
    pointerEvents: 'none',
    zIndex: 9999,
  }),

  // Sidebar nav item
  navItem: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 20px',
    fontSize: 11,
    fontWeight: active ? 500 : 400,
    letterSpacing: '0.06em',
    color: active ? C.gold : C.muted,
    cursor: 'pointer',
    borderLeft: `1px solid ${active ? C.gold : 'transparent'}`,
    background: active ? C.goldDim : 'transparent',
    transition: 'all 0.15s',
    userSelect: 'none',
    textTransform: 'uppercase',
  }),

  // Metric card number
  metricNum: {
    fontFamily: F.display,
    fontSize: 36,
    fontWeight: 300,
    lineHeight: 1,
    marginBottom: 4,
  },

  metricLbl: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: C.muted,
  },
};

// ── Animation keyframes (inject once into global CSS) ─────────────────────────
export const KEYFRAMES = `
  @keyframes vault-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes vault-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes vault-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes vault-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
`;

// ── Staggered animation helper ─────────────────────────────────────────────────
// Usage: style={{ ...vaultUp(0) }} for first item, vaultUp(1) for second, etc.
export function vaultUp(index = 0, duration = 0.5) {
  return {
    animation: `vault-up ${duration}s ease both`,
    animationDelay: `${index * 0.06}s`,
  };
}

export default { C, F, T, S, vaultUp, KEYFRAMES, FONT_IMPORT };