import LanguageSelector from '../components/LanguageSelector';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/client';

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
const DIM_LABELS = ['Professionalism','Communication','CX Operations','Technology','Compliance & Safety','Remote Work Setup'];
const DIM_KEYS   = ['professionalism','communication','cx_operations','technology','compliance_safety','remote_setup'];

// Backwards compat: Normalize legacy dim_scores keys for credentials issued before Apr 28, 2026.
// Maps health_safety -> compliance_safety and remote_work -> remote_setup in-place.
function normalizeDims(dims) {
  if (!dims) return {};
  if (dims.health_safety !== undefined && dims.compliance_safety === undefined) {
    dims.compliance_safety = dims.health_safety;
  }
  if (dims.remote_work !== undefined && dims.remote_setup === undefined) {
    dims.remote_setup = dims.remote_work;
  }
  return dims;
}

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
    navigator.clipboard.writeText(`https://app.atacglobalcx.com/verify/${credId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCertificate = (credId) => {
    const token = localStorage.getItem('atac_token') || localStorage.getItem('token');
    if (!token) return;
    const win = window.open('', '_blank');
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
        win.close();
        alert('Certificate download failed. Please try again.');
        setDownloading(false);
      });
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
    return `Proud to have earned my ${programLabel} from @ATACGlobalCX — blockchain-verified, globally recognized.\n\nVerify my credential: app.atacglobalcx.com/verify/${credId}\n\n#CXCertified #RemoteWork #BlockchainCredential #CustomerExperience #ATACGlobalCX`;
  };

  const copyLinkedInCaption = (cred) => {
    const caption = buildLinkedInCaption(cred);
    navigator.clipboard?.writeText(caption).then(() => {
      setLinkedInCopied(true);
      setTimeout(() => setLinkedInCopied(false), 3000);
    }).catch(() => {
      alert('Could not copy — please select the caption text and copy manually.');
    });
  };

  const logout = () => { localStorage.clear(); navigate('/login'); };

  const latestCred = credentials[0];
  const dims       = normalizeDims(result?.dimensions || {});
  const hasCred    = credentials.length > 0;

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
      <div style={{ background: BG3, borderBottom: `1px solid ${BORDER2}`, padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src="/logo.png" alt="ATAC Global CX" style={{ height: 40, objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 13, color: WHITE }}>{candidate.name}</div>
          {paymentTier && (
            <div style={{ fontSize: 9, background: 'rgba(201,168,76,0.08)', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 10px', color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {paymentTier}
            </div>
          )}
          <LanguageSelector />
          <button onClick={logout} style={{ background: 'none', border: `1px solid ${BORDER2}`, color: MUTED, borderRadius: 2, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px' }}>

        {/* -- Payment success banner -- */}
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

        {/* -- Payment cancelled banner -- */}
        {paymentCancelled && (
          <div className="vault-up" style={{ background: 'rgba(196,92,92,0.07)', border: '1px solid rgba(196,92,92,0.22)', borderRadius: 3, padding: '16px 22px', marginBottom: 20 }}>
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, color: RED, marginBottom: 4 }}>Payment Cancelled</div>
            <div style={{ fontSize: 12, color: MUTED }}>No charge was made. You can restart checkout whenever you're ready.</div>
          </div>
        )}

        {/* -- Assessment ready banner (paid, not started) -- */}
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

        {/* -- Welcome line -- */}
        <div className="vault-up" style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 32, fontWeight: 300, color: WHITE, lineHeight: 1.1 }}>
            {hasCred ? `Welcome back, ${candidate.name?.split(' ')[0] || 'Candidate'}.` : `Welcome, ${candidate.name?.split(' ')[0] || 'Candidate'}.`}
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
            {hasCred ? 'Your certification is active and verifiable on the blockchain.' : 'Complete your assessment to earn your blockchain-verified credential.'}
          </div>
        </div>

        {/* -- Assessment result -- */}
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

        {/* -- Main grid -- */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

          {/* -- LEFT: credentials / get started -- */}
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
                    Connect with certified CX professionals globally. Access job leads, peer support, and resources inside ISORA — the community built for remote CX excellence.
                  </div>
                </div>

                  <a href="https://jeuumk0um700vulubke9.app.clientclub.net/communities/groups/cxgroup/home?invite=69eeca0963e5b0e52f07c03c"
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
                    <span style={{ fontSize: 9, color: '#8a7040' }}>Blockchain-Verified Credential</span>
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
                      { n: '04', t: 'Post it', d: 'Hit Post — your blockchain-verified credential is now live for employers.' },
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
        {/* Full-width certificate preview */}
        {latestCred && (
          <div className="vault-up" style={{ marginTop: 20 }}>
            <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>Certificate Preview</div>
            <div style={{ background: '#04040A', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 3, padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' }}>ATAC Global CX · Verified Credential · ERC-721 · Blockchain-Verified</div>
              <div style={{ fontFamily: VAULT_DISPLAY, fontStyle: 'italic', fontSize: 42, color: WHITE, marginTop: 8 }}>{candidate.name}</div>
              <div style={{ fontSize: 13, color: TEAL2, fontWeight: 600, letterSpacing: '0.08em' }}>{latestCred.program === 'CRSA' ? 'Certified Remote Service Agent (CRSA)' : latestCred.program}</div>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#0D1B2E', border: '2px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: GOLD, margin: '12px 0' }}>★</div>
              <div style={{ fontSize: 12, color: MUTED, maxWidth: 600, textAlign: 'center', lineHeight: 1.8, fontStyle: 'italic' }}>In recognition of demonstrated excellence in remote customer experience operations, professional conduct, and commitment to the highest standards of the global CX industry.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, width: '100%', maxWidth: 640, marginTop: 16 }}>
                {[{ k: 'Credential ID', v: latestCred.credentialId },{ k: 'Issue Date', v: new Date(latestCred.issuedAt).toLocaleDateString() },{ k: 'Status', v: 'Valid', vc: TEAL2 },{ k: 'Expires', v: new Date(latestCred.expiresAt).toLocaleDateString() }].map((m, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 3, padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, marginBottom: 4 }}>{m.k}</div>
                    <div style={{ fontSize: 11, color: m.vc || WHITE, fontWeight: 600 }}>{m.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: TEAL2 }} />
                <span style={{ fontSize: 9, color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Blockchain-Verified · ERC-721ainnet</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


