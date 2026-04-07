import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/client';

const s = {
  page: { minHeight: '100vh', background: '#0D1B2E', fontFamily: 'DM Sans, sans-serif', color: '#F5F3EE' },
  header: { background: '#122238', borderBottom: '1px solid rgba(212,168,67,0.18)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: 'Georgia, serif', fontSize: 15, color: '#D4A843' },
  timer: (urgent) => ({ fontFamily: 'Georgia, serif', fontSize: 22, color: urgent ? '#E24B4A' : '#D4A843' }),
  progress: { height: 3, background: 'rgba(255,255,255,0.08)' },
  fill: (pct) => ({ height: 3, width: pct + '%', background: '#D4A843', transition: 'width 0.4s ease' }),
  body: { maxWidth: 680, margin: '0 auto', padding: '40px 24px' },
  eyebrow: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#D4A843', marginBottom: 12 },
  question: { fontFamily: 'Georgia, serif', fontSize: 22, lineHeight: 1.5, marginBottom: 32, color: '#F5F3EE' },
  option: (selected) => ({ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px', background: selected ? 'rgba(212,168,67,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selected ? '#D4A843' : 'rgba(245,243,238,0.1)'}`, borderRadius: 8, cursor: 'pointer', marginBottom: 10, fontSize: 14, lineHeight: 1.5, color: '#F5F3EE', transition: 'all 0.18s' }),
  letter: { width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(245,243,238,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, marginTop: 1 },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32 },
  btnGold: { background: '#D4A843', color: '#0D1B2E', border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' },
  btnOut: { background: 'transparent', color: '#F5F3EE', border: '1px solid rgba(245,243,238,0.2)', borderRadius: 6, padding: '10px 20px', fontSize: 13, cursor: 'pointer' },
  counter: { fontSize: 12, color: 'rgba(245,243,238,0.5)' },
  startCard: { maxWidth: 560, margin: '80px auto', background: '#122238', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 12, padding: '40px 36px', textAlign: 'center' },
  startTitle: { fontFamily: 'Georgia, serif', fontSize: 28, color: '#F5F3EE', marginBottom: 12 },
  startSub: { fontSize: 14, color: 'rgba(245,243,238,0.55)', lineHeight: 1.7, marginBottom: 28 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 },
  stat: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,243,238,0.1)', borderRadius: 8, padding: '14px 10px', textAlign: 'center' },
  statNum: { fontFamily: 'Georgia, serif', fontSize: 24, color: '#D4A843' },
  statLbl: { fontSize: 10, color: 'rgba(245,243,238,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 },
};

const DIM_COLORS = { professionalism: '#5DCAA5', communication: '#378ADD', cx_operations: '#D4A843', technology: '#D4537E', health_safety: '#7F77DD', remote_work: '#26B589' };
const DIM_LABELS = { professionalism: 'Professionalism', communication: 'Communication', cx_operations: 'CX Operations', technology: 'Technology', health_safety: 'Health & Safety', remote_work: 'Remote Work Setup' };
const LETTERS = ['A', 'B', 'C', 'D'];

export default function Assessment() {
  const navigate = useNavigate();
  const candidate = JSON.parse(localStorage.getItem('atac_candidate') || '{}');
  const [phase, setPhase] = useState('start');
  const [sessionId, setSessionId] = useState(null);
  const [assessmentId, setAssessmentId] = useState(null);
  const [currentQ, setCurrentQ] = useState(1);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState({});
  const [timeLeft, setTimeLeft] = useState(1200);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const startAssessment = async () => {
    setLoading(true);
    try {
      const meRes = await API.get('/api/auth/me');
      const candidateData = meRes.data.candidate || {};

      if (!candidateData.payment_verified) {
        alert('You must complete payment before starting the assessment.');
        navigate('/payment');
        return;
      }

      const tier        = candidateData.payment_tier || 'standard';
      const candidateId = candidateData.id || candidate.id;

      const res = await API.post('/api/assessment/start', {
        candidateId,
        program: 'CRSA',
        tier
      });

      if (!res.data || !res.data.sessionId) {
        throw new Error('Invalid session response from server');
      }

      setSessionId(res.data.sessionId);
      setAssessmentId(res.data.assessmentId);
      setPhase('assessment');

      localStorage.setItem('atac_session',    res.data.sessionId);
      localStorage.setItem('atac_assessment', res.data.assessmentId);

    } catch (err) {
      console.error('Start assessment error:', err);
      alert(err?.response?.data?.error || err?.message || 'Failed to start assessment. Please try again.');
      if (err?.response?.status === 402) navigate('/payment');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestion = useCallback(async (qNum) => {
    if (!sessionId) return;
    try {
      const res = await API.get(`/api/assessment/question/${sessionId}/${qNum}`);
      setQuestion(res.data);
      setSelected(answered[qNum] ?? null);
      setTimeLeft(res.data.timeRemaining ?? res.data.secondsLeft ?? timeLeft);
    } catch (err) {
      if (err.response?.data?.autoSubmit) submitAssessment();
    }
  }, [sessionId, answered]);

  useEffect(() => {
    if (phase === 'assessment' && sessionId) loadQuestion(currentQ);
  }, [phase, sessionId, currentQ]);

  useEffect(() => {
    if (phase !== 'assessment') return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setTimeout(() => submitAssessment(), 0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const selectOption = async (idx) => {
    setSelected(idx);
    setAnswered(prev => ({ ...prev, [currentQ]: idx }));
    try {
      await API.post('/api/assessment/answer', { sessionId, questionNum: currentQ, selectedOption: idx });
    } catch (err) { console.error('Answer save error', err); }
  };

  const submitAssessment = async () => {
    setPhase('submitting');
    try {
      const sid = sessionId || localStorage.getItem('atac_session');
      const res = await API.post('/api/assessment/submit', { sessionId: sid });
      // Store result and show results screen — never skip directly to simulator
      localStorage.setItem('atac_result', JSON.stringify(res.data));
      setResult(res.data);
      setPhase('results');
    } catch (err) {
      alert('Submission error. Please contact support.');
      setPhase('assessment');
    }
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const urgent = timeLeft < 120;
  const pct = ((currentQ - 1) / 40) * 100;
  const answeredCount = Object.keys(answered).length;

  // ── START SCREEN ────────────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={s.page}>
      <div style={{ ...s.startCard }}>
        <div style={{ fontSize: 11, color: '#D4A843', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Remote CX Readiness Assessment™</div>
        <div style={s.startTitle}>Certified Remote Service Agent</div>
        <div style={s.startSub}>40 questions across 5 CX domains. 20-minute time limit. Score 70% or higher to pass and proceed to the ATAC Call Readiness Simulator™.</div>
        <div style={s.statsRow}>
          <div style={s.stat}><div style={s.statNum}>40</div><div style={s.statLbl}>Questions</div></div>
          <div style={s.stat}><div style={s.statNum}>20</div><div style={s.statLbl}>Minutes</div></div>
          <div style={s.stat}><div style={s.statNum}>70%</div><div style={s.statLbl}>Pass Mark</div></div>
        </div>
        <button style={s.btnGold} onClick={startAssessment} disabled={loading}>
          {loading ? 'Starting...' : 'Begin Assessment'}
        </button>
      </div>
    </div>
  );

  // ── SUBMITTING SCREEN ────────────────────────────────────────────────────────
  if (phase === 'submitting') return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#D4A843', marginBottom: 12 }}>Scoring your assessment...</div>
        <div style={{ fontSize: 14, color: 'rgba(245,243,238,0.5)' }}>Please wait. Do not close this window.</div>
      </div>
    </div>
  );

  // ── RESULTS SCREEN ───────────────────────────────────────────────────────────
  if (phase === 'results' && result) {
    const passed     = result.passed;
    const score      = result.score ?? 0;
    const outOf      = result.outOf ?? 40;
    const percentage = result.percentage ?? Math.round((score / outOf) * 100);
    const dimensions = result.dimensions || {};
    const passColor  = passed ? '#1D9E75' : '#E24B4A';
    const passColor2 = passed ? '#26B589' : '#E24B4A';

    return (
      <div style={s.page}>
        <div style={{ ...s.header }}>
          <div style={s.brand}>ATAC Global CX — Assessment Results</div>
          <div style={{ fontSize: 12, color: 'rgba(245,243,238,0.5)' }}>CRSA · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        </div>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '40px 24px' }}>

          {/* Score circle */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 110, height: 110, borderRadius: '50%', border: `4px solid ${passColor}`, margin: '0 auto 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 34, color: passColor2, lineHeight: 1 }}>{percentage}%</div>
              <div style={{ fontSize: 10, color: 'rgba(245,243,238,0.5)', marginTop: 2 }}>{score}/{outOf}</div>
            </div>
            <div style={{ display: 'inline-block', padding: '5px 18px', borderRadius: 20, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: passed ? 'rgba(29,158,117,0.12)' : 'rgba(226,75,74,0.12)', border: `1px solid ${passed ? 'rgba(29,158,117,0.35)' : 'rgba(226,75,74,0.35)'}`, color: passColor2, marginBottom: 10 }}>
              {passed ? '✓ Assessment Passed' : '✗ Not Passed — Retake Required'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(245,243,238,0.5)', marginTop: 6 }}>
              {passed
                ? 'Well done. You qualify to proceed to the ATAC Call Readiness Simulator™.'
                : `Pass threshold is 70% (28/40). You scored ${score}/40. Purchase a retake to try again.`}
            </div>
          </div>

          {/* Dimension breakdown */}
          <div style={{ background: '#122238', border: '1px solid rgba(245,243,238,0.09)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#D4A843', marginBottom: 16 }}>Performance by Dimension</div>
            {Object.entries(dimensions).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'rgba(245,243,238,0.55)', width: 170, flexShrink: 0 }}>{DIM_LABELS[key] || key}</div>
                <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: 5, width: val + '%', background: DIM_COLORS[key] || '#D4A843', borderRadius: 3, transition: 'width 0.6s ease' }}></div>
                </div>
                <div style={{ fontSize: 12, color: '#F5F3EE', width: 36, textAlign: 'right' }}>{val}%</div>
              </div>
            ))}
          </div>

          {/* Score summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 28 }}>
            <div style={s.stat}><div style={s.statNum}>{score}</div><div style={s.statLbl}>Correct</div></div>
            <div style={s.stat}><div style={s.statNum}>{percentage}%</div><div style={s.statLbl}>Score</div></div>
            <div style={s.stat}><div style={{ ...s.statNum, fontSize: 18, color: passColor2, paddingTop: 4 }}>{passed ? 'PASS' : 'FAIL'}</div><div style={s.statLbl}>Result</div></div>
          </div>

          {/* CTA */}
          <div style={{ textAlign: 'center' }}>
            {passed ? (
              <div>
                <div style={{ fontSize: 13, color: 'rgba(245,243,238,0.5)', marginBottom: 16 }}>
                  Next step: Complete the ATAC Call Readiness Simulator™ to earn your CRSA credential.
                </div>
                <button style={s.btnGold} onClick={() => navigate('/simulator')}>
                  Continue to Simulator →
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: 'rgba(245,243,238,0.5)', marginBottom: 16 }}>
                  Review your weak dimensions above before retaking. Each retake requires a new payment.
                </div>
                <button style={s.btnGold} onClick={() => navigate('/payment')}>
                  Purchase Retake
                </button>
                <button style={{ ...s.btnOut, marginLeft: 10 }} onClick={() => navigate('/dashboard')}>
                  View Dashboard
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ── ASSESSMENT SCREEN ────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.brand}>ATAC Global CX — Assessment</div>
        <div style={{ fontSize: 12, color: 'rgba(245,243,238,0.5)' }}>{answeredCount}/40 answered</div>
        <div style={s.timer(urgent)}>{mins}:{String(secs).padStart(2, '0')}</div>
      </div>
      <div style={s.progress}><div style={s.fill(pct)}></div></div>
      <div style={s.body}>
        {question ? (
          <>
            <div style={s.eyebrow}>Question {currentQ} of 40 · {question.domain?.replace('_', ' ').toUpperCase()}</div>
            <div style={s.question}>{question.text}</div>
            <div>
              {question.options?.map((opt, i) => (
                <div key={i} style={s.option(selected === i)} onClick={() => selectOption(i)}>
                  <div style={s.letter}>{LETTERS[i]}</div>
                  <span>{opt}</span>
                </div>
              ))}
            </div>
            <div style={s.nav}>
              <button style={s.btnOut} onClick={() => setCurrentQ(q => Math.max(1, q - 1))} disabled={currentQ === 1}>← Previous</button>
              <div style={s.counter}>{answeredCount} of 40 answered</div>
              {currentQ < 40
                ? <button style={s.btnGold} onClick={() => setCurrentQ(q => q + 1)}>Next →</button>
                : <button style={s.btnGold} onClick={submitAssessment}>Submit Assessment</button>
              }
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'rgba(245,243,238,0.5)', paddingTop: 60 }}>Loading question...</div>
        )}
      </div>
    </div>
  );
}