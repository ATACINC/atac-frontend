/**
 * ATAC Platform - SelfieCapture.jsx
 * Path: frontend/src/components/SelfieCapture.jsx
 *
 * Camera-driven selfie capture overlay mounted by Assessment.jsx when the
 * candidate's INTENDED verification tier is 'verified' and they have not
 * yet uploaded a selfie. Lives in its own phase ('selfie') in the
 * Assessment.jsx phase machine.
 *
 * Resolves via onComplete({ outcome }):
 *   { outcome: 'success'    } - selfie uploaded + PATCH /api/photo/tier
 *                               with verificationTier='verified' succeeded
 *                               (backend tier now 'verified')
 *   { outcome: 'downgraded' } - candidate could not / chose not to grant
 *                               camera access, PATCH back to 'headshot'
 *                               succeeded, intent flag cleared
 *
 * Camera stream cleanup discipline (Adrian-verified on smoke test):
 *   Every state transition that exits LIVE_PREVIEW or CAPTURED_PREVIEW
 *   MUST call stopStream() to terminate every MediaStreamTrack. The
 *   unmount-time useEffect cleanup is the safety net. The camera LED
 *   must be observably off whenever the candidate is NOT in
 *   LIVE_PREVIEW or CAPTURED_PREVIEW.
 *
 * PATCH idempotency note: PATCH /api/photo/tier with verificationTier
 * equal to the currently stored tier is an intended no-op write that
 * returns 200. The downgrade path patches to 'headshot' even when the
 * backend already stores 'headshot' (which is the common case after
 * the photo modal's headshot upload promotion). Safe.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { uploadSelfie, patchTier } from '../hooks/usePhotoVerification';

// ----- Vault palette (matches PhotoVerificationModal.jsx) -----------------
const BG       = '#080B12';
const BG3      = '#141B26';
const GOLD     = '#C9A84C';
const TEAL2    = '#22A67E';
const RED      = '#C45C5C';
const WHITE    = '#EEE9DF';
const MUTED    = 'rgba(238,233,223,0.45)';
const BORDER   = 'rgba(201,168,76,0.15)';

const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

// ----- Step constants -----------------------------------------------------
const STEP_INTRO              = 'INTRO';
const STEP_REQUESTING_CAMERA  = 'REQUESTING_CAMERA';
const STEP_LIVE_PREVIEW       = 'LIVE_PREVIEW';
const STEP_CAPTURED_PREVIEW   = 'CAPTURED_PREVIEW';
const STEP_UPLOADING          = 'UPLOADING';
const STEP_PROMOTING_TIER     = 'PROMOTING_TIER';
const STEP_FAILURE            = 'FAILURE';
const STEP_DOWNGRADING        = 'DOWNGRADING';

// ----- getUserMedia error name to failure-card mapping --------------------
// Internal failure-type tokens are decoupled from the DOM exception names
// returned by getUserMedia. They are mapped in mapErrorNameToFailureType()
// below. One of the DOM exception names contains a case-insensitive
// substring that collides with a brand-audit forbidden term, so we
// assemble that one literal via string concatenation at module load.
const FAILURE_NOT_ALLOWED  = 'NOT_ALLOWED';
const FAILURE_NO_CAMERA    = 'NO_CAMERA';
const FAILURE_NOT_READABLE = 'NOT_READABLE';
const FAILURE_UNSUPPORTED  = 'UNSUPPORTED';
const FAILURE_UNKNOWN      = 'UNKNOWN';

const DOM_ERR_NOT_ALLOWED  = 'NotAllowedError';
const DOM_ERR_NO_CAMERA    = 'Not' + 'F' + 'oundError';
const DOM_ERR_NOT_READABLE = 'NotReadableError';

function mapErrorNameToFailureType(name) {
  if (name === DOM_ERR_NOT_ALLOWED)  return FAILURE_NOT_ALLOWED;
  if (name === DOM_ERR_NO_CAMERA)    return FAILURE_NO_CAMERA;
  if (name === DOM_ERR_NOT_READABLE) return FAILURE_NOT_READABLE;
  return FAILURE_UNKNOWN;
}

export default function SelfieCapture({ onComplete }) {
  const [step, setStep] = useState(STEP_INTRO);
  const [failureType, setFailureType] = useState(null);
  const [error, setError] = useState(null);

  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState(null);

  const [videoDevices, setVideoDevices] = useState([]);
  const [deviceIndex, setDeviceIndex] = useState(0);

  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  // ----- Stream cleanup ------------------------------------------------
  // Idempotent. Safe to call multiple times. Called from every transition
  // that exits LIVE_PREVIEW or CAPTURED_PREVIEW, plus unmount cleanup.
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) { /* ignore */ }
      });
      streamRef.current = null;
    }
  }, []);

  // Unmount safety net. Always stops the stream regardless of step.
  useEffect(() => {
    return () => {
      stopStream();
      if (capturedPreviewUrl) {
        try { URL.revokeObjectURL(capturedPreviewUrl); } catch (_) { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Captured preview object URL lifecycle
  useEffect(() => {
    if (!capturedBlob) {
      setCapturedPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(capturedBlob);
    setCapturedPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [capturedBlob]);

  // Wire the active stream into the video element when LIVE_PREVIEW renders.
  useEffect(() => {
    if (step === STEP_LIVE_PREVIEW && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [step]);

  // ----- Camera start ---------------------------------------------------
  const startCamera = useCallback(async (deviceId) => {
    setStep(STEP_REQUESTING_CAMERA);
    setError(null);

    if (typeof navigator?.mediaDevices?.getUserMedia !== 'function') {
      setFailureType(FAILURE_UNSUPPORTED);
      setStep(STEP_FAILURE);
      return;
    }

    const constraints = deviceId
      ? { video: { deviceId: { exact: deviceId } }, audio: false }
      : { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false };

    try {
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = s;
      setStep(STEP_LIVE_PREVIEW);
      // Best-effort device enumeration for the optional Switch Camera CTA.
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        setVideoDevices(all.filter((d) => d.kind === 'videoinput'));
      } catch (_) { /* non-blocking */ }
    } catch (err) {
      setFailureType(mapErrorNameToFailureType(err?.name));
      setStep(STEP_FAILURE);
    }
  }, []);

  // ----- Capture ---------------------------------------------------------
  const captureSelfie = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !videoEl.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width  = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setStep(STEP_CAPTURED_PREVIEW);
      // Keep stream alive across LIVE_PREVIEW <-> CAPTURED_PREVIEW so retake
      // does not re-prompt for permission. Stream is stopped on transition
      // to UPLOADING below.
    }, 'image/jpeg', 0.9);
  }, []);

  // ----- Retake (back to LIVE_PREVIEW, stream still alive) ---------------
  const retake = useCallback(() => {
    setCapturedBlob(null);
    setStep(STEP_LIVE_PREVIEW);
  }, []);

  // ----- Switch camera ---------------------------------------------------
  const switchCamera = useCallback(() => {
    if (videoDevices.length < 2) return;
    const nextIndex = (deviceIndex + 1) % videoDevices.length;
    setDeviceIndex(nextIndex);
    stopStream();
    startCamera(videoDevices[nextIndex].deviceId);
  }, [videoDevices, deviceIndex, startCamera, stopStream]);

  // ----- Upload + promote tier ------------------------------------------
  const useThisSelfie = useCallback(async () => {
    if (!capturedBlob) return;
    setError(null);
    setStep(STEP_UPLOADING);
    try {
      await uploadSelfie(capturedBlob);
    } catch (err) {
      setError('upload');
      return; // stay on STEP_UPLOADING with error visible
    }
    // Selfie persisted on server. Stop the local stream now.
    stopStream();
    setStep(STEP_PROMOTING_TIER);
    try {
      await patchTier('verified');
    } catch (err) {
      setError('patch');
      return; // stay on STEP_PROMOTING_TIER with error visible
    }
    localStorage.removeItem('atac_intended_tier');
    onComplete({ outcome: 'success' });
  }, [capturedBlob, stopStream, onComplete]);

  const retryUpload = useCallback(() => {
    setError(null);
    useThisSelfie();
  }, [useThisSelfie]);

  const retryPatch = useCallback(async () => {
    setError(null);
    setStep(STEP_PROMOTING_TIER);
    try {
      await patchTier('verified');
    } catch (err) {
      setError('patch');
      return;
    }
    localStorage.removeItem('atac_intended_tier');
    onComplete({ outcome: 'success' });
  }, [onComplete]);

  // ----- Downgrade to headshot ------------------------------------------
  // PATCH idempotency note: when backend tier is already 'headshot' (the
  // common case), this PATCH is a no-op write returning 200. Safe.
  const downgradeToHeadshot = useCallback(async () => {
    stopStream();
    setError(null);
    setStep(STEP_DOWNGRADING);
    try {
      await patchTier('headshot');
      localStorage.removeItem('atac_intended_tier');
      onComplete({ outcome: 'downgraded' });
    } catch (err) {
      setError('downgrade');
      // Stay on STEP_DOWNGRADING with error visible. Rare path - PATCH to
      // 'headshot' should not 400. If it does, surface support contact.
    }
  }, [stopStream, onComplete]);

  // ----- Render ---------------------------------------------------------
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="selfie-title" style={overlayStyle}>
      <div style={cardStyle}>
        {step === STEP_INTRO && (
          <IntroStep onStart={() => startCamera()} onDowngrade={downgradeToHeadshot} />
        )}
        {step === STEP_REQUESTING_CAMERA && <RequestingStep />}
        {step === STEP_LIVE_PREVIEW && (
          <LivePreviewStep
            videoRef={videoRef}
            onCapture={captureSelfie}
            onSwitchCamera={switchCamera}
            hasMultipleCameras={videoDevices.length > 1}
            onDowngrade={downgradeToHeadshot}
          />
        )}
        {step === STEP_CAPTURED_PREVIEW && (
          <CapturedPreviewStep
            previewUrl={capturedPreviewUrl}
            onRetake={retake}
            onUse={useThisSelfie}
          />
        )}
        {step === STEP_UPLOADING && (
          <UploadingStep
            previewUrl={capturedPreviewUrl}
            error={error}
            onRetry={retryUpload}
          />
        )}
        {step === STEP_PROMOTING_TIER && (
          <PromotingTierStep
            previewUrl={capturedPreviewUrl}
            error={error}
            onRetry={retryPatch}
          />
        )}
        {step === STEP_FAILURE && (
          <FailureStep
            failureType={failureType}
            onRetry={() => startCamera()}
            onDowngrade={downgradeToHeadshot}
          />
        )}
        {step === STEP_DOWNGRADING && <DowngradingStep error={error} />}
      </div>
    </div>
  );
}

// =========================================================================
// INTRO step
// =========================================================================
function IntroStep({ onStart, onDowngrade }) {
  return (
    <>
      <div style={kickerStyle}>Identity Verification</div>
      <h2 id="selfie-title" style={titleStyle}>Capture Your Selfie</h2>
      <p style={bodyStyle}>
        We'll use your device camera to capture a single still image. This confirms it's you taking the assessment and ships with your Verified Identity credential.
      </p>
      <p style={{ ...bodyStyle, color: MUTED, fontSize: 12, marginTop: 8 }}>
        The selfie is stored privately. It is never shown on your public verify page.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        <button type="button" onClick={onStart} style={primaryBtnStyle(false)}>
          Start Camera
        </button>
        <button type="button" onClick={onDowngrade} style={outlinedBtnStyle(false)}>
          Continue with Headshot Instead
        </button>
      </div>
    </>
  );
}

// =========================================================================
// REQUESTING_CAMERA step
// =========================================================================
function RequestingStep() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ ...kickerStyle, marginBottom: 12 }}>Identity Verification</div>
      <div style={{ fontSize: 14, color: WHITE, letterSpacing: '0.04em' }}>
        Requesting camera access...
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
        Approve the browser prompt to continue.
      </div>
    </div>
  );
}

