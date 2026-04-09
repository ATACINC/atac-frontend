/**
 * ATAC Global CX — Admin Command Centre
 * File: src/pages/AdminDashboard.jsx
 * Route: /admin (protected — admin role only)
 * Authors: Adrian Smith & Tugreofia Smith
 *
 * Pulls live data from existing backend endpoints.
 * No new backend routes required for v1.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Constants ─────────────────────────────────────────────────────────────────
const API_BASE    = 'https://atac-backend-production.up.railway.app';
const POLYGONSCAN = 'https://polygonscan.com/tx/';
const ADMIN_EMAILS = ['adrian@atacglobalcx.com', 'tugs@atacglobalcx.com'];

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  navy:    '#0D1B2E',
  navy2:   '#122238',
  gold:    '#D4A843',
  gold2:   '#E8C06A',
  teal:    '#1D9E75',
  teal2:   '#26B589',
  red:     '#E24B4A',
  amber:   '#EF9F27',
  white:   '#F5F3EE',
  muted:   'rgba(245,243,238,0.5)',
  faint:   'rgba(245,243,238,0.05)',
  border:  'rgba(212,168,67,0.18)',
  border2: 'rgba(245,243,238,0.08)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('atac_token') || ''; }
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function pctColor(pct) {
  if (pct == null) return C.muted;
  if (pct >= 80) return C.teal2;
  if (pct >= 70) return C.gold;
  return C.red;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page:       { minHeight: '100vh', background: '#080f1a', fontFamily: 'DM Sans, sans-serif', color: C.white, display: 'flex', flexDirection: 'column' },
  topbar:     { background: C.navy2, borderBottom: `1px solid ${C.border}`, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, flexShrink: 0 },
  brandBadge: { background: 'rgba(212,168,67,0.12)', border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 8px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.gold, marginLeft: 10 },
  brand:      { fontFamily: 'Georgia, serif', fontSize: 15, color: C.gold, letterSpacing: '0.06em' },
  topRight:   { display: 'flex', alignItems: 'center', gap: 14 },
  adminPill:  { fontSize: 10, background: 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 10, padding: '3px 10px', color: C.teal2, letterSpacing: '0.08em', textTransform: 'uppercase' },
  layout:     { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar:    { width: 200, background: C.navy2, borderRight: `1px solid ${C.border2}`, display: 'flex', flexDirection: 'column', flexShrink: 0 },
  navSection: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(245,243,238,0.3)', padding: '16px 18px 6px' },
  navItem:    (a) => ({ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 18px', fontSize: 12, color: a ? C.gold : C.muted, cursor: 'pointer', borderLeft: `2px solid ${a ? C.gold : 'transparent'}`, background: a ? 'rgba(212,168,67,0.07)' : 'transparent', transition: 'all 0.15s', userSelect: 'none' }),
  main:       { flex: 1, overflow: 'auto', padding: '24px 28px' },
  pageTitle:  { fontFamily: 'Georgia, serif', fontSize: 22, color: C.white, marginBottom: 4 },
  pageSub:    { fontSize: 12, color: C.muted, marginBottom: 24 },
  metricsRow: { display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 24 },
  metricCard: { background: C.faint, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '14px 16px' },
  metricNum:  { fontFamily: 'Georgia, serif', fontSize: 26, lineHeight: 1, marginBottom: 4 },
  metricLbl:  { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' },
  metricSub:  { fontSize: 10, color: C.muted, marginTop: 4 },
  tableWrap:  { background: C.faint, border: `1px solid ${C.border2}`, borderRadius: 8, overflow: 'hidden', marginBottom: 20 },
  th:         { padding: '10px 0', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 500 },
  td:         { padding: '11px 0', fontSize: 12, color: C.white, display: 'flex', alignItems: 'center' },
  badge:      (type) => {
    const m = { pass: [C.teal2,'rgba(29,158,117,0.12)','rgba(29,158,117,0.25)'], fail: [C.red,'rgba(226,75,74,0.12)','rgba(226,75,74,0.25)'], pending: [C.amber,'rgba(239,159,39,0.12)','rgba(239,159,39,0.25)'], valid: [C.teal2,'rgba(29,158,117,0.12)','rgba(29,158,117,0.25)'], active: [C.teal2,'rgba(29,158,117,0.12)','rgba(29,158,117,0.25)'] };
    const [color,bg,border] = m[type] || m.pending;
    return { fontSize: 10, padding: '2px 8px', borderRadius: 10, background: bg, border: `1px solid ${border}`, color, whiteSpace: 'nowrap', display: 'inline-block' };
  },
  toolbar:    { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  searchBox:  { display: 'flex', alignItems: 'center', gap: 6, background: C.faint, border: `1px solid ${C.border2}`, borderRadius: 6, padding: '7px 12px', flex: 1, minWidth: 220 },
  searchIn:   { background: 'none', border: 'none', outline: 'none', fontSize: 12, color: C.white, fontFamily: 'DM Sans, sans-serif', width: '100%' },
  filterBtn:  (a) => ({ background: C.faint, border: `1px solid ${a ? C.gold : C.border2}`, borderRadius: 6, padding: '7px 12px', fontSize: 11, color: a ? C.gold : C.muted, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' }),
  exportBtn:  { background: C.gold, color: C.navy, border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' },
  twoCol:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  card:       { background: C.faint, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '18px 20px', marginBottom: 16 },
  cardTitle:  { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.gold, marginBottom: 14 },
  center:     { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: C.muted, fontSize: 13 },
  toast:      (show, err) => ({ position: 'fixed', top: 20, right: 20, background: err ? C.red : C.teal, color: '#fff', fontSize: 12, padding: '10px 18px', borderRadius: 6, opacity: show ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: 'none', zIndex: 9999, fontFamily: 'DM Sans, sans-serif' }),
  loginWrap:  { minHeight: '100vh', background: '#080f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' },
  loginCard:  { background: C.navy2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px 36px', width: 380, textAlign: 'center' },
  loginInput: { width: '100%', background: C.faint, border: `1px solid ${C.border2}`, borderRadius: 6, padding: '10px 14px', fontSize: 13, color: C.white, fontFamily: 'DM Sans, sans-serif', outline: 'none', marginBottom: 10, boxSizing: 'border-box' },
  loginBtn:   { width: '100%', background: C.gold, color: C.navy, border: 'none', borderRadius: 6, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' },
};

const NAV = [
  { id: 'overview',    label: 'Overview',         section: 'Analytics' },
  { id: 'candidates',  label: 'All Candidates',    section: 'Analytics' },
  { id: 'credentials', label: 'Credentials',       section: 'Analytics' },
  { id: 'employers',   label: 'BPO Clients',       section: 'Clients'   },
  { id: 'pending',     label: 'Pending / At-Risk', section: 'Clients'   },
  { id: 'revenue',     label: 'Revenue',           section: 'Business'  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();

  const [authed,     setAuthed]     = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass,  setLoginPass]  = useState('');
  const [loginErr,   setLoginErr]   = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [nav,        setNav]        = useState('overview');
  const [loading,    setLoading]    = useState(false);
  const [toast,      setToast]      = useState({ show: false, msg: '', err: false });
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [candidates,  setCandidates]  = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [employers,   setEmployers]   = useState([]);
  const [summary,     setSummary]     = useState(null);

  const showToast = useCallback((msg, err = false) => {
    setToast({ show: true, msg, err });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginErr('');
    if (!ADMIN_EMAILS.includes(loginEmail.toLowerCase().trim())) {
      setLoginErr('This email is not authorized for admin access.');
      return;
    }
    try {
      const res  = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPass }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginErr(data.error || 'Login failed.'); return; }
      localStorage.setItem('atac_admin_token', data.token);
      localStorage.setItem('atac_token', data.token);
      localStorage.setItem('atac_admin_email', loginEmail.trim());
      setAdminEmail(loginEmail.trim());
      setAuthed(true);
    } catch { setLoginErr('Network error — check your connection.'); }
  };

  useEffect(() => {
    const token = localStorage.getItem('atac_admin_token');
    const email = localStorage.getItem('atac_admin_email') || '';
    if (token && ADMIN_EMAILS.includes(email)) { setAdminEmail(email); setAuthed(true); }
  }, []);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const token = localStorage.getItem('atac_admin_token') || getToken();
    if (!token) return;
    setLoading(true);
    try {
      const h = { Authorization: `Bearer ${token}` };

      const [candRes, empRes, credRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/candidates`, { headers: h }).catch(() => null),
        fetch(`${API_BASE}/api/admin/employers`,          { headers: h }).catch(() => null),
        fetch(`${API_BASE}/api/admin/credentials`,       { headers: h }).catch(() => null),
      ]);

      const allCandidates  = candRes?.ok  ? ((await candRes.json()).candidates  || []) : [];
      const allEmployers   = empRes?.ok   ? ((await empRes.json()).employers    || []) : [];
      const allCredentials = credRes?.ok  ? ((await credRes.json()).credentials || []) : [];

      setCandidates(allCandidates);
      setEmployers(allEmployers);
      setCredentials(allCredentials);

      const passed  = allCandidates.filter(c => c.passed === true  || c.status === 'pass').length;
      const failed  = allCandidates.filter(c => c.passed === false || c.status === 'fail').length;
      const pending = allCandidates.filter(c => c.passed == null   || c.status === 'pending').length;
      const onChain = allCredentials.filter(c => c.tx_hash).length;
      const avgScore = allCandidates.length ? Math.round(allCandidates.reduce((a, c) => a + (c.percentage || 0), 0) / allCandidates.length) : 0;
      setSummary({ total: allCandidates.length, passed, failed, pending, onChain, avgScore, employers: allEmployers.length, totalSeats: allEmployers.reduce((a, e) => a + (e.seats_purchased || 0), 0) });

    } catch { showToast('Failed to load — admin API routes may need to be added.', true); }
    finally  { setLoading(false); }
  }, [showToast]);

  useEffect(() => { if (authed) fetchAll(); }, [authed, fetchAll]);

  const handleRefresh = async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); showToast('Data refreshed'); };
  const handleLogout  = () => { localStorage.removeItem('atac_admin_token'); localStorage.removeItem('atac_admin_email'); setAuthed(false); };

  const filteredCandidates = candidates.filter(c => {
    const matchSearch = !search || (c.name||'').toLowerCase().includes(search.toLowerCase()) || (c.email||'').toLowerCase().includes(search.toLowerCase()) || (c.credentialId||c.credential_id||'').toLowerCase().includes(search.toLowerCase());
    const status = c.passed === true || c.status === 'pass' ? 'pass' : c.passed === false || c.status === 'fail' ? 'fail' : 'pending';
    return matchSearch && (filter === 'all' || status === filter);
  });

  // ── Login screen ───────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={s.loginWrap}>
      <div style={s.loginCard}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>ATAC Global CX</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: C.white, marginBottom: 6 }}>Command Centre</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>Admin access — ATAC Global CX principals only</div>
        <input style={s.loginInput} type="email" placeholder="Admin email address" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        <input style={s.loginInput} type="password" placeholder="Password" value={loginPass} onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        {loginErr && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{loginErr}</div>}
        <button style={s.loginBtn} onClick={handleLogin}>Access Command Centre</button>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 16 }}>Authorized: Adrian Smith · Tugreofia Smith</div>
      </div>
    </div>
  );

  if (loading) return <div style={s.page}><div style={s.center}>Loading Command Centre…</div></div>;

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <style>{`@keyframes atac-spin{to{transform:rotate(360deg)}} .atac-nav:hover{background:rgba(212,168,67,0.05)!important;color:rgba(245,243,238,0.8)!important} .atac-row:hover{background:rgba(255,255,255,0.03)!important}`}</style>

      {/* Topbar */}
      <div style={s.topbar}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={s.brand}>ATAC Global CX</div>
          <div style={s.brandBadge}>Command Centre</div>
        </div>
        <div style={s.topRight}>
          <button onClick={handleRefresh} style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: 5, padding: '5px 10px', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ display: 'inline-block', animation: refreshing ? 'atac-spin 1s linear infinite' : 'none' }}>↻</span> Refresh
          </button>
          <div style={s.adminPill}>Admin</div>
          <div style={{ fontSize: 12, color: C.muted }}>{adminEmail}</div>
          <button onClick={handleLogout} style={{ background: 'none', border: `1px solid ${C.border2}`, borderRadius: 5, padding: '4px 10px', color: C.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>Sign Out</button>
        </div>
      </div>

      <div style={s.layout}>
        {/* Sidebar */}
        <div style={s.sidebar}>
          {['Analytics','Clients','Business'].map(section => (
            <div key={section}>
              <div style={s.navSection}>{section}</div>
              {NAV.filter(n => n.section === section).map(n => (
                <div key={n.id} className="atac-nav" style={s.navItem(nav === n.id)} onClick={() => setNav(n.id)}>{n.label}</div>
              ))}
            </div>
          ))}
          <div style={{ marginTop: 'auto', padding: '16px 18px', borderTop: `1px solid ${C.border2}` }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Platform</div>
            <div style={{ fontSize: 11, color: C.teal2 }}>● All systems operational</div>
          </div>
        </div>

        {/* Main content */}
        <div style={s.main}>

          {/* ── OVERVIEW ── */}
          {nav === 'overview' && <>
            <div style={s.pageTitle}>Business Overview</div>
            <div style={s.pageSub}>Live metrics · ATAC Global CX · {new Date().toLocaleString()}</div>

            <div style={s.metricsRow}>
              {[
                { num: summary?.total     ?? 0, lbl: 'Total Candidates', color: C.gold,  sub: 'All time'                    },
                { num: summary?.passed    ?? 0, lbl: 'Certified',        color: C.teal2, sub: `${summary?.total ? Math.round((summary.passed/summary.total)*100) : 0}% pass rate` },
                { num: summary?.failed    ?? 0, lbl: 'Failed',           color: C.red,   sub: 'Eligible to retry'           },
                { num: summary?.pending   ?? 0, lbl: 'Pending',          color: C.amber, sub: 'In progress'                 },
                { num: summary?.onChain   ?? 0, lbl: 'On-Chain',         color: C.teal2, sub: 'Minted credentials'          },
                { num: summary?.employers ?? 0, lbl: 'BPO Clients',      color: C.gold,  sub: `${summary?.totalSeats ?? 0} total seats` },
              ].map((m, i) => (
                <div key={i} style={s.metricCard}>
                  <div style={{ ...s.metricNum, color: m.color }}>{m.num}</div>
                  <div style={s.metricLbl}>{m.lbl}</div>
                  <div style={s.metricSub}>{m.sub}</div>
                </div>
              ))}
            </div>

            <div style={s.twoCol}>
              {/* Recent certifications */}
              <div style={s.card}>
                <div style={s.cardTitle}>Recent Certifications</div>
                {credentials.slice(0, 8).map((cr, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.teal2, flexShrink: 0 }}>
                      {initials(cr.candidate_name || cr.name || '?')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cr.candidate_name || cr.name || 'Unknown'}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{cr.credential_id} · {fmtDate(cr.issued_at)}</div>
                    </div>
                    {cr.tx_hash && <span style={{ fontSize: 10, color: C.teal2, cursor: 'pointer' }} onClick={() => window.open('https://polygonscan.com/tx/' + cr.tx_hash, '_blank')}>On-chain ↗</span>}
                  </div>
                ))}
                {credentials.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>No credentials yet.</div>}
              </div>

              {/* Platform stats */}
              <div style={s.card}>
                <div style={s.cardTitle}>Platform Health</div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: C.muted }}>Overall pass rate</div>
                    <div style={{ fontSize: 12, color: C.teal2, fontWeight: 600 }}>{summary?.total ? Math.round((summary.passed/summary.total)*100) : 0}%</div>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: 6, width: `${summary?.total ? Math.round((summary.passed/summary.total)*100) : 0}%`, background: C.teal, borderRadius: 3 }} />
                  </div>
                </div>
                {[
                  { lbl: 'Certified (passed)',     val: summary?.passed  ?? 0, color: C.teal2 },
                  { lbl: 'Not certified (failed)', val: summary?.failed  ?? 0, color: C.red   },
                  { lbl: 'Assessment pending',     val: summary?.pending ?? 0, color: C.amber  },
                  { lbl: 'Minted on blockchain',   val: summary?.onChain ?? 0, color: C.teal2 },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: C.muted }}>{row.lbl}</div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: row.color }}>{row.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* BPO snapshot */}
            {employers.length > 0 && (
              <div style={s.card}>
                <div style={s.cardTitle}>BPO Client Snapshot</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                  {employers.map((emp, i) => {
                    const pct = Math.min(100, ((emp.seats_used||0)/(emp.seats_purchased||10))*100);
                    return (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border2}`, borderRadius: 6, padding: '12px 14px' }}>
                        <div style={{ fontSize: 13, color: C.white, fontWeight: 500, marginBottom: 2 }}>{emp.company_name || 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{emp.contact_email}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ fontSize: 11, color: C.muted }}>Seats</div>
                          <div style={{ fontSize: 11, color: C.gold }}>{emp.seats_used||0} / {emp.seats_purchased||10}</div>
                        </div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                          <div style={{ height: 3, width: `${pct}%`, background: pct > 85 ? C.amber : C.teal, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>}

          {/* ── ALL CANDIDATES ── */}
          {nav === 'candidates' && <>
            <div style={s.pageTitle}>All Candidates</div>
            <div style={s.pageSub}>{candidates.length} total across all programs</div>
            <div style={s.toolbar}>
              <div style={s.searchBox}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke={C.muted} strokeWidth="1.3"/><line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke={C.muted} strokeWidth="1.3" strokeLinecap="round"/></svg>
                <input style={s.searchIn} placeholder="Search name, email, credential ID…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {['all','pass','fail','pending'].map(f => (
                <button key={f} style={s.filterBtn(filter===f)} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)}
                </button>
              ))}
            </div>
            <div style={s.tableWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2.5fr 80px 80px 1.8fr 1.4fr 90px', padding: '0 16px', background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${C.border2}` }}>
                {['Name','Email','Score','Status','Credential ID','Issued','On-Chain'].map(h => <div key={h} style={s.th}>{h}</div>)}
              </div>
              {filteredCandidates.length === 0 && <div style={{ padding: '24px 16px', fontSize: 12, color: C.muted }}>No candidates match this filter.</div>}
              {filteredCandidates.map((c, i) => {
                const status = c.passed === true || c.status === 'pass' ? 'pass' : c.passed === false || c.status === 'fail' ? 'fail' : 'pending';
                const pct    = c.percentage ?? c.score ?? null;
                const credId = c.credentialId || c.credential_id;
                return (
                  <div key={i} className="atac-row" style={{ display: 'grid', gridTemplateColumns: '2fr 2.5fr 80px 80px 1.8fr 1.4fr 90px', padding: '0 16px', borderBottom: `1px solid ${C.border2}`, background: i%2===1 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                    <div style={s.td}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(212,168,67,0.12)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.gold, marginRight: 8, flexShrink: 0 }}>{initials(c.name)}</div>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name||'—'}</span>
                    </div>
                    <div style={{ ...s.td, color: C.muted, fontSize: 11 }}>{c.email||'—'}</div>
                    <div style={{ ...s.td, color: pctColor(pct), fontFamily: 'Georgia, serif', fontSize: 14 }}>{pct != null ? `${pct}%` : '—'}</div>
                    <div style={s.td}><span style={s.badge(status)}>{status}</span></div>
                    <div style={{ ...s.td, fontSize: 11, color: C.muted }}>{credId||'—'}</div>
                    <div style={{ ...s.td, fontSize: 11, color: C.muted }}>{fmtDate(c.issuedAt||c.issued_at)}</div>
                    <div style={s.td}>
                      {(c.onChain||c.tx_hash)
                        ? <span style={{ color: C.teal2, cursor: 'pointer', fontSize: 11 }} onClick={() => window.open(POLYGONSCAN+(c.tx_hash||c.txHash),'_blank')}>View ↗</span>
                        : <span style={{ color: C.muted, fontSize: 11 }}>—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>Showing {filteredCandidates.length} of {candidates.length}</div>
          </>}

          {/* ── CREDENTIALS ── */}
          {nav === 'credentials' && <>
            <div style={s.pageTitle}>Issued Credentials</div>
            <div style={s.pageSub}>{credentials.length} total · {credentials.filter(c=>c.tx_hash).length} minted on-chain</div>
            <div style={s.tableWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 2fr 1fr 1fr 1fr 1fr 90px', padding: '0 16px', background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${C.border2}` }}>
                {['Credential ID','Candidate','Program','Issued','Expires','Status','Blockchain'].map(h=><div key={h} style={s.th}>{h}</div>)}
              </div>
              {credentials.length === 0 && <div style={{ padding: '24px 16px', fontSize: 12, color: C.muted }}>No credentials found.</div>}
              {credentials.map((cr, i) => (
                <div key={i} className="atac-row" style={{ display: 'grid', gridTemplateColumns: '1.8fr 2fr 1fr 1fr 1fr 1fr 90px', padding: '0 16px', borderBottom: `1px solid ${C.border2}`, background: i%2===1?'rgba(255,255,255,0.015)':'transparent' }}>
                  <div style={{ ...s.td, fontFamily: 'Georgia, serif', fontSize: 11, color: C.gold }}>{cr.credential_id||'—'}</div>
                  <div style={s.td}>
                    <div>
                      <div style={{ fontSize: 12 }}>{cr.candidate_name||cr.name||'—'}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{cr.candidate_email||cr.email||''}</div>
                    </div>
                  </div>
                  <div style={{ ...s.td, fontSize: 11 }}>{cr.program||'CRSA'}</div>
                  <div style={{ ...s.td, fontSize: 11, color: C.muted }}>{fmtDate(cr.issued_at)}</div>
                  <div style={{ ...s.td, fontSize: 11, color: C.muted }}>{fmtDate(cr.expires_at)}</div>
                  <div style={s.td}><span style={s.badge(cr.status||'valid')}>{cr.status||'valid'}</span></div>
                  <div style={s.td}>
                    {cr.tx_hash
                      ? <span style={{ color: C.teal2, cursor: 'pointer', fontSize: 11 }} onClick={() => window.open(POLYGONSCAN+cr.tx_hash,'_blank')}>#{cr.token_id} ↗</span>
                      : <span style={{ color: C.amber, fontSize: 11 }}>Pending</span>}
                  </div>
                </div>
              ))}
            </div>
          </>}

          {/* ── BPO CLIENTS ── */}
          {nav === 'employers' && <>
            <div style={s.pageTitle}>BPO Clients</div>
            <div style={s.pageSub}>{employers.length} active employer accounts</div>
            {employers.length === 0 && <div style={{ ...s.card, color: C.muted, fontSize: 13 }}>No employer accounts yet. They appear here after a Team plan purchase.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
              {employers.map((emp, i) => {
                const pct = Math.min(100, ((emp.seats_used||0)/(emp.seats_purchased||10))*100);
                return (
                  <div key={i} style={s.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 14, color: C.white, fontWeight: 500 }}>{emp.company_name||'Unknown'}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{emp.contact_email}</div>
                      </div>
                      <span style={s.badge('active')}>{emp.plan||'team'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      {[
                        { lbl: 'Seats Purchased', val: emp.seats_purchased||10, color: C.gold  },
                        { lbl: 'Seats Used',      val: emp.seats_used||0,       color: C.white },
                        { lbl: 'Seats Remaining', val: (emp.seats_purchased||10)-(emp.seats_used||0), color: C.teal2 },
                        { lbl: 'Client Since',    val: fmtDate(emp.created_at), color: C.muted },
                      ].map((row, j) => (
                        <div key={j}>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{row.lbl}</div>
                          <div style={{ fontSize: 13, color: row.color, fontWeight: 500, marginTop: 2 }}>{row.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Seat utilization — {Math.round(pct)}%</div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: 5, width: `${pct}%`, background: pct>85?C.amber:C.teal, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>}

          {/* ── PENDING / AT-RISK ── */}
          {nav === 'pending' && <>
            <div style={s.pageTitle}>Pending & At-Risk</div>
            <div style={s.pageSub}>Candidates requiring attention — in progress, failed, upcoming renewals</div>
            <div style={s.twoCol}>
              <div style={s.card}>
                <div style={s.cardTitle}>Assessments Pending</div>
                {candidates.filter(c=>c.status==='pending'||c.passed==null).slice(0,10).map((c,i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${C.border2}` }}>
                    <div>
                      <div style={{ fontSize:12, color:C.white }}>{c.name||'—'}</div>
                      <div style={{ fontSize:10, color:C.muted }}>{c.email} · Joined {fmtDate(c.joinedAt||c.created_at)}</div>
                    </div>
                    <span style={s.badge('pending')}>Pending</span>
                  </div>
                ))}
                {candidates.filter(c=>c.status==='pending').length===0 && <div style={{ fontSize:12, color:C.muted }}>No pending candidates.</div>}
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>Failed — Eligible to Retry</div>
                {candidates.filter(c=>c.passed===false||c.status==='fail').slice(0,10).map((c,i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${C.border2}` }}>
                    <div>
                      <div style={{ fontSize:12, color:C.white }}>{c.name||'—'}</div>
                      <div style={{ fontSize:10, color:C.muted }}>{c.email} · Score: {c.percentage??'—'}%</div>
                    </div>
                    <span style={s.badge('fail')}>Failed</span>
                  </div>
                ))}
                {candidates.filter(c=>c.status==='fail'||c.passed===false).length===0 && <div style={{ fontSize:12, color:C.muted }}>No failed candidates.</div>}
              </div>
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>Upcoming Credential Renewals (Next 180 Days)</div>
              {credentials.filter(cr=>{
                if(!cr.expires_at) return false;
                const d = Math.floor((new Date(cr.expires_at)-new Date())/86400000);
                return d>=0 && d<=180;
              }).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at)).slice(0,10).map((cr,i)=>{
                const d = Math.floor((new Date(cr.expires_at)-new Date())/86400000);
                return (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${C.border2}` }}>
                    <div>
                      <div style={{ fontSize:12, color:C.white }}>{cr.candidate_name||cr.name||'—'}</div>
                      <div style={{ fontSize:10, color:C.muted }}>{cr.credential_id} · Expires {fmtDate(cr.expires_at)}</div>
                    </div>
                    <span style={s.badge(d<30?'fail':d<90?'pending':'valid')}>{d}d left</span>
                  </div>
                );
              })}
              {credentials.filter(cr=>{ if(!cr.expires_at) return false; const d=Math.floor((new Date(cr.expires_at)-new Date())/86400000); return d>=0&&d<=180; }).length===0 && <div style={{ fontSize:12, color:C.muted }}>No renewals due in the next 180 days.</div>}
            </div>
          </>}

          {/* ── REVENUE ── */}
          {nav === 'revenue' && <>
            <div style={s.pageTitle}>Revenue Overview</div>
            <div style={s.pageSub}>Pricing tiers and business metrics</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
              {[
                { lbl:'Standard Tier', price:'$39',      desc:'Per candidate · Individual certification',   color:C.gold  },
                { lbl:'Pro Tier',      price:'$59',      desc:'Per candidate · Priority + advanced report', color:C.teal2 },
                { lbl:'Team Tier',     price:'$49/seat', desc:'Min 10 seats · BPO & enterprise',            color:C.gold2 },
              ].map((tier,i)=>(
                <div key={i} style={s.card}>
                  <div style={s.cardTitle}>{tier.lbl}</div>
                  <div style={{ fontFamily:'Georgia, serif', fontSize:28, color:tier.color, marginBottom:6 }}>{tier.price}</div>
                  <div style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>{tier.desc}</div>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>Business Metrics</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:20 }}>
                {[
                  { lbl:'Certified Candidates', val:summary?.passed??0,               note:'Revenue-generating completions' },
                  { lbl:'BPO Seat Volume',       val:`${summary?.totalSeats??0} seats`, note:'At $49/seat minimum 10'         },
                  { lbl:'Est. Revenue (Std)',    val:`$${(summary?.passed??0)*39}`,     note:'If all Standard tier'           },
                  { lbl:'Active Employers',      val:summary?.employers??0,            note:'Team plan accounts'             },
                ].map((m,i)=>(
                  <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border2}`, borderRadius:6, padding:'14px 16px' }}>
                    <div style={{ fontFamily:'Georgia, serif', fontSize:22, color:C.gold, marginBottom:4 }}>{m.val}</div>
                    <div style={{ fontSize:11, color:C.white, marginBottom:2 }}>{m.lbl}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{m.note}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:'14px 16px', background:'rgba(212,168,67,0.06)', border:`1px solid ${C.border}`, borderRadius:6 }}>
                <div style={{ fontSize:11, color:C.gold, marginBottom:4 }}>Connect Stripe Admin API for live revenue</div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
                  Add backend route <strong style={{ color:C.white }}>GET /api/stripe/admin/payments</strong> to pull live Stripe payment intent data. Estimated 30-minute backend addition. This will show real MRR, payment history, and refund tracking.
                </div>
              </div>
            </div>
          </>}

        </div>
      </div>

      <div style={s.toast(toast.show, toast.err)}>{toast.msg}</div>
    </div>
  );
}