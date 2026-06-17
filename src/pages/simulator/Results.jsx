/**
 * ATAC Platform - Results.jsx
 * Path: frontend/src/pages/simulator/Results.jsx
 *
 * Route: /simulator/results/:sessionId
 *
 * Polls GET /api/sim-live/status/:sessionId every 3 seconds until the
 * backend reports status='scored', then renders the scored results.
 *
 *   Polling states (per backend contract):
 *     'in_progress' | 'completed' | 'scoring'  -> show "Scoring..."
 *     'scored'                                 -> render dimension scores
 *     anything else                            -> still wait, but warn
 *
 *   Hard timeout: 5 minutes (100 polls). After that, show an error state
 *   with a link back to the dashboard.
 *
 * Result rendering branches on two signals from the backend:
 *   pass_fail (boolean): did the candidate pass the call?
 *   isPioneerFlow: did this session come from a credential_id-bearing
 *                  Pioneer attempt? Read from sessionStorage.
 *
 * Copy varies:
 *   new candidate + pass  -> "Credential issued: ATAC-C-..." with verify link
 *   Pioneer + pass        -> "Your credential ATAC-C-... is now simulator-verified"
 *   any flow + fail       -> "You did not pass. You can retake in 24 hours."
 *
 * Cleanup: when status='scored' is observed, clear
 * sessionStorage.atac_sim_session so a future /simulator visit starts a
 * fresh assign (or, for Pioneers, returns to the picker).
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API, { getSimulatorStatus } from '../../api/client';
import FeedbackPanel from '../../components/FeedbackPanel';

const BG    = '#080B12';
const BG1   = '#0C1018';
const GOLD  = '#C9A84C';
const TEAL2 = '#22A67E';
const RED   = '#C45C5C';
const AMBER = '#C48A2A';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_COUNT   = 100;  // 100 * 3s = 5 minutes

const DIMENSION_KEYS  = ['greeting', 'empathy', 'resolution', 'tone', 'close'];
const DIMENSION_LABEL = {
  greeting:   'Greeting',
  empathy:    'Empathy',
  resolution: 'Resolution',
  tone:       'Tone',
  close:      'Close',
};

export default function Results() {
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams();

  const [statusData, setStatusData] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [errorText, setErrorText] = useState('');

  const pollRef = useRef(null);

  // Pioneer flow is fixed for the lifetime of this screen, so read it once
  // from sessionStorage in a lazy state initializer rather than writing a
  // ref in an effect and reading ref.current during render (which trips
  // react-hooks). sessionStorage cleanup on 'scored' lives in the poll
  // effect below, not here.
  const [isPioneerFlow] = useState(() => {
    try {
      const raw = sessionStorage.getItem('atac_sim_session');
      if (raw) return !!JSON.parse(raw).credentialId;
    } catch (_) {
      // Tolerate; default to new-candidate copy.
    }
    return false;
  });

  // Poll until scored or timeout.
  useEffect(() => {
    let cancelled = false;
    let count = 0;

    const tick = async () => {
      if (cancelled) return;
      count += 1;
      setPollCount(count);
      try {
        const res = await getSimulatorStatus(routeSessionId);
        if (cancelled) return;
        setStatusData(res.data);
        setErrorText('');
        if (res.data && res.data.status === 'scored') {
          // Terminal state reached. Stop polling + clean up session.
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          try { sessionStorage.removeItem('atac_sim_session'); } catch (_) { /* ignore */ }
          return;
        }
      } catch (err) {
        if (cancelled) return;
        // Soft-fail individual polls; only surface error after a few in a row.
        // For v1 we simply note it and let the next tick try again.
        setErrorText(err?.response?.data?.error || err?.message || 'Could not load status');
      }
      if (count >= POLL_MAX_COUNT) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setTimedOut(true);
      }
    };

    // Fire one immediately, then interval.
    tick();
    pollRef.current = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [routeSessionId]);

  // Assessment id for the post-simulator FeedbackPanel. Sourced from
  // the candidate state resolver (auth-gated, owner-only, populated
  // across the two-step flow) so feedback still works when the
  // candidate returns later or signs in from a different device and
  // localStorage.atac_result is absent. localStorage stays as a
  // fallback only if the /me/state call fails or returns no id, so a
  // transient resolver error never eats the feedback when the local
  // blob happens to hold it. FeedbackPanel guards on !assessmentId
  // and silently hides when both sources are null (Pioneer
  // re-validation flows where neither has it).
  //
  // These hooks MUST stay above the early return below: declaring them
  // after it made the hook count jump (9 -> 12) on the polling -> scored
  // transition, throwing "Rendered more hooks than during the previous
  // render" straight into SimulatorErrorBoundary. The effect still no-ops
  // until status === 'scored', so behavior is unchanged.
  const [feedbackAssessmentId, setFeedbackAssessmentId] = useState(null);
  const feedbackFetchedRef = useRef(false);

  useEffect(() => {
    // Fire once when the simulator status first reaches scored.
    // Non-scored states (in_progress, scoring, etc.) skip entirely so
    // /me/state is not called during the scoring interim.
    if (statusData?.status !== 'scored') return undefined;
    if (feedbackFetchedRef.current) return undefined;
    feedbackFetchedRef.current = true;

    let cancelled = false;
    const localFallback = (() => {
      try {
        const stored = JSON.parse(localStorage.getItem('atac_result') || 'null');
        return stored?.assessmentId || null;
      } catch (_) { return null; }
    })();

    API.get('/api/candidate/me/state')
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || {};
        const id =
          data?.context?.latestAssessment?.id ||
          data?.context?.passedAwaitingSimAssessment?.id ||
          localFallback ||
          null;
        setFeedbackAssessmentId(id);
      })
      .catch(() => {
        if (cancelled) return;
        // Resolver call failed. Fall back to localStorage so a
        // transient error never loses feedback when atac_result
        // happens to hold the assessmentId.
        setFeedbackAssessmentId(localFallback);
      });

    return () => { cancelled = true; };
  }, [statusData?.status]);

  // ---------- Loading / interim ----------
  if (!statusData || statusData.status !== 'scored') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={kickerStyle}>ATAC Call Readiness Simulator</div>
          <h1 style={titleStyle}>Scoring your call...</h1>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, margin: '0 0 22px' }}>
            Our scoring system is reviewing the conversation across five dimensions: greeting, empathy, resolution, tone, and close. This usually takes under a minute.
          </p>

          <div
            aria-hidden="true"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: `2px solid rgba(201,168,76,0.18)`,
              borderTopColor: GOLD,
              margin: '0 auto 18px',
              animation: 'sim-spin 0.9s linear infinite',
            }}
          />

          {statusData && (
            <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center' }}>
              Status: {humanStatus(statusData.status)}
            </div>
          )}

          {timedOut && (
            <div
              role="alert"
              style={{
                marginTop: 22,
                padding: '12px 14px',
                background: 'rgba(196,92,92,0.08)',
                border: '1px solid rgba(196,92,92,0.32)',
                borderRadius: 3,
                color: RED,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              We are still waiting for your score after five minutes. You can return to your dashboard and check back later; your call has been recorded.
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  style={primaryBtn(false)}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}

          {errorText && !timedOut && (
            <div
              style={{
                marginTop: 16,
                fontSize: 12,
                color: RED,
                textAlign: 'center',
              }}
            >
              {errorText}. Retrying...
            </div>
          )}
        </div>
        <style>{`@keyframes sim-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ---------- Scored ----------
  // Backend /status shape (post 9e9f0f2): { score_overall, pass_fail,
  // pass_threshold, scoring_weights, scores_breakdown, credential_id }.
  // Older snake/camel fallbacks retained for safety.
  const passed        = statusData.pass_fail ?? false;
  const dimensions    = statusData.scores_breakdown || statusData.dimensions || statusData.scores || {};
  const overall       = statusData.score_overall ?? statusData.overall_score ?? statusData.overallScore ?? statusData.score ?? null;
  const feedbackMap   = statusData.feedback || statusData.dimension_feedback || {};
  const credentialId  = statusData.credential_id || statusData.credentialId || statusData.credential?.credential_id || null;
  const passThreshold = statusData.pass_threshold ?? 70;
  const weights       = statusData.scoring_weights ?? null;
  const isPioneer     = isPioneerFlow;
  const overallNum    = overall != null ? Math.round(overall) : null;
  const deltaPts      = overallNum != null ? Math.abs(overallNum - passThreshold) : null;

  // Passed celebration is a full-screen layout, distinct from the
  // standard scored render below. Early-return keeps the failed-state
  // rendering (and OutcomeBlock + DimensionRow sub-components) untouched.
  if (passed) {
    return (
      <PassedCelebration
        overallNum={overallNum}
        passThreshold={passThreshold}
        deltaPts={deltaPts}
        dimensions={dimensions}
        weights={weights}
        credentialId={credentialId}
        isPioneer={isPioneer}
        sessionId={routeSessionId}
        navigate={navigate}
        feedbackAssessmentId={feedbackAssessmentId}
      />
    );
  }

  // Lowest one or two scored dimensions, surfaced as concrete "areas to
  // improve". The /status payload exposes only numeric scores_breakdown (no
  // written per-dimension feedback candidate-side), so this is the closest
  // actionable signal we can show. Exposing the model's written feedback is
  // a small backend follow-up.
  const improveAreas = DIMENSION_KEYS
    .map((k) => ({ label: DIMENSION_LABEL[k], score: typeof dimensions[k] === 'number' ? dimensions[k] : null }))
    .filter((d) => d.score != null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  // "View my feedback" scrolls to the on-page breakdown; there is no
  // separate feedback route.
  const scrollToBreakdown = () => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('sim-breakdown');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Reached only when the attempt did NOT pass (passed returns the
  // celebration above). Deliberately a calm "scored, did not pass" screen:
  // gold eyebrow, amber score, encouraging copy, and a path back through the
  // feedback. Never the red error treatment.
  return (
    <div style={containerStyle}>
      <div style={{ ...cardStyle, maxWidth: 640 }}>
        <div style={kickerStyle}>Assessment Scored</div>

        <h1 style={titleStyle}>
          You did not pass this time, but you were close
        </h1>

        {/* Overall score circle - amber (close, not an error). */}
        <div
          style={{
            width: 130,
            height: 130,
            borderRadius: '50%',
            border: `2px solid ${AMBER}`,
            margin: '14px auto 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(196,138,42,0.06)',
          }}
        >
          <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 48, color: AMBER, fontWeight: 600, lineHeight: 1 }}>
            {overallNum != null ? overallNum : '--'}
          </div>
          <div style={{ fontFamily: VAULT_BODY, fontSize: 14, color: MUTED, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
            / {passThreshold}
          </div>
        </div>

        {/* Approved body copy: actual score out of 100, with 70 to pass. */}
        <p style={{ textAlign: 'center', marginBottom: 24, fontFamily: VAULT_BODY, fontSize: 14, color: 'rgba(238,233,223,0.82)', lineHeight: 1.65 }}>
          {overallNum != null
            ? `We recorded your call and scored it: ${overallNum} out of 100, with ${passThreshold} to pass. That is a strong, fixable gap. Look over your feedback below, and you can run the simulator again once your short cooldown ends.`
            : `We recorded your call and your score is being finalized. Look over your feedback below, and you can run the simulator again once your short cooldown ends.`}
        </p>

        {/* Areas to improve: the lowest one or two dimensions. */}
        {improveAreas.length > 0 && (
          <div
            style={{
              background: 'rgba(196,138,42,0.06)',
              border: '1px solid rgba(196,138,42,0.28)',
              borderRadius: 3,
              padding: '14px 16px',
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 10, color: AMBER, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
              Areas to improve
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {improveAreas.map((d) => (
                <span
                  key={d.label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: 6,
                    fontSize: 13,
                    color: WHITE,
                    fontFamily: VAULT_BODY,
                    background: 'rgba(238,233,223,0.05)',
                    border: `1px solid ${BORDER2}`,
                    borderRadius: 3,
                    padding: '6px 12px',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{d.label}</span>
                  <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{Math.round(d.score)}</span>
                </span>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
              Focus here next time. Your full breakdown is below.
            </div>
          </div>
        )}

        {/* Dimension breakdown (the "feedback below"; the scroll target). */}
        <div id="sim-breakdown" style={{ marginBottom: 28, scrollMarginTop: 24 }}>
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14 }}>
            Performance Breakdown
          </div>
          {DIMENSION_KEYS.map((k) => {
            const score  = dimensions[k] ?? null;
            const fb     = feedbackMap[k] || '';
            const weight = weights && typeof weights[k] === 'number' ? Math.round(weights[k] * 100) : null;
            return (
              <DimensionRow key={k} label={DIMENSION_LABEL[k]} score={score} feedback={fb} weight={weight} />
            );
          })}
        </div>

        {/* Pioneer fail keeps the "credential unaffected" reassurance. For
            new candidates the body above already states the retake path, so
            the structured note is omitted to avoid repeating (and hardening)
            the cooldown message. */}
        {isPioneer && (
          <OutcomeBlock
            passed={passed}
            isPioneer={isPioneer}
            credentialId={credentialId}
          />
        )}

        {/* Post-simulator assessment feedback (gated by FeedbackPanel's
            own assessmentId guard). */}
        <FeedbackPanel assessmentId={feedbackAssessmentId} source="pioneer" />

        {/* Actions: primary scrolls to the on-page breakdown, secondary
            returns to the dashboard. */}
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={scrollToBreakdown}
            style={primaryBtn(false)}
          >
            View My Feedback
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={outlinedBtn(false)}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function DimensionRow({ label, score, feedback, weight }) {
  const pct = typeof score === 'number'
    ? Math.max(0, Math.min(100, score))
    : 0;
  const has = score != null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ width: 110, flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 12, color: WHITE, fontWeight: 600 }}>{label}</span>
          {typeof weight === 'number' && (
            <span style={{ fontSize: 10, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
              {weight}%
            </span>
          )}
        </div>
        <div style={{ flex: 1, height: 4, background: BORDER2, borderRadius: 2 }}>
          <div
            style={{
              height: 4,
              width: `${pct}%`,
              background: pct >= 70 ? TEAL2 : pct >= 50 ? GOLD : RED,
              borderRadius: 2,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: WHITE, width: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {has ? `${Math.round(score)}` : '--'}
        </div>
      </div>
      {feedback && (
        <div
          style={{
            fontSize: 12,
            color: MUTED,
            lineHeight: 1.6,
            marginLeft: 120,
            marginRight: 48,
          }}
        >
          {feedback}
        </div>
      )}
    </div>
  );
}

function OutcomeBlock({ passed, isPioneer, credentialId }) {
  if (passed && !isPioneer) {
    return (
      <div
        style={{
          padding: '14px 16px',
          background: 'rgba(34,166,126,0.06)',
          border: `1px solid rgba(34,166,126,0.28)`,
          borderRadius: 3,
        }}
      >
        <div style={{ fontSize: 11, color: TEAL2, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
          Credential Issued
        </div>
        <div style={{ fontSize: 14, color: WHITE, lineHeight: 1.6 }}>
          {credentialId
            ? <>Congratulations. Your blockchain-verified credential <code style={{ color: GOLD, fontFamily: 'Consolas, Menlo, monospace', fontSize: 13 }}>{credentialId}</code> has been issued.</>
            : 'Congratulations. Your blockchain-verified credential has been issued.'}
        </div>
      </div>
    );
  }
  if (passed && isPioneer) {
    return (
      <div
        style={{
          padding: '14px 16px',
          background: 'rgba(201,168,76,0.06)',
          border: `1px solid ${BORDER}`,
          borderRadius: 3,
        }}
      >
        <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
          Simulator Verified
        </div>
        <div style={{ fontSize: 14, color: WHITE, lineHeight: 1.6 }}>
          {credentialId
            ? <>Congratulations. Your credential <code style={{ color: GOLD, fontFamily: 'Consolas, Menlo, monospace', fontSize: 13 }}>{credentialId}</code> is now simulator-verified.</>
            : 'Congratulations. Your credential is now simulator-verified.'}
        </div>
      </div>
    );
  }
  // Fail (either flow)
  if (isPioneer) {
    return (
      <div
        style={{
          padding: '14px 16px',
          background: 'rgba(196,92,92,0.06)',
          border: '1px solid rgba(196,92,92,0.22)',
          borderRadius: 3,
          fontSize: 13,
          color: WHITE,
          lineHeight: 1.6,
        }}
      >
        Your credential is unaffected. You can take the simulator again in 24 hours.
      </div>
    );
  }
  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'rgba(196,92,92,0.06)',
        border: '1px solid rgba(196,92,92,0.22)',
        borderRadius: 3,
        fontSize: 13,
        color: WHITE,
        lineHeight: 1.6,
      }}
    >
      You did not pass this attempt. You can retake the simulator in 24 hours.
    </div>
  );
}

function humanStatus(s) {
  if (s === 'in_progress') return 'Call in progress';
  if (s === 'completed')   return 'Call completed';
  if (s === 'scoring')     return 'Scoring';
  return s || 'Pending';
}

function pluralize(count, word) {
  return count === 1 ? word : `${word}s`;
}

// ---------- Shared styles ----------
const containerStyle = {
  minHeight: '100vh',
  background: BG,
  color: WHITE,
  fontFamily: VAULT_BODY,
  padding: '48px 24px 60px',
};

const cardStyle = {
  maxWidth: 540,
  margin: '0 auto',
  background: BG1,
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  padding: '32px 34px',
};

const kickerStyle = {
  fontSize: 11,
  color: GOLD,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  marginBottom: 12,
};

const titleStyle = {
  fontFamily: VAULT_DISPLAY,
  fontSize: 32,
  fontWeight: 400,
  color: WHITE,
  margin: '0 0 14px',
  lineHeight: 1.15,
  textAlign: 'center',
};

function primaryBtn(disabled) {
  return {
    width: '100%',
    background: disabled ? 'rgba(201,168,76,0.4)' : GOLD,
    color: BG,
    border: 'none',
    borderRadius: 2,
    padding: '12px 18px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: VAULT_BODY,
  };
}

function outlinedBtn(disabled) {
  return {
    width: '100%',
    background: 'transparent',
    color: WHITE,
    border: `1px solid ${BORDER2}`,
    borderRadius: 2,
    padding: '11px 18px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: VAULT_BODY,
  };
}

/* ============================================================
 * Passed-state celebration (full-screen layout)
 * ============================================================
 * Used only when pass_fail === true. Failed-state UI above is
 * unchanged. Sections (top to bottom):
 *   1. Hero: eyebrow, "You passed.", 280px score circle, pass pill,
 *      threshold-delta sentence
 *   2. Performance breakdown: 5 horizontal score bars
 *   3. Credential card: ID with copy button, verify link
 *   4. LinkedIn share: primary "Add to Profile" CTA + secondary share
 *      + copy-verify-link actions
 *   5. What's Next: 3-card grid
 *   6. Return to Dashboard
 *
 * Confetti renders once per session (sessionStorage flag prevents
 * re-trigger on refresh). Pure CSS keyframes; no canvas-confetti dep.
 */

const WHAT_NEXT = [
  {
    title: 'Your credential is permanent',
    body: 'Your CRSA is recorded on the blockchain and verifiable forever. No expiry, no renewal fees.',
  },
  {
    title: 'Add to your profile',
    body: 'Update your LinkedIn, resume, and email signature with your new credential.',
  },
  {
    title: 'We will email you',
    body: 'Your verification link is being emailed to you now. Save it for employer reference.',
  },
];

function PassedCelebration({
  overallNum,
  passThreshold,
  deltaPts,
  dimensions,
  weights,
  credentialId: initialCredentialId,
  isPioneer,
  sessionId,
  navigate,
  feedbackAssessmentId,
}) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Mint-resolution state. Seeded from the prop (truthy for the Pioneer
  // flow where simulator_sessions.credential_id carries it through the
  // /sim-live/status response). For new-candidate flow the prop is null
  // and the latest-credential poll below resolves it. verifyUrl is read
  // off the API response only -- never constructed client-side -- so the
  // public verify URL is single-source-of-truth from the backend.
  const [resolved, setResolved] = useState(() =>
    initialCredentialId
      ? { credentialId: initialCredentialId, verifyUrl: `https://app.atacglobalcx.com/verify/${initialCredentialId}` }
      : { credentialId: null, verifyUrl: null }
  );
  const [mintTimedOut, setMintTimedOut] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Poll GET /api/credentials/candidate/:candidateId/latest every 3s
  // until { status: 'minted' } returns, or 90s elapses. Skips entirely
  // when the credential id is already known (Pioneer seed or earlier
  // resolve). On timeout, sets mintTimedOut so the UI swaps to the
  // graceful fallback. Refresh button bumps refreshNonce to re-arm.
  useEffect(() => {
    if (resolved.credentialId) return undefined;

    let candidateId = null;
    try {
      const cand = JSON.parse(localStorage.getItem('atac_candidate') || '{}');
      candidateId = cand?.id || null;
    } catch (_) { /* malformed identity payload; cannot poll */ }
    if (!candidateId) return undefined;

    let cancelled = false;
    let intervalId = null;
    const startedAt = Date.now();
    const TIMEOUT_MS = 90_000;
    const INTERVAL_MS = 3_000;

    const stop = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await API.get(`/api/credentials/candidate/${candidateId}/latest`);
        if (cancelled) return;
        const data = res?.data || {};
        if (data.status === 'minted' && data.credentialId) {
          // Resolved. Use API verifyUrl as the single source of truth.
          setResolved({
            credentialId: data.credentialId,
            verifyUrl:    data.verifyUrl || null,
          });
          stop();
          return;
        }
      } catch (_) {
        // Soft-fail individual polls; next tick will retry. The 90s
        // budget below is the only exit on persistent failure.
      }
      if (Date.now() - startedAt >= TIMEOUT_MS) {
        setMintTimedOut(true);
        stop();
      }
    };

    tick();
    intervalId = setInterval(tick, INTERVAL_MS);

    return () => {
      cancelled = true;
      stop();
    };
  }, [resolved.credentialId, refreshNonce]);

  const handleRefresh = () => {
    setMintTimedOut(false);
    setRefreshNonce((n) => n + 1);
  };

  // Effective values for the rest of the render. credentialId / verifyUrl
  // names are preserved so the existing share-action code below picks up
  // the resolved data unchanged once the poll lands.
  const credentialId = resolved.credentialId;
  const verifyUrl = resolved.verifyUrl || '';
  const linkedInProfileUrl = credentialId ? buildLinkedInAddUrl(credentialId, verifyUrl) : '#';
  const linkedInShareUrl = verifyUrl
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`
    : 'https://www.linkedin.com/feed/?shareActive=true';

  const handleCopy = async (text, setFlag) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 2000);
    } catch (_) {
      // Clipboard API can fail on insecure contexts or denied permission;
      // we silently no-op rather than alarm the candidate on their win.
    }
  };

  return (
    <div className="sim-passed-page">
      <Confetti sessionId={sessionId} />

      <div className="sim-passed-shell">

        {/* === Section 1: Hero === */}
        <section className="sim-passed-hero">
          <div className="sim-passed-eyebrow">
            {isPioneer ? 'Credential Verified' : 'Credential Earned'}
          </div>
          <h1 className="sim-passed-headline">You passed.</h1>

          <div
            className="sim-passed-circle"
            aria-label={`Score ${overallNum != null ? overallNum : 'unknown'} out of ${passThreshold}`}
          >
            <div className="sim-passed-circle-number">
              {overallNum != null ? overallNum : '--'}
            </div>
            <div className="sim-passed-circle-denominator">/ {passThreshold}</div>
          </div>

          <div className="sim-passed-pill">
            Passed · {overallNum != null ? overallNum : '--'} / {passThreshold}
          </div>

          {overallNum != null && (
            <p className="sim-passed-delta">
              You scored {deltaPts} {pluralize(deltaPts, 'point')} above the threshold.
            </p>
          )}
        </section>

        {/* === Section 2: Performance breakdown === */}
        <section className="sim-passed-section">
          <div className="sim-passed-section-label">Performance Breakdown</div>
          <div className="sim-passed-card sim-passed-card-gold">
            {DIMENSION_KEYS.map((k) => {
              const score = dimensions[k] ?? null;
              const weight = weights && typeof weights[k] === 'number'
                ? Math.round(weights[k] * 100)
                : null;
              return (
                <CelebrationDimensionRow
                  key={k}
                  label={DIMENSION_LABEL[k]}
                  score={score}
                  weight={weight}
                />
              );
            })}
          </div>
        </section>

        {/* === Section 3: Credential card === */}
        <section className="sim-passed-section">
          <div className="sim-passed-section-label sim-passed-section-label-teal">Your Credential</div>
          <div className="sim-passed-card sim-passed-card-teal">
            <h2 className="sim-passed-credential-headline">
              Your blockchain-verified CRSA credential is being minted.
            </h2>
            <div className="sim-passed-credential-row">
              <div className="sim-passed-credential-id-block">
                <div className="sim-passed-field-label">Credential ID</div>
                {credentialId ? (
                  <div className="sim-passed-credential-id">
                    {credentialId}
                  </div>
                ) : mintTimedOut ? (
                  <div className="sim-passed-credential-id-fallback">
                    Your credential is being finalized. We have emailed your verification link to you, and it will also appear on your dashboard shortly.
                    <button
                      type="button"
                      className="sim-passed-refresh-btn"
                      onClick={handleRefresh}
                    >
                      Refresh
                    </button>
                  </div>
                ) : (
                  <div className="sim-passed-credential-id sim-passed-credential-id-pending">
                    Generating...
                  </div>
                )}
              </div>
              {credentialId && (
                <button
                  type="button"
                  className="sim-passed-copy-btn"
                  onClick={() => handleCopy(credentialId, setCopiedId)}
                  aria-label="Copy credential ID"
                >
                  <CopyIcon />
                  <span>{copiedId ? '✓ Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
            <div className="sim-passed-verify-row">
              <div className="sim-passed-field-label">Verify At</div>
              {credentialId ? (
                <a
                  href={verifyUrl}
                  target="_blank"
                  rel="noopener"
                  className="sim-passed-verify-link"
                >
                  {verifyUrl.replace(/^https?:\/\//, '')}
                </a>
              ) : mintTimedOut ? (
                <div className="sim-passed-verify-pending">
                  Your dashboard will show the link as soon as the mint completes.
                </div>
              ) : (
                <div className="sim-passed-verify-pending">
                  Will appear here once your credential is minted.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* === Section 4: LinkedIn share === */}
        <section className="sim-passed-section">
          <div className="sim-passed-section-label">Share Your Achievement</div>
          <div className="sim-passed-card sim-passed-card-share">
            <h2 className="sim-passed-share-headline">Tell your network.</h2>
            <p className="sim-passed-share-subtext">
              Earning the CRSA is worth celebrating. Add it to your LinkedIn profile and share with your network.
            </p>
            <a
              href={linkedInProfileUrl}
              target="_blank"
              rel="noopener"
              className="sim-passed-linkedin-cta"
              aria-disabled={!credentialId}
              onClick={(e) => { if (!credentialId) e.preventDefault(); }}
            >
              <LinkedInIcon />
              <span>Add to LinkedIn Profile</span>
            </a>
            <div className="sim-passed-share-secondary">
              <a
                href={linkedInShareUrl}
                target="_blank"
                rel="noopener"
                className="sim-passed-share-link"
              >
                Share on LinkedIn
              </a>
              <button
                type="button"
                className="sim-passed-share-link sim-passed-share-link-btn"
                onClick={() => handleCopy(verifyUrl, setCopiedLink)}
                disabled={!credentialId}
              >
                {copiedLink ? '✓ Verification link copied' : 'Copy verification link'}
              </button>
            </div>
          </div>
        </section>

        {/* === Section 5: What's Next === */}
        <section className="sim-passed-section">
          <div className="sim-passed-section-label sim-passed-section-label-teal">What&apos;s Next</div>
          <div className="sim-passed-whatsnext-grid">
            {WHAT_NEXT.map((item) => (
              <div key={item.title} className="sim-passed-whatsnext-card">
                <div className="sim-passed-whatsnext-title">{item.title}</div>
                <div className="sim-passed-whatsnext-body">{item.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Post-simulator assessment feedback. Same component instance
            that used to live on the Part 1 results page; moved here so
            it collects feedback only after the candidate has gone
            through the full first-time flow. FeedbackPanel guards on
            !assessmentId and silently hides for Pioneer re-validation
            paths where atac_result is stale or absent. */}
        <section className="sim-passed-section">
          <FeedbackPanel assessmentId={feedbackAssessmentId} source="pioneer" />
        </section>

        {/* === Section 6: Return to Dashboard === */}
        <div className="sim-passed-footer">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="sim-passed-return-link"
          >
            Return to Dashboard
          </button>
          <p className="sim-passed-footer-note">
            You can always come back to retake the simulator or update your credential information.
          </p>
        </div>

      </div>

      <style>{`
        /* === Page shell ============================================== */
        .sim-passed-page {
          min-height: 100vh;
          background: ${BG};
          color: ${WHITE};
          font-family: ${VAULT_BODY};
          padding: 48px 24px 80px;
          position: relative;
          overflow-x: hidden;
        }
        .sim-passed-shell {
          max-width: 1100px;
          margin: 0 auto;
        }

        /* === Section 1: Hero ========================================= */
        .sim-passed-hero {
          text-align: center;
          padding: 24px 0 56px;
        }
        .sim-passed-eyebrow {
          font-size: 12px;
          color: ${TEAL2};
          letter-spacing: 0.22em;
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 24px;
          font-family: ${VAULT_BODY};
        }
        .sim-passed-headline {
          font-family: ${VAULT_DISPLAY};
          font-size: 48px;
          font-weight: 400;
          color: ${GOLD};
          margin: 0 0 36px;
          line-height: 1;
          letter-spacing: -0.01em;
        }
        @media (min-width: 768px) {
          .sim-passed-headline { font-size: 64px; margin-bottom: 44px; }
        }
        @media (min-width: 1024px) {
          .sim-passed-headline { font-size: 96px; margin-bottom: 52px; }
        }
        .sim-passed-circle {
          width: 180px;
          height: 180px;
          border-radius: 50%;
          border: 2px solid ${TEAL2};
          background: rgba(34,166,126,0.06);
          box-shadow: 0 0 60px rgba(34,166,126,0.2);
          margin: 0 auto 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        @media (min-width: 768px) {
          .sim-passed-circle { width: 220px; height: 220px; }
        }
        @media (min-width: 1024px) {
          .sim-passed-circle { width: 280px; height: 280px; }
        }
        .sim-passed-circle-number {
          font-family: ${VAULT_DISPLAY};
          font-size: 64px;
          color: ${TEAL2};
          font-weight: 600;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        @media (min-width: 768px) {
          .sim-passed-circle-number { font-size: 72px; }
        }
        @media (min-width: 1024px) {
          .sim-passed-circle-number { font-size: 96px; }
        }
        .sim-passed-circle-denominator {
          font-family: ${VAULT_BODY};
          font-size: 16px;
          color: ${MUTED};
          margin-top: 8px;
          font-variant-numeric: tabular-nums;
        }
        @media (min-width: 1024px) {
          .sim-passed-circle-denominator { font-size: 18px; }
        }
        .sim-passed-pill {
          display: inline-block;
          padding: 8px 20px;
          border-radius: 20px;
          background: rgba(34,166,126,0.15);
          border: 1px solid ${TEAL2};
          color: ${TEAL2};
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-family: ${VAULT_BODY};
          margin-bottom: 18px;
          font-variant-numeric: tabular-nums;
        }
        @media (min-width: 1024px) {
          .sim-passed-pill { font-size: 12px; padding: 9px 22px; }
        }
        .sim-passed-delta {
          margin: 0;
          font-size: 16px;
          color: ${WHITE};
          line-height: 1.5;
          font-family: ${VAULT_BODY};
        }
        @media (min-width: 1024px) {
          .sim-passed-delta { font-size: 18px; }
        }

        /* === Sections (shared) ======================================= */
        .sim-passed-section {
          margin-bottom: 36px;
        }
        @media (min-width: 1024px) {
          .sim-passed-section { margin-bottom: 48px; }
        }
        .sim-passed-section-label {
          font-size: 12px;
          color: ${GOLD};
          letter-spacing: 0.22em;
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 16px;
          font-family: ${VAULT_BODY};
        }
        .sim-passed-section-label-teal {
          color: ${TEAL2};
        }
        .sim-passed-card {
          background: ${BG1};
          border-radius: 12px;
          padding: 24px;
        }
        @media (min-width: 1024px) {
          .sim-passed-card { padding: 32px; }
        }
        .sim-passed-card-gold {
          border: 1px solid rgba(201,168,76,0.2);
        }
        .sim-passed-card-teal {
          background: rgba(26,143,105,0.06);
          border: 1px solid rgba(26,143,105,0.3);
        }
        .sim-passed-card-share {
          border: 1px solid rgba(201,168,76,0.2);
          text-align: center;
        }

        /* === Section 2: Dimension rows (celebration size) ============ */
        .sim-passed-dim-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          padding: 12px 0;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .sim-passed-dim-row:first-child {
          border-top: none;
          padding-top: 4px;
        }
        @media (min-width: 768px) {
          .sim-passed-dim-row {
            grid-template-columns: 160px 1fr 80px;
            gap: 18px;
            align-items: center;
            padding: 16px 0;
          }
        }
        .sim-passed-dim-label {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-family: ${VAULT_BODY};
          font-size: 16px;
          color: ${WHITE};
          font-weight: 600;
        }
        .sim-passed-dim-weight {
          font-size: 12px;
          color: ${MUTED};
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }
        .sim-passed-dim-bar-track {
          height: 12px;
          background: rgba(238,233,223,0.06);
          border-radius: 6px;
          overflow: hidden;
        }
        .sim-passed-dim-bar-fill {
          height: 100%;
          background: ${TEAL2};
          border-radius: 6px;
          transition: width 0.6s ease;
        }
        .sim-passed-dim-score {
          font-family: ${VAULT_DISPLAY};
          font-size: 28px;
          color: ${TEAL2};
          font-weight: 600;
          line-height: 1;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        @media (min-width: 1024px) {
          .sim-passed-dim-score { font-size: 32px; }
        }

        /* === Section 3: Credential card ============================== */
        .sim-passed-credential-headline {
          font-family: ${VAULT_DISPLAY};
          font-style: italic;
          font-size: 22px;
          color: ${WHITE};
          margin: 0 0 22px;
          line-height: 1.3;
          font-weight: 400;
        }
        @media (min-width: 1024px) {
          .sim-passed-credential-headline { font-size: 28px; margin-bottom: 26px; }
        }
        .sim-passed-credential-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 22px;
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .sim-passed-credential-id-block {
          flex: 1;
          min-width: 220px;
        }
        .sim-passed-field-label {
          font-size: 11px;
          color: ${MUTED};
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 6px;
          font-family: ${VAULT_BODY};
        }
        .sim-passed-credential-id {
          font-family: 'Courier New', Consolas, Menlo, monospace;
          font-size: 20px;
          color: ${GOLD};
          font-weight: 700;
          letter-spacing: 0.02em;
          word-break: break-all;
        }
        @media (min-width: 1024px) {
          .sim-passed-credential-id { font-size: 24px; }
        }
        .sim-passed-copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid ${BORDER};
          border-radius: 4px;
          color: ${GOLD};
          padding: 9px 14px;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 700;
          cursor: pointer;
          font-family: ${VAULT_BODY};
          transition: background 0.15s, border-color 0.15s;
        }
        .sim-passed-copy-btn:hover {
          background: rgba(201,168,76,0.08);
        }
        .sim-passed-verify-link {
          font-family: ${VAULT_BODY};
          font-size: 14px;
          color: ${WHITE};
          text-decoration: underline;
          word-break: break-all;
          transition: color 0.15s;
        }
        .sim-passed-verify-link:hover {
          color: ${GOLD};
        }
        .sim-passed-verify-pending {
          font-family: ${VAULT_BODY};
          font-size: 13px;
          color: ${MUTED};
          font-style: italic;
        }
        /* Mint poll: subtle opacity pulse while waiting for the
           credential ID to resolve. Stops once the ID lands or the
           90s budget is exhausted. */
        .sim-passed-credential-id-pending {
          animation: sim-mint-pulse 1.6s ease-in-out infinite;
        }
        @keyframes sim-mint-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
        .sim-passed-credential-id-fallback {
          font-family: ${VAULT_BODY};
          font-size: 14px;
          color: ${WHITE};
          line-height: 1.6;
          max-width: 640px;
        }
        .sim-passed-refresh-btn {
          display: inline-block;
          margin-top: 12px;
          background: transparent;
          border: 1px solid ${BORDER};
          border-radius: 4px;
          color: ${GOLD};
          padding: 7px 14px;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 700;
          cursor: pointer;
          font-family: ${VAULT_BODY};
          transition: background 0.15s, border-color 0.15s;
        }
        .sim-passed-refresh-btn:hover {
          background: rgba(201,168,76,0.08);
        }

        /* === Section 4: LinkedIn share =============================== */
        .sim-passed-share-headline {
          font-family: ${VAULT_DISPLAY};
          font-size: 24px;
          color: ${WHITE};
          margin: 0 0 12px;
          line-height: 1.15;
          font-weight: 400;
        }
        @media (min-width: 1024px) {
          .sim-passed-share-headline { font-size: 32px; }
        }
        .sim-passed-share-subtext {
          font-family: ${VAULT_BODY};
          font-size: 16px;
          color: ${MUTED};
          line-height: 1.55;
          max-width: 540px;
          margin: 0 auto 26px;
        }
        .sim-passed-linkedin-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          max-width: 400px;
          margin: 0 auto;
          background: ${GOLD};
          color: ${BG};
          border-radius: 4px;
          padding: 18px 24px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          text-decoration: none;
          font-family: ${VAULT_BODY};
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        @media (min-width: 1024px) {
          .sim-passed-linkedin-cta { font-size: 15px; padding: 18px 28px; }
        }
        .sim-passed-linkedin-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(201,168,76,0.25);
        }
        .sim-passed-linkedin-cta[aria-disabled="true"] {
          opacity: 0.55;
          cursor: not-allowed;
          pointer-events: auto;
        }
        .sim-passed-share-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-top: 22px;
          flex-wrap: wrap;
        }
        .sim-passed-share-link {
          background: transparent;
          border: none;
          color: ${WHITE};
          font-size: 13px;
          font-family: ${VAULT_BODY};
          cursor: pointer;
          padding: 6px 4px;
          text-decoration: underline;
          transition: color 0.15s;
        }
        .sim-passed-share-link:hover {
          color: ${GOLD};
        }
        .sim-passed-share-link:disabled {
          color: ${MUTED};
          cursor: not-allowed;
        }
        .sim-passed-share-link-btn {
          font: inherit;
          font-family: ${VAULT_BODY};
        }

        /* === Section 5: What's Next ================================== */
        .sim-passed-whatsnext-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 768px) {
          .sim-passed-whatsnext-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .sim-passed-whatsnext-card {
          background: ${BG1};
          border: 1px solid ${MUTED};
          border-radius: 12px;
          padding: 24px;
        }
        .sim-passed-whatsnext-title {
          font-family: ${VAULT_BODY};
          font-size: 15px;
          color: ${WHITE};
          font-weight: 700;
          margin-bottom: 10px;
        }
        .sim-passed-whatsnext-body {
          font-family: ${VAULT_BODY};
          font-size: 14px;
          color: ${WHITE};
          line-height: 1.5;
          opacity: 0.82;
        }

        /* === Section 6: Footer ======================================= */
        .sim-passed-footer {
          text-align: center;
          margin-top: 12px;
        }
        .sim-passed-return-link {
          background: transparent;
          border: none;
          color: ${GOLD};
          font-size: 14px;
          font-family: ${VAULT_BODY};
          cursor: pointer;
          padding: 8px 0;
          text-decoration: none;
        }
        .sim-passed-return-link:hover {
          text-decoration: underline;
        }
        .sim-passed-footer-note {
          margin: 8px 0 0;
          font-size: 12px;
          color: ${MUTED};
          font-style: italic;
          font-family: ${VAULT_BODY};
          line-height: 1.5;
        }

        /* === Confetti (CSS only, no canvas-confetti dep) ============= */
        .sim-confetti-container {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          overflow: hidden;
        }
        .sim-confetti-particle {
          position: absolute;
          top: -24px;
          width: 8px;
          height: 12px;
          border-radius: 2px;
          opacity: 0;
          animation: sim-confetti-fall 3s ease-in forwards;
          will-change: transform, opacity;
        }
        @keyframes sim-confetti-fall {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
          10% { opacity: 1; }
          88% { opacity: 1; }
          100% {
            opacity: 0;
            transform: translate3d(var(--sim-drift, 0px), 110vh, 0) rotate(720deg);
          }
        }
      `}</style>
    </div>
  );
}

function CelebrationDimensionRow({ label, score, weight }) {
  const has = typeof score === 'number';
  const pct = has ? Math.max(0, Math.min(100, score)) : 0;
  return (
    <div className="sim-passed-dim-row">
      <div className="sim-passed-dim-label">
        <span>{label}</span>
        {typeof weight === 'number' && (
          <span className="sim-passed-dim-weight">{weight}%</span>
        )}
      </div>
      <div className="sim-passed-dim-bar-track">
        <div
          className="sim-passed-dim-bar-fill"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="sim-passed-dim-score">
        {has ? Math.round(score) : '--'}
      </div>
    </div>
  );
}

function Confetti({ sessionId }) {
  // Show once per session. sessionStorage flag keyed by sessionId so a
  // page refresh on the same scored screen does not re-trigger.
  const storageKey = sessionId ? `atac_sim_confetti_shown_${sessionId}` : null;
  const [show, setShow] = useState(() => {
    if (!storageKey) return false;
    try {
      return sessionStorage.getItem(storageKey) === null;
    } catch (_) {
      return false;
    }
  });

  useEffect(() => {
    if (!show) return;
    if (storageKey) {
      try { sessionStorage.setItem(storageKey, '1'); } catch (_) { /* ignore */ }
    }
    const t = setTimeout(() => setShow(false), 3500);
    return () => clearTimeout(t);
  }, [show, storageKey]);

  if (!show) return null;

  const particles = [];
  const TOTAL = 36;
  for (let i = 0; i < TOTAL; i++) {
    const color = i % 2 === 0 ? GOLD : TEAL2;
    const left = (i * (100 / TOTAL)) + (((i * 17) % 7) - 3);
    const delayMs = (i * 90) % 1600;
    const drift = -30 + (i * 13) % 60;
    particles.push(
      <span
        key={i}
        className="sim-confetti-particle"
        style={{
          left: `${left}%`,
          background: color,
          animationDelay: `${delayMs}ms`,
          '--sim-drift': `${drift}px`,
        }}
      />
    );
  }

  return (
    <div className="sim-confetti-container" aria-hidden="true">
      {particles}
    </div>
  );
}

function LinkedInIcon() {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// LinkedIn "Add to profile" deep-link URL builder.
// LinkedIn's documented profile-add API accepts startTask + a defined
// set of certification metadata. Issue date defaults to "now" since
// the candidate is viewing this screen immediately after passing.
function buildLinkedInAddUrl(credentialId, verifyUrl) {
  const now = new Date();
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: 'Certified Remote Service Agent (CRSA)',
    organizationName: 'ATAC Global CX',
    issueYear: String(now.getFullYear()),
    issueMonth: String(now.getMonth() + 1),
    certUrl: verifyUrl || '',
    certId: credentialId || '',
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}
