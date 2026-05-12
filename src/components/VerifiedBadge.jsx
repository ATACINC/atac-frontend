/**
 * ATAC Platform - VerifiedBadge.jsx
 * Path: frontend/src/components/VerifiedBadge.jsx
 *
 * Small presentational pill rendered on the public verify page (and any
 * other surface that wants to advertise the "Verified Identity" tier) for
 * credentials issued at verification_tier='verified'.
 *
 * Display text: "Identity Verified" (past-tense achievement form).
 * The tier name itself is "Verified Identity" (noun phrase). The two
 * differ deliberately so the credential's badge reads as a past-tense
 * confirmation rather than a tier label.
 */

const GOLD = '#C9A84C';
const BG   = '#080B12';

export default function VerifiedBadge({ style }) {
  return (
    <span
      role="img"
      aria-label="Identity Verified"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(201,168,76,0.10)',
        color: GOLD,
        border: `1px solid ${GOLD}`,
        borderRadius: 999,
        padding: '4px 12px',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: GOLD,
          boxShadow: `0 0 0 2px rgba(201,168,76,0.18), inset 0 0 0 1px ${BG}`,
        }}
      />
      Identity Verified
    </span>
  );
}
