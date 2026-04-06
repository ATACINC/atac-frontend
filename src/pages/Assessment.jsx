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
  statLbl: { fontSize: 10, color: 'rgba(245,243,238,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }
};

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

  const startAssessment = async () => {
  setLoading(true);

  try {
    // 🔒 Step 1: Verify payment first
    const meRes = await API.get('/api/auth/me');
    const candidateData = meRes.data.candidate || {};

    if (!candidateData.payment_verified) {
      alert('You must complete payment before starting the assessment.');
      navigate('/dashboard');
      return;
    }

    // ✅ Step 2: Use REAL tier from DB
    const tier = candidateData.payment_tier || 'standard';

    const res = await API.post('/api/assessment/start', {
      candidateId: candidate.id,
      program: 'CRSA',
      tier
    });

    setSessionId(res.data.sessionId);
    setAssessmentId(res.data.assessmentId);
    setPhase('assessment');

    localStorage.setItem('atac_session', res.data.sessionId);
    localStorage.setItem('atac_assessment', res.data.assessmentId);

  } catch (err) {
    console.error('Start assessment error:', err);

    if (err.response?.status === 402) {
      alert('Payment required before starting the assessment.');
      navigate('/dashboard');
    } else {
      alert('Failed to start assessment. Please try again.');
    }

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
      setTimeLeft(res.data.timeRemaining);
    } catch (err) {
      if (err.response?.data?.autoSubmit) submitAssessment();
    }
  }, [sessionId, answered]);

  useEffect(() => {
    if (phase === 'assessment' && sessionId) loadQuestion(currentQ);
  }, [phase, sessionId, currentQ]);

  useEffect(() => {
  if (phase !== 'assessment') return;

  let interval = null;

  interval = setInterval(() => {
    setTimeLeft((t) => {
      if (t <= 1) {
        clearInterval(interval);
        setTimeout(() => submitAssessment(), 0);
        return 0;
      }
      return t - 1;
    });
  }, 1000);

  return () => {
    if (interval) clearInterval(interval);
  };
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
      localStorage.setItem('atac_result', JSON.stringify(res.data));
      if (res.data.passed) {
        navigate('/simulator');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      alert('Submission error. Please contact support.');
    }
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const urgent = timeLeft < 120;
  const pct = ((currentQ - 1) / 40) * 100;
  const answeredCount = Object.keys(answered).length;

  if (phase === 'start') return (
    <div style={s.page}>
      <div style={s.startCard}>
        <div style={{ fontSize: 11, color: '#D4A843', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Remote CX Readiness Assessment™</div>
        <div style={s.startTitle}>Certified Remote Service Agent</div>
        <div style={s.startSub}>40 questions across 5 CX domains. 20-minute time limit. Score 70% or higher to pass and proceed to the Call Readiness Simulator™.</div>
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

  if (phase === 'submitting') return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#D4A843', marginBottom: 12 }}>Scoring your assessment...</div>
        <div style={{ fontSize: 14, color: 'rgba(245,243,238,0.5)' }}>Please wait. Do not close this window.</div>
      </div>
    </div>
  );

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
              <button style={s.btnOut} onClick={() => { setCurrentQ(q => Math.max(1, q - 1)); }} disabled={currentQ === 1}>← Previous</button>
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