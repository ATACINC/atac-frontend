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

import { useEffect, useRef, useState } from 'react';
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

// Format a future Date as a friendly, ASCII-only local unlock time:
// "today at 1:30 PM", "tomorrow at 1:30 PM", or "on Monday at 1:30 PM".
// Returns null for an invalid date so callers fall back to generic copy.
function formatUnlockTime(target) {
  if (!(target instanceof Date) || Number.isNaN(target.getTime())) return null;
  let h = target.getHours();
  const m = String(target.getMinutes()).padStart(2, '0');
  const meridiem = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const time = `${h}:${m} ${meridiem}`;
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((dayStart(target) - dayStart(new Date())) / 86400000);
  if (dayDiff <= 0) return `today at ${time}`;
  if (dayDiff === 1) return `tomorrow at ${time}`;
  return `on ${target.toLocaleDateString([], { weekday: 'long' })} at ${time}`;
}

const SESSION_STORAGE_KEY = 'atac_sim_session';
const SESSION_MAX_AGE_MIN = 5;

// Re-poll cadence while queued. Each tick re-POSTs /assign, which both
// refreshes the position and acts as the keep-alive that admits the
// candidate when a line opens. Stopping the loop (leaving the page) lets
// the backend age the candidate out of the queue, which is intended.
const QUEUE_REPOLL_MS = 12000;

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

  // Queue state. null when not queued; { position, message } when all lines
  // are busy and we are holding the candidate's place. The re-poll interval
  // below drives both the position refresh and the eventual admission.
  const [queued, setQueued] = useState(null);
  // Interval handle for the keep-alive re-poll, plus the assign args to
  // re-poll with (null/null for the auto flow; scenario_code/credential_id
  // for the Pioneer flow, so a re-poll re-assigns the SAME scenario).
  const pollRef = useRef(null);
  const repollArgsRef = useRef({ scenarioCode: null, credentialId: null });

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

  // Stop the keep-alive if the candidate leaves the page. Aging out of the
  // queue on unmount is correct: the backend frees the held slot once the
  // re-poll stops arriving.
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const stopQueuePolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Admit-on-repoll. Re-POST /assign with the saved args. A queued response
  // just refreshes the position; a non-queued (signed_url) response means a
  // line opened, so we stash + advance into the briefing exactly as a
  // first-try assign would. Errors surface through the same cooldown/generic
  // discrimination used on the initial attempt.
  const repollAssign = async () => {
    const { scenarioCode, credentialId } = repollArgsRef.current;
    try {
      const res = await assignSimulator(scenarioCode, credentialId);
      if (res.data?.queued === true) {
        setQueued({
          position: res.data.position ?? null,
          message:  res.data.message ?? null,
        });
        return;
      }
      stopQueuePolling();
      setQueued(null);
      const stashed = stashSimulatorSession(res.data, credentialId || null);
      navigate(`/simulator/briefing/${stashed.sessionId}`, { replace: true });
    } catch (err) {
      stopQueuePolling();
      setQueued(null);
      setErrorState(parseAssignError(err));
    }
  };

  // Enter the wait state: remember how to re-poll, render the wait view, and
  // start the keep-alive interval. Guarded so we never stack intervals.
  const enterQueue = (data, args) => {
    repollArgsRef.current = {
      scenarioCode: args?.scenarioCode ?? null,
      credentialId: args?.credentialId ?? null,
    };
    setAutoAssigning(false);
    setQueued({
      position: data?.position ?? null,
      message:  data?.message ?? null,
    });
    if (!pollRef.current) {
      pollRef.current = setInterval(repollAssign, QUEUE_REPOLL_MS);
    }
  };

  const autoAssign = async () => {
    setAutoAssigning(true);
    setErrorState(null);
    try {
      const res = await assignSimulator(null, null);
      if (res.data?.queued === true) {
        // All lines busy. Hold the candidate's place and let the re-poll
        // loop admit them when one frees up. HTTP 200, NOT an error.
        enterQueue(res.data, { scenarioCode: null, credentialId: null });
        return;
      }
      const stashed = stashSimulatorSession(res.data, null);
      navigate(`/simulator/briefing/${stashed.sessionId}`, { replace: true });
    } catch (err) {
      setAutoAssigning(false);
      setErrorState(parseAssignError(err));
    }
  };

  // All lines busy: render the wait view. The keep-alive interval started in
  // enterQueue keeps re-polling /assign in the background and will transition
  // straight into the briefing the moment a line opens. Takes precedence over
  // the picker and loading states.
  if (queued) {
    return (
      <QueueWaitView
        position={queued.position}
        message={queued.message}
        onCancel={() => {
          stopQueuePolling();
          setQueued(null);
          navigate('/dashboard');
        }}
      />
    );
  }

  // Pioneer flow: render the picker. ScenarioPicker forwards the raw error
  // object (cooldown vs generic) and, on a queued response, the queued
  // payload plus its assign args so the re-poll re-assigns the same scenario.
  if (isPioneerFlow && !errorState) {
    return (
      <ScenarioPicker
        credentialId={credentialId}
        onError={(err) => setErrorState(parseAssignError(err))}
        onQueued={enterQueue}
      />
    );
  }

  // Cooldown state: the candidate's previous attempt is still inside the 24h
  // retake window. A calm "almost ready" screen, NOT an error. The 429
  // carries no absolute timestamp, so derive a friendly unlock time from
  // hours_remaining. Back to Dashboard is the only action; a retry here
  // would just re-trigger the same 429. Mirrors the dashboard CooldownCard.
  if (errorState && errorState.kind === 'cooldown') {
    const hours = errorState.hoursRemaining;
    const hasHours = typeof hours === 'number' && hours > 0;
    const unlockStr = hasHours
      ? formatUnlockTime(new Date(Date.now() + hours * 3600 * 1000))
      : null;
    const cooldownBody = unlockStr
      ? `There is a short wait between attempts so you can come back fresh. Your next run unlocks ${unlockStr}. Use the time to review your feedback so your next call is your strongest one.`
      : 'There is a short wait between attempts so you can come back fresh. Your next run unlocks shortly. Use the time to review your feedback so your next call is your strongest one.';
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
            borderLeft: `3px solid ${GOLD}`,
            borderRadius: 4,
            padding: '28px 32px',
          }}
        >
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 700 }}>
            Cooldown in progress
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
            Your next attempt is almost ready
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(238,233,223,0.76)', lineHeight: 1.7, margin: '0 0 22px' }}>
            {cooldownBody}
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

