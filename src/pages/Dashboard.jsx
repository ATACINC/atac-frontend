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

  useEffect(() => {
    if (candidate.id) loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const res = await API.get(`/api/credentials/candidate/${candidate.id}`);
      setCredentials(res.data.credentials || []);
    } catch (err) { console.error('Load credentials error', err); }
    finally { setLoading(false); }
  };

  const copyLink = (credId) => {
    navigator.clipboard.writeText(`https://atacglobalcx.com/verify/${credId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const latestCred = credentials[0];
  const dims = result?.dimensions || {};

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.brand}>ATAC Global CX</div>
        <div style={{ fontSize: 13 }}>{candidate.name}</div>
        <button onClick={logout} style={{ background: 'none', border: '1px solid rgba(245,243,238,0.2)', color: 'rgba(245,243,238,0.6)', borderRadius: 5, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>Sign Out</button>
      </div>
      <div style={s.body}>
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
                      <div style={s.dimTrack}><div style={{ height: 5, width: pct + '%', background: DIM_COLORS[i], borderRadius: 3, transition: 'width 0.8s ease' }}></div></div>
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

        <div style={s.grid}>
          <div>
            <div style={s.card}>
              <div style={s.eyebrow}>My Credentials</div>
              {loading ? (
                <div style={{ color: 'rgba(245,243,238,0.4)', fontSize: 13 }}>Loading...</div>
              ) : credentials.length === 0 ? (
                <div style={s.noCredCard}>
                  <div style={{ fontSize: 14, color: 'rgba(245,243,238,0.5)', marginBottom: 16 }}>No credentials issued yet.</div>
                  <button style={{ ...s.btnGold, width: 'auto', padding: '12px 24px' }} onClick={() => navigate('/assessment')}>
                    Start Assessment →
                  </button>
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
            {!result && credentials.length === 0 && (
              <div style={s.card}>
                <div style={s.eyebrow}>Get Started</div>
                <div style={{ fontSize: 14, color: 'rgba(245,243,238,0.6)', marginBottom: 16, lineHeight: 1.6 }}>
                  Complete the Remote CX Readiness Assessment™ to earn your blockchain-verified professional credential.
                </div>
                <button style={s.btnGold} onClick={() => navigate('/assessment')}>Start Assessment — CRSA</button>
              </div>
            )}
          </div>

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
                      <div style={{ width: 60, height: 1, background: '#8a7040', marginBottom: 3, marginLeft: 'auto' }}></div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: '#3d2e0a' }}>Tugreofia Smith</div>
                      <div style={{ fontSize: 8, color: '#8a7040' }}>CEO & Lead Instructor</div>
                    </div>
                  </div>
                  <div style={s.chainRow}><div style={s.chainDot}></div>ERC-721 Blockchain Credential · Polygon Mainnet</div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button style={s.btnGold} onClick={() => copyLink(latestCred.credentialId)}>
                    {copied ? '✓ Copied!' : 'Copy Verification Link'}
                  </button>
                  <button style={s.btnTeal} onClick={() => {
                    const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=Certified+Remote+Service+Agent+(CRSA)&organizationId=ATAC&certUrl=https://atacglobalcx.com/verify/${latestCred.credentialId}&certId=${latestCred.credentialId}`;
                    window.open(url, '_blank');
                  }}>Add to LinkedIn Profile</button>
                  <button style={s.btnOut} onClick={() => navigate('/assessment')}>Start New Assessment</button>
                </div>
              </>
            ) : (
              <div style={s.card}>
                <div style={s.eyebrow}>Your Certificate</div>
                <div style={{ fontSize: 13, color: 'rgba(245,243,238,0.4)', textAlign: 'center', padding: '30px 0' }}>Complete your assessment to earn your certificate.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}