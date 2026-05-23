import { useState } from 'react';
import API from '../api/client';

// Post-assessment candidate feedback panel.
//
// Renders inline beneath the existing results content on the assessment
// results screen (Assessment.jsx phase === 'result' render branch).
//
// Design decisions (operator-locked, Phase 2 feedback rollout):
//   C1  inline panel, no modal, no new route
//   D3  progressive disclosure (4 ratings + recommend visible by
//       default; two text fields revealed via expander)
//   E1  on submit, the panel collapses to a thank-you line in place;
//       user stays on the results screen
//
// 409 from POST /api/feedback/assessment is treated identically to 201
// (Option B) so a refreshed page that re-renders this panel resolves
// to the success state instantly.

/* ── Vault Design Tokens (per-file convention) ─────────────────── */
const BG    = '#080B12';
const BG1   = '#0C1018';
const GOLD  = '#C9A84C';
const RED   = '#C45C5C';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const UI_NOTES_MAX = 2000;
const FREE_TEXT_MAX = 5000;

const RATING_QUESTIONS = [
  {
    key: 'difficultyRating',
    label: 'How difficult was the assessment?',
    leftAnchor: 'Too easy',
    rightAnchor: 'Too hard',
  },
  {
    key: 'clarityRating',
    label: 'How clear were the questions?',
    leftAnchor: 'Unclear',
    rightAnchor: 'Very clear',
  },
  {
    key: 'timePressureRating',
    label: 'Did the timer feel fair?',
    leftAnchor: 'Too rushed',
    rightAnchor: 'Plenty of time',
  },
  {
    key: 'fairnessRating',
    label: 'Did the content feel fair for remote CX?',
    leftAnchor: 'Disconnected',
    rightAnchor: 'Right on target',
  },
];

