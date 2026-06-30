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
import ModalShell from './chrome/ModalShell';
import { color as ds, font as dsFont, radius as dsRadius, goldButton } from '../designSystem/tokens';

// ----- Palette mapped to the redesign tokens ------------------------------
// Names kept so the step components and style helpers below pick up the new
// look without structural churn. The card surface now comes from ModalShell.
const BG       = ds.bg;
const BG1      = ds.panel;
const BG3      = ds.bg;
const GOLD     = ds.gold;
const TEAL2    = ds.greenText;
const RED      = ds.red;
const WHITE    = ds.heading;
const MUTED    = ds.muted;
const FAINT    = 'rgba(255,255,255,0.04)';
const BORDER   = ds.border;
const BORDER_LIT = 'rgba(239,192,60,0.55)';
const BORDER2  = ds.border;

const VAULT_DISPLAY = dsFont.display;
const VAULT_BODY    = dsFont.body;

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIME = ['image/jpeg', 'image/png'];

// ----- Step constants ----------------------------------------------------
const STEP_TIER_SELECT       = 'TIER_SELECT';
const STEP_PHOTO_CONSENT     = 'PHOTO_CONSENT';
const STEP_HEADSHOT_UPLOAD   = 'HEADSHOT_UPLOAD';
const STEP_HEADSHOT_PREVIEW  = 'HEADSHOT_PREVIEW';
const STEP_HEADSHOT_DONE     = 'HEADSHOT_DONE';
const STEP_BIOMETRIC_CONSENT = 'BIOMETRIC_CONSENT';

