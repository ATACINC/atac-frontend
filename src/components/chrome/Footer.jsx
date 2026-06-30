/**
 * ATAC Platform - Footer.jsx
 * Path: frontend/src/components/chrome/Footer.jsx
 *
 * Shared app footer, styled from the design-system foundation.
 * Props:
 *   links : [{ label, href, external }]  optional link list (right side)
 *   note  : optional middle note string
 *   year  : optional copyright year (defaults to the current year)
 *
 * Presentational only. Adopted in this PR ONLY where a footer already exists
 * (VerifyLanding); not added to screens that have none.
 */

import { color, font } from '../../designSystem/tokens';

export default function Footer({ links = [], note = null, year, copyright }) {
  const y = year || new Date().getFullYear();
  return (
    <footer
      className="ds-footer"
      style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        flexWrap: 'wrap',
        padding: '16px 40px',
        borderTop: `1px solid ${color.chromeBorder}`,
        fontFamily: font.body,
        fontSize: 12,
        letterSpacing: '0.04em',
        color: color.muted2,
      }}
    >
      <span>{copyright || `(c) ${y} ATAC Global CX`}</span>
      {note && <span style={{ color: color.muted }}>{note}</span>}
      {links.length > 0 && (
        <span style={{ display: 'inline-flex', gap: 18, flexWrap: 'wrap' }}>
          {links.map((l) => (
            <a
              key={l.href + l.label}
              href={l.href}
              target={l.external ? '_blank' : undefined}
              rel={l.external ? 'noopener noreferrer' : undefined}
              style={{ color: color.muted2, textDecoration: 'none' }}
            >
              {l.label}
            </a>
          ))}
        </span>
      )}
    </footer>
  );
}
