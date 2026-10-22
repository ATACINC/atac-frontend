/**
 * ATAC Platform - ScenarioRail.jsx
 * Path: frontend/src/pages/sandbox/ScenarioRail.jsx
 *
 * In-call scenario rail for the sandbox call screen. Keeps the tester oriented
 * while the call is live: who the customer is, what the situation is, and the
 * role they are playing. Before this the briefing disappeared the moment the
 * call connected and testers lost the thread (Planovate demo, Oct 22 2026).
 *
 * Coaching content ("What good looks like" and the five moves) renders ONLY
 * when the parent passes showCoaching. The sandbox demo passes it; the live
 * candidate simulator never mounts this component at all, and must not show
 * coaching mid-call because it would make the credential easier than the
 * assessment it certifies.
 *
 * Data: the briefing config from GET /api/sandbox/scenario/:code (or the
 * SC-002 fallback in SandboxPage). Display only, nothing here is scored.
 *
 * Styling follows the sandbox convention: sandboxTheme tokens plus inline
 * styles. Responsive rules live in SANDBOX_CSS (sandboxTheme.js): above 640px
 * the toggle is hidden and the body is forced open; at 640 and below the rail
 * starts collapsed so the transcript stays above the fold on a phone.
 */

import { useState } from 'react';
import { T } from './sandboxTheme';

const BODY_ID = 'sbx-srail-body';
const TITLE_ID = 'sbx-srail-title';

const label = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: T.goldSoft,
  fontFamily: T.fontBody,
};

const chip = (accent) => ({
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  padding: '5px 11px',
  borderRadius: 999,
  border: `1px solid ${accent ? 'rgba(239,192,60,0.5)' : 'rgba(255,255,255,0.14)'}`,
  color: accent ? T.goldSoft : T.muted,
  whiteSpace: 'nowrap',
});

const body = { margin: 0, fontSize: 18, lineHeight: 1.6, color: '#BFC2CB' };

function sectionCard(children, key) {
  return (
    <div
      key={key}
      style={{
        background: `linear-gradient(165deg, ${T.navy1}, ${T.navy2})`,
        border: '1px solid rgba(239,192,60,0.2)',
        borderRadius: 16,
        padding: '20px 24px',
        boxShadow: '0 30px 70px -34px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

export default function ScenarioRail({ scenario, showCoaching = false }) {
  // Starts collapsed; the CSS force-opens it above 640px so a desktop viewer
  // always sees the full rail regardless of this state.
  const [open, setOpen] = useState(false);

  if (!scenario || typeof scenario !== 'object') return null;
  const p = scenario.persona || {};
  const name = p.name || 'Your customer';
  const initial = p.avatarInitial || String(name).charAt(0).toUpperCase();
  const who = [name, p.age].filter(Boolean).join(', ');
  const difficulty = scenario.difficulty ? String(scenario.difficulty).toUpperCase() : null;
  const moves = showCoaching && Array.isArray(scenario.fiveMoves) ? scenario.fiveMoves : [];

  return (
    <section
      className="sbx-srail"
      aria-labelledby={TITLE_ID}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 2px' }}>
        <h2 id={TITLE_ID} style={label}>Your Scenario</h2>
        <button
          type="button"
          className="sbx-srail-toggle"
          aria-expanded={open}
          aria-controls={BODY_ID}
          onClick={() => setOpen((v) => !v)}
          style={{
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.02)',
            color: T.ink2,
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontFamily: T.fontBody,
            cursor: 'pointer',
          }}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      <div
        id={BODY_ID}
        className={'sbx-srail-body' + (open ? '' : ' is-collapsed')}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {sectionCard(
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 54, height: 54, flex: '0 0 54px', borderRadius: '50%',
                  background: T.avatarBg, border: '1px solid rgba(239,192,60,0.34)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: T.fontDisplay, fontSize: 24, color: T.goldBright,
                }}
              >
                {initial}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, lineHeight: 1.2 }}>{who}</div>
                {p.descriptor && <div style={{ fontSize: 16, color: T.faint, marginTop: 3 }}>{p.descriptor}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {scenario.sector && <span style={chip(false)}>{scenario.sector}</span>}
              {difficulty && <span style={chip(false)}>{difficulty}</span>}
              {scenario.emotionalRead && <span style={chip(true)}>{scenario.emotionalRead}</span>}
            </div>
            {scenario.aboutCustomer && <p style={body}>{scenario.aboutCustomer}</p>}
          </>,
          'who'
        )}

        {scenario.role && sectionCard(
          <>
            <h3 style={label}>Your Role</h3>
            <p style={body}>{scenario.role}</p>
          </>,
          'role'
        )}

        {showCoaching && (scenario.whatGoodLooksLike || moves.length > 0) && sectionCard(
          <>
            <h3 style={label}>What Good Looks Like</h3>
            {scenario.whatGoodLooksLike && <p style={body}>{scenario.whatGoodLooksLike}</p>}
            {moves.length > 0 && (
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {moves.map((m) => (
                  <li key={m.n} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ flex: '0 0 auto', fontFamily: T.fontDisplay, fontSize: 18, color: T.goldBright }}>{m.n}</span>
                    <span style={{ fontSize: 17, lineHeight: 1.5, color: '#BFC2CB' }}>
                      <span style={{ color: T.ink2, fontWeight: 600 }}>{m.title}</span>
                      {m.body ? `: ${m.body}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>,
          'coach'
        )}
      </div>
    </section>
  );
}
