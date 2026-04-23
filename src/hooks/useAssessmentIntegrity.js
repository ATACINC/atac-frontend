// frontend/src/hooks/useAssessmentIntegrity.js
// Behavioral integrity tracking hook for assessments.
// Detects blur/focus, visibility changes, copy/paste, right-click.
// Posts events to the backend /api/integrity endpoints.
//
// Usage in Assessment.jsx:
//   import { useAssessmentIntegrity } from '../hooks/useAssessmentIntegrity';
//   useAssessmentIntegrity({ assessmentId, active: phase === 'active' });

import { useEffect, useRef } from 'react';
import API from '../api/client';

export function useAssessmentIntegrity({ assessmentId, active }) {
  const blurTimeRef = useRef(null);
  const startedRef = useRef(false);

  // Send event to backend (fire-and-forget)
  const sendEvent = (eventType, durationMs = null, metadata = null) => {
    if (!assessmentId) return;
    try {
      API.post('/api/integrity/event', {
        assessmentId,
        eventType,
        clientTs: Date.now(),
        durationMs,
        metadata,
      }).catch(() => {}); // silent fail - integrity shouldn't break the test
    } catch (e) {
      // swallow errors
    }
  };

  // Register assessment start once per mount
  useEffect(() => {
    if (!assessmentId || !active || startedRef.current) return;
    startedRef.current = true;
    try {
      API.post('/api/integrity/assessment-start', { assessmentId })
        .catch(() => {});
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, active]);

  // Blur / focus tracking
  useEffect(() => {
    if (!active || !assessmentId) return;

    const handleBlur = () => {
      blurTimeRef.current = Date.now();
      sendEvent('blur', null, { reason: 'window_blur' });
    };

    const handleFocus = () => {
      if (blurTimeRef.current) {
        const awayMs = Date.now() - blurTimeRef.current;
        sendEvent('focus', awayMs, { reason: 'window_focus' });
        blurTimeRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurTimeRef.current = Date.now();
        sendEvent('visibility_hidden', null, { visibilityState: document.visibilityState });
      } else {
        if (blurTimeRef.current) {
          const awayMs = Date.now() - blurTimeRef.current;
          sendEvent('visibility_visible', awayMs, { visibilityState: document.visibilityState });
          blurTimeRef.current = null;
        }
      }
    };

    const handleCopy = (e) => {
      sendEvent('copy_attempt', null, {
        selection: (window.getSelection()?.toString() || '').slice(0, 60),
      });
    };

    const handlePaste = (e) => {
      sendEvent('paste_attempt');
    };

    const handleContextMenu = (e) => {
      // Don't suppress in dev mode (lets Tugs right-click during testing)
      // In production, we could preventDefault() here. For now, just log.
      sendEvent('right_click');
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, assessmentId]);
}

export default useAssessmentIntegrity;
