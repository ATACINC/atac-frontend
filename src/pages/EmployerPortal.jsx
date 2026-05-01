import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/client';
import { isValidEmail } from '../utils/validation';

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

const DIM_COLORS = ['#C9A84C','#5BA8D4','#5DCAA5','#D45C9A','#8A7DD4','#22A67E'];
const DIM_KEYS   = ['professionalism','communication','cx_operations','technology','compliance_safety','remote_setup'];
const DIM_LABELS = ['Prof','Comm','Ops','Tech','C&S','Remote'];

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

// Apply normalizeDims to every candidate's dimensions object in a list (for setCandidates).
function normalizeCandidates(list) {
  return (list || []).map(c => ({
    ...c,
    dimensions: c.dimensions ? normalizeDims(c.dimensions) : c.dimensions,
  }));
}

/* ── Keyframe injection ─────────────────────────────────── */
const injectKF = () => {
  if (document.getElementById('vault-ep-kf')) return;
  const s = document.createElement('style');
  s.id = 'vault-ep-kf';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Syne:wght@400;500;600&display=swap');
    @keyframes vault-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    .vault-up { animation: vault-up 0.45s ease both; }
    .row-hover:hover { background: rgba(201,168,76,0.03) !important; }
    .nav-item:hover { color: ${WHITE} !important; }
    .btn-hover:hover { background: rgba(201,168,76,0.12) !important; color: ${GOLD} !important; }
    ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.15); }
  `;
  document.head.appendChild(s);
};

export default function EmployerPortal() {
  const navigate = useNavigate();
  const [employerId, setEmployerId]     = useState(null);
  const [metrics, setMetrics]           = useState(null);
  const [candidates, setCandidates]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState('all');
  const [search, setSearch]             = useState('');
  const [activeNav, setActiveNav]       = useState('candidates');
  const [showInvite, setShowInvite]     = useState(false);
  const [inviteEmail, setInviteEmail]   = useState('');
  const [inviteMsg, setInviteMsg]       = useState('');
  const [verifying, setVerifying]       = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyInput, setVerifyInput]   = useState('');

  useEffect(() => { injectKF(); init(); }, []);

  const init = async () => {
    try {
      const me = await API.get('/api/auth/me');
      const email = me.data.candidate?.email || me.data.email;
      const empRes = await API.get(`/api/employer/by-email/${encodeURIComponent(email)}`);
      const emp = empRes.data.employer;
      setEmployerId(emp.id);
      const [mRes, cRes] = await Promise.all([
        API.get(`/api/employer/${emp.id}/metrics`),
        API.get(`/api/employer/${emp.id}/candidates`),
      ]);
      setMetrics(mRes.data);
      setCandidates(normalizeCandidates(cRes.data.candidates || []));
    } catch (err) {
      if (err.response?.status === 404) {
        alert('No employer account found. Contact support to set up your team account.');
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCandidates = async (f, s) => {
    if (!employerId) return;
    try {
      const params = new URLSearchParams();
      if (f && f !== 'all') params.set('filter', f);
      if (s) params.set('search', s);
      const res = await API.get(`/api/employer/${employerId}/candidates?${params}`);
      setCandidates(normalizeCandidates(res.data.candidates || []));
    } catch (err) { console.error(err); }
  };

  const handleFilter = (f) => { setFilter(f); loadCandidates(f, search); };
  const handleSearch = (val) => { setSearch(val); loadCandidates(filter, val); };

  const handleExport = () => {
    window.open(`https://atac-backend-production.up.railway.app/api/employer/${employerId}/export/csv`, '_blank');
  };

  const handleInvite = async () => {
    if (!isValidEmail(inviteEmail)) {
      setInviteMsg('Please enter a valid email address.');
      return;
    }
    try {
      const res = await API.post(`/api/employer/${employerId}/invite`, { candidateEmail: inviteEmail });
      setInviteMsg(res.data.message || 'Candidate invited successfully.');
      setInviteEmail('');
      setTimeout(() => { setShowInvite(false); setInviteMsg(''); init(); }, 2000);
    } catch (err) {
      setInviteMsg(err.response?.data?.error || 'Failed to invite candidate.');
    }
  };

  const handleVerify = async (credId) => {
    setVerifying(credId);
    setVerifyResult(null);
    try {
      const res = await API.get(`/api/credentials/verify/${credId}`);
      setVerifyResult(res.data);
    } catch {
      setVerifyResult({ error: 'Verification failed' });
    } finally {
      setVerifying(null);
    }
  };

  const handleVerifyManual = async () => {
    if (!verifyInput.trim()) return;
    await handleVerify(verifyInput.trim());
  };

  const logout = () => { localStorage.clear(); navigate('/login'); };

  const filteredCandidates = candidates.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.credentialId || '').toLowerCase().includes(search.toLowerCase())
  );

  const seatsUsed  = metrics?.seatsUsed || 0;
  const seatsPurch = metrics?.seatsPurchased || 10;
  const seatsPct   = Math.min(100, (seatsUsed / seatsPurch) * 100);

  /* ── Loading ── */
  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: VAULT_BODY }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, color: GOLD, letterSpacing: '0.15em' }}>ATAC Global CX</div>
        <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 6 }}>Loading Portal…</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: VAULT_BODY, color: WHITE }}>

      {/* ── Topbar ── */}
      <div style={{ background: BG3, borderBottom: `1px solid ${BORDER2}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <img src="/logo.png" alt="ATAC Global CX" style={{ height: 96, objectFit: 'contain' }} />
          <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 1 }}>Employer & BPO Portal</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 10, background: 'rgba(201,168,76,0.08)', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '3px 10px', color: GOLD, letterSpacing: '0.1em' }}>
            TEAM PLAN
          </div>
          <div style={{ fontSize: 13, color: WHITE }}>{metrics?.companyName || 'Employer'}</div>
          <button onClick={logout} style={{ background: 'none', border: `1px solid ${BORDER2}`, color: MUTED, borderRadius: 2, padding: '5px 12px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em' }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', minHeight: 'calc(100vh - 50px)' }}>

        {/* ── Sidebar ── */}
        <div style={{ background: BG3, borderRight: `1px solid ${BORDER2}`, display: 'flex', flexDirection: 'column' }}>

          <div style={{ padding: '18px 0 6px' }}>
            <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '0 18px', marginBottom: 8 }}>Management</div>

            {[
              { id: 'candidates', label: 'Candidates' },
              { id: 'verify',     label: 'Verify Credential' },
              { id: 'invite',     label: 'Invite Candidate' },
            ].map(item => {
              const active = activeNav === item.id;
              return (
                <div key={item.id}
                  className="nav-item"
                  onClick={() => { setActiveNav(item.id); if (item.id === 'invite') setShowInvite(true); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 18px', fontSize: 12,
                    color: active ? GOLD : MUTED,
                    cursor: 'pointer',
                    borderLeft: `2px solid ${active ? GOLD : 'transparent'}`,
                    background: active ? 'rgba(201,168,76,0.06)' : 'transparent',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: active ? GOLD : 'transparent', border: `1px solid ${active ? GOLD : MUTED}`, flexShrink: 0 }} />
                  {item.label}
                </div>
              );
            })}
          </div>

          {/* Inline Verify panel if nav = verify */}
          {activeNav === 'verify' && (
            <div style={{ margin: '12px 14px', background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '14px' }}>
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Quick Verify</div>
              <input
                type="text"
                placeholder="ATAC-C-2026-00001"
                value={verifyInput}
                onChange={e => setVerifyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerifyManual()}
                style={{ width: '100%', background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '8px 10px', fontSize: 11, color: WHITE, fontFamily: VAULT_BODY, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
              />
              <button onClick={handleVerifyManual} style={{ width: '100%', background: GOLD, color: BG, border: 'none', borderRadius: 2, padding: '8px', fontSize: 10, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Verify
              </button>
            </div>
          )}

          {/* Seats widget — pinned to bottom */}
          <div style={{ marginTop: 'auto', padding: '16px 14px' }}>
            <div style={{ background: 'rgba(26,143,105,0.08)', border: '1px solid rgba(26,143,105,0.18)', borderRadius: 3, padding: '14px' }}>
              <div style={{ fontSize: 9, color: TEAL2, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>Seat Allocation</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{ fontFamily: VAULT_DISPLAY, fontSize: 26, color: WHITE, fontWeight: 300 }}>{seatsUsed}</span>
                <span style={{ fontSize: 12, color: MUTED }}>/ {seatsPurch}</span>
              </div>
              <div style={{ height: 3, background: BORDER2, borderRadius: 2, marginBottom: 6 }}>
                <div style={{ height: 3, width: `${seatsPct}%`, background: TEAL, borderRadius: 2, transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: 10, color: MUTED }}>{metrics?.seatsRemaining || 0} seats remaining</div>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ background: BG, padding: '24px 28px', overflowY: 'auto' }}>

          {/* Metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 24 }} className="vault-up">
            {[
              { num: metrics?.total   || 0, lbl: 'Total Candidates', color: GOLD },
              { num: metrics?.passed  || 0, lbl: 'Passed',           color: TEAL2 },
              { num: metrics?.failed  || 0, lbl: 'Failed',           color: RED },
              { num: metrics?.pending || 0, lbl: 'Pending',          color: AMBER },
              { num: `${metrics?.avgScore || 0}%`, lbl: 'Avg Score', color: GOLD },
            ].map((m, i) => (
              <div key={i} style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '14px 16px', animationDelay: `${i * 50}ms` }} className="vault-up">
                <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, color: m.color, fontWeight: 300, lineHeight: 1 }}>{m.num}</div>
                <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 4 }}>{m.lbl}</div>
              </div>
            ))}
          </div>

          {/* Verify result banner */}
          {verifyResult && (
            <div style={{
              background: verifyResult.valid ? 'rgba(26,143,105,0.07)' : 'rgba(196,92,92,0.07)',
              border: `1px solid ${verifyResult.valid ? 'rgba(26,143,105,0.25)' : 'rgba(196,92,92,0.25)'}`,
              borderRadius: 3, padding: '12px 18px', marginBottom: 20,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, color: verifyResult.valid ? TEAL2 : RED, marginBottom: 3, fontFamily: VAULT_DISPLAY, fontWeight: 500 }}>
                  {verifyResult.valid ? '✓  Credential Verified — Valid' : '✗  Credential Invalid or Not Found'}
                </div>
                {verifyResult.valid && (
                  <div style={{ fontSize: 11, color: MUTED }}>
                    {verifyResult.candidateName} · {verifyResult.program} · Score: {verifyResult.score}%
                    · Issued: {new Date(verifyResult.issuedAt).toLocaleDateString()}
                    · Expires: {new Date(verifyResult.expiresAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button onClick={() => setVerifyResult(null)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
          )}

          {/* Page header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 22, color: WHITE, fontWeight: 300 }}>Candidate Roster</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{filteredCandidates.length} candidates · Ranked by score</div>
            </div>
            <button onClick={handleExport} style={{
              background: GOLD, color: BG, border: 'none', borderRadius: 2, padding: '9px 18px',
              fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
            }}>
              Export CSV
            </button>
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '8px 12px', flex: 1, minWidth: 200 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="5" cy="5" r="3.5" stroke={MUTED} strokeWidth="1.2" />
                <line x1="7.5" y1="7.5" x2="11" y2="11" stroke={MUTED} strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <input
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: WHITE, fontFamily: VAULT_BODY, width: '100%' }}
                placeholder="Search by name, email, credential ID…"
                value={search}
                onChange={e => handleSearch(e.target.value)}
              />
            </div>
            {['all','pass','fail','pending'].map(f => {
              const active = filter === f;
              return (
                <button key={f} onClick={() => handleFilter(f)} style={{
                  background: active ? 'rgba(201,168,76,0.1)' : FAINT,
                  border: `1px solid ${active ? BORDER : BORDER2}`,
                  borderRadius: 2, padding: '8px 14px', fontSize: 11,
                  color: active ? GOLD : MUTED, cursor: 'pointer',
                  letterSpacing: '0.08em', textTransform: 'capitalize',
                  transition: 'all 0.15s',
                }}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(238,233,223,0.03)' }}>
                  {['Candidate', 'Score', 'Status', 'Dimensions', 'Credential', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: MUTED, fontWeight: 500, textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', fontSize: 13, color: MUTED }}>
                      No candidates found.
                    </td>
                  </tr>
                ) : filteredCandidates.map((c) => (
                  <tr key={c.id} className="row-hover" style={{ borderTop: `1px solid ${BORDER2}`, transition: 'background 0.12s' }}>
                    {/* Candidate */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(201,168,76,0.12)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: GOLD, flexShrink: 0, fontFamily: VAULT_DISPLAY }}>
                          {c.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: WHITE }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: MUTED }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Score */}
                    <td style={{ padding: '12px 16px' }}>
                      {c.score != null ? (
                        <span style={{
                          fontFamily: VAULT_DISPLAY, fontSize: 16, fontWeight: 400,
                          color: c.score >= 70 ? TEAL2 : c.score >= 50 ? AMBER : RED,
                        }}>
                          {c.score}%
                        </span>
                      ) : <span style={{ color: MUTED, fontSize: 12 }}>—</span>}
                    </td>
                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      {(() => {
                        const map = {
                          pass:    { bg: 'rgba(26,143,105,0.1)',  border: 'rgba(26,143,105,0.25)',  color: TEAL2 },
                          fail:    { bg: 'rgba(196,92,92,0.1)',   border: 'rgba(196,92,92,0.25)',   color: RED   },
                          pending: { bg: 'rgba(196,138,42,0.1)',  border: 'rgba(196,138,42,0.25)',  color: AMBER },
                        };
                        const st = map[c.status] || map.pending;
                        return (
                          <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 1, background: st.bg, border: `1px solid ${st.border}`, color: st.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            {c.status === 'pass' ? 'Passed' : c.status === 'fail' ? 'Failed' : 'Pending'}
                          </span>
                        );
                      })()}
                    </td>
                    {/* Dimension mini-bars */}
                    <td style={{ padding: '12px 16px' }}>
                      {c.dimensions ? (
                        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                          {DIM_KEYS.map((key, ki) => {
                            const pct = c.dimensions[key] || 0;
                            return (
                              <div key={key} title={`${DIM_LABELS[ki]}: ${pct}%`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <div style={{ width: 6, height: Math.max(4, (pct / 100) * 20), background: DIM_COLORS[ki], borderRadius: 1, opacity: 0.7 + (pct / 100) * 0.3 }} />
                              </div>
                            );
                          })}
                        </div>
                      ) : <span style={{ color: MUTED, fontSize: 12 }}>—</span>}
                    </td>
                    {/* Credential */}
                    <td style={{ padding: '12px 16px' }}>
                      {c.credentialId ? (
                        <div>
                          <div style={{ fontSize: 11, color: WHITE, fontFamily: 'monospace' }}>{c.credentialId}</div>
                          <div style={{ fontSize: 10, marginTop: 2, color: c.onChain ? TEAL2 : MUTED }}>
                            {c.onChain ? '⬡ On-chain' : '○ Pending'}
                          </div>
                        </div>
                      ) : <span style={{ fontSize: 11, color: MUTED }}>Not issued</span>}
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.credentialId && (
                          <button
                            className="btn-hover"
                            onClick={() => handleVerify(c.credentialId)}
                            disabled={verifying === c.credentialId}
                            style={{ background: 'rgba(26,143,105,0.08)', border: '1px solid rgba(26,143,105,0.22)', borderRadius: 2, padding: '5px 10px', cursor: 'pointer', fontSize: 10, color: TEAL2, transition: 'all 0.15s', letterSpacing: '0.06em' }}>
                            {verifying === c.credentialId ? '…' : 'Verify'}
                          </button>
                        )}
                        {c.credentialId && (
                          <button
                            className="btn-hover"
                            onClick={() => window.open(`https://atacglobalcx.com/verify/${c.credentialId}`, '_blank')}
                            style={{ background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '5px 10px', cursor: 'pointer', fontSize: 10, color: MUTED, transition: 'all 0.15s' }}>
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* ── Invite Modal ── */}
      {showInvite && (
        <div onClick={() => setShowInvite(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '32px', width: 420 }} className="vault-up">
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 22, color: WHITE, fontWeight: 300, marginBottom: 6 }}>Invite Candidate</div>
            <div style={{ width: 32, height: 1, background: GOLD, opacity: 0.3, marginBottom: 20 }} />
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 20, lineHeight: 1.7 }}>
              Enter the candidate's email address to link them to your team account.
            </div>
            <input
              type="email"
              placeholder="candidate@email.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              style={{ width: '100%', background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '11px 14px', fontSize: 13, color: WHITE, fontFamily: VAULT_BODY, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }}
            />
            {inviteMsg && (
              <div style={{ fontSize: 12, color: inviteMsg.includes('success') || inviteMsg.includes('invited') ? TEAL2 : AMBER, marginBottom: 14 }}>
                {inviteMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleInvite} disabled={!inviteEmail} style={{ background: GOLD, color: BG, border: 'none', borderRadius: 2, padding: '11px 22px', fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: inviteEmail ? 1 : 0.5 }}>
                Send Invite
              </button>
              <button onClick={() => { setShowInvite(false); setInviteMsg(''); }} style={{ background: 'transparent', color: WHITE, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '10px 22px', fontSize: 11, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

