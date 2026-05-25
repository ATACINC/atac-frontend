import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import CharterCounter from '../components/CharterCounter';

/* ── Vault Design Tokens ─────────────────────────────────── */
const BG    = '#080B12';
const BG1   = '#0C1018';
const BG3   = '#141B26';
const GOLD  = '#C9A84C';
const TEAL  = '#1A8F69';
const TEAL2 = '#22A67E';
const RED   = '#C45C5C';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const FAINT = 'rgba(238,233,223,0.04)';
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';

const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const API_BASE = 'https://atac-backend-production.up.railway.app';

const injectKF = () => {
  if (document.getElementById('vault-trial-kf')) return;
  const s = document.createElement('style');
  s.id = 'vault-trial-kf';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Syne:wght@400;500;600&display=swap');
    @keyframes vault-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes vault-in { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
    .vault-up { animation: vault-up 0.45s ease both; }
    .vault-in { animation: vault-in 0.35s ease both; }
    .opt-hover:hover { border-color: ${BORDER} !important; background: rgba(201,168,76,0.05) !important; cursor: pointer; }
    .opt-hover:hover .opt-letter { color: ${GOLD} !important; border-color: rgba(201,168,76,0.4) !important; }
    ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.15); }
  `;
  document.head.appendChild(s);
};

/* ── Phase: intro | questions | result ── */
export default function Trial() {
  const navigate = useNavigate();
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

  useEffect(() => { injectKF(); }, []);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/trial/questions`);
      const data = await res.json();
      setQuestions(data.questions || []);
      setSessionKey(data.sessionKey || '');
      setPhase('questions');
      setCurrent(0);
      setAnswers({});
    } catch {
      showToast('Failed to load questions. Please try again.', true);
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (qId, optIdx) => {
    setAnswers(prev => ({ ...prev, [qId]: optIdx }));
  };

  const goNext = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
      setAnimKey(k => k + 1);
    }
  };

  const goPrev = () => {
    if (current > 0) {
      setCurrent(c => c - 1);
      setAnimKey(k => k + 1);
    }
  };

  const handleSubmit = async () => {
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
      setResult(data);
      setPhase('result');
    } catch {
      showToast('Submission failed. Please try again.', true);
      setSubmitting(false);
    }
  };

  const answered  = Object.keys(answers).length;
  const q         = questions[current] || null;
  const allAnswered = answered === questions.length && questions.length > 0;
  const letters   = ['A','B','C','D'];

  /* ── INTRO ── */
  if (phase === 'intro') return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: VAULT_BODY, color: WHITE, display: 'flex', flexDirection: 'column' }}>

      {/* Topbar */}
      <div style={{ background: BG3, borderBottom: `1px solid ${BORDER2}`, padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src="/logo.png" alt="ATAC Global CX" style={{ height: 40, objectFit: 'contain' }} />
        <button onClick={() => navigate('/login')} style={{ background: 'none', border: `1px solid ${BORDER2}`, color: MUTED, borderRadius: 2, padding: '6px 14px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em' }}>
          Sign In
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 560, width: '100%' }} className="vault-up">

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 16 }}>Free Trial</div>
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 42, fontWeight: 300, lineHeight: 1.1, marginBottom: 14 }}>
              5 Questions.<br />See Where You Stand.
            </div>
            <div style={{ width: 40, height: 1, background: GOLD, opacity: 0.3, margin: '0 auto 20px' }} />
            <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.8, maxWidth: 420, margin: '0 auto' }}>
              Answer 5 professional CX questions, one from each competency domain. No account required. See your score instantly.
            </div>
          </div>

          {/* Domain pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 36 }}>
            {['Professionalism','Communication','CX Operations','Technology','Health & Safety'].map((d, i) => (
              <div key={i} style={{ fontSize: 10, padding: '5px 14px', background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 1, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { val: '5',    lbl: 'Questions'  },
              { val: '~3',   lbl: 'Minutes'    },
              { val: 'Free', lbl: 'No Payment' },
            ].map((s, i) => (
              <div key={i} style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '16px 0', textAlign: 'center' }}>
                <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, color: GOLD, fontWeight: 300 }}>{s.val}</div>
                <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 4 }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          <CharterCounter variant="full" />

          <button
            onClick={loadQuestions}
            disabled={loading}
            style={{ width: '100%', background: GOLD, color: BG, border: 'none', borderRadius: 2, padding: '16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: VAULT_BODY, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Loading…' : 'Start Free Trial'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 12, color: MUTED }}>Already have an account? </span>
            <span onClick={() => navigate('/login')} style={{ fontSize: 12, color: GOLD, cursor: 'pointer', borderBottom: `1px solid ${BORDER}` }}>Sign in</span>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── QUESTIONS ── */
  if (phase === 'questions' && q) return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: VAULT_BODY, color: WHITE, display: 'flex', flexDirection: 'column' }}>

      {/* Topbar */}
      <div style={{ background: BG3, borderBottom: `1px solid ${BORDER2}`, padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src="/logo.png" alt="ATAC Global CX" style={{ height: 40, objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {questions.map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: answers[questions[i]?.id] !== undefined ? GOLD : i === current ? WHITE : BORDER2, transition: 'all 0.2s' }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>{answered}/5 answered</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: BORDER2 }}>
        <div style={{ height: 2, width: `${(answered / 5) * 100}%`, background: GOLD, transition: 'width 0.3s' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ maxWidth: 640, width: '100%' }}>

          <div key={animKey} className="vault-in">

            {/* Domain + number */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 2, height: 14, background: GOLD, borderRadius: 1 }} />
                <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{q.domain}</span>
              </div>
              <span style={{ fontFamily: VAULT_DISPLAY, fontSize: 20, color: MUTED, fontWeight: 300 }}>
                <span style={{ color: GOLD }}>{current + 1}</span> / 5
              </span>
            </div>

            {/* Question */}
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 22, fontWeight: 400, lineHeight: 1.5, color: WHITE, marginBottom: 32 }}>
              {q.text}
            </div>

            <div style={{ height: 1, background: BORDER2, marginBottom: 24 }} />

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {q.options.map((opt, i) => {
                const selected = answers[q.id] === i;
                return (
                  <div key={i}
                    className="opt-hover"
                    onClick={() => selectAnswer(q.id, i)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: selected ? 'rgba(201,168,76,0.08)' : FAINT, border: `1px solid ${selected ? BORDER : BORDER2}`, borderRadius: 2, padding: '15px 18px', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div className="opt-letter" style={{ width: 26, height: 26, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: VAULT_DISPLAY, fontSize: 14, border: `1px solid ${selected ? GOLD : BORDER2}`, color: selected ? GOLD : MUTED, borderRadius: 2, transition: 'all 0.15s' }}>
                      {letters[i]}
                    </div>
                    <div style={{ fontSize: 14, color: selected ? WHITE : 'rgba(238,233,223,0.8)', lineHeight: 1.6, paddingTop: 2 }}>
                      {opt}
                    </div>
                    {selected && (
                      <div style={{ marginLeft: 'auto', flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: BG, fontSize: 10, fontWeight: 700 }}>✓</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, paddingTop: 24, borderTop: `1px solid ${BORDER2}` }}>
              <button onClick={goPrev} disabled={current === 0} style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '10px 20px', fontSize: 11, cursor: current === 0 ? 'not-allowed' : 'pointer', opacity: current === 0 ? 0.3 : 1, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: VAULT_BODY }}>
                ← Prev
              </button>

              {current < 4 ? (
                <button onClick={goNext} style={{ background: answers[q.id] !== undefined ? GOLD : FAINT, color: answers[q.id] !== undefined ? BG : MUTED, border: `1px solid ${answers[q.id] !== undefined ? GOLD : BORDER2}`, borderRadius: 2, padding: '10px 24px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: VAULT_BODY, transition: 'all 0.2s' }}>
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!allAnswered || submitting}
                  style={{ background: allAnswered ? GOLD : FAINT, color: allAnswered ? BG : MUTED, border: `1px solid ${allAnswered ? GOLD : BORDER2}`, borderRadius: 2, padding: '10px 24px', fontSize: 11, fontWeight: 600, cursor: allAnswered ? 'pointer' : 'not-allowed', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: VAULT_BODY, transition: 'all 0.2s' }}>
                  {submitting ? 'Scoring…' : 'See My Results'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── RESULT ── */
  if (phase === 'result' && result) return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: VAULT_BODY, color: WHITE, display: 'flex', flexDirection: 'column' }}>

      {/* Topbar */}
      <div style={{ background: BG3, borderBottom: `1px solid ${BORDER2}`, padding: '12px 28px' }}>
        <img src="/logo.png" alt="ATAC Global CX" style={{ height: 40, objectFit: 'contain' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 600, width: '100%' }} className="vault-up">

          {/* Score */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>Your Trial Result</div>
            <div style={{ width: 100, height: 100, borderRadius: '50%', margin: '0 auto 20px', border: `2px solid ${result.passed ? TEAL2 : AMBER}`, background: result.passed ? 'rgba(26,143,105,0.07)' : 'rgba(196,138,42,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 38, color: result.passed ? TEAL2 : GOLD, fontWeight: 300, lineHeight: 1 }}>{result.score}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>/ 5</div>
            </div>
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, fontWeight: 300, color: WHITE, marginBottom: 8 }}>
              {result.percentage}% Correct
            </div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>
              {result.message}
            </div>
          </div>

          {/* Breakdown */}
          <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '20px 24px', marginBottom: 28 }}>
            <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 16 }}>Question Breakdown</div>
            {result.breakdown?.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < result.breakdown.length - 1 ? 14 : 0, marginBottom: i < result.breakdown.length - 1 ? 14 : 0, borderBottom: i < result.breakdown.length - 1 ? `1px solid ${BORDER2}` : 'none' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: item.correct ? 'rgba(26,143,105,0.1)' : 'rgba(196,92,92,0.1)', border: `1px solid ${item.correct ? 'rgba(26,143,105,0.3)' : 'rgba(196,92,92,0.3)'}`, color: item.correct ? TEAL2 : RED }}>
                  {item.correct ? '✓' : '✗'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{item.domain}</div>
                  {!item.correct && (
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
                      <span style={{ color: GOLD }}>Correct answer: </span>{item.correctText}
                    </div>
                  )}
                  {item.correct && (
                    <div style={{ fontSize: 12, color: TEAL2 }}>Correct</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA — paywall */}
          <div style={{ background: 'rgba(201,168,76,0.05)', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '24px', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 24, fontWeight: 300, color: WHITE, marginBottom: 8 }}>
              Get Your Full Assessment
            </div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 20 }}>
              The full 40-question Remote CX Readiness Assessment covers all 5 domains in depth. Pass and receive your blockchain-verified credential. Any employer worldwide can verify it.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { tier: 'Standard', price: '$39', copy: '40-question assessment + blockchain credential + PDF certificate' },
                { tier: 'Pro',      price: '$59', copy: 'Everything in Standard + gap analysis + CRSA program credit' },
              ].map((p, i) => (
                <div key={i} style={{ background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '16px' }}>
                  <div style={{ fontSize: 11, color: WHITE, marginBottom: 4 }}>{p.tier}</div>
                  <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 26, color: GOLD, fontWeight: 300, marginBottom: 8 }}>{p.price}</div>
                  <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>{p.copy}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/login?action=register')}
              style={{ width: '100%', background: GOLD, color: BG, border: 'none', borderRadius: 2, padding: '15px', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: VAULT_BODY }}>
              Create Account & Get Certified
            </button>
            <div style={{ marginTop: 12 }}>
              <span style={{ fontSize: 12, color: MUTED }}>Already have an account? </span>
              <span onClick={() => navigate('/login')} style={{ fontSize: 12, color: GOLD, cursor: 'pointer', borderBottom: `1px solid ${BORDER}` }}>Sign in</span>
            </div>
          </div>

          <button onClick={() => { setPhase('intro'); setResult(null); setAnswers({}); setCurrent(0); }} style={{ width: '100%', background: 'transparent', color: MUTED, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '11px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: VAULT_BODY }}>
            Retake Trial
          </button>

        </div>
      </div>
    </div>
  );

  return null;
}

const AMBER = '#C48A2A';
