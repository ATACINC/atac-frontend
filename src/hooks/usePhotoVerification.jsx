/**
 * ATAC Platform - usePhotoVerification.jsx
 * Path: frontend/src/hooks/usePhotoVerification.jsx
 *
 * Photo verification gate for Dashboard.startAssessment.
 * Mirrors the useConsent.jsx contract:
 *
 *   const photo = usePhotoVerification();
 *   const result = await photo.ensure();
 *   if (!result) return; // user cancelled
 *   // result.verificationTier is 'none' or 'headshot'
 *   // result.headshotUrl is null or a gateway URL
 *   ...
 *   return (<>...{photo.modal}</>);
 *
 * Commit 2 of 3 ships TIER_SELECT, PHOTO_CONSENT, HEADSHOT_UPLOAD,
 * and HEADSHOT_PREVIEW. The Verified Identity tier and selfie steps
 * land in Commit 3.
 */

import { useState, useCallback, useRef } from 'react';
import PhotoVerificationModal from '../components/PhotoVerificationModal';

const API_BASE = import.meta.env.VITE_API_URL;

// ----- API helpers (raw fetch, mirrors useConsent's apiPost pattern) ------

async function apiPostJson(path, body) {
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
  if (!res.ok) {
    const err = new Error(data.error || `POST ${path} failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function apiPostMultipart(path, formData) {
  const token = localStorage.getItem('atac_token');
  // Intentionally omit Content-Type so the browser sets the multipart
  // boundary automatically. Setting it manually would clobber the
  // boundary parameter and the server would reject the body.
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `POST ${path} failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ----- Public callable wrappers (passed to the modal as props) ------------

// Records photo consent against the existing /api/consent/accept endpoint.
// Uses the array shape that matches the verified Phase 1 production contract.
export async function postPhotoConsent() {
  return apiPostJson('/api/consent/accept', {
    acceptances: [
      {
        documentKey: 'photo_consent',
        version: '1.0.0',
        accepted: true,
      },
    ],
    context: 'profile',
  });
}

// Uploads the headshot file as multipart/form-data. Field key is 'file'
// to match upload.single('file') in backend/routes/photo.js.
// Returns { ipfsUri, gatewayUrl, ... } on success.
export async function uploadHeadshot(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiPostMultipart('/api/photo/headshot', formData);
}

// ----- The hook -----------------------------------------------------------

export function usePhotoVerification() {
  const [modalOpen, setModalOpen] = useState(false);
  const pendingResolveRef = useRef(null);

  const ensure = useCallback(() => {
    setModalOpen(true);
    return new Promise((resolve) => {
      pendingResolveRef.current = resolve;
    });
  }, []);

  // Modal calls this when it terminates: success, no-photo selection, or
  // cancellation. Single resolve path keeps callers simple.
  const handleResolve = useCallback((result) => {
    setModalOpen(false);
    if (pendingResolveRef.current) {
      pendingResolveRef.current(result);
      pendingResolveRef.current = null;
    }
  }, []);

  const modal = (
    <PhotoVerificationModal
      isOpen={modalOpen}
      onResolve={handleResolve}
      postConsent={postPhotoConsent}
      uploadHeadshot={uploadHeadshot}
    />
  );

  return { ensure, modal, error: null };
}
