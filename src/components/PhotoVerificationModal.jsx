/**
 * ATAC Platform - PhotoVerificationModal.jsx
 * Path: frontend/src/components/PhotoVerificationModal.jsx
 *
 * Single monolithic modal driving the photo verification flow.
 * Owns its internal step state machine. Resolves up to the parent hook
 * via the onResolve callback when the flow terminates.
 *
 * Steps in this commit (Commit 2 of 3):
 *   TIER_SELECT       Two-card layout, no default selection
 *   PHOTO_CONSENT     Inline consent body, checkbox, Accept / Go Back
 *   HEADSHOT_UPLOAD   Drop zone with client-side type and size validation
 *   HEADSHOT_PREVIEW  Circular preview, Use This Photo or Choose Different
 *
 * Verified Identity tier and selfie capture steps land in Commit 3.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { DOCUMENT_SUMMARIES } from '../hooks/useConsent';

// ----- Vault palette (matches Dashboard.jsx tokens) -----------------------
const BG       = '#080B12';
const BG1      = '#0C1018';
const BG3      = '#141B26';
const GOLD     = '#C9A84C';
const TEAL2    = '#22A67E';
const RED      = '#C45C5C';
const WHITE    = '#EEE9DF';
const MUTED    = 'rgba(238,233,223,0.45)';
const FAINT    = 'rgba(238,233,223,0.04)';
const BORDER   = 'rgba(201,168,76,0.15)';
const BORDER_LIT = 'rgba(201,168,76,0.55)';
const BORDER2  = 'rgba(238,233,223,0.07)';

const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIME = ['image/jpeg', 'image/png'];

// ----- Step constants ----------------------------------------------------
const STEP_TIER_SELECT      = 'TIER_SELECT';
const STEP_PHOTO_CONSENT    = 'PHOTO_CONSENT';
const STEP_HEADSHOT_UPLOAD  = 'HEADSHOT_UPLOAD';
const STEP_HEADSHOT_PREVIEW = 'HEADSHOT_PREVIEW';

export default function PhotoVerificationModal({
  isOpen,
  onResolve,
  postConsent,
  uploadHeadshot,
}) {
  // ----- Internal state machine ------------------------------------------
  const [step, setStep] = useState(STEP_TIER_SELECT);
  const [selectedTier, setSelectedTier] = useState(null); // null | 'none' | 'headshot'
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [declinedRecently, setDeclinedRecently] = useState(false);

  const [headshotFile, setHeadshotFile] = useState(null);
  const [headshotPreviewUrl, setHeadshotPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState(null); // string or null, contextual to current step
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const modalRef = useRef(null);

  // ----- Reset on open / close ------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      // Reset all internal state when modal closes so re-opens are fresh.
      setStep(STEP_TIER_SELECT);
      setSelectedTier(null);
      setConsentChecked(false);
      setConsentSubmitting(false);
      setDeclinedRecently(false);
      setHeadshotFile(null);
      setUploading(false);
      setError(null);
      setDragOver(false);
      // Object URL is cleaned up in the effect below when headshotFile clears.
    }
  }, [isOpen]);

  // ----- Object URL lifecycle for the preview ---------------------------
  useEffect(() => {
    if (!headshotFile) {
      setHeadshotPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(headshotFile);
    setHeadshotPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [headshotFile]);

  // ----- Body scroll lock -----------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // ----- Esc key closes (when no async work is in flight) ---------------
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !consentSubmitting && !uploading) {
        e.preventDefault();
        cancel();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, consentSubmitting, uploading]);

  // ----- Cancel / resolve handlers --------------------------------------
  const cancel = useCallback(() => {
    onResolve(null);
  }, [onResolve]);

  const continueFromTierSelect = () => {
    if (!selectedTier) return;
    if (selectedTier === 'none') {
      onResolve({ verificationTier: 'none', headshotUrl: null });
      return;
    }
    // headshot: advance to consent
    setError(null);
    setStep(STEP_PHOTO_CONSENT);
  };

  const declinePhotoConsent = () => {
    setStep(STEP_TIER_SELECT);
    setSelectedTier(null);
    setConsentChecked(false);
    setError(null);
    setDeclinedRecently(true);
  };

  const acceptPhotoConsent = async () => {
    if (!consentChecked || consentSubmitting) return;
    setConsentSubmitting(true);
    setError(null);
    try {
      await postConsent();
      setConsentSubmitting(false);
      setStep(STEP_HEADSHOT_UPLOAD);
    } catch (err) {
      setConsentSubmitting(false);
      setError('We could not record your consent. Please try again.');
    }
  };

  // ----- File handling --------------------------------------------------
  const validateFile = (file) => {
    if (!file) return 'We could not read that image. Please try a different file.';
    if (!ACCEPTED_MIME.includes(file.type)) {
      return 'That file type is not supported. Please upload a JPEG or PNG image.';
    }
    if (file.size > MAX_FILE_BYTES) {
      return 'That photo is over the 5 MB limit. Please choose a smaller image, or compress it before uploading.';
    }
    return null;
  };

  const acceptFile = (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setHeadshotFile(file);
    setStep(STEP_HEADSHOT_PREVIEW);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) acceptFile(file);
    // Reset input so same file can be re-selected after going back
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) acceptFile(file);
  };

  const chooseDifferentPhoto = () => {
    setHeadshotFile(null);
    setError(null);
    setStep(STEP_HEADSHOT_UPLOAD);
  };

  const useThisPhoto = async () => {
    if (!headshotFile || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const response = await uploadHeadshot(headshotFile);
      const headshotUrl = response.gatewayUrl || response.ipfsUri || null;
      onResolve({ verificationTier: 'headshot', headshotUrl });
    } catch (err) {
      setUploading(false);
      const status = err?.status;
      const code = err?.data?.code;
      if (status === 413 || code === 'IMAGE_TOO_LARGE') {
        setError('That photo is over the 5 MB limit. Please choose a smaller image, or compress it before uploading.');
      } else if (code === 'INVALID_IMAGE') {
        setError('That file type is not supported. Please upload a JPEG or PNG image.');
      } else if (status >= 500) {
        setError('We could not upload your photo right now. Please check your connection and try again.');
      } else if (status >= 400) {
        setError('Something went wrong with that upload. Please try a different photo, or contact support@atacglobalcx.com if the problem continues.');
      } else {
        // Network error or other unknown failure
        setError('We could not upload your photo right now. Please check your connection and try again.');
      }
    }
  };

  // ----- Back from upload step (preserves consent acceptance) ------------
  const backToConsent = () => {
    setError(null);
    setStep(STEP_PHOTO_CONSENT);
    // consentChecked stays true so the user does not re-tick the box
  };

  if (!isOpen) return null;

  // ----- Render ---------------------------------------------------------
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-verify-title"
      onClick={() => !consentSubmitting && !uploading && cancel()}
      style={overlayStyle}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={cardStyle}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: GOLD, fontWeight: 600 }}>
            Identity Verification
          </div>
          <button
            type="button"
            onClick={cancel}
            disabled={consentSubmitting || uploading}
            style={cancelLinkStyle}
          >
            Cancel
          </button>
        </div>

        {step === STEP_TIER_SELECT && (
          <TierSelectStep
            selectedTier={selectedTier}
            onSelect={setSelectedTier}
            onContinue={continueFromTierSelect}
            declinedRecently={declinedRecently}
          />
        )}

        {step === STEP_PHOTO_CONSENT && (
          <PhotoConsentStep
            checked={consentChecked}
            onToggle={() => setConsentChecked((v) => !v)}
            onDecline={declinePhotoConsent}
            onAccept={acceptPhotoConsent}
            submitting={consentSubmitting}
            error={error}
          />
        )}

        {step === STEP_HEADSHOT_UPLOAD && (
          <HeadshotUploadStep
            dragOver={dragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onPick={() => fileInputRef.current?.click()}
            onBack={backToConsent}
            error={error}
            fileInputRef={fileInputRef}
            onFileChange={handleFileInputChange}
          />
        )}

        {step === STEP_HEADSHOT_PREVIEW && (
          <HeadshotPreviewStep
            previewUrl={headshotPreviewUrl}
            onChooseDifferent={chooseDifferentPhoto}
            onConfirm={useThisPhoto}
            uploading={uploading}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Step 1: TIER_SELECT
// =========================================================================
function TierSelectStep({ selectedTier, onSelect, onContinue, declinedRecently }) {
  const continueLabel =
    selectedTier === 'headshot' ? 'Continue with Headshot'
    : selectedTier === 'none'   ? 'Continue with No Photo'
    : 'Continue';

  return (
    <>
      <h2 id="photo-verify-title" style={titleStyle}>Choose how your identity appears on your credential</h2>

      {declinedRecently && (
        <div
          role="status"
          style={{
            background: 'rgba(201,168,76,0.07)',
            border: `1px solid ${BORDER}`,
            borderRadius: 3,
            padding: '10px 14px',
            fontSize: 13,
            color: WHITE,
            marginBottom: 18,
            lineHeight: 1.5,
          }}
        >
          You can choose No Photo to proceed without uploading any images.
        </div>
      )}

      {/*
        Two-card grid today. Commit 3 will add a Verified Identity card in
        the middle slot; switching to repeat(3, 1fr) is a one-line change.
      */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
          marginBottom: 16,
        }}
      >
        <TierCard
          tier="headshot"
          selected={selectedTier === 'headshot'}
          onSelect={() => onSelect('headshot')}
          title="Headshot"
          subtitle="Public profile photo on your credential"
          bullets={[
            'Photo appears on your verify page',
            'Photo appears on your printed certificate',
            'Adds a face to your credential for employers',
          ]}
        />
        <TierCard
          tier="none"
          selected={selectedTier === 'none'}
          onSelect={() => onSelect('none')}
          title="No Photo"
          subtitle="Standard credential, name only"
          bullets={[
            'No photos uploaded or stored',
            'Certificate displays your name only',
            'Verify page shows your name only',
          ]}
        />
      </div>

      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 24 }}>
        You can change this on a future assessment attempt.
      </div>

      <div style={footerRow}>
        <span />
        <button
          type="button"
          onClick={onContinue}
          disabled={!selectedTier}
          style={primaryBtn(!selectedTier)}
        >
          {continueLabel}
        </button>
      </div>
    </>
  );
}

