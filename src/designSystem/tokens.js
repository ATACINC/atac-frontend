/**
 * ATAC Platform - Design System tokens (canonical, shared)
 * Path: frontend/src/designSystem/tokens.js
 *
 * Single import point for the redesign's visual language, to be shared by the
 * /sandbox flow and (going forward) re-skinned production screens. This module
 * is FOUNDATION ONLY: it exposes tokens + style primitives. It does not restyle
 * any screen and is not yet imported by any screen.
 *
 * Provenance / single-source: the approved brand direction already lives in the
 * /sandbox flow (src/pages/sandbox/sandboxTheme.js). That module stays the
 * runtime source for /sandbox (unchanged for back-compat). Here we IMPORT its
 * values so colours/fonts are never duplicated, then fill the remaining
 * canonical tokens (true background, domain accents, the type / radius / shadow
 * / spacing / motion scales). The matching CSS custom properties live in
 * src/designSystem/foundation.css.
 *
 * The older "Vault" system (src/theme.js, #C9A84C + Cormorant/Syne) is untouched
 * and still used by production screens.
 */

import { T as sbx, scoreBand, goldCta, ghostCta, SANDBOX_CSS } from '../pages/sandbox/sandboxTheme';

export const color = {
  // Surfaces
  bg:           '#06080C',          // canonical app background (spec)
  bgSandbox:    sbx.bg,             // #080B12 - what /sandbox actually renders on
  panel:        'rgba(255,255,255,0.02)',
  panelSoft:    sbx.panel,          // rgba(255,255,255,0.022)
  border:       'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.08)',
  navy1:        sbx.navy1,          // #0E1B30
  navy2:        sbx.navy2,          // #080D16
  cardGrad:     `linear-gradient(165deg, ${sbx.navy1}, ${sbx.navy2})`,
  chromeBg:     'rgba(6,8,12,0.6)',
  chromeBorder: 'rgba(255,255,255,0.06)',

  // Gold
  gold:      sbx.gold,        // #EFC03C
  goldLight: sbx.goldBright,  // #FFD86B
  goldDeep:  sbx.goldDeep,    // #CC9A2E
  goldVault: sbx.goldVault,   // #C9A84C (legacy bridge to Vault gold)
  goldGrad:  `linear-gradient(135deg, ${sbx.goldBright}, ${sbx.gold} 55%, ${sbx.goldDeep})`,
  eyebrow:   sbx.goldSoft,    // #F2CB5C

  // Green / pass
  green:     sbx.green,       // #7FCBA6
  greenText: sbx.greenInk,    // #9FE0C2
  greenGrad: 'linear-gradient(90deg, #5FA98A, #7FCBA6)',
  greenTint: 'rgba(99,170,140,0.10)',

  // Alert / live
  red:     sbx.red,           // #E5484D
  redText: sbx.redInk,        // #E98086

  // Text
  heading:    sbx.ink,        // #F5F1E6
  heading2:   '#F4EFE3',
  body:       sbx.muted,      // #A9ACB6
  secondary:  '#9296A0',
  secondary2: sbx.faint,      // #82868F
  muted:      '#7E8290',
  muted2:     sbx.faint2,     // #6E727C

  // "Most Popular"
  popular:      '#6FA3E0',
  popularLight: '#8FCBE0',
};

// Six competency-domain accents.
export const domain = {
  professionalism:  '#EFC03C',
  communication:    '#6FA3E0',
  cxOperations:     '#7FCBA6',
  technology:       '#A98FE0',
  complianceSafety: '#E5848A',
  remoteWorkSetup:  '#5FBFC4',
};

export const font = {
  display: sbx.fontDisplay,   // Playfair Display 500 (headings)
  body:    sbx.fontBody,      // Hanken Grotesk 300-800 (UI/body)
};

export const type = {
  h1:        'clamp(34px, 4.4vw, 52px)',
  h1Compact: 'clamp(30px, 3.8vw, 44px)',
  sectionTitleMin: 20,
  sectionTitleMax: 27,
  bodyFontSize: 15,           // 14-16
  bodyLineHeight: 1.6,
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' },
};

export const radius = { sm: 9, card: 14, panel: 18, pill: 999 };

export const shadow = {
  panel:  '0 40px 90px -38px rgba(0,0,0,0.85)',
  modal:  '0 30px 70px -36px rgba(0,0,0,0.85)',
  button: '0 14px 30px -12px rgba(239,192,60,0.6)',
};

export const space = {
  pageX: 48, pageXMobile: 22,
  cardPad: 28,
  gridGap: 18,
  contentMax: 1180,
  formMax: 600,
};

export const motion = {
  countUpMs: 850,
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  hoverLift: 'translateY(-2px)',
  hoverSec: 0.16,
};

export const breakpoint = { lg: 980, sm: 620 };

/* ---- Foundation style primitives (objects; NOT applied to any screen) ---- */

export const eyebrow = {
  fontFamily: font.body,
  fontSize: 11, fontWeight: 700, letterSpacing: '0.2em',
  textTransform: 'uppercase', color: color.eyebrow,
};

export const goldButton = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  border: 'none', borderRadius: radius.sm, padding: '14px 22px',
  background: color.goldGrad, color: '#1A1206',
  fontFamily: font.body, fontSize: 13, fontWeight: 700,
  letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer',
  boxShadow: shadow.button,
  transition: 'transform 0.16s, filter 0.16s, box-shadow 0.16s',
};

export const panelSurface = {
  background: color.panel, border: `1px solid ${color.border}`,
  borderRadius: radius.panel,
};

export const cardElevated = {
  background: color.cardGrad, border: '1px solid rgba(239,192,60,0.2)',
  borderRadius: radius.card, boxShadow: shadow.panel,
};

// Ambient app background (object mirror of the .ds-app-bg CSS class): radial
// gold (top-right) + navy (bottom-left) glow over the canonical background.
// The grid + top hairline are added by the .ds-app-bg pseudo-elements in CSS.
export const appBackground = {
  position: 'relative', minHeight: '100vh', width: '100%', overflowX: 'hidden',
  background:
    'radial-gradient(1100px 720px at 78% 0%, rgba(239,192,60,0.10), rgba(239,192,60,0) 60%), ' +
    'radial-gradient(900px 640px at 4% 100%, rgba(20,52,96,0.28), rgba(20,52,96,0) 62%), ' +
    color.bg,
  color: color.body, fontFamily: font.body,
};

// Re-export the exact /sandbox runtime primitives so future screens can import
// everything from this one module (these are the same objects /sandbox uses).
export { scoreBand, goldCta, ghostCta, SANDBOX_CSS };
export { sbx as sandboxTokens };

export const tokens = { color, domain, font, type, radius, shadow, space, motion, breakpoint };
export default tokens;
