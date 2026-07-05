import { useEffect, useState } from 'react';
import API from '../api/client';
import CountUp from './CountUp';
import { color as ds, font as dsFont, radius as dsRadius } from '../designSystem/tokens';

// Charter Cohort live counter.
//
// Self-contained: fetches GET /api/cohort/charter/count on mount and
// polls every 60 seconds. Two visual variants:
//   - 'full'    standalone bordered card (use on /verify and /try)
//   - 'compact' slim inline bar (use embedded inside Dashboard)
//
// Defensive: if the backend endpoint 404s (e.g., pre-launch window
// before backend deploy), shows "Charter Cohort opens soon" instead
// of an error toast. Retry continues silently.

const BG    = '#080B12';
const BG1   = '#0C1018';
const GOLD  = '#C9A84C';
const TEAL  = '#1A8F69';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const NAVY  = '#0D1B2E';
const BORDER  = 'rgba(201,168,76,0.18)';
const BORDER2 = 'rgba(238,233,223,0.08)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const POLL_INTERVAL_MS = 60_000;
const TOTAL = 100;
const NEARLY_FULL_THRESHOLD = 90;

export default function CharterCounter({ variant = 'full' }) {
  const [data, setData] = useState(null);     // { issued, total, remaining, is_complete } | null
  const [loading, setLoading] = useState(true);
  const [endpointMissing, setEndpointMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const res = await API.get('/api/cohort/charter/count');
        if (cancelled) return;
        setData(res.data);
        setEndpointMissing(false);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 404) {
          setEndpointMissing(true);
        }
        setLoading(false);
      }
    };

    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // ── State resolution ────────────────────────────────────────────
  const issued = Number(data?.issued ?? 0);
  const total = Number(data?.total ?? TOTAL);
  const isComplete = !!data?.is_complete || issued >= total;
  const isNearlyFull = !isComplete && issued >= NEARLY_FULL_THRESHOLD;
  const pct = Math.max(0, Math.min(100, Math.round((issued / total) * 100)));

  // Reduced-motion-aware bar fill: start at 0 and transition to pct so the
  // gold fill animates in (~850ms) once the real count lands; reduced motion
  // (and the count-up) settle to the exact final value immediately.
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Animated case only drives barW (from 0 -> pct) via rAF so the CSS width
  // transition fires; reduced motion renders pct directly with no transition.
  const [barW, setBarW] = useState(0);
  useEffect(() => {
    if (loading || endpointMissing || isComplete || reducedMotion) return undefined;
    const id = requestAnimationFrame(() => setBarW(pct));
    return () => cancelAnimationFrame(id);
  }, [loading, endpointMissing, isComplete, pct, reducedMotion]);

  // A 404 from /api/cohort/charter/count is a transient backend condition
  // (e.g. a brief deploy gap). Hide the widget entirely rather than assert a
  // forward-looking state; the 60s poll keeps retrying and the counter
  // reappears the moment the endpoint answers again.
  if (endpointMissing) return null;

  // ── Compact variant ─────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <div
        style={{
          background: ds.panel,
          border: `1px solid ${ds.border}`,
          borderLeft: `3px solid ${ds.gold}`,
          borderRadius: dsRadius.card,
          padding: '14px 18px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          flexWrap: 'wrap',
          fontFamily: dsFont.body,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: ds.eyebrow,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          CRSA Charter Cohort
        </div>
        <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 12 }}>
          {loading ? (
            <span style={{ fontSize: 13, color: ds.muted }}>Loading...</span>
          ) : isComplete ? (
            <span style={{ fontSize: 13, color: ds.heading }}>
              Charter Cohort complete. CRSA available at $39 for everyone.
            </span>
          ) : (
            <>
              <div
                style={{
                  fontFamily: dsFont.display,
                  fontSize: 22,
                  color: isNearlyFull ? ds.gold : ds.heading,
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                <CountUp value={issued} duration={850} />
                <span style={{ color: ds.muted, fontSize: 14 }}> / {total}</span>
              </div>
              <div
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: 3,
                  background: ds.border,
                  borderRadius: 999,
                  overflow: 'hidden',
                  minWidth: 80,
                }}
              >
                <div
                  style={{
                    width: `${reducedMotion ? pct : barW}%`,
                    height: '100%',
                    background: ds.goldGrad,
                    transition: reducedMotion ? 'none' : 'width 0.85s cubic-bezier(0.22,1,0.36,1)',
                  }}
                />
              </div>
              <span style={{ fontSize: 11, color: ds.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Charter credentials issued
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Full variant ────────────────────────────────────────────────
  return (
    <div
      style={{
        background: BG1,
        border: `1px solid ${NAVY}`,
        borderRadius: 6,
        padding: '24px 28px',
        maxWidth: 560,
        margin: '24px auto',
        textAlign: 'center',
        fontFamily: VAULT_BODY,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: GOLD,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 14,
        }}
      >
        CRSA Charter Cohort
      </div>

      {loading ? (
        <div style={{ fontSize: 14, color: MUTED, padding: '14px 0' }}>
          Charter Cohort: loading...
        </div>
      ) : isComplete ? (
        <div style={{ fontSize: 15, color: WHITE, lineHeight: 1.55, padding: '12px 0' }}>
          Charter Cohort complete. CRSA available at $39 for everyone.
        </div>
      ) : (
        <>
          <div
            style={{
              fontFamily: VAULT_DISPLAY,
              fontSize: 48,
              color: isNearlyFull ? GOLD : WHITE,
              fontWeight: 400,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              marginBottom: 8,
            }}
          >
            {issued}<span style={{ color: MUTED, fontSize: 22 }}> of {total}</span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            Charter credentials issued
          </div>
          <div
            aria-hidden="true"
            style={{
              height: 4,
              background: BORDER2,
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: GOLD,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// Reference unused tokens so lint doesn't flag them. These are part of
// the canonical Vault palette imported per file convention; keeping
// them declared keeps the file aligned with the rest of the codebase.
void TEAL;
void BG;