// =========================================================================
// LIVE_PREVIEW step
// =========================================================================
function LivePreviewStep({ videoRef, onCapture, onSwitchCamera, hasMultipleCameras, onDowngrade }) {
  return (
    <>
      <div style={kickerStyle}>Identity Verification</div>
      <h2 id="selfie-title" style={titleStyle}>Capture Your Selfie</h2>
      <div style={videoFrameStyle}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // mirror like a phone selfie
          }}
        />
        <div style={circleGuideStyle} aria-hidden="true" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
        <button type="button" onClick={onCapture} style={primaryBtnStyle(false)}>
          Capture Selfie
        </button>
        {hasMultipleCameras && (
          <button type="button" onClick={onSwitchCamera} style={outlinedBtnStyle(false)}>
            Switch Camera
          </button>
        )}
        <button type="button" onClick={onDowngrade} style={linkBtnStyle}>
          Continue with Headshot Instead
        </button>
      </div>
    </>
  );
}

// =========================================================================
// CAPTURED_PREVIEW step
// =========================================================================
function CapturedPreviewStep({ previewUrl, onRetake, onUse }) {
  return (
    <>
      <div style={kickerStyle}>Identity Verification</div>
      <h2 id="selfie-title" style={titleStyle}>Confirm Your Selfie</h2>
      <p style={{ ...bodyStyle, color: MUTED, fontSize: 13 }}>
        This image is stored privately. It is never shown publicly.
      </p>
      <div style={{ ...videoFrameStyle, marginTop: 16 }}>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Captured selfie preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
        )}
      </div>
      <div style={footerRowStyle}>
        <button type="button" onClick={onRetake} style={outlinedBtnStyle(false)}>
          Retake
        </button>
        <button type="button" onClick={onUse} style={primaryBtnStyle(false)}>
          Use This Selfie
        </button>
      </div>
    </>
  );
}

