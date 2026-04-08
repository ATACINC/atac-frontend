// src/components/LanguageSelector.jsx
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', name: 'English',    native: 'English',  flag: '🇺🇸', status: 'active' },
  { code: 'es', name: 'Spanish',    native: 'Español',  flag: '🇪🇸', status: 'active' },
  { code: 'fr', name: 'French',     native: 'Français', flag: '🇫🇷', status: 'active' },
];

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);
  const current           = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (lang) => {
    i18n.changeLanguage(lang.code);
    localStorage.setItem('atac_language', lang.code);
    // RTL support — Arabic will use this when it launches
    document.documentElement.setAttribute('dir', 'ltr');
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
        <span style={{ fontSize: 17 }}>{current.flag}</span>
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
          {LANGUAGES.map(lang => {
            const isCurrent = lang.code === i18n.language;
            return (
              <div key={lang.code} onClick={() => handleSelect(lang)}
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 10,
                  padding: '11px 14px', cursor: 'pointer',
                  background: isCurrent ? 'rgba(212,168,67,0.09)' : 'transparent',
                  borderLeft: `2px solid ${isCurrent ? '#d4a017' : 'transparent'}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 19 }}>{lang.flag}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e8f0f8', lineHeight: 1.3 }}>
                      {lang.native}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(143,165,194,0.65)' }}>
                      {lang.name}
                    </div>
                  </div>
                </div>
                {isCurrent && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '1px',
                    textTransform: 'uppercase', color: '#2dd4bf',
                    border: '1px solid rgba(45,212,191,0.3)',
                    borderRadius: 4, padding: '2px 7px',
                    background: 'rgba(45,212,191,0.08)',
                    whiteSpace: 'nowrap',
                  }}>Active</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}