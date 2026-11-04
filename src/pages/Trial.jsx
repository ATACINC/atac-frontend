import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import Header from '../components/chrome/Header';

/* ── Vault Design Tokens ─────────────────────────────────── */
const BG     = '#080B12';
const BG1    = '#0C1018';
const BG3    = '#141B26';
const GOLD   = '#C9A84C';
const TEAL   = '#1A8F69';
const TEAL2  = '#22A67E';
const RED    = '#C45C5C';
const AMBER  = '#C48A2A';
const WHITE  = '#EEE9DF';
const MUTED  = 'rgba(238,233,223,0.62)';
const SOFT   = 'rgba(238,233,223,0.42)';
const FAINT  = 'rgba(238,233,223,0.04)';
const BORDER  = 'rgba(201,168,76,0.22)';
const BORDER2 = 'rgba(238,233,223,0.09)';

const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const API_BASE = 'https://atac-backend-production.up.railway.app';

/* What each domain covers. Descriptive only, no outcome claims. */
const DOMAINS = [
  { key: 'professionalism',   label: 'Professionalism',     icon: '◆', blurb: 'Reliability, judgment and conduct when no one is watching.' },
  { key: 'communication',     label: 'Communication',       icon: '◇', blurb: 'Listening, empathy and clear answers under pressure.' },
  { key: 'cx_operations',     label: 'CX Operations',       icon: '▲', blurb: 'Resolution, escalation and the habits behind good service.' },
  { key: 'technology',        label: 'Technology',          icon: '●', blurb: 'Your home setup, your tools and staying connected.' },
  { key: 'compliance_safety', label: 'Compliance & Safety', icon: '■', blurb: 'Privacy, verification and secure work habits.' },
];

const LETTERS = ['A', 'B', 'C', 'D'];

function bandFor(score, total) {
  const r = total ? score / total : 0;
  if (r >= 1)   return { title: 'Excellent foundation', tone: TEAL2, line: 'You answered every practice question correctly. The full CRSA is the place to prove it.' };
  if (r >= 0.8) return { title: 'Strong foundation',    tone: TEAL2, line: 'You know your stuff. The full CRSA goes deeper and adds a live voice simulation.' };
  if (r >= 0.6) return { title: 'Solid start',          tone: GOLD,  line: 'Good instincts with a couple of gaps. Review the answers below, then take on the full CRSA.' };
  return              { title: 'Room to grow',          tone: AMBER, line: 'Every pro starts somewhere. Review the answers below and see what the full CRSA covers.' };
}