function TierCard({ selected, onSelect, title, subtitle, bullets }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        textAlign: 'left',
        background: selected ? 'rgba(201,168,76,0.07)' : BG1,
        border: `1px solid ${selected ? BORDER_LIT : BORDER2}`,
        borderRadius: 4,
        padding: '20px 22px',
        cursor: 'pointer',
        fontFamily: VAULT_BODY,
        color: WHITE,
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{
        fontFamily: VAULT_DISPLAY,
        fontSize: 24,
        fontWeight: 400,
        color: WHITE,
        lineHeight: 1.1,
      }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{subtitle}</div>
      <ul style={{ margin: '6px 0 0', padding: '0 0 0 18px', fontSize: 13, color: WHITE, lineHeight: 1.55 }}>
        {bullets.map((b, i) => (<li key={i} style={{ marginBottom: 4 }}>{b}</li>))}
      </ul>
    </button>
  );
}

// =========================================================================
// Step 2: PHOTO_CONSENT
// =========================================================================
function PhotoConsentStep({ checked, onToggle, onDecline, onAccept, submitting, error }) {
  const body = DOCUMENT_SUMMARIES.photo_consent || '';

  return (
    <>
      <h2 id="photo-verify-title" style={titleStyle}>Photo Consent</h2>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 18, lineHeight: 1.5 }}>
        Please review before uploading your photo
      </div>

      <div
        style={{
          background: BG1,
          border: `1px solid ${BORDER2}`,
          borderRadius: 3,
          padding: '16px 18px',
          maxHeight: 320,
          overflowY: 'auto',
          fontSize: 13,
          color: WHITE,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          marginBottom: 16,
        }}
      >
        {body}
      </div>

      <label style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        cursor: submitting ? 'not-allowed' : 'pointer',
        marginBottom: 16,
        opacity: submitting ? 0.7 : 1,
      }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={submitting}
          style={{ marginTop: 3, accentColor: GOLD, cursor: submitting ? 'not-allowed' : 'pointer' }}
        />
        <span style={{ fontSize: 13, color: WHITE, lineHeight: 1.5 }}>
          I have read and agree to the photo consent disclosure above.
        </span>
      </label>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div style={footerRow}>
        <button
          type="button"
          onClick={onDecline}
          disabled={submitting}
          style={secondaryBtn(submitting)}
        >
          Go Back
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={!checked || submitting}
          style={primaryBtn(!checked || submitting)}
        >
          {submitting ? 'Recording...' : 'Accept and Continue'}
        </button>
      </div>
    </>
  );
}

