/**
 * ATAC Platform - Header.jsx
 * Path: frontend/src/components/chrome/Header.jsx
 *
 * Shared app header, styled from the design-system foundation (src/designSystem).
 *
 *   variant="full"  logo + user name + tier pill + LanguageSelector + Sign Out
 *   variant="lite"  logo + optional `right` slot
 *
 * Pure presentational: it fetches NO data. The screen passes userName / tier /
 * onSignOut and (for full) the language selector renders itself via i18n. The
 * `right` slot allows a screen to add a minimal control to a lite header.
 *
 * Reuses LanguageSelector.jsx as-is. Note: VerifiedBadge.jsx is the credential
 * "Identity Verified" badge (a different concept), so the purchase-tier pill is
 * rendered here from tokens rather than reusing that badge.
 */

import brandLogo from '../../assets/atac-globalcx-logo-header.png';
import LanguageSelector from '../LanguageSelector';
import { color, font, radius } from '../../designSystem/tokens';

export default function Header({
  variant = 'lite',
  userName,
  tier,
  onSignOut,
  right = null,
  showLanguage = true,
  logoHeight = 40,
}) {
  const full = variant === 'full';
  return (
    <header
      className="ds-header"
      style={{
        position: 'relative',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        padding: '18px 40px',
        borderBottom: `1px solid ${color.chromeBorder}`,
        background: color.chromeBg,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <img
        src={brandLogo}
        alt="ATAC Global CX"
        style={{ height: logoHeight, width: 'auto', display: 'block', flex: '0 0 auto' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        {right}

        {full && userName && (
          <span className="ds-header-userbox" style={{ fontFamily: font.body, fontSize: 15, fontWeight: 600, color: color.heading, whiteSpace: 'nowrap' }}>
            {userName}
          </span>
        )}

        {full && tier && (
          <span
            className="ds-header-userbox"
            style={{
              fontSize: 11,
              background: 'rgba(239,192,60,0.08)',
              border: `1px solid ${color.gold}`,
              borderRadius: radius.pill,
              padding: '5px 12px',
              color: color.gold,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {tier}
          </span>
        )}

        {full && showLanguage && <LanguageSelector />}

        {full && onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            style={{
              background: 'none',
              border: `1px solid ${color.border}`,
              color: color.body,
              borderRadius: radius.sm,
              padding: '9px 16px',
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: font.body,
            }}
          >
            Sign Out
          </button>
        )}
      </div>

      {/* Tighten chrome + hide the user/tier box on small phones (spec: <=620px). */}
      <style>{`
        @media (max-width: 620px) {
          .ds-header { padding-left: 18px !important; padding-right: 18px !important; }
          .ds-header-userbox { display: none !important; }
        }
      `}</style>
    </header>
  );
}
