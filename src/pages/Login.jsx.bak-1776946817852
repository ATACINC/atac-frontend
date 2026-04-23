/**
 * ATAC Global CX — Login Page v5
 * Native canvas particles, no script injection
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '../api/client';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultTab = new URLSearchParams(location.search).get('action') === 'register' ? 'register' : 'login';

  const [tab,         setTab]         = useState(defaultTab);
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [regFirst,    setRegFirst]    = useState('');
  const [regLast,     setRegLast]     = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm,  setRegConfirm]  = useState('');
  const [termsAccepted,   setTermsAccepted]   = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState(null);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [focused,     setFocused]     = useState(null);
  const [counts,      setCounts]      = useState([0, 0, 0, 0]);

  useEffect(() => { setError(''); }, [tab]);

  /* Google Fonts */
  useEffect(() => {
    if (document.getElementById('atac-gf')) return;
    const l = document.createElement('link');
    l.id = 'atac-gf'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@400;500;600&display=swap';
    document.head.appendChild(l);
  }, []);

  /* Stat counters */
  useEffect(() => {
    const targets = [10931, 42, 15, 100];
    let raf;
    const t = setTimeout(() => {
      const dur = 2000, start = performance.now();
      const run = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        setCounts(targets.map(v => Math.floor(e * v)));
        if (p < 1) raf = requestAnimationFrame(run);
        else setCounts(targets);
      };
      raf = requestAnimationFrame(run);
    }, 800);
    return () => { clearTimeout(t); if (raf) cancelAnimationFrame(raf); };
  }, []);

  /* Particle canvas — native canvas API */
  useEffect(() => {
    const cv = document.getElementById('atac-cv');
    if (!cv) return;
    const X = cv.getContext('2d');
    let raf, W, H;
    const sz = () => { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; };
    sz();
    window.addEventListener('resize', sz);
    const rnd = (a, b) => Math.random() * (b - a) + a;
    const particles = Array.from({ length: 120 }, () => ({
      x: rnd(0, window.innerWidth), y: rnd(0, window.innerHeight),
      vx: rnd(-0.2, 0.2), vy: rnd(-0.5, -0.1),
      r: rnd(0.3, 1.8), a: rnd(0.06, 0.35),
      t: 0, T: rnd(160, 460), hi: Math.random() > 0.88,
    }));
    const orbs = Array.from({ length: 4 }, () => ({
      x: rnd(0, window.innerWidth), y: rnd(0, window.innerHeight),
      r: rnd(80, 220), op: rnd(0.008, 0.04),
      vx: rnd(-0.08, 0.08), vy: rnd(-0.08, 0.08),
      t: 0, T: rnd(350, 900),
    }));
    const loop = () => {
      X.clearRect(0, 0, W, H);
      orbs.forEach(o => {
        const f = o.t < 80 ? o.t / 80 : o.t > o.T - 80 ? (o.T - o.t) / 80 : 1;
        const g = X.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `rgba(201,168,76,${o.op * f})`);
        g.addColorStop(1, 'rgba(201,168,76,0)');
        X.beginPath(); X.arc(o.x, o.y, o.r, 0, 6.28);
        X.fillStyle = g; X.fill();
        o.x += o.vx; o.y += o.vy; o.t++;
        if (o.t > o.T) { o.x = rnd(0, W); o.y = rnd(0, H); o.t = 0; o.T = rnd(350, 900); }
      });
      particles.forEach(p => {
        const f = p.t < 50 ? p.t / 50 : p.t > p.T - 50 ? (p.T - p.t) / 50 : 1;
        const rv = p.hi ? 240 : 201, gv = p.hi ? 216 : 168;
        X.beginPath(); X.arc(p.x, p.y, p.r, 0, 6.28);
        X.fillStyle = `rgba(${rv},${gv},76,${p.a * f})`;
        if (p.hi) { X.shadowBlur = 10; X.shadowColor = `rgba(${rv},${gv},76,0.5)`; }
        X.fill(); X.shadowBlur = 0;
        p.x += p.vx; p.y += p.vy; p.t++;
        if (p.y < -8 || p.t > p.T) { p.x = rnd(0, W); p.y = H + 8; p.t = 0; p.T = rnd(160, 460); }
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', sz); };
  }, []);

  const handleLogin = async () => {
    if (!email || !password) { setError('Email and password are required.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await API.post('/api/auth/login', { email: email.trim(), password });
      const { token, candidate } = res.data;
      localStorage.setItem('atac_token', token);
      if (candidate) localStorage.setItem('atac_candidate', JSON.stringify(candidate));
      navigate(candidate?.role === 'employer' ? '/employer' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    const name = `${regFirst.trim()} ${regLast.trim()}`.trim();
    if (!name || !regEmail || !regPassword) { setError('All fields are required.'); return; }
    if (regPassword !== regConfirm) { setError('Passwords do not match.'); return; }
    if (regPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!termsAccepted) { setError('You must accept the Terms of Certification to continue.'); return; }
    setError(''); setLoading(true);
    try {
const res = await API.post('/api/auth/register', {
        name,
        email: regEmail.trim(),
        password: regPassword,
        termsAccepted: true,
        termsAcceptedAt: termsAcceptedAt || new Date().toISOString(),
      });      const { token, candidate } = res.data;
      localStorage.setItem('atac_token', token);
      if (candidate) localStorage.setItem('atac_candidate', JSON.stringify(candidate));
      navigate('/payment');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  const GOLD  = '#C9A84C';
  const GOLD2 = '#E8C96A';
  const BLACK = '#04040A';
  const TEXT1 = '#F5F0E8';
  const TEXT2 = 'rgba(245,240,232,0.55)';
  const TEXT3 = 'rgba(245,240,232,0.28)';
  const BORD  = 'rgba(201,168,76,0.16)';
  const SURF  = 'rgba(255,255,255,0.028)';
  const FD    = "'Cormorant Garamond',Georgia,serif";
  const FB    = "'Inter',system-ui,sans-serif";
  const FG    = "'Space Grotesk',sans-serif";

  const inputStyle = (key) => ({
    width: '100%', boxSizing: 'border-box',
    background: focused === key ? 'rgba(201,168,76,0.05)' : SURF,
    border: `1px solid ${focused === key ? 'rgba(201,168,76,0.55)' : BORD}`,
    borderRadius: 8, padding: '12px 15px',
    fontFamily: FB, fontSize: 13, color: TEXT1,
    outline: 'none', transition: 'all .2s',
  });

  const labelStyle = {
    display: 'block', marginBottom: 7,
    fontSize: 9.5, fontWeight: 500, letterSpacing: '.2em',
    textTransform: 'uppercase', color: TEXT3, fontFamily: FB,
  };

  const STATS = [
    { n: counts[0].toLocaleString(), s: '',  l: 'Professionals' },
    { n: counts[1],                  s: '+', l: 'Countries'     },
    { n: counts[2],                  s: '',  l: 'Languages'     },
    { n: counts[3],                  s: '%', l: 'On-Chain'      },
  ];

  const PILLS  = ['ERC-721 Blockchain', 'ISO-Aligned Framework', 'Blockchain-Verified'];
  const BADGES = [['ERC-721','Blockchain Standard'],['ISO','Aligned Framework'],['2026','Cohort Open']];

  return (
    <>
      <style>{`
        @keyframes dotpulse {
          0%,100%{box-shadow:0 0 6px #C9A84C;opacity:1;}
          50%{box-shadow:0 0 2px #C9A84C;opacity:.4;}
        }
        .atac-btn:hover:not(:disabled){background:#E8C96A!important;transform:translateY(-1px);}
        .atac-btn:disabled{opacity:.6;cursor:not-allowed;}
        .atac-tab:hover{color:#F5F0E8!important;}
        .atac-link:hover{color:#E8C96A!important;}
      `}</style>

      <canvas id="atac-cv" style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', display:'block' }} />

      <div style={{ position:'fixed', inset:0, background:BLACK, fontFamily:FB, color:TEXT1, display:'flex', zIndex:1 }}>

        {/* LEFT PANEL */}
        <div style={{ width:'55%', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'36px 52px', borderRight:`1px solid rgba(201,168,76,0.22)` }}>

          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img
              src="https://atacglobalcx.com/wp-content/uploads/2026/04/AGCX-Final-Logo-Transparent2-1.png"
              alt="" style={{ width:32, height:32, objectFit:'contain' }}
              onError={e => e.target.style.display='none'}
            />
            <div>
              <div style={{ fontFamily:FG, fontSize:11.5, fontWeight:600, letterSpacing:'.24em', color:GOLD2, textTransform:'uppercase' }}>ATAC Global CX</div>
              <div style={{ fontSize:8.5, fontWeight:300, letterSpacing:'.16em', color:TEXT3, textTransform:'uppercase', marginTop:2 }}>Blockchain-Verified Credentials</div>
            </div>
          </div>

          {/* Center */}
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
              <div style={{ width:36, height:1, background:'linear-gradient(to right,#6B5420,#C9A84C)' }} />
              <span style={{ fontFamily:FG, fontSize:9.5, fontWeight:500, letterSpacing:'.28em', color:GOLD, textTransform:'uppercase' }}>Global CX Verification Platform</span>
            </div>

            <h1 style={{ fontFamily:FD, fontSize:'clamp(36px,3.6vw,54px)', fontWeight:300, lineHeight:1.06, color:TEXT1, margin:'0 0 18px 0' }}>
              The Standard<br/>
              <em style={{ fontStyle:'italic', color:GOLD2 }}>for Remote CX</em><br/>
              Excellence.
            </h1>

            <p style={{ fontSize:13, fontWeight:300, lineHeight:1.72, color:TEXT2, maxWidth:380, margin:'0 0 24px 0' }}>
              Blockchain-verified credentials for the world's most trusted remote customer experience professionals.
            </p>

            {/* Stats */}
            <div style={{ display:'flex', margin:'0 0 20px 0' }}>
              {STATS.map((s, i) => (
                <div key={i} style={{
                  flex:1, padding:'13px 14px', background:SURF,
                  border:`1px solid ${BORD}`,
                  borderRight: i < 3 ? 'none' : `1px solid ${BORD}`,
                  borderRadius: i===0 ? '7px 0 0 7px' : i===3 ? '0 7px 7px 0' : 0,
                }}>
                  <div style={{ fontFamily:FD, fontSize:26, fontWeight:500, color:GOLD2, lineHeight:1, marginBottom:4 }}>{s.n}{s.s}</div>
                  <div style={{ fontSize:8.5, fontWeight:500, letterSpacing:'.18em', color:TEXT3, textTransform:'uppercase' }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Pills */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PILLS.map((text, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', border:'1px solid rgba(201,168,76,0.18)', borderRadius:100, background:'rgba(201,168,76,0.06)' }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:GOLD, boxShadow:`0 0 6px ${GOLD}`, animation:`dotpulse 2.4s ease-in-out ${i*.8}s infinite`, flexShrink:0 }} />
                  <span style={{ fontSize:8.5, fontWeight:500, letterSpacing:'.16em', color:'rgba(245,240,232,0.55)', textTransform:'uppercase' }}>{text}</span>
                </div>
              ))}
            </div>

          </div>

          {/* Badges */}
          <div style={{ display:'flex', gap:28 }}>
            {BADGES.map(([v,l],i) => (
              <div key={i}>
                <div style={{ fontFamily:FD, fontSize:15, fontWeight:500, color:TEXT1 }}>{v}</div>
                <div style={{ fontSize:8, fontWeight:300, letterSpacing:'.15em', color:TEXT3, textTransform:'uppercase', marginTop:3 }}>{l}</div>
              </div>
            ))}
          </div>

        </div>

        {/* RIGHT PANEL */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'36px 52px', overflowY:'auto' }}>

          {/* Tabs */}
          <div style={{ display:'flex', borderBottom:`1px solid rgba(201,168,76,0.14)`, marginBottom:0 }}>
            {[['register','Create Account'],['login','Sign In']].map(([id,label]) => (
              <button key={id} className="atac-tab" onClick={() => setTab(id)} style={{
                flex:1, background:'none', border:'none', cursor:'pointer',
                padding:'13px 0', fontFamily:FG, fontSize:10, fontWeight:500,
                letterSpacing:'.22em', textTransform:'uppercase',
                color: tab===id ? GOLD : TEXT3,
                borderBottom: `2px solid ${tab===id ? GOLD : 'transparent'}`,
                marginBottom:-1, transition:'color .18s',
              }}>{label}</button>
            ))}
          </div>

          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:'100%', maxWidth:360 }}>

              {error && (
                <div style={{ background:'rgba(192,57,43,0.09)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:6, padding:'10px 14px', marginBottom:18, fontSize:13, color:'#E05C52' }}>
                  {error}
                </div>
              )}

              {tab === 'login' && (
                <>
                  <h2 style={{ fontFamily:FD, fontSize:32, fontWeight:300, color:TEXT1, marginBottom:6, lineHeight:1.1 }}>Welcome back</h2>
                  <p style={{ fontSize:12.5, fontWeight:300, color:TEXT2, marginBottom:26, lineHeight:1.6 }}>Access your credentials and certification status.</p>

                  <div style={{ marginBottom:16 }}>
                    <label style={labelStyle}>Email Address</label>
                    <input type="email" placeholder="your@email.com" value={email} autoComplete="email"
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setFocused('em')} onBlur={() => setFocused(null)}
                      onKeyDown={e => e.key==='Enter' && handleLogin()}
                      style={inputStyle('em')} />
                  </div>

                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                      <label style={{ ...labelStyle, marginBottom:0 }}>Password</label>
                      <a href="#" style={{ fontSize:10.5, color:TEXT3, textDecoration:'none', letterSpacing:'.06em' }}>Forgot password?</a>
                    </div>
                    <input type="password" placeholder="••••••••••••" value={password} autoComplete="current-password"
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)}
                      onKeyDown={e => e.key==='Enter' && handleLogin()}
                      style={inputStyle('pw')} />
                  </div>

                  <button
                    className="atac-btn"
                    disabled={loading}
                    onClick={handleLogin}
                    style={{ width:'100%', background:GOLD, color:BLACK, border:'none', borderRadius:8, padding:'14px', fontFamily:FG, fontSize:11, fontWeight:600, letterSpacing:'.22em', textTransform:'uppercase', cursor:'pointer', transition:'all .2s', marginTop:6, marginBottom:18 }}>
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
                    <div style={{ flex:1, height:1, background:'rgba(201,168,76,0.12)' }} />
                    <span style={{ fontSize:9.5, color:TEXT3, letterSpacing:'.16em', textTransform:'uppercase' }}>or</span>
                    <div style={{ flex:1, height:1, background:'rgba(201,168,76,0.12)' }} />
                  </div>
                  <p style={{ textAlign:'center', fontSize:13, color:'rgba(245,240,232,0.38)', fontWeight:300 }}>
                    New to ATAC Global CX?{' '}
                    <span className="atac-link" onClick={() => setTab('register')} style={{ color:GOLD, cursor:'pointer', fontWeight:500, transition:'color .2s' }}>Create Account →</span>
                  </p>
                </>
              )}

              {tab === 'register' && (
                <>
                  <h2 style={{ fontFamily:FD, fontSize:32, fontWeight:300, color:TEXT1, marginBottom:6, lineHeight:1.1 }}>Join the network.</h2>
                  <p style={{ fontSize:12.5, fontWeight:300, color:TEXT2, marginBottom:22, lineHeight:1.6 }}>Apply for blockchain-verified CX certification.</p>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                    {[['First Name','rfn',regFirst,setRegFirst,'given-name'],['Last Name','rln',regLast,setRegLast,'family-name']].map(([lbl,k,v,set,ac]) => (
                      <div key={k}>
                        <label style={labelStyle}>{lbl}</label>
                        <input type="text" placeholder={lbl.split(' ')[0]} value={v} autoComplete={ac}
                          onChange={e => set(e.target.value)}
                          onFocus={() => setFocused(k)} onBlur={() => setFocused(null)}
                          style={inputStyle(k)} />
                      </div>
                    ))}
                  </div>

                  {[
                    ['Email Address','email','rem',regEmail,setRegEmail,'email','your@email.com'],
                    ['Create Password','password','rpw',regPassword,setRegPassword,'new-password','Min. 8 characters'],
                    ['Confirm Password','password','rcf',regConfirm,setRegConfirm,'new-password','••••••••••••'],
                  ].map(([lbl,type,k,v,set,ac,ph]) => (
                    <div key={k} style={{ marginBottom:13 }}>
                      <label style={labelStyle}>{lbl}</label>
                      <input type={type} placeholder={ph} value={v} autoComplete={ac}
                        onChange={e => set(e.target.value)}
                        onFocus={() => setFocused(k)} onBlur={() => setFocused(null)}
                        onKeyDown={e => e.key==='Enter' && handleRegister()}
                        style={inputStyle(k)} />
                    </div>
                  ))}

                  {/* ── Terms of Certification — required for legal audit trail ─ */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    marginTop: 8,
                    marginBottom: 18,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}>
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTermsAccepted(checked);
                        setTermsAcceptedAt(checked ? new Date().toISOString() : null);
                      }}
                      style={{
                        marginTop: 3,
                        width: 14,
                        height: 14,
                        accentColor: GOLD,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 11, lineHeight: 1.55, color: TEXT2 }}>
                      I certify that I am the individual named above. I will personally
                      complete all assessments. I understand that credential fraud voids
                      my certification permanently and results in public revocation on
                      the blockchain.
                    </span>
                  </label>
                  <button
                    className="atac-btn"
                    disabled={loading || !termsAccepted}
                    onClick={handleRegister}
                    style={{
                      width: '100%',
                      background: GOLD,
                      color: BLACK,
                      border: 'none',
                      borderRadius: 8,
                      padding: '14px',
                      fontFamily: FG,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '.22em',
                      textTransform: 'uppercase',
                      cursor: (loading || !termsAccepted) ? 'not-allowed' : 'pointer',
                      opacity: (loading || !termsAccepted) ? 0.4 : 1,
                      transition: 'all .2s',
                      marginTop: 0,
                      marginBottom: 18,
                    }}>
                    {loading ? 'Creating Account…' : 'Apply for Access'}
                  </button>

                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                    <div style={{ flex:1, height:1, background:'rgba(201,168,76,0.12)' }} />
                    <span style={{ fontSize:9.5, color:TEXT3, letterSpacing:'.16em', textTransform:'uppercase' }}>or</span>
                    <div style={{ flex:1, height:1, background:'rgba(201,168,76,0.12)' }} />
                  </div>
                  <p style={{ textAlign:'center', fontSize:13, color:'rgba(245,240,232,0.38)', fontWeight:300 }}>
                    Already certified?{' '}
                    <span className="atac-link" onClick={() => setTab('login')} style={{ color:GOLD, cursor:'pointer', fontWeight:500, transition:'color .2s' }}>Sign In →</span>
                  </p>
                </>
              )}

            </div>
          </div>

          {/* Footer */}
          <div style={{ display:'flex', justifyContent:'space-between', paddingTop:14, borderTop:'1px solid rgba(201,168,76,0.08)' }}>
            {['Blockchain-Verified','Secure Portal','© 2026 ATAC Global CX'].map((t,i) => (
              <span key={i} style={{ fontFamily:FG, fontSize:8.5, fontWeight:i===0?500:300, letterSpacing:'.16em', color:'rgba(245,240,232,0.18)', textTransform:'uppercase' }}>{t}</span>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}

