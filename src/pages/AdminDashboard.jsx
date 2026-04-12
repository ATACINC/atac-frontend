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

const ADMIN_EMAILS = ['adrian@atacglobalcx.com', 'tugs@atacglobalcx.com'];

const injectKF = () => {
  if (document.getElementById('vault-adm-kf')) return;
  const s = document.createElement('style');
  s.id = 'vault-adm-kf';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Syne:wght@400;500;600&display=swap');
    @keyframes vault-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    .vault-up { animation: vault-up 0.45s ease both; }
    .row-h:hover { background: rgba(201,168,76,0.03) !important; }
    .nav-h:hover { color: ${WHITE} !important; }
    ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.12); }
  `;
  document.head.appendChild(s);
};

/* ── Shared table helpers ── */
const TH = ({ children }) => (
  <th style={{ padding: '10px 14px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.16em', color: MUTED, fontWeight: 500, textAlign: 'left', whiteSpace: 'nowrap' }}>
    {children}
  </th>
);
const TD = ({ children, style }) => (
  <td style={{ padding: '11px 14px', fontSize: 12, color: WHITE, borderTop: `1px solid ${BORDER2}`, ...style }}>
    {children}
  </td>
);

function StatusBadge({ status }) {
  const map = {
    pass:      { bg: 'rgba(26,143,105,0.1)',  border: 'rgba(26,143,105,0.25)',  c: TEAL2, label: 'Passed'  },
    fail:      { bg: 'rgba(196,92,92,0.1)',   border: 'rgba(196,92,92,0.25)',   c: RED,   label: 'Failed'  },
    pending:   { bg: 'rgba(196,138,42,0.1)',  border: 'rgba(196,138,42,0.25)',  c: AMBER, label: 'Pending' },
    completed: { bg: 'rgba(26,143,105,0.1)',  border: 'rgba(26,143,105,0.25)',  c: TEAL2, label: 'Done'    },
  };
  const st = map[status] || map.pending;
  return (
    <span style={{ fontSize: 9, padding: '3px 9px', background: st.bg, border: `1px solid ${st.border}`, color: st.c, borderRadius: 1, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      {st.label}
    </span>
  );
}

const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview'     },
  { id: 'candidates',  label: 'Candidates'   },
  { id: 'credentials', label: 'Credentials'  },
  { id: 'employers',   label: 'Employers'    },
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeNav, setActiveNav]     = useState('overview');
  const [loading, setLoading]         = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [summary, setSummary]         = useState(null);
  const [candidates, setCandidates]   = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [employers, setEmployers]     = useState([]);
  const [refreshing, setRefreshing]   = useState(false);

  useEffect(() => { injectKF(); checkAdminAccess(); }, []);

  const checkAdminAccess = async () => {
    try {
      const me = await API.get('/api/auth/me');
      const email = me.data.candidate?.email || me.data.email || '';
      if (!ADMIN_EMAILS.includes(email)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      await loadAll();
    } catch {
      navigate('/login');
    }
  };

  const loadAll = async () => {
    setRefreshing(true);
    try {
      const [sumRes, canRes, credRes, empRes] = await Promise.all([
        API.get('/api/admin/summary'),
        API.get('/api/admin/candidates'),
        API.get('/api/admin/credentials'),
        API.get('/api/admin/employers'),
      ]);
      setSummary(sumRes.data);
      setCandidates(canRes.data.candidates || []);
      setCredentials(credRes.data.credentials || []);
      setEmployers(empRes.data.employers || []);
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const logout = () => { localStorage.clear(); navigate('/login'); };

  const fmt = (dt) => dt ? new Date(dt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  /* ── ACCESS DENIED ── */
  if (accessDenied) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: VAULT_BODY }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }} className="vault-up">
        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 14, color: GOLD, letterSpacing: '0.18em', marginBottom: 24 }}>ATAC Global CX</div>
        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, fontWeight: 300, color: WHITE, marginBottom: 10 }}>Access Restricted</div>
        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 28 }}>
          This area is restricted to ATAC administrators.
        </div>
        <button onClick={() => navigate('/dashboard')} style={btnGold}>Return to Dashboard</button>
      </div>
    </div>
  );

  /* ── LOADING ── */
  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: VAULT_BODY }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, color: GOLD, letterSpacing: '0.15em' }}>ATAC Global CX</div>
        <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 8 }}>Loading Command Centre…</div>
      </div>
    </div>
  );

  /* ── MAIN RENDER ── */
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: VAULT_BODY, color: WHITE }}>

      {/* ── Topbar ── */}
      <div style={{ background: BG3, borderBottom: `1px solid ${BORDER2}`, padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div>
            <img src="/logo.png" alt="ATAC Global CX" style={{ height: 32, objectFit: 'contain' }} />
            <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 1 }}>Command Centre</div>
          </div>
          <div style={{ width: 1, height: 28, background: BORDER2 }} />
          <div style={{ display: 'flex', gap: 2 }}>
            {NAV_ITEMS.map(item => {
              const active = activeNav === item.id;
              return (
                <button key={item.id}
                  className="nav-h"
                  onClick={() => setActiveNav(item.id)}
                  style={{ background: active ? 'rgba(201,168,76,0.1)' : 'transparent', border: `1px solid ${active ? BORDER : 'transparent'}`, color: active ? GOLD : MUTED, borderRadius: 2, padding: '6px 14px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em', transition: 'all 0.15s' }}>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={loadAll} disabled={refreshing} style={{ background: FAINT, border: `1px solid ${BORDER2}`, color: MUTED, borderRadius: 2, padding: '6px 12px', fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em', opacity: refreshing ? 0.5 : 1 }}>
            {refreshing ? '…' : '↻ Refresh'}
          </button>
          <div style={{ fontSize: 10, background: 'rgba(196,92,92,0.1)', border: '1px solid rgba(196,92,92,0.25)', color: RED, borderRadius: 2, padding: '4px 10px', letterSpacing: '0.1em' }}>
            ADMIN
          </div>
          <button onClick={logout} style={{ background: 'none', border: `1px solid ${BORDER2}`, color: MUTED, borderRadius: 2, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Page content ── */}
      <div style={{ padding: '28px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ════ OVERVIEW ════ */}
        {activeNav === 'overview' && (
          <div className="vault-up">
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, fontWeight: 300, marginBottom: 6 }}>Platform Overview</div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 28 }}>Live data from Railway PostgreSQL · Last refreshed just now</div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
              {[
                { num: summary?.totalCandidates  || candidates.length || 0, lbl: 'Total Candidates',   color: GOLD  },
                { num: summary?.totalCredentials || credentials.length || 0, lbl: 'Credentials Issued', color: TEAL2 },
                { num: summary?.totalEmployers   || employers.length || 0,   lbl: 'BPO Clients',       color: GOLD  },
                { num: summary?.passRate != null ? `${summary.passRate}%` : '—', lbl: 'Pass Rate', color: TEAL2 },
              ].map((k, i) => (
                <div key={i} style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '20px 22px', animationDelay: `${i * 60}ms` }} className="vault-up">
                  <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 38, fontWeight: 300, color: k.color, lineHeight: 1 }}>{k.num}</div>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 6 }}>{k.lbl}</div>
                </div>
              ))}
            </div>

            {/* 2-col: recent candidates + recent credentials */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Recent candidates */}
              <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3 }}>
                <div style={{ padding: '16px 18px', borderBottom: `1px solid ${BORDER2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, fontWeight: 400, color: WHITE }}>Recent Candidates</div>
                  <button onClick={() => setActiveNav('candidates')} style={{ fontSize: 10, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}>View All →</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><TH>Name</TH><TH>Score</TH><TH>Status</TH><TH>Date</TH></tr></thead>
                  <tbody>
                    {candidates.slice(0, 6).map(c => (
                      <tr key={c.id} className="row-h">
                        <TD>
                          <div style={{ fontSize: 12 }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: MUTED }}>{c.email}</div>
                        </TD>
                        <TD>
                          {c.score != null
                            ? <span style={{ fontFamily: VAULT_DISPLAY, fontSize: 15, color: c.score >= 70 ? TEAL2 : RED }}>{c.score}%</span>
                            : <span style={{ color: MUTED }}>—</span>}
                        </TD>
                        <TD><StatusBadge status={c.status || (c.assessmentCompleted ? 'completed' : 'pending')} /></TD>
                        <TD style={{ color: MUTED, fontSize: 11 }}>{fmt(c.createdAt)}</TD>
                      </tr>
                    ))}
                    {candidates.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: MUTED, fontSize: 12 }}>No candidates yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Recent credentials */}
              <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3 }}>
                <div style={{ padding: '16px 18px', borderBottom: `1px solid ${BORDER2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, fontWeight: 400, color: WHITE }}>Recent Credentials</div>
                  <button onClick={() => setActiveNav('credentials')} style={{ fontSize: 10, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}>View All →</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><TH>Credential ID</TH><TH>Candidate</TH><TH>Chain</TH><TH>Issued</TH></tr></thead>
                  <tbody>
                    {credentials.slice(0, 6).map(cr => (
                      <tr key={cr.id} className="row-h">
                        <TD style={{ fontFamily: 'monospace', fontSize: 11 }}>{cr.credentialId}</TD>
                        <TD style={{ fontSize: 11, color: MUTED }}>{cr.candidateName || cr.name || '—'}</TD>
                        <TD>
                          <span style={{ fontSize: 10, color: cr.onChain ? TEAL2 : MUTED }}>
                            {cr.onChain ? '⬡ On-chain' : '○ Pending'}
                          </span>
                        </TD>
                        <TD style={{ fontSize: 11, color: MUTED }}>{fmt(cr.issuedAt || cr.createdAt)}</TD>
                      </tr>
                    ))}
                    {credentials.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: MUTED, fontSize: 12 }}>No credentials issued</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════ CANDIDATES ════ */}
        {activeNav === 'candidates' && (
          <div className="vault-up">
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, fontWeight: 300, marginBottom: 4 }}>All Candidates</div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 24 }}>{candidates.length} registered candidates</div>

            <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(238,233,223,0.03)' }}>
                    <TH>Candidate</TH>
                    <TH>Program</TH>
                    <TH>Score</TH>
                    <TH>Status</TH>
                    <TH>Payment</TH>
                    <TH>Wallet</TH>
                    <TH>Registered</TH>
                  </tr>
                </thead>
                <tbody>
                  {candidates.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: MUTED }}>No candidates found</td></tr>
                  ) : candidates.map(c => (
                    <tr key={c.id} className="row-h">
                      <TD>
                        <div style={{ fontSize: 13 }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: MUTED }}>{c.email}</div>
                      </TD>
                      <TD style={{ fontSize: 11, color: MUTED }}>{c.program || '—'}</TD>
                      <TD>
                        {c.score != null
                          ? <span style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, color: c.score >= 70 ? TEAL2 : RED }}>{c.score}%</span>
                          : <span style={{ color: MUTED }}>—</span>}
                      </TD>
                      <TD><StatusBadge status={c.status || (c.assessmentCompleted ? 'completed' : 'pending')} /></TD>
                      <TD>
                        <span style={{ fontSize: 10, color: c.hasPaid ? TEAL2 : AMBER }}>
                          {c.hasPaid ? '✓ Paid' : '○ Unpaid'}
                        </span>
                      </TD>
                      <TD style={{ fontSize: 10, color: MUTED, fontFamily: 'monospace' }}>
                        {c.walletAddress ? `${c.walletAddress.substring(0,6)}…${c.walletAddress.slice(-4)}` : '—'}
                      </TD>
                      <TD style={{ fontSize: 11, color: MUTED }}>{fmt(c.createdAt)}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════ CREDENTIALS ════ */}
        {activeNav === 'credentials' && (
          <div className="vault-up">
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Issued Credentials</div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 24 }}>{credentials.length} credentials · Blockchain-verified</div>

            <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(238,233,223,0.03)' }}>
                    <TH>Credential ID</TH>
                    <TH>Token #</TH>
                    <TH>Candidate</TH>
                    <TH>Program</TH>
                    <TH>Score</TH>
                    <TH>On-chain</TH>
                    <TH>TX Hash</TH>
                    <TH>Issued</TH>
                    <TH>Expires</TH>
                  </tr>
                </thead>
                <tbody>
                  {credentials.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: MUTED }}>No credentials issued</td></tr>
                  ) : credentials.map(cr => (
                    <tr key={cr.id} className="row-h">
                      <TD style={{ fontFamily: 'monospace', fontSize: 11, color: GOLD }}>{cr.credentialId}</TD>
                      <TD style={{ fontSize: 12, color: MUTED }}>{cr.tokenId || '—'}</TD>
                      <TD>
                        <div style={{ fontSize: 12 }}>{cr.candidateName || cr.name || '—'}</div>
                        <div style={{ fontSize: 10, color: MUTED }}>{cr.candidateEmail || '—'}</div>
                      </TD>
                      <TD style={{ fontSize: 11, color: MUTED }}>{cr.program || '—'}</TD>
                      <TD>
                        {cr.score != null
                          ? <span style={{ fontFamily: VAULT_DISPLAY, fontSize: 15, color: cr.score >= 70 ? TEAL2 : RED }}>{cr.score}%</span>
                          : <span style={{ color: MUTED }}>—</span>}
                      </TD>
                      <TD>
                        <span style={{ fontSize: 10, color: cr.onChain ? TEAL2 : AMBER }}>
                          {cr.onChain ? '⬡ Minted' : '○ Pending'}
                        </span>
                      </TD>
                      <TD style={{ fontSize: 10, fontFamily: 'monospace', color: MUTED }}>
                        {cr.txHash ? `${cr.txHash.substring(0, 10)}…` : '—'}
                      </TD>
                      <TD style={{ fontSize: 11, color: MUTED }}>{fmt(cr.issuedAt || cr.createdAt)}</TD>
                      <TD style={{ fontSize: 11, color: MUTED }}>{fmt(cr.expiresAt)}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════ EMPLOYERS ════ */}
        {activeNav === 'employers' && (
          <div className="vault-up">
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, fontWeight: 300, marginBottom: 4 }}>BPO / Employer Accounts</div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 24 }}>{employers.length} active accounts</div>

            <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(238,233,223,0.03)' }}>
                    <TH>Company</TH>
                    <TH>Contact</TH>
                    <TH>Plan</TH>
                    <TH>Seats</TH>
                    <TH>Used</TH>
                    <TH>Stripe ID</TH>
                    <TH>Created</TH>
                  </tr>
                </thead>
                <tbody>
                  {employers.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: MUTED }}>No employers found</td></tr>
                  ) : employers.map(emp => (
                    <tr key={emp.id} className="row-h">
                      <TD>
                        <div style={{ fontSize: 13 }}>{emp.companyName || '—'}</div>
                      </TD>
                      <TD>
                        <div style={{ fontSize: 12 }}>{emp.contactName || '—'}</div>
                        <div style={{ fontSize: 10, color: MUTED }}>{emp.email}</div>
                      </TD>
                      <TD>
                        <span style={{ fontSize: 10, padding: '3px 9px', background: 'rgba(201,168,76,0.08)', border: `1px solid ${BORDER}`, color: GOLD, borderRadius: 1, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {emp.planType || 'Team'}
                        </span>
                      </TD>
                      <TD style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, color: GOLD }}>{emp.seatsPurchased || '—'}</TD>
                      <TD style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, color: emp.seatsUsed > 0 ? TEAL2 : MUTED }}>
                        {emp.seatsUsed || 0}
                      </TD>
                      <TD style={{ fontSize: 10, fontFamily: 'monospace', color: MUTED }}>{emp.stripeCustomerId ? `${emp.stripeCustomerId.substring(0,14)}…` : '—'}</TD>
                      <TD style={{ fontSize: 11, color: MUTED }}>{fmt(emp.createdAt)}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const btnGold = {
  background: GOLD, color: BG, border: 'none', borderRadius: 2,
  padding: '11px 26px', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer',
  fontFamily: "'Syne', sans-serif",
};