import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/client';

const NAVY   = '#0D1B2E';
const NAVY2  = '#122238';
const GOLD   = '#D4A843';
const TEAL   = '#1D9E75';
const TEAL2  = '#26B589';
const RED    = '#E24B4A';
const AMBER  = '#EF9F27';
const WHITE  = '#F5F3EE';
const MUTED  = 'rgba(245,243,238,0.5)';
const FAINT  = 'rgba(245,243,238,0.06)';
const BORDER = 'rgba(212,168,67,0.15)';
const BORDER2= 'rgba(245,243,238,0.08)';

const DIM_COLORS = ['#5DCAA5','#378ADD','#D4A843','#D4537E','#7F77DD','#26B589'];
const DIM_KEYS   = ['professionalism','communication','cx_operations','technology','health_safety','remote_work'];

const s = {
  page:    { minHeight: '100vh', background: '#0a1625', fontFamily: 'DM Sans, sans-serif', color: WHITE },
  topbar:  { background: NAVY2, borderBottom: `1px solid ${BORDER}`, padding: '11px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brand:   { fontFamily: 'Georgia, serif', fontSize: 14, color: GOLD, letterSpacing: '0.06em' },
  brandSub:{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 },
  layout:  { display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: 'calc(100vh - 48px)' },
  sidebar: { background: NAVY2, borderRight: `1px solid ${BORDER2}`, padding: '16px 0', display: 'flex', flexDirection: 'column' },
  navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 12, color: active ? GOLD : MUTED, cursor: 'pointer', borderLeft: `2px solid ${active ? GOLD : 'transparent'}`, background: active ? 'rgba(212,168,67,0.08)' : 'transparent', transition: 'all 0.18s' }),
  main:    { padding: '20px 24px', background: NAVY },
  metricRow:    { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 },
  metricCard:   { background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 8, padding: '12px 14px' },
  metricNum:    { fontFamily: 'Georgia, serif', fontSize: 22, color: GOLD, lineHeight: 1 },
  metricLbl:    { fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 },
  toolbar:      { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  searchBox:    { display: 'flex', alignItems: 'center', gap: 6, background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 6, padding: '7px 12px', flex: 1, minWidth: 180 },
  searchInput:  { background: 'none', border: 'none', outline: 'none', fontSize: 12, color: WHITE, fontFamily: 'DM Sans, sans-serif', width: '100%' },
  filterBtn:    (active) => ({ background: FAINT, border: `1px solid ${active ? GOLD : BORDER2}`, borderRadius: 6, padding: '7px 12px', fontSize: 11, color: active ? GOLD : MUTED, cursor: 'pointer', whiteSpace: 'nowrap' }),
  exportBtn:    { background: GOLD, color: NAVY, border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer' },
  tableWrap:    { background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 8, overflow: 'hidden' },
  th:           { padding: '10px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: MUTED, fontWeight: 500, textAlign: 'left', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.04)' },
  td:           { padding: '11px 14px', fontSize: 12, color: WHITE, borderBottom: `1px solid rgba(245,243,238,0.04)` },
  badge: (type) => {
    const map = { pass: { bg: 'rgba(29,158,117,0.1)', border: 'rgba(29,158,117,0.2)', color: TEAL2 }, fail: { bg: 'rgba(226,75,74,0.1)', border: 'rgba(226,75,74,0.2)', color: RED }, pending: { bg: 'rgba(239,159,39,0.1)', border: 'rgba(239,159,39,0.2)', color: AMBER } };
    const c = map[type] || map.pending;
    return { fontSize: 10, padding: '2px 8px', borderRadius: 10, display: 'inline-block', background: c.bg, border: `1px solid ${c.border}`, color: c.color };
  },
  verifyBtn:    { background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 5, padding: '5px 10px', cursor: 'pointer', fontSize: 10, color: TEAL2, display: 'inline-block' },
  seatsWidget:  { background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 7, padding: '10px 12px', margin: '16px' },
  inviteModal:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard:    { background: NAVY2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '28px 28px', width: 400 },
  input:        { width: '100%', background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 6, padding: '9px 12px', fontSize: 13, color: WHITE, fontFamily: 'DM Sans, sans-serif', outline: 'none', marginBottom: 12 },
  btnGold:      { background: GOLD, color: NAVY, border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' },
  btnOut:       { background: 'transparent', color: WHITE, border: `1px solid ${BORDER2}`, borderRadius: 6, padding: '9px 20px', fontSize: 12, cursor: 'pointer', marginLeft: 8 },
};

export default function EmployerPortal() {
  const navigate = useNavigate();
  const [employerId, setEmployerId]   = useState(null);
  const [metrics, setMetrics]         = useState(null);
  const [candidates, setCandidates]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('all');
  const [search, setSearch]           = useState('');
  const [activeNav, setActiveNav]     = useState('candidates');
  const [showInvite, setShowInvite]   = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg]     = useState('');
  const [verifying, setVerifying]     = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const me = await API.get('/api/auth/me');
      const email = me.data.candidate?.email || me.data.email;

      // Look up employer by email
      const empRes = await API.get(`/api/employer/by-email/${encodeURIComponent(email)}`);
      const emp = empRes.data.employer;
      setEmployerId(emp.id);

      // Load metrics + candidates in parallel
      const [mRes, cRes] = await Promise.all([
        API.get(`/api/employer/${emp.id}/metrics`),
        API.get(`/api/employer/${emp.id}/candidates`),
      ]);
      setMetrics(mRes.data);
      setCandidates(cRes.data.candidates || []);
    } catch (err) {
      // Not an employer — redirect to dashboard
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
      setCandidates(res.data.candidates || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFilter = (f) => {
    setFilter(f);
    loadCandidates(f, search);
  };

  const handleSearch = (val) => {
    setSearch(val);
    loadCandidates(filter, val);
  };

  const handleExport = () => {
    const token = localStorage.getItem('atac_token') || localStorage.getItem('token');
    window.open(
      `https://atac-backend-production.up.railway.app/api/employer/${employerId}/export/csv`,
      '_blank'
    );
  };

  const handleInvite = async () => {
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
    } catch (err) {
      setVerifyResult({ error: 'Verification failed' });
    } finally {
      setVerifying(null);
    }
  };

  const logout = () => { localStorage.clear(); navigate('/login'); };

  const filteredCandidates = candidates.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.credentialId || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: MUTED, fontSize: 14 }}>Loading employer portal...</div>
    </div>
  );

  return (
    <div style={s.page}>

      {/* ── Top bar ── */}
      <div style={s.topbar}>
        <div>
          <div style={s.brand}>ATAC Global CX</div>
          <div style={s.brandSub}>Employer & BPO Portal</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 11, background: 'rgba(212,168,67,0.1)', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '2px 8px', color: GOLD }}>TEAM PLAN</div>
          <div style={{ fontSize: 13, color: WHITE }}>{metrics?.companyName || 'Employer'}</div>
          <button onClick={logout} style={{ background: 'none', border: `1px solid ${BORDER2}`, color: MUTED, borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Sign Out</button>
        </div>
      </div>

      <div style={s.layout}>

        {/* ── Sidebar ── */}
        <div style={s.sidebar}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: MUTED, padding: '0 16px', marginBottom: 6, marginTop: 10 }}>Management</div>
          {[
            { id: 'candidates', label: 'Candidates' },
            { id: 'verify',     label: 'Verify Credential' },
            { id: 'invite',     label: 'Invite Candidate' },
          ].map(item => (
            <div key={item.id} style={s.navItem(activeNav === item.id)} onClick={() => { setActiveNav(item.id); if (item.id === 'invite') setShowInvite(true); }}>
              {item.label}
            </div>
          ))}

          {/* Seats widget */}
          <div style={{ marginTop: 'auto' }}>
            <div style={s.seatsWidget}>
              <div style={{ fontSize: 10, color: TEAL2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Seats</div>
              <div>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: WHITE }}>{metrics?.seatsUsed || 0}</span>
                <span style={{ fontSize: 12, color: MUTED }}> / {metrics?.seatsPurchased || 10}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 7 }}>
                <div style={{ height: 4, width: `${Math.min(100, ((metrics?.seatsUsed || 0) / (metrics?.seatsPurchased || 10)) * 100)}%`, background: TEAL, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 5 }}>{metrics?.seatsRemaining || 0} remaining</div>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={s.main}>

          {/* Metrics row */}
          <div style={s.metricRow}>
            {[
              { num: metrics?.total    || 0, lbl: 'Total Candidates' },
              { num: metrics?.passed   || 0, lbl: 'Passed', color: TEAL2 },
              { num: metrics?.failed   || 0, lbl: 'Failed', color: RED },
              { num: metrics?.pending  || 0, lbl: 'Pending', color: AMBER },
              { num: `${metrics?.avgScore || 0}%`, lbl: 'Avg Score' },
            ].map((m, i) => (
              <div key={i} style={s.metricCard}>
                <div style={{ ...s.metricNum, color: m.color || GOLD }}>{m.num}</div>
                <div style={s.metricLbl}>{m.lbl}</div>
              </div>
            ))}
          </div>

          {/* Verify result banner */}
          {verifyResult && (
            <div style={{ background: verifyResult.valid ? 'rgba(29,158,117,0.1)' : 'rgba(226,75,74,0.1)', border: `1px solid ${verifyResult.valid ? 'rgba(29,158,117,0.3)' : 'rgba(226,75,74,0.3)'}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: verifyResult.valid ? TEAL2 : RED, marginBottom: 2 }}>
                  {verifyResult.valid ? '✓ Credential Verified — Valid' : '✗ Credential Invalid or Not Found'}
                </div>
                {verifyResult.valid && (
                  <div style={{ fontSize: 11, color: MUTED }}>
                    {verifyResult.candidateName} · {verifyResult.program} · Score: {verifyResult.score}% · Issued: {new Date(verifyResult.issuedAt).toLocaleDateString()} · Expires: {new Date(verifyResult.expiresAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button onClick={() => setVerifyResult(null)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
          )}

          {/* Page header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: WHITE, marginBottom: 3 }}>Candidate Roster</div>
              <div style={{ fontSize: 12, color: MUTED }}>{filteredCandidates.length} candidates · Ranked by score</div>
            </div>
            <button style={s.exportBtn} onClick={handleExport}>Export CSV</button>
          </div>

          {/* Toolbar */}
          <div style={s.toolbar}>
            <div style={s.searchBox}>
              <span style={{ color: MUTED, fontSize: 12 }}>🔍</span>
              <input
                style={s.searchInput}
                placeholder="Search by name, email, or credential ID..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
              />
            </div>
            {['all','pass','fail','pending'].map(f => (
              <button key={f} style={s.filterBtn(filter === f)} onClick={() => handleFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Table */}
          <div style={s.tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Candidate','Score','Status','Dimensions','Credential','Actions'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...s.td, textAlign: 'center', color: MUTED, padding: '32px' }}>
                      No candidates found.
                    </td>
                  </tr>
                ) : filteredCandidates.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: `1px solid rgba(245,243,238,0.04)` }}>
                    {/* Candidate */}
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: `rgba(212,168,67,0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: GOLD, flexShrink: 0 }}>
                          {c.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: MUTED }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Score */}
                    <td style={s.td}>
                      {c.score != null ? (
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 500, background: c.score >= 70 ? 'rgba(29,158,117,0.1)' : c.score >= 50 ? 'rgba(239,159,39,0.1)' : 'rgba(226,75,74,0.1)', color: c.score >= 70 ? TEAL2 : c.score >= 50 ? AMBER : RED }}>
                          {c.score}%
                        </span>
                      ) : <span style={{ color: MUTED }}>—</span>}
                    </td>
                    {/* Status */}
                    <td style={s.td}>
                      <span style={s.badge(c.status)}>
                        {c.status === 'pass' ? 'Passed' : c.status === 'fail' ? 'Failed' : 'Pending'}
                      </span>
                    </td>
                    {/* Dimension mini-bars */}
                    <td style={s.td}>
                      {c.dimensions ? (
                        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          {DIM_KEYS.map((key, ki) => (
                            <div key={key} title={`${key}: ${c.dimensions[key] || 0}%`} style={{ height: 4, width: 14, borderRadius: 1, background: DIM_COLORS[ki], opacity: (c.dimensions[key] || 0) / 100 + 0.2 }} />
                          ))}
                        </div>
                      ) : <span style={{ color: MUTED }}>—</span>}
                    </td>
                    {/* Credential */}
                    <td style={s.td}>
                      {c.credentialId ? (
                        <div>
                          <div style={{ fontSize: 11, color: WHITE }}>{c.credentialId}</div>
                          <div style={{ fontSize: 10, color: c.onChain ? TEAL2 : MUTED }}>
                            {c.onChain ? '● On-chain' : '○ Pending'}
                          </div>
                        </div>
                      ) : <span style={{ color: MUTED }}>Not issued</span>}
                    </td>
                    {/* Actions */}
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.credentialId && (
                          <button
                            style={s.verifyBtn}
                            onClick={() => handleVerify(c.credentialId)}
                            disabled={verifying === c.credentialId}
                          >
                            {verifying === c.credentialId ? '...' : 'Verify'}
                          </button>
                        )}
                        <button
                          style={{ background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 5, padding: '5px 8px', cursor: 'pointer', fontSize: 10, color: MUTED }}
                          onClick={() => window.open(`https://atacglobalcx.com/verify/${c.credentialId}`, '_blank')}
                          disabled={!c.credentialId}
                        >
                          View
                        </button>
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
        <div style={s.inviteModal} onClick={() => setShowInvite(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: WHITE, marginBottom: 6 }}>Invite Candidate</div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Enter the candidate's email address to link them to your account.</div>
            <input
              style={s.input}
              type="email"
              placeholder="candidate@email.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
            {inviteMsg && (
              <div style={{ fontSize: 12, color: inviteMsg.includes('success') || inviteMsg.includes('invited') ? TEAL2 : AMBER, marginBottom: 12 }}>
                {inviteMsg}
              </div>
            )}
            <div>
              <button style={s.btnGold} onClick={handleInvite} disabled={!inviteEmail}>
                Send Invite
              </button>
              <button style={s.btnOut} onClick={() => { setShowInvite(false); setInviteMsg(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}