export default function FeedbackPanel({ assessmentId, source = 'pioneer' }) {
  // Guard: render nothing if we have no assessment to feed back on.
  if (!assessmentId) return null;

  // status: 'idle' | 'submitting' | 'success'
  // (409 duplicate collapses straight to 'success' per Option B.)
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const [ratings, setRatings] = useState({
    difficultyRating: null,
    clarityRating: null,
    timePressureRating: null,
    fairnessRating: null,
  });
  const [wouldRecommend, setWouldRecommend] = useState(null); // null | true | false

  const [expanderOpen, setExpanderOpen] = useState(false);
  const [uiFrictionNotes, setUiFrictionNotes] = useState('');
  const [freeText, setFreeText] = useState('');

  const allRatingsAnswered = Object.values(ratings).every((r) => r !== null);
  const canSubmit = allRatingsAnswered && wouldRecommend !== null;

  const handleSubmit = async () => {
    if (!canSubmit || status === 'submitting') return;
    setStatus('submitting');
    setErrorMsg('');

    const payload = {
      assessmentId,
      difficultyRating: ratings.difficultyRating,
      clarityRating: ratings.clarityRating,
      timePressureRating: ratings.timePressureRating,
      fairnessRating: ratings.fairnessRating,
      wouldRecommend,
      uiFrictionNotes: uiFrictionNotes.trim() || null,
      freeText: freeText.trim() || null,
      source,
    };

    try {
      await API.post('/api/feedback/assessment', payload);
      setStatus('success');
    } catch (err) {
      const httpStatus = err?.response?.status;
      if (httpStatus === 409) {
        // Duplicate. Per Option B, treat identically to success.
        setStatus('success');
        return;
      }
      if (httpStatus === 400) {
        const serverMsg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          'Validation failed.';
        setErrorMsg(`Could not submit feedback. ${serverMsg} Please try again.`);
        setStatus('idle');
        return;
      }
      console.error('[FeedbackPanel] submit failed', err);
      setErrorMsg('Could not submit feedback. Please try again.');
      setStatus('idle');
    }
  };

  /* ── Success state replaces the entire panel body ────────────── */
  if (status === 'success') {
    return (
      <div
        style={{
          marginTop: 28,
          background: BG1,
          border: `1px solid ${BORDER}`,
          borderRadius: 4,
          padding: '28px 30px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: GOLD,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            marginBottom: 12,
            fontFamily: VAULT_BODY,
          }}
        >
          Feedback
        </div>
        <div
          style={{
            fontFamily: VAULT_DISPLAY,
            fontStyle: 'italic',
            fontSize: 22,
            color: WHITE,
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          <span style={{ color: GOLD, marginRight: 10 }}>✓</span>
          Thanks for the feedback.
        </div>
        <div
          style={{
            fontFamily: VAULT_BODY,
            fontSize: 13,
            color: MUTED,
            lineHeight: 1.6,
            marginTop: 6,
          }}
        >
          It helps us improve.
        </div>
      </div>
    );
  }

  /* ── Idle / submitting / error state ─────────────────────────── */
  const submitting = status === 'submitting';

  return (
    <div
      style={{
        marginTop: 28,
        background: BG1,
        border: `1px solid ${BORDER}`,
        borderRadius: 4,
        padding: '32px 34px',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 11,
          color: GOLD,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          marginBottom: 14,
          fontFamily: VAULT_BODY,
        }}
      >
        Feedback
      </div>
      <h2
        style={{
          fontFamily: VAULT_DISPLAY,
          fontSize: 30,
          fontWeight: 400,
          color: WHITE,
          margin: '0 0 10px',
          lineHeight: 1.15,
        }}
      >
        Help us improve the assessment.
      </h2>
      <p
        style={{
          fontFamily: VAULT_BODY,
          fontSize: 14,
          color: MUTED,
          lineHeight: 1.6,
          margin: '0 0 24px',
        }}
      >
        Your feedback shapes future versions. 60 seconds.
      </p>

      <div style={{ borderTop: `1px solid ${BORDER2}`, marginBottom: 22 }} />

      {/* Rating questions */}
      {RATING_QUESTIONS.map((q) => (
        <RatingScale
          key={q.key}
          label={q.label}
          leftAnchor={q.leftAnchor}
          rightAnchor={q.rightAnchor}
          value={ratings[q.key]}
          onChange={(n) => setRatings((r) => ({ ...r, [q.key]: n }))}
          disabled={submitting}
        />
      ))}

      <div style={{ borderTop: `1px solid ${BORDER2}`, margin: '8px 0 22px' }} />

      {/* Would-recommend */}
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            fontFamily: VAULT_BODY,
            fontSize: 11,
            color: MUTED,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          Would you recommend this assessment to a peer?
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <RecommendButton
            label="Yes, I would"
            selected={wouldRecommend === true}
            onClick={() => setWouldRecommend(true)}
            disabled={submitting}
          />
          <RecommendButton
            label="No, not yet"
            selected={wouldRecommend === false}
            onClick={() => setWouldRecommend(false)}
            disabled={submitting}
          />
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${BORDER2}`, marginBottom: 18 }} />

      {/* Expander for optional text fields */}
      <div style={{ marginBottom: 22 }}>
        <button
          type="button"
          onClick={() => setExpanderOpen((v) => !v)}
          aria-expanded={expanderOpen}
          disabled={submitting}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '6px 0',
            cursor: submitting ? 'not-allowed' : 'pointer',
            color: GOLD,
            fontFamily: VAULT_BODY,
            fontSize: 13,
            letterSpacing: '0.04em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            opacity: submitting ? 0.5 : 1,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              transition: 'transform 0.18s ease',
              transform: expanderOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            ▸
          </span>
          {expanderOpen ? 'Hide written feedback' : 'Add written feedback (optional)'}
        </button>

        {expanderOpen && (
          <div style={{ marginTop: 14, display: 'grid', gap: 18 }}>
            <FieldGroup
              id="feedback-ui-friction"
              label="What felt clunky or confusing in the interface?"
              value={uiFrictionNotes}
              onChange={setUiFrictionNotes}
              maxLength={UI_NOTES_MAX}
              placeholder="Optional. UI friction, broken flows, anything that tripped you up."
              disabled={submitting}
            />
            <FieldGroup
              id="feedback-free-text"
              label="Anything else you would like us to know?"
              value={freeText}
              onChange={setFreeText}
              maxLength={FREE_TEXT_MAX}
              placeholder="Optional. General feedback, suggestions, what worked."
              disabled={submitting}
            />
          </div>
        )}
      </div>

      {/* Submit */}
      <div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          aria-disabled={!canSubmit || submitting}
          style={{
            background: !canSubmit || submitting ? 'rgba(201,168,76,0.4)' : GOLD,
            color: BG,
            border: 'none',
            borderRadius: 2,
            padding: '13px 28px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
            fontFamily: VAULT_BODY,
            opacity: !canSubmit && !submitting ? 0.55 : 1,
            transition: 'opacity 0.15s, background 0.15s',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>

        {errorMsg && (
          <div
            role="alert"
            style={{
              marginTop: 14,
              padding: '10px 12px',
              background: 'rgba(196,92,92,0.06)',
              border: '1px solid rgba(196,92,92,0.28)',
              borderRadius: 3,
              color: RED,
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: VAULT_BODY,
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function RatingScale({ label, leftAnchor, rightAnchor, value, onChange, disabled }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontFamily: VAULT_BODY,
          fontSize: 11,
          color: MUTED,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          marginBottom: 10,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <RatingButton
              key={n}
              n={n}
              selected={value === n}
              onClick={() => onChange(n)}
              disabled={disabled}
            />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 10,
            color: MUTED,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: VAULT_BODY,
          }}
        >
          <span>{leftAnchor}</span>
          <span style={{ color: 'rgba(238,233,223,0.25)' }}>|</span>
          <span>{rightAnchor}</span>
        </div>
      </div>
    </div>
  );
}

function RatingButton({ n, selected, onClick, disabled }) {
  const base = {
    width: 38,
    height: 38,
    borderRadius: 3,
    fontFamily: VAULT_BODY,
    fontSize: 13,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
    opacity: disabled ? 0.6 : 1,
  };
  const selectedStyle = {
    background: GOLD,
    color: BG,
    border: `1px solid ${GOLD}`,
  };
  const idleStyle = {
    background: 'transparent',
    color: MUTED,
    border: `1px solid ${MUTED}`,
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Rating: ${n} out of 5`}
      aria-pressed={selected}
      onMouseEnter={(e) => {
        if (!selected && !disabled) {
          e.currentTarget.style.color = WHITE;
          e.currentTarget.style.borderColor = WHITE;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected && !disabled) {
          e.currentTarget.style.color = MUTED;
          e.currentTarget.style.borderColor = MUTED;
        }
      }}
      style={{ ...base, ...(selected ? selectedStyle : idleStyle) }}
    >
      {n}
    </button>
  );
}

function RecommendButton({ label, selected, onClick, disabled }) {
  const base = {
    padding: '11px 22px',
    borderRadius: 3,
    fontFamily: VAULT_BODY,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
    opacity: disabled ? 0.6 : 1,
  };
  const selectedStyle = {
    background: GOLD,
    color: BG,
    border: `1px solid ${GOLD}`,
  };
  const idleStyle = {
    background: 'transparent',
    color: MUTED,
    border: `1px solid ${MUTED}`,
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      onMouseEnter={(e) => {
        if (!selected && !disabled) {
          e.currentTarget.style.color = WHITE;
          e.currentTarget.style.borderColor = WHITE;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected && !disabled) {
          e.currentTarget.style.color = MUTED;
          e.currentTarget.style.borderColor = MUTED;
        }
      }}
      style={{ ...base, ...(selected ? selectedStyle : idleStyle) }}
    >
      {label}
    </button>
  );
}

function FieldGroup({ id, label, value, onChange, maxLength, placeholder, disabled }) {
  const charCount = value.length;
  const tooLong = charCount > maxLength;
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontFamily: VAULT_BODY,
          fontSize: 11,
          color: MUTED,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        rows={4}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: BG,
          color: WHITE,
          border: `1px solid ${tooLong ? RED : BORDER2}`,
          borderRadius: 3,
          padding: '12px 14px',
          fontSize: 13,
          fontFamily: VAULT_BODY,
          lineHeight: 1.55,
          resize: 'vertical',
          outline: 'none',
          opacity: disabled ? 0.6 : 1,
        }}
      />
      <div
        style={{
          textAlign: 'right',
          fontSize: 10,
          color: tooLong ? RED : MUTED,
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: VAULT_BODY,
        }}
      >
        {charCount} / {maxLength}
      </div>
    </div>
  );
}

