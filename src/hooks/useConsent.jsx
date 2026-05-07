/**
 * ATAC Platform - useConsent.jsx  (fetch-based)
 * Path: frontend/src/hooks/useConsent.jsx
 *
 * Usage:
 *   const consent = useConsent({ required: ['tos', 'privacy', 'refund', 'blockchain'] });
 *   const ok = await consent.ensure('checkout');
 *   if (!ok) return;
 *   ...
 *   return (<>...{consent.modal}</>);
 */

import React, { useState, useCallback, useRef } from 'react';
import ConsentModal from '../components/ConsentModal';

const API_BASE = import.meta.env.VITE_API_URL;

// Human-readable summaries shown in the "Show summary" expand.
// Exported so PhotoVerificationModal can render photo_consent inline
// without duplicating the body copy.
export const DOCUMENT_SUMMARIES = {
  tos: 'Governs your overall use of the ATAC Global CX platform. Covers account responsibility, acceptable use, intellectual property, limitation of liability, and dispute resolution via binding arbitration in Toronto with class action waiver.',
  privacy: 'Explains how we collect, use, and share your personal information across Canada (PIPEDA), the EU/UK (GDPR), and California (CCPA). Names our subprocessors (Stripe, Postmark, Alchemy, etc.) and outlines your rights including access, correction, and deletion requests.',
  refund: 'Our refund rules. Full refund within 48 hours if the assessment has not been started; non-refundable once started. Subscriptions cancellable anytime with access through billing period end.',
  blockchain: `On passing the assessment, the following data is permanently recorded as ERC-721 metadata pinned to IPFS and linked from a public Polygon Mainnet token: your full name, credential ID, program (CRSA), exact assessment score (overall percentage), issue date, expiry date, status, and the ATAC Global CX verification URL. The recipient wallet address is recorded on the on-chain Transfer event but is not in the pinned metadata.

What does NOT go on the blockchain or IPFS: your email address, individual question responses, time spent per question, payment information, IP address, or any device data. These remain in our private database under our Privacy Policy.

This record is permanent and publicly verifiable. By proceeding, you acknowledge and consent to this disclosure under consent version 1.1.0.`,
  candidate_agreement: 'The specific promises you make when taking an assessment: identity integrity, no cheating, no sharing of questions, and agreement that ATAC may revoke credentials for violations.',
  msa: 'Master Services Agreement for employers and BPOs purchasing team seats. Covers seat usage, data processing roles, hiring disclaimers, service levels, and dispute resolution with a mediation-first step.',
  dpa: 'Data Processing Addendum naming you (the employer) as Controller of candidate data and ATAC as Processor, with standard contractual clauses for EU/UK/California data.',
  cookies_analytics: 'Optional - allow ATAC to use analytics cookies to measure page performance and improve the platform.',
  cookies_marketing: 'Optional - allow marketing cookies used for retargeting and conversion tracking.',
  marketing_email: 'Optional - receive occasional emails about new certifications, platform updates, and industry content. You can unsubscribe anytime.',
  photo_consent: `By selecting a Headshot or Verified Identity tier, you authorize the following photo collection.

WHAT IS CAPTURED: For the Headshot tier, a profile photo you upload before starting your assessment. For the Verified Identity tier, the headshot above plus a selfie captured by your device camera at the moment your assessment begins.

WHERE IT IS STORED: The headshot is pinned to IPFS via Pinata. IPFS is a public content-addressable network, so the headshot is intentionally publicly retrievable, since it appears on your verify page and printed certificate. The selfie is stored only in our private database, never on a public network or third-party storage service.

WHO CAN ACCESS IT: The headshot is publicly accessible by design, since it appears on your public verify page. The selfie is accessible only to ATAC Global CX administrators, and to employers on a per-request basis when verifying a credential. The selfie is never publicly accessible.

RETENTION: Photos are retained for the lifetime of your credential. If your credential is revoked, the headshot's IPFS pin remains (we cannot remove it from the broader IPFS network) and the selfie remains in our database for fraud-investigation audit.

DELETION PATH: To request deletion, contact support@atacglobalcx.com. We will delete the selfie from our database within 30 days, and best-effort unpin the headshot from our Pinata account. The IPFS hash may persist on the wider network if cached by other nodes. Deletion does not retroactively change credentials already issued; their on-chain metadata remains unchanged.

CONSENT SCOPE: This consent applies only when you select a Headshot or Verified Identity tier. The 'none' tier requires no photo consent and remains available regardless.

DATA MINIMIZATION: We capture only what is necessary to support the selected tier. The 'none' tier requires no photos. The 'Headshot' tier requires only the headshot you upload. The 'Verified Identity' tier requires the headshot plus a single selfie at assessment start. We do not capture facial recognition data, biometric templates, or running camera feeds beyond the moment of selfie capture.

By proceeding, you acknowledge and consent to this disclosure under photo consent version 1.0.0.`,
};

// ---- Internal fetch helpers ---------------------------------------------
async function apiGet(path) {
  const token = localStorage.getItem('atac_token');
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `GET ${path} failed (${res.status})`);
  return data;
}

async function apiPost(path, body) {
  const token = localStorage.getItem('atac_token');
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `POST ${path} failed (${res.status})`);
  return data;
}

// ---- The hook -----------------------------------------------------------
export function useConsent({ required }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const pendingResolveRef = useRef(null);
  const currentContextRef = useRef(null);

  const ensure = useCallback(async (context = 'checkout') => {
    setError(null);
    currentContextRef.current = context;

    try {
      const status = await apiGet('/api/consent/status');

      if (status.allCurrent || status.missing.every(m => !required.includes(m))) {
        return true;
      }

      const docs = await apiGet('/api/consent/documents');

      const missingRequired = status.missing.filter(m => required.includes(m));
      const docsToShow = docs.documents
        .filter(d => missingRequired.includes(d.key))
        .map(d => ({
          key: d.key,
          version: d.version,
          title: d.title,
          url: d.url,
          description: DOCUMENT_SUMMARIES[d.key] || null,
        }));

      if (docsToShow.length === 0) {
        return true;
      }

      setDocuments(docsToShow);
      setModalOpen(true);

      return new Promise(resolve => {
        pendingResolveRef.current = resolve;
      });
    } catch (err) {
      console.error('[useConsent.ensure]', err);
      setError('Unable to verify consent status. Please try again.');
      return false;
    }
  }, [required]);

  const handleAccept = useCallback(async (acceptances) => {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/api/consent/accept', {
        acceptances,
        context: currentContextRef.current,
        locale: document.documentElement.lang || 'en',
      });
      setModalOpen(false);
      setSubmitting(false);
      if (pendingResolveRef.current) {
        pendingResolveRef.current(true);
        pendingResolveRef.current = null;
      }
    } catch (err) {
      setSubmitting(false);
      setError(err.message || 'Failed to record consent. Please try again.');
    }
  }, []);

  const handleCancel = useCallback(() => {
    setModalOpen(false);
    setError(null);
    if (pendingResolveRef.current) {
      pendingResolveRef.current(false);
      pendingResolveRef.current = null;
    }
  }, []);

  const modal = (
    <ConsentModal
      isOpen={modalOpen}
      documents={documents}
      mode={currentContextRef.current === 'registration' ? 'registration'
          : currentContextRef.current === 'reacceptance' ? 'reacceptance'
          : currentContextRef.current === 'employer_onboarding' ? 'employer_onboarding'
          : 'checkout'}
      onAccept={handleAccept}
      onCancel={handleCancel}
      submitting={submitting}
      error={error}
    />
  );

  return { ensure, modal, error };
}


