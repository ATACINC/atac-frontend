import LanguageSelector from '../components/LanguageSelector';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/client';
import brandLogo from '../assets/atac-globalcx-logo-header.png';
import certificateSeal from '../assets/agcx-certificate-seal-cropped.png';
import { useToast } from '../hooks/useToast';
import { usePhotoVerification } from '../hooks/usePhotoVerification';
import CharterCounter from '../components/CharterCounter';
import CharterCohortBlock from '../components/CharterCohortBlock';
import CandidateStateRenderer from '../utils/CandidateStateRenderer';
import RegistryConsentCard from '../components/RegistryConsentCard';

/* -- Vault Design Tokens ---------------------------------------------- */
const BG    = '#080B12';
const BG1   = '#0C1018';
const BG3   = '#141B26';
const GOLD  = '#C9A84C';
const TEAL  = '#1A8F69';
const TEAL2 = '#22A67E';
const RED   = '#C45C5C';
const AMBER = '#C48A2A';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const FAINT = 'rgba(238,233,223,0.04)';
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';

const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const DIM_COLORS = ['#C9A84C','#5BA8D4','#5DCAA5','#D4537E','#8A7DD4','#22A67E'];
const DIM_LABELS = ['Professionalism','Communication','CX Operations','Technology','Health & Safety','Remote Work'];
const DIM_KEYS   = ['professionalism','communication','cx_operations','technology','health_safety','remote_setup'];

