import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API from '../api/client';

const BG      = '#080B12';
const CARD    = '#0C1018';
const GOLD    = '#C9A84C';
const TEAL    = '#22A67E';
const WHITE   = '#EEE9DF';
const MUTED   = 'rgba(238,233,223,0.45)';
const BORDER  = 'rgba(201,168,76,0.15)';
const FONT_D  = '"Cormorant Garamond", Georgia, serif';

export default function Verify() {
  const { credentialId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Syne:wght@400;600&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: ${BG}; }
      @keyframes vault-up { from { opacity:0; transform:translateY(16px);} to { opacity:1; transform:translateY(0);} }
      .vault-up { animation: vault-up 0.5s ease forwards; }
    `;
    document.head.appendChild(style);

    API.get(`/api/credentials/verify/${credentialId}`)
      .then(r => { setResult(r.data); setLoading(false); })
      .catch(() => { setError('Credential not found or invalid.'); setLoading(false); });
  }, [credentialId]);

  const s = {
    page: { minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '"Syne", sans-serif' },
    card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '48px 40px', maxWidth: 560, width: '100%' },
    logo: { fontFamily: FONT_D, fontSize: 22, color: GOLD, letterSpacing: '0.05em', marginBottom: 32, textAlign: 'center' },
    badge: { width: 64, height: 64, borderRadius: '50%', background: `rgba(34,166,126,0.15)`, border: `2px solid ${TEAL}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' },
    check: { fontSize: 28, color: TEAL },
    title: { fontFamily: FONT_D, fontSize: 28, fontWeight: 300, color: WHITE, textAlign: 'center', marginBottom: 8 },
    sub: { fontSize: 12, color: MUTED, textAlign: 'center', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 32 },
    divider: { borderTop: `1px solid ${BORDER}`, margin: '24px 0' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    label: { fontSize: 11, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' },
    value: { fontSize: 13, color: WHITE, fontWeight: 500 },
    validBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(34,166,126,0.1)', border: `1px solid rgba(34,166,126,0.3)`, borderRadius: 2, padding: '3px 10px', fontSize: 11, color: TEAL, letterSpacing: '0.1em', textTransform: 'uppercase' },
    footer: { marginTop: 32, textAlign: 'center', fontSize: 11, color: MUTED },
    errorTitle: { fontFamily: FONT_D, fontSize: 24, color: WHITE, textAlign: 'center', marginBottom: 8 },
    errorSub: { fontSize: 13, color: MUTED, textAlign: 'center' },
  };

  if (loading) return (
    <div style={s.page}>
      <div style={{ color: MUTED, fontSize: 13 }}>Verifying credential...</div>
    </div>
  );

  if (error || !result) return (
    <div style={s.page}>
      <div style={{ ...s.card, ...{ className: 'vault-up' } }}>
        <div style={s.logo}>ATAC Global CX</div>
        <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>✗</div>
        <div style={s.errorTitle}>Credential Not Found</div>
        <div style={s.errorSub}>{error || 'This credential ID does not exist or has been revoked.'}</div>
      </div>
    </div>
  );

  const issueDate = result.issuedAt ? new Date(result.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  const expiryDate = result.expiresAt ? new Date(result.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  return (
    <div style={s.page}>
      <div style={s.card} className="vault-up">
        <div style={s.logo}>ATAC Global CX</div>

        <div style={s.badge}>
          <span style={s.check}>✓</span>
        </div>

        <div style={s.title}>Verified Credential</div>
        <div style={s.sub}>Blockchain-Verified · ERC-721</div>

        <div style={s.divider} />

        <div style={s.row}>
          <span style={s.label}>Candidate</span>
          <span style={s.value}>{result.candidateName || result.candidate_name || '—'}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Program</span>
          <span style={s.value}>{result.program || 'CRSA'}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Credential ID</span>
          <span style={{ ...s.value, color: GOLD, fontSize: 12 }}>{result.credentialId || result.credential_id}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Issue Date</span>
          <span style={s.value}>{issueDate}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Expiry Date</span>
          <span style={s.value}>{expiryDate}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Status</span>
          <span style={s.validBadge}>✓ Valid</span>
        </div>
        {result.score && (
          <div style={s.row}>
            <span style={s.label}>Assessment Score</span>
            <span style={{ ...s.value, color: TEAL }}>{result.score}%</span>
          </div>
        )}

        <div style={s.divider} />

        <div style={s.footer}>
          Issued by ATAC Global CX · Minted on the blockchain<br />
          <span style={{ color: GOLD, marginTop: 4, display: 'block' }}>atacglobalcx.com</span>
        </div>
      </div>
    </div>
  );
}