import { useEffect, useState } from 'react';
import API from '../api/client';
import { useToast } from '../hooks/useToast';

// Charter Cohort designation block for the candidate dashboard.
//
// Renders only when the credential's champion-status response indicates
// charter_cohort === true. Otherwise renders nothing.
//
// Inside the block: a Champion Drawing entry form with four states:
//   A. Not yet submitted    (linkedin_share_url is null)
//   B. Submitted, unverified (linkedin_share_url present, not verified)
//   C. Submitted and verified (champion_entry_verified === true)
//   D. Drawing closed        (current date >= July 15, 2026)
//
// Defensive: 404 on champion-status means the endpoint is not yet
// deployed OR the candidate is not a charter member; either way we
// render nothing so non-charter users see no false-positive UI.

const BG    = '#080B12';
const BG1   = '#0C1018';
const GOLD  = '#C9A84C';
const TEAL  = '#1A8F69';
const TEAL2 = '#22A67E';
const RED   = '#C45C5C';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const NAVY  = '#0D1B2E';
const BORDER2 = 'rgba(238,233,223,0.08)';
const FAINT = 'rgba(238,233,223,0.04)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const DRAWING_CLOSE_DATE = '2026-07-15';

export default function CharterCohortBlock({ credentialId }) {
  const { showToast } = useToast();

  const [status, setStatus] = useState(null);  // server response or null while loading
  const [loading, setLoading] = useState(true);
  const [endpointMissing, setEndpointMissing] = useState(false);

  // Entry form local state
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch champion-status on mount or when credentialId changes ──
  useEffect(() => {
    if (!credentialId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchStatus = async () => {
      setLoading(true);
      try {
        const res = await API.get(`/api/credentials/${credentialId}/champion-status`);
        if (cancelled) return;
        setStatus(res.data);
        setEndpointMissing(false);
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 404) {
          // Endpoint not deployed yet OR not a charter member; either
          // way, render nothing.
          setEndpointMissing(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [credentialId]);

  // Guard: don't render while loading, on 404, or for non-charter members
  if (loading || endpointMissing) return null;
  if (!status || status.charter_cohort !== true) return null;

  // ── State resolution ─────────────────────────────────────────────
  const position = status.charter_cohort_position;
  const linkedinShareUrl = status.linkedin_share_url || null;
  const entryVerified = status.champion_entry_verified === true;
  const isWinner = status.champion_winner === true;
  const submittedAt = status.submitted_at || status.champion_entry_submitted_at || null;
  const drawingClosed = new Date() >= new Date(DRAWING_CLOSE_DATE);

  let formState;
  if (drawingClosed) {
    formState = 'closed';
  } else if (!linkedinShareUrl) {
    formState = 'idle';
  } else if (entryVerified) {
    formState = 'verified';
  } else {
    formState = 'pending';
  }

  // ── Submit handler ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const trimmed = linkedinUrl.trim();
    if (!trimmed) {
      showToast('Please paste your LinkedIn post URL.', true);
      return;
    }
    if (!trimmed.startsWith('https://www.linkedin.com/')) {
      showToast('Link must start with https://www.linkedin.com/', true);
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      const res = await API.post(
        `/api/credentials/${credentialId}/champion-entry`,
        { linkedin_post_url: trimmed }
      );
      showToast('Entry submitted. Good luck!');
      // Optimistically reflect the new state so the form updates without
      // requiring a page refresh. Backend champion-status would do the
      // same on next fetch.
      setStatus((prev) => ({
        ...(prev || {}),
        linkedin_share_url: trimmed,
        champion_entry_verified: false,
        submitted_at: res?.data?.submitted_at || new Date().toISOString(),
      }));
      setLinkedinUrl('');
    } catch (err) {
      const httpStatus = err?.response?.status;
      if (httpStatus === 404) {
        showToast('Champion Drawing temporarily unavailable. Please try again in a few minutes.', true);
      } else {
        const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
        showToast(serverMsg || 'Could not submit entry. Please try again.', true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: BG1,
        border: `1px solid ${BORDER2}`,
        borderLeft: `4px solid ${GOLD}`,
        borderRadius: 8,
        padding: 24,
        fontFamily: VAULT_BODY,
        color: WHITE,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 12,
          color: GOLD,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 14,
        }}
      >
        CRSA Charter Cohort
      </div>

      {/* Position */}
      {position != null && (
        <div
          style={{
            fontFamily: VAULT_DISPLAY,
            fontSize: 32,
            fontWeight: 400,
            color: WHITE,
            lineHeight: 1.05,
            marginBottom: 12,
          }}
        >
          You are #{position} of 100
        </div>
      )}

      <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, margin: '0 0 22px' }}>
        You earned your CRSA before public-launch pricing. The Charter designation is permanent on your credential.
      </p>

      <div style={{ height: 1, background: BORDER2, margin: '16px 0 18px' }} />

      {/* Champion Drawing area */}
      <div
        style={{
          fontSize: 11,
          color: GOLD,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        Champion Drawing, July 15, 2026
      </div>

      {formState === 'idle' && (
        <>
          <p style={{ fontSize: 13, color: WHITE, lineHeight: 1.6, margin: '0 0 10px' }}>
            Post your credential on LinkedIn using the caption above, then paste your post URL here to enter the drawing.
          </p>
          <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.55, margin: '0 0 16px' }}>
            1 Champion: CRSA Pro upgrade plus $100 Amazon gift card. 4 Runners-up: $25 Amazon gift card each.
          </p>
          <form onSubmit={handleSubmit}>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="Paste your LinkedIn post URL"
              disabled={submitting}
              aria-label="LinkedIn post URL"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: FAINT,
                color: WHITE,
                border: `1px solid ${BORDER2}`,
                borderRadius: 2,
                padding: '13px 14px',
                fontSize: 14,
                fontFamily: VAULT_BODY,
                outline: 'none',
                marginBottom: 12,
                opacity: submitting ? 0.6 : 1,
              }}
            />
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: GOLD,
                color: NAVY,
                border: 'none',
                borderRadius: 2,
                padding: '13px 28px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: VAULT_BODY,
                opacity: submitting ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {submitting ? 'Submitting...' : 'Enter Drawing'}
            </button>
          </form>
        </>
      )}

      {(formState === 'pending' || formState === 'verified') && (
        <div
          style={{
            background: FAINT,
            border: `1px solid ${BORDER2}`,
            borderRadius: 4,
            padding: '16px 18px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: WHITE,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Entry Submitted
            </div>
            {formState === 'verified' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: TEAL,
                  border: `1px solid ${TEAL}`,
                  background: 'rgba(26,143,105,0.08)',
                  borderRadius: 999,
                  padding: '2px 9px',
                  fontWeight: 700,
                }}
              >
                <span aria-hidden="true">✓</span> Verified Entry
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: WHITE, lineHeight: 1.6, margin: '0 0 10px' }}>
            Your LinkedIn post is being reviewed. Winners will be announced July 15, 2026.
          </p>
          {linkedinShareUrl && (
            <p style={{ fontSize: 12, margin: '0 0 6px' }}>
              <a
                href={linkedinShareUrl}
                target="_blank"
                rel="noopener"
                style={{ color: GOLD, wordBreak: 'break-all' }}
              >
                {linkedinShareUrl}
              </a>
            </p>
          )}
          {submittedAt && (
            <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.04em' }}>
              {formatSubmissionTimestamp(submittedAt)}
            </div>
          )}
        </div>
      )}

      {formState === 'closed' && (
        <div
          style={{
            background: FAINT,
            border: `1px solid ${BORDER2}`,
            borderRadius: 4,
            padding: '16px 18px',
          }}
        >
          <p style={{ fontSize: 13, color: WHITE, lineHeight: 1.6, margin: 0 }}>
            Charter Cohort Drawing closed July 15, 2026.
          </p>
          {isWinner && (
            <div
              style={{
                marginTop: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: NAVY,
                background: GOLD,
                borderRadius: 999,
                padding: '4px 12px',
                fontWeight: 700,
              }}
            >
              <span aria-hidden="true">★</span> Champion Winner
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Format an ISO timestamp like "Submitted May 26, 2026 at 10:42 AM"
function formatSubmissionTimestamp(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timePart = d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `Submitted ${datePart} at ${timePart}`;
  } catch (_) {
    return '';
  }
}

// Reference unused tokens so lint stays clean. Part of the canonical
// Vault palette; kept declared to mirror the per-file convention.
void TEAL2;
void RED;
void BG;