const injectKF = () => {
  if (document.getElementById('vault-trial-kf')) return;
  const s = document.createElement('style');
  s.id = 'vault-trial-kf';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Syne:wght@400;500;600;700&display=swap');
    @keyframes vt-up   { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
    @keyframes vt-in   { from { opacity:0; transform:translateX(28px); } to { opacity:1; transform:translateX(0); } }
    @keyframes vt-pop  { 0% { transform:scale(1); } 40% { transform:scale(1.015); } 100% { transform:scale(1); } }
    @keyframes vt-glow { 0%,100% { box-shadow:0 0 0 0 rgba(201,168,76,0.0); } 50% { box-shadow:0 0 0 6px rgba(201,168,76,0.10); } }
    .vt-up  { animation: vt-up 0.5s ease both; }
    .vt-in  { animation: vt-in 0.35s ease both; }
    .vt-d1 { animation-delay: .08s } .vt-d2 { animation-delay: .16s } .vt-d3 { animation-delay: .24s } .vt-d4 { animation-delay: .32s } .vt-d5 { animation-delay: .40s }

    .vt-hero { display:grid; grid-template-columns: 1.05fr 1fr; gap: 56px; align-items:center; }
    .vt-steps { display:grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
    .vt-feats { display:grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
    @media (max-width: 900px) {
      .vt-hero  { grid-template-columns: 1fr; gap: 36px; }
      .vt-steps { grid-template-columns: 1fr; }
      .vt-feats { grid-template-columns: 1fr; }
      .vt-tip   { display: none; }
    }

    .vt-domain { transition: border-color .2s, background .2s, transform .2s; cursor:pointer; }
    .vt-domain:hover, .vt-domain.on { border-color:${BORDER} !important; background: rgba(201,168,76,0.06) !important; transform: translateX(4px); }
    .vt-domain .vt-blurb { max-height:0; opacity:0; overflow:hidden; transition: max-height .25s ease, opacity .25s ease, margin .25s ease; }
    .vt-domain:hover .vt-blurb, .vt-domain.on .vt-blurb { max-height:60px; opacity:1; margin-top:6px; }

    .vt-opt { transition: border-color .15s, background .15s, transform .12s; cursor:pointer; }
    .vt-opt:hover { border-color:${BORDER} !important; background: rgba(201,168,76,0.05) !important; transform: translateY(-1px); }
    .vt-opt.sel { animation: vt-pop .25s ease; }
    .vt-btn { transition: transform .12s, filter .15s, opacity .15s; }
    .vt-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
    .vt-cta { animation: vt-glow 2.6s ease-in-out infinite; }
    .vt-row { transition: background .15s; cursor:pointer; }
    .vt-row:hover { background: rgba(238,233,223,0.03); }
    .vt-kbd { display:inline-block; min-width:20px; padding:1px 6px; border:1px solid ${BORDER2}; border-bottom-width:2px; border-radius:3px; font-size:11px; color:${MUTED}; text-align:center; }
    ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.15); }
  `;
  document.head.appendChild(s);
};

/* Animated score ring for the results screen */
function ScoreRing({ score, total, tone }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setShown(Math.min(n, score));
      if (n >= score) clearInterval(id);
    }, 220);
    return () => clearInterval(id);
  }, [score]);
  const R = 70, C = 2 * Math.PI * R;
  const pct = total ? shown / total : 0;
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label={`${score} of ${total} correct`}>
      <circle cx="90" cy="90" r={R} fill="none" stroke={BORDER2} strokeWidth="8" />
      <circle cx="90" cy="90" r={R} fill="none" stroke={tone} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 90 90)"
        style={{ transition: 'stroke-dashoffset .3s ease' }} />
      <text x="90" y="92" textAnchor="middle" fontFamily={VAULT_DISPLAY} fontSize="58" fill={WHITE} fontWeight="300">{shown}</text>
      <text x="90" y="122" textAnchor="middle" fontFamily={VAULT_BODY} fontSize="12" fill={SOFT} letterSpacing="2">OF {total}</text>
    </svg>
  );
}

/* ── Phase: intro | questions | result ── */
export default function Trial() {
  const navigate = useNavigate();
  const location = useLocation();
  // Carry tracking (utm_*) and referral (ref) codes from /try into registration.
  const registerHref = (() => {
    const incoming = new URLSearchParams(location.search);
    const out = new URLSearchParams({ action: 'register' });
    incoming.forEach((v, k) => { if (k === 'ref' || k.startsWith('utm_')) out.set(k, v); });
    // Login.jsx stores `ref` as the signup attribution source.
    if (!out.has('ref')) out.set('ref', 'try');
    return `/login?${out.toString()}`;
  })();
  const { showToast } = useToast();

  const [phase,      setPhase]      = useState('intro');
  const [questions,  setQuestions]  = useState([]);
  const [current,    setCurrent]    = useState(0);
  const [answers,    setAnswers]    = useState({});
  const [animKey,    setAnimKey]    = useState(0);
  const [result,     setResult]     = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [sessionKey, setSessionKey] = useState('');
  const [openDomain, setOpenDomain] = useState(null);
  const [openRow,    setOpenRow]    = useState(null);
  const advanceTimer = useRef(null);

  useEffect(() => { injectKF(); }, []);
  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/trial/questions`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.questions)) throw new Error('bad');
      setQuestions(data.questions);
      setSessionKey(data.sessionKey || '');
      setPhase('questions');
      setCurrent(0);
      setAnswers({});
      setSubmitting(false);
      window.scrollTo({ top: 0 });
    } catch {
      showToast('Failed to load questions. Please try again.', true);
    } finally {
      setLoading(false);
    }
  };

  const goTo = useCallback((i) => {
    clearTimeout(advanceTimer.current);
    setCurrent(i);
    setAnimKey(k => k + 1);
  }, []);

  const selectAnswer = useCallback((qId, optIdx) => {
    setAnswers(prev => ({ ...prev, [qId]: optIdx }));
    // Auto-advance after a short beat so the choice registers visually.
    clearTimeout(advanceTimer.current);
    if (current < questions.length - 1) {
      advanceTimer.current = setTimeout(() => goTo(current + 1), 480);
    }
  }, [current, questions.length, goTo]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = questions.map(q => ({ id: q.id, selected: answers[q.id] ?? null }));
      const res  = await fetch(`${API_BASE}/api/trial/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ answers: payload, sessionKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Your readiness check expired. Please start again.', true);
        setPhase('intro');
        setSubmitting(false);
        return;
      }
      setResult(data);
      setOpenRow(null);
      setPhase('result');
      window.scrollTo({ top: 0 });
    } catch {
      showToast('Submission failed. Please try again.', true);
      setSubmitting(false);
    }
  }, [submitting, questions, answers, sessionKey, showToast]);

  const answered    = Object.keys(answers).length;
  const q           = questions[current] || null;
  const allAnswered = answered === questions.length && questions.length > 0;
  const isLast      = current === questions.length - 1;

  /* Keyboard: 1-4 or A-D to choose, Enter for next/submit, arrows to move */
  useEffect(() => {
    if (phase !== 'questions' || !q) return;
    const onKey = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const k = e.key.toUpperCase();
      const idx = ['1', '2', '3', '4'].indexOf(k) >= 0 ? ['1', '2', '3', '4'].indexOf(k) : LETTERS.indexOf(k);
      if (idx >= 0 && idx < q.options.length) { e.preventDefault(); selectAnswer(q.id, idx); return; }
      if (e.key === 'ArrowRight' && answers[q.id] !== undefined && !isLast) { e.preventDefault(); goTo(current + 1); }
      if (e.key === 'ArrowLeft' && current > 0) { e.preventDefault(); goTo(current - 1); }
      if (e.key === 'Enter') {
        if (isLast && allAnswered) { e.preventDefault(); handleSubmit(); }
        else if (!isLast && answers[q.id] !== undefined) { e.preventDefault(); goTo(current + 1); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, q, answers, current, isLast, allAnswered, selectAnswer, goTo, handleSubmit]);

  const shell = (children, headerRight) => (
    <div style={{ minHeight: '100vh', background: `radial-gradient(1200px 600px at 75% -10%, rgba(201,168,76,0.07), transparent 60%), ${BG}`, fontFamily: VAULT_BODY, color: WHITE, display: 'flex', flexDirection: 'column' }}>
      <Header variant="lite" right={headerRight} />
      {children}
    </div>
  );

  const signInBtn = (
    <button onClick={() => navigate('/login')} className="vt-btn" style={{ background: 'none', border: `1px solid ${BORDER2}`, color: MUTED, borderRadius: 2, padding: '9px 18px', fontSize: 12, cursor: 'pointer', letterSpacing: '0.1em', fontFamily: VAULT_BODY }}>
      Sign In
    </button>
  );

  /* ── INTRO ── */
  if (phase === 'intro') return shell(
    <main style={{ flex: 1, padding: 'clamp(28px, 6vw, 72px) 16px 64px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <section className="vt-hero">
          {/* Left: pitch */}
          <div className="vt-up">
            <div style={{ fontSize: 12, color: GOLD, letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 20 }}>Free Remote CX Readiness Check</div>
            <h1 style={{ fontFamily: VAULT_DISPLAY, fontSize: 'clamp(44px, 6.4vw, 76px)', fontWeight: 300, lineHeight: 1.02, margin: '0 0 22px' }}>
              5 Questions.<br /><span style={{ color: GOLD }}>See Where You Stand.</span>
            </h1>
            <p style={{ fontSize: 'clamp(16px, 1.6vw, 19px)', color: MUTED, lineHeight: 1.7, maxWidth: 520, margin: '0 0 32px' }}>
              One practice question from each core area of remote customer service. No account, no payment. Get your score and the right answers instantly.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
              {[{ v: '5', l: 'Questions' }, { v: '~3', l: 'Minutes' }, { v: 'Free', l: 'No payment' }].map((s, i) => (
                <div key={i} style={{ flex: '1 1 120px', background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '16px 18px' }}>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 34, color: GOLD, fontWeight: 300, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: SOFT, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 6 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <button onClick={loadQuestions} disabled={loading} className="vt-btn vt-cta"
              style={{ width: '100%', maxWidth: 520, background: GOLD, color: BG, border: 'none', borderRadius: 3, padding: '20px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: VAULT_BODY, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Loading…' : 'Start the free check  →'}
            </button>
            <div style={{ marginTop: 16, fontSize: 14, color: SOFT }}>
              Already have an account?{' '}
              <span onClick={() => navigate('/login')} style={{ color: GOLD, cursor: 'pointer', borderBottom: `1px solid ${BORDER}` }}>Sign in</span>
            </div>
          </div>

          {/* Right: interactive domain deck */}
          <div className="vt-up vt-d2">
            <div style={{ fontSize: 12, color: SOFT, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>What you will be tested on</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {DOMAINS.map((d, i) => (
                <div key={d.key}
                  className={`vt-domain vt-up vt-d${i + 1} ${openDomain === d.key ? 'on' : ''}`}
                  onClick={() => setOpenDomain(openDomain === d.key ? null : d.key)}
                  style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '0.02em' }}>{d.label}</div>
                      <div className="vt-blurb" style={{ fontSize: 14, color: MUTED, lineHeight: 1.5 }}>{d.blurb}</div>
                    </div>
                    <div style={{ color: GOLD, fontSize: 18, opacity: 0.7 }}>{openDomain === d.key ? '−' : '+'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section style={{ marginTop: 'clamp(48px, 8vw, 96px)' }}>
          <div style={{ fontSize: 12, color: SOFT, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>How it works</div>
          <div className="vt-steps">
            {[
              { n: '01', t: 'Answer 5 questions', d: 'Real situations remote agents face. Tap an answer or use your keyboard.' },
              { n: '02', t: 'See your score',     d: 'Instant results, area by area, with the correct answer for each question.' },
              { n: '03', t: 'Go for the CRSA',    d: 'Ready for more? The full credential adds a 40-question assessment and a live voice simulation.' },
            ].map((s, i) => (
              <div key={i} className={`vt-up vt-d${i + 2}`} style={{ background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '24px 22px' }}>
                <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 40, color: GOLD, fontWeight: 300, lineHeight: 1 }}>{s.n}</div>
                <div style={{ fontSize: 18, fontWeight: 600, margin: '12px 0 8px' }}>{s.t}</div>
                <div style={{ fontSize: 15, color: MUTED, lineHeight: 1.6 }}>{s.d}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>,
    signInBtn
  );

  /* ── QUESTIONS ── */
  if (phase === 'questions' && q) {
    const dom = DOMAINS.find(d => d.key === q.domain);
    return shell(
      <main style={{ flex: 1, padding: 'clamp(24px, 5vw, 56px) 16px 56px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {/* Segmented progress, one segment per domain */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${questions.length}, 1fr)`, gap: 8, marginBottom: 14 }}>
            {questions.map((qq, i) => {
              const done = answers[qq.id] !== undefined;
              const here = i === current;
              return (
                <button key={qq.id} onClick={() => goTo(i)} aria-label={`Go to question ${i + 1}`}
                  style={{ height: 8, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0,
                    background: here ? GOLD : done ? TEAL : BORDER2, opacity: here ? 1 : done ? 0.9 : 1, transition: 'background .2s' }} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'clamp(24px, 4vw, 40px)', fontSize: 13, color: SOFT, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            <span>Question {current + 1} of {questions.length}</span>
            <span style={{ color: GOLD }}>{dom?.label || q.domainLabel}</span>
          </div>

          <div key={animKey} className="vt-in">
            <h2 style={{ fontFamily: VAULT_DISPLAY, fontSize: 'clamp(28px, 3.6vw, 40px)', fontWeight: 400, lineHeight: 1.25, margin: '0 0 clamp(24px, 4vw, 36px)' }}>
              {q.text}
            </h2>

            <div style={{ display: 'grid', gap: 12 }} role="radiogroup" aria-label="Answer options">
              {q.options.map((opt, i) => {
                const sel = answers[q.id] === i;
                return (
                  <div key={i} role="radio" aria-checked={sel} tabIndex={0}
                    onClick={() => selectAnswer(q.id, i)}
                    onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); selectAnswer(q.id, i); } }}
                    className={`vt-opt ${sel ? 'sel' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 18, padding: 'clamp(16px, 2.4vw, 22px) clamp(16px, 2.4vw, 24px)', borderRadius: 4,
                      background: sel ? 'rgba(201,168,76,0.10)' : BG1, border: `1px solid ${sel ? GOLD : BORDER2}` }}>
                    <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 700, color: sel ? BG : GOLD, background: sel ? GOLD : 'transparent', border: `1px solid ${sel ? GOLD : BORDER}` }}>
                      {LETTERS[i]}
                    </div>
                    <div style={{ fontSize: 'clamp(16px, 1.7vw, 19px)', lineHeight: 1.5, color: sel ? WHITE : 'rgba(238,233,223,0.85)' }}>{opt}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nav */}
          <div style={{ display: 'flex', gap: 12, marginTop: 28, alignItems: 'center' }}>
            <button onClick={() => goTo(current - 1)} disabled={current === 0} className="vt-btn"
              style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '16px 22px', fontSize: 13, cursor: current === 0 ? 'default' : 'pointer', opacity: current === 0 ? 0.35 : 1, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: VAULT_BODY }}>
              ← Back
            </button>
            {isLast ? (
              <button onClick={handleSubmit} disabled={!allAnswered || submitting} className="vt-btn"
                style={{ flex: 1, background: allAnswered ? GOLD : BG3, color: allAnswered ? BG : SOFT, border: 'none', borderRadius: 3, padding: '18px 22px', fontSize: 14, fontWeight: 700, cursor: allAnswered ? 'pointer' : 'default', letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: VAULT_BODY }}>
                {submitting ? 'Scoring…' : allAnswered ? 'See my results  →' : `Answer all ${questions.length} to finish`}
              </button>
            ) : (
              <button onClick={() => goTo(current + 1)} disabled={answers[q.id] === undefined} className="vt-btn"
                style={{ flex: 1, background: answers[q.id] !== undefined ? GOLD : BG3, color: answers[q.id] !== undefined ? BG : SOFT, border: 'none', borderRadius: 3, padding: '18px 22px', fontSize: 14, fontWeight: 700, cursor: answers[q.id] !== undefined ? 'pointer' : 'default', letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: VAULT_BODY }}>
                Next question  →
              </button>
            )}
          </div>
          <div className="vt-tip" style={{ marginTop: 18, fontSize: 13, color: SOFT, textAlign: 'center' }}>
            Tip: press <span className="vt-kbd">1</span> to <span className="vt-kbd">4</span> to answer and <span className="vt-kbd">Enter</span> to continue.
          </div>
        </div>
      </main>,
      <span style={{ fontSize: 13, color: SOFT, letterSpacing: '0.1em' }}>{answered}/{questions.length} answered</span>
    );
  }

  /* ── RESULT ── */
  if (phase === 'result' && result) {
    const band = bandFor(result.score, result.total);
    return shell(
      <main style={{ flex: 1, padding: 'clamp(24px, 5vw, 56px) 16px 64px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          {/* Score header */}
          <section className="vt-up" style={{ display: 'flex', gap: 'clamp(20px, 4vw, 48px)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 'clamp(28px, 5vw, 48px)' }}>
            <ScoreRing score={result.score} total={result.total} tone={band.tone} />
            <div style={{ flex: '1 1 320px', minWidth: 260 }}>
              <div style={{ fontSize: 12, color: SOFT, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>Your readiness check</div>
              <h1 style={{ fontFamily: VAULT_DISPLAY, fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 300, lineHeight: 1.05, margin: '0 0 12px', color: band.tone }}>{band.title}</h1>
              <p style={{ fontSize: 'clamp(16px, 1.6vw, 18px)', color: MUTED, lineHeight: 1.65, margin: 0 }}>{band.line}</p>
            </div>
          </section>

          {/* Area by area */}
          <section className="vt-up vt-d1" style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${BORDER2}`, fontSize: 12, color: SOFT, letterSpacing: '0.2em', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
              <span>Area by area</span><span>Tap a row to see the answer</span>
            </div>
            {result.breakdown?.map((item, i) => {
              const qq = questions.find(x => x.id === item.id);
              const open = openRow === i;
              return (
                <div key={i} className="vt-row" onClick={() => setOpenRow(open ? null : i)}
                  style={{ padding: '18px 22px', borderBottom: i < result.breakdown.length - 1 ? `1px solid ${BORDER2}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700,
                      color: item.correct ? TEAL2 : RED, border: `1px solid ${item.correct ? TEAL2 : RED}`, background: item.correct ? 'rgba(34,166,126,0.08)' : 'rgba(196,92,92,0.08)' }}>
                      {item.correct ? '✓' : '✕'}
                    </div>
                    <div style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{item.domain}</div>
                    <div style={{ fontSize: 13, color: item.correct ? TEAL2 : RED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{item.correct ? 'Correct' : 'Review'}</div>
                    <div style={{ color: GOLD, fontSize: 18, width: 16, textAlign: 'center' }}>{open ? '−' : '+'}</div>
                  </div>
                  {open && (
                    <div className="vt-up" style={{ marginTop: 14, marginLeft: 48, fontSize: 15, lineHeight: 1.6 }}>
                      {qq && <div style={{ color: MUTED, marginBottom: 8 }}>{qq.text}</div>}
                      {!item.correct && qq && item.selected !== null && item.selected !== undefined && (
                        <div style={{ color: 'rgba(196,92,92,0.9)', marginBottom: 6 }}>Your answer: {qq.options[item.selected]}</div>
                      )}
                      <div><span style={{ color: GOLD }}>Correct answer: </span>{item.correctText}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* CTA */}
          <section className="vt-up vt-d2" style={{ background: 'linear-gradient(180deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03))', border: `1px solid ${BORDER}`, borderRadius: 4, padding: 'clamp(24px, 4vw, 40px)', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
              <h2 style={{ fontFamily: VAULT_DISPLAY, fontSize: 'clamp(30px, 3.6vw, 42px)', fontWeight: 300, margin: 0 }}>Ready for the real thing?</h2>
              <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 34, color: GOLD, fontWeight: 300 }}>$39, once</div>
            </div>
            <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.7, margin: '0 0 22px', maxWidth: 640 }}>
              The CRSA (Certified Remote Service Agent) covers every core area in depth. Complete both parts to earn a blockchain-verified credential with a public page anyone can check.
            </p>
            <div className="vt-feats" style={{ marginBottom: 24 }}>
              {[
                { t: '40-question assessment', d: 'Every core area of remote CX, in depth.' },
                { t: 'Live voice simulation',  d: 'Handle realistic customer calls out loud.' },
                { t: 'Verifiable credential',  d: 'Share it on LinkedIn and with employers.' },
              ].map((f, i) => (
                <div key={i} style={{ background: 'rgba(8,11,18,0.5)', border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '16px 18px' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{f.t}</div>
                  <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.5 }}>{f.d}</div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate(registerHref)} className="vt-btn vt-cta"
              style={{ width: '100%', background: GOLD, color: BG, border: 'none', borderRadius: 3, padding: '20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: VAULT_BODY }}>
              Create account &amp; get certified  →
            </button>
            <div style={{ marginTop: 14, fontSize: 14, color: SOFT, textAlign: 'center' }}>
              Already have an account?{' '}
              <span onClick={() => navigate('/login')} style={{ color: GOLD, cursor: 'pointer', borderBottom: `1px solid ${BORDER}` }}>Sign in</span>
            </div>
          </section>

          <button onClick={() => { setPhase('intro'); setResult(null); setAnswers({}); setCurrent(0); setSubmitting(false); window.scrollTo({ top: 0 }); }} className="vt-btn"
            style={{ width: '100%', background: 'transparent', color: MUTED, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '15px', fontSize: 13, cursor: 'pointer', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: VAULT_BODY }}>
            Try a new set of questions
          </button>
        </div>
      </main>
    );
  }

  return null;
}
