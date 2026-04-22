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

// Human-readable summaries shown in the "Show summary" expand
const DOCUMENT_SUMMARIES = {
  tos: 'Governs your overall use of the ATAC Global CX platform. Covers account responsibility, acceptable use, intellectual property, limitation of liability, and dispute resolution via binding arbitration in Toronto with class action waiver.',
  privacy: 'Explains how we collect, use, and share your personal information across Canada (PIPEDA), the EU/UK (GDPR), and California (CCPA). Names our subprocessors (Stripe, Postmark, Alchemy, etc.) and outlines your rights including access, correction, and deletion requests.',
  refund: 'Our refund rules. Full refund within 48 hours if the assessment has not been started; non-refundable once started. Subscriptions cancellable anytime with access through billing period end.',
  blockchain: 'Critical disclosure about your credential record. On passing, a minimum record (credential ID, program, score band, wallet identifier) is written permanently to the Polygon blockchain and cannot be deleted. Your name and email are NOT written on-chain.',
  candidate_agreement: 'The specific promises you make when taking an assessment: identity integrity, no cheating, no sharing of questions, and agreement that ATAC may revoke credentials for violations.',
  msa: 'Master Services Agreement for employers and BPOs purchasing team seats. Covers seat usage, data processing roles, hiring disclaimers, service levels, and dispute resolution with a mediation-first step.',
  dpa: 'Data Processing Addendum naming you (the employer) as Controller of candidate data and ATAC as Processor, with standard contractual clauses for EU/UK/California data.',
  cookies_analytics: 'Optional - allow ATAC to use analytics cookies to measure page performance and improve the platform.',
  cookies_marketing: 'Optional - allow marketing cookies used for retargeting and conversion tracking.',
  marketing_email: 'Optional - receive occasional emails about new certifications, platform updates, and industry content. You can unsubscribe anytime.',
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
