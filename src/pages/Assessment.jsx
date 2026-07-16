import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/client';
import { useToast } from '../hooks/useToast';
import SelfieCapture from '../components/SelfieCapture';
import brandLogo from '../assets/atac-globalcx-logo-header.png';
import certificateSeal from '../assets/agcx-certificate-seal-cropped.png';
import { useAssessmentConfig } from '../hooks/useAssessmentConfig';
import CountUp from '../components/CountUp';
import { color as ds, font as dsFont, goldButton } from '../designSystem/tokens';

/* ── Palette mapped to the redesign tokens (names kept; values now from
   src/designSystem so the whole screen re-skins without structural churn) ─ */
const BG    = ds.bg;
const BG1   = ds.panel;
const BG3   = ds.bg;
const GOLD  = ds.gold;
const TEAL  = ds.green;
const TEAL2 = ds.greenText;
const WHITE = ds.heading;
const MUTED = ds.muted;
const FAINT = 'rgba(255,255,255,0.04)';
const BORDER  = 'rgba(239,192,60,0.18)';
const BORDER2 = ds.border;
const RED   = ds.red;
const AMBER = '#C48A2A';

const DOMAIN_META = {
  professionalism: { label: 'Professionalism',    color: GOLD,              abbr: 'PROF' },
  communication:   { label: 'Communication',       color: '#5BA8D4',         abbr: 'COMM' },
  cx_operations:   { label: 'CX Operations',       color: '#5DCAA5',         abbr: 'OPER' },
  technology:      { label: 'Technology',          color: '#8A7DD4',         abbr: 'TECH' },
  compliance_safety:{ label:'Compliance & Safety', color: '#C45C5C',         abbr: 'CMPL' },
  remote_setup:    { label: 'Remote Work Setup',    color: '#22A67E',         abbr: 'RWS'  },
};
const DOMAIN_KEYS = ['professionalism', 'communication', 'cx_operations', 'technology', 'compliance_safety', 'remote_setup'];
const normalizeDomainKey = (domain) => {
  if (domain === 'health_safety') return 'compliance_safety';
  if (domain === 'remote_work') return 'remote_setup';
  return domain;
};

const VAULT_FONT_DISPLAY = dsFont.display;
const VAULT_FONT_BODY    = dsFont.body;

/* Pre-assessment identity/fraud acknowledgment. documentKey and version MUST
   match the seeded consent document exactly. Version is pinned to '1.0.0'. */
const INTEGRITY_ACK_KEY     = 'assessment_integrity_ack';
const INTEGRITY_ACK_VERSION = '1.0.0';

/* Stage labels for the processing screen */
const STAGE_LABELS = {
  starting:            'Initializing credential',
  uploading_metadata:  'Uploading credential metadata',
  minting_blockchain:  'Minting on the blockchain',
  finalizing:          'Finalizing your credential',
  done:                'Credential issued',
  error:               'Something went wrong',
};

const STAGE_ORDER = [
  'starting',
  'uploading_metadata',
  'minting_blockchain',
  'finalizing',
  'done'
];

