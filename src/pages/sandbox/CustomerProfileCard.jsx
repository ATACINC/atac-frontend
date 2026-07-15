/**
 * ATAC Platform - CustomerProfileCard.jsx
 * Path: frontend/src/pages/sandbox/CustomerProfileCard.jsx
 *
 * CRM-style customer account card shown on the sandbox call screen, so the
 * tester reads the account facts the way a real agent would instead of
 * improvising them. Display only: nothing here is scored, and the card never
 * hints at what the call is really about.
 *
 * Data: the customer_profile object from POST /api/sandbox/voice-start. It is
 * populated for the vulnerability scenarios and null for SC-002 and legacy
 * scenarios, so this renders nothing at all in those flows and the call screen
 * layout is unchanged.
 *
 * Values are rendered exactly as the API sends them. No reformatting, no
 * derived text, no fallback copy for a field the API did not send.
 *
 * Styling follows the sandbox convention: sandboxTheme tokens plus inline
 * styles, mirroring the briefing rail card and BriefStat rows. The responsive
 * rules live in SANDBOX_CSS (sandboxTheme.js), which SandboxFrame injects.
 */

import { useState } from 'react';
import { T } from './sandboxTheme';

// API key -> visible label. Order is the display order. Note the API sends the
// singular `note`; the label is "Notes".
const FIELDS = [
  { key: 'company',        label: 'Company' },
  { key: 'customer_name',  label: 'Customer' },
  { key: 'account_number', label: 'Account number' },
  { key: 'balance',        label: 'Balance' },
  { key: 'last_payment',   label: 'Last payment' },
  { key: 'note',           label: 'Notes' },
];

const BODY_ID = 'sbx-cpc-body';
const TITLE_ID = 'sbx-cpc-title';

// Keep only fields the API actually sent as a usable string. A missing key, a
// non-string value, or an empty/whitespace-only string is treated as absent and
// its row is skipped rather than rendered blank. Never throws on an odd shape.
function readRows(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return [];
  return FIELDS
    .map(({ key, label }) => ({ label, value: profile[key] }))
    .filter(({ value }) => typeof value === 'string' && value.trim() !== '');
}

export default function CustomerProfileCard({ profile }) {
  // Collapse is mobile-only and starts open on every call. Above 640px the
  // toggle is hidden and SANDBOX_CSS force-opens the body, so a card collapsed
  // on a phone can never stay hidden after a rotate to a wider viewport.
  const [open, setOpen] = useState(true);

  const rows = readRows(profile);
  if (rows.length === 0) return null;

  return (
    <section
      className="sbx-cpc"
      aria-labelledby={TITLE_ID}
      style={{
        background: `linear-gradient(165deg, ${T.navy1}, ${T.navy2})`,
        border: '1px solid rgba(239,192,60,0.2)',
        borderRadius: 16,
        padding: '16px 20px',
        marginBottom: 16,
        boxShadow: '0 30px 70px -34px rgba(0,0,0,0.8)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2
          id={TITLE_ID}
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: T.goldSoft,
            fontFamily: T.fontBody,
          }}
        >
          Customer Account
        </h2>
        <button
          type="button"
          className="sbx-cpc-toggle"
          aria-expanded={open}
          aria-controls={BODY_ID}
          onClick={() => setOpen((v) => !v)}
          style={{
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.02)',
            color: T.ink2,
            padding: '6px 12px',
            fontSize: 11,
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
        className={'sbx-cpc-body' + (open ? '' : ' is-collapsed')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginTop: 14,
          paddingTop: 14,
          borderTop: `1px solid ${T.panelLine}`,
        }}
      >
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="sbx-cpc-row"
            style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}
          >
            <span style={{ flex: '0 0 auto', fontSize: 12.5, color: T.faint }}>{label}</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#D7D9DF',
                textAlign: 'right',
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
