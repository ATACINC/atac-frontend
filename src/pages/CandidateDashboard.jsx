import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Brand tokens (matches EmployerPortal.jsx pattern) ─────────────────────────
const NAVY   = '#0D1B2E';
const NAVY2  = '#122238';
const NAVY3  = '#162d47';
const GOLD   = '#D4A843';
const GOLD2  = '#E8C06A';
const TEAL   = '#1D9E75';
const TEAL2  = '#26B589';
const WHITE  = '#F5F3EE';
const MUTED  = 'rgba(245,243,238,0.55)';
const FAINT  = 'rgba(245,243,238,0.06)';
const BORDER = 'rgba(212,168,67,0.18)';
const BORDER2= 'rgba(245,243,238,0.08)';
const RED    = '#c0392b';

const API_BASE    = 'https://atac-backend-production.up.railway.app';
const POLYGONSCAN = 'https://polygonscan.com/tx/';

const DIM_COLORS = ['#5DCAA5','#378ADD','#D4A843','#D85A30','#D4537E','#7F77DD'];
const DIM_LABELS = ['Professionalism','Communication Skills','CX Operations','Technology Skills','Health, Safety & Compliance','Remote Work Setup'];
const DIM_KEYS   = ['professionalism','communication','cx_operations','technology','health_safety','remote_work'];

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page:       { minHeight: '100vh', background: '#0a1625', fontFamily: 'DM Sans, sans-serif', color: WHITE, padding: 24 },
  dash:       { background: NAVY, borderRadius: 12, overflow: 'hidden', maxWidth: 1100, margin: '0 auto', position: 'relative' },
  topbar:     { background: NAVY2, borderBottom: `1px solid ${BORDER}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brand:      { fontFamily: 'Georgia, serif', fontSize: 15, color: GOLD, letterSpacing: '0.07em' },
  brandSub:   { fontSize: 11, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 },
  topRight:   { display: 'flex', alignItems: 'center', gap: 10 },
  avatar:     { width: 36, height: 36, borderRadius: '50%', background: 'rgba(212,168,67,0.15)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: GOLD },
  banner:     { background: 'rgba(29,158,117,0.12)', borderBottom: '1px solid rgba(29,158,117,0.25)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 },
  bannerText: { fontSize: 13, color: TEAL2, fontWeight: 500 },
  bannerSub:  { fontSize: 12, color: 'rgba(38,181,137,0.65)', marginTop: 1 },
  checkCircle:{ width: 28, height: 28, borderRadius: '50%', background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  grid:       { display: 'grid', gridTemplateColumns: '1fr 340px' },
  leftCol:    { padding: 24, borderRight: `1px solid ${BORDER2}` },
  rightCol:   { padding: 24, background: NAVY2 },
  eyebrow:    { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: GOLD, marginBottom: 10 },
  tabBar:     { display: 'flex', borderBottom: `1px solid ${BORDER2}`, marginBottom: 20 },
  tab:        (active) => ({ padding: '9px 16px', fontSize: 12, cursor: 'pointer', borderBottom: `2px solid ${active ? GOLD : 'transparent'}`, color: active ? GOLD : MUTED, transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.07em', background: 'none', border: 'none', borderBottom: `2px solid ${active ? GOLD : 'transparent'}`, fontFamily: 'DM Sans, sans-serif' }),
  scoreRow:   { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 },
  scoreCard:  (pass) => ({ background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }),
  scoreNum:   (pass) => ({ fontFamily: 'Georgia, serif', fontSize: 26, color: pass ? TEAL2 : GOLD, lineHeight: 1 }),
  scoreLbl:   { fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 },
  dimRow:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  dimName:    { fontSize: 12, color: MUTED, width: 180, flexShrink: 0 },
  dimTrack:   { flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' },
  dimVal:     { fontSize: 12, color: WHITE, width: 34, textAlign: 'right', flexShrink: 0 },
  renewBox:   { background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 8, padding: 14, marginBottom: 16 },
  renewRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  stepItem:   { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', border: `1px solid ${BORDER2}`, borderRadius: 8, marginBottom: 8, background: FAINT },
  stepNum:    (done) => ({ width: 22, height: 22, borderRadius: '50%', background: done ? 'rgba(29,158,117,0.15)' : 'rgba(212,168,67,0.15)', border: `1px solid ${done ? 'rgba(29,158,117,0.3)' : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: done ? TEAL2 : GOLD, flexShrink: 0, marginTop: 1 }),
  stepTitle:  { fontSize: 13, color: WHITE, fontWeight: 500, marginBottom: 2 },
  stepDesc:   { fontSize: 12, color: MUTED, lineHeight: 1.5 },
  stepCta:    { display: 'inline-block', marginTop: 6, fontSize: 11, color: TEAL2, border: '1px solid rgba(29,158,117,0.3)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', background: 'none', fontFamily: 'DM Sans, sans-serif', transition: 'background 0.2s' },
  certCard:   { background: '#faf8f4', border: '1px solid #d4c89a', borderRadius: 8, padding: '20px 22px', color: '#1a1208', marginBottom: 20 },
  certOrg:    { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8a7040' },
  certOrgMain:{ fontSize: 12, fontWeight: 500, color: '#3d2e0a', marginTop: 2 },
  certTitle:  { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8a7040', textAlign: 'center', marginBottom: 6 },
  certName:   { fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 22, color: '#1a1208', textAlign: 'center', marginBottom: 4 },
  certDesig:  { fontSize: 12, color: TEAL, textAlign: 'center', fontWeight: 500, marginBottom: 14 },
  certMeta:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid #e0d5b0', paddingTop: 12, marginBottom: 12 },
  certKey:    { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8a7040' },
  certVal:    (green) => ({ fontSize: 12, color: green ? TEAL : '#1a1208', fontWeight: 500, marginTop: 2 }),
  certFooter: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderTop: '1px solid #e0d5b0', paddingTop: 12 },
  certChain:  { fontSize: 9, color: '#8a7040', marginTop: 10, paddingTop: 8, borderTop: '1px solid #e0d5b0', display: 'flex', alignItems: 'center', gap: 4 },
  btnPrimary: (loading) => ({ background: loading ? 'rgba(212,168,67,0.7)' : GOLD, color: NAVY, border: 'none', borderRadius: 6, padding: '11px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8, transition: 'background 0.2s' }),
  btnLinkedIn:{ background: '#0A66C2', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '0.05em', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  btnTeal:    { background: TEAL, color: '#fff', border: 'none', borderRadius: 6, padding: '11px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '0.05em', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  btnSecond:  { background: 'transparent', color: WHITE, border: `1px solid ${BORDER2}`, borderRadius: 6, padding: '10px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  shareLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: MUTED, marginBottom: 8, marginTop: 16 },
  copyRow:    { display: 'flex', gap: 6 },
  copyInput:  { flex: 1, background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 5, padding: '7px 10px', fontSize: 11, color: MUTED, fontFamily: 'DM Sans, sans-serif', outline: 'none' },
  copyBtn:    { background: 'rgba(212,168,67,0.15)', border: `1px solid ${BORDER}`, borderRadius: 5, padding: '7px 12px', fontSize: 11, color: GOLD, cursor: 'pointer', whiteSpace: 'nowrap' },
  toast:      (show, err) => ({ position: 'fixed', top: 24, right: 24, background: err ? RED : TEAL, color: '#fff', fontSize: 12, padding: '10px 18px', borderRadius: 6, opacity: show ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: 'none', zIndex: 999, fontFamily: 'DM Sans, sans-serif' }),
  credRow:    { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1px solid ${BORDER2}`, borderRadius: 7, marginBottom: 6, background: FAINT },
  credIcon:   { width: 28, height: 28, borderRadius: 6, background: 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  credStatus: { fontSize: 10, color: TEAL2, background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 10, padding: '2px 8px', whiteSpace: 'nowrap' },
  loadBox:    { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: MUTED, fontSize: 13 },
  errBox:     { background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 8, padding: '14px 18px', color: '#e74c3c', fontSize: 13, margin: 24 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('atac_token') || '';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="#0D1B2E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconLinkedIn = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="12" height="12" rx="2" stroke="#fff" strokeWidth="1.2"/>
    <line x1="4" y1="6" x2="4" y2="10" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="4" y1="4" x2="4" y2="4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M7 10V7.5c0-.8.6-1.5 1.5-1.5S10 6.7 10 7.5V10" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="7" y1="6" x2="7" y2="10" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconVerify = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5.5" stroke="#fff" strokeWidth="1.2"/>
    <polyline points="4.5,7 6.5,9 9.5,5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconLink = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M5.5 8.5L8.5 5.5M6 3.5H3.5A2 2 0 001.5 5.5v5A2 2 0 003.5 12.5h5A2 2 0 0010.5 10.5V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M8.5 1.5h4v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <polyline points="2,7 5.5,10.5 12,3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconSpinner = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'atac-spin 1s linear infinite' }}>
    <circle cx="7" cy="7" r="5" stroke="#0D1B2E" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="5"/>
  </svg>
);

// ── Main component ────────────────────────────────────────────────────────────
export default function CandidateDashboard() {
  const navigate = useNavigate();

  const [tab,         setTab]         = useState('overview');
  const [cred,        setCred]        = useState(null);
  const [assessment,  setAssessment]  = useState(null);
  const [candidate,   setCandidate]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [downloading, setDownloading] = useState(false);
  const [toast,       setToast]       = useState({ show: false, msg: '', err: false });

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, err = false) => {
    setToast({ show: true, msg, err });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  }, []);

  // ── Load credential data on mount ───────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) { navigate('/login'); return; }

    (async () => {
      try {
        // 1. Load candidate profile
        const profileRes = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (profileRes.status === 401) { navigate('/login'); return; }
        const profile = await profileRes.json();
        setCandidate(profile);

        // 2. Load credentials
        const credRes = await fetch(`${API_BASE}/api/credentials/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const credData = await credRes.json();
        const activeCred = Array.isArray(credData)
          ? credData.find(c => c.status === 'active') || credData[0]
          : credData;
        setCred(activeCred);

        // 3. Load latest assessment
        const assessRes = await fetch(`${API_BASE}/api/assessment/my-results`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const assessData = await assessRes.json();
        const latest = Array.isArray(assessData) ? assessData[0] : assessData;
        setAssessment(latest);

      } catch (e) {
        setError('Could not load your dashboard. Please refresh or log in again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  // ── Download certificate ────────────────────────────────────────────────────
  const downloadCertificate = async () => {
    if (!cred?.credential_id) { showToast('No credential found.', true); return; }
    const token = getToken();
    if (!token) { navigate('/login'); return; }

    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/api/certificate-embedded/${cred.credential_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) { navigate('/login'); return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Could not generate certificate.', true);
        return;
      }
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, '_blank');
      if (!win) {
        showToast('Pop-up blocked — please allow pop-ups for this site.', true);
      } else {
        showToast('Certificate opened — use File › Print › Save as PDF');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      showToast('Network error — check your connection.', true);
    } finally {
      setDownloading(false);
    }
  };

  // ── View on Polygonscan ─────────────────────────────────────────────────────
  const viewOnBlockchain = () => {
    if (!cred?.tx_hash) { showToast('Transaction hash not yet available.', true); return; }
    window.open(POLYGONSCAN + cred.tx_hash, '_blank');
  };

  // ── LinkedIn add certification ──────────────────────────────────────────────
  const addToLinkedIn = () => {
    const credId  = cred?.credential_id || '';
    const name    = encodeURIComponent('Certified Remote Service Agent (CRSA)');
    const org     = encodeURIComponent('ATAC Global CX');
    const certUrl = encodeURIComponent(`https://atacglobalcx.com/verify/${credId}`);
    window.open(
      `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${name}&organizationName=${org}&certUrl=${certUrl}&certId=${credId}`,
      '_blank'
    );
  };

  // ── Copy verify URL ─────────────────────────────────────────────────────────
  const copyUrl = () => {
    const url = `atacglobalcx.com/verify/${cred?.credential_id || ''}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    showToast('Verification URL copied to clipboard');
  };

  // ── Computed values ─────────────────────────────────────────────────────────
  const dimScores = assessment?.dim_scores || {};
  const txShort   = cred?.tx_hash
    ? `${cred.tx_hash.slice(0, 6)}…${cred.tx_hash.slice(-4)}`
    : 'Verifying...';
  const candidateName = candidate?.name || 'Candidate';
  const programFull   = cred?.program === 'CRSA' ? 'Certified Remote Service Agent' : (cred?.program || 'CRSA');

  // ── Render: loading / error ─────────────────────────────────────────────────
  if (loading) return (
    <div style={s.page}>
      <div style={s.dash}>
        <div style={s.loadBox}>Loading your dashboard…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={s.page}>
      <div style={s.dash}>
        <div style={s.errBox}>{error}</div>
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Spin keyframe injected once */}
      <style>{`@keyframes atac-spin { to { transform: rotate(360deg); } } @media(max-width:800px){.atac-grid{grid-template-columns:1fr!important;}}`}</style>

      <div style={s.page}>
        <div style={s.dash}>

          {/* Topbar */}
          <div style={s.topbar}>
            <div>
              <div style={s.brand}>ATAC Global CX</div>
              <div style={s.brandSub}>Candidate Dashboard</div>
            </div>
            <div style={s.topRight}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: WHITE }}>{candidateName}</div>
                <div style={{ fontSize: 10, color: MUTED }}>{candidate?.email}</div>
              </div>
              <div style={s.avatar}>{initials(candidateName)}</div>
            </div>
          </div>

          {/* Success banner */}
          {cred && (
            <div style={s.banner}>
              <div style={s.checkCircle}><IconCheck /></div>
              <div>
                <div style={s.bannerText}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: TEAL, display: 'inline-block', marginRight: 5, animation: 'atac-spin 2s ease-in-out infinite' }} />
                  Credential minted on Polygon Mainnet · {cred.credential_id}
                </div>
                <div style={s.bannerSub}>
                  ERC-721 token issued · {fmtDate(cred.issued_at)} · Verifiable at atacglobalcx.com/verify
                </div>
              </div>
            </div>
          )}

          {/* Main grid */}
          <div style={s.grid} className="atac-grid">

            {/* Left column */}
            <div style={s.leftCol}>

              {/* Tab bar */}
              <div style={s.tabBar}>
                {['overview','credentials','next'].map(t => (
                  <button key={t} style={s.tab(tab === t)} onClick={() => setTab(t)}>
                    {t === 'next' ? 'Upgrade Path' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* ── Overview tab ── */}
              {tab === 'overview' && (
                <>
                  <div style={s.eyebrow}>
                    Assessment Results — {cred?.program || 'CRSA'} · {fmtDate(assessment?.completed_at || cred?.issued_at)}
                  </div>

                  {/* Score cards */}
                  <div style={s.scoreRow}>
                    <div style={s.scoreCard()}>
                      <div style={s.scoreNum(true)}>{assessment?.score ?? '—'}</div>
                      <div style={s.scoreLbl}>Score / 40</div>
                    </div>
                    <div style={s.scoreCard()}>
                      <div style={s.scoreNum(true)}>{assessment?.percentage != null ? `${assessment.percentage}%` : '—'}</div>
                      <div style={s.scoreLbl}>Percentage</div>
                    </div>
                    <div style={s.scoreCard()}>
                      <div style={s.scoreNum(false)}>
                        {assessment?.duration_minutes != null ? `${assessment.duration_minutes}m` : '—'}
                      </div>
                      <div style={s.scoreLbl}>Completed in</div>
                    </div>
                    <div style={s.scoreCard()}>
                      <div style={{ ...s.scoreNum(true), fontSize: 18, paddingTop: 4 }}>
                        {assessment?.passed ? 'PASS' : assessment ? 'FAIL' : '—'}
                      </div>
                      <div style={s.scoreLbl}>Status</div>
                    </div>
                  </div>

                  {/* Dimension bars */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={s.eyebrow}>Performance by dimension</div>
                    {DIM_KEYS.map((key, i) => {
                      const pct = dimScores[key] != null ? Math.round(dimScores[key]) : null;
                      return (
                        <div key={key} style={s.dimRow}>
                          <div style={s.dimName}>{DIM_LABELS[i]}</div>
                          <div style={s.dimTrack}>
                            <div style={{ height: 5, borderRadius: 3, width: `${pct ?? 0}%`, background: DIM_COLORS[i] }} />
                          </div>
                          <div style={s.dimVal}>{pct != null ? `${pct}%` : '—'}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Renewal box */}
                  {cred && (
                    <div style={s.renewBox}>
                      <div style={s.renewRow}>
                        <div style={{ fontSize: 12, color: MUTED }}>Credential valid until</div>
                        <div style={{ fontSize: 12, color: WHITE, fontWeight: 500 }}>{fmtDate(cred.expires_at)}</div>
                      </div>
                      <div style={{ ...s.renewRow, marginTop: 6 }}>
                        <div style={{ fontSize: 12, color: MUTED }}>Status</div>
                        <div style={{ fontSize: 12, color: TEAL2, fontWeight: 500 }}>{cred.status?.toUpperCase() || 'ACTIVE'}</div>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                        <div style={{ height: 4, background: GOLD, borderRadius: 2, width: '4%' }} />
                      </div>
                    </div>
                  )}

                  {/* Next steps */}
                  <div style={s.eyebrow}>Recommended next steps</div>
                  <div style={s.stepItem}>
                    <div style={s.stepNum(false)}>1</div>
                    <div>
                      <div style={s.stepTitle}>Download your PDF certificate</div>
                      <div style={s.stepDesc}>Your signed certificate includes your credential ID, blockchain hash, and QR code for instant employer verification.</div>
                      <button style={s.stepCta} onClick={downloadCertificate}>Download PDF →</button>
                    </div>
                  </div>
                  <div style={s.stepItem}>
                    <div style={s.stepNum(false)}>2</div>
                    <div>
                      <div style={s.stepTitle}>Add {cred?.program || 'CRSA'} to your LinkedIn profile</div>
                      <div style={s.stepDesc}>Share your blockchain-verified credential directly to LinkedIn as a professional certification.</div>
                      <button style={s.stepCta} onClick={addToLinkedIn}>Share on LinkedIn →</button>
                    </div>
                  </div>
                  <div style={s.stepItem}>
                    <div style={s.stepNum(false)}>3</div>
                    <div>
                      <div style={s.stepTitle}>Upgrade to CCSA — $129</div>
                      <div style={s.stepDesc}>Your Pro assessment credit is waiting. Apply it toward the Certified Customer Service Agent designation.</div>
                      <button style={s.stepCta} onClick={() => showToast('Loading upgrade options...')}>Claim upgrade credit →</button>
                    </div>
                  </div>
                </>
              )}

              {/* ── Credentials tab ── */}
              {tab === 'credentials' && (
                <>
                  <div style={s.eyebrow}>Issued credentials</div>
                  {cred ? (
                    <div style={s.credRow}>
                      <div style={s.credIcon}>
                        <svg viewBox="0 0 13 13" fill="none" width="13" height="13">
                          <rect x="1" y="1" width="11" height="11" rx="2" stroke="#26B589" strokeWidth="1.2"/>
                          <polyline points="3.5,6.5 5.5,8.5 9.5,4.5" stroke="#26B589" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: WHITE, fontWeight: 500 }}>{programFull} ({cred.program})</div>
                        <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>
                          {cred.credential_id} · Issued {fmtDate(cred.issued_at)} · Expires {fmtDate(cred.expires_at)}
                        </div>
                      </div>
                      <div style={s.credStatus}>Valid</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: MUTED }}>No credentials issued yet.</div>
                  )}
                  {/* Locked future certs */}
                  {[
                    { label: 'Certified Customer Service Agent (CCSA)', price: '$129 with credit applied' },
                    { label: 'Certified Contact Center Agent (CCCA)',    price: '$179' },
                    { label: 'Certified Remote Service Supervisor (CRSS)', price: '$249' },
                  ].map((item, i) => (
                    <div key={i} style={{ ...s.credRow, opacity: 0.4 }}>
                      <div style={{ ...s.credIcon, background: FAINT, borderColor: BORDER2 }}>
                        <svg viewBox="0 0 13 13" fill="none" width="13" height="13">
                          <rect x="1" y="1" width="11" height="11" rx="2" stroke="#888" strokeWidth="1.2"/>
                          <line x1="4" y1="6.5" x2="9" y2="6.5" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>Not yet earned · {item.price}</div>
                      </div>
                      <div style={{ fontSize: 10, color: MUTED, border: `1px solid ${BORDER2}`, borderRadius: 10, padding: '2px 8px' }}>Locked</div>
                    </div>
                  ))}
                </>
              )}

              {/* ── Upgrade path tab ── */}
              {tab === 'next' && (
                <>
                  <div style={s.eyebrow}>Your certification pathway</div>
                  <div style={{ fontSize: 13, color: MUTED, marginBottom: 16, lineHeight: 1.7 }}>
                    You have completed your entry-level CRSA. Here is your full pathway to senior designation — each credential builds on the last.
                  </div>
                  <div style={s.stepItem}>
                    <div style={s.stepNum(true)}>✓</div>
                    <div>
                      <div style={{ ...s.stepTitle, color: TEAL2 }}>CRSA — Certified Remote Service Agent</div>
                      <div style={s.stepDesc}>Completed · {fmtDate(cred?.issued_at)} · Score {assessment?.percentage ?? '—'}%</div>
                    </div>
                  </div>
                  {[
                    { num: 2, title: 'CCSA — Certified Customer Service Agent · $129', desc: '$20 credit applied automatically. Front-line agent cert for any sector. Psychology, service recovery, product knowledge.', cta: 'Enrol with credit →' },
                    { num: 3, title: 'CRSS / CCSS — Supervisor Designation · $249', desc: 'Leadership certification for supervisors managing remote CX teams. Remote QA, coaching at a distance, workforce management. 9 modules.', cta: null, dim: true },
                    { num: 4, title: 'CCSM — Certified Customer Service Manager · $349', desc: 'Advanced management designation. ISO-aligned. Leadership, HR, CX program design to national occupational standards.', cta: null, dim: true },
                  ].map(item => (
                    <div key={item.num} style={{ ...s.stepItem, opacity: item.dim ? 0.5 : 1 }}>
                      <div style={s.stepNum(false)}>{item.num}</div>
                      <div>
                        <div style={s.stepTitle}>{item.title}</div>
                        <div style={s.stepDesc}>{item.desc}</div>
                        {item.cta && <button style={s.stepCta} onClick={() => showToast('Loading enrolment...')}>{item.cta}</button>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Right column */}
            <div style={s.rightCol}>
              <div style={s.eyebrow}>Your certificate</div>

              {/* Certificate card preview */}
              {cred && (
                <div style={s.certCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e0d5b0', paddingBottom: 12, marginBottom: 14 }}>
                    <div>
                      <div style={s.certOrg}>ATAC Global CX · Verified Credentials</div>
                      <div style={s.certOrgMain}>Certificate of Achievement</div>
                    </div>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: NAVY, border: `2px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
                        <polygon points="9,1 11.2,6.2 17,6.2 12.4,9.8 14.1,15.5 9,12.2 3.9,15.5 5.6,9.8 1,6.2 6.8,6.2" stroke={GOLD} strokeWidth="1" fill="none"/>
                      </svg>
                    </div>
                  </div>
                  <div style={s.certTitle}>Certificate of Achievement</div>
                  <div style={{ fontSize: 11, color: '#8a7040', textAlign: 'center', marginBottom: 4 }}>Proudly Presented To</div>
                  <div style={s.certName}>{candidateName}</div>
                  <div style={s.certDesig}>{programFull} ({cred.program})</div>
                  <div style={s.certMeta}>
                    <div><div style={s.certKey}>Credential ID</div><div style={s.certVal(false)}>{cred.credential_id}</div></div>
                    <div><div style={s.certKey}>Issue Date</div><div style={s.certVal(false)}>{fmtDate(cred.issued_at)}</div></div>
                    <div><div style={s.certKey}>Status</div><div style={s.certVal(true)}>Valid</div></div>
                    <div><div style={s.certKey}>Expires</div><div style={s.certVal(false)}>{fmtDate(cred.expires_at)}</div></div>
                  </div>
                  <div style={s.certFooter}>
                    <div style={{ fontSize: 10, color: '#8a7040' }}>
                      <div>Verify at</div>
                      <strong style={{ display: 'block', fontSize: 11, color: '#3d2e0a' }}>atacglobalcx.com/verify</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ width: 80, height: 1, background: '#8a7040', marginBottom: 3, marginLeft: 'auto' }} />
                      <div style={{ fontSize: 10, color: '#3d2e0a', fontWeight: 500 }}>Tugreofia Smith</div>
                      <div style={{ fontSize: 9, color: '#8a7040' }}>CEO & Lead Instructor, ATAC Global CX</div>
                    </div>
                  </div>
                  <div style={s.certChain}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: TEAL, flexShrink: 0 }} />
                    Blockchain-Verified Credential · Token #{cred.token_id || 'N/A'} · TX: {txShort}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <button style={s.btnPrimary(downloading)} onClick={downloadCertificate} disabled={downloading}>
                {downloading ? <IconSpinner /> : <IconDownload />}
                {downloading ? 'Generating Certificate...' : 'Download PDF Certificate'}
              </button>
              <button style={s.btnLinkedIn} onClick={addToLinkedIn}>
                <IconLinkedIn /> Add to LinkedIn Profile
              </button>
              <button style={s.btnTeal} onClick={viewOnBlockchain}>
                <IconVerify /> View Live on Blockchain
              </button>
              <button style={s.btnSecond} onClick={copyUrl}>
                <IconLink /> Copy Shareable Link
              </button>

              {/* Verify URL */}
              <div style={s.shareLabel}>Verification URL</div>
              <div style={s.copyRow}>
                <input
                  style={s.copyInput}
                  value={`atacglobalcx.com/verify/${cred?.credential_id || ''}`}
                  readOnly
                  id="verify-url"
                />
                <div style={s.copyBtn} onClick={copyUrl}>Copy</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div style={s.toast(toast.show, toast.err)}>{toast.msg}</div>
    </>
  );
}