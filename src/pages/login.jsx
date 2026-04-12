/**
 * ATAC Global CX — Login / Register Page
 * "Vault" design system — luxury dark
 * File: src/pages/login.jsx
 *
 * Detects ?action=register in URL and defaults to Create Account tab.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '../api/client';

const C = {
  bg:         '#080B12',
  bg1:        '#0C1018',
  bg2:        '#101520',
  gold:       '#C9A84C',
  gold2:      '#D4B86A',
  goldDim:    'rgba(201,168,76,0.10)',
  goldBorder: 'rgba(201,168,76,0.20)',
  teal:       '#1A8F69',
  teal2:      '#22B589',
  white:      '#EEE9DF',
  muted:      'rgba(238,233,223,0.45)',
  faint:      'rgba(238,233,223,0.07)',
  border:     'rgba(201,168,76,0.15)',
  border2:    'rgba(238,233,223,0.07)',
  red:        '#E05C52',
};

const F = {
  display: "'Cormorant Garamond', 'Times New Roman', serif",
  body:    "'Syne', 'DM Sans', sans-serif",
};

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();

  // Default tab based on URL param
  const defaultTab = new URLSearchParams(location.search).get('action') === 'register' ? 'register' : 'login';
  const [tab,      setTab]      = useState(defaultTab);

  // Login state
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regName,     setRegName]     = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm,  setRegConfirm]  = useState('');

  // Shared
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    setError('');
    setSuccess('');
  }, [tab]);

  /* ── Login ── */
  const handleLogin = async () => {
    if (!email || !password) { setError('Email and password are required.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await API.post('/api/auth/login', { email: email.trim(), password });
      const { token, candidate } = res.data;
      localStorage.setItem('atac_token', token);
      if (candidate) localStorage.setItem('atac_candidate', JSON.stringify(candidate));
      const role = candidate?.role || res.data.role || 'candidate';
      navigate(role === 'employer' ? '/employer' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally { setLoading(false); }
  };

  /* ── Register ── */
  const handleRegister = async () => {
    if (!regName || !regEmail || !regPassword) { setError('All fields are required.'); return; }
    if (regPassword !== regConfirm) { setError('Passwords do not match.'); return; }
    if (regPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await API.post('/api/auth/register', {
        name:     regName.trim(),
        email:    regEmail.trim(),
        password: regPassword,
      });
      const { token, candidate } = res.data;
      localStorage.setItem('atac_token', token);
      if (candidate) localStorage.setItem('atac_candidate', JSON.stringify(candidate));
      navigate('/payment');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  const inputStyle = (key) => ({
    width: '100%', background: C.faint,
    border: `1px solid ${focused === key ? 'rgba(201,168,76,0.4)' : C.border2}`,
    borderRadius: 3, padding: '13px 16px', fontFamily: F.body, fontSize: 13,
    color: C.white, outline: 'none', transition: 'all 0.2s',
    letterSpacing: '0.02em', boxSizing: 'border-box',
  });

  const labelStyle = {
    fontSize: 9, fontWeight: 600, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: C.muted, marginBottom: 8, display: 'block',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Syne:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes vault-up  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes vault-in  { from { opacity:0; } to { opacity:1; } }
        @keyframes drift     { 0%,100%{transform:translate(0,0) rotate(0deg);} 33%{transform:translate(20px,-15px) rotate(0.5deg);} 66%{transform:translate(-10px,20px) rotate(-0.5deg);} }
        .vault-field:focus   { border-color: rgba(201,168,76,0.5) !important; background: rgba(201,168,76,0.05) !important; }
        .vault-btn:hover:not(:disabled) { background: #D4B86A !important; transform: translateY(-1px); box-shadow: 0 8px 32px rgba(201,168,76,0.25); }
        .vault-btn:disabled  { opacity: 0.6; cursor: not-allowed; }
        .tab-btn:hover       { color: ${C.white} !important; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: F.body, display: 'flex', position: 'relative', overflow: 'hidden' }}>

        {/* ── Background geometry ── */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -200, right: -200, width: 700, height: 700, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.06)', animation: 'drift 18s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: -120, right: -120, width: 500, height: 500, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.04)' }} />
          <div style={{ position: 'absolute', bottom: -100, left: -100, width: 400, height: 400, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.05)', animation: 'drift 22s ease-in-out infinite reverse' }} />
          <div style={{ position: 'absolute', top: 0, left: '45%', width: 1, height: '100%', background: 'linear-gradient(180deg, transparent 0%, rgba(201,168,76,0.08) 30%, rgba(201,168,76,0.08) 70%, transparent 100%)' }} />
        </div>

        {/* ── Left panel ── */}
        <div style={{ width: '45%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 64px', borderRight: `1px solid ${C.border}`, animation: 'vault-in 0.8s ease both' }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 400, color: C.gold, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>ATAC Global CX</div>
            <div style={{ width: 32, height: 1, background: C.gold, opacity: 0.5 }} />
          </div>
          <div style={{ animation: 'vault-up 0.9s ease 0.2s both' }}>
            <div style={{ fontFamily: F.display, fontSize: 52, fontWeight: 300, color: C.white, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 24 }}>
              The Standard<br />
              <span style={{ fontStyle: 'italic', color: C.gold }}>for Remote CX</span><br />
              Excellence.
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.8, maxWidth: 320, letterSpacing: '0.02em' }}>
              Blockchain-verified credentials for the world's most trusted remote customer experience professionals.
            </div>
          </div>
          <div style={{ animation: 'vault-up 0.9s ease 0.4s both' }}>
            <div style={{ height: 1, background: `linear-gradient(90deg, ${C.gold} 0%, transparent 60%)`, marginBottom: 20, opacity: 0.3 }} />
            <div style={{ display: 'flex', gap: 32 }}>
              {[{ num: 'ERC-721', lbl: 'Blockchain Standard' }, { num: 'ISO', lbl: 'Aligned Framework' }, { num: '2026', lbl: 'Cohort Open' }].map((item, i) => (
                <div key={i}>
                  <div style={{ fontFamily: F.display, fontSize: 18, color: C.gold, fontWeight: 400 }}>{item.num}</div>
                  <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>{item.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 64px', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 400, animation: 'vault-up 0.9s ease 0.15s both' }}>

            {/* ── Tab switcher ── */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 36, borderBottom: `1px solid ${C.border2}` }}>
              {[
                { id: 'register', label: 'Create Account' },
                { id: 'login',   label: 'Sign In' },
              ].map(t => (
                <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
                  flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                  padding: '12px 0', fontFamily: F.body, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: tab === t.id ? C.gold : C.muted,
                  borderBottom: `2px solid ${tab === t.id ? C.gold : 'transparent'}`,
                  marginBottom: -1, transition: 'all 0.18s',
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Error / Success ── */}
            {error && (
              <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 3, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: C.red, animation: 'vault-up 0.3s ease both' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: 'rgba(26,143,105,0.08)', border: '1px solid rgba(26,143,105,0.25)', borderRadius: 3, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: C.teal2, animation: 'vault-up 0.3s ease both' }}>
                {success}
              </div>
            )}

            {/* ══ REGISTER TAB ══ */}
            {tab === 'register' && (
              <div>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 300, color: C.white, lineHeight: 1.2, marginBottom: 6 }}>
                    Begin Your Certification
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>Create your account to get started — free, no payment yet.</div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Full Name</label>
                  <input className="vault-field" type="text" placeholder="Your full name" value={regName} onChange={e => setRegName(e.target.value)} onFocus={() => setFocused('rname')} onBlur={() => setFocused(null)} onKeyDown={e => e.key === 'Enter' && handleRegister()} style={inputStyle('rname')} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Email Address</label>
                  <input className="vault-field" type="email" placeholder="your@email.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} onFocus={() => setFocused('remail')} onBlur={() => setFocused(null)} onKeyDown={e => e.key === 'Enter' && handleRegister()} style={inputStyle('remail')} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Password</label>
                  <input className="vault-field" type="password" placeholder="Min. 8 characters" value={regPassword} onChange={e => setRegPassword(e.target.value)} onFocus={() => setFocused('rpass')} onBlur={() => setFocused(null)} onKeyDown={e => e.key === 'Enter' && handleRegister()} style={inputStyle('rpass')} />
                </div>

                <div style={{ marginBottom: 28 }}>
                  <label style={labelStyle}>Confirm Password</label>
                  <input className="vault-field" type="password" placeholder="Repeat password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} onFocus={() => setFocused('rconf')} onBlur={() => setFocused(null)} onKeyDown={e => e.key === 'Enter' && handleRegister()} style={inputStyle('rconf')} />
                </div>

                <button className="vault-btn" onClick={handleRegister} disabled={loading} style={{ width: '100%', background: C.gold, color: C.bg, border: 'none', borderRadius: 3, padding: '14px', fontFamily: F.body, fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16 }}>
                  {loading ? 'Creating Account…' : 'Create Account & Continue'}
                </button>

                <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 1.6 }}>
                  After creating your account you'll choose your assessment tier.<br />No payment is taken at this step.
                </div>
              </div>
            )}

            {/* ══ LOGIN TAB ══ */}
            {tab === 'login' && (
              <div>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 300, color: C.white, lineHeight: 1.2, marginBottom: 6 }}>
                    Welcome back
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>Access your credentials and certification status.</div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Email Address</label>
                  <input className="vault-field" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={inputStyle('email')} />
                </div>

                <div style={{ marginBottom: 28 }}>
                  <label style={labelStyle}>Password</label>
                  <input className="vault-field" type="password" placeholder="············" value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={inputStyle('password')} />
                </div>

                <button className="vault-btn" onClick={handleLogin} disabled={loading} style={{ width: '100%', background: C.gold, color: C.bg, border: 'none', borderRadius: 3, padding: '14px', fontFamily: F.body, fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 20 }}>
                  {loading ? 'Authenticating…' : 'Access Portal'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1, height: 1, background: C.border2 }} />
                  <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.15em', textTransform: 'uppercase' }}>or</div>
                  <div style={{ flex: 1, height: 1, background: C.border2 }} />
                </div>

                <div style={{ textAlign: 'center', fontSize: 12, color: C.muted }}>
                  New to ATAC Global CX?{' '}
                  <span onClick={() => setTab('register')} style={{ color: C.gold, cursor: 'pointer', letterSpacing: '0.02em', borderBottom: `1px solid ${C.border}` }}>
                    Create Account →
                  </span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${C.border2}`, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 9, color: 'rgba(238,233,223,0.25)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Blockchain-Verified</div>
              <div style={{ fontSize: 9, color: 'rgba(238,233,223,0.25)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>© 2026 ATAC Global CX</div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}