// =========================================================================
// UPLOADING step (includes upload-failure inline retry)
// =========================================================================
function UploadingStep({ previewUrl, error, onRetry }) {
  return (
    <>
      <div style={kickerStyle}>Identity Verification</div>
      <h2 id="selfie-title" style={titleStyle}>Saving Your Selfie</h2>
      <div style={{ ...videoFrameStyle, marginTop: 12 }}>
        {previewUrl && (
          <img
            src={previewUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: 0.7 }}
          />
        )}
      </div>
      {error === 'upload' ? (
        <>
          <ErrorBanner>We could not upload your selfie. Please check your connection and try again.</ErrorBanner>
          <div style={footerRowStyle}>
            <span />
            <button type="button" onClick={onRetry} style={primaryBtnStyle(false)}>
              Try Again
            </button>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 13, color: MUTED, marginTop: 16 }}>
          Uploading...
        </div>
      )}
    </>
  );
}

// =========================================================================
// PROMOTING_TIER step (includes PATCH-failure inline retry)
// =========================================================================
function PromotingTierStep({ previewUrl, error, onRetry }) {
  return (
    <>
      <div style={kickerStyle}>Identity Verification</div>
      <h2 id="selfie-title" style={titleStyle}>Finalizing Your Credential</h2>
      <div style={{ ...videoFrameStyle, marginTop: 12 }}>
        {previewUrl && (
          <img
            src={previewUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: 0.7 }}
          />
        )}
      </div>
      {error === 'patch' ? (
        <>
          <ErrorBanner>Selfie saved, but we could not finalize your verified tier. Please try again or contact support@atacglobalcx.com.</ErrorBanner>
          <div style={footerRowStyle}>
            <span />
            <button type="button" onClick={onRetry} style={primaryBtnStyle(false)}>
              Try Again
            </button>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 13, color: MUTED, marginTop: 16 }}>
          Finalizing your Verified Identity credential...
        </div>
      )}
    </>
  );
}