/* ── Keyframe injection ──────────────────────────────────────────── */
const injectKeyframes = () => {
  if (document.getElementById('vault-kf')) return;
  const style = document.createElement('style');
  style.id = 'vault-kf';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Syne:wght@400;500;600;700&display=swap');
    @keyframes vault-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes vault-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes vault-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    @keyframes progress-fill { from { width: 0; } to { width: var(--target-w); } }
    @keyframes tick { 0%,100% { transform:scale(1); } 50% { transform:scale(1.08); } }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .vault-up   { animation: vault-up 0.5s ease both; }
    .vault-in   { animation: vault-in 0.4s ease both; }
    .opt-hover { transition: border-color 0.18s, background 0.18s, transform 0.16s; }
    .opt-hover:hover { border-color: ${BORDER} !important; background: rgba(239,192,60,0.05) !important; cursor: pointer; transform: translateY(-2px); }
    .opt-hover:hover .opt-letter { color: ${GOLD} !important; border-color: rgba(239,192,60,0.4) !important; }
    .asmt-tick { animation: tick 1s infinite; }
    .asmt-fill { animation: progress-fill 0.85s cubic-bezier(0.22,1,0.36,1) both; }
    .stage-shimmer {
      background: linear-gradient(90deg, rgba(239,192,60,0.06) 0%, rgba(239,192,60,0.2) 50%, rgba(239,192,60,0.06) 100%);
      background-size: 200% 100%;
      animation: shimmer 2s ease-in-out infinite;
    }
    @media (max-width: 620px) {
      .asmt-active-grid { grid-template-columns: 1fr !important; }
      .asmt-sidebar { border-right: none !important; border-bottom: 1px solid ${BORDER2} !important; max-height: 46vh; }
    }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(239,192,60,0.2); border-radius:2px; }
    @media (prefers-reduced-motion: reduce) {
      .vault-up, .vault-in, .asmt-fill, .asmt-tick, .stage-shimmer { animation: none !important; }
      .opt-hover { transition: none !important; }
      .opt-hover:hover { transform: none !important; }
    }
  `;
  document.head.appendChild(style);
};

/* ── Timer display ───────────────────────────────────────────────── */
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function Assessment() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Phase: 'loading' | 'locked' | 'selfie' | 'integrity_ack' | 'intro' | 'active' | 'processing' | 'result'
  const [phase, setPhase]           = useState('loading');
  const [questions, setQuestions]   = useState([]);
  const [current, setCurrent]       = useState(0);
  const [answers, setAnswers]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('atac_answers') || '{}'); }
    catch { return {}; }
  });
  const [flagged, setFlagged]       = useState(new Set());
  const [timeLeft, setTimeLeft]     = useState(null); // seeded from config.timeLimitSec
  const [result, setResult]         = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [animKey, setAnimKey]       = useState(0);
  // Pre-assessment identity/fraud gate: the required checkbox state.
  const [integrityChecked, setIntegrityChecked] = useState(false);
  // Selfie-on-file flag captured at checkAccess, read after the integrity gate
  // to decide whether a verified-intent candidate still needs the selfie step.
  const hasSelfieRef = useRef(false);

  // Assessment config (questions / time limit / pass %) from GET /api/assessment/config.
  const { config: cfg, questions: cfgQuestions, minutes: cfgMinutes, passPct: cfgPassPct } = useAssessmentConfig();

  // Seed the countdown from the live time limit once config resolves. timeLeft
  // starts null and only this sets it from null, so it fires exactly once and
  // never resets a running timer.
  useEffect(() => {
    if (cfg?.timeLimitSec != null && timeLeft == null) setTimeLeft(cfg.timeLimitSec);
  }, [cfg, timeLeft]);

  // Processing-phase state (for async credential minting)
  const [processingStatus, setProcessingStatus] = useState(null); // pending | processing | issued | failed
  const [processingStage,  setProcessingStage]  = useState(null);
  const [processingStartedAt, setProcessingStartedAt] = useState(null);

  const timerRef   = useRef(null);
  const pollRef    = useRef(null);

  // ── Phase 6: integrity telemetry ─────────────────────────────────────────
  // The frontend doesn't know assessmentId until /submit-direct returns it,
  // so we buffer all events client-side and flush one batch on submit. This
  // means zero mid-assessment API calls (good — no rate-limit risk during
  // the test) but also no real-time visibility into the active session.
  const eventBufferRef       = useRef([]);     // queued integrity events
  const questionStartTimeRef = useRef(null);   // ms timestamp current question rendered
  const tabBlurCountRef      = useRef(0);      // local counter for UX (server tallies from events)
  const fullscreenExitsRef   = useRef(0);
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);

  // Push an integrity event into the buffer. Fire-and-forget — never throws,
  // never blocks. Buffer is flushed in handleSubmit() once we have an assessmentId.
  const pushEvent = useCallback((eventType, durationMs, metadata) => {
    try {
      eventBufferRef.current.push({
        eventType,
        clientTs:   Date.now(),
        durationMs: durationMs != null ? Math.floor(durationMs) : null,
        metadata:   metadata || null,
      });
    } catch (_) { /* silent — telemetry is best-effort */ }
  }, []);

  useEffect(() => { injectKeyframes(); checkAccess(); }, []);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Phase 6: lockdown listeners — bind only during 'active' phase ────────
  // Bound on phase=='active', cleaned on phase change OR unmount. Behavior:
  //   visibilitychange → record visibility_hidden / visibility_visible
  //   fullscreenchange → on exit, record fullscreen_exit + show modal
  //   copy / cut / paste / contextmenu → preventDefault + record + toast
  // No API calls — events go into eventBufferRef, flushed on submit.
  useEffect(() => {
    if (phase !== 'active') return undefined;

    const onVisibility = () => {
      if (document.hidden) {
        tabBlurCountRef.current++;
        pushEvent('visibility_hidden');
      } else {
        pushEvent('visibility_visible');
      }
    };
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        fullscreenExitsRef.current++;
        pushEvent('fullscreen_exit');
        setShowFullscreenModal(true);
      } else {
        setShowFullscreenModal(false);
      }
    };
    const onCopy  = (e) => { e.preventDefault(); pushEvent('copy_attempt');  showToast('Copy and paste is disabled during the assessment'); };
    const onCut   = (e) => { e.preventDefault(); pushEvent('copy_attempt');  showToast('Copy and paste is disabled during the assessment'); };
    const onPaste = (e) => { e.preventDefault(); pushEvent('paste_attempt'); showToast('Copy and paste is disabled during the assessment'); };
    const onCtx   = (e) => { e.preventDefault(); pushEvent('right_click'); };

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('copy',        onCopy);
    document.addEventListener('cut',         onCut);
    document.addEventListener('paste',       onPaste);
    document.addEventListener('contextmenu', onCtx);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('copy',        onCopy);
      document.removeEventListener('cut',         onCut);
      document.removeEventListener('paste',       onPaste);
      document.removeEventListener('contextmenu', onCtx);
    };
  }, [phase, pushEvent, showToast]);

  const checkAccess = async () => {
    try {
      const me = await API.get('/api/auth/me');
      const cand = me.data.candidate || me.data;
      if (!cand.payment_verified) { setPhase('locked'); return; }
      if (cand.assessmentCompleted) { setPhase('result'); fetchResult(); return; }

      // The identity/fraud acknowledgment now runs FIRST -- before the selfie
      // capture and before questions load -- for every candidate. Stash whether
      // a selfie is already on file so handleIntegrityContinue can (together
      // with the intended tier in localStorage) route verified-intent
      // candidates into the 'selfie' phase after they acknowledge, and everyone
      // else straight to the questions.
      hasSelfieRef.current = !!cand.selfie_uploaded_at;
      setPhase('integrity_ack');
    } catch (err) {
      // Backend returns 409 AWAITING_SIMULATOR when this candidate already
      // passed the assessment and the next step is the simulator. Route
      // them straight to it instead of bouncing through /login.
      if (err?.response?.status === 409 && err?.response?.data?.code === 'AWAITING_SIMULATOR') {
        const msg = err.response.data.message
          || 'Your assessment is complete. Continue with the ATAC Call Readiness Simulator to earn your credential.';
        showToast(msg, { type: 'info' });
        navigate('/simulator?auto=true');
        return;
      }
      navigate('/login');
    }
  };

  const loadQuestionsAndProceedToIntro = async () => {
    const qRes = await API.get('/api/assessment/questions');
    setQuestions(qRes.data.questions || []);
    setPhase('intro');
  };

  // SelfieCapture completion handler. The identity/fraud acknowledgment has
  // already been given (it now runs before the selfie), so both 'success'
  // (verified tier promoted) and 'downgraded' (candidate continues with
  // headshot tier) go straight to the questions fetch + intro. SelfieCapture
  // itself clears localStorage.atac_intended_tier before calling this back.
  const handleSelfieComplete = async () => {
    try {
      await loadQuestionsAndProceedToIntro();
    } catch (err) {
      // Backend returns 409 AWAITING_SIMULATOR when this candidate already
      // passed and the next step is the simulator. Skip the dashboard hop.
      if (err?.response?.status === 409 && err?.response?.data?.code === 'AWAITING_SIMULATOR') {
        const msg = err.response.data.message
          || 'Your assessment is complete. Continue with the ATAC Call Readiness Simulator to earn your credential.';
        showToast(msg, { type: 'info' });
        navigate('/simulator?auto=true');
        return;
      }
      console.error('[Assessment] post-selfie loadQuestions failed', err);
      navigate('/dashboard');
    }
  };

  const fetchResult = async () => {
    try {
      const res = await API.get('/api/assessment/result');
      setResult(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Best-effort record of the pre-assessment identity/fraud acknowledgment
  // against the existing consent ledger. Mirrors the photo/biometric consent
  // helpers (POST /api/consent/accept with an acceptances array). Fire-and-
  // forget: a telemetry write must never hard-block a paid candidate, so on
  // failure we log and let them proceed. The checked box is the user-facing
  // acknowledgment; this row is the audit trail.
  const recordIntegrityAck = () => {
    API.post('/api/consent/accept', {
      acceptances: [{ documentKey: INTEGRITY_ACK_KEY, version: INTEGRITY_ACK_VERSION, accepted: true }],
    }).catch((err) => {
      console.error('[Assessment] integrity ack record failed (continuing)', err);
    });
  };

  // Continue past the integrity gate: record the acknowledgment (best-effort),
  // then route onward. Verified-intent candidates who still owe a selfie
  // capture it now (after acknowledging); everyone else goes straight to the
  // questions. Questions are intentionally not fetched until this point, so the
  // acknowledgment always precedes both the selfie and the questions.
  const handleIntegrityContinue = async () => {
    recordIntegrityAck();
    const intendedTier = localStorage.getItem('atac_intended_tier');
    if (intendedTier === 'verified' && !hasSelfieRef.current) {
      setPhase('selfie');
      return;
    }
    // Clear stale intent (e.g., candidate already finished selfie or
    // downgraded on a previous attempt).
    if (intendedTier) localStorage.removeItem('atac_intended_tier');
    try {
      await loadQuestionsAndProceedToIntro();
    } catch (err) {
      if (err?.response?.status === 409 && err?.response?.data?.code === 'AWAITING_SIMULATOR') {
        const msg = err.response.data.message
          || 'Your assessment is complete. Continue with the ATAC Call Readiness Simulator to earn your credential.';
        showToast(msg, { type: 'info' });
        navigate('/simulator?auto=true');
        return;
      }
      console.error('[Assessment] post-integrity loadQuestions failed', err);
      navigate('/dashboard');
    }
  };

  const startAssessment = () => {
    setPhase('active');
    // Defensive seed if the config-sync effect has not run yet.
    setTimeLeft(prev => (prev != null ? prev : (cfg?.timeLimitSec ?? null)));
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t == null) return t; // config not loaded yet; hold rather than submit
        if (t <= 1) { clearInterval(timerRef.current); handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);

    // Phase 6: integrity telemetry
    pushEvent('start');
    questionStartTimeRef.current = Date.now();
    // Best-effort fullscreen request. Older browsers / headless contexts may
    // reject; we just continue without crashing.
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => { /* silent */ });
    }
  };

  const downloadCertificate = (credId) => {
    const token = localStorage.getItem('atac_token') || localStorage.getItem('token');
    if (!token || !credId) return;
    const win = window.open('', '_blank');
    fetch(`https://atac-backend-production.up.railway.app/api/credentials/${credId}/certificate/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.text(); })
      .then(html => {
        win.document.open();
        win.document.write(html);
        win.document.close();
      })
      .catch(() => {
        if (win) win.close();
        showToast('Certificate download failed. Please try again.', true);
      });
  };

  const selectAnswer = (qId, optIdx) => {
    setAnswers(prev => {
      const u = { ...prev, [qId]: optIdx };
      localStorage.setItem('atac_answers', JSON.stringify(u));
      return u;
    });
  };

  const goTo = (idx) => {
    // Phase 6: record duration for the question being left.
    if (questionStartTimeRef.current && idx !== current) {
      const durationMs = Date.now() - questionStartTimeRef.current;
      const leavingQ = questions[current];
      if (leavingQ) {
        pushEvent('question_answered', durationMs, { question_id: leavingQ.id });
      }
      questionStartTimeRef.current = Date.now();
    }
    setCurrent(idx);
    setAnimKey(k => k + 1);
  };

  const toggleFlag = (qId) => {
    setFlagged(prev => {
      const n = new Set(prev);
      if (n.has(qId)) n.delete(qId); else n.add(qId);
      return n;
    });
  };

  // ═════════════════════════════════════════════════════════════════
  // Submission flow — async pattern
  //
  // 1. POST /submit-direct — responds immediately with score + pass/fail
  // 2. If user passed AND credentialStatus === 'pending', go to
  //    'processing' phase and begin polling /credential-status
  // 3. When polling returns status === 'issued', merge credential
  //    into result and show final 'result' phase
  // 4. If failed status or timeout, still show result but note
  //    credential is "being issued — check email in a few minutes"
  // ═════════════════════════════════════════════════════════════════

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    clearInterval(timerRef.current);
    setSubmitting(true);
    setError('');
    try {
      // Phase 6: record duration of the LAST question (no goTo() fires after
      // submit, so this is the only place that question's timing is captured).
      if (questionStartTimeRef.current) {
        const durationMs = Date.now() - questionStartTimeRef.current;
        const lastQ = questions[current];
        if (lastQ) {
          pushEvent('question_answered', durationMs, { question_id: lastQ.id });
        }
        questionStartTimeRef.current = null;
      }

      const payload = questions.map(q => ({
        questionId: q.id,
        selectedOption: answers[q.id] ?? null
      }));
      const res = await API.post('/api/assessment/submit-direct', { answers: payload });
      setResult(res.data);
      localStorage.removeItem('atac_answers');

      // Phase 6: flush the integrity event buffer with the now-known assessmentId.
      // Fire-and-forget — the response shape is what the user sees; telemetry
      // is best-effort and must NEVER block or fail the assessment.
      const assessmentId = res.data && res.data.assessmentId;
      if (assessmentId && eventBufferRef.current.length > 0) {
        const events = eventBufferRef.current.slice(0, 200); // /events/batch caps at 200
        eventBufferRef.current = [];
        API.post('/api/integrity/events/batch', { assessmentId, events })
          .catch(() => { /* silent */ });
      }

      // All passed candidates render the in-page results screen so they
      // see their score, percentage, and domain breakdown. For
      // simulator-required candidates the results screen surfaces a
      // "Take the Simulator" CTA that they click to advance; the prior
      // auto-redirect with a 4-second splash was removed because it hid
      // the score from candidates.
      if (res.data.passed && res.data.credentialStatus === 'pending') {
        setProcessingStatus('pending');
        setProcessingStage('starting');
        setProcessingStartedAt(Date.now());
        setPhase('processing');
        startPolling(res.data.assessmentId);
      } else {
        // Either they didn't pass, or credential came back instantly
        setPhase('result');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed. Please try again.');
      setSubmitting(false);
    }
  }, [submitting, questions, answers, current, pushEvent]);

  const startPolling = (assessmentId) => {
    if (pollRef.current) clearInterval(pollRef.current);

    let pollCount = 0;
    const maxPolls = 180; // 180 polls × 3s = 9 min max

    const poll = async () => {
      pollCount++;
      try {
        const res = await API.get(`/api/assessment/credential-status/${assessmentId}`);
        const data = res.data;

        setProcessingStatus(data.status);
        setProcessingStage(data.stage);

        if (data.status === 'issued' && data.credential) {
          // Merge credential into result
          clearInterval(pollRef.current);
          pollRef.current = null;
          setResult(prev => ({
            ...prev,
            credentialId: data.credential.credentialId,
            txHash:       data.credential.txHash,
            tokenId:      data.credential.tokenId,
            ipfsUri:      data.credential.ipfsUri,
          }));
          setPhase('result');
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          // Show result but with a "we'll email you" note
          setPhase('result');
        } else if (pollCount >= maxPolls) {
          // Give up polling — show result with note
          clearInterval(pollRef.current);
          pollRef.current = null;
          setPhase('result');
        }
      } catch (err) {
        console.error('Poll error:', err);
        if (pollCount >= maxPolls) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setPhase('result');
        }
      }
    };

    // First poll after 1 second, then every 3 seconds
    setTimeout(poll, 1000);
    pollRef.current = setInterval(poll, 3000);
  };

  const answered   = Object.keys(answers).length;
  const progress   = questions.length ? (answered / questions.length) * 100 : 0;
  const q          = questions[current] || null;
  const isLowTime  = timeLeft != null && timeLeft < 300;
  const domainList = DOMAIN_KEYS;

  const domainProgress = domainList.map(d => {
    const qs = questions.filter(x => normalizeDomainKey(x.domain) === d);
    const ans = qs.filter(x => answers[x.id] !== undefined).length;
    return { key: d, total: qs.length, answered: ans, ...DOMAIN_META[d] };
  });

  /* ─────────────────────────────────────── RENDER PHASES ────── */
  const base = {
    position: 'relative', minHeight: '100vh', color: WHITE, fontFamily: VAULT_FONT_BODY, overflowX: 'hidden',
    background: 'radial-gradient(1100px 720px at 78% 0%, rgba(239,192,60,0.10), rgba(239,192,60,0) 60%), '
      + 'radial-gradient(900px 640px at 4% 100%, rgba(20,52,96,0.28), rgba(20,52,96,0) 62%), '
      + 'repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 96px), '
      + ds.bg,
  };
  // 2px ambient gold top hairline; fixed so it overlays any phase layout.
  const hairline = <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(239,192,60,0.55), transparent)', zIndex: 60 }} />;

  /* LOADING */
  if (phase === 'loading') return (
    <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 18, color: GOLD, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>ATAC Global CX</div>
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Loading Assessment…</div>
      </div>
    </div>
  );

  /* SELFIE - Verified Identity tier capture gate */
  if (phase === 'selfie') return (
    <div style={base}>
      <SelfieCapture onComplete={handleSelfieComplete} />
    </div>
  );

  /* LOCKED */
  if (phase === 'locked') return (
    <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: 40 }} className="vault-up">
        <img src={brandLogo} alt="ATAC Global CX" style={{ height: 280, objectFit: 'contain', marginBottom: 28 }} />
        <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 34, fontWeight: 300, lineHeight: 1.2, marginBottom: 16 }}>Assessment Access Required</div>
        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 32 }}>
          Complete your purchase to unlock the Remote CX Readiness Assessment and begin your certification journey.
        </div>
        <button onClick={() => navigate('/')} style={btnGold}>View Pricing</button>
        <div style={{ marginTop: 12 }}>
          <span onClick={() => navigate('/dashboard')} style={{ fontSize: 12, color: MUTED, cursor: 'pointer', borderBottom: '1px solid rgba(238,233,223,0.2)', paddingBottom: 1 }}>Return to Dashboard</span>
        </div>
      </div>
    </div>
  );

  /* INTEGRITY ACK - identity and fraud-prevention gate; shown before questions load */
  if (phase === 'integrity_ack') return (
    <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 24px' }}>
      {hairline}
      <div style={{ maxWidth: 640, width: '100%' }} className="vault-up">
        <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 13, color: GOLD, letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 16 }}>
          Before You Begin
        </div>
        <div style={{ background: BG1, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '36px 40px' }}>
          <h1 style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 34, fontWeight: 300, lineHeight: 1.2, margin: '0 0 20px', color: WHITE }}>
            Identity &amp; Fraud Protection
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(238,233,223,0.76)', lineHeight: 1.75, margin: '0 0 16px' }}>
            To keep ATAC credentials trustworthy, we confirm that the person taking the assessment is the person who signed up. During the assessment and the voice simulator, your device camera may capture one or more still images - used only to verify your identity and prevent fraud, never for any other purpose.
          </p>
          <p style={{ fontSize: 15, color: 'rgba(238,233,223,0.76)', lineHeight: 1.75, margin: '0 0 28px' }}>
            Please stay on the assessment screens once you begin. Leaving or switching windows is recorded and may be flagged for integrity review.
          </p>
          <label style={{ display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer', background: 'rgba(8,11,18,0.56)', border: `1px solid ${integrityChecked ? GOLD : BORDER2}`, borderRadius: 4, padding: '18px 20px', transition: 'border-color 180ms ease' }}>
            <input
              type="checkbox"
              checked={integrityChecked}
              onChange={(e) => setIntegrityChecked(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: GOLD, flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, color: WHITE, lineHeight: 1.6 }}>
              I confirm I am the person named on this account and am completing this assessment myself, and I acknowledge the identity and fraud-prevention measures described above.
            </span>
          </label>
          <button
            onClick={handleIntegrityContinue}
            disabled={!integrityChecked}
            style={{ ...btnGold, width: '100%', padding: '18px 24px', fontSize: 14, letterSpacing: '0.2em', marginTop: 24, opacity: integrityChecked ? 1 : 0.4, cursor: integrityChecked ? 'pointer' : 'not-allowed' }}
          >
            Continue to Assessment
          </button>
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <span onClick={() => navigate('/dashboard')} style={{ fontSize: 12, color: MUTED, cursor: 'pointer' }}>Return to Dashboard</span>
          </div>
        </div>
      </div>
    </div>
  );

  /* INTRO — bigger, clearer typography for CX demographic */
  if (phase === 'intro') {
    const domainTiles = DOMAIN_KEYS.map(key => {
      const meta = DOMAIN_META[key];
      const count = questions.filter(x => normalizeDomainKey(x.domain) === key).length;
      return { key, count, ...meta };
    });

    return (
      <div style={{ ...base, padding: '56px 44px 48px', minHeight: '100vh' }}>
        {hairline}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1320, width: '100%', margin: '0 auto' }} className="vault-up">

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 28, alignItems: 'stretch', marginBottom: 28 }}>
            <section style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, rgba(239,192,60,0.10), rgba(12,16,24,0.92) 46%, rgba(34,166,126,0.08))`, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '44px 46px', minHeight: 520, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {/* Slowly rotating atac-seal watermark (ds-anim-seal; off under reduced motion) */}
              <img src={certificateSeal} alt="" aria-hidden="true" className="ds-anim-seal" style={{ position: 'absolute', top: -70, right: -70, width: 300, height: 300, objectFit: 'cover', borderRadius: '50%', opacity: 0.06, pointerEvents: 'none' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 13, color: GOLD, letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 18 }}>
                  Remote CX Readiness
                </div>
                <h1 style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 72, fontWeight: 300, lineHeight: 0.98, margin: 0, color: WHITE, maxWidth: 620 }}>
                  Certification Assessment
                </h1>
                <div style={{ width: 64, height: 1, background: GOLD, margin: '28px 0', opacity: 0.55 }} />
                <p style={{ fontSize: 18, color: 'rgba(238,233,223,0.76)', lineHeight: 1.75, maxWidth: 650, margin: 0 }}>
                  A timed readiness check across six call center and remote-work competencies. Passing unlocks your blockchain-verified credential and confirms you are ready for the next step.
                </p>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '34px 0 22px' }}>
                  {[
                    { val: cfgQuestions ?? questions.length, lbl: 'Questions' },
                    { val: cfgMinutes, lbl: 'Minutes' },
                    { val: cfgPassPct, lbl: 'Pass Mark', suffix: '%' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'rgba(8,11,18,0.56)', border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '22px 18px' }}>
                      <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 44, color: GOLD, fontWeight: 300, lineHeight: 1 }}><CountUp value={s.val} suffix={s.suffix || ''} /></div>
                      <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 8 }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>
                <button onClick={startAssessment} style={{ ...btnGold, width: '100%', padding: '20px 24px', fontSize: 14, letterSpacing: '0.2em' }}>
                  Begin Assessment
                </button>
                <div style={{ marginTop: 16 }}>
                  <span onClick={() => navigate('/dashboard')} style={{ fontSize: 12, color: MUTED, cursor: 'pointer' }}>Return to Dashboard</span>
                </div>
              </div>
            </section>

            <section style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '34px 34px 32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-end', marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 12, color: MUTED, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Assessment Domains</div>
                  <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 34, fontWeight: 300, color: WHITE, lineHeight: 1.1 }}>What will be measured</div>
                </div>
                <div style={{ color: GOLD, fontFamily: VAULT_FONT_DISPLAY, fontSize: 34, fontWeight: 300 }}>{DOMAIN_KEYS.length}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                {domainTiles.map((d, i) => (
                  <div key={d.key} style={{ minHeight: 126, background: 'rgba(238,233,223,0.025)', border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '20px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', animationDelay: `${i * 45}ms` }} className="vault-up">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{ width: 3, height: 30, background: d.color, borderRadius: 2, flexShrink: 0 }} />
                      <div style={{ fontSize: 11, color: d.color, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{d.abbr}</div>
                    </div>
                    <div>
                      <div style={{ color: WHITE, fontSize: 17, fontWeight: 600, lineHeight: 1.25 }}>{d.label}</div>
                      <div style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>{questions.length ? `${d.count} questions` : 'Included in assessment'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: 26 }}>
            {[
              { title: 'Timer Starts On Begin', body: `You have ${cfgMinutes ? `${cfgMinutes} minutes` : 'a fixed time limit'} and can move freely between questions.` },
              { title: 'Answer Every Question', body: 'Use the question tracker and flags to revisit anything before submitting.' },
              { title: 'Credential On Passing', body: 'Passing candidates receive a blockchain-verifiable ATAC credential.' },
            ].map((item, i) => (
              <div key={item.title} style={{ borderLeft: `3px solid ${i === 2 ? TEAL2 : GOLD}`, paddingLeft: 18, minHeight: 70 }}>
                <div style={{ color: WHITE, fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{item.title}</div>
                <div style={{ color: 'rgba(238,233,223,0.68)', fontSize: 14, lineHeight: 1.65 }}>{item.body}</div>
              </div>
            ))}
          </section>
        </div>
      </div>
    );
  }

  /* ACTIVE */
  if (phase === 'active' && q) return (
    <div className="asmt-active-grid" style={{ ...base, display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh' }}>
      {hairline}

      {/* ── Sidebar (collapses to a top bar on ≤620px) ── */}
      <div className="asmt-sidebar" style={{ background: BG3, borderRight: `1px solid ${BORDER2}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {/* Branding */}
        <div style={{ padding: '20px 18px 14px', borderBottom: `1px solid ${BORDER2}` }}>
          <img src={brandLogo} alt="ATAC Global CX" style={{ height: 96, objectFit: 'contain' }} />
          <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>Readiness Assessment</div>
        </div>

        {/* Timer */}
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${BORDER2}` }}>
          <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>Time Remaining</div>
          <div className={isLowTime ? 'asmt-tick' : undefined} style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 32, color: isLowTime ? RED : GOLD, fontWeight: 300 }}>
            {timeLeft != null ? formatTime(timeLeft) : '--:--'}
          </div>
          {isLowTime && <div style={{ fontSize: 10, color: RED, marginTop: 4, letterSpacing: '0.1em' }}>TIME RUNNING LOW</div>}
        </div>

        {/* Progress */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER2}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Progress</span>
            <span style={{ fontSize: 10, color: GOLD }}>{answered}/{questions.length}</span>
          </div>
          <div style={{ height: 2, background: BORDER2, borderRadius: 1 }}>
            <div style={{ height: 2, width: `${progress}%`, background: GOLD, borderRadius: 1, transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* Q Navigator */}
        <div style={{ padding: '18px', flex: 1 }}>
          <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Questions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
            {questions.map((q2, i) => {
              const isCurr  = i === current;
              const isAns   = answers[q2.id] !== undefined;
              const isFlag  = flagged.has(q2.id);
              let bg = FAINT, border = BORDER2, color = MUTED;
              if (isCurr)  { bg = 'rgba(239,192,60,0.15)'; border = BORDER; color = GOLD; }
              else if (isFlag) { bg = 'rgba(196,92,92,0.1)'; border = 'rgba(196,92,92,0.3)'; color = RED; }
              else if (isAns) { bg = 'rgba(26,143,105,0.1)'; border = 'rgba(26,143,105,0.3)'; color = TEAL; }
              return (
                <div key={q2.id} onClick={() => goTo(i)}
                  style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: bg, border: `1px solid ${border}`, color, borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {i + 1}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[{ c: TEAL, l: 'Answered' }, { c: GOLD, l: 'Current' }, { c: RED, l: 'Flagged' }].map(leg => (
              <div key={leg.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: leg.c }} />
                <span style={{ fontSize: 9, color: MUTED }}>{leg.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div style={{ padding: '14px 18px', borderTop: `1px solid ${BORDER2}` }}>
          <div style={{ fontSize: 10, color: MUTED, marginBottom: 8 }}>{questions.length - answered} unanswered</div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ width: '100%', ...btnGold, fontSize: 11, padding: '10px 0', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'SUBMITTING…' : 'SUBMIT ASSESSMENT'}
          </button>
          {error && <div style={{ fontSize: 10, color: RED, marginTop: 8 }}>{error}</div>}
        </div>
      </div>

      {/* ── Question Area ── */}
      <div style={{ background: BG, display: 'flex', flexDirection: 'column', padding: '32px 40px', overflowY: 'auto' }}>

        <div key={animKey} className="vault-in" style={{ flex: 1 }}>

          {/* Domain + Q number */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 2, height: 16, background: DOMAIN_META[normalizeDomainKey(q.domain)]?.color || GOLD, borderRadius: 1 }} />
              <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                {DOMAIN_META[normalizeDomainKey(q.domain)]?.label || q.domain}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => toggleFlag(q.id)}
                style={{ background: flagged.has(q.id) ? 'rgba(196,92,92,0.1)' : FAINT, border: `1px solid ${flagged.has(q.id) ? 'rgba(196,92,92,0.35)' : BORDER2}`, color: flagged.has(q.id) ? RED : MUTED, fontSize: 10, padding: '5px 10px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {flagged.has(q.id) ? '⚑ Flagged' : '⚐ Flag'}
              </button>
              <span style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 22, color: MUTED, fontWeight: 300 }}>
                <span style={{ color: GOLD }}>{current + 1}</span> / {questions.length}
              </span>
            </div>
          </div>

          {/* Question text */}
          <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 24, fontWeight: 400, lineHeight: 1.5, color: WHITE, marginBottom: 36, maxWidth: 680 }}>
            {q.text}
          </div>

          <div style={{ height: 1, background: BORDER2, marginBottom: 28 }} />

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.options.map((opt, i) => {
              const selected = answers[q.id] === i;
              const letters  = ['A', 'B', 'C', 'D'];
              return (
                <div key={i}
                  className="opt-hover"
                  onClick={() => selectAnswer(q.id, i)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    background: selected ? 'rgba(239,192,60,0.08)' : FAINT,
                    border: `1px solid ${selected ? BORDER : BORDER2}`,
                    borderRadius: 3, padding: '16px 18px',
                    cursor: 'pointer', transition: 'all 0.18s',
                  }}>
                  <div className="opt-letter" style={{
                    width: 26, height: 26, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: VAULT_FONT_DISPLAY, fontSize: 14, fontWeight: 500,
                    border: `1px solid ${selected ? GOLD : BORDER2}`,
                    color: selected ? GOLD : MUTED,
                    borderRadius: 2, transition: 'all 0.18s',
                  }}>
                    {letters[i]}
                  </div>
                  <div style={{ fontSize: 17, color: selected ? WHITE : 'rgba(238,233,223,0.8)', lineHeight: 1.6, paddingTop: 2 }}>
                    {opt}
                  </div>
                  {selected && (
                    <div style={{ marginLeft: 'auto', flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: BG, fontSize: 10, fontWeight: 700 }}>✓</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Nav buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 36, paddingTop: 24, borderTop: `1px solid ${BORDER2}` }}>
            <button
              onClick={() => goTo(Math.max(0, current - 1))}
              disabled={current === 0}
              style={{
                ...btnOutline,
                color: MUTED,
                border: `1px solid ${MUTED}`,
                opacity: current === 0 ? 0.3 : 1,
              }}
              onMouseEnter={(e) => {
                if (current !== 0) e.currentTarget.style.color = WHITE;
              }}
              onMouseLeave={(e) => {
                if (current !== 0) e.currentTarget.style.color = MUTED;
              }}>
              ← Previous
            </button>
            <div style={{ fontSize: 11, color: MUTED, alignSelf: 'center' }}>
              {answered} of {questions.length} answered
            </div>
            {current < questions.length - 1
              ? <button onClick={() => goTo(current + 1)} style={btnGold}>Next →</button>
              : <button onClick={handleSubmit} disabled={submitting} style={{ ...btnGold, opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Submitting…' : 'Submit Assessment'}
                </button>
            }
          </div>

          {/* Domain tracker */}
          <div style={{ marginTop: 28, padding: '22px 24px', background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 18, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 5 }}>Domain Tracker</div>
                <div style={{ fontSize: 13, color: MUTED }}>Progress updates as questions are answered across the six assessment domains.</div>
              </div>
              <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 24, color: WHITE, fontWeight: 300, whiteSpace: 'nowrap' }}>
                <span style={{ color: GOLD }}>{answered}</span> / {questions.length}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 10 }}>
              {domainProgress.map(d => {
                const pct = d.total ? (d.answered / d.total) * 100 : 0;
                const complete = d.total > 0 && d.answered === d.total;
                return (
                  <div key={d.key} style={{
                    minHeight: 118,
                    background: complete ? 'rgba(26,143,105,0.08)' : FAINT,
                    border: `1px solid ${complete ? 'rgba(26,143,105,0.28)' : BORDER2}`,
                    borderRadius: 4,
                    padding: '14px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ width: 28, height: 3, background: d.color, borderRadius: 2, marginBottom: 12 }} />
                      <div style={{ fontSize: 13, color: WHITE, lineHeight: 1.25, minHeight: 34 }}>{d.label}</div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 26, color: complete ? TEAL2 : GOLD, fontWeight: 300 }}>{d.answered}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>of {d.total || 0}</div>
                      </div>
                      <div style={{ height: 5, background: 'rgba(238,233,223,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: 5, width: `${pct}%`, background: d.color, borderRadius: 3, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {/* Phase 6: fullscreen-exit modal — fixed overlay, only visible when
          showFullscreenModal is true (set on fullscreenchange event when
          the user has dropped out of fullscreen). */}
      {showFullscreenModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="atac-fs-modal-title"
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(7, 17, 31, 0.85)', backdropFilter: 'blur(4px)',
            zIndex: 999999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, fontFamily: VAULT_FONT_BODY,
          }}
        >
          <div style={{
            background: BG1, border: `2px solid ${GOLD}`, borderRadius: 12,
            maxWidth: 460, width: '100%', padding: '32px 28px 28px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(239,192,60,0.15)',
            color: WHITE, textAlign: 'center',
          }}>
            <h2
              id="atac-fs-modal-title"
              style={{
                fontFamily: VAULT_FONT_DISPLAY, fontSize: 26, fontWeight: 400,
                color: WHITE, margin: '0 0 14px',
              }}
            >
              Return to fullscreen
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: MUTED, margin: '0 0 22px' }}>
              Please return to fullscreen to continue. Fullscreen exits are logged with your assessment.
            </p>
            <button
              type="button"
              onClick={() => {
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen()
                    .then(() => setShowFullscreenModal(false))
                    .catch(() => { /* silent — modal stays open */ });
                }
              }}
              style={{
                background: GOLD, color: BG, border: 'none', borderRadius: 4,
                padding: '13px 28px', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: VAULT_FONT_BODY,
              }}
            >
              Return to fullscreen
            </button>
          </div>
        </div>
      )}

    </div>
  );

  /* PROCESSING — new async credential flow */
  if (phase === 'processing') {
    const elapsed = processingStartedAt ? Math.floor((Date.now() - processingStartedAt) / 1000) : 0;
    const showLongWait = elapsed > 60; // after 1 minute, show "take your time" message
    const currentStageIndex = STAGE_ORDER.indexOf(processingStage || 'starting');

    return (
      <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ maxWidth: 560, width: '100%' }} className="vault-up">

          {/* Score confirmation */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 14, color: TEAL2, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14 }}>
              Assessment Passed
            </div>
            <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 56, fontWeight: 300, color: WHITE, lineHeight: 1, marginBottom: 6 }}>
              {result?.percentage}%
            </div>
            <div style={{ fontSize: 13, color: MUTED, letterSpacing: '0.1em' }}>
              {result?.score}{cfgQuestions ? ` of ${cfgQuestions}` : ''} correct · Pass threshold {cfgPassPct != null ? `${cfgPassPct}%` : '--'}
            </div>
          </div>

          {/* Main card */}
          <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '32px 28px', marginBottom: 24 }}>
            <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 24, fontWeight: 300, color: WHITE, marginBottom: 10, lineHeight: 1.3 }}>
              Minting your blockchain credential
            </div>
            <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, marginBottom: 28 }}>
              Your credential is being permanently recorded on the blockchain. This normally takes less than a minute.
            </div>

            {/* Progress stages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {STAGE_ORDER.map((stageName, i) => {
                const isDone    = i < currentStageIndex || processingStatus === 'issued';
                const isCurrent = i === currentStageIndex && processingStatus !== 'issued';
                const label = STAGE_LABELS[stageName];

                let dotBg, dotBorder, textColor;
                if (isDone) {
                  dotBg = TEAL2;
                  dotBorder = TEAL2;
                  textColor = 'rgba(238,233,223,0.85)';
                } else if (isCurrent) {
                  dotBg = 'transparent';
                  dotBorder = GOLD;
                  textColor = WHITE;
                } else {
                  dotBg = 'transparent';
                  dotBorder = BORDER2;
                  textColor = MUTED;
                }

                return (
                  <div key={stageName} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: dotBg,
                      border: `2px solid ${dotBorder}`,
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.3s ease',
                    }}>
                      {isDone && <span style={{ color: BG, fontSize: 8, fontWeight: 700 }}>✓</span>}
                      {isCurrent && (
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: GOLD,
                          animation: 'vault-pulse 1.5s infinite',
                        }} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: textColor, transition: 'color 0.3s' }}>
                        {label}
                      </div>
                      {isCurrent && (
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                          In progress…
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Elapsed timer */}
          <div style={{ textAlign: 'center', fontSize: 11, color: MUTED, letterSpacing: '0.1em', marginBottom: 16 }}>
            Elapsed: {formatTime(elapsed)}
          </div>

          {/* Long wait reassurance */}
          {showLongWait && (
            <div style={{ background: 'rgba(239,192,60,0.05)', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '16px 20px', fontSize: 13, color: MUTED, lineHeight: 1.7, textAlign: 'center' }}>
              <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>
                Taking Longer Than Usual
              </div>
              The blockchain is experiencing high traffic. You can safely close this page. We'll email your credential as soon as it's ready.
            </div>
          )}

          {/* Failed state */}
          {processingStatus === 'failed' && (
            <div style={{ background: 'rgba(196,92,92,0.07)', border: `1px solid rgba(196,92,92,0.25)`, borderRadius: 3, padding: '16px 20px', fontSize: 13, color: 'rgba(238,233,223,0.75)', lineHeight: 1.7 }}>
              <div style={{ color: RED, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>
                Credential Processing Delayed
              </div>
              There was an issue issuing your credential automatically. Our team has been notified and will issue it manually within 24 hours. You'll receive an email confirmation.
              <div style={{ marginTop: 12 }}>
                <button onClick={() => setPhase('result')} style={btnOutline}>
                  Continue to Dashboard
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  /* RESULT */
  if (phase === 'result' && result) {
    const passed = !!result.passed;
    const simulatorRequired = !!(result.simulatorRequired ?? result.simulator_required);
    const showSimulatorCta = passed && simulatorRequired;
    const scoreValue = result.percentage ?? result.percentageScore ?? result.score ?? 0;
    const scorePct = Math.max(0, Math.min(100, Math.round(scoreValue)));
    const cred = result.credentialId;
    const dims = result.dimScores || result.domainScores || result.dimensions || {};
    const credentialDelayed = passed && !cred;
    const passMarkPct = cfgPassPct;
    const gap = passMarkPct != null
      ? (passed ? Math.max(0, scorePct - passMarkPct) : Math.max(0, passMarkPct - scorePct))
      : null;
    const statusColor = passed ? TEAL2 : RED;
    const statusBg = passed ? 'rgba(34,166,126,0.09)' : 'rgba(196,92,92,0.09)';
    const statusBorder = passed ? 'rgba(34,166,126,0.28)' : 'rgba(196,92,92,0.28)';
    const domainRows = Object.entries(dims).map(([domain, sc]) => {
      const key = normalizeDomainKey(domain);
      const meta = DOMAIN_META[key] || { label: domain, color: GOLD, abbr: String(domain).slice(0, 4).toUpperCase() };
      const pct = typeof sc === 'number'
        ? Math.round(sc)
        : Math.round(sc?.pct ?? sc?.percentage ?? sc?.score ?? (sc?.total ? ((sc.correct || 0) / sc.total) * 100 : 0));
      return { key, pct: Math.max(0, Math.min(100, pct)), ...meta };
    });
    const rankedDomains = [...domainRows].sort((a, b) => b.pct - a.pct);
    const topDomain = rankedDomains[0];
    const focusDomain = rankedDomains[rankedDomains.length - 1];

    return (
      <div style={{ ...base, padding: '52px 44px', minHeight: '100vh' }}>
        {hairline}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1320, width: '100%', margin: '0 auto' }} className="vault-up">

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 28, alignItems: 'stretch', marginBottom: 28 }}>
            <div style={{ background: `linear-gradient(135deg, ${passed ? 'rgba(34,166,126,0.16)' : 'rgba(196,92,92,0.14)'}, rgba(12,16,24,0.96) 48%, rgba(239,192,60,0.08))`, border: `1px solid ${statusBorder}`, borderRadius: 4, padding: '44px 46px', minHeight: 470, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 13, color: GOLD, letterSpacing: '0.24em', textTransform: 'uppercase', marginBottom: 18 }}>
                  Assessment Complete
                </div>
                <h1 style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 76, fontWeight: 300, lineHeight: 0.96, margin: 0, color: WHITE, maxWidth: 680 }}>
                  {passed
                    ? (showSimulatorCta ? "You're halfway there." : 'Credential Ready')
                    : 'Readiness Snapshot'}
                </h1>
                <div style={{ width: 64, height: 1, background: statusColor, margin: '30px 0', opacity: 0.75 }} />
                <p style={{ fontSize: 18, color: 'rgba(238,233,223,0.76)', lineHeight: 1.75, maxWidth: 680, margin: 0 }}>
                  {passed
                    ? (showSimulatorCta
                        ? 'You passed the assessment. To earn your blockchain-verified credential, complete the ATAC Call Readiness Simulator.'
                        : 'You passed the Remote CX Readiness Assessment. Your result now becomes a clear, employer-facing credential moment with proof, performance, and next steps in one place.')
                    : 'This result is a readiness signal, not a dead end. The page now gives candidates a clear view of where they stand and what to focus on before the next attempt or course step.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 34 }}>
                {showSimulatorCta && (
                  <button
                    onClick={() => navigate('/simulator?auto=true')}
                    style={{ ...btnGold, minWidth: 240, padding: '16px 24px' }}
                  >
                    Take the Simulator →
                  </button>
                )}
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{ ...(showSimulatorCta ? btnOutline : btnGold), minWidth: 220, padding: '16px 24px' }}
                >
                  View Dashboard
                </button>
                {passed && cred && (
                  <button onClick={() => downloadCertificate(cred)} style={{ ...btnOutline, minWidth: 220, padding: '16px 24px' }}>
                    Download Certificate
                  </button>
                )}
              </div>
            </div>

            <aside style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '34px 34px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', marginBottom: 34 }}>
                <div>
                  <div style={{ fontSize: 12, color: MUTED, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Assessment Score</div>
                  <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 34, color: WHITE, fontWeight: 300 }}>{passed ? 'Part 1 of 2: Assessment Passed' : 'Assessment Not Passed'}</div>
                </div>
                <div style={{ width: 88, height: 88, borderRadius: '50%', border: `1px solid ${statusBorder}`, background: statusBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: statusColor, fontWeight: 700, letterSpacing: '0.14em' }}>
                  {passed ? 'PASS' : 'REVIEW'}
                </div>
              </div>

              <div>
                <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 104, color: statusColor, fontWeight: 300, lineHeight: 0.9 }}><CountUp value={scorePct} suffix="%" duration={850} /></div>
                <div style={{ color: MUTED, fontSize: 14, margin: '16px 0 18px' }}>
                  Pass threshold: {passMarkPct != null ? `${passMarkPct}%` : '--'}{gap != null ? ` | ${passed ? `${gap}% above threshold` : `${gap}% below threshold`}` : ''}
                </div>
                <div style={{ height: 8, background: BORDER2, borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
                  <div className="asmt-fill" style={{ height: '100%', width: `${scorePct}%`, '--target-w': `${scorePct}%`, background: statusColor, borderRadius: 999 }} />
                  {passMarkPct != null && <div style={{ position: 'absolute', left: `${passMarkPct}%`, top: -4, width: 2, height: 16, background: GOLD }} />}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 30 }}>
                {[
                  { label: 'Questions', value: questions.length || cfgQuestions || '--' },
                  { label: 'Pass Mark', value: passMarkPct != null ? `${passMarkPct}%` : '--' },
                  { label: passed ? 'Status' : 'Gap', value: passed ? 'Ready' : `${gap}%` },
                ].map(item => (
                  <div key={item.label} style={{ background: 'rgba(238,233,223,0.025)', border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '16px 14px' }}>
                    <div style={{ color: WHITE, fontSize: 20, fontFamily: VAULT_FONT_DISPLAY }}>{item.value}</div>
                    <div style={{ color: MUTED, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 6 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(360px, 0.65fr)', gap: 28, alignItems: 'start' }}>
            {domainRows.length > 0 && (
              <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '30px 32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-end', marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 12, color: MUTED, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Domain Breakdown</div>
                    <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 34, fontWeight: 300, color: WHITE }}>Performance by competency</div>
                  </div>
                  <div style={{ color: statusColor, fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{domainRows.length} domains</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                  {domainRows.map(row => {
                    const domainPassed = passMarkPct != null && row.pct >= passMarkPct;
                    return (
                      <div key={row.key} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '18px 18px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                          <div>
                            <div style={{ color: WHITE, fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{row.label}</div>
                            <div style={{ color: MUTED, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 7 }}>{domainPassed ? 'Meets mark' : 'Review area'}</div>
                          </div>
                          <div style={{ color: domainPassed ? row.color : RED, fontFamily: VAULT_FONT_DISPLAY, fontSize: 28, lineHeight: 1 }}><CountUp value={row.pct} suffix="%" duration={850} /></div>
                        </div>
                        <div style={{ height: 5, background: BORDER2, borderRadius: 999, overflow: 'hidden' }}>
                          <div className="asmt-fill" style={{ height: '100%', width: `${row.pct}%`, '--target-w': `${row.pct}%`, background: domainPassed ? row.color : RED, borderRadius: 999 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{
                background: showSimulatorCta ? 'rgba(196,138,42,0.09)' : statusBg,
                border: `1px solid ${showSimulatorCta ? 'rgba(196,138,42,0.28)' : statusBorder}`,
                borderRadius: 4,
                padding: '26px 28px',
              }}>
                <div style={{
                  fontSize: 11,
                  color: showSimulatorCta ? AMBER : statusColor,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}>
                  {passed
                    ? (showSimulatorCta ? 'Simulator Required' : 'Credential Status')
                    : 'Recommended Focus'}
                </div>
                <div style={{ fontFamily: VAULT_FONT_DISPLAY, fontSize: 28, color: WHITE, fontWeight: 300, lineHeight: 1.15 }}>
                  {passed
                    ? (showSimulatorCta
                        ? 'Assessment complete. Simulator required.'
                        : (cred ? 'Blockchain Credential Issued' : 'Credential Being Minted'))
                    : (focusDomain ? focusDomain.label : 'Build readiness first')}
                </div>
                <div style={{ color: 'rgba(238,233,223,0.70)', fontSize: 14, lineHeight: 1.65, marginTop: 12 }}>
                  {passed && showSimulatorCta && 'Complete the ATAC Call Readiness Simulator to earn your credential. Your credential ID will be generated after you pass the simulator.'}
                  {passed && !showSimulatorCta && cred && `Credential ID: ${cred}`}
                  {passed && !showSimulatorCta && credentialDelayed && 'Your credential is being finalized. We will send the credential ID and verification details by email.'}
                  {!passed && 'Start with the lowest-scoring area, then use the course path to build confidence before reassessment.'}
                </div>
              </div>

              <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '24px 26px' }}>
                <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 16 }}>Result Summary</div>
                {[
                  { label: 'Strongest Area', value: topDomain?.label || 'Not available', color: topDomain?.color || GOLD },
                  {
                    label: passed ? 'Credential Path' : 'Primary Opportunity',
                    value: passed
                      ? (showSimulatorCta ? 'Pending simulator' : 'Unlocked')
                      : (focusDomain?.label || 'Review course foundations'),
                    color: passed ? (showSimulatorCta ? AMBER : TEAL2) : RED,
                  },
                  {
                    label: 'Next Step',
                    value: passed
                      ? (showSimulatorCta ? 'Take the simulator' : 'Claim and share credential')
                      : 'Review dashboard guidance',
                    color: GOLD,
                  },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', padding: '13px 0', borderBottom: `1px solid ${BORDER2}` }}>
                    <span style={{ color: MUTED, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{item.label}</span>
                    <span style={{ color: item.color, fontSize: 14, textAlign: 'right', fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      </div>
    );
  }

  return null;
}

/* ── Shared button styles (gold = redesign gradient CTA) ── */
const btnGold = {
  ...goldButton,
  borderRadius: 8, padding: '12px 24px', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.16em',
};
const btnOutline = {
  background: 'transparent', color: WHITE,
  border: `1px solid ${BORDER2}`, borderRadius: 8,
  padding: '11px 24px', fontSize: 11, cursor: 'pointer',
  letterSpacing: '0.1em', textTransform: 'uppercase',
  fontFamily: VAULT_FONT_BODY,
};