// =========================================================================
// Step 3: HEADSHOT_UPLOAD
// =========================================================================
function HeadshotUploadStep({
  dragOver, onDragOver, onDragLeave, onDrop,
  onPick, onBack, error, fileInputRef, onFileChange,
}) {
  return (
    <>
      <h2 id="photo-verify-title" style={titleStyle}>Upload Your Headshot</h2>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 18, lineHeight: 1.5 }}>
        This photo appears on your verify page and certificate
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onPick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } }}
        style={{
          border: `2px dashed ${dragOver ? GOLD : BORDER}`,
          borderRadius: 4,
          background: dragOver ? 'rgba(201,168,76,0.06)' : FAINT,
          padding: '36px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 12,
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 22, color: WHITE, marginBottom: 6 }}>
          {dragOver ? 'Release to upload' : 'Drop a photo here, or click to choose'}
        </div>
        <div style={{ fontSize: 12, color: MUTED }}>
          JPEG or PNG, up to 5 MB
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
      </div>

      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 16 }}>
        For best results: clear lighting, plain background, face visible, no sunglasses or hat.
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div style={footerRow}>
        <button type="button" onClick={onBack} style={secondaryBtn(false)}>
          Back
        </button>
        <span />
      </div>
    </>
  );
}

// =========================================================================
// Step 4: HEADSHOT_PREVIEW
// =========================================================================
function HeadshotPreviewStep({ previewUrl, onChooseDifferent, onConfirm, uploading, error }) {
  return (
    <>
      <h2 id="photo-verify-title" style={titleStyle}>Confirm Your Headshot</h2>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 22, lineHeight: 1.5 }}>
        This is how your photo will appear
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div
          aria-hidden="true"
          style={{
            width: 240,
            height: 240,
            borderRadius: '50%',
            overflow: 'hidden',
            border: `2px solid ${BORDER_LIT}`,
            boxShadow: '0 0 0 5px rgba(201,168,76,0.06), 0 12px 32px rgba(0,0,0,0.45)',
            background: BG,
          }}
        >
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div style={footerRow}>
        <button
          type="button"
          onClick={onChooseDifferent}
          disabled={uploading}
          style={secondaryBtn(uploading)}
        >
          Choose a Different Photo
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={uploading}
          style={primaryBtn(uploading)}
        >
          {uploading ? 'Uploading...' : 'Use This Photo'}
        </button>
      </div>
    </>
  );
}

