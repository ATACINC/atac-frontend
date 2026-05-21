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
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSimulatorStatus } from '../../api/client';

const BG    = '#080B12';
const BG1   = '#0C1018';
const GOLD  = '#C9A84C';
const TEAL2 = '#22A67E';
const RED   = '#C45C5C';
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
  const isPioneerFlowRef = useRef(false);
  const sessionCreatedAtRef = useRef(null);

  // Detect Pioneer flow + clean up sessionStorage once scored.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('atac_sim_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        isPioneerFlowRef.current = !!parsed.credentialId;
        sessionCreatedAtRef.current = parsed.createdAt || null;
      }
    } catch (_) {
      // Tolerate; default to new-candidate copy.
    }
  }, []);

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
  const isPioneer     = isPioneerFlowRef.current;
  const overallNum    = overall != null ? Math.round(overall) : null;
  const deltaPts      = overallNum != null ? Math.abs(overallNum - passThreshold) : null;

  return (
    <div style={containerStyle}>
      <div style={{ ...cardStyle, maxWidth: 640 }}>
        <div style={kickerStyle}>Post-Call Report</div>

        <h1 style={titleStyle}>
          {passed ? 'You passed.' : 'Not this time.'}
        </h1>

        {/* Overall score circle - shows number prominently with / threshold below. */}
        <div
          style={{
            width: 130,
            height: 130,
            borderRadius: '50%',
            border: `2px solid ${passed ? TEAL2 : RED}`,
            margin: '14px auto 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: passed ? 'rgba(34,166,126,0.06)' : 'rgba(196,92,92,0.06)',
          }}
        >
          <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 48, color: passed ? TEAL2 : RED, fontWeight: 600, lineHeight: 1 }}>
            {overallNum != null ? overallNum : '--'}
          </div>
          <div style={{ fontFamily: VAULT_BODY, fontSize: 14, color: MUTED, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
            / {passThreshold}
          </div>
        </div>

        {/* Pass / fail pill - includes the numeric score alongside the verdict. */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: 999,
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              background: overallNum == null
                ? 'rgba(238,233,223,0.05)'
                : passed ? 'rgba(34,166,126,0.08)' : 'rgba(196,92,92,0.08)',
              border: `1px solid ${overallNum == null ? MUTED : passed ? TEAL2 : RED}`,
              color: overallNum == null ? MUTED : passed ? TEAL2 : RED,
              fontWeight: 700,
            }}
          >
            {overallNum == null
              ? 'Score Unavailable'
              : passed
                ? `Passed · ${overallNum} / ${passThreshold}`
                : `Not Passed · ${overallNum} / ${passThreshold}`}
          </span>
        </div>

        {/* Threshold-delta descriptor - hidden when score is unavailable. */}
        {overallNum != null && (
          <div style={{ textAlign: 'center', marginBottom: 28, fontFamily: VAULT_BODY, fontSize: 13, color: WHITE, lineHeight: 1.5 }}>
            {passed
              ? `You scored ${deltaPts} ${pluralize(deltaPts, 'point')} above the threshold.`
              : `You were ${deltaPts} ${pluralize(deltaPts, 'point')} short of passing.`}
          </div>
        )}
        {overallNum == null && <div style={{ marginBottom: 18 }} />}

        {/* Dimension breakdown */}
        <div style={{ marginBottom: 28 }}>
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

        {/* Outcome copy */}
        <OutcomeBlock
          passed={passed}
          isPioneer={isPioneer}
          credentialId={credentialId}
        />

        {/* Actions */}
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {passed && credentialId && (
            <Link
              to={`/verify/${credentialId}`}
              style={{
                ...primaryBtn(false),
                textDecoration: 'none',
                textAlign: 'center',
                display: 'block',
              }}
            >
              View Verify Page
            </Link>
          )}
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={outlinedBtn(false)}
          >
            Return to Dashboard
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
