import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/client';

const s = {
  page: { minHeight: '100vh', background: '#0D1B2E', fontFamily: 'DM Sans, sans-serif', color: '#F5F3EE' },
  header: { background: '#122238', borderBottom: '1px solid rgba(212,168,67,0.18)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: 'Georgia, serif', fontSize: 15, color: '#D4A843' },
  body: { maxWidth: 960, margin: '0 auto', padding: '32px 24px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 },
  card: { background: '#122238', border: '1px solid rgba(245,243,238,0.09)', borderRadius: 8, padding: '20px 22px', marginBottom: 16 },
  eyebrow: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#D4A843', marginBottom: 12 },
  credCard: { background: '#faf8f4', border: '1px solid #d4c89a', borderRadius: 8, padding: '20px 22px', color: '#1a1208' },
  credOrg: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8a7040', marginBottom: 4 },
  credTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8a7040', textAlign: 'center', marginBottom: 6 },
  credName: { fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 22, color: '#1a1208', textAlign: 'center', marginBottom: 4 },
  credDesig: { fontSize: 12, color: '#0F6E56', textAlign: 'center', fontWeight: 600, marginBottom: 14 },
  metaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid #e0d5b0', paddingTop: 12, marginBottom: 12 },
  metaKey: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8a7040' },
  metaVal: { fontSize: 12, color: '#1a1208', fontWeight: 600, marginTop: 2 },
  chainRow: { fontSize: 9, color: '#8a7040', borderTop: '1px solid #e0d5b0', paddingTop: 8, display: 'flex', alignItems: 'center', gap: 4 },
  chainDot: { width: 5, height: 5, borderRadius: '50%', background: '#0F6E56', flexShrink: 0 },
  btnGold: { width: '100%', background: '#D4A843', color: '#0D1B2E', border: 'none', borderRadius: 6, padding: '11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnTeal: { width: '100%', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, padding: '11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 },
  btnOut: { width: '100%', background: 'transparent', color: '#F5F3EE', border: '1px solid rgba(245,243,238,0.15)', borderRadius: 6, padding: '10px', fontSize: 12, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 },
  scoreNum: { fontFamily: 'Georgia, serif', fontSize: 26, color: '#D4A843', lineHeight: 1 },
  scoreLbl: { fontSize: 10, color: 'rgba(245,243,238,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 },
  statBox: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,243,238,0.08)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' },
  dimRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  dimName: { fontSize: 12, color: 'rgba(245,243,238,0.5)', width: 170, flexShrink: 0 },
  dimTrack: { flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3 },
  noCredCard: { textAlign: 'center', padding: '40px 20px' },
  payGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 },
  payCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,243,238,0.08)', borderRadius: 8, padding: '16px' },
  payTitle: { fontSize: 13, fontWeight: 700, marginBottom: 4 },
  payPrice: { fontFamily: 'Georgia, serif', fontSize: 24, color: '#D4A843', marginBottom: 8 },
  payCopy: { fontSize: 12, lineHeight: 1.5, color: 'rgba(245,243,238,0.6)', marginBottom: 12 },
};

const DIM_COLORS = ['#5DCAA5', '#378ADD', '#D4A843', '#D85A30', '#D4537E', '#7F77DD'];
const DIM_LABELS = ['Professionalism', 'Communication', 'CX Operations', 'Technology', 'Health & Safety', 'Remote Work'];

