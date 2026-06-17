/**
 * CandidateStateRenderer
 *
 * Phase 5 dashboard state-machine UI. Consumes the resolved {nextStep,
 * reason, action, timers, context} bundle from GET /api/candidate/me/state
 * (backend commit 77e01f8) and renders one of 12 contextual hero cards.
 *
 * Returns null for states where the existing Dashboard render handles
 * the surface (start_assessment, view_credential), or when a sibling
 * component is already covering the same action (pioneer_revalidate
 * when the Pioneer card is rendering).
 *
 * Matches existing Vault Design System tokens; no new colors, no new
 * fonts, no new dependencies.
 */

import { useEffect, useState } from 'react';

/* -- Vault tokens (mirror per-file convention used in Dashboard.jsx) -- */
const BG    = '#080B12';
const BG1   = '#0C1018';
const GOLD  = '#C9A84C';
const TEAL2 = '#22A67E';
const RED   = '#C45C5C';
const AMBER = '#C48A2A';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const FAINT   = 'rgba(238,233,223,0.04)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const SUPPORT_EMAIL = 'credentials@atacglobalcx.com';

// Backend may return action.url as an absolute origin URL (for example
// 'https://app.atacglobalcx.com/simulator?auto=true'). React Router treats
// an absolute string as a relative path and stitches it onto the current
// location, producing /dashboard/https://... and a 404. Normalize through
// the URL parser: same-origin targets feed only the path + search into
// navigate(); cross-origin targets get a full-page assign so SPA routing
// never sees them. Malformed values fall back to the original behavior.
function navigateNormalized(navigate, rawUrl) {
  if (!rawUrl) return;
  let parsed;
  try {
    parsed = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  } catch (_) {
    navigate(rawUrl);
    return;
  }
  if (typeof window !== 'undefined' && parsed.origin !== window.location.origin) {
    window.location.assign(parsed.href);
    return;
  }
  navigate(parsed.pathname + parsed.search + parsed.hash);
}

