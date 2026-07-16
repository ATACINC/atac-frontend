/**
 * ATAC Platform - CustomerAccountPanel.jsx
 * Path: frontend/src/pages/simulator/CustomerAccountPanel.jsx
 *
 * CRM-style customer account panel for the CREDENTIALED call screen, so the
 * candidate reads the account facts the way a real agent would instead of
 * improvising them. Display only: nothing here is scored, and the panel never
 * hints at what the call is really about.
 *
 * Data: the customer_profile object from /api/sim-live/assign, threaded
 * through the session blob. Every scenario in the current credentialed
 * rotation returns null, so this renders nothing in production until
 * profiles are seeded; the row filtering is shared with the sandbox card
 * (customerProfile.js) so the two surfaces can never drift.
 *
 * Values render exactly as the API sends them. Styling is the credentialed
 * Vault language (designSystem tokens), not the sandbox skin.
 */

import { readProfileRows } from '../sandbox/customerProfile';
import { color as ds, font as dsFont } from '../../designSystem/tokens';

const BG1 = ds.panel;
const GOLD = ds.gold;
const WHITE = ds.heading;
const MUTED = ds.muted;
const BORDER2 = ds.border;
const BODY = dsFont.body;

export default function CustomerAccountPanel({ profile }) {
  const rows = readProfileRows(profile);
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="sim-cap-title"
      style={{
        background: BG1,
        border: `1px solid ${BORDER2}`,
        borderRadius: 3,
        padding: '16px 22px',
        marginBottom: 22,
        fontFamily: BODY,
      }}
    >
      <h2
        id="sim-cap-title"
        style={{
          margin: '0 0 12px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: GOLD,
          fontFamily: BODY,
        }}
      >
        Customer Account
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(({ label, value }) => (
          <div
            key={label}
            style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}
          >
            <span style={{ flex: '0 0 auto', fontSize: 12, color: MUTED, letterSpacing: '0.04em' }}>{label}</span>
            <span style={{ fontSize: 13, color: WHITE, textAlign: 'right', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