export default function Dashboard() {
  const navigate = useNavigate();
  const candidate = JSON.parse(localStorage.getItem('atac_candidate') || '{}');
  const result = JSON.parse(localStorage.getItem('atac_result') || 'null');

  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [paymentTier, setPaymentTier] = useState('');
  const [startingAssessment, setStartingAssessment] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [walletInput, setWalletInput]   = useState('');
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletSaved, setWalletSaved]   = useState(false);
  const [walletError, setWalletError]   = useState('');
  const [candidateWallet, setCandidateWallet] = useState(candidate.wallet_address || '');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setPaymentSuccess(true);
      window.history.replaceState({}, '', '/dashboard');
    }
    if (params.get('payment') === 'cancelled') {
      setPaymentCancelled(true);
      window.history.replaceState({}, '', '/dashboard');
    }
    if (candidate.id) {
      loadCredentials();
      checkPaymentStatus();
    } else {
      setLoading(false);
    }
  }, []);

  const checkPaymentStatus = async () => {
    try {
      const res = await API.get('/api/auth/me');
      const dbCandidate = res.data.candidate || {};
      setPaymentVerified(!!dbCandidate.payment_verified);
      setPaymentTier(dbCandidate.payment_tier || '');
      setCandidateWallet(dbCandidate.wallet_address || '');
    } catch (err) {
      console.error('Payment status check error', err);
    }
  };

  const loadCredentials = async () => {
    try {
      const res = await API.get(`/api/credentials/candidate/${candidate.id}`);
      setCredentials(res.data.credentials || []);
    } catch (err) {
      console.error('Load credentials error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (tier) => {
    try {
      setCheckoutLoading(tier);
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Your session has expired. Please log in again.');
        navigate('/login');
        return;
      }
      const res = await fetch(
        'https://atac-backend-production.up.railway.app/api/stripe/checkout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tier }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      if (data.url) { window.location.href = data.url; return; }
      throw new Error('Stripe checkout URL was not returned');
    } catch (err) {
      alert(err.message || 'Failed to start checkout');
    } finally {
      setCheckoutLoading('');
    }
  };

  const startAssessment = async () => {
    setStartingAssessment(true);
    try {
      const tier = paymentTier || 'standard';
      const res = await API.post('/api/assessment/start', { candidateId: candidate.id, program: 'CRSA', tier });
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
      const res = await fetch(
        `https://atac-backend-production.up.railway.app/api/certificate/${credId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ATAC-Certificate-${credId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Certificate download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
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
    } catch (err) {
      setWalletError('Failed to save wallet. Please try again.');
    } finally {
      setWalletSaving(false);
    }
  };
  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const latestCred = credentials[0];
  const dims = result?.dimensions || {};

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.brand}>ATAC Global CX</div>
        <div style={{ fontSize: 13 }}>{candidate.name}</div>
        <button onClick={logout} style={{ background: 'none', border: '1px solid rgba(245,243,238,0.2)', color: 'rgba(245,243,238,0.6)', borderRadius: 5, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>

      <div style={s.body}>

        {/* ── Payment success banner ── */}
        {paymentSuccess && (
          <div style={{ background: 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.35)', borderRadius: 8, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#26B589', marginBottom: 4 }}>✓ Payment confirmed — you're ready to begin</div>
              <div style={{ fontSize: 12, color: 'rgba(245,243,238,0.6)' }}>Your assessment session is ready. Click below to start your 20-minute timed assessment.</div>
            </div>
            <button style={{ ...s.btnTeal, width: 'auto', padding: '12px 24px', whiteSpace: 'nowrap', marginBottom: 0, opacity: startingAssessment ? 0.7 : 1 }} onClick={startAssessment} disabled={startingAssessment}>
              {startingAssessment ? 'Starting...' : 'Start Assessment →'}
            </button>
          </div>
        )}

        {/* ── Payment cancelled banner ── */}
        {paymentCancelled && (
          <div style={{ background: 'rgba(216,90,48,0.10)', border: '1px solid rgba(216,90,48,0.30)', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#D85A30', marginBottom: 4 }}>Payment was cancelled</div>
            <div style={{ fontSize: 12, color: 'rgba(245,243,238,0.6)' }}>No charge was made. You can restart checkout whenever you're ready.</div>
          </div>
        )}

        {/* ── Assessment ready banner (paid but not started) ── */}
        {!paymentSuccess && paymentVerified && !result && credentials.length === 0 && (
          <div style={{ background: 'rgba(55,138,221,0.1)', border: '1px solid rgba(55,138,221,0.3)', borderRadius: 8, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#378ADD', marginBottom: 4 }}>Your assessment is ready</div>
              <div style={{ fontSize: 12, color: 'rgba(245,243,238,0.6)' }}>Payment verified{paymentTier ? ` · ${paymentTier.toUpperCase()} tier` : ''}. Start your 40-question timed assessment when you're ready.</div>
            </div>
            <button style={{ ...s.btnGold, width: 'auto', padding: '12px 24px', whiteSpace: 'nowrap', marginBottom: 0, opacity: startingAssessment ? 0.7 : 1 }} onClick={startAssessment} disabled={startingAssessment}>
              {startingAssessment ? 'Starting...' : 'Start Assessment →'}
            </button>
          </div>
        )}

        {/* ── Latest assessment result ── */}
        {result && (
          <div style={{ ...s.card, borderColor: result.passed ? 'rgba(29,158,117,0.3)' : 'rgba(226,75,74,0.3)', marginBottom: 20 }}>
            <div style={s.eyebrow}>Latest Assessment Result</div>
            <div style={s.statsRow}>
              <div style={s.statBox}><div style={s.scoreNum}>{result.score}</div><div style={s.scoreLbl}>Score / 40</div></div>
              <div style={s.statBox}><div style={{ ...s.scoreNum, color: result.passed ? '#26B589' : '#E24B4A' }}>{result.percentage}%</div><div style={s.scoreLbl}>Percentage</div></div>
              <div style={s.statBox}><div style={{ ...s.scoreNum, fontSize: 18, paddingTop: 4, color: result.passed ? '#26B589' : '#E24B4A' }}>{result.passed ? 'PASS' : 'FAIL'}</div><div style={s.scoreLbl}>Status</div></div>
              <div style={s.statBox}><div style={s.scoreNum}>28</div><div style={s.scoreLbl}>Pass Mark</div></div>
            </div>
            {Object.keys(dims).length > 0 && (
              <>
                <div style={{ ...s.eyebrow, marginBottom: 10 }}>Performance by Dimension</div>
                {DIM_LABELS.map((label, i) => {
                  const key = Object.keys(dims)[i];
                  const pct = dims[key] || 0;
                  return (
                    <div key={i} style={s.dimRow}>
                      <div style={s.dimName}>{label}</div>
                      <div style={s.dimTrack}>
                        <div style={{ height: 5, width: `${pct}%`, background: DIM_COLORS[i], borderRadius: 3, transition: 'width 0.8s ease' }} />
                      </div>
                      <div style={{ fontSize: 12, color: '#F5F3EE', width: 34, textAlign: 'right' }}>{pct}%</div>
                    </div>
                  );
                })}
              </>
            )}
            {result.passed && credentials.length === 0 && (
              <button style={{ ...s.btnGold, marginTop: 16 }} onClick={() => navigate('/simulator')}>
                Proceed to Call Readiness Simulator™ →
              </button>
            )}
          </div>
        )}

        {/* ── Main grid ── */}
        <div style={s.grid}>

          {/* ── Left: credentials ── */}
          <div>
            <div style={s.card}>
              <div style={s.eyebrow}>My Credentials</div>
              {loading ? (
                <div style={{ color: 'rgba(245,243,238,0.4)', fontSize: 13 }}>Loading...</div>
              ) : credentials.length === 0 ? (
                <div style={s.noCredCard}>
                  <div style={{ fontSize: 14, color: 'rgba(245,243,238,0.5)', marginBottom: 16 }}>No credentials issued yet.</div>
                  {paymentVerified ? (
                    <button style={{ ...s.btnGold, width: 'auto', padding: '12px 24px' }} onClick={startAssessment}>Start Assessment →</button>
                  ) : (
                    <div style={s.payGrid}>
                      <div style={s.payCard}>
                        <div style={s.payTitle}>Standard</div>
                        <div style={s.payPrice}>$39</div>
                        <div style={s.payCopy}>Full assessment access with credential pathway and dashboard unlock.</div>
                        <button style={{ ...s.btnGold, marginBottom: 0 }} onClick={() => handleCheckout('standard')} disabled={!!checkoutLoading}>
                          {checkoutLoading === 'standard' ? 'Redirecting...' : 'Buy Standard'}
                        </button>
                      </div>
                      <div style={s.payCard}>
                        <div style={s.payTitle}>Pro</div>
                        <div style={s.payPrice}>$59</div>
                        <div style={s.payCopy}>Pro tier with higher-value paid path and premium positioning.</div>
                        <button style={{ ...s.btnTeal, marginBottom: 0 }} onClick={() => handleCheckout('pro')} disabled={!!checkoutLoading}>
                          {checkoutLoading === 'pro' ? 'Redirecting...' : 'Buy Pro'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                credentials.map((cred, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,243,238,0.08)', borderRadius: 7, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 12, color: '#26B589' }}>✓</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{cred.program}</div>
                      <div style={{ fontSize: 10, color: 'rgba(245,243,238,0.5)', marginTop: 1 }}>{cred.credentialId} · Issued {new Date(cred.issuedAt).toLocaleDateString()}</div>
                    </div>
                    <div style={{ fontSize: 10, color: '#26B589', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 10, padding: '2px 8px' }}>Valid</div>
                  </div>
                ))
              )}
            </div>

            {/* ── Get started card (no payment yet) ── */}
            {!result && credentials.length === 0 && !paymentVerified && (
              <div style={s.card}>
                <div style={s.eyebrow}>Get Started</div>
                <div style={{ fontSize: 14, color: 'rgba(245,243,238,0.6)', marginBottom: 16, lineHeight: 1.6 }}>
                  Choose your assessment tier to unlock the Remote CX Readiness Assessment™ and begin your certification path.
                </div>
                <div style={s.payGrid}>
                  <div style={s.payCard}>
                    <div style={s.payTitle}>Standard</div>
                    <div style={s.payPrice}>$39</div>
                    <div style={s.payCopy}>Core assessment access for candidates ready to prove their remote CX readiness.</div>
                    <button style={{ ...s.btnGold, marginBottom: 0 }} onClick={() => handleCheckout('standard')} disabled={!!checkoutLoading}>
                      {checkoutLoading === 'standard' ? 'Redirecting...' : 'Buy Standard'}
                    </button>
                  </div>
                  <div style={s.payCard}>
                    <div style={s.payTitle}>Pro</div>
                    <div style={s.payPrice}>$59</div>
                    <div style={s.payCopy}>Premium candidate path with stronger positioning and higher-value access.</div>
                    <button style={{ ...s.btnTeal, marginBottom: 0 }} onClick={() => handleCheckout('pro')} disabled={!!checkoutLoading}>
                      {checkoutLoading === 'pro' ? 'Redirecting...' : 'Buy Pro'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Start assessment card (paid, no result yet) ── */}
            {!result && credentials.length === 0 && paymentVerified && (
              <div style={s.card}>
                <div style={s.eyebrow}>Get Started</div>
                <div style={{ fontSize: 14, color: 'rgba(245,243,238,0.6)', marginBottom: 16, lineHeight: 1.6 }}>
                  Your payment is verified. Launch the Remote CX Readiness Assessment™ when you're ready.
                </div>
                <button style={s.btnGold} onClick={startAssessment}>{startingAssessment ? 'Starting...' : 'Start Assessment — CRSA'}</button>
              </div>
            )}
          </div>

          {/* ── Right: certificate panel ── */}
          <div>
            {latestCred ? (
              <>
                <div style={s.eyebrow}>Your Certificate</div>
                <div style={s.credCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e0d5b0', paddingBottom: 12, marginBottom: 14 }}>
                    <div>
                      <div style={s.credOrg}>ATAC Global CX · Verified Credentials</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#3d2e0a' }}>Certificate of Achievement</div>
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0D1B2E', border: '2px solid #D4A843', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>★</div>
                  </div>
                  <div style={s.credTitle}>Certificate of Achievement</div>
                  <div style={{ fontSize: 11, color: '#8a7040', textAlign: 'center', marginBottom: 4 }}>Proudly Presented To</div>
                  <div style={s.credName}>{candidate.name}</div>
                  <div style={s.credDesig}>{latestCred.program === 'CRSA' ? 'Certified Remote Service Agent (CRSA)' : latestCred.program}</div>
                  <div style={s.metaGrid}>
                    <div><div style={s.metaKey}>Credential ID</div><div style={s.metaVal}>{latestCred.credentialId}</div></div>
                    <div><div style={s.metaKey}>Issue Date</div><div style={s.metaVal}>{new Date(latestCred.issuedAt).toLocaleDateString()}</div></div>
                    <div><div style={s.metaKey}>Status</div><div style={{ ...s.metaVal, color: '#0F6E56' }}>Valid</div></div>
                    <div><div style={s.metaKey}>Expires</div><div style={s.metaVal}>{new Date(latestCred.expiresAt).toLocaleDateString()}</div></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #e0d5b0', paddingTop: 10 }}>
                    <div style={{ fontSize: 9, color: '#8a7040' }}>Verify at<br /><strong style={{ fontSize: 10, color: '#3d2e0a' }}>atacglobalcx.com/verify</strong></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ width: 60, height: 1, background: '#8a7040', marginBottom: 3, marginLeft: 'auto' }} />
                      <div style={{ fontSize: 9, fontWeight: 600, color: '#3d2e0a' }}>Tugreofia Smith</div>
                      <div style={{ fontSize: 8, color: '#8a7040' }}>CEO & Lead Instructor</div>
                    </div>
                  </div>
                  <div style={s.chainRow}>
                    <div style={s.chainDot} />
                    ERC-721 Blockchain Credential · Polygon Mainnet
                  </div>
                </div>

                {/* ── Action buttons ── */}
                <div style={{ marginTop: 12 }}>
                  <button style={s.btnGold} onClick={() => downloadCertificate(latestCred.credentialId)} disabled={downloading}>
                    {downloading ? 'Generating PDF...' : '⬇ Download PDF Certificate'}
                  </button>
                  <button style={s.btnGold} onClick={() => copyLink(latestCred.credentialId)}>
                    {copied ? '✓ Copied!' : 'Copy Verification Link'}
                  </button>
                  <button style={s.btnTeal} onClick={() => {
                    const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=Certified+Remote+Service+Agent+(CRSA)&organizationId=ATAC&certUrl=https://atacglobalcx.com/verify/${latestCred.credentialId}&certId=${latestCred.credentialId}`;
                    window.open(url, '_blank');
                  }}>
                    Add to LinkedIn Profile
                  </button>

                    <button style={s.btnOut} onClick={() => navigate('/assessment')}>
                    Start New Assessment
                  </button>
                </div>

                {/* ── Wallet prompt ── */}
                {!candidateWallet ? (
                  <div style={{ marginTop: 12, background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, color: '#D4A843', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Enable Blockchain Verification</div>
                    <div style={{ fontSize: 12, color: 'rgba(245,243,238,0.5)', marginBottom: 10, lineHeight: 1.5 }}>Add your wallet address to mint your credential as an ERC-721 token on the blockchain.</div>
                    <input
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${walletError ? 'rgba(226,75,74,0.5)' : 'rgba(245,243,238,0.1)'}`, borderRadius: 6, padding: '9px 12px', fontSize: 12, color: '#F5F3EE', outline: 'none', boxSizing: 'border-box', marginBottom: 8, fontFamily: 'DM Sans, sans-serif' }}
                      placeholder="0x... your EVM wallet address"
                      value={walletInput}
                      onChange={e => { setWalletInput(e.target.value); setWalletError(''); }}
                    />
                    {walletError && <div style={{ fontSize: 11, color: '#E24B4A', marginBottom: 8 }}>{walletError}</div>}
                    <button
                      style={{ ...s.btnGold, marginBottom: 0, opacity: walletSaving ? 0.7 : 1 }}
                      onClick={saveWallet}
                      disabled={walletSaving || !walletInput}
                    >
                      {walletSaving ? 'Saving...' : 'Save Wallet Address'}
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, background: 'rgba(29,158,117,0.06)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 8, padding: '12px 16px' }}>
                    {walletSaved && <div style={{ fontSize: 12, color: '#26B589', marginBottom: 4 }}>✓ Wallet saved — blockchain minting enabled</div>}
                    <div style={{ fontSize: 10, color: 'rgba(245,243,238,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Blockchain Wallet</div>
                    <div style={{ fontSize: 11, color: 'rgba(245,243,238,0.6)', wordBreak: 'break-all' }}>{candidateWallet}</div>
                  </div>
                )}
              </>
            ) : (
              <div style={s.card}>
                <div style={s.eyebrow}>Your Certificate</div>
                <div style={{ fontSize: 13, color: 'rgba(245,243,238,0.4)', textAlign: 'center', padding: '30px 0' }}>
                  Complete your assessment to earn your certificate.
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}