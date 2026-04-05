import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/client';

const s = {
  page: { minHeight: '100vh', background: '#0D1B2E', fontFamily: 'DM Sans, sans-serif', color: '#F5F3EE' },
  header: { background: '#122238', borderBottom: '1px solid rgba(212,168,67,0.18)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: 'Georgia, serif', fontSize: 15, color: '#D4A843' },
  badge: { fontSize: 11, color: '#26B589', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 20, padding: '4px 12px' },
  body: { maxWidth: 860, margin: '0 auto', padding: '32px 24px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20 },
  card: { background: '#122238', border: '1px solid rgba(245,243,238,0.09)', borderRadius: 8 },
  transcript: { padding: '16px 20px', maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 },
  msgCust: { display: 'flex', gap: 8 },
  msgAgent: { display: 'flex', gap: 8, flexDirection: 'row-reverse' },
  avatarCust: { width: 28, height: 28, borderRadius: '50%', background: 'rgba(226,75,74,0.2)', color: '#E24B4A', border: '1px solid rgba(226,75,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 },
  avatarAgent: { width: 28, height: 28, borderRadius: '50%', background: 'rgba(29,158,117,0.15)', color: '#26B589', border: '1px solid rgba(29,158,117,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 },
  bubbleCust: { background: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.15)', borderRadius: 8, padding: '9px 13px', fontSize: 13, lineHeight: 1.6, maxWidth: '85%' },
  bubbleAgent: { background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 8, padding: '9px 13px', fontSize: 13, lineHeight: 1.6, maxWidth: '85%' },
  sender: { fontSize: 10, color: 'rgba(245,243,238,0.5)', marginBottom: 3 },
  inputArea: { padding: '14px 20px', borderTop: '1px solid rgba(245,243,238,0.09)', background: '#0D1B2E', borderRadius: '0 0 8px 8px' },
  optBtn: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,243,238,0.1)', borderRadius: 6, padding: '10px 14px', textAlign: 'left', fontSize: 13, color: '#F5F3EE', cursor: 'pointer', marginBottom: 8, lineHeight: 1.4, fontFamily: 'DM Sans, sans-serif', transition: 'all 0.18s' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: 12 },
  sideCard: { background: '#122238', border: '1px solid rgba(245,243,238,0.09)', borderRadius: 8, padding: '14px 16px' },
  eyebrow: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#D4A843', marginBottom: 10 },
  dimRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  dimName: { fontSize: 11, color: 'rgba(245,243,238,0.5)', width: 110, flexShrink: 0 },
  dimTrack: { flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2 },
  dimFill: (pct, col) => ({ height: 4, width: pct + '%', background: col, borderRadius: 2, transition: 'width 0.6s ease' }),
  tipBox: { background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.18)', borderRadius: 6, padding: '10px 12px' },
  tipLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#D4A843', marginBottom: 4 },
  tipText: { fontSize: 11, color: 'rgba(245,243,238,0.6)', lineHeight: 1.5 },
  briefCard: { maxWidth: 600, margin: '60px auto', background: '#122238', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 12, padding: '36px 32px' },
  briefTitle: { fontFamily: 'Georgia, serif', fontSize: 24, marginBottom: 8 },
  briefSub: { fontSize: 13, color: 'rgba(245,243,238,0.55)', lineHeight: 1.7, marginBottom: 20 },
  personaBox: (col) => ({ background: col + '10', border: `1px solid ${col}25`, borderRadius: 8, padding: '14px 16px', marginBottom: 20 }),
  btnGold: { background: '#D4A843', color: '#0D1B2E', border: 'none', borderRadius: 6, padding: '13px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' },
  resultCard: { maxWidth: 600, margin: '60px auto', background: '#122238', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 12, padding: '36px 32px', textAlign: 'center' },
};

const DIM_COLORS = ['#5DCAA5', '#378ADD', '#D4A843', '#D4537E', '#7F77DD'];
const DIM_NAMES = ['Greeting', 'Empathy', 'Resolution', 'Tone', 'Close'];
const DIM_MAXES = [18, 19, 19, 19, 19];

export default function Simulator() {
  const navigate = useNavigate();
  const candidate = JSON.parse(localStorage.getItem('atac_candidate') || '{}');
  const assessmentId = localStorage.getItem('atac_assessment');
  const [phase, setPhase] = useState('briefing');
  const [scenario, setScenario] = useState(null);
  const [simSessionId, setSimSessionId] = useState(null);
  const [exchangeIdx, setExchangeIdx] = useState(0);
  const [exchange, setExchange] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [dimScores, setDimScores] = useState([0, 0, 0, 0, 0]);
  const [tip, setTip] = useState('Read the persona carefully. Start with a warm professional greeting.');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    assignScenario();
  }, []);

  const assignScenario = async () => {
    try {
      const res = await API.post('/api/simulator/assign', { candidateId: candidate.id });
      setScenario(res.data);
      setSimSessionId(res.data.simSessionId);
    } catch (err) { alert('Failed to load simulator. Please try again.'); }
  };

  const startCall = async () => {
    setPhase('call');
    loadExchange(0);
  };

  const loadExchange = async (idx) => {
    try {
      const res = await API.get(`/api/simulator/exchange/${simSessionId}/${idx}`);
      setExchange(res.data);
      setTranscript(prev => [...prev, { type: 'customer', text: res.data.customerText, initials: scenario.personaInitials }]);
    } catch (err) { console.error('Exchange load error', err); }
  };

  const respond = async (responseIdx) => {
    try {
      const res = await API.post('/api/simulator/respond', {
        simSessionId, exchangeIndex: exchangeIdx, selectedResponseIndex: responseIdx
      });
      const selectedText = exchange.responseOptions[responseIdx];
      setTranscript(prev => [...prev, { type: 'agent', text: selectedText }]);
      setTip(res.data.tip);

      if (res.data.isLastExchange) {
        setTimeout(() => completeSimulator(), 1000);
      } else {
        const nextIdx = exchangeIdx + 1;
        setExchangeIdx(nextIdx);
        setTimeout(() => loadExchange(nextIdx), 800);
      }
    } catch (err) { console.error('Respond error', err); }
  };

  const completeSimulator = async () => {
    try {
      const res = await API.post('/api/simulator/complete', { simSessionId, assessmentId });
      setResult(res.data);
      setPhase('result');
    } catch (err) { alert('Failed to complete simulator.'); }
  };

  const issueCredential = async () => {
    setLoading(true);
    try {
      await API.post('/api/credentials/issue', {
        candidateId: candidate.id, assessmentId, program: 'CRSA'
      });
      navigate('/dashboard');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to issue credential.');
    } finally { setLoading(false); }
  };

  if (!scenario) return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(245,243,238,0.5)', fontSize: 14 }}>Assigning your scenario...</div>
    </div>
  );

  if (phase === 'briefing') return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.brand}>ATAC Call Readiness Simulator™</div>
        <div style={s.badge}>● Live Session</div>
      </div>
      <div style={s.body}>
        <div style={s.briefCard}>
          <div style={{ fontSize: 11, color: '#D4A843', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>{scenario.scenarioId} · {scenario.industry}</div>
          <div style={s.briefTitle}>{scenario.title}</div>
          <div style={s.briefSub}>{scenario.situation}</div>
          <div style={s.personaBox('#E24B4A')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(226,75,74,0.2)', color: '#E24B4A', border: '1px solid rgba(226,75,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{scenario.personaInitials}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{scenario.personaName} · AI Customer</div>
                <div style={{ fontSize: 11, color: 'rgba(226,75,74,0.7)' }}>{scenario.emotion}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(245,243,238,0.6)', fontStyle: 'italic', borderLeft: '2px solid rgba(226,75,74,0.3)', paddingLeft: 12 }}>"{scenario.openingQuote}"</div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(245,243,238,0.5)', marginBottom: 8 }}><strong style={{ color: '#F5F3EE' }}>Your role:</strong> {scenario.yourRole}</div>
          <div style={{ fontSize: 12, color: 'rgba(245,243,238,0.5)', marginBottom: 24 }}><strong style={{ color: '#F5F3EE' }}>Objective:</strong> {scenario.objective}</div>
          <button style={s.btnGold} onClick={startCall}>Begin Call Simulation</button>
        </div>
      </div>
    </div>
  );

  if (phase === 'result') return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.brand}>ATAC Call Readiness Simulator™</div>
        <div style={s.badge}>● Complete</div>
      </div>
      <div style={s.body}>
        <div style={s.resultCard}>
          <div style={{ fontSize: 11, color: '#D4A843', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>Post-Call Report</div>
          <div style={{ width: 90, height: 90, borderRadius: '50%', border: `3px solid ${result?.simPassed ? '#1D9E75' : '#E24B4A'}`, margin: '0 auto 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: result?.simPassed ? '#26B589' : '#E24B4A' }}>{result?.simScore}</div>
            <div style={{ fontSize: 10, color: 'rgba(245,243,238,0.5)' }}>/ 100</div>
          </div>
          <div style={{ display: 'inline-block', padding: '4px 16px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: result?.simPassed ? 'rgba(29,158,117,0.1)' : 'rgba(226,75,74,0.1)', border: `1px solid ${result?.simPassed ? 'rgba(29,158,117,0.3)' : 'rgba(226,75,74,0.3)'}`, color: result?.simPassed ? '#26B589' : '#E24B4A', marginBottom: 20 }}>
            {result?.simPassed ? '✓ Passed' : '✗ Not Passed'}
          </div>
          <div style={{ textAlign: 'left', marginBottom: 24 }}>
            {DIM_NAMES.map((name, i) => {
              const pct = result?.dimensions ? Object.values(result.dimensions)[i] : 0;
              return (
                <div key={i} style={s.dimRow}>
                  <div style={s.dimName}>{name}</div>
                  <div style={s.dimTrack}><div style={s.dimFill(pct || 0, DIM_COLORS[i])}></div></div>
                  <div style={{ fontSize: 11, color: '#F5F3EE', width: 32, textAlign: 'right' }}>{pct || 0}%</div>
                </div>
              );
            })}
          </div>
          {result?.simPassed ? (
            <button style={s.btnGold} onClick={issueCredential} disabled={loading}>
              {loading ? 'Issuing...' : '✓ Issue My Credential — CRSA'}
            </button>
          ) : (
            <button style={s.btnGold} onClick={() => navigate('/dashboard')}>View Dashboard</button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.brand}>ATAC Call Readiness Simulator™</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#E24B4A' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#E24B4A', animation: 'pulse 1s infinite' }}></div>
          Live · {scenario.personaName}
        </div>
      </div>
      <div style={s.body}>
        <div style={s.grid}>
          <div>
            <div style={s.card}>
              <div style={s.transcript}>
                {transcript.map((msg, i) => (
                  <div key={i} style={msg.type === 'customer' ? s.msgCust : s.msgAgent}>
                    <div style={msg.type === 'customer' ? s.avatarCust : s.avatarAgent}>
                      {msg.type === 'customer' ? scenario.personaInitials : 'YOU'}
                    </div>
                    <div>
                      <div style={s.sender}>{msg.type === 'customer' ? scenario.personaName : 'You · Agent'}</div>
                      <div style={msg.type === 'customer' ? s.bubbleCust : s.bubbleAgent}>{msg.text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={s.inputArea}>
                {exchange && exchange.responseOptions?.map((opt, i) => (
                  <button key={i} style={s.optBtn} onClick={() => respond(i)}
                    onMouseEnter={e => e.target.style.borderColor = '#D4A843'}
                    onMouseLeave={e => e.target.style.borderColor = 'rgba(245,243,238,0.1)'}
                  >{opt}</button>
                ))}
                {!exchange && <div style={{ textAlign: 'center', color: 'rgba(245,243,238,0.4)', fontSize: 13 }}>Processing...</div>}
              </div>
            </div>
          </div>
          <div style={s.sidebar}>
            <div style={s.sideCard}>
              <div style={s.eyebrow}>Live Score</div>
              {DIM_NAMES.map((name, i) => (
                <div key={i} style={s.dimRow}>
                  <div style={s.dimName}>{name}</div>
                  <div style={s.dimTrack}><div style={s.dimFill(Math.round((dimScores[i] / DIM_MAXES[i]) * 100), DIM_COLORS[i])}></div></div>
                </div>
              ))}
            </div>
            <div style={s.tipBox}>
              <div style={s.tipLabel}>Coaching Tip</div>
              <div style={s.tipText}>{tip}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}