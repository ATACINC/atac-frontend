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
 * Vault design system: black/gold/ivory, Cormorant Garamond headings,
 * SF Mono for technical IDs, generous spacing.
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

import React, { useState, useMemo } from 'react';

const VAULT_BG         = '#0B0B0C';
const VAULT_CARD       = '#141416';
const VAULT_BORDER     = 'rgba(200, 164, 75, 0.25)';
const VAULT_BORDER_LIT = 'rgba(200, 164, 75, 0.6)';
const GOLD             = '#C8A44B';
const GOLD_DIM         = '#8C7234';
const WHITE            = '#F5F2EA';
const MUTED            = '#9A928A';
const RED              = '#D04848';

const VAULT_HEADING = '"Cormorant Garamond", Georgia, serif';
const VAULT_BODY    = '"Inter", -apple-system, system-ui, sans-serif';
const VAULT_MONO    = 'SF Mono, Consolas, monospace';

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

  if (!isOpen) return null;

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
    checkout:            'Please review and accept each of the following before completing your purchase. Each is a separate agreement — we present them individually so your consent is informed and specific.',
    registration:        'Four separate agreements govern your use of ATAC Global CX. Please review each one before accepting.',
    reacceptance:        'We have updated one or more of our legal documents. Please review and accept the current versions before continuing.',
    employer_onboarding: 'As an employer purchasing seats on behalf of your team, you must accept the Master Services Agreement and supporting terms.',
  }[mode];

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="consent-heading">

        {/* ═══ HEADER ═══ */}
        <div style={styles.header}>
          <div style={styles.eyebrow}>ATAC GLOBAL CX · LEGAL CONSENT</div>
          <h2 id="consent-heading" style={styles.heading}>{heading}</h2>
          <p style={styles.subheading}>{subheading}</p>
        </div>

        {/* ═══ DOCUMENTS LIST ═══ */}
        <div style={styles.documentsWrap}>
          {documents.map(doc => {
            const isChecked = !!checked[doc.key];
            const isExpanded = expandedKey === doc.key;

            return (
              <div key={doc.key} style={{
                ...styles.docCard,
                borderColor: isChecked ? VAULT_BORDER_LIT : VAULT_BORDER,
              }}>

                {/* Row: checkbox + title + version + expand */}
                <label style={styles.docRow}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(doc.key)}
                    disabled={submitting}
                    style={styles.checkbox}
                    aria-describedby={`desc-${doc.key}`}
                  />

                  <div style={styles.docMeta}>
                    <div style={styles.docTitle}>{doc.title}</div>
                    <div style={styles.docVersion}>
                      Version {doc.version}
                      {doc.url && (
                        <>
                          {' · '}
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.docLink}
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
                            style={styles.expandBtn}
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
                  <div id={`desc-${doc.key}`} style={styles.description}>
                    {doc.description}
                  </div>
                )}

                {/* Attestation label under each doc — legal-grade specificity */}
                {isChecked && (
                  <div style={styles.attestation}>
                    ✓ I have read and agree to the {doc.title} (v{doc.version}).
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ═══ ERROR ═══ */}
        {error && (
          <div style={styles.errorBox}>{error}</div>
        )}

        {/* ═══ FOOTER ═══ */}
        <div style={styles.footer}>
          <div style={styles.footerNote}>
            A record of your acceptance (including timestamp and IP address) is stored for compliance and dispute resolution.
          </div>

          <div style={styles.actions}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                style={styles.cancelBtn}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleAccept}
              disabled={!allChecked || submitting}
              style={{
                ...styles.acceptBtn,
                opacity: allChecked && !submitting ? 1 : 0.4,
                cursor: allChecked && !submitting ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'Recording…' : mode === 'checkout' ? 'Accept & Continue to Payment' : 'Accept All'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
const styles = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px', fontFamily: VAULT_BODY,
  },
  modal: {
    background: VAULT_CARD, border: `1px solid ${VAULT_BORDER}`,
    borderRadius: 6, maxWidth: 720, width: '100%', maxHeight: '92vh',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    boxShadow: '0 40px 120px rgba(0,0,0,0.7)',
  },
  header: {
    padding: '36px 40px 20px',
    borderBottom: `1px solid ${VAULT_BORDER}`,
  },
  eyebrow: {
    fontSize: 11, letterSpacing: '0.18em', color: GOLD,
    textTransform: 'uppercase', marginBottom: 12, fontWeight: 500,
  },
  heading: {
    fontFamily: VAULT_HEADING, fontSize: 28, fontWeight: 500,
    color: WHITE, margin: '0 0 14px', lineHeight: 1.15,
  },
  subheading: {
    fontSize: 14, color: MUTED, lineHeight: 1.6, margin: 0,
  },
  documentsWrap: {
    padding: '24px 40px', overflowY: 'auto', flex: 1,
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  docCard: {
    background: VAULT_BG, border: '1px solid',
    borderRadius: 4, padding: '18px 20px', transition: 'border-color 150ms',
  },
  docRow: {
    display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer',
  },
  checkbox: {
    width: 18, height: 18, marginTop: 3, accentColor: GOLD,
    cursor: 'pointer', flexShrink: 0,
  },
  docMeta: { flex: 1 },
  docTitle: {
    color: WHITE, fontSize: 15, fontWeight: 500, marginBottom: 4,
  },
  docVersion: {
    color: MUTED, fontSize: 12, fontFamily: VAULT_MONO,
  },
  docLink: {
    color: GOLD, textDecoration: 'none', borderBottom: `1px solid ${GOLD_DIM}`,
  },
  expandBtn: {
    background: 'transparent', border: 'none', color: GOLD,
    cursor: 'pointer', padding: 0, fontSize: 12,
    fontFamily: VAULT_MONO, textDecoration: 'underline',
  },
  description: {
    marginTop: 14, padding: '14px 16px',
    background: 'rgba(200,164,75,0.04)', border: `1px solid ${VAULT_BORDER}`,
    borderRadius: 3, color: MUTED, fontSize: 13, lineHeight: 1.6,
  },
  attestation: {
    marginTop: 10, padding: '8px 12px',
    background: 'rgba(200,164,75,0.08)', borderLeft: `2px solid ${GOLD}`,
    color: WHITE, fontSize: 12, fontStyle: 'italic',
  },
  errorBox: {
    margin: '0 40px 16px', padding: '12px 16px',
    background: 'rgba(208,72,72,0.1)', border: `1px solid ${RED}`,
    color: RED, fontSize: 13, borderRadius: 3,
  },
  footer: {
    padding: '20px 40px 28px',
    borderTop: `1px solid ${VAULT_BORDER}`,
    background: 'rgba(0,0,0,0.3)',
  },
  footerNote: {
    fontSize: 11, color: MUTED, fontStyle: 'italic',
    lineHeight: 1.5, marginBottom: 16,
  },
  actions: {
    display: 'flex', gap: 12, justifyContent: 'flex-end',
  },
  cancelBtn: {
    background: 'transparent', border: `1px solid ${VAULT_BORDER}`,
    color: MUTED, padding: '12px 22px', fontSize: 13,
    fontFamily: VAULT_BODY, cursor: 'pointer', borderRadius: 3,
    letterSpacing: '0.04em',
  },
  acceptBtn: {
    background: GOLD, border: 'none', color: '#0B0B0C',
    padding: '12px 26px', fontSize: 13, fontWeight: 600,
    fontFamily: VAULT_BODY, borderRadius: 3,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    transition: 'opacity 150ms',
  },
};
