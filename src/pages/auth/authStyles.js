/**
 * ATAC Platform — shared auth styling for the standalone password-reset surfaces.
 * File: frontend/src/pages/auth/authStyles.js
 *
 * ⚠️ Auth tokens duplicated here, keep in sync (with src/pages/Login.jsx).
 * These token values and the `.atac-input` / `.atac-cta` / `.atac-link` /
 * `.vault-up-*` rules are copied VERBATIM from Login.jsx's injectStyles() so
 * ForgotPassword / ResetPassword render byte-identical to the login page without
 * importing or mounting the full Login component. If you change a value or a
 * rule in one place, change it in the other.
 */

export const BG       = '#080B12';
export const BG1      = '#0C1018';
export const BG2      = '#101520';
export const BG3      = '#0A0E16';
export const GOLD     = '#C9A84C';
export const GOLD_DIM = 'rgba(201,168,76,0.55)';
export const TEAL     = '#1A8F69';
export const WHITE    = '#EEE9DF';
export const MUTED    = 'rgba(238,233,223,0.62)';
export const FAINT    = 'rgba(238,233,223,0.38)';
export const BORDER   = 'rgba(201,168,76,0.18)';
export const BORDER2  = 'rgba(238,233,223,0.08)';
export const RED      = '#E05C52';

export const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
export const VAULT_BODY    = "'Syne', 'DM Sans', system-ui, sans-serif";

// Inject the auth font + shared classes once. Uses its own <style> id so it is
// independent of Login's injectStyles(); the rules are identical, so if both
// ever mount on the same document the duplicate class definitions are harmless.
export function injectAuthStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('atac-auth-styles-v1')) return;
  const style = document.createElement('style');
  style.id = 'atac-auth-styles-v1';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Syne:wght@400;500;600;700&display=swap');
    @keyframes vault-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .vault-up-1 { animation: vault-up 600ms cubic-bezier(.2,.7,.2,1) both; animation-delay: 60ms; }
    .vault-up-2 { animation: vault-up 600ms cubic-bezier(.2,.7,.2,1) both; animation-delay: 120ms; }
    .vault-up-3 { animation: vault-up 600ms cubic-bezier(.2,.7,.2,1) both; animation-delay: 180ms; }
    .atac-input {
      width: 100%;
      box-sizing: border-box;
      background: rgba(8,11,18,0.6);
      border: 1px solid ${BORDER2};
      border-radius: 3px;
      color: ${WHITE};
      font-family: ${VAULT_BODY};
      font-size: 16px;
      padding: 16px 18px;
      outline: none;
      transition: border-color 180ms ease, background 180ms ease;
    }
    .atac-input::placeholder { color: rgba(238,233,223,0.30); }
    .atac-input:focus { border-color: ${GOLD}; background: rgba(8,11,18,0.85); }
    .atac-cta {
      width: 100%;
      padding: 18px 24px;
      border: none;
      border-radius: 3px;
      background: ${GOLD};
      color: ${BG};
      font-family: ${VAULT_BODY};
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      cursor: pointer;
      transition: transform 120ms ease, opacity 180ms ease, box-shadow 180ms ease;
    }
    .atac-cta:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(201,168,76,0.20); }
    .atac-cta:disabled { opacity: 0.4; cursor: not-allowed; }
    .atac-link { color: ${GOLD}; background: none; border: none; padding: 0; cursor: pointer;
                 font-family: ${VAULT_BODY}; font-size: 13px; border-bottom: 1px solid ${GOLD_DIM}; }
    .atac-link:hover { border-bottom-color: ${GOLD}; }
  `;
  document.head.appendChild(style);
}
