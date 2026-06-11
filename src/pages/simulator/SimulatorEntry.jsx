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
const AMBER = '#C48A2A';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const BORDER = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

// Discriminate the assign error: a 429 with code SIMULATOR_RETAKE_COOLDOWN
// is a legitimate cooldown state and gets its own UI (matches the dashboard
// CooldownCard treatment). Everything else falls through to the generic
// "could not start" card so a 500 or transient network error still surfaces
// clearly.
function parseAssignError(err) {
  const status = err?.response?.status;
  const data   = err?.response?.data;
  if (status === 429 && data?.code === 'SIMULATOR_RETAKE_COOLDOWN') {
    const hoursRemaining = typeof data.hours_remaining === 'number'
      ? data.hours_remaining
      : null;
    return {
      kind: 'cooldown',
      hoursRemaining,
      reason: data.error || data.message || null,
    };
  }
  const msg = data?.error || err?.message || 'Unknown error';
  return {
    kind: 'generic',
    message: `We could not assign your scenario. ${msg}. Please try again from your dashboard.`,
  };
}

const SESSION_STORAGE_KEY = 'atac_sim_session';
const SESSION_MAX_AGE_MIN = 5;

// Stash an /assign response payload + metadata into sessionStorage so
// downstream routes (Briefing, Call, Results) can read it without
// re-calling /assign on page transitions.
//
// Normalizes the backend snake_case payload to canonical camelCase so
// every reader can use a single field-name convention. Returns the
// normalized blob so callers can use blob.sessionId for navigation
// instead of reading the raw axios res.data (which is still snake_case).
export function stashSimulatorSession(assignResponseData, credentialId) {
  const d = assignResponseData || {};
  const blob = {
    sessionId:           d.session_id ?? d.sessionId ?? null,
    signedUrl:           d.signed_url ?? d.signedUrl ?? null,
    signedUrlExpiresAt:  d.signed_url_expires_at ?? d.signedUrlExpiresAt ?? null,
    agentId:             d.agent_id ?? d.agentId ?? null,
    scenarioName:        d.scenario_name ?? d.scenarioName ?? null,
    scenarioId:          d.scenario_id ?? d.scenarioId ?? null,
    scenarioCode:        d.scenario_code ?? d.scenarioCode ?? null,
    industry:            d.industry ?? null,
    difficulty:          d.difficulty ?? null,
    expectedDurationMin: d.expected_duration_min ?? d.expectedDurationMin ?? null,
    expectedDurationMax: d.expected_duration_max ?? d.expectedDurationMax ?? null,
    agentRole:           d.agent_role ?? d.agentRole ?? null,
    recommendedOpening:  d.recommended_opening ?? d.recommendedOpening ?? null,
    personaBio:          d.persona_bio ?? d.personaBio ?? null,
    scenarioContext:     d.scenario_context ?? d.scenarioContext ?? null,
    successCriteria:     d.success_criteria ?? d.successCriteria ?? null,
    passThreshold:       d.pass_threshold ?? d.passThreshold ?? 70,
    scoringWeights:      d.scoring_weights ?? d.scoringWeights ?? {
      greeting: 0.10, empathy: 0.25, resolution: 0.30, tone: 0.20, close: 0.15,
    },
    personaName:         d.persona_name ?? d.personaName ?? null,
    personaContext:      d.persona_context ?? d.personaContext ?? null,
    credentialId:        credentialId || null,
    createdAt:           Date.now(),
  };
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(blob));
  } catch (_) { /* quota / private-mode tolerant */ }
  return blob;
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

  // errorState is null | { kind: 'cooldown', hoursRemaining, reason }
  //                    | { kind: 'generic',  message }
  const [errorState, setErrorState] = useState(null);
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Concurrent-assignment protection runs once on mount.
  useEffect(() => {
    // Validate any existing sessionStorage payload is parseable; drop if not.
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      try {
        JSON.parse(existing);
        // TODO: resumable status tracking - writer does not currently set
        // a status field. Disabled until status updates are wired during
        // the call lifecycle. For now, always fall through to fresh assign
        // or picker.
        // const ageMinutes = (Date.now() - (parsed.createdAt || 0)) / 60000;
        // const resumable =
        //   ageMinutes < SESSION_MAX_AGE_MIN &&
        //   parsed.sessionId &&
        //   parsed.status !== 'completed' &&
        //   parsed.status !== 'scored';
        // if (resumable) {
        //   navigate(`/simulator/briefing/${parsed.sessionId}`, { replace: true });
        //   return;
        // }
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
      setErrorState({
        kind: 'generic',
        message: 'Simulator must be started from your dashboard. Redirecting...',
      });
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoAssign = async () => {
    setAutoAssigning(true);
    setErrorState(null);
    try {
      const res = await assignSimulator(null, null);
      const stashed = stashSimulatorSession(res.data, null);
      navigate(`/simulator/briefing/${stashed.sessionId}`, { replace: true });
    } catch (err) {
      setAutoAssigning(false);
      setErrorState(parseAssignError(err));
    }
  };

  // Pioneer flow: render the picker. ScenarioPicker forwards the raw
  // error object so this component can discriminate cooldown vs generic.
  if (isPioneerFlow && !errorState) {
    return (
      <ScenarioPicker
        credentialId={credentialId}
        onError={(err) => setErrorState(parseAssignError(err))}
      />
    );
  }

  // Cooldown state: the candidate's previous simulator attempt is still
  // inside the retake window. Matches the dashboard CooldownCard copy
  // ("Simulator cooldown active") and surfaces the backend's hours_remaining
  // plus its human-readable reason. Back to Dashboard is the only action;
  // a retry button here would just re-trigger the same 429.
  if (errorState && errorState.kind === 'cooldown') {
    // hours_remaining arrives as a float (e.g. 23.45). Round (not ceil)
    // so "about N hours" tracks the dashboard's precise "17h 08m"
    // countdown rather than rounding up to 18. When the remainder rounds
    // below an hour, say so plainly; the floor of 1 only guards the
    // N-hours path.
    const hours = errorState.hoursRemaining;
    const hasHours = typeof hours === 'number' && hours > 0;
    const rounded = hasHours ? Math.round(hours) : null;
    let cooldownLead;
    if (!hasHours) {
      cooldownLead = 'Your retry opens shortly.';
    } else if (rounded < 1) {
      cooldownLead = 'Your retry opens in less than an hour.';
    } else {
      const n = Math.max(1, rounded);
      cooldownLead = `Your retry opens in about ${n} ${n === 1 ? 'hour' : 'hours'}.`;
    }
    const cooldownMessage = `${cooldownLead} This is a short cooldown after an attempt, not an error - your progress is saved.`;
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
            maxWidth: 480,
            background: BG1,
            border: `1px solid ${BORDER2}`,
            borderLeft: `3px solid ${AMBER}`,
            borderRadius: 4,
            padding: '28px 32px',
          }}
        >
          <div style={{ fontSize: 11, color: AMBER, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 700 }}>
            Simulator on cooldown
          </div>
          <h2
            style={{
              fontFamily: VAULT_DISPLAY,
              fontSize: 26,
              fontWeight: 400,
              color: WHITE,
              margin: '0 0 12px',
              lineHeight: 1.2,
            }}
          >
            Simulator cooldown active
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(238,233,223,0.76)', lineHeight: 1.7, margin: '0 0 22px' }}>
            {cooldownMessage}
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

  // Generic error state (500 ASSIGN_FAILED, network failure, unknown).
  if (errorState && errorState.kind === 'generic') {
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
            {errorState.message}
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
