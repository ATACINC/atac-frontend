/**
 * ATAC Platform - useAssessmentConfig.js
 * Path: frontend/src/hooks/useAssessmentConfig.js
 *
 * Fetches GET /api/assessment/config -> { questions, timeLimitSec, passPct }
 * once via the shared axios client, and exposes derived display values:
 *
 *   questions    number of assessment questions
 *   minutes      timeLimitSec converted to whole minutes (2400 -> 40)
 *   passPct      pass threshold percentage
 *
 * Values are null until the request resolves so callers can render a genuine
 * loading state; on error they stay null and `error` is set. The canonical
 * numbers always come from the API once it lands - there are no hardcoded
 * question/time/pass literals here.
 */

import { useEffect, useState } from 'react';
import API from '../api/client';

export function useAssessmentConfig() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    API.get('/api/assessment/config')
      .then((res) => {
        if (cancelled) return;
        const d = res?.data || {};
        if (typeof d.questions === 'number' || typeof d.timeLimitSec === 'number') {
          setConfig(d);
        } else {
          setError('config');
        }
      })
      .catch(() => { if (!cancelled) setError('config'); });
    return () => { cancelled = true; };
  }, []);

  const questions = typeof config?.questions === 'number' ? config.questions : null;
  const minutes = typeof config?.timeLimitSec === 'number' ? Math.round(config.timeLimitSec / 60) : null;
  const passPct = typeof config?.passPct === 'number' ? config.passPct : null;

  return { config, questions, minutes, passPct, error, loading: config === null && !error };
}