// =========================================================================
// Shared sub-components and styles
// =========================================================================
function ErrorBanner({ children }) {
  return (
    <div
      role="alert"
      style={{
        margin: '4px 0 16px',
        padding: '10px 12px',
        background: 'rgba(196,92,92,0.08)',
        border: '1px solid rgba(196,92,92,0.32)',
        borderRadius: 3,
        color: RED,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(8,11,18,0.85)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  fontFamily: VAULT_BODY,
};

const cardStyle = {
  background: BG3,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  padding: 30,
  width: '100%',
  maxWidth: 640,
  boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  color: WHITE,
};

const titleStyle = {
  fontFamily: VAULT_DISPLAY,
  fontSize: 28,
  fontWeight: 400,
  color: WHITE,
  margin: '0 0 6px',
  lineHeight: 1.15,
};

const footerRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginTop: 20,
};

function primaryBtn(disabled) {
  return {
    background: disabled ? 'rgba(201,168,76,0.4)' : GOLD,
    color: BG,
    border: 'none',
    borderRadius: 2,
    padding: '11px 22px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: VAULT_BODY,
  };
}

function secondaryBtn(disabled) {
  return {
    background: 'transparent',
    color: WHITE,
    border: `1px solid ${MUTED}`,
    borderRadius: 2,
    padding: '11px 18px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontFamily: VAULT_BODY,
  };
}

const cancelLinkStyle = {
  background: 'none',
  border: 'none',
  color: MUTED,
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  padding: 0,
  fontFamily: VAULT_BODY,
};
