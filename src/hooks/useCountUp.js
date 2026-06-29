/**
 * ATAC Platform - useCountUp.js
 * Path: frontend/src/hooks/useCountUp.js
 *
 * Animates a number from 0 up to `target` with requestAnimationFrame.
 *
 *   - Honors prefers-reduced-motion: shows the final value immediately.
 *   - Settle-to-final fallback: if rAF is throttled or the tab is
 *     backgrounded, a timer guarantees the exact final value still lands.
 *   - Re-runs when `target` changes (e.g. when fetched config resolves from
 *     a 0/placeholder default to the real value).
 *
 * Returns the current integer to render.
 */

import { useEffect, useRef, useState } from 'react';

export function useCountUp(target, { duration = 900 } = {}) {
  const final = Number.isFinite(Number(target)) ? Number(target) : 0;
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reduced motion, no animation needed, or nothing to count to: jump to the
    // final value on the next frame (avoids a synchronous setState in effect).
    if (reduced || final <= 0) {
      const id = requestAnimationFrame(() => setValue(final));
      return () => cancelAnimationFrame(id);
    }

    let cancelled = false;
    let startTs = null;

    const tick = (ts) => {
      if (cancelled) return;
      if (startTs == null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(eased * final));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(final); // exact final on natural completion
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    // Settle-to-final guard: if rAF never completes (throttled/backgrounded),
    // force the exact final value shortly after the intended duration.
    const settle = setTimeout(() => { if (!cancelled) setValue(final); }, duration + 400);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(settle);
    };
  }, [final, duration]);

  return value;
}