// Never show a raw ISO timestamp to a candidate. The backend resolver embeds
// them in some `reason` strings (e.g. the simulator cooldown reason
// "... Available again at 2026-...Z"). Strip any ISO 8601 datetime and tidy a
// dangling "at/on/by" connector so a leaked timestamp can never reach the UI.
const ISO_DATETIME_RE = /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g;
function stripIsoTimestamps(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(ISO_DATETIME_RE, '')
    .replace(/\s+(?:at|on|by)\s*(?=[.,;:!?]|$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

export default function CandidateStateRenderer({
  flowState,
  navigate,
  pioneerCardActive,
  onOpenPhotoVerification,
}) {
  if (!flowState || !flowState.nextStep) return null;
  const { nextStep, reason: rawReason, action, timers } = flowState;
  // Sanitize before any display path uses `reason`. The simulator_cooldown
  // branch below already drops reason entirely; this guards every other
  // surface (generic hero body, queued card, revoked banner) so no raw ISO
  // timestamp from the resolver can ever render to a candidate.
  const reason = stripIsoTimestamps(rawReason);

  // States the existing render handles: do not render a hero here.
  if (nextStep === 'view_credential') return null;
  if (nextStep === 'start_assessment') return null;

  // Authenticated-user safety net: register should never reach the
  // dashboard. If it does, log and bounce to /login.
  if (nextStep === 'register') {
    console.error('[CandidateStateRenderer] Unexpected register state for authenticated user');
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
    }
    return null;
  }

  // Pioneer card on Dashboard:500 is the canonical Pioneer surface.
  // Suppress this state-machine block when it is already showing.
  if (nextStep === 'pioneer_revalidate' && pioneerCardActive) return null;

  if (nextStep === 'credential_revoked') {
    return <RevokedBanner reason={reason} />;
  }

  if (nextStep === 'simulator_cooldown') {
    // Note: the backend `reason` for this state embeds a raw ISO
    // timestamp ("Available again at 2026-...Z"), so it is intentionally
    // NOT passed through. CooldownCard shows approved static copy plus
    // the human-readable countdown derived from endsAt. navigate is
    // passed so the button can launch the simulator once the timer
    // reaches zero.
    return <CooldownCard endsAt={timers?.simulator_cooldown_ends_at} navigate={navigate} />;
  }

  if (nextStep === 'simulator_queued') {
    // Display-only. Admission into the call is driven by the /assign re-poll
    // on the simulator page, NOT by /me/state; this card just keeps the
    // dashboard consistent for a candidate who is waiting in line. The CTA
    // re-enters the simulator (which re-takes a place in the queue).
    return (
      <QueuedCard
        position={flowState.position ?? flowState.context?.position}
        reason={reason}
        actionUrl={action?.url}
        navigate={navigate}
      />
    );
  }

  // All other states use the generic hero card.
  const cfg = HERO_CONFIG[nextStep];
  if (!cfg) {
    console.warn('[CandidateStateRenderer] Unknown nextStep:', nextStep);
    return null;
  }

  const heading = typeof cfg.heading === 'function' ? cfg.heading(flowState) : cfg.heading;
  const ctaLabel = typeof cfg.ctaLabel === 'function' ? cfg.ctaLabel(flowState) : cfg.ctaLabel;
  const ctaTarget = action?.url || cfg.fallbackUrl || null;

  const handleClick = () => {
    if (cfg.handler === 'navigate') {
      if (ctaTarget) navigateNormalized(navigate, ctaTarget);
      return;
    }
    if (cfg.handler === 'mailto') {
      if (typeof window !== 'undefined') {
        window.location.href = `mailto:${cfg.mailto || SUPPORT_EMAIL}`;
      }
      return;
    }
    if (cfg.handler === 'photo') {
      if (typeof onOpenPhotoVerification === 'function') onOpenPhotoVerification();
      return;
    }
    if (cfg.handler === 'verify_email') {
      // No verify-email resend endpoint exists today; offer mailto fallback
      // so the candidate can contact support if they cannot find the email.
      if (typeof window !== 'undefined') {
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Verification%20email%20request`;
      }
      return;
    }
  };

  return (
    <HeroCard
      accent={cfg.accent}
      heading={heading}
      body={reason}
      ctaLabel={ctaLabel}
      onClick={handleClick}
      ctaDisabled={!!cfg.ctaDisabled}
      subtext={cfg.subtext}
    />
  );
}

/* ============================================================
 * Hero config table
 * ============================================================ */

const HERO_CONFIG = {
  verify_email: {
    heading: 'Verify your email to continue',
    ctaLabel: 'Open Email Help',
    handler: 'verify_email',
    accent: GOLD,
    subtext: 'Check your inbox for a verification link. If it is missing, contact support.',
  },
  pay: {
    heading: 'Choose your tier',
    ctaLabel: 'Choose Your Tier',
    handler: 'navigate',
    fallbackUrl: '/payment',
    accent: GOLD,
  },
  upload_photo: {
    heading: 'Upload your verification photo',
    ctaLabel: 'Upload Photo',
    handler: 'photo',
    accent: GOLD,
  },
  mint_failed: {
    heading: 'Credential minting hit an error',
    ctaLabel: 'Contact Support',
    handler: 'mailto',
    mailto: SUPPORT_EMAIL,
    accent: RED,
    subtext: 'No charge to retry. Our team will resolve this for you.',
  },
  resume_assessment: {
    heading: 'Resume your assessment',
    ctaLabel: 'Continue Assessment',
    handler: 'navigate',
    fallbackUrl: '/assessment',
    accent: GOLD,
  },
  take_simulator: {
    // First-time vs repeat is sourced from flowState.reason. Default is
    // first-time copy. The "again" wording fires ONLY when the resolver
    // explicitly indicates a prior attempt (cooldown, failure, retry).
    // First-timers must never see "again".
    heading: (state) => {
      const r = (state.reason || '').toLowerCase();
      const isRetry =
        r.includes('cooldown') ||
        r.includes('failed') ||
        r.includes('try again') ||
        r.includes('retake') ||
        r.includes('retry') ||
        r.includes('attempt again');
      if (isRetry) return 'Try the simulator again';
      return "You're halfway there";
    },
    ctaLabel: 'Take the Simulator',
    handler: 'navigate',
    fallbackUrl: '/simulator?auto=true',
    accent: GOLD,
  },
  pioneer_revalidate: {
    heading: 'Validate your Pioneer credential',
    ctaLabel: 'Run the Simulator',
    handler: 'navigate',
    fallbackUrl: '/simulator',
    accent: GOLD,
  },
  credential_expired: {
    heading: 'Credential expired',
    ctaLabel: 'Contact Support to Renew',
    handler: 'mailto',
    mailto: SUPPORT_EMAIL,
    accent: AMBER,
  },
};

/* ============================================================
 * Generic hero card
 * ============================================================ */

function HeroCard({ accent, heading, body, ctaLabel, onClick, ctaDisabled, subtext }) {
  return (
    <div
      className="vault-up"
      style={{
        background: BG1,
        border: `1px solid ${BORDER2}`,
        borderLeft: `3px solid ${accent || GOLD}`,
        borderRadius: 4,
        padding: '28px 32px',
        marginBottom: 28,
        fontFamily: VAULT_BODY,
      }}
    >
      <h2
        style={{
          fontFamily: VAULT_DISPLAY,
          fontSize: 28,
          fontWeight: 400,
          color: WHITE,
          margin: '0 0 12px',
          lineHeight: 1.15,
        }}
      >
        {heading}
      </h2>
      {body && (
        <p
          style={{
            fontSize: 14,
            color: 'rgba(238,233,223,0.76)',
            lineHeight: 1.7,
            margin: '0 0 22px',
            maxWidth: 720,
          }}
        >
          {body}
        </p>
      )}
      {ctaLabel && (
        <button
          type="button"
          onClick={onClick}
          disabled={ctaDisabled}
          style={{
            background: ctaDisabled ? 'rgba(201,168,76,0.4)' : (accent || GOLD),
            color: BG,
            border: 'none',
            borderRadius: 2,
            padding: '13px 26px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: ctaDisabled ? 'not-allowed' : 'pointer',
            fontFamily: VAULT_BODY,
          }}
        >
          {ctaLabel}
        </button>
      )}
      {subtext && (
        <div
          style={{
            marginTop: 16,
            fontSize: 12,
            color: MUTED,
            fontStyle: 'italic',
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Simulator cooldown card (with live countdown)
 * ============================================================ */

function CooldownCard({ endsAt, navigate }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return undefined;
    // Refresh once a minute so the countdown ticks without burning frames.
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [endsAt]);

  const cd = formatCooldownTimer(endsAt, now);

  return (
    <div
      className="vault-up sim-cd-card"
      style={{
        background: BG1,
        border: `1px solid ${BORDER2}`,
        borderLeft: `3px solid ${AMBER}`,
        borderRadius: 4,
        padding: '28px 32px',
        marginBottom: 28,
        fontFamily: VAULT_BODY,
      }}
    >
      {/* Two-column on desktop (content | timer); stacks on mobile with
          the timer block first. The media query lives here so the inline
          style convention is preserved everywhere else. */}
      <style>{`
        .sim-cd-card { display: flex; flex-direction: row; align-items: center; gap: 32px; }
        .sim-cd-left { flex: 1 1 0; min-width: 0; }
        .sim-cd-right { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        @media (max-width: 768px) {
          .sim-cd-card { flex-direction: column-reverse; align-items: stretch; gap: 22px; }
          .sim-cd-right { width: 100%; }
        }
      `}</style>

      <div className="sim-cd-left">
        <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 700 }}>
          Cooldown in progress
        </div>
        <h2
          style={{
            fontFamily: VAULT_DISPLAY,
            fontSize: 28,
            fontWeight: 400,
            color: WHITE,
            margin: '0 0 12px',
            lineHeight: 1.15,
          }}
        >
          Your next attempt is almost ready
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'rgba(238,233,223,0.76)',
            lineHeight: 1.7,
            margin: '0 0 22px',
            maxWidth: 720,
          }}
        >
          There is a short wait between attempts so you can come back fresh. Use the time to review your feedback so your next call is your strongest one.
        </p>
        <button
          type="button"
          disabled={!cd.ready}
          aria-disabled={cd.ready ? undefined : 'true'}
          onClick={cd.ready ? () => navigate('/simulator?auto=true') : undefined}
          style={{
            background: cd.ready ? GOLD : 'rgba(201,168,76,0.4)',
            color: BG,
            border: 'none',
            borderRadius: 2,
            padding: '13px 26px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: cd.ready ? 'pointer' : 'not-allowed',
            fontFamily: VAULT_BODY,
            opacity: cd.ready ? 1 : 0.7,
          }}
        >
          Take the Simulator
        </button>
      </div>

      <div className="sim-cd-right">
        <div
          style={{
            fontSize: 11,
            color: MUTED,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: 10,
            textAlign: 'center',
          }}
        >
          Retry Opens In
        </div>
        <div
          style={{
            fontFamily: "'Consolas', 'Menlo', monospace",
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            fontWeight: 700,
            color: GOLD,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'center',
          }}
        >
          {cd.display}
        </div>
      </div>
    </div>
  );
}

// Returns { ready, display }. While time remains, display is the
// countdown with zero-padded minutes ("17h 08m" over an hour, "42m"
// under). At or past the end timestamp, ready=true and display='Ready'.
function formatCooldownTimer(endsAt, nowMs) {
  if (!endsAt) return { ready: false, display: '' };
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return { ready: false, display: '' };
  if (end <= nowMs) return { ready: true, display: 'Ready' };
  const totalMs = end - nowMs;
  const hours = Math.floor(totalMs / (60 * 60 * 1000));
  const minutes = Math.floor((totalMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) {
    return { ready: false, display: `${hours}h ${String(minutes).padStart(2, '0')}m` };
  }
  if (minutes > 0) return { ready: false, display: `${minutes}m` };
  // Sub-minute remainder: show 1m rather than 0m while still in cooldown.
  return { ready: false, display: '1m' };
}

/* ============================================================
 * Simulator queue card (display-only; admission is driven elsewhere)
 * ============================================================ */

function QueuedCard({ position, reason, actionUrl, navigate }) {
  const hasPosition = typeof position === 'number' && position > 0;
  return (
    <div
      className="vault-up"
      style={{
        background: BG1,
        border: `1px solid ${BORDER2}`,
        borderLeft: `3px solid ${AMBER}`,
        borderRadius: 4,
        padding: '28px 32px',
        marginBottom: 28,
        fontFamily: VAULT_BODY,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: AMBER,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 14,
        }}
      >
        Waiting for an open line
      </div>
      <h2
        style={{
          fontFamily: VAULT_DISPLAY,
          fontSize: 28,
          fontWeight: 400,
          color: WHITE,
          margin: '0 0 12px',
          lineHeight: 1.15,
        }}
      >
        You are in the simulator queue
      </h2>
      {hasPosition && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: MUTED, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
            Position
          </span>
          <span
            style={{
              fontFamily: "'Consolas', 'Menlo', monospace",
              fontSize: 30,
              fontWeight: 700,
              color: GOLD,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {position}
          </span>
        </div>
      )}
      <p
        style={{
          fontSize: 14,
          color: 'rgba(238,233,223,0.76)',
          lineHeight: 1.7,
          margin: '0 0 22px',
          maxWidth: 720,
        }}
      >
        {reason ||
          'All simulator lines are busy right now. Reopen the simulator to take your place in line; we will connect you automatically when a line opens.'}
      </p>
      <button
        type="button"
        onClick={() => navigateNormalized(navigate, actionUrl || '/simulator?auto=true')}
        style={{
          background: GOLD,
          color: BG,
          border: 'none',
          borderRadius: 2,
          padding: '13px 26px',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          fontFamily: VAULT_BODY,
        }}
      >
        Return to Simulator
      </button>
    </div>
  );
}

/* ============================================================
 * Credential-revoked banner (small, non-hero, allows content below)
 * ============================================================ */

function RevokedBanner({ reason }) {
  return (
    <div
      role="alert"
      style={{
        background: 'rgba(196,92,92,0.07)',
        border: '1px solid rgba(196,92,92,0.32)',
        borderRadius: 3,
        padding: '14px 18px',
        marginBottom: 22,
        fontFamily: VAULT_BODY,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: RED,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Credential revoked
      </div>
      <div style={{ fontSize: 13, color: WHITE, lineHeight: 1.55 }}>
        {reason || 'Your credential has been revoked. Contact support for details.'}
      </div>
    </div>
  );
}

// Reference unused color tokens so lint stays clean. Part of the
// canonical palette; kept declared to mirror the per-file convention.
void TEAL2;
void BORDER;
void FAINT;
