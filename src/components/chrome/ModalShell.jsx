/**
 * ATAC Platform - ModalShell.jsx
 * Path: frontend/src/components/chrome/ModalShell.jsx
 *
 * Reusable modal primitive styled from the design-system foundation: a blurred
 * backdrop that fades/pops in, a centered container, focus-trap, Esc-to-close,
 * and click-outside-to-close. Honors prefers-reduced-motion (no blur-in/pop).
 *
 * Props: { open, onClose, labelledBy, children }
 *
 * This is a PRIMITIVE for a later group to adopt. It is intentionally NOT wired
 * into ConsentModal or PhotoVerificationModal in this PR.
 */

import { useEffect, useRef } from 'react';
import { color, radius, shadow } from '../../designSystem/tokens';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function ModalShell({ open, onClose, labelledBy, children }) {
  const containerRef = useRef(null);
  const lastFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    lastFocusedRef.current = document.activeElement;
    const node = containerRef.current;

    // Move focus into the dialog.
    const initial = node ? node.querySelectorAll(FOCUSABLE) : [];
    (initial[0] || node)?.focus?.();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === 'Tab' && node) {
        const f = node.querySelectorAll(FOCUSABLE);
        if (f.length === 0) { e.preventDefault(); return; }
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      lastFocusedRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="ds-modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="ds-modal-card"
        style={{
          outline: 'none',
          maxWidth: 720, width: '100%', maxHeight: '92vh', overflow: 'auto',
          borderRadius: radius.panel,
          background: color.cardGrad,
          border: `1px solid ${color.border}`,
          boxShadow: shadow.modal,
        }}
      >
        {children}
      </div>

      <style>{`
        .ds-modal-backdrop { animation: ds-modal-fade 0.18s ease both; }
        .ds-modal-card { animation: ds-modal-pop 0.2s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes ds-modal-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ds-modal-pop { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .ds-modal-backdrop, .ds-modal-card { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
