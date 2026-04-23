// frontend/src/hooks/useAssessmentIntegrity.js
// v2: Queue events locally during assessment, flush to backend on submit.
//
// v1 limitation: events fired during 'active' phase were dropped because
// assessmentId was null (not available until /submit-direct returned).
//
// v2 fix: Queue events in a ref while assessmentId is null. When assessmentId
// appears, flush the queue to POST /api/integrity/events/batch.
//
// Usage in Assessment.jsx:
//   useAssessmentIntegrity({
//     assessmentId: result?.assessmentId || null,
//     active: phase === 'active' || phase === 'processing'
//   });

import { useEffect, useRef } from 'react';
import API from '../api/client';

const QUEUE_MAX = 200;   // backend caps at 200 per batch
const FLUSH_MS = 2000;   // after assessmentId known, small delay before flush

export function useAssessmentIntegrity({ assessmentId, active }) {
  const blurTimeRef = useRef(null);
  const startedRef = useRef(false);
  const queueRef = useRef([]);
  const flushedRef = useRef(false);
  const flushTimerRef = useRef(null);

  // Push event to queue or send immediately depending on state
  const recordEvent = (eventType, durationMs = null, metadata = null) => {
    const ev = {
      eventType,
      clientTs: Date.now(),
      durationMs,
      metadata,
    };

    // If we have an assessmentId, send directly to the single-event endpoint
    if (assessmentId) {
      try {
        API.post('/api/integrity/event', {
          assessmentId,
          ...ev,
        }).catch(() => {});
      } catch (e) {}
      return;
    }

    // Otherwise queue locally
    if (queueRef.current.length < QUEUE_MAX) {
      queueRef.current.push(ev);
    }
    // If queue is full, drop silently (don't block the student's session)
  };

  // Flush queued events when assessmentId becomes available
  useEffect(() => {
    if (!assessmentId) return;
    if (flushedRef.current) return;
    if (queueRef.current.length === 0) {
      flushedRef.current = true;
      return;
    }

    // Small delay lets submit-direct complete writing IP/UA first
    flushTimerRef.current = setTimeout(() => {
      const eventsToFlush = queueRef.current.slice();
      queueRef.current = [];
      flushedRef.current = true;

      try {
        API.post('/api/integrity/events/batch', {
          assessmentId,
          events: eventsToFlush,
        }).catch((err) => {
          // If batch fails, the events are lost - acceptable tradeoff
          // (alternative: write to localStorage, retry on next mount)
        });
      } catch (e) {}
    }, FLUSH_MS);

    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, [assessmentId]);

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

  // Event listeners
  useEffect(() => {
    if (!active) return;

    const handleBlur = () => {
      blurTimeRef.current = Date.now();
      recordEvent('blur', null, { reason: 'window_blur' });
    };

    const handleFocus = () => {
      if (blurTimeRef.current) {
        const awayMs = Date.now() - blurTimeRef.current;
        recordEvent('focus', awayMs, { reason: 'window_focus' });
        blurTimeRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurTimeRef.current = Date.now();
        recordEvent('visibility_hidden', null, { visibilityState: document.visibilityState });
      } else {
        if (blurTimeRef.current) {
          const awayMs = Date.now() - blurTimeRef.current;
          recordEvent('visibility_visible', awayMs, { visibilityState: document.visibilityState });
          blurTimeRef.current = null;
        }
      }
    };

    const handleCopy = () => {
      recordEvent('copy_attempt', null, {
        selection: (window.getSelection()?.toString() || '').slice(0, 60),
      });
    };

    const handlePaste = () => {
      recordEvent('paste_attempt');
    };

    const handleContextMenu = () => {
      recordEvent('right_click');
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
  }, [active]);
}

export default useAssessmentIntegrity;