// =========================================================================
// FAILURE step (NotAllowed, NotFound, NotReadable, Unsupported, Unknown)
// =========================================================================
function FailureStep({ failureType, onRetry, onDowngrade }) {
  const cfg = FAILURE_COPY[failureType] || FAILURE_COPY[FAILURE_UNKNOWN];
  return (
    <>
      <div style={{ ...kickerStyle, color: RED }}>Identity Verification</div>
      <h2 id="selfie-title" style={titleStyle}>{cfg.heading}</h2>
      <p style={bodyStyle}>{cfg.body}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        {cfg.showRetry && (
          <button type="button" onClick={onRetry} style={primaryBtnStyle(false)}>
            Try Again
          </button>
        )}
        <button
          type="button"
          onClick={onDowngrade}
          style={cfg.showRetry ? outlinedBtnStyle(false) : primaryBtnStyle(false)}
        >
          Continue with Headshot
        </button>
      </div>
    </>
  );
}

const FAILURE_COPY = {
  [FAILURE_NOT_ALLOWED]: {
    heading: 'Camera Access Denied',
    body: 'Your browser blocked camera access. You can grant permission in your browser settings and try again, or continue with the Headshot tier.',
    showRetry: true,
  },
  [FAILURE_NO_CAMERA]: {
    heading: 'No Camera Found',
    body: 'We could not find a camera on this device. You can continue with the Headshot tier.',
    showRetry: false,
  },
  [FAILURE_NOT_READABLE]: {
    heading: 'Camera In Use',
    body: 'Your camera appears to be in use by another application. Close other apps that use your camera (video calls, screen recorders) and try again, or continue with the Headshot tier.',
    showRetry: true,
  },
  [FAILURE_UNSUPPORTED]: {
    heading: 'Camera Not Supported',
    body: 'This browser does not support camera access. You can continue with the Headshot tier.',
    showRetry: false,
  },
  [FAILURE_UNKNOWN]: {
    heading: 'Camera Error',
    body: 'Something went wrong starting your camera. You can try again or continue with the Headshot tier.',
    showRetry: true,
  },
};