// Queue wait view. Rendered while all simulator lines are busy. Mirrors the
// cooldown card aesthetic (amber accent, Vault tokens): it is a hold state,
// not an error. The pulsing dot signals that we are actively re-checking;
// admission happens in the background via the re-poll loop in SimulatorEntry.
function QueueWaitView({ position, message, onCancel }) {
  const hasPosition = typeof position === 'number' && position > 0;
  const lead =
    message ||
    'All simulator lines are busy right now. We are holding your place and will connect you automatically the moment one opens.';
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span className="sim-q-dot" aria-hidden="true" />
          <div style={{ fontSize: 11, color: AMBER, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
            Waiting for an open line
          </div>
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
          You are in the queue
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(238,233,223,0.76)', lineHeight: 1.7, margin: '0 0 22px' }}>
          {lead}
        </p>
        {hasPosition && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: MUTED, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
              Position
            </span>
            <span
              style={{
                fontFamily: "'Consolas', 'Menlo', monospace",
                fontSize: 32,
                fontWeight: 700,
                color: GOLD,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {position}
            </span>
          </div>
        )}
        <div style={{ fontSize: 12, color: MUTED, fontStyle: 'italic', lineHeight: 1.55, margin: '0 0 22px' }}>
          Keep this page open. We check for an open line every few seconds and will start your call as soon as one is ready.
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'transparent',
            color: MUTED,
            border: `1px solid ${BORDER2}`,
            borderRadius: 2,
            padding: '11px 20px',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: VAULT_BODY,
          }}
        >
          Cancel and return to dashboard
        </button>
      </div>
      <style>{`
        .sim-q-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${AMBER};
          display: inline-block;
          flex-shrink: 0;
          animation: sim-q-pulse 1.4s ease-in-out infinite;
        }
        @keyframes sim-q-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
