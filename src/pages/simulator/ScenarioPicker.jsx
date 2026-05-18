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
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const SCENARIOS = [
  {
    code: 'SC-001',
    persona: 'Marcus',
    industry: 'Telecom',
    difficulty: 'Hard',
    difficultyColor: RED,
    blurb: 'A long-time customer is escalating a billing dispute after three failed callbacks. He wants a manager.',
  },
  {
    code: 'SC-002',
    persona: 'Linda',
    industry: 'Healthcare',
    difficulty: 'Medium',
    difficultyColor: AMBER,
    blurb: 'A patient is calling about a prescription refill that has not arrived. She is anxious and confused about the process.',
  },
  {
    code: 'SC-003',
    persona: 'David',
    industry: 'SaaS',
    difficulty: 'Easy to Medium',
    difficultyColor: TEAL,
    blurb: 'A new SaaS subscriber needs help finishing onboarding. He is friendly but unfamiliar with the platform.',
  },
  {
    code: 'SC-004',
    persona: 'Priya',
    industry: 'Hospitality',
    difficulty: 'Hard Plus',
    difficultyColor: RED,
    blurb: 'A frequent guest is calling at midnight from a hotel room with a broken thermostat. She has an early meeting.',
  },
];

export default function ScenarioPicker({ credentialId, onError }) {
  const navigate = useNavigate();
  const [submittingCode, setSubmittingCode] = useState(null);

  const pick = async (scenarioCode) => {
    if (submittingCode) return;
    setSubmittingCode(scenarioCode);
    try {
      const res = await assignSimulator(scenarioCode, credentialId);
      stashSimulatorSession(res.data, credentialId);
      navigate(`/simulator/briefing/${res.data.sessionId}`, { replace: true });
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
        padding: '48px 24px 60px',
      }}
    >
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14 }}>
            ATAC Call Readiness Simulator
          </div>
          <h1 style={{ fontFamily: VAULT_DISPLAY, fontSize: 36, fontWeight: 400, color: WHITE, margin: '0 0 12px', lineHeight: 1.15 }}>
            Choose your scenario
          </h1>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, margin: '0 auto', maxWidth: 520 }}>
            Each scenario places you on a live call with a different customer. Pick the one you want to take on; you can revisit the simulator later for the others.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
          }}
        >
          {SCENARIOS.map((s) => {
            const submitting = submittingCode === s.code;
            const anySubmitting = submittingCode !== null;
            return (
              <button
                key={s.code}
                type="button"
                onClick={() => pick(s.code)}
                disabled={anySubmitting}
                style={{
                  textAlign: 'left',
                  background: BG1,
                  border: `1px solid ${BORDER2}`,
                  borderRadius: 4,
                  padding: '22px 24px',
                  cursor: anySubmitting ? 'not-allowed' : 'pointer',
                  fontFamily: VAULT_BODY,
                  color: WHITE,
                  opacity: anySubmitting && !submitting ? 0.5 : 1,
                  transition: 'border-color 0.15s, background 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
                onMouseEnter={(e) => {
                  if (!anySubmitting) e.currentTarget.style.borderColor = BORDER;
                }}
                onMouseLeave={(e) => {
                  if (!anySubmitting) e.currentTarget.style.borderColor = BORDER2;
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                    {s.code} · {s.industry}
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: s.difficultyColor,
                      border: `1px solid ${s.difficultyColor}`,
                      borderRadius: 999,
                      padding: '3px 10px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.difficulty}
                  </span>
                </div>
                <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 26, fontWeight: 400, color: WHITE, lineHeight: 1.1 }}>
                  {s.persona}
                </div>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, margin: '4px 0 0' }}>
                  {s.blurb}
                </p>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: submitting ? MUTED : GOLD,
                    fontWeight: 700,
                  }}
                >
                  {submitting ? 'Assigning...' : 'Start this scenario →'}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            disabled={!!submittingCode}
            style={{
              background: 'transparent',
              border: 'none',
              color: MUTED,
              fontSize: 12,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              cursor: submittingCode ? 'not-allowed' : 'pointer',
              padding: '8px 0',
              fontFamily: VAULT_BODY,
            }}
          >
            Cancel and return to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
