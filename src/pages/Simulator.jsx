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
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const FAINT = 'rgba(238,233,223,0.04)';
const BORDER  = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';

const VAULT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const VAULT_BODY    = "'Syne', 'DM Sans', sans-serif";

const DIM_COLORS = ['#5DCAA5','#5BA8D4','#C9A84C','#D4537E','#8A7DD4'];
const DIM_NAMES  = ['Greeting','Empathy','Resolution','Tone','Close'];
const DIM_MAXES  = [18,19,19,19,19];

/* ── Keyframe injection ─────────────────────────────────── */
const injectKF = () => {
  if (document.getElementById('vault-sim-kf')) return;
  const s = document.createElement('style');
  s.id = 'vault-sim-kf';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Syne:wght@400;500;600&display=swap');
    @keyframes vault-up   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes live-pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
    @keyframes msg-in     { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .vault-up { animation: vault-up 0.45s ease both; }
    .msg-in   { animation: msg-in 0.3s ease both; }
    .opt-btn:hover { border-color: ${BORDER} !important; background: rgba(201,168,76,0.06) !important; color: ${WHITE} !important; }
    ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.15); }
  `;
  document.head.appendChild(s);
};

export default function Simulator() {
  const navigate   = useNavigate();
  const candidate  = JSON.parse(localStorage.getItem('atac_candidate') || '{}');
  const assessmentId = localStorage.getItem('atac_assessment');

  const [phase,        setPhase]        = useState('briefing');
  const [scenario,     setScenario]     = useState(null);
  const [simSessionId, setSimSessionId] = useState(null);
  const [exchangeIdx,  setExchangeIdx]  = useState(0);
  const [exchange,     setExchange]     = useState(null);
  const [transcript,   setTranscript]   = useState([]);
  const [dimScores,    setDimScores]    = useState([0,0,0,0,0]);
  const [tip,          setTip]          = useState('Read the persona carefully. Start with a warm professional greeting.');
  const [result,       setResult]       = useState(null);
  const [loading,      setLoading]      = useState(false);

  useEffect(() => { injectKF(); assignScenario(); }, []);

  const assignScenario = async () => {
    try {
      const res = await API.post('/api/simulator/assign', { candidateId: candidate.id });
      setScenario(res.data);
      setSimSessionId(res.data.simSessionId);
    } catch { alert('Failed to load simulator. Please try again.'); }
  };

  const startCall = () => { setPhase('call'); loadExchange(0); };

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
    } catch { alert('Failed to complete simulator.'); }
  };

  const issueCredential = async () => {
    setLoading(true);
    try {
      await API.post('/api/credentials/issue', { candidateId: candidate.id, assessmentId, program: 'CRSA' });
      navigate('/dashboard');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to issue credential.');
    } finally { setLoading(false); }
  };

  /* ── Loading ── */
  if (!scenario) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: VAULT_BODY }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 16, color: GOLD, letterSpacing: '0.15em', marginBottom: 8 }}>ATAC Global CX</div>
        <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.2em', textTransform: 'uppercase', animation: 'live-pulse 1.5s infinite' }}>Assigning your scenario…</div>
      </div>
    </div>
  );

  /* ── Shared topbar ── */
  const Topbar = ({ statusLabel, statusColor }) => (
    <div style={{ background: BG3, borderBottom: `1px solid ${BORDER2}`, padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src="/logo.png" alt="ATAC Global CX" style={{ height: 52, objectFit: 'contain' }} />
        <div style={{ width: 1, height: 28, background: BORDER2 }} />
        <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Call Readiness Simulator™</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, animation: 'live-pulse 1.2s infinite', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: statusColor, letterSpacing: '0.1em' }}>{statusLabel}</span>
      </div>
    </div>
  );

  /* ── BRIEFING ── */
  if (phase === 'briefing') return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: VAULT_BODY, color: WHITE }}>
      <Topbar statusLabel="READY" statusColor={TEAL2} />
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '48px 24px' }}>
        <div className="vault-up" style={{ background: BG1, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '36px 36px' }}>

          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 2, height: 16, background: GOLD, borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: GOLD, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              {scenario.scenarioId} · {scenario.industry}
            </span>
          </div>

          {/* Title */}
          <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 28, fontWeight: 300, color: WHITE, marginBottom: 10, lineHeight: 1.2 }}>
            {scenario.title}
          </div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.8, marginBottom: 28 }}>{scenario.situation}</div>

          {/* Persona card */}
          <div style={{ background: 'rgba(196,92,92,0.06)', border: '1px solid rgba(196,92,92,0.2)', borderRadius: 3, padding: '18px 20px', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(196,92,92,0.12)', color: RED, border: '1px solid rgba(196,92,92,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                {scenario.personaInitials}
              </div>
              <div>
                <div style={{ fontSize: 13, color: WHITE }}>{scenario.personaName} · AI Customer</div>
                <div style={{ fontSize: 11, color: RED, marginTop: 2 }}>{scenario.emotion}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic', borderLeft: `2px solid rgba(196,92,92,0.3)`, paddingLeft: 14, lineHeight: 1.6 }}>
              "{scenario.openingQuote}"
            </div>
          </div>

          {/* Role / Objective */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase', paddingTop: 2, flexShrink: 0, width: 70 }}>Your Role</span>
              <span style={{ fontSize: 13, color: WHITE, lineHeight: 1.6 }}>{scenario.yourRole}</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase', paddingTop: 2, flexShrink: 0, width: 70 }}>Objective</span>
              <span style={{ fontSize: 13, color: WHITE, lineHeight: 1.6 }}>{scenario.objective}</span>
            </div>
          </div>

          <button onClick={startCall} style={{ width: '100%', background: GOLD, color: BG, border: 'none', borderRadius: 2, padding: '15px', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: VAULT_BODY }}>
            Begin Call Simulation
          </button>
        </div>
      </div>
    </div>
  );

  /* ── RESULT ── */
  if (phase === 'result') return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: VAULT_BODY, color: WHITE }}>
      <Topbar statusLabel="COMPLETE" statusColor={result?.simPassed ? TEAL2 : RED} />
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '48px 24px' }}>
        <div className="vault-up" style={{ background: BG1, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '36px', textAlign: 'center' }}>

          <div style={{ fontSize: 10, color: GOLD, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24 }}>Post-Call Report</div>

          {/* Score circle */}
          <div style={{ width: 96, height: 96, borderRadius: '50%', border: `2px solid ${result?.simPassed ? TEAL2 : RED}`, margin: '0 auto 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: result?.simPassed ? 'rgba(26,143,105,0.06)' : 'rgba(196,92,92,0.06)' }}>
            <div style={{ fontFamily: VAULT_DISPLAY, fontSize: 34, color: result?.simPassed ? TEAL2 : RED, fontWeight: 300, lineHeight: 1 }}>{result?.simScore}</div>
            <div style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>/ 100</div>
          </div>

          {/* Pass/fail badge */}
          <div style={{ display: 'inline-block', padding: '4px 18px', borderRadius: 1, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', background: result?.simPassed ? 'rgba(26,143,105,0.08)' : 'rgba(196,92,92,0.08)', border: `1px solid ${result?.simPassed ? 'rgba(26,143,105,0.25)' : 'rgba(196,92,92,0.25)'}`, color: result?.simPassed ? TEAL2 : RED, marginBottom: 28 }}>
            {result?.simPassed ? '✓ Passed' : '✗ Not Passed'}
          </div>

          {/* Dimension bars */}
          <div style={{ textAlign: 'left', marginBottom: 28 }}>
            <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>Performance Breakdown</div>
            {DIM_NAMES.map((name, i) => {
              const pct = result?.dimensions ? Object.values(result.dimensions)[i] : 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: MUTED, width: 90, flexShrink: 0 }}>{name}</div>
                  <div style={{ flex: 1, height: 3, background: BORDER2, borderRadius: 2 }}>
                    <div style={{ height: 3, width: `${pct || 0}%`, background: DIM_COLORS[i], borderRadius: 2, transition: 'width 0.8s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, color: WHITE, width: 34, textAlign: 'right' }}>{pct || 0}%</div>
                </div>
              );
            })}
          </div>

          {result?.simPassed ? (
            <button onClick={issueCredential} disabled={loading} style={{ width: '100%', background: GOLD, color: BG, border: 'none', borderRadius: 2, padding: '14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: VAULT_BODY, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Issuing…' : '✓ Issue My Credential — CRSA'}
            </button>
          ) : (
            <button onClick={() => navigate('/dashboard')} style={{ width: '100%', background: 'transparent', color: WHITE, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '13px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: VAULT_BODY }}>
              View Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );

  /* ── ACTIVE CALL ── */
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: VAULT_BODY, color: WHITE }}>
      <Topbar statusLabel={`LIVE · ${scenario.personaName}`} statusColor={RED} />

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 18 }}>

          {/* ── Transcript + input ── */}
          <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, display: 'flex', flexDirection: 'column' }}>

            {/* Scenario label */}
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${BORDER2}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 2, height: 12, background: RED, borderRadius: 1 }} />
              <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{scenario.title}</span>
            </div>

            {/* Messages */}
            <div style={{ padding: '18px 20px', maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              {transcript.map((msg, i) => (
                <div key={i} className="msg-in" style={{ display: 'flex', gap: 10, flexDirection: msg.type === 'customer' ? 'row' : 'row-reverse', animationDelay: `${i * 40}ms` }}>
                  {/* Avatar */}
                  <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, background: msg.type === 'customer' ? 'rgba(196,92,92,0.12)' : 'rgba(26,143,105,0.1)', border: `1px solid ${msg.type === 'customer' ? 'rgba(196,92,92,0.3)' : 'rgba(26,143,105,0.25)'}`, color: msg.type === 'customer' ? RED : TEAL2 }}>
                    {msg.type === 'customer' ? scenario.personaInitials : 'YOU'}
                  </div>
                  <div style={{ maxWidth: '82%' }}>
                    <div style={{ fontSize: 9, color: MUTED, marginBottom: 4, textAlign: msg.type === 'customer' ? 'left' : 'right', letterSpacing: '0.06em' }}>
                      {msg.type === 'customer' ? scenario.personaName : 'You · Agent'}
                    </div>
                    <div style={{ background: msg.type === 'customer' ? 'rgba(196,92,92,0.07)' : 'rgba(26,143,105,0.07)', border: `1px solid ${msg.type === 'customer' ? 'rgba(196,92,92,0.15)' : 'rgba(26,143,105,0.15)'}`, borderRadius: 3, padding: '10px 14px', fontSize: 13, lineHeight: 1.6, color: WHITE }}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Response options */}
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${BORDER2}` }}>
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Select Your Response</div>
              {exchange && exchange.responseOptions?.map((opt, i) => (
                <button key={i} className="opt-btn" onClick={() => respond(i)} style={{ width: '100%', background: FAINT, border: `1px solid ${BORDER2}`, borderRadius: 2, padding: '11px 14px', textAlign: 'left', fontSize: 13, color: 'rgba(238,233,223,0.8)', cursor: 'pointer', marginBottom: 8, lineHeight: 1.5, fontFamily: VAULT_BODY, transition: 'all 0.15s' }}>
                  <span style={{ color: GOLD, marginRight: 8, fontSize: 11 }}>{['A','B','C','D'][i]}</span>{opt}
                </button>
              ))}
              {!exchange && (
                <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '8px 0', animation: 'live-pulse 1.5s infinite' }}>Processing…</div>
              )}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Live score */}
            <div style={{ background: BG1, border: `1px solid ${BORDER2}`, borderRadius: 3, padding: '16px' }}>
              <div style={{ fontSize: 9, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>Live Score</div>
              {DIM_NAMES.map((name, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: MUTED, width: 72, flexShrink: 0 }}>{name}</div>
                  <div style={{ flex: 1, height: 3, background: BORDER2, borderRadius: 2 }}>
                    <div style={{ height: 3, width: `${Math.round((dimScores[i] / DIM_MAXES[i]) * 100)}%`, background: DIM_COLORS[i], borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Persona reminder */}
            <div style={{ background: 'rgba(196,92,92,0.05)', border: '1px solid rgba(196,92,92,0.18)', borderRadius: 3, padding: '14px' }}>
              <div style={{ fontSize: 9, color: RED, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>Customer</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(196,92,92,0.12)', color: RED, border: '1px solid rgba(196,92,92,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, flexShrink: 0 }}>
                  {scenario.personaInitials}
                </div>
                <div style={{ fontSize: 12, color: WHITE }}>{scenario.personaName}</div>
              </div>
              <div style={{ fontSize: 11, color: MUTED }}>{scenario.emotion}</div>
            </div>

            {/* Coaching tip */}
            <div style={{ background: 'rgba(201,168,76,0.05)', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '14px' }}>
              <div style={{ fontSize: 9, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>Coaching Tip</div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{tip}</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}