import LanguageSelector from '../components/LanguageSelector';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/client';

/* ── Vault Design Tokens ─────────────────────────────────── */
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
const DIM_KEYS   = ['professionalism','communication','cx_operations','technology','health_safety','remote_work'];

/* ── Keyframe injection ─────────────────────────────────── */
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
  const candidate = JSON.parse(localStorage.getItem('atac_candidate') || '{}');
  const result    = JSON.parse(localStorage.getItem('atac_result')    || 'null');

  const [credentials,       setCredentials]       = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [copied,            setCopied]            = useState(false);
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

  useEffect(() => {
    injectKF();
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success')    { setPaymentSuccess(true);   window.history.replaceState({}, '', '/dashboard'); }
    if (params.get('payment') === 'cancelled')  { setPaymentCancelled(true); window.history.replaceState({}, '', '/dashboard'); }
    if (candidate.id) { loadCredentials(); checkPaymentStatus(); }
    else { setLoading(false); }
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

  const handleCheckout = async (tier) => {
    try {
      setCheckoutLoading(tier);
      const token = localStorage.getItem('token');
      if (!token) { alert('Your session has expired. Please log in again.'); navigate('/login'); return; }
      const res  = await fetch('https://atac-backend-production.up.railway.app/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      if (data.url) { window.location.href = data.url; return; }
      throw new Error('Stripe checkout URL was not returned');
    } catch (err) { alert(err.message || 'Failed to start checkout'); }
    finally { setCheckoutLoading(''); }
  };

  const startAssessment = async () => {
    setStartingAssessment(true);
    try {
      const tier = paymentTier || 'standard';
      const res  = await API.post('/api/assessment/start', { candidateId: candidate.id, program: 'CRSA', tier });
      localStorage.setItem('atac_session', JSON.stringify(res.data));
      navigate('/assessment');
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Failed to start assessment');
      setStartingAssessment(false);
    }
  };

  const copyLink = (credId) => {
    navigator.clipboard.writeText(`https://atacglobalcx.com/verify/${credId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCertificate = async (credId) => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('atac_token') || localStorage.getItem('token');
      const res   = await fetch(`https://atac-backend-production.up.railway.app/api/certificate/${credId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ATAC-Certificate-${credId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Certificate download failed. Please try again.'); }
    finally { setDownloading(false); }
  };

  const saveWallet = async () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletInput)) {
      setWalletError('Invalid address — must start with 0x and be 42 characters');
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

  const logout = () => { localStorage.clear(); navigate('/login'); };

  const latestCred = credentials[0];
  const dims       = result?.dimensions || {};
  const hasCred    = credentials.length > 0;

  /* ── Shared button styles ── */
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

      {/* ── Topbar ── */}
      <div style={{ background: BG3, borderBottom: `1px solid ${BORDER2}`, padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src="/logo.png" alt="ATAC Global CX" style={{ height: 40, objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 13, color: WHITE }}>{candidate.name}</div>
          {paymentTier && (
            <div style={{ fontSize: 9, background: 'rgba(201,168,76,0.08)', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 10px', color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {paymentTier}
            </div>
          )}
          <button onClick={logout} style={{ background: 'none', border: `1px solid ${BORDER2}`, color: MUTED, borderRadius: 2, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px' }}>

        {/* ── Payment success banner ── */}
        {paymentSuccess && (
          <div className="vault-up" style={{ background: 'rgba(26,143,105,0.08)', border: '1px solid rgba(26,143,105,0.25)', borderRadius: 3, padding: '18px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 18, color: TEAL2, marginBottom: 4 }}>Payment Confirmed — You're Ready to Begin</div>
              <div style={{ fontSize: 12, color: MUTED }}>Your assessment session is ready. Click to start your 40-question timed assessment.</div>
            </div>
            <button className="btn-gold-h" style={{ ...btnGold, width: 'auto', padding: '12px 28px', whiteSpace: 'nowrap', marginBottom: 0, opacity: startingAssessment ? 0.7 : 1 }} onClick={startAssessment} disabled={startingAssessment}>
              {startingAssessment ? 'Starting…' : 'Start Assessment →'}
            </button>
          </div>
        )}

        {/* ── Payment cancelled banner ── */}
        {paymentCancelled && (
          <div className="vault-up" style={{ background: 'rgba(196,92,92,0.07)', border: '1px solid rgba(196,92,92,0.22)', borderRadius: 3, padding: '16px 22px', marginBottom: 20 }}>
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, color: RED, marginBottom: 4 }}>Payment Cancelled</div>
            <div style={{ fontSize: 12, color: MUTED }}>No charge was made. You can restart checkout whenever you're ready.</div>
          </div>
        )}

        {/* ── Assessment ready banner (paid, not started) ── */}
        {!paymentSuccess && paymentVerified && !result && credentials.length === 0 && (
          <div className="vault-up" style={{ background: 'rgba(91,168,212,0.07)', border: '1px solid rgba(91,168,212,0.22)', borderRadius: 3, padding: '18px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 18, color: '#5BA8D4', marginBottom: 4 }}>Your Assessment Is Ready</div>
              <div style={{ fontSize: 12, color: MUTED }}>Payment verified{paymentTier ? ` · ${paymentTier.toUpperCase()} tier` : ''}. Start your 40-question timed assessment when you're ready.</div>
            </div>
            <button className="btn-gold-h" style={{ ...btnGold, width: 'auto', padding: '12px 28px', whiteSpace: 'nowrap', marginBottom: 0, opacity: startingAssessment ? 0.7 : 1 }} onClick={startAssessment} disabled={startingAssessment}>
              {startingAssessment ? 'Starting…' : 'Start Assessment →'}
            </button>
          </div>
        )}

        {/* ── Welcome line ── */}
        <div className="vault-up" style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 32, fontWeight: 300, color: WHITE, lineHeight: 1.1 }}>
            {hasCred ? `Welcome back, ${candidate.name?.split(' ')[0] || 'Candidate'}.` : `Welcome, ${candidate.name?.split(' ')[0] || 'Candidate'}.`}
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
            {hasCred ? 'Your certification is active and verifiable on the blockchain.' : 'Complete your assessment to earn your blockchain-verified credential.'}
          </div>
        </div>

        {/* ── Assessment result ── */}
        {result && (
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
              <button className="btn-gold-h" style={{ ...btnGold, marginTop: 16, marginBottom: 0 }} onClick={() => navigate('/simulator')}>
                Proceed to Call Readiness Simulator™ →
              </button>
            )}
          </div>
        )}

        {/* ── Main grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

          {/* ── LEFT: credentials / get started ── */}
          <div>

            {/* My Credentials card */}
            <div className="vault-up" style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '22px 24px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 16 }}>My Credentials</div>

              {loading ? (
                <div style={{ color: MUTED, fontSize: 13 }}>Loading…</div>
              ) : credentials.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: 14, color: MUTED, marginBottom: 20 }}>No credentials issued yet.</div>
                  {paymentVerified ? (
                    <button className="btn-gold-h" style={{ ...btnGold, width: 'auto', padding: '12px 28px', margin: '0 auto' }} onClick={startAssessment}>
                      Start Assessment →
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

            {/* Start assessment (paid, no result) */}
            {!result && credentials.length === 0 && paymentVerified && (
              <div className="vault-up" style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '22px 24px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>Ready to Begin</div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 20 }}>
                  Your payment is verified. Launch the Remote CX Readiness Assessment™ when you're ready.
                </div>
                <button className="btn-gold-h" style={btnGold} onClick={startAssessment}>
                  {startingAssessment ? 'Starting…' : 'Start Assessment — CRSA'}
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT: certificate panel ── */}
          <div>
            {latestCred ? (
              <div className="vault-up">

                {/* Certificate card — parchment style on dark */}
                <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>Your Certificate</div>
                <div style={{ background: '#F5F0E4', border: '1px solid #D4C89A', borderRadius: 3, padding: '22px', color: '#1a1208', marginBottom: 14 }}>

                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e0d5b0', paddingBottom: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8a7040', marginBottom: 3 }}>ATAC Global CX · Verified Credentials</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#3d2e0a' }}>Certificate of Achievement</div>
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0D1B2E', border: '2px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#C9A84C' }}>★</div>
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
                    <span style={{ fontSize: 9, color: '#8a7040' }}>Blockchain-Verified Credential · Mainnet</span>
                  </div>
                </div>

                {/* Action buttons */}
                <button className="btn-gold-h" style={btnGold} onClick={() => downloadCertificate(latestCred.credentialId)} disabled={downloading}>
                  {downloading ? 'Generating PDF…' : '↓ Download PDF Certificate'}
                </button>
                <button className="btn-gold-h" style={btnGold} onClick={() => copyLink(latestCred.credentialId)}>
                  {copied ? '✓ Copied!' : 'Copy Verification Link'}
                </button>
                <button className="btn-gold-h" style={btnTeal} onClick={() => {
                  const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=Certified+Remote+Service+Agent+(CRSA)&organizationId=ATAC&certUrl=https://atacglobalcx.com/verify/${latestCred.credentialId}&certId=${latestCred.credentialId}`;
                  window.open(url, '_blank');
                }}>
                  Add to LinkedIn Profile
                </button>
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
                    {walletSaved && <div style={{ fontSize: 12, color: TEAL2, marginBottom: 6 }}>✓ Wallet saved — blockchain minting enabled</div>}
                    <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Blockchain Wallet</div>
                    <div style={{ fontSize: 11, color: MUTED, wordBreak: 'break-all', fontFamily: 'monospace' }}>{candidateWallet}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="vault-up" style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '22px 24px' }}>
                <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>Your Certificate</div>
                <div style={{ fontSize: 13, color: MUTED, textAlign: 'center', padding: '32px 0', lineHeight: 1.7 }}>
                  Complete your assessment to earn your<br />blockchain-verified certificate.
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}