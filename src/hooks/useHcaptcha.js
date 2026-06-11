// src/hooks/useHcaptcha.js
// Shared hCaptcha integration, extracted verbatim from VerifyLanding.jsx
// so the register form can reuse the exact same pattern. Loads the
// hCaptcha script once (render=explicit), renders the widget into
// containerRef, tracks the token in component state ONLY (never logged,
// never persisted), and clears it on expiry or error.
//
// `enabled` exists for consumers whose widget container mounts
// conditionally (the Login/Register tab): the render effect re-runs when
// it flips, and the cleanup nulls the widget id + token so a re-enabled
// container gets a fresh widget. VerifyLanding leaves it at the default
// (true), which preserves its original single-run mount behavior exactly.

import { useEffect, useRef, useState } from 'react';

// Hardcoded fallback sitekey is intentional -- sitekeys are public-by-design
// and the production fallback ensures the form is captcha-protected even if
// the Vercel env var is missing. Mirrors the prior production behavior.
export const HCAPTCHA_SITEKEY =
  import.meta.env.VITE_HCAPTCHA_SITE_KEY ||
  import.meta.env.VITE_HCAPTCHA_SITEKEY ||
  '29525f8e-3e9c-41be-a0a0-a50abd621964';

const SCRIPT_SRC = 'https://js.hcaptcha.com/1/api.js?render=explicit';

export function useHcaptcha({ enabled = true, onVerify } = {}) {
  const [token, setToken] = useState('');
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  // Keep the latest onVerify without retriggering the render effect.
  // Written in an effect (not during render) per react-hooks/refs.
  const onVerifyRef = useRef(onVerify);
  useEffect(() => {
    onVerifyRef.current = onVerify;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    if (!containerRef.current) return undefined;

    const renderCaptcha = () => {
      if (!window.hcaptcha || !containerRef.current || widgetIdRef.current !== null) return;
      try {
        widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
          sitekey: HCAPTCHA_SITEKEY,
          theme: 'dark',
          callback: (t) => {
            setToken(t);
            if (typeof onVerifyRef.current === 'function') onVerifyRef.current(t);
          },
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        });
      } catch (err) {
        console.error('[hCaptcha] render error:', err);
      }
    };

    let interval = null;
    if (window.hcaptcha) {
      renderCaptcha();
    } else {
      const existing = document.querySelector('script[src^="https://js.hcaptcha.com/1/api.js"]');
      if (existing) {
        interval = setInterval(() => {
          if (window.hcaptcha) {
            clearInterval(interval);
            interval = null;
            renderCaptcha();
          }
        }, 100);
      } else {
        const script = document.createElement('script');
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = renderCaptcha;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
      // When the consumer hides the form (tab switch) the container
      // unmounts and the widget DOM is destroyed. Null the id and clear
      // the token so a later re-enable renders a fresh widget and the
      // user re-solves.
      widgetIdRef.current = null;
      setToken('');
    };
  }, [enabled]);

  const reset = () => {
    setToken('');
    if (window.hcaptcha && widgetIdRef.current !== null) {
      try { window.hcaptcha.reset(widgetIdRef.current); } catch { /* ignore */ }
    }
  };

  return { token, reset, containerRef };
}