export default function PhotoVerificationModal({
  isOpen,
  onResolve,
  postConsent,
  postBiometricConsent,
  uploadHeadshot,
  patchTier,
}) {
  // ----- Internal state machine ------------------------------------------
  const [step, setStep] = useState(STEP_TIER_SELECT);
  const [selectedTier, setSelectedTier] = useState(null); // null | 'none' | 'headshot' | 'verified'
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [declinedRecently, setDeclinedRecently] = useState(false);
  // C-2 biometric consent (Verified Identity path only). Deliberately a
  // SEPARATE checkbox and submission from photo_consent above: biometric
  // consent is its own ledger document and its own affirmative action.
  const [biometricChecked, setBiometricChecked] = useState(false);
  const [biometricSubmitting, setBiometricSubmitting] = useState(false);

  const [headshotFile, setHeadshotFile] = useState(null);
  const [headshotPreviewUrl, setHeadshotPreviewUrl] = useState(null);
  const [uploadedHeadshotUrl, setUploadedHeadshotUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Tier-PATCH submission flag used by STEP_HEADSHOT_DONE when the candidate
  // commits to the 'verified' path. The PATCH is attempted optimistically;
  // backend returns 400 SELFIE_REQUIRED, which we handle as the expected
  // path and resolve with verificationTier='verified' anyway.
  const [tierPatchSubmitting, setTierPatchSubmitting] = useState(false);

  const [error, setError] = useState(null); // string or null, contextual to current step
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);

  // ----- Reset on open / close ------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      // Reset all internal state when modal closes so re-opens are fresh.
      // Pre-existing reset-on-close pattern (unchanged by the re-skin); the
      // cleaner ModalShell-based component now analyzes fully and surfaces it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(STEP_TIER_SELECT);
      setSelectedTier(null);
      setConsentChecked(false);
      setConsentSubmitting(false);
      setDeclinedRecently(false);
      setBiometricChecked(false);
      setBiometricSubmitting(false);
      setHeadshotFile(null);
      setUploadedHeadshotUrl(null);
      setUploading(false);
      setTierPatchSubmitting(false);
      setError(null);
      setDragOver(false);
      // Object URL is cleaned up in the effect below when headshotFile clears.
    }
  }, [isOpen]);

  // ----- Object URL lifecycle for the preview ---------------------------
  useEffect(() => {
    if (!headshotFile) {
      // Pre-existing object-URL lifecycle (unchanged by the re-skin).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeadshotPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(headshotFile);
    setHeadshotPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [headshotFile]);

  // Body scroll-lock, Esc-to-close, and focus-trap are now provided by
  // ModalShell. Esc/backdrop dismissal is gated by the same async guard as
  // before via guardedClose() below, so a step can't be skipped mid-flight.

  // ----- Cancel / resolve handlers --------------------------------------
  const cancel = useCallback(() => {
    onResolve(null);
  }, [onResolve]);

  // Async-in-flight guard for backdrop/Esc dismissal — preserves the prior
  // behavior exactly: the flow can only be cancelled when no submit/upload is
  // pending. ModalShell calls this on Esc and backdrop; it never skips a step.
  const isBusy = consentSubmitting || uploading || tierPatchSubmitting || biometricSubmitting;
  const guardedClose = useCallback(() => {
    if (consentSubmitting || uploading || tierPatchSubmitting || biometricSubmitting) return;
    cancel();
  }, [cancel, consentSubmitting, uploading, tierPatchSubmitting, biometricSubmitting]);

  const continueFromTierSelect = () => {
    if (!selectedTier) return;
    if (selectedTier === 'none') {
      onResolve({ verificationTier: 'none', headshotUrl: null });
      return;
    }
    // 'headshot' and 'verified' both advance through the same consent +
    // upload steps. The difference shows up at STEP_HEADSHOT_DONE where
    // the CTAs branch per the originally selected tier.
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
      setUploadedHeadshotUrl(headshotUrl);
      setUploading(false);
      // Advance to STEP_HEADSHOT_DONE instead of resolving immediately so
      // the candidate can confirm tier (and optionally upgrade Headshot
      // selections to Verified Identity in-modal).
      setStep(STEP_HEADSHOT_DONE);
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

  // ----- STEP_HEADSHOT_DONE terminal actions ---------------------------
  // Resolve as 'headshot' tier. Backend was already auto-promoted from
  // 'none' to 'headshot' by the headshot upload writeback.
  const finishWithHeadshot = () => {
    onResolve({ verificationTier: 'headshot', headshotUrl: uploadedHeadshotUrl });
  };

  // Resolve as 'verified' tier (intended). The PATCH attempt is expected
  // to return 400 SELFIE_REQUIRED because no selfie is on file yet. We
  // handle that as the expected path and resolve with intended='verified'
  // anyway. Dashboard.jsx persists this intent to localStorage for
  // SelfieCapture.jsx to consume at assessment start.
  const finishWithVerified = async () => {
    if (tierPatchSubmitting) return;
    setTierPatchSubmitting(true);
    setError(null);
    try {
      await patchTier('verified');
      // Unexpected: backend accepted the PATCH (would mean a selfie is
      // already on file from a previous attempt). Resolve verified.
    } catch (err) {
      const code = err?.data?.code;
      const status = err?.status;
      if (code === 'SELFIE_REQUIRED' || status === 400) {
        // Expected path. Backend tier stays 'headshot'; intent is 'verified'.
      } else {
        setError('Could not save your tier preference. Please try again.');
        setTierPatchSubmitting(false);
        return;
      }
    }
    setTierPatchSubmitting(false);
    onResolve({ verificationTier: 'verified', headshotUrl: uploadedHeadshotUrl });
  };

  // C-2: every route into the Verified Identity tier now passes through
  // the biometric consent step first. Both HeadshotDoneStep CTAs that
  // previously called finishWithVerified route here instead, covering the
  // tier-select choice AND the headshot-to-verified in-modal upgrade.
  const goToBiometricConsent = () => {
    setError(null);
    setStep(STEP_BIOMETRIC_CONSENT);
  };

  // Accept: record biometric_consent@1.0.0 in the ledger, then continue
  // with the existing verified resolution (tier PATCH + resolve).
  const acceptBiometricConsent = async () => {
    if (!biometricChecked || biometricSubmitting) return;
    setBiometricSubmitting(true);
    setError(null);
    try {
      await postBiometricConsent();
    } catch {
      setBiometricSubmitting(false);
      setError('We could not record your consent. Please try again.');
      return;
    }
    setBiometricSubmitting(false);
    await finishWithVerified();
  };

  // Decline: NOT a dead end. The headshot is already uploaded at this
  // point, so the candidate proceeds with the headshot tier instead.
  // No biometric consent is recorded and they are not routed to verified.
  const declineBiometricConsent = () => {
    setBiometricChecked(false);
    setError(null);
    finishWithHeadshot();
  };

  // ----- Back from upload step (preserves consent acceptance) ------------
  const backToConsent = () => {
    setError(null);
    setStep(STEP_PHOTO_CONSENT);
    // consentChecked stays true so the user does not re-tick the box
  };

  // ----- Render ---------------------------------------------------------
  // ModalShell provides the backdrop blur-in, centered token panel, shadow,
  // focus-trap, scroll-lock, and Esc/backdrop dismissal. Dismissal is routed
  // through guardedClose so it stays blocked while async work is in flight —
  // identical to the prior behavior; no step is ever skipped.
  return (
    <ModalShell open={isOpen} onClose={guardedClose} labelledBy="photo-verify-title">
      <div style={{ padding: 30, fontFamily: VAULT_BODY, color: WHITE }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: GOLD, fontWeight: 600 }}>
            Identity Verification
          </div>
          <button
            type="button"
            onClick={cancel}
            disabled={isBusy}
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

        {step === STEP_HEADSHOT_DONE && (
          <HeadshotDoneStep
            previewUrl={headshotPreviewUrl}
            selectedTier={selectedTier}
            onFinishHeadshot={finishWithHeadshot}
            onFinishVerified={goToBiometricConsent}
            submitting={tierPatchSubmitting}
            error={error}
          />
        )}

        {step === STEP_BIOMETRIC_CONSENT && (
          <BiometricConsentStep
            checked={biometricChecked}
            onToggle={() => setBiometricChecked((v) => !v)}
            onDecline={declineBiometricConsent}
            onAccept={acceptBiometricConsent}
            submitting={biometricSubmitting || tierPatchSubmitting}
            error={error}
          />
        )}
      </div>
    </ModalShell>
  );
}

// =========================================================================
// Step 1: TIER_SELECT (three-card layout per Commit 3 design)
// =========================================================================
function TierSelectStep({ selectedTier, onSelect, onContinue, declinedRecently }) {
  // Mobile breakpoint detection. On narrow screens the cards stack 1-column
  // and the prominent Verified Identity card floats to the top of the stack
  // (visual hierarchy carries over from the middle-position desktop layout).
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 600px)');
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    // addEventListener is the modern API; addListener kept for older Safari fallback
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  const continueLabel =
    selectedTier === 'headshot' ? 'Continue with Headshot'
    : selectedTier === 'verified' ? 'Continue with Verified Identity'
    : selectedTier === 'none'   ? 'Continue with No Photo'
    : 'Continue';

  const headshotCard = (
    <TierCard
      key="headshot"
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
  );

  const verifiedCard = (
    <TierCard
      key="verified"
      tier="verified"
      selected={selectedTier === 'verified'}
      onSelect={() => onSelect('verified')}
      title="Verified Identity"
      subtitle="Public photo + private selfie, strongest fraud deterrent"
      bullets={[
        'Photo appears on your verify page',
        'Photo appears on your printed certificate',
        '"Verified Identity" badge on your credential',
        'Selfie captured at assessment start (private, never shown publicly)',
      ]}
      recommended
    />
  );

  const noPhotoCard = (
    <TierCard
      key="none"
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
  );

  // Desktop: [Headshot | Verified (prominent middle) | No Photo]
  // Mobile:  [Verified (top) | Headshot | No Photo]   - prominence moves to top
  const cardsInOrder = isMobile
    ? [verifiedCard, headshotCard, noPhotoCard]
    : [headshotCard, verifiedCard, noPhotoCard];

  return (
    <>
      <h2 id="photo-verify-title" style={titleStyle}>Choose how your identity appears on your credential</h2>

      {declinedRecently && (
        <div
          role="status"
          style={{
            background: 'rgba(239,192,60,0.07)',
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 14,
          marginBottom: 16,
        }}
      >
        {cardsInOrder}
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

function TierCard({ selected, onSelect, title, subtitle, bullets, recommended }) {
  // Recommended card (Verified Identity) gets a full gold border by default
  // even when unselected. Side cards use the muted border-2 token when
  // unselected and the lit gold border when selected.
  const borderColor = recommended
    ? GOLD
    : (selected ? BORDER_LIT : BORDER2);
  const background = recommended
    ? (selected ? 'rgba(239,192,60,0.10)' : 'rgba(239,192,60,0.04)')
    : (selected ? 'rgba(239,192,60,0.07)' : BG1);
  const innerGlow = recommended && selected
    ? 'inset 0 0 0 1px rgba(239,192,60,0.32)'
    : 'none';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        position: 'relative',
        textAlign: 'left',
        background,
        border: `1px solid ${borderColor}`,
        borderRadius: 4,
        padding: '20px 22px',
        cursor: 'pointer',
        fontFamily: VAULT_BODY,
        color: WHITE,
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: recommended
          ? `0 4px 16px rgba(239,192,60,0.10)${innerGlow !== 'none' ? `, ${innerGlow}` : ''}`
          : 'none',
      }}
    >
      {recommended && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: GOLD,
            color: BG,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 999,
            lineHeight: 1,
          }}
        >
          Recommended
        </span>
      )}
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
// Step: BIOMETRIC_CONSENT (C-2, Verified Identity path only)
// =========================================================================
// A SEPARATE affirmative action from photo_consent. Mirrors the
// PhotoConsentStep layout. Decline is not a dead end: the candidate
// proceeds with the headshot tier instead.
function BiometricConsentStep({ checked, onToggle, onDecline, onAccept, submitting, error }) {
  return (
    <>
      <h2 id="photo-verify-title" style={titleStyle}>Biometric Identity Verification</h2>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 18, lineHeight: 1.5 }}>
        One more consent is needed for Verified Identity
      </div>

      <div
        style={{
          background: BG1,
          border: `1px solid ${BORDER2}`,
          borderRadius: 3,
          padding: '16px 18px',
          fontSize: 13,
          color: WHITE,
          lineHeight: 1.65,
          marginBottom: 16,
        }}
      >
        <p style={{ margin: '0 0 10px' }}>
          Verified Identity uses biometric face comparison. The selfies you
          capture when you start the assessment and the simulator are
          compared with your uploaded headshot to confirm the same person
          completes each step.
        </p>
        <p style={{ margin: '0 0 10px' }}>
          Your face images are used only for this comparison. They are
          stored privately and never shown on your public verify page.
        </p>
        <a
          href="https://atacglobalcx.com/biometric-consent"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: GOLD, fontSize: 13 }}
        >
          Read the full biometric consent disclosure
        </a>
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
          I have read the biometric consent disclosure and I agree to
          biometric identity verification.
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
          Continue with Headshot Instead
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={!checked || submitting}
          style={primaryBtn(!checked || submitting)}
        >
          {submitting ? 'Recording...' : 'Agree and Continue'}
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
          background: dragOver ? 'rgba(239,192,60,0.06)' : FAINT,
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
            boxShadow: '0 0 0 5px rgba(239,192,60,0.06), 0 12px 32px rgba(0,0,0,0.45)',
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
// Step 5: HEADSHOT_DONE - confirm tier, optionally upgrade to Verified
// =========================================================================
function HeadshotDoneStep({ previewUrl, selectedTier, onFinishHeadshot, onFinishVerified, submitting, error }) {
  const isVerifiedPath = selectedTier === 'verified';
  return (
    <>
      <h2 id="photo-verify-title" style={{ ...titleStyle, color: TEAL2 }}>Headshot Saved</h2>
      <p style={{ fontSize: 14, color: MUTED, margin: '6px 0 8px', lineHeight: 1.55 }}>
        Your headshot is saved and ready to ship with your credential.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 22px' }}>
        <div
          aria-hidden="true"
          style={{
            width: 200,
            height: 200,
            borderRadius: '50%',
            overflow: 'hidden',
            border: `2px solid ${BORDER_LIT}`,
            boxShadow: '0 0 0 5px rgba(239,192,60,0.06), 0 12px 32px rgba(0,0,0,0.45)',
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

      {isVerifiedPath ? (
        <>
          <div style={{ fontSize: 13, color: MUTED, textAlign: 'center', marginBottom: 18, lineHeight: 1.55 }}>
            You'll capture a selfie when you start your assessment.
          </div>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <button
              type="button"
              onClick={onFinishVerified}
              disabled={submitting}
              style={{ ...primaryBtn(submitting), minWidth: 280 }}
            >
              {submitting ? 'Saving...' : 'Continue to Assessment'}
            </button>
          </div>
        </>
      ) : (
        <>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <button
              type="button"
              onClick={onFinishHeadshot}
              disabled={submitting}
              style={primaryBtn(submitting)}
            >
              Continue with Headshot
            </button>
            <button
              type="button"
              onClick={onFinishVerified}
              disabled={submitting}
              style={{
                ...secondaryBtn(submitting),
                color: GOLD,
                borderColor: BORDER,
              }}
            >
              {submitting ? 'Saving...' : 'Upgrade to Verified Identity →'}
            </button>
            <div style={{ fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 1.55, marginTop: 4 }}>
              You'll capture a selfie when you start your assessment.
            </div>
          </div>
        </>
      )}
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

// Overlay + card chrome now come from ModalShell (token panel, blur-in, shadow).

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
  // Gold-gradient CTA from the redesign system; disabled state falls back to a
  // muted gold wash with the gradient/shadow removed.
  return {
    ...goldButton,
    borderRadius: dsRadius.sm,
    padding: '12px 22px',
    fontSize: 11,
    letterSpacing: '0.18em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...(disabled ? { background: 'rgba(239,192,60,0.4)', boxShadow: 'none' } : {}),
  };
}

function secondaryBtn(disabled) {
  return {
    background: 'transparent',
    color: WHITE,
    border: `1px solid ${ds.border}`,
    borderRadius: dsRadius.sm,
    padding: '12px 18px',
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
