// src/components/LanguageSelector.jsx
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import API from '../api/client';
import { BUNDLE_CODES } from '../i18n';

// Flags are not in the API response. Emoji map keyed by lowercase code, with a
// neutral fallback for any language not listed. `pt` is included because it is
// the one extra language that renders (as coming_soon) in the current roster;
// everything else falls back to the globe.
const FLAGS = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  pt: '🇵🇹',
};
const NEUTRAL_FLAG = '🌐';
const flagFor = (code) => FLAGS[code] || NEUTRAL_FLAG;

// Fail-closed floor. Before the API resolves, and on any failure or malformed
// response, the selector offers English only. English always has a bundle and
// is always active, so this is the safe minimum, never the old hardcoded list.
const ENGLISH_ONLY = [
  { code: 'en', name: 'English', native: 'English', status: 'active', rtl: false, selectable: true },
];

// Turn the API payload into render options, applying both selectability gates.
// Case normalization happens HERE and only here: the API returns uppercase ids
// (EN/ES/FR); i18n, the flag map, and the bundle manifest are all lowercase.
function buildOptions(apiLanguages) {
  const out = [];
  for (const lang of apiLanguages) {
    const code = String(lang?.id ?? '').trim().toLowerCase(); // <-- normalization boundary
    if (!code) continue;
    const status = lang?.status;
    const hasBundle = BUNDLE_CODES.includes(code);
    const base = {
      code,
      name: lang?.name ?? code.toUpperCase(),
      native: lang?.nativeName ?? lang?.name ?? code.toUpperCase(),
      rtl: !!lang?.rtl,
    };
    if (status === 'active') {
      // Gate: active AND a bundle exists. Active-without-bundle is not offered.
      if (!hasBundle) continue;
      out.push({ ...base, status, selectable: true });
    } else if (status === 'coming_soon') {
      // Shown disabled as a roadmap signal. Non-clickable, so no bundle needed.
      out.push({ ...base, status, selectable: false });
    }
    // planned / unknown / anything else: not rendered at all.
  }
  // Guarantee English is always offered, even if the API omits it: fail closed
  // means never fewer choices than English, never more than the API allows.
  if (!out.some((o) => o.code === 'en')) {
    out.unshift(ENGLISH_ONLY[0]);
  }
  return out;
}

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(ENGLISH_ONLY);
  const ref = useRef(null);

  // Load the live language status from the API. Fail closed on any error,
  // timeout, or unexpected shape: keep English only, never the hardcoded list.
  // The endpoint is public, so the api client's 401->/login interceptor cannot
  // fire from here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next = ENGLISH_ONLY;
      try {
        const res = await API.get('/api/languages/available');
        const list = res?.data?.languages;
        if (Array.isArray(list)) {
          next = buildOptions(list);
        }
        // A non-array (malformed shape / stringified body) leaves next as the
        // English-only floor.
      } catch {
        // Network failure, timeout, 5xx: English only.
        next = ENGLISH_ONLY;
      }
      if (cancelled) return;
      setOptions(next);

      // Persistence correction. A candidate who selected French or Spanish
      // while those tabs were wrongly live has 'fr'/'es' persisted in
      // localStorage, which i18n loads on next visit (the bundle exists). If
      // the active language is no longer selectable, reset to English and
      // overwrite the stored value so this browser lands on English from now
      // on. Tradeoff, accepted: one brief flash of the old language's chrome
      // on the first load after this ships, then clean English every load
      // after. The alternative -- blocking header render on the API -- would
      // tax every user forever to spare a few users one flash.
      const selectable = next.filter((o) => o.selectable).map((o) => o.code);
      const activeLng = (i18n.language || 'en').split('-')[0].toLowerCase();
      if (!selectable.includes(activeLng)) {
        i18n.changeLanguage('en');
        try { localStorage.setItem('atac_language', 'en'); } catch { /* private mode */ }
        document.documentElement.setAttribute('dir', 'ltr');
        document.documentElement.setAttribute('lang', 'en');
      }
    })();
    return () => { cancelled = true; };
  }, [i18n]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeLng = (i18n.language || 'en').split('-')[0].toLowerCase();
  const current =
    options.find((o) => o.selectable && o.code === activeLng) ||
    options.find((o) => o.selectable) ||
    ENGLISH_ONLY[0];

  const handleSelect = (lang) => {
    if (!lang.selectable) return; // coming_soon rows are inert
    i18n.changeLanguage(lang.code);
    localStorage.setItem('atac_language', lang.code);
    // RTL is driven by the API's rtl flag now that the data exists. Identical
    // to the previous hardcoded 'ltr' in production, since no rtl language is
    // selectable today.
    document.documentElement.setAttribute('dir', lang.rtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang.code);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', zIndex: 1000 }}>

      {/* Trigger */}
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 14px', borderRadius: 8,
        border: '1px solid rgba(212,168,67,0.28)',
        background: open ? 'rgba(212,168,67,0.12)' : 'rgba(212,168,67,0.07)',
        color: '#d4a017', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
        letterSpacing: '0.03em', whiteSpace: 'nowrap',
        transition: 'background 0.2s, border-color 0.2s',
      }}>
        <span style={{ fontSize: 17 }}>{flagFor(current.code)}</span>
        <span>{current.native}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          minWidth: 190, background: '#0c1b32',
          border: '1px solid rgba(212,168,67,0.22)',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
          animation: 'atacLangIn 0.18s ease',
        }}>
          <style>{`
            @keyframes atacLangIn {
              from { opacity:0; transform:translateY(-6px); }
              to   { opacity:1; transform:translateY(0); }
            }
          `}</style>

          {/* Header */}
          <div style={{
            padding: '9px 14px 7px', fontSize: 10, fontWeight: 700,
            letterSpacing: '1.5px', textTransform: 'uppercase',
            color: 'rgba(212,168,67,0.55)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            {t('languages.selector_label', 'Language')}
          </div>

          {/* Options */}
          {options.map(lang => {
            const isCurrent = lang.selectable && lang.code === activeLng;
            const comingSoon = !lang.selectable;
            return (
              <div key={lang.code}
                onClick={() => handleSelect(lang)}
                aria-disabled={comingSoon ? 'true' : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 10,
                  padding: '11px 14px',
                  cursor: comingSoon ? 'default' : 'pointer',
                  opacity: comingSoon ? 0.5 : 1,
                  // Selection signal (distinct from the status pill on the
                  // right): gold left border + tint mark the CURRENT language.
                  background: isCurrent ? 'rgba(212,168,67,0.09)' : 'transparent',
                  borderLeft: `2px solid ${isCurrent ? '#d4a017' : 'transparent'}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isCurrent && !comingSoon) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isCurrent && !comingSoon) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 19 }}>{flagFor(lang.code)}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e8f0f8', lineHeight: 1.3 }}>
                      {lang.native}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(143,165,194,0.65)' }}>
                      {lang.name}
                    </div>
                  </div>
                </div>
                {/* Status signal (distinct from selection): a per-language pill
                    driven by the API's status, not by which row is selected.
                    Active -> teal "Available Now"; coming_soon -> grey. */}
                {lang.selectable ? (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '1px',
                    textTransform: 'uppercase', color: '#2dd4bf',
                    border: '1px solid rgba(45,212,191,0.3)',
                    borderRadius: 4, padding: '2px 7px',
                    background: 'rgba(45,212,191,0.08)',
                    whiteSpace: 'nowrap',
                  }}>{t('languages.active', 'Available Now')}</span>
                ) : (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '1px',
                    textTransform: 'uppercase', color: 'rgba(143,165,194,0.75)',
                    border: '1px solid rgba(143,165,194,0.25)',
                    borderRadius: 4, padding: '2px 7px',
                    background: 'rgba(143,165,194,0.06)',
                    whiteSpace: 'nowrap',
                  }}>{t('languages.coming_soon', 'Coming Soon')}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
