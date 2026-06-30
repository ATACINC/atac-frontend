/**
 * ATAC Platform — ConsentModal.jsx
 * Path: frontend/src/components/ConsentModal.jsx
 *
 * Reusable modal that collects explicit per-document consent.
 * Used by:
 *   - Checkout flow (Payment.jsx) — BEFORE creating Stripe session
 *   - Post-login re-acceptance (App.jsx top-level) — when docs have been updated
 *   - Employer portal onboarding (EmployerPortal.jsx) — MSA + Privacy + Refund
 *
 * Re-skinned onto the redesign system (src/designSystem tokens + foundation)
 * and the shared ModalShell primitive. VISUAL ONLY: the props, the per-document
 * consent state, the all-four-required gate, the acceptances shape sent to the
 * caller, and the advance-to-payment behavior are unchanged.
 *
 * Dismissal is intentionally preserved: this modal is NON-dismissable by
 * backdrop/Esc (all required consents must be accepted, or the flow Cancelled).
 * ModalShell is therefore mounted with closeOnEsc={false} closeOnBackdrop={false}
 * so neither path can bypass the gate; onClose maps to the existing onCancel,
 * and the Cancel button remains the only user-initiated close.
 *
 * Props:
 *   isOpen         : boolean
 *   documents      : [ { key, version, title, url, description } ]  — required array
 *   mode           : 'checkout' | 'registration' | 'reacceptance' | 'employer_onboarding'
 *   onAccept       : (acceptances) => Promise  — caller persists via /api/consent/accept
 *   onCancel       : () => void                 — close without accepting
 *   submitting     : boolean
 *   error          : string | null
 */

import { useState, useMemo } from 'react';
import ModalShell from './chrome/ModalShell';
import { color as ds, font as dsFont, radius as dsRadius, goldButton } from '../designSystem/tokens';

export default function ConsentModal({
  isOpen,
  documents = [],
  mode = 'checkout',
  onAccept,
  onCancel,
  submitting = false,
  error = null,
}) {
  // checked[docKey] = boolean
  const [checked, setChecked] = useState({});
  // which doc has its full text expanded
  const [expandedKey, setExpandedKey] = useState(null);

  const allChecked = useMemo(
    () => documents.length > 0 && documents.every(d => checked[d.key]),
    [documents, checked]
  );

  const toggle = (key) => {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAccept = () => {
    if (!allChecked || submitting) return;
    const acceptances = documents.map(d => ({
      documentKey: d.key,
      version: d.version,
      accepted: true,
    }));
    onAccept(acceptances);
  };

  const heading = {
    checkout:            'Before You Continue to Payment',
    registration:        'Accept Our Terms to Create Your Account',
    reacceptance:        'Our Legal Terms Have Been Updated',
    employer_onboarding: 'Employer Agreement Required',
  }[mode];

  const subheading = {
    checkout:            'Please review and accept each of the following before completing your purchase. Each is a separate agreement. We present them individually so your consent is informed and specific.',
    registration:        'Four separate agreements govern your use of ATAC Global CX. Please review each one before accepting.',
    reacceptance:        'We have updated one or more of our legal documents. Please review and accept the current versions before continuing.',
    employer_onboarding: 'As an employer purchasing seats on behalf of your team, you must accept the Master Services Agreement and supporting terms.',
  }[mode];

  const acceptLabel = mode === 'checkout' ? 'Accept & Continue to Payment' : 'Accept All';

  return (
    // closeOnEsc / closeOnBackdrop false: required-consent gate — no backdrop/Esc
    // bypass. onClose maps only to the existing Cancel action.
    <ModalShell
      open={isOpen}
      onClose={onCancel}
      labelledBy="consent-heading"
      closeOnEsc={false}
      closeOnBackdrop={false}
    >
      <div style={{ padding: '34px 36px', fontFamily: dsFont.body, color: ds.body }}>

        {/* ── Header ── */}
        <div className="ds-eyebrow" style={{ marginBottom: 12 }}>ATAC GLOBAL CX · LEGAL CONSENT</div>
        <h2 id="consent-heading" style={{ fontFamily: dsFont.display, fontSize: 28, fontWeight: 500, color: ds.heading, margin: '0 0 12px', lineHeight: 1.15 }}>
          {heading}
        </h2>
        <p style={{ fontSize: 14, color: ds.body, lineHeight: 1.6, margin: '0 0 22px' }}>{subheading}</p>

        {/* ── Documents list ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
          {documents.map(doc => {
            const isChecked = !!checked[doc.key];
            const isExpanded = expandedKey === doc.key;

            return (
              <div
                key={doc.key}
                style={{
                  background: ds.panel,
                  border: `1px solid ${isChecked ? 'rgba(239,192,60,0.45)' : ds.border}`,
                  borderRadius: dsRadius.sm,
                  padding: '18px 20px',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Row: checkbox + title + version + open-full-text + show-summary */}
                <label style={{ display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(doc.key)}
                    disabled={submitting}
                    style={{ width: 18, height: 18, marginTop: 3, accentColor: ds.gold, cursor: 'pointer', flexShrink: 0 }}
                    aria-describedby={`desc-${doc.key}`}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ color: ds.heading, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{doc.title}</div>
                    <div style={{ color: ds.muted, fontSize: 12 }}>
                      Version {doc.version}
                      {doc.url && (
                        <>
                          {' · '}
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: ds.gold, textDecoration: 'none', borderBottom: '1px solid rgba(239,192,60,0.4)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open full text ↗
                          </a>
                        </>
                      )}
                      {doc.description && (
                        <>
                          {' · '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setExpandedKey(isExpanded ? null : doc.key);
                            }}
                            style={{ background: 'transparent', border: 'none', color: ds.gold, cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: dsFont.body, textDecoration: 'underline' }}
                          >
                            {isExpanded ? 'Hide summary' : 'Show summary'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </label>

                {/* Expandable in-modal summary */}
                {isExpanded && doc.description && (
                  <div
                    id={`desc-${doc.key}`}
                    style={{
                      marginTop: 14, padding: '14px 16px',
                      background: 'rgba(239,192,60,0.04)', border: `1px solid ${ds.border}`,
                      borderRadius: dsRadius.sm, color: ds.body, fontSize: 13, lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {doc.description}
                  </div>
                )}

                {/* Attestation label under each accepted doc — legal-grade specificity */}
                {isChecked && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,192,60,0.08)', borderLeft: `2px solid ${ds.gold}`, color: ds.heading, fontSize: 12, fontStyle: 'italic' }}>
                    ✓ I have read and agree to the {doc.title} (v{doc.version}).
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Error ── */}
        {error && (
          <div role="alert" style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(229,72,77,0.10)', border: `1px solid ${ds.red}`, color: ds.redText, fontSize: 13, borderRadius: dsRadius.sm }}>
            {error}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ borderTop: `1px solid ${ds.border}`, paddingTop: 18 }}>
          <div style={{ fontSize: 11, color: ds.muted2, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 16 }}>
            A record of your acceptance (including timestamp and IP address) is stored for compliance and dispute resolution.
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                style={{
                  background: 'transparent', border: `1px solid ${ds.border}`, color: ds.body,
                  borderRadius: dsRadius.sm, padding: '13px 20px', fontFamily: dsFont.body, fontSize: 13,
                  fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleAccept}
              disabled={!allChecked || submitting}
              style={{
                ...goldButton,
                opacity: allChecked && !submitting ? 1 : 0.45,
                cursor: allChecked && !submitting ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'Recording…' : acceptLabel}
            </button>
          </div>
        </div>

      </div>
    </ModalShell>
  );
}
