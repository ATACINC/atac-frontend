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
 *   // result.verificationTier is 'none' or 'headshot' or 'verified'
 *   // result.headshotUrl is null or a gateway URL
 *   ...
 *   return (<>...{photo.modal}</>);
 *
 * Commit 2 shipped TIER_SELECT (headshot / none), PHOTO_CONSENT,
 * HEADSHOT_UPLOAD, and HEADSHOT_PREVIEW. Commit 3 adds the Verified
 * Identity tier, the STEP_HEADSHOT_DONE post-upload step, and the
 * uploadSelfie + patchTier API helpers consumed by SelfieCapture.jsx
 * at assessment start.
 *
 * Intended-tier vs backend-stored-tier architecture: when the candidate
 * selects 'verified', the modal calls patchTier('verified') after the
 * headshot upload succeeds. The backend gates 'verified' on selfie
 * presence and returns 400 SELFIE_REQUIRED. The modal accepts this
 * gracefully: backend tier stays 'headshot', candidate intent is
 * 'verified', and Dashboard.jsx persists the intent flag to
 * localStorage for SelfieCapture.jsx to read at assessment start.
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

// Uploads the selfie blob as multipart/form-data. Field key is 'file' to
// match upload.single('file') in backend/routes/photo.js (same field name
// as the headshot endpoint per the Commit 1 audit). Returns
// { selfieId, capturedAt } on success.
export async function uploadSelfie(blob) {
  const formData = new FormData();
  // Provide a filename so multer's mime sniffing is happy; JPEG matches the
  // canvas.toBlob('image/jpeg') output from SelfieCapture.captureSelfie().
  formData.append('file', blob, 'selfie.jpg');
  return apiPostMultipart('/api/photo/selfie', formData);
}

// C-2 Checkpoint 2: uploads a simulator-start selfie. Mirrors uploadSelfie
// exactly (field 'file', filename 'selfie.jpg') but posts to the
// simulator-bound endpoint. Backend is shadow mode: stores the selfie,
// runs identity checks fire-and-forget, blocks no one.
// Returns { selfieId, capturedAt, simulatorSessionId } on success.
export async function uploadSimulatorSelfie(blob) {
  const formData = new FormData();
  formData.append('file', blob, 'selfie.jpg');
  return apiPostMultipart('/api/photo/simulator-selfie', formData);
}

// C-2: records biometric consent against the existing /api/consent/accept
// endpoint. Mirrors postPhotoConsent exactly. The version string MUST be
// '1.0.0' to match the seeded ledger document; the backend identity-check
// gate requires an accepted biometric_consent record at exactly this
// version before it will run any face comparison.
export async function postBiometricConsent() {
  return apiPostJson('/api/consent/accept', {
    acceptances: [
      {
        documentKey: 'biometric_consent',
        version: '1.0.0',
        accepted: true,
      },
    ],
    context: 'profile',
  });
}

// Patches candidates.verification_tier via PATCH /api/photo/tier.
// Body: { verificationTier: 'none' | 'headshot' | 'verified' }
// Backend returns 400 SELFIE_REQUIRED if 'verified' is requested without a
// selfie on file. Callers handle that case explicitly (see SelfieCapture
// and PhotoVerificationModal). Same-tier PATCH is an intended no-op write.
export async function patchTier(verificationTier) {
  return apiPatchJson('/api/photo/tier', { verificationTier });
}

async function apiPatchJson(path, body) {
  const token = localStorage.getItem('atac_token');
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `PATCH ${path} failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
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
      postBiometricConsent={postBiometricConsent}
      uploadHeadshot={uploadHeadshot}
      patchTier={patchTier}
    />
  );

  return { ensure, modal, error: null };
}