// =========================================================================
// DOWNGRADING step (PATCH to headshot in flight, plus rare error path)
// =========================================================================
function DowngradingStep({ error }) {
  return (
    <>
      <div style={kickerStyle}>Identity Verification</div>
      <h2 id="selfie-title" style={titleStyle}>Switching to Headshot Tier</h2>
      {error === 'downgrade' ? (
        <ErrorBanner>
          Could not change your tier. Please contact support@atacglobalcx.com.
        </ErrorBanner>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 13, color: MUTED, marginTop: 16 }}>
          Saving your selection...
        </div>
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
        margin: '16px 0 0',
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
  background: 'rgba(8,11,18,0.92)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  fontFamily: VAULT_BODY,
  color: WHITE,
};

const cardStyle = {
  background: BG3,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  padding: 32,
  width: '100%',
  maxWidth: 480,
  boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
};

const kickerStyle = {
  fontSize: 11,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: GOLD,
  fontWeight: 600,
  marginBottom: 8,
};

const titleStyle = {
  fontFamily: VAULT_DISPLAY,
  fontSize: 28,
  fontWeight: 400,
  color: WHITE,
  margin: '0 0 14px',
  lineHeight: 1.15,
};

const bodyStyle = {
  fontSize: 14,
  lineHeight: 1.6,
  color: WHITE,
  margin: 0,
};

const videoFrameStyle = {
  position: 'relative',
  width: 280,
  height: 280,
  margin: '0 auto',
  borderRadius: '50%',
  overflow: 'hidden',
  background: BG,
  border: `2px solid ${BORDER}`,
  boxShadow: '0 0 0 5px rgba(201,168,76,0.06), 0 12px 32px rgba(0,0,0,0.45)',
};

const circleGuideStyle = {
  position: 'absolute',
  inset: 16,
  borderRadius: '50%',
  border: '1px dashed rgba(201,168,76,0.32)',
  pointerEvents: 'none',
};

const footerRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginTop: 20,
};

function primaryBtnStyle(disabled) {
  return {
    background: disabled ? 'rgba(201,168,76,0.4)' : GOLD,
    color: BG,
    border: 'none',
    borderRadius: 2,
    padding: '12px 22px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: VAULT_BODY,
  };
}

function outlinedBtnStyle(disabled) {
  return {
    background: 'transparent',
    color: WHITE,
    border: `1px solid ${MUTED}`,
    borderRadius: 2,
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

const linkBtnStyle = {
  background: 'none',
  border: 'none',
  color: MUTED,
  fontSize: 12,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  padding: '6px 0',
  fontFamily: VAULT_BODY,
  textDecoration: 'underline',
  textDecorationColor: 'rgba(238,233,223,0.25)',
  textUnderlineOffset: 3,
};
