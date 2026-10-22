/**
 * ATAC Platform - ScenarioPanel.jsx
 * Path: frontend/src/pages/simulator/ScenarioPanel.jsx
 *
 * In-call scenario panel for the CREDENTIALED call screen. Keeps the candidate
 * oriented during the live call: who the customer is, the situation, and the
 * role they are playing. Before this, the briefing vanished the moment the
 * call connected.
 *
 * Deliberately NOT shown here: success criteria or any "what good looks like"
 * coaching. This is the assessed call; coaching mid-call would make the
 * credential easier than the readiness it certifies. The sandbox demo has its
 * own rail (sandbox/ScenarioRail.jsx) that may show coaching; this one never
 * does.
 *
 * Data: the session blob stashed by SimulatorEntry from /api/sim-live/assign
 * (personaName, industry, difficulty, agentRole, personaBio, scenarioContext).
 * Display only, nothing here is scored. Any missing field is skipped; with no
 * usable field at all the panel renders nothing.
 *
 * Styling is the credentialed Vault language (designSystem tokens), matching
 * CustomerAccountPanel, not the sandbox skin.
 */

import { useState } from 'react';
import { color as ds, font as dsFont } from '../../designSystem/tokens';

const BG1 = ds.panel;
const GOLD = ds.gold;
const WHITE = ds.heading;
const MUTED = ds.muted;
const BORDER2 = ds.border;
const BODY = dsFont.body;

const str = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

const BODY_ID = 'sim-scp-body';

export default function ScenarioPanel({ brief }) {
  const [open, setOpen] = useState(true);

  if (!brief || typeof brief !== 'object') return null;
  const name = str(brief.personaName);
  const industry = str(brief.industry);
  const difficulty = str(brief.difficulty);
  const role = str(brief.agentRole);
  const about = [str(brief.personaBio), str(brief.scenarioContext)].filter(Boolean).join(' ');
  if (!name && !role && !about) return null;

  const chip = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: MUTED,
    border: `1px solid ${BORDER2}`,
    borderRadius: 2,
    padding: '4px 10px',
    whiteSpace: 'nowrap',
  };
  const label = {
    margin: '0 0 8px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: GOLD,
    fontFamily: BODY,
  };
  const para = { margin: 0, fontSize: 17, lineHeight: 1.65, color: WHITE };

  return (
    <section
      aria-labelledby="sim-scp-title"
      style={{
        background: BG1,
        border: `1px solid ${BORDER2}`,
        borderRadius: 3,
        padding: '20px 26px',
        marginBottom: 22,
        fontFamily: BODY,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          <h2
            id="sim-scp-title"
            style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, fontFamily: BODY }}
          >
            Your Scenario
          </h2>
          {name && <span style={{ fontSize: 19, fontWeight: 600, color: WHITE }}>{name}</span>}
          {industry && <span style={chip}>{industry}</span>}
          {difficulty && <span style={chip}>{difficulty}</span>}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={BODY_ID}
          onClick={() => setOpen((v) => !v)}
          style={{
            border: `1px solid ${BORDER2}`,
            borderRadius: 2,
            background: 'transparent',
            color: MUTED,
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontFamily: BODY,
            cursor: 'pointer',
          }}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <div id={BODY_ID} style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER2}` }}>
          {role && (
            <div>
              <h3 style={label}>Your Role</h3>
              <p style={para}>{role}</p>
            </div>
          )}
          {about && (
            <div>
              <h3 style={label}>About Your Customer</h3>
              <p style={para}>{about}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
