/**
 * ATAC Platform - ScenarioPicker.jsx
 * Path: frontend/src/pages/simulator/ScenarioPicker.jsx
 *
 * Pioneer-only scenario selection screen. Rendered inline by SimulatorEntry
 * when the credential_id URL param is present (signalling the Pioneer
 * supplementary attempt flow). New candidates never see this; their
 * scenario is auto-assigned by the backend.
 *
 * Four hardcoded scenarios per the M2 brief. The list could later be
 * fetched from a backend list endpoint, but for v1 the four cards are
 * static; backend scenario_code is the canonical identifier.
 *
 * Desktop-first layout (2x2 grid, max-width 1400 centered) matching the
 * Briefing redesign in commit be84edb. Mood pill and expected-duration
 * metadata are frontend-only display fields; no backend change.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assignSimulator } from '../../api/client';
import { stashSimulatorSession } from './SimulatorEntry';

const BG    = '#080B12';
const BG1   = '#0C1018';
const GOLD  = '#C9A84C';
const TEAL  = '#1A8F69';
const RED   = '#C45C5C';
const AMBER = '#C48A2A';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const SCENARIOS = [
  {
    code: 'SC-001',
    persona: 'Marcus',
    industry: 'Telecom',
    difficulty: 'Hard',
    blurb: 'A long-time customer is escalating a billing dispute after three failed callbacks. He wants a manager.',
    mood: 'Frustrated',
    moodIconKey: 'flame',
    moodColor: RED,
    durationLabel: '6 to 12 minutes',
  },
  {
    code: 'SC-002',
    persona: 'Linda',
    industry: 'Healthcare',
    difficulty: 'Medium',
    blurb: 'A patient is calling about a prescription refill that has not arrived. She is anxious and confused about the process.',
    mood: 'Anxious and Confused',
    moodIconKey: 'question',
    moodColor: AMBER,
    durationLabel: '4 to 8 minutes',
  },
  {
    code: 'SC-003',
    persona: 'David',
    industry: 'SaaS',
    difficulty: 'Easy to Medium',
    blurb: 'A new SaaS subscriber needs help finishing onboarding. He is friendly but unfamiliar with the platform.',
    mood: 'Calm and Decisive',
    moodIconKey: 'check',
    moodColor: TEAL,
    durationLabel: '4 to 8 minutes',
  },
  {
    code: 'SC-004',
    persona: 'Priya',
    industry: 'Hospitality',
    difficulty: 'Hard Plus',
    blurb: 'A frequent guest is calling at midnight from a hotel room with a broken thermostat. She has an early meeting.',
    mood: 'Stressed and Tired',
    moodIconKey: 'moon',
    moodColor: AMBER,
    durationLabel: '6 to 12 minutes',
  },
];

// Map difficulty label to badge styling per spec.
// EASY-MEDIUM -> teal, MEDIUM -> gold, HARD -> coral, HARD PLUS -> coral
// thicker. The text case matches what we render in the SCENARIOS array.
function badgeStyleFor(difficulty) {
  const lower = String(difficulty || '').toLowerCase();
  let color;
  let borderWidth = 1;
  if (lower.includes('easy')) {
    color = TEAL;
  } else if (lower === 'medium') {
    color = GOLD;
  } else if (lower === 'hard plus') {
    color = RED;
    borderWidth = 2;
  } else {
    color = RED; // covers "Hard"
  }
  return {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color,
    background: `${hexWithOpacity(color, 0.2)}`,
    border: `${borderWidth}px solid ${color}`,
    borderRadius: 14,
    padding: '6px 14px',
    whiteSpace: 'nowrap',
    fontFamily: VAULT_BODY,
  };
}

// Cheap hex + alpha helper. Accepts a #RRGGBB string and returns a
// rgba(R,G,B,A) string. Avoids pulling in any color-manipulation dep.
function hexWithOpacity(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function ScenarioPicker({ credentialId, onError }) {
  const navigate = useNavigate();
  const [submittingCode, setSubmittingCode] = useState(null);

  const pick = async (scenarioCode) => {
    if (submittingCode) return;
    setSubmittingCode(scenarioCode);
    try {
      const res = await assignSimulator(scenarioCode, credentialId);
      const stashed = stashSimulatorSession(res.data, credentialId);
      navigate(`/simulator/briefing/${stashed.sessionId}`, { replace: true });
    } catch (err) {
      setSubmittingCode(null);
      const msg = err?.response?.data?.error || err?.message || 'Unknown error';
      onError(`We could not assign that scenario. ${msg}. Please try again.`);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: WHITE,
        fontFamily: VAULT_BODY,
        padding: '56px 24px 64px',
      }}
    >
      <div className="sp-shell">

        {/* Header */}
        <div className="sp-header">
          <div className="sp-eyebrow">ATAC Call Readiness Simulator</div>
          <h1 className="sp-title">Choose your scenario.</h1>
          <p className="sp-subhead">
            Each scenario places you on a live call with a different customer. Pick the one you want to take on. You can revisit the simulator later for the others.
          </p>
        </div>

        {/* 2x2 grid (responsive) */}
        <div className="sp-grid">
          {SCENARIOS.map((s) => {
            const submitting = submittingCode === s.code;
            const anySubmitting = submittingCode !== null;
            return (
              <button
                key={s.code}
                type="button"
                onClick={() => pick(s.code)}
                disabled={anySubmitting}
                className={`sp-card${anySubmitting ? ' sp-card-locked' : ''}${submitting ? ' sp-card-submitting' : ''}`}
                aria-label={`Start scenario ${s.code} with ${s.persona}, ${s.industry}, ${s.difficulty} difficulty`}
              >
                {/* Top row: code + industry / difficulty badge */}
                <div className="sp-card-top">
                  <div className="sp-card-code">
                    {s.code} · {s.industry}
                  </div>
                  <span style={badgeStyleFor(s.difficulty)}>{s.difficulty}</span>
                </div>

                {/* Customer name (centerpiece) */}
                <div className="sp-card-name">{s.persona}</div>

                {/* Mood pill */}
                <div className="sp-card-mood">
                  <MoodIcon kind={s.moodIconKey} color={s.moodColor} />
                  <span>{s.mood}</span>
                </div>

                {/* Brief description */}
                <p className="sp-card-blurb">{s.blurb}</p>

                {/* Bottom row: duration + start link */}
                <div className="sp-card-bottom">
                  <span className="sp-card-duration">
                    Expected duration: {s.durationLabel}
                  </span>
                  <span className="sp-card-start" style={{ color: submitting ? MUTED : GOLD }}>
                    {submitting ? 'Assigning...' : 'Start this scenario →'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sp-footer">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            disabled={!!submittingCode}
            className="sp-cancel"
          >
            Cancel and return to dashboard
          </button>
        </div>
      </div>

      <style>{`
        /* === Shell + header ============================================ */
        .sp-shell {
          max-width: 1400px;
          margin: 0 auto;
        }
        .sp-header {
          text-align: center;
          margin-bottom: 48px;
        }
        .sp-eyebrow {
          font-size: 11px;
          color: ${GOLD};
          letter-spacing: 0.22em;
          text-transform: uppercase;
          margin-bottom: 18px;
          font-family: ${VAULT_BODY};
          font-weight: 700;
        }
        .sp-title {
          font-family: ${VAULT_DISPLAY};
          font-size: 32px;
          font-weight: 400;
          color: ${WHITE};
          margin: 0 0 16px;
          line-height: 1.05;
        }
        .sp-subhead {
          font-family: ${VAULT_BODY};
          font-size: 15px;
          color: ${MUTED};
          line-height: 1.6;
          margin: 0 auto;
          max-width: 720px;
        }
        @media (min-width: 768px) {
          .sp-title { font-size: 40px; }
          .sp-subhead { font-size: 16px; }
        }
        @media (min-width: 1024px) {
          .sp-title { font-size: 56px; margin-bottom: 20px; }
          .sp-subhead { font-size: 17px; }
          .sp-header { margin-bottom: 56px; }
        }

        /* === 2x2 grid ================================================== */
        .sp-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 16px;
          margin: 0 auto;
        }
        @media (min-width: 768px) {
          .sp-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 24px;
            max-width: 900px;
          }
        }
        @media (min-width: 1024px) {
          .sp-grid {
            gap: 32px;
            max-width: none;
          }
        }

        /* === Card ====================================================== */
        .sp-card {
          all: unset;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          background: ${BG1};
          border: 1px solid rgba(201,168,76,0.25);
          border-radius: 12px;
          padding: 24px;
          cursor: pointer;
          color: ${WHITE};
          font-family: ${VAULT_BODY};
          text-align: left;
          transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          min-height: 280px;
        }
        @media (min-width: 768px) {
          .sp-card {
            padding: 28px;
            min-height: 310px;
          }
        }
        @media (min-width: 1024px) {
          .sp-card {
            padding: 36px;
            min-height: 340px;
          }
        }
        .sp-card:hover:not(.sp-card-locked) {
          border-color: rgba(201,168,76,0.6);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(201,168,76,0.15);
          background: ${BG1};
        }
        .sp-card:focus-visible {
          outline: 2px solid ${GOLD};
          outline-offset: 3px;
        }
        .sp-card-locked {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .sp-card-submitting {
          opacity: 1;
        }

        /* === Card internals ============================================ */
        .sp-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .sp-card-code {
          font-size: 12px;
          color: ${GOLD};
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 600;
        }
        .sp-card-name {
          font-family: ${VAULT_DISPLAY};
          font-size: 28px;
          font-weight: 400;
          color: ${WHITE};
          line-height: 1.05;
          margin-bottom: 12px;
        }
        @media (min-width: 768px) {
          .sp-card-name { font-size: 36px; }
        }
        @media (min-width: 1024px) {
          .sp-card-name { font-size: 48px; margin-bottom: 14px; }
        }
        .sp-card-mood {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          align-self: flex-start;
          background: rgba(238,233,223,0.06);
          border: 1px solid ${MUTED};
          border-radius: 12px;
          padding: 6px 12px;
          font-size: 13px;
          color: ${WHITE};
          font-family: ${VAULT_BODY};
          margin-bottom: 16px;
        }
        .sp-card-blurb {
          font-size: 15px;
          color: ${MUTED};
          line-height: 1.6;
          margin: 0 0 16px;
          font-family: ${VAULT_BODY};
        }
        .sp-card-bottom {
          margin-top: auto;
          padding-top: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .sp-card-duration {
          font-size: 13px;
          color: ${MUTED};
          font-family: ${VAULT_BODY};
        }
        .sp-card-start {
          font-size: 13px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 700;
          font-family: ${VAULT_BODY};
          white-space: nowrap;
        }

        /* === Footer ==================================================== */
        .sp-footer {
          text-align: center;
          margin-top: 32px;
        }
        @media (min-width: 1024px) {
          .sp-footer { margin-top: 48px; }
        }
        .sp-cancel {
          background: transparent;
          border: none;
          color: ${MUTED};
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          cursor: pointer;
          padding: 8px 0;
          font-family: ${VAULT_BODY};
        }
        .sp-cancel:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}

/* === Mood icons (inline SVG, matches Call.jsx convention) ============== */

function MoodIcon({ kind, color }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    style: { flexShrink: 0 },
  };
  if (kind === 'flame') {
    return (
      <svg {...common}>
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.5-.5-2-2-3.5-2-2-2.5-3-2.5-4 0-1.5 1-3 1-3s-2 1-3 3c-1 2-1 3.5 1.5 7.5z" />
        <path d="M14 14c1 .5 1.5 1.5 1.5 2.5a3.5 3.5 0 0 1-7 0c0-1 .25-2 1-3" />
      </svg>
    );
  }
  if (kind === 'question') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  if (kind === 'check') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="8 12 11 15 16 9" />
      </svg>
    );
  }
  if (kind === 'moon') {
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return null;
}
