/**
 * ATAC Platform - SimulatorEntry.jsx
 * Path: frontend/src/pages/simulator/SimulatorEntry.jsx
 *
 * Entry point for the ATAC Call Readiness Simulator at route /simulator.
 *
 * Two distinct flows, branched on URL params:
 *
 *   Flow A - New candidate (no credential_id param):
 *     POST /api/sim-live/assign with no scenario_code. Backend auto-assigns
 *     a scenario based on candidate's assessment profile. Stash session and
 *     redirect to /simulator/briefing/:sessionId.
 *
 *   Flow B - Pioneer supplementary attempt (credential_id present):
 *     Render the ScenarioPicker. User selects one of four scenarios. POST
 *     /api/sim-live/assign with { scenario_code, credential_id }. Stash and
 *     redirect to briefing.
 *
 * Concurrent assignment protection: before any /assign call, check
 * sessionStorage for an existing recent session (< 5 minutes old, not
 * completed or scored). If found, resume by redirecting straight to the
 * briefing for that session. Prevents duplicate /assign calls when a
 * candidate refreshes or revisits /simulator mid-flow.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { assignSimulator } from '../../api/client';
import ScenarioPicker from './ScenarioPicker';
import SimulatorLoadingScreen from './SimulatorLoadingScreen';

// Vault tokens (consistent across all simulator components)
const BG    = '#080B12';
const BG1   = '#0C1018';
const GOLD  = '#C9A84C';
const RED   = '#C45C5C';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const BORDER = 'rgba(201,168,76,0.15)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const SESSION_STORAGE_KEY = 'atac_sim_session';
const SESSION_MAX_AGE_MIN = 5;

// Stash an /assign response payload + metadata into sessionStorage so
// downstream routes (Briefing, Call, Results) can read it without
// re-calling /assign on page transitions.
export function stashSimulatorSession(assignResponseData, credentialId) {
  const blob = {
    ...assignResponseData,
    credentialId: credentialId || null,
    createdAt: Date.now(),
  };
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(blob));
  } catch (_) { /* quota / private-mode tolerant */ }
}

export default function SimulatorEntry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const credentialId = searchParams.get('credential_id');
  // 'choose' URL param is informational; presence of credential_id is the
  // canonical Pioneer signal (a Pioneer flow always passes both).
  const isPioneerFlow = !!credentialId;
  // Explicit auto-assign gate. Only the assessment-pass redirect appends
  // ?auto=true. Bare /simulator visits (back button, manual nav, remount
  // during lazy chunk load) must NOT trigger an auto-assign with null args.
  const autoFlag = searchParams.get('auto') === 'true';
  const isAutoFlow = autoFlag && !isPioneerFlow;

  const [error, setError] = useState(null);
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Concurrent-assignment protection runs once on mount.
  useEffect(() => {
    // First: check for a resumable session.
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        const ageMinutes = (Date.now() - (parsed.createdAt || 0)) / 60000;
        const resumable =
          ageMinutes < SESSION_MAX_AGE_MIN &&
          parsed.sessionId &&
          parsed.status !== 'completed' &&
          parsed.status !== 'scored';
        if (resumable) {
          navigate(`/simulator/briefing/${parsed.sessionId}`, { replace: true });
          return;
        }
      } catch (_) {
        // Malformed sessionStorage. Drop and fall through to fresh assign.
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }

    // No resumable session. For new candidates with an explicit auto=true
    // signal (only the assessment-pass redirect sets this), auto-assign
    // immediately. For Pioneers, do nothing here; ScenarioPicker handles
    // its own assign on user selection. For everyone else who arrived at
    // bare /simulator without a valid entry signal, bounce to dashboard.
    if (isAutoFlow) {
      autoAssign();
    } else if (!isPioneerFlow) {
      // No credential_id and no auto=true. User arrived at /simulator
      // without a valid entry signal. Send them back to dashboard.
      setError('Simulator must be started from your dashboard. Redirecting...');
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoAssign = async () => {
    setAutoAssigning(true);
    setError(null);
    try {
      const res = await assignSimulator(null, null);
      stashSimulatorSession(res.data, null);
      navigate(`/simulator/briefing/${res.data.sessionId}`, { replace: true });
    } catch (err) {
      setAutoAssigning(false);
      const msg = err?.response?.data?.error || err?.message || 'Unknown error';
      setError(`We could not assign your scenario. ${msg}. Please try again from your dashboard.`);
    }
  };

  // Pioneer flow: render the picker. ScenarioPicker handles assign on click.
  if (isPioneerFlow && !error) {
    return (
      <ScenarioPicker
        credentialId={credentialId}
        onError={(msg) => setError(msg)}
      />
    );
  }

  // Error state for either flow.
  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: BG,
          color: WHITE,
          fontFamily: VAULT_BODY,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 460,
            background: BG1,
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 11, color: RED, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14 }}>
            Could not start simulator
          </div>
          <p style={{ fontSize: 14, color: WHITE, lineHeight: 1.6, margin: '0 0 22px' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              background: GOLD,
              color: BG,
              border: 'none',
              borderRadius: 2,
              padding: '12px 22px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: VAULT_BODY,
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // New-candidate auto-assign is in flight. Show the lazy-load screen as
  // a consistent loading state (same component, no flicker).
  if (autoAssigning || !isPioneerFlow) {
    return <SimulatorLoadingScreen />;
  }

  // Fall-through (should not reach here in practice).
  return <SimulatorLoadingScreen />;
}