/* -- Keyframe injection ----------------------------------------------- */
const injectKF = () => {
  if (document.getElementById('vault-dash-kf')) return;
  const s = document.createElement('style');
  s.id = 'vault-dash-kf';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Syne:wght@400;500;600;700&display=swap');
    @keyframes vault-up   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes vault-fade { from { opacity:0; } to { opacity:1; } }
    @keyframes bar-fill   { from { width:0; } to { width:var(--w); } }
    .vault-up   { animation: vault-up 0.5s ease both; }
    .vault-fade { animation: vault-fade 0.4s ease both; }
    .btn-gold-h:hover { opacity: 0.88 !important; }
    .btn-out-h:hover  { border-color: rgba(201,168,76,0.3) !important; color: ${WHITE} !important; }
    ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.12); }
  `;
  document.head.appendChild(s);
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const photoVerification = usePhotoVerification();
  const candidate = JSON.parse(localStorage.getItem('atac_candidate') || '{}');
  const result    = JSON.parse(localStorage.getItem('atac_result')    || 'null');

  const [credentials,       setCredentials]       = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [copied,            setCopied]            = useState(false);
  const [linkedInCopied,    setLinkedInCopied]    = useState(false);
  const [paymentSuccess,    setPaymentSuccess]    = useState(false);
  const [paymentCancelled,  setPaymentCancelled]  = useState(false);
  const [paymentVerified,   setPaymentVerified]   = useState(false);
  const [paymentTier,       setPaymentTier]       = useState('');
  const [startingAssessment,setStartingAssessment]= useState(false);
  const [checkoutLoading,   setCheckoutLoading]   = useState('');
  const [downloading,       setDownloading]       = useState(false);
  const [walletInput,       setWalletInput]       = useState('');
  const [walletSaving,      setWalletSaving]      = useState(false);
  const [walletSaved,       setWalletSaved]       = useState(false);
  const [walletError,       setWalletError]       = useState('');
  const [candidateWallet,   setCandidateWallet]   = useState(candidate.wallet_address || '');
  // Phase 5: resolved candidate state from GET /api/candidate/me/state.
  // Drives both the CandidateStateRenderer hero block AND the gates on
  // every legacy Start Assessment surface in this file. The resolver is
  // the single source of truth for "what should the candidate do next?"
  // so a paid candidate who already passed (status awaiting_simulator)
  // never sees a stale Start Assessment CTA.
  // States: flowStateLoading=true on initial fetch and on a manual
  // refresh. flowStateError=true after the auto-retry exhausted, used
  // to render a neutral retry panel instead of silently falling back
  // to the legacy Start Assessment CTAs.
  const [flowState,         setFlowState]         = useState(null);
  const [flowStateLoading,  setFlowStateLoading]  = useState(true);
  const [flowStateError,    setFlowStateError]    = useState(false);

  useEffect(() => {
    injectKF();
    const params = new URLSearchParams(window.location.search);
    const isPaymentSuccess = params.get('payment') === 'success';
    if (isPaymentSuccess)                       { setPaymentSuccess(true);   window.history.replaceState({}, '', '/dashboard'); }
    if (params.get('payment') === 'cancelled')  { setPaymentCancelled(true); window.history.replaceState({}, '', '/dashboard'); }

    // Post-payment JWT refresh: the user's localStorage token was issued
    // before Stripe webhook fired, so it has paymentVerified=false stale.
    // Hit /api/auth/refresh to mint a fresh JWT from current DB state
    // before any other authenticated calls go out.
    const init = async () => {
      if (isPaymentSuccess && candidate.id) {
        try {
          const refreshRes = await API.post('/api/auth/refresh');
          if (refreshRes.data && refreshRes.data.token) {
            localStorage.setItem('atac_token', refreshRes.data.token);
          }
        } catch (err) {
          console.error('JWT refresh failed (continuing with stale token):', err);
        }
      }
      if (candidate.id) { loadCredentials(); checkPaymentStatus(); loadFlowState(); }
      else { setLoading(false); }
    };
    init();
  }, []);

  const checkPaymentStatus = async () => {
    try {
      const res = await API.get('/api/auth/me');
      const db  = res.data.candidate || {};
      setPaymentVerified(!!db.payment_verified);
      setPaymentTier(db.payment_tier || '');
      setCandidateWallet(db.wallet_address || '');
    } catch (err) { console.error('Payment status check error', err); }
  };

  const loadCredentials = async () => {
    try {
      const res = await API.get(`/api/credentials/candidate/${candidate.id}`);
      setCredentials(res.data.credentials || []);
    } catch (err) { console.error('Load credentials error', err); }
    finally { setLoading(false); }
  };

  // Phase 5: pull the resolved candidate state. One automatic retry on
  // failure (2s delay) before surfacing the retry panel. Success clears
  // both loading and error flags; final failure clears loading and sets
  // error so the UI never silently shows the legacy Start Assessment
  // CTAs while the resolver is unavailable.
  const loadFlowState = async (attempt = 0) => {
    if (attempt === 0) {
      setFlowStateLoading(true);
      setFlowStateError(false);
    }
    try {
      const res = await API.get('/api/candidate/me/state');
      setFlowState(res.data || null);
      setFlowStateLoading(false);
      setFlowStateError(false);
    } catch (err) {
      console.error('Load candidate state error', err);
      if (attempt === 0) {
        setTimeout(() => loadFlowState(1), 2000);
        return;
      }
      setFlowState(null);
      setFlowStateLoading(false);
      setFlowStateError(true);
    }
  };

  /* ----------------------------------------------------------------- */
  /* CHECKOUT HANDLER                                                  */
  /* Redirects to /payment where the consent gate lives. Single        */
  /* checkout surface = one place to maintain legal/consent flow.      */
  /* ----------------------------------------------------------------- */
  const handleCheckout = (tier) => {
    setCheckoutLoading(tier);
    navigate(`/payment?tier=${tier}`);
  };

  const startAssessment = async () => {
    // Photo verification gate. Modal handles tier selection, consent, and
    // headshot upload. Resolves with a result object on success, or null
    // if the user cancels at any step. setStartingAssessment is only set
    // true AFTER the gate resolves with a non-null result.
    const photoResult = await photoVerification.ensure();
    if (!photoResult) {
      return; // user cancelled, no loading state was ever set
    }

    // Intended-tier vs backend-stored-tier handoff: when the candidate
    // intends 'verified', the modal could not promote backend state past
    // 'headshot' because the selfie is not on file yet. Persist the
    // intent so Assessment.jsx can trigger SelfieCapture on mount. For
    // any other tier outcome, clear stale intent from a prior attempt.
    if (photoResult.verificationTier === 'verified') {
      localStorage.setItem('atac_intended_tier', 'verified');
    } else {
      localStorage.removeItem('atac_intended_tier');
    }

    setStartingAssessment(true);
    try {
      const tier = paymentTier || 'standard';
      const res  = await API.post('/api/assessment/start', { candidateId: candidate.id, program: 'CRSA', tier });
      localStorage.setItem('atac_session', JSON.stringify(res.data));
      navigate('/assessment');
    } catch (err) {
      const data = err.response?.data || {};

      // Defensive recovery: server detected verification drift between the
      // candidate row and what the assessment gate requires. Re-open the
      // photo modal and retry the start call after the user re-completes.
      if (data.code === 'HEADSHOT_REQUIRED' || data.code === 'SELFIE_REQUIRED') {
        setStartingAssessment(false);
        const retryResult = await photoVerification.ensure();
        if (retryResult) {
          return startAssessment();
        }
        return;
      }

      const isCooldown = data.code === 'RETAKE_COOLDOWN' || err.response?.status === 429;
      showToast(data.message || data.error || 'Failed to start assessment', {
        type: isCooldown ? 'warning' : 'error',
        title: isCooldown ? 'Retake cooldown' : 'Assessment start failed',
        duration: isCooldown ? 7000 : 4500,
      });
      setStartingAssessment(false);
    }
  };

  const copyLink = (credId, token) => {
    const suffix = token ? `?t=${encodeURIComponent(token)}` : '';
    navigator.clipboard.writeText(`https://app.atacglobalcx.com/verify/${credId}${suffix}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCertificate = (credId) => {
    const token = localStorage.getItem('atac_token') || localStorage.getItem('token');
    if (!token) return;
    const win = window.open('', '_blank');
    // Popup blocker guard: if the new tab was blocked, window.open returns
    // null. Abort before entering the loading state so the button does not
    // appear stuck. Toast tells the candidate how to recover.
    if (!win) {
      showToast('Allow popups for this site to download the certificate, then try again.', true);
      return;
    }
    setDownloading(true);
    fetch(`https://atac-backend-production.up.railway.app/api/credentials/${credId}/certificate/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.text(); })
      .then(html => {
        win.document.open();
        win.document.write(html);
        win.document.close();
        setDownloading(false);
      })
      .catch(() => {
        if (win) win.close();
        showToast('Certificate download failed. Please try again.', true);
        setDownloading(false);
      });
  };

  const saveWallet = async () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletInput)) {
      setWalletError('Invalid address. Must start with 0x and be 42 characters.');
      return;
    }
    setWalletSaving(true);
    setWalletError('');
    try {
      const token = localStorage.getItem('atac_token') || localStorage.getItem('token');
      await fetch('https://atac-backend-production.up.railway.app/api/auth/wallet', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress: walletInput }),
      });
      setCandidateWallet(walletInput);
      setWalletSaved(true);
      setWalletInput('');
      setTimeout(() => setWalletSaved(false), 3000);
    } catch { setWalletError('Failed to save wallet. Please try again.'); }
    finally { setWalletSaving(false); }
  };

  /* -- LinkedIn caption builder - uses real credential data -- */
  const buildLinkedInCaption = (cred) => {
    const credId = cred?.credentialId || '';
    const program = cred?.program || 'CRSA';
    const programLabel =
      program === 'CRSA' ? 'Certified Remote Service Agent (CRSA)' :
      program === 'CCSA' ? 'Certified Customer Service Agent (CCSA)' :
      program === 'CCCA' ? 'Certified Contact Center Agent (CCCA)' :
      program === 'CRSS' ? 'Certified Remote Service Supervisor (CRSS)' :
      program === 'CCSS' ? 'Certified Customer Service Supervisor (CCSS)' :
      program === 'CCSM' ? 'Certified Customer Service Manager (CCSM)' :
      program;
    return `Proud to have earned my ${programLabel} from @ATACGlobalCX, blockchain-verified, globally recognized.\n\nVerify my credential: app.atacglobalcx.com/verify/${credId}\n\n#CXCertified #RemoteWork #BlockchainCredential #CustomerExperience #ATACGlobalCX`;
  };

  const copyLinkedInCaption = (cred) => {
    const caption = buildLinkedInCaption(cred);
    navigator.clipboard?.writeText(caption).then(() => {
      setLinkedInCopied(true);
      setTimeout(() => setLinkedInCopied(false), 3000);
    }).catch(() => {
      showToast('Could not copy. Please select the caption text and copy manually.', true);
    });
  };

  const logout = () => { localStorage.clear(); navigate('/login'); };

  // Phase 5 gate helpers. isFlowReady is true once /me/state has resolved
  // (success). isStartAssessmentStep is the single source of truth for
  // every legacy Start Assessment surface below: each one renders ONLY
  // when the resolver says the next step is to start the assessment.
  // While loading or after the retry exhausted, both flags are false and
  // the legacy CTAs stay hidden so the candidate never sees a stale
  // Start Assessment button competing with the Phase 5 hero.
  const isFlowReady = !!flowState && !!flowState.nextStep;
  const isStartAssessmentStep = isFlowReady && flowState.nextStep === 'start_assessment';
  // Awaiting-simulator: candidate has passed the assessment but not yet
  // completed the simulator. Used to swap state-correct copy on the
  // Welcome subtitle and the empty-certificate panel so the page does
  // not tell a passed candidate to "complete your assessment".
  const isAwaitingSimulator = isFlowReady && flowState.nextStep === 'take_simulator';
  // Simulator-cooldown: candidate failed a sim attempt and is inside the
  // 24h retake window. Used to give the welcome subtitle state-correct
  // copy instead of the stale "complete your assessment" default.
  const isSimulatorCooldown = isFlowReady && flowState.nextStep === 'simulator_cooldown';

  const latestCred = credentials[0];
  const dims       = result?.dimensions || {};
  const hasCred    = credentials.length > 0;
  const firstName  = candidate.name?.split(' ')[0] || 'Candidate';
  const programLabel = latestCred?.program === 'CRSA'
    ? 'Certified Remote Service Agent (CRSA)'
    : (latestCred?.program || 'Credential');
  const issuedDate = latestCred?.issuedAt ? new Date(latestCred.issuedAt).toLocaleDateString() : 'Pending';
  const expiresDate = latestCred?.expiresAt ? new Date(latestCred.expiresAt).toLocaleDateString() : 'Pending';
  const verifyUrl = latestCred?.credentialId ? `https://app.atacglobalcx.com/verify/${latestCred.credentialId}` : '';

  /* -- Shared button styles -- */
  const btnGold = {
    width: '100%', background: GOLD, color: BG, border: 'none', borderRadius: 2,
    padding: '12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
    letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontFamily: VAULT_BODY,
  };
  const btnTeal = {
    width: '100%', background: TEAL, color: WHITE, border: 'none', borderRadius: 2,
    padding: '12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
    letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8,
    fontFamily: VAULT_BODY,
  };
  const btnOut = {
    width: '100%', background: 'transparent', color: MUTED,
    border: `1px solid ${BORDER2}`, borderRadius: 2,
    padding: '11px', fontSize: 11, cursor: 'pointer',
    letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
    fontFamily: VAULT_BODY,
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: VAULT_BODY, color: WHITE }}>

      {/* -- Topbar -- */}
      <div style={{ background: BG3, borderBottom: `1px solid ${BORDER2}`, padding: '18px 34px', minHeight: 84, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src={brandLogo} alt="ATAC Global CX" style={{ height: 62, width: 230, objectFit: 'contain', objectPosition: 'left center' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ fontSize: 15, color: WHITE, fontWeight: 600 }}>{candidate.name}</div>
          {paymentTier && (
            <div style={{ fontSize: 11, background: 'rgba(201,168,76,0.08)', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '5px 12px', color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {paymentTier}
            </div>
          )}
          <LanguageSelector />
          <button onClick={logout} style={{ background: 'none', border: `1px solid ${BORDER2}`, color: MUTED, borderRadius: 2, padding: '9px 16px', fontSize: 14, cursor: 'pointer', fontFamily: VAULT_BODY }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1540, margin: '0 auto', padding: '52px 48px' }}>

        {/* -- Flow state loading / retry panel (replaces the silent
             null-state trap; while /me/state is in flight or after the
             retry exhausted, render a neutral panel instead of falling
             back to legacy Start Assessment surfaces) -- */}
        {flowStateLoading && !hasCred && (
          <div className="vault-up" style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '22px 26px', marginBottom: 24, color: MUTED, fontSize: 13, letterSpacing: '0.06em' }}>
            Loading your dashboard...
          </div>
        )}
        {flowStateError && !hasCred && (
          <div className="vault-up" role="alert" style={{ background: 'rgba(196,138,42,0.07)', border: '1px solid rgba(196,138,42,0.28)', borderRadius: 4, padding: '22px 26px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 12, color: AMBER, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Dashboard unavailable</div>
              <div style={{ fontSize: 14, color: WHITE, lineHeight: 1.55 }}>We could not load your next step. Refresh to try again.</div>
            </div>
            <button
              type="button"
              onClick={() => loadFlowState(0)}
              style={{ background: 'transparent', color: AMBER, border: `1px solid ${AMBER}`, borderRadius: 2, padding: '10px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: VAULT_BODY }}
            >
              Refresh
            </button>
          </div>
        )}

        {/* -- Payment success banner (gated on the resolver agreeing the
             next step is the assessment; prevents the banner re-firing
             for a candidate whose nextStep is take_simulator) -- */}
        {paymentSuccess && isStartAssessmentStep && (
          <div className="vault-up" style={{ background: 'rgba(26,143,105,0.08)', border: '1px solid rgba(26,143,105,0.25)', borderRadius: 4, padding: '24px 30px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 22 }}>
            <div>
              <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 26, color: TEAL2, marginBottom: 6 }}>Payment Confirmed: You're Ready to Begin</div>
              <div style={{ fontSize: 14, color: MUTED }}>Your assessment session is ready. Click to start your 40-question timed assessment.</div>
            </div>
            <button className="btn-gold-h" style={{ ...btnGold, width: 'auto', padding: '15px 34px', whiteSpace: 'nowrap', marginBottom: 0, opacity: startingAssessment ? 0.7 : 1 }} onClick={startAssessment} disabled={startingAssessment}>
              {startingAssessment ? 'Starting...' : 'Start Assessment →'}
            </button>
          </div>
        )}

        {/* -- Payment cancelled banner -- */}
        {paymentCancelled && (
          <div className="vault-up" style={{ background: 'rgba(196,92,92,0.07)', border: '1px solid rgba(196,92,92,0.22)', borderRadius: 3, padding: '16px 22px', marginBottom: 20 }}>
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, color: RED, marginBottom: 4 }}>Payment Cancelled</div>
            <div style={{ fontSize: 12, color: MUTED }}>No charge was made. You can restart checkout whenever you're ready.</div>
          </div>
        )}

        {/* -- Assessment ready banner (paid, not started). Gated on the
             resolver so a candidate who has already passed (next step is
             take_simulator) never sees this stale banner. -- */}
        {!paymentSuccess && isStartAssessmentStep && (
          <div className="vault-up" style={{ background: 'rgba(91,168,212,0.07)', border: '1px solid rgba(91,168,212,0.22)', borderRadius: 4, padding: '24px 30px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 22 }}>
            <div>
              <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 26, color: '#5BA8D4', marginBottom: 6 }}>Your Assessment Is Ready</div>
              <div style={{ fontSize: 14, color: MUTED }}>Payment verified{paymentTier ? ` · ${paymentTier.toUpperCase()} tier` : ''}. Start your 40-question timed assessment when you're ready.</div>
            </div>
            <button className="btn-gold-h" style={{ ...btnGold, width: 'auto', padding: '15px 34px', whiteSpace: 'nowrap', marginBottom: 0, opacity: startingAssessment ? 0.7 : 1 }} onClick={startAssessment} disabled={startingAssessment}>
              {startingAssessment ? 'Starting...' : 'Start Assessment →'}
            </button>
          </div>
        )}

        {/* Charter Cohort counter, universal across all dashboard render branches */}
        <CharterCounter variant="compact" />

        {/* Phase 5: candidate state-machine hero block. Returns null for
            view_credential / start_assessment / register (Dashboard's
            existing render handles those) and when the Pioneer card at
            line 500 is already covering pioneer_revalidate. */}
        <CandidateStateRenderer
          flowState={flowState}
          navigate={navigate}
          pioneerCardActive={credentials.some(
            (c) => c.simulator_verified === false || c.simulatorVerified === false
          )}
          onOpenPhotoVerification={() => { photoVerification.ensure().catch(() => {}); }}
        />

        {hasCred && latestCred && (
          <div className="vault-up">
            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(460px,0.95fr)', gap: 30, alignItems: 'stretch', marginBottom: 30 }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(34,166,126,0.13), rgba(12,16,24,0.96) 48%, rgba(201,168,76,0.07))', border: '1px solid rgba(34,166,126,0.28)', borderRadius: 4, padding: '42px 46px', minHeight: 430, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: TEAL2, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14 }}>Certified Agent Dashboard</div>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 64, fontWeight: 300, color: WHITE, lineHeight: 0.98, marginBottom: 18 }}>
                    Welcome back, {firstName}.
                  </div>
                  <div style={{ fontSize: 17, color: 'rgba(238,233,223,0.72)', lineHeight: 1.75, maxWidth: 720 }}>
                    Your certification is active, verifiable, and ready to share. This dashboard should feel like a credential command center, not a small receipt.
                  </div>
                </div>

                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, margin: '30px 0 22px' }}>
                    {[
                      { label: 'Status', value: 'Valid', color: TEAL2 },
                      { label: 'Program', value: latestCred.program || 'CRSA', color: GOLD },
                      { label: 'Issued', value: issuedDate, color: WHITE },
                      { label: 'Expires', value: expiresDate, color: WHITE },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'rgba(238,233,223,0.025)', border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '18px 16px', minHeight: 86 }}>
                        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, color: item.color, lineHeight: 1 }}>{item.value}</div>
                        <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 10 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="btn-gold-h" style={{ ...btnGold, width: 'auto', minWidth: 210, padding: '15px 24px', marginBottom: 0, fontSize: 12 }} onClick={() => downloadCertificate(latestCred.credentialId)} disabled={downloading}>
                      {downloading ? 'Opening certificate...' : 'Download PDF Certificate'}
                    </button>
                    <button className="btn-out-h" style={{ ...btnOut, width: 'auto', minWidth: 210, padding: '14px 24px', marginBottom: 0, color: WHITE, fontSize: 12 }} onClick={() => copyLink(latestCred.credentialId, latestCred.verificationToken)}>
                      {copied ? 'Copied' : 'Copy Verification Link'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '30px 34px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <div style={{ fontSize: 12, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Your Certificate</div>
                  <div style={{ fontSize: 12, color: TEAL2, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Blockchain Verified</div>
                </div>
                <div style={{ background: '#F5F0E4', border: '1px solid #D4C89A', borderRadius: 3, padding: '26px', color: '#1a1208', minHeight: 330 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e0d5b0', paddingBottom: 14, marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8a7040', marginBottom: 4 }}>ATAC Global CX - Verified Credentials</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#3d2e0a' }}>Certificate of Achievement</div>
                    </div>
                    <div aria-label="ATAC Global CX verified credential seal" style={{ width: 48, height: 48, borderRadius: '50%', background: 'radial-gradient(circle at 50% 38%, #173251 0%, #0D1B2E 44%, #07101F 100%)', border: '2px solid #C9A84C', boxShadow: '0 0 0 4px rgba(201,168,76,0.10), inset 0 0 0 2px rgba(245,240,228,0.16), 0 0 16px rgba(201,168,76,0.30)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 8, lineHeight: 1, color: '#F5F0E4', fontWeight: 800, letterSpacing: 0 }}>ATAC</div>
                      <div style={{ width: 22, height: 1, background: '#C9A84C', margin: '3px 0 2px' }} />
                      <div style={{ fontSize: 13, lineHeight: 1, color: '#F3C642', fontWeight: 900, letterSpacing: 0 }}>CX</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8a7040', textAlign: 'center', marginBottom: 5 }}>Certificate of Achievement</div>
                  <div style={{ fontSize: 11, color: '#8a7040', textAlign: 'center', marginBottom: 6 }}>Proudly Presented To</div>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontStyle: 'italic', fontSize: 30, color: '#1a1208', textAlign: 'center', marginBottom: 6 }}>{candidate.name}</div>
                  <div style={{ fontSize: 14, color: '#0F6E56', textAlign: 'center', fontWeight: 700, marginBottom: 22 }}>{programLabel}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid #e0d5b0', paddingTop: 16, marginBottom: 16 }}>
                    {[
                      { k: 'Credential ID', v: latestCred.credentialId },
                      { k: 'Issue Date', v: issuedDate },
                      { k: 'Status', v: 'Valid', vc: '#0F6E56' },
                      { k: 'Expires', v: expiresDate },
                    ].map(item => (
                      <div key={item.k}>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8a7040' }}>{item.k}</div>
                        <div style={{ fontSize: 13, color: item.vc || '#1a1208', fontWeight: 700, marginTop: 3 }}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, borderTop: '1px solid #e0d5b0', paddingTop: 10 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#0F6E56', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#8a7040' }}>Blockchain-verified credential</span>
                  </div>
                </div>
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 460px', gap: 30, alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: 20 }}>
                <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '30px 34px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-end', marginBottom: 22 }}>
                    <div>
                      <div style={{ fontSize: 12, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>My Credentials</div>
                      <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 34, color: WHITE, fontWeight: 300 }}>Active credential record</div>
                    </div>
                    <span style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(26,143,105,0.12)', border: '1px solid rgba(26,143,105,0.25)', color: TEAL2, borderRadius: 2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Valid</span>
                  </div>

                  {credentials.map((cred, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr) 150px', gap: 18, alignItems: 'center', background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '20px 22px', marginBottom: i < credentials.length - 1 ? 12 : 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(26,143,105,0.12)', border: '1px solid rgba(26,143,105,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEAL2, fontSize: 20 }}>✓</div>
                      <div>
                        <div style={{ fontSize: 17, color: WHITE, fontWeight: 700, marginBottom: 5 }}>{cred.program}</div>
                        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{cred.credentialId} | Issued {new Date(cred.issuedAt).toLocaleDateString()}</div>
                      </div>
                      <button className="btn-out-h" style={{ ...btnOut, marginBottom: 0, padding: '12px 14px', fontSize: 11, color: WHITE }} onClick={() => window.open(`https://app.atacglobalcx.com/verify/${cred.credentialId}`, '_blank')}>
                        View Public Page
                      </button>
                    </div>
                  ))}

                  {/* Public Registry consent toggle. Relocated here from
                      the bottom of the right-hand column so the privacy
                      control sits next to the credential it governs.
                      Component is self-contained; relocation does not
                      affect its read/write API wiring. */}
                  <div style={{ marginTop: 20 }}>
                    <RegistryConsentCard />
                  </div>
                </div>

                {/*
                  M2: Pioneer simulator supplementary-attempt card.
                  Renders only when the candidate holds at least one credential
                  whose simulator_verified flag is explicitly false (the
                  grandfathered Pioneer state). Defensive snake/camel read:
                  the backend may emit either casing on the credential row.
                  Undefined / missing field does NOT qualify, by design.
                */}
                {(() => {
                  const pioneerCred = credentials.find(
                    (c) => c.simulator_verified === false || c.simulatorVerified === false
                  );
                  if (!pioneerCred) return null;
                  return (
                    <div
                      style={{
                        background: 'linear-gradient(135deg, rgba(201,168,76,0.08), rgba(26,143,105,0.06))',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 4,
                        padding: '26px 30px',
                      }}
                    >
                      <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>
                        Pioneer testers, validate your credential
                      </div>
                      <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 24, color: WHITE, fontWeight: 400, lineHeight: 1.2, marginBottom: 10 }}>
                        Validate your credential with the Call Readiness Simulator
                      </div>
                      <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, margin: '0 0 18px' }}>
                        You earned your credential under our original criteria. Want to take it further with our live-call simulator?
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate(`/simulator?credential_id=${encodeURIComponent(pioneerCred.credentialId)}&choose=true`)}
                        style={{
                          background: GOLD,
                          color: BG,
                          border: 'none',
                          borderRadius: 2,
                          padding: '12px 22px',
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          fontFamily: VAULT_BODY,
                        }}
                      >
                        Take the simulator
                      </button>
                    </div>
                  );
                })()}

                <div style={{ background: 'linear-gradient(135deg, rgba(26,143,105,0.10), rgba(201,168,76,0.06))', border: '1px solid rgba(26,143,105,0.28)', borderRadius: 4, padding: '28px 34px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 180px', gap: 24, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: TEAL2, marginBottom: 10 }}>ISORA Community</div>
                    <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 30, fontWeight: 300, color: WHITE, marginBottom: 8 }}>You're invited to join the network.</div>
                    <div style={{ fontSize: 14, color: 'rgba(238,233,223,0.66)', lineHeight: 1.75 }}>Connect with certified CX professionals, access job leads, peer support, and resources built for remote CX excellence.</div>
                  </div>
                  <a href="https://jeuumk0um700vulubke9.app.clientclub.net/communities/groups/cxgroup/home?invite=69ef67f4271fe1ed0adb9f82" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: TEAL, color: WHITE, textDecoration: 'none', padding: '15px 20px', borderRadius: 2, fontFamily: VAULT_BODY, fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase' }}>
                    Join ISORA
                  </a>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '24px 26px' }}>
                  <div style={{ fontSize: 12, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 16 }}>Credential Actions</div>
                  <button className="btn-gold-h" style={{ ...btnTeal, padding: '14px', fontSize: 12, marginBottom: 0 }} onClick={() => {
                    const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=Certified+Remote+Service+Agent+(CRSA)&organizationId=ATAC&certUrl=${verifyUrl}&certId=${latestCred.credentialId}`;
                    window.open(url, '_blank');
                  }}>
                    Add to LinkedIn Profile
                  </button>
                </div>

                <div style={{ background: BG1, border: '1px solid rgba(10,102,194,0.32)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ background: 'rgba(10,102,194,0.13)', borderBottom: '1px solid rgba(10,102,194,0.2)', padding: '14px 18px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5B9BD5' }}>Share on LinkedIn</div>
                  </div>
                  <div style={{ padding: '18px' }}>
                    {[
                      { n: '01', t: 'Copy your caption' },
                      { n: '02', t: 'Open LinkedIn and paste it' },
                    ].map(step => (
                      <div key={step.n} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${BORDER2}` }}>
                        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 18, color: 'rgba(10,102,194,0.8)', minWidth: 28 }}>{step.n}</div>
                        <div style={{ fontSize: 14, color: WHITE, fontWeight: 600 }}>{step.t}</div>
                      </div>
                    ))}
                    <div style={{ marginTop: 16, background: 'rgba(0,0,0,0.22)', border: `1px solid ${BORDER2}`, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderBottom: `1px solid ${BORDER2}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD }}>Your Caption</div>
                        <button onClick={() => copyLinkedInCaption(latestCred)} style={{ background: linkedInCopied ? 'rgba(26,143,105,0.15)' : 'rgba(201,168,76,0.10)', border: `1px solid ${linkedInCopied ? 'rgba(26,143,105,0.4)' : BORDER}`, borderRadius: 2, padding: '5px 11px', fontSize: 10, color: linkedInCopied ? TEAL2 : GOLD, cursor: 'pointer', fontFamily: VAULT_BODY, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {linkedInCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div style={{ padding: '12px', fontSize: 12, color: MUTED, lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: VAULT_BODY }}>
                        {buildLinkedInCaption(latestCred)}
                      </div>
                    </div>
                    <button onClick={() => window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank')} style={{ width: '100%', marginTop: 14, background: '#0A66C2', border: 'none', color: '#fff', borderRadius: 2, padding: '13px', fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: VAULT_BODY }}>
                      Open LinkedIn → Create Post
                    </button>
                  </div>
                </div>

                <CharterCohortBlock credentialId={latestCred?.credentialId} />

                {!candidateWallet ? (
                  <div style={{ background: 'rgba(201,168,76,0.05)', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '22px 24px' }}>
                    <div style={{ fontSize: 12, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Enable Blockchain Verification</div>
                    <div style={{ fontSize: 14, color: MUTED, marginBottom: 14, lineHeight: 1.65 }}>Add your wallet address to receive blockchain credentials directly.</div>
                    <input style={{ width: '100%', background: FAINT, border: `1px solid ${walletError ? 'rgba(196,92,92,0.5)' : BORDER2}`, borderRadius: 2, padding: '13px 14px', fontSize: 14, color: WHITE, outline: 'none', boxSizing: 'border-box', marginBottom: 10, fontFamily: VAULT_BODY }} placeholder="0x... your EVM wallet address" value={walletInput} onChange={e => { setWalletInput(e.target.value); setWalletError(''); }} />
                    {walletError && <div style={{ fontSize: 12, color: RED, marginBottom: 10 }}>{walletError}</div>}
                    <button className="btn-gold-h" style={{ ...btnGold, marginBottom: 0, padding: '13px', fontSize: 12, opacity: walletSaving ? 0.7 : 1 }} onClick={saveWallet} disabled={walletSaving || !walletInput}>
                      {walletSaving ? 'Saving...' : 'Save Wallet Address'}
                    </button>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(26,143,105,0.05)', border: '1px solid rgba(26,143,105,0.18)', borderRadius: 4, padding: '20px 22px' }}>
                    {walletSaved && <div style={{ fontSize: 13, color: TEAL2, marginBottom: 8 }}>Wallet saved - blockchain minting enabled</div>}
                    <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Blockchain Wallet</div>
                    <div style={{ fontSize: 13, color: MUTED, wordBreak: 'break-all', fontFamily: 'monospace' }}>{candidateWallet}</div>
                  </div>
                )}
              </div>
            </section>

            <section style={{ marginTop: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-end', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>Public Certificate Preview</div>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 34, color: WHITE, fontWeight: 300 }}>How your credential appears when shared</div>
                </div>
                <button className="btn-out-h" style={{ ...btnOut, width: 'auto', minWidth: 190, marginBottom: 0, padding: '12px 18px', color: WHITE }} onClick={() => copyLink(latestCred.credentialId, latestCred.verificationToken)}>
                  {copied ? 'Copied' : 'Copy Public Link'}
                </button>
              </div>

              <div style={{ background: 'radial-gradient(circle at 50% 42%, rgba(201,168,76,0.08), rgba(4,4,10,0) 34%), #04040A', border: '1px solid rgba(201,168,76,0.22)', borderRadius: 4, padding: '46px 54px', minHeight: 430, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 18, border: '1px solid rgba(201,168,76,0.10)', borderRadius: 3, pointerEvents: 'none' }} />
                <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase' }}>ATAC Global CX - Verified Credential - ERC-721 - Blockchain Verified</div>
                <div style={{ fontFamily: VAULT_DISPLAY, fontStyle: 'italic', fontSize: 58, color: WHITE, marginTop: 8 }}>{candidate.name}</div>
                <div style={{ fontSize: 16, color: TEAL2, fontWeight: 700, letterSpacing: '0.08em' }}>{programLabel}</div>
                <img src={certificateSeal} alt="ATAC Global CX Certification Authority" style={{ width: 180, height: 180, borderRadius: '50%', objectFit: 'cover', border: '2px solid #C9A84C', margin: '14px 0', boxShadow: '0 0 0 5px rgba(201,168,76,0.08), 0 0 56px rgba(201,168,76,0.34)' }} />
                <div style={{ fontSize: 14, color: 'rgba(238,233,223,0.62)', maxWidth: 760, lineHeight: 1.8, fontStyle: 'italic' }}>
                  In recognition of demonstrated excellence in remote customer experience operations, professional conduct, and commitment to the highest standards of the global CX industry.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 14, width: '100%', maxWidth: 840, marginTop: 20 }}>
                  {[
                    { k: 'Credential ID', v: latestCred.credentialId },
                    { k: 'Issue Date', v: issuedDate },
                    { k: 'Status', v: 'Valid', vc: TEAL2 },
                    { k: 'Expires', v: expiresDate },
                  ].map(item => (
                    <div key={item.k} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.16)', borderRadius: 3, padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: GOLD, marginBottom: 5 }}>{item.k}</div>
                      <div style={{ fontSize: 13, color: item.vc || WHITE, fontWeight: 700 }}>{item.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: TEAL2 }} />
                  <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Blockchain-Verified - ERC-721 - Mainnet</span>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* -- Welcome line -- */}
        {!hasCred && <div className="vault-up" style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 46, fontWeight: 300, color: WHITE, lineHeight: 1.05 }}>
            {`Welcome, ${firstName}.`}
          </div>
          <div style={{ fontSize: 15, color: MUTED, marginTop: 8 }}>
            {isSimulatorCooldown
              ? 'Your last attempt is saved. The simulator reopens automatically when the timer ends.'
              : isAwaitingSimulator
                ? 'You passed the assessment. Complete the ATAC Call Readiness Simulator to earn your credential.'
                : 'Complete your assessment to earn your blockchain-verified credential.'}
          </div>
        </div>}

        {isStartAssessmentStep && (
          <div className="vault-up" style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '30px 34px', marginBottom: 28, display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 30, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 22 }}>
              <div>
                <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Assessment Launch</div>
                <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 42, color: WHITE, fontWeight: 300, lineHeight: 1.08, marginBottom: 10 }}>Remote CX Readiness Assessment</div>
                <div style={{ fontSize: 15, color: MUTED, lineHeight: 1.7, maxWidth: 680 }}>Your payment is verified. Complete the timed assessment to unlock your blockchain-verified credential path.</div>
              </div>
              <button className="btn-gold-h" style={{ ...btnGold, width: 300, padding: '16px 24px', marginBottom: 0, fontSize: 12 }} onClick={startAssessment} disabled={startingAssessment}>
                {startingAssessment ? 'Starting...' : 'Start Assessment'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { val: '40', lbl: 'Questions' },
                { val: '40', lbl: 'Minutes' },
                { val: '70%', lbl: 'Pass Mark' },
              ].map((m, i) => (
                <div key={i} style={{ background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '20px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 42, color: GOLD, fontWeight: 300, lineHeight: 1 }}>{m.val}</div>
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 9 }}>{m.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* -- Assessment result -- */}
        {!hasCred && result && (
          <div className="vault-up" style={{ background: BG1, border: `1px solid ${result.passed ? 'rgba(26,143,105,0.25)' : 'rgba(196,92,92,0.25)'}`, borderRadius: 3, padding: '22px 24px', marginBottom: 24 }}>
            <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18 }}>Latest Assessment Result</div>

            {/* Score row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
              {[
                { val: result.score,      lbl: 'Score / 40',  color: GOLD },
                { val: `${result.percentage}%`, lbl: 'Percentage', color: result.passed ? TEAL2 : RED },
                { val: result.passed ? 'PASS' : 'FAIL', lbl: 'Status', color: result.passed ? TEAL2 : RED },
                { val: '28',              lbl: 'Pass Mark',   color: GOLD },
              ].map((s, i) => (
                <div key={i} style={{ background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, color: s.color, fontWeight: 300, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 4 }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Dimension bars */}
            {Object.keys(dims).length > 0 && (
              <>
                <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>Performance by Domain</div>
                {DIM_LABELS.map((label, i) => {
                  const key = DIM_KEYS[i] || Object.keys(dims)[i];
                  const pct = dims[key] || 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: MUTED, width: 160, flexShrink: 0 }}>{label}</div>
                      <div style={{ flex: 1, height: 3, background: BORDER2, borderRadius: 2 }}>
                        <div style={{ height: 3, width: `${pct}%`, background: DIM_COLORS[i], borderRadius: 2, transition: 'width 1s ease' }} />
                      </div>
                      <div style={{ fontSize: 12, color: WHITE, width: 34, textAlign: 'right' }}>{pct}%</div>
                    </div>
                  );
                })}
              </>
            )}

            {result.passed && credentials.length === 0 && (
              <button className="btn-gold-h" style={{ ...btnGold, marginTop: 16, marginBottom: 0 }} onClick={() => navigate('/simulator?auto=true')}>
                Proceed to Call Readiness Simulator™ →
              </button>
            )}
          </div>
        )}

        {/* -- Main grid -- */}
        {!hasCred && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 420px', gap: 28 }}>

          {/* -- LEFT: credentials / get started -- */}
          <div>

            {/* My Credentials card */}
            <div className="vault-up" style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '32px 36px', marginBottom: 20, minHeight: 230 }}>
              <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 20 }}>My Credentials</div>

              {loading ? (
                <div style={{ color: MUTED, fontSize: 13 }}>Loading…</div>
              ) : credentials.length === 0 ? (
                // Phase 5: render the original empty state ONLY when the
                // resolver explicitly says start_assessment. While loading
                // or after the retry exhausted, hide the legacy CTA so
                // the candidate never sees a stale Start Assessment
                // button. The retry panel at the top handles the failure
                // state separately.
                isStartAssessmentStep ? (
                <div style={{ textAlign: 'center', padding: '42px 0' }}>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, color: WHITE, fontWeight: 300, marginBottom: 8 }}>No credentials issued yet.</div>
                  <div style={{ fontSize: 14, color: MUTED, marginBottom: 24 }}>Your certificate appears here after you pass the assessment.</div>
                  {paymentVerified ? (
                    <button
                      className="btn-gold-h"
                      style={{ ...btnGold, width: 'auto', padding: '14px 34px', margin: '0 auto', opacity: startingAssessment ? 0.7 : 1 }}
                      onClick={startAssessment}
                      disabled={startingAssessment}
                    >
                      {startingAssessment ? 'Starting...' : 'Start Assessment →'}
                    </button>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                      {[
                        { tier: 'standard', price: '$39', title: 'Standard', copy: 'Full assessment access with credential pathway and dashboard unlock.' },
                        { tier: 'pro',      price: '$59', title: 'Pro',      copy: 'Pro tier with priority pathway, gap analysis, and premium positioning.' },
                      ].map(p => (
                        <div key={p.tier} style={{ background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '18px' }}>
                          <div style={{ fontSize: 12, color: WHITE, marginBottom: 6 }}>{p.title}</div>
                          <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, color: GOLD, fontWeight: 300, marginBottom: 10 }}>{p.price}</div>
                          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 14 }}>{p.copy}</div>
                          <button className="btn-gold-h" style={{ ...btnGold, marginBottom: 0 }} onClick={() => handleCheckout(p.tier)} disabled={!!checkoutLoading}>
                            {checkoutLoading === p.tier ? 'Redirecting…' : `Buy ${p.title}`}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                ) : null
              ) : (
                credentials.map((cred, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '14px 16px', marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(26,143,105,0.12)', border: '1px solid rgba(26,143,105,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 13, color: TEAL2 }}>✓</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: WHITE }}>{cred.program}</div>
                      <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{cred.credentialId} · Issued {new Date(cred.issuedAt).toLocaleDateString()}</div>
                    </div>
                    <span style={{ fontSize: 9, padding: '3px 9px', background: 'rgba(26,143,105,0.1)', border: '1px solid rgba(26,143,105,0.22)', color: TEAL2, borderRadius: 1, letterSpacing: '0.1em' }}>VALID</span>
                  </div>
                ))
              )}
            </div>
{/* ISORA Community CTA - visible only after credential issued */}
            {hasCred && (
              <div className="vault-up" style={{
                background: 'linear-gradient(135deg, rgba(26,143,105,0.08), rgba(201,168,76,0.05))',
                border: '1px solid rgba(26,143,105,0.25)',
                borderRadius: 3, padding: '20px 24px', marginBottom: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', color: TEAL2, marginBottom: 8 }}>
                    ISORA Community
                  </div>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 20, fontWeight: 300, color: WHITE, marginBottom: 6, lineHeight: 1.2 }}>
                    You're invited to join the network.
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
                    Connect with certified CX professionals globally. Access job leads, peer support, and resources inside ISORA, the community built for remote CX excellence.
                  </div>
                </div>

                  <a href="https://jeuumk0um700vulubke9.app.clientclub.net/communities/groups/cxgroup/home?invite=69ef67f4271fe1ed0adb9f82"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: TEAL, color: WHITE, textDecoration: 'none',
                    padding: '11px 22px', borderRadius: 2, whiteSpace: 'nowrap',
                    fontFamily: VAULT_BODY, fontSize: 10, fontWeight: 600,
                    letterSpacing: '.18em', textTransform: 'uppercase', flexShrink: 0,
                  }}
                >
                  Join ISORA
                </a>
              </div>
            )}
            {/* Get started / pricing (no payment) */}
            {!result && credentials.length === 0 && !paymentVerified && (
              <div className="vault-up" style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '22px 24px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>Get Started</div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 20 }}>
                  Choose your assessment tier to unlock the Remote CX Readiness Assessment™ and begin your certification path.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { tier: 'standard', price: '$39', title: 'Standard', copy: 'Core assessment access for candidates ready to prove their remote CX readiness.' },
                    { tier: 'pro',      price: '$59', title: 'Pro',      copy: 'Premium candidate path with stronger positioning and higher-value access.' },
                  ].map(p => (
                    <div key={p.tier} style={{ background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '18px' }}>
                      <div style={{ fontSize: 12, color: WHITE, marginBottom: 6 }}>{p.title}</div>
                      <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, color: GOLD, fontWeight: 300, marginBottom: 10 }}>{p.price}</div>
                      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 14 }}>{p.copy}</div>
                      <button className="btn-gold-h" style={{ ...btnGold, marginBottom: 0 }} onClick={() => handleCheckout(p.tier)} disabled={!!checkoutLoading}>
                        {checkoutLoading === p.tier ? 'Redirecting…' : `Buy ${p.title}`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Start assessment (resolver-gated). Hidden for take_simulator
                and every other non-start_assessment state so it stops
                competing with the Phase 5 hero. */}
            {isStartAssessmentStep && (
              <div className="vault-up" style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '30px 36px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>Ready to Begin</div>
                <div style={{ fontSize: 15, color: MUTED, lineHeight: 1.7, marginBottom: 22 }}>
                  Your payment is verified. Launch the Remote CX Readiness Assessment™ when you're ready.
                </div>
                <button
                  className="btn-gold-h"
                  style={{ ...btnGold, padding: '15px', opacity: startingAssessment ? 0.7 : 1 }}
                  onClick={startAssessment}
                  disabled={startingAssessment}
                >
                  {startingAssessment ? 'Starting...' : 'Start Assessment: CRSA'}
                </button>
              </div>
            )}
          </div>

          {/* -- RIGHT: certificate panel -- */}
          <div>
            {latestCred ? (
              <div className="vault-up">

                {/* Certificate card - parchment style on dark */}
                <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>Your Certificate</div>
                <div style={{ background: '#F5F0E4', border: '1px solid #D4C89A', borderRadius: 3, padding: '22px', color: '#1a1208', marginBottom: 14 }}>

                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e0d5b0', paddingBottom: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8a7040', marginBottom: 3 }}>ATAC Global CX · Verified Credentials</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#3d2e0a' }}>Certificate of Achievement</div>
                    </div>
                    <div aria-label="ATAC Global CX verified credential seal" style={{ width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle at 50% 38%, #173251 0%, #0D1B2E 44%, #07101F 100%)', border: '2px solid #C9A84C', boxShadow: '0 0 0 3px rgba(201,168,76,0.10), inset 0 0 0 2px rgba(245,240,228,0.16)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 7, lineHeight: 1, color: '#F5F0E4', fontWeight: 800, letterSpacing: 0 }}>ATAC</div>
                      <div style={{ width: 18, height: 1, background: '#C9A84C', margin: '2px 0' }} />
                      <div style={{ fontSize: 11, lineHeight: 1, color: '#F3C642', fontWeight: 900, letterSpacing: 0 }}>CX</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8a7040', textAlign: 'center', marginBottom: 4 }}>Certificate of Achievement</div>
                  <div style={{ fontSize: 10, color: '#8a7040', textAlign: 'center', marginBottom: 4 }}>Proudly Presented To</div>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontStyle: 'italic', fontSize: 22, color: '#1a1208', textAlign: 'center', marginBottom: 4 }}>{candidate.name}</div>
                  <div style={{ fontSize: 12, color: '#0F6E56', textAlign: 'center', fontWeight: 600, marginBottom: 16 }}>
                    {latestCred.program === 'CRSA' ? 'Certified Remote Service Agent (CRSA)' : latestCred.program}
                  </div>

                  {/* Meta grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid #e0d5b0', paddingTop: 14, marginBottom: 14 }}>
                    {[
                      { k: 'Credential ID', v: latestCred.credentialId },
                      { k: 'Issue Date',    v: new Date(latestCred.issuedAt).toLocaleDateString() },
                      { k: 'Status',        v: 'Valid', vc: '#0F6E56' },
                      { k: 'Expires',       v: new Date(latestCred.expiresAt).toLocaleDateString() },
                    ].map((m, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8a7040' }}>{m.k}</div>
                        <div style={{ fontSize: 11, color: m.vc || '#1a1208', fontWeight: 600, marginTop: 2 }}>{m.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #e0d5b0', paddingTop: 10 }}>
                    <div style={{ fontSize: 9, color: '#8a7040' }}>Verify at<br /><strong style={{ fontSize: 10, color: '#3d2e0a' }}>atacglobalcx.com/verify</strong></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ width: 60, height: 1, background: '#8a7040', marginBottom: 3, marginLeft: 'auto' }} />
                      <div style={{ fontSize: 9, fontWeight: 600, color: '#3d2e0a' }}>Tugreofia Smith</div>
                      <div style={{ fontSize: 8, color: '#8a7040' }}>CEO & Lead Instructor</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, borderTop: '1px solid #e0d5b0', paddingTop: 8, marginTop: 8 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#0F6E56', flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: '#8a7040' }}>Blockchain-Verified Credential</span>
                  </div>
                </div>

                {/* Action buttons */}
                <button className="btn-gold-h" style={btnGold} onClick={() => downloadCertificate(latestCred.credentialId)} disabled={downloading}>
                  {downloading ? 'Opening certificate...' : '↓ Download PDF Certificate'}
                </button>
                <button className="btn-gold-h" style={btnGold} onClick={() => copyLink(latestCred.credentialId, latestCred.verificationToken)}>
                  {copied ? '✓ Copied!' : 'Copy Verification Link'}
                </button>
                <button className="btn-gold-h" style={btnTeal} onClick={() => {
                  const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=Certified+Remote+Service+Agent+(CRSA)&organizationId=ATAC&certUrl=https://app.atacglobalcx.com/verify/${latestCred.credentialId}&certId=${latestCred.credentialId}`;
                  window.open(url, '_blank');
                }}>
                  Add to LinkedIn Profile
                </button>

                {/* -- LINKEDIN SHARE CARD ------------------------------- */}
                <div style={{ background: BG1, border: '1px solid rgba(10,102,194,0.3)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>

                  {/* Header */}
                  <div style={{ background: 'rgba(10,102,194,0.12)', borderBottom: '1px solid rgba(10,102,194,0.2)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#0A66C2">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5B9BD5' }}>Share on LinkedIn</div>
                  </div>

                  <div style={{ padding: '12px 14px' }}>

                    {/* Steps */}
                    {[
                      { n: '01', t: 'Download your certificate', d: 'Click "Download PDF Certificate" above to save your file.' },
                      { n: '02', t: 'Go to LinkedIn → Create a Post', d: 'Click "Start a post", then upload your certificate as the image.' },
                      { n: '03', t: 'Copy the caption below', d: 'Click Copy, then paste it into your LinkedIn post.' },
                      { n: '04', t: 'Post it', d: 'Hit Post. Your blockchain-verified credential is now live for employers.' },
                    ].map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 4px', marginBottom: 2 }}>
                        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 13, fontWeight: 300, color: 'rgba(10,102,194,0.7)', flexShrink: 0, lineHeight: 1, paddingTop: 2, minWidth: 18 }}>{step.n}</div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: WHITE, marginBottom: 1 }}>{step.t}</div>
                          <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.5 }}>{step.d}</div>
                        </div>
                      </div>
                    ))}

                    {/* Caption box */}
                    <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.2)', border: `1px solid ${BORDER2}`, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderBottom: `1px solid ${BORDER2}` }}>
                        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD }}>Your Caption</div>
                        <button
                          onClick={() => copyLinkedInCaption(latestCred)}
                          style={{
                            background: linkedInCopied ? 'rgba(26,143,105,0.15)' : 'rgba(201,168,76,0.10)',
                            border: `1px solid ${linkedInCopied ? 'rgba(26,143,105,0.4)' : BORDER}`,
                            borderRadius: 2, padding: '3px 9px',
                            fontSize: 9, color: linkedInCopied ? TEAL2 : GOLD,
                            cursor: 'pointer', fontFamily: VAULT_BODY,
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                            transition: 'all 0.2s', whiteSpace: 'nowrap',
                          }}
                        >
                          {linkedInCopied ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <div style={{ padding: '10px', fontSize: 10, color: MUTED, lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: VAULT_BODY }}>
                        {buildLinkedInCaption(latestCred)}
                      </div>
                    </div>

                    {/* Open LinkedIn button */}
                    <button
                      onClick={() => window.open('https://www.linkedin.com/feed/', '_blank')}
                      style={{
                        width: '100%', marginTop: 10,
                        background: '#0A66C2', color: '#fff',
                        border: 'none', borderRadius: 2,
                        padding: '10px', fontFamily: VAULT_BODY,
                        fontSize: 10, fontWeight: 600,
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: 7,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      Open LinkedIn → Create Post
                    </button>

                  </div>
                </div>
                {/* -- END LINKEDIN SHARE CARD --------------------------- */}

                <button className="btn-out-h" style={btnOut} onClick={() => navigate('/assessment')}>
                  Start New Assessment
                </button>

                {/* Wallet section */}
                {!candidateWallet ? (
                  <div style={{ marginTop: 4, background: 'rgba(201,168,76,0.05)', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '16px' }}>
                    <div style={{ fontSize: 10, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Enable Blockchain Verification</div>
                    <div style={{ fontSize: 12, color: MUTED, marginBottom: 12, lineHeight: 1.6 }}>Add your wallet address to receive your blockchain-verified credential directly.</div>
                    <input
                      style={{ width: '100%', background: FAINT, border: `1px solid ${walletError ? 'rgba(196,92,92,0.5)' : BORDER2}`, borderRadius: 2, padding: '10px 12px', fontSize: 12, color: WHITE, outline: 'none', boxSizing: 'border-box', marginBottom: 8, fontFamily: VAULT_BODY }}
                      placeholder="0x... your EVM wallet address"
                      value={walletInput}
                      onChange={e => { setWalletInput(e.target.value); setWalletError(''); }}
                    />
                    {walletError && <div style={{ fontSize: 11, color: RED, marginBottom: 8 }}>{walletError}</div>}
                    <button className="btn-gold-h" style={{ ...btnGold, marginBottom: 0, opacity: walletSaving ? 0.7 : 1 }} onClick={saveWallet} disabled={walletSaving || !walletInput}>
                      {walletSaving ? 'Saving…' : 'Save Wallet Address'}
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 4, background: 'rgba(26,143,105,0.05)', border: '1px solid rgba(26,143,105,0.18)', borderRadius: 3, padding: '14px 16px' }}>
                    {walletSaved && <div style={{ fontSize: 12, color: TEAL2, marginBottom: 6 }}>✓ Wallet saved. Blockchain minting enabled.</div>}
                    <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Blockchain Wallet</div>
                    <div style={{ fontSize: 11, color: MUTED, wordBreak: 'break-all', fontFamily: 'monospace' }}>{candidateWallet}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="vault-up" style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '32px 36px', minHeight: 230 }}>
                <div style={{ fontSize: 11, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18 }}>Your Certificate</div>
                <div style={{ fontSize: 15, color: MUTED, textAlign: 'center', padding: '52px 0', lineHeight: 1.8 }}>
                  {isAwaitingSimulator ? (
                    <>Complete the ATAC Call Readiness Simulator to earn your<br />blockchain-verified certificate.</>
                  ) : (
                    <>Complete your assessment to earn your<br />blockchain-verified certificate.</>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>}
      </div>

      {photoVerification.modal}
    </div>
  );
}
