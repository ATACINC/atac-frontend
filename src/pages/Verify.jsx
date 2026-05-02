import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API from '../api/client';
import brandLogo from '../assets/atac-globalcx-logo-header.png';
import certificateSeal from '../assets/agcx-certificate-seal-cropped.png';

const BG      = '#080B12';
const BG1     = '#0C1018';
const BG2     = '#111722';
const GOLD    = '#C9A84C';
const TEAL    = '#22A67E';
const WHITE   = '#EEE9DF';
const MUTED   = 'rgba(238,233,223,0.62)';
const SOFT    = 'rgba(238,233,223,0.42)';
const BORDER  = 'rgba(201,168,76,0.16)';
const BORDER2 = 'rgba(238,233,223,0.08)';
const RED     = '#E05C52';
const FONT_D  = '"Cormorant Garamond", Georgia, serif';
const FONT_B  = '"Syne", "DM Sans", sans-serif';

const programLabels = {
  CRSA: 'Certified Remote Service Agent (CRSA)',
  'CRSA-M': 'Certified Remote Service Agent — Multilingual (CRSA-M)',
  'CRSA-EM': 'Certified Remote Service Agent — Elite Multilingual (CRSA-EM)',
  CCSS: 'Certified Customer Service Supervisor (CCSS)',
  CCSM: 'Certified Customer Service Manager (CCSM)',
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not listed';
}

function normalizeResult(result) {
  const credentialId = result?.credentialId || result?.credential_id || '';
  const candidateName = result?.candidateName || result?.candidate_name || 'Credential Holder';
  const program = result?.program || 'CRSA';
  const score = result?.score ?? result?.assessmentScore ?? result?.assessment_score;

  return {
    credentialId,
    candidateName,
    program,
    programLabel: programLabels[program] || program,
    issuedAt: result?.issuedAt || result?.issued_at,
    expiresAt: result?.expiresAt || result?.expires_at,
    score,
    status: result?.status || 'Valid',
    valid: result?.valid !== false && String(result?.status || 'valid').toLowerCase() !== 'revoked',
    tokenId: result?.tokenId || result?.token_id,
    txHash: result?.txHash || result?.tx_hash,
  };
}

export default function Verify() {
  const { credentialId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Syne:wght@400;600;700;800&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; background: ${BG}; }
      @keyframes vault-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      .vault-up { animation: vault-up 0.5s ease both; }
      .verify-link:hover { color: ${GOLD}; }
      .verify-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
      @media (max-width: 980px) {
        .verify-hero { grid-template-columns: 1fr !important; }
        .verify-grid { grid-template-columns: 1fr !important; }
        .verify-card { padding: 28px 22px !important; }
        .verify-title { font-size: 50px !important; }
      }
    `;
    document.head.appendChild(style);

    API.get(`/api/credentials/verify/${credentialId}`)
      .then(r => { setResult(r.data); setLoading(false); })
      .catch(() => { setError('Credential not found or invalid.'); setLoading(false); });

    return () => style.remove();
  }, [credentialId]);

  const s = {
    page: {
      minHeight: '100vh',
      background: `radial-gradient(circle at 50% 0%, rgba(201,168,76,0.08), transparent 34%), ${BG}`,
      color: WHITE,
      fontFamily: FONT_B,
      paddingBottom: 70,
    },
    header: {
      height: 92,
      borderBottom: `1px solid ${BORDER2}`,
      background: `linear-gradient(180deg, ${BG1} 0%, rgba(8,11,18,0.92) 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 42px',
    },
    wrap: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '64px 32px 0',
    },
    panel: {
      background: `linear-gradient(145deg, rgba(17,23,34,0.98), rgba(9,12,19,0.98))`,
      border: `1px solid ${BORDER2}`,
      borderRadius: 5,
      boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
    },
    kicker: {
      color: GOLD,
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
    },
    label: {
      color: SOFT,
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
    },
  };

  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard not available');
      }
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback for older browsers, non-HTTPS contexts, or denied clipboard access.
      window.prompt('Copy this verification link:', window.location.href);
    }
  };

  if (loading) return (
    <div style={{ ...s.page, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ color: MUTED, fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Verifying credential...</div>
    </div>
  );

  if (error || !result) return (
    <div style={s.page}>
      <VerifyHeader styles={s} />
      <main style={{ ...s.wrap, maxWidth: 720 }}>
        <div className="vault-up verify-card" style={{ ...s.panel, padding: '52px 46px', textAlign: 'center' }}>
          <div style={{ width: 78, height: 78, borderRadius: '50%', border: `2px solid ${RED}`, color: RED, display: 'grid', placeItems: 'center', margin: '0 auto 24px', fontSize: 34 }}>!</div>
          <div style={s.kicker}>Verification Failed</div>
          <h1 style={{ fontFamily: FONT_D, fontSize: 46, fontWeight: 300, margin: '14px 0 10px' }}>Credential Not Found</h1>
          <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.7, margin: 0 }}>{error || 'This credential ID does not exist or has been revoked.'}</p>
          <a href="/verify" className="verify-btn" style={{ display: 'inline-flex', marginTop: 30, background: GOLD, color: BG, padding: '14px 26px', textDecoration: 'none', borderRadius: 2, fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', transition: '0.18s ease' }}>Try Another ID</a>
        </div>
      </main>
    </div>
  );

  const credential = normalizeResult(result);
  const issueDate = formatDate(credential.issuedAt);
  const expiryDate = formatDate(credential.expiresAt);
  const scoreText = credential.score || credential.score === 0 ? `${credential.score}%` : 'Verified';

  return (
    <div style={s.page}>
      <VerifyHeader styles={s} />

      <main style={s.wrap}>
        <section className="verify-hero vault-up" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) 430px', gap: 30, alignItems: 'stretch' }}>
          <div className="verify-card" style={{ ...s.panel, padding: '46px 50px', borderColor: 'rgba(26,143,105,0.24)', background: 'linear-gradient(135deg, rgba(26,143,105,0.10), rgba(17,23,34,0.98) 45%, rgba(8,11,18,0.98))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,166,126,0.12)', border: '1px solid rgba(34,166,126,0.38)', color: TEAL, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800 }}>V</div>
              <div>
                <div style={{ fontSize: 12, color: TEAL, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Credential Verified</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Blockchain record confirmed by ATAC Global CX.</div>
              </div>
            </div>

            <h1 className="verify-title" style={{ fontFamily: FONT_D, fontSize: 72, lineHeight: 1.02, fontWeight: 300, margin: '0 0 12px', color: WHITE }}>
              {credential.candidateName}
            </h1>
            <div style={{ color: TEAL, fontSize: 18, fontWeight: 800, letterSpacing: '0.04em', marginBottom: 24 }}>{credential.programLabel}</div>
            <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.75, maxWidth: 760, margin: '0 0 30px' }}>
              This public credential confirms that the candidate has passed the ATAC Global CX readiness assessment and holds an active, verifiable certification record.
            </p>

            <div className="verify-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
              <Metric label="Status" value={credential.valid ? 'Valid' : 'Review'} color={credential.valid ? TEAL : RED} />
              <Metric label="Score" value={scoreText} color={TEAL} />
              <Metric label="Issued" value={issueDate.replace(',', '')} />
              <Metric label="Expires" value={expiryDate.replace(',', '')} />
            </div>
          </div>

          <aside className="verify-card" style={{ ...s.panel, padding: 34 }}>
            <div style={{ ...s.kicker, marginBottom: 20 }}>Authority Seal</div>
            <div style={{ background: 'radial-gradient(circle at 50% 45%, rgba(201,168,76,0.14), rgba(0,0,0,0) 58%)', border: `1px solid ${BORDER}`, borderRadius: 4, minHeight: 286, display: 'grid', placeItems: 'center', padding: 22 }}>
              <img src={certificateSeal} alt="ATAC Global CX Certification Authority" style={{ width: 210, height: 210, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${GOLD}`, boxShadow: '0 0 0 6px rgba(201,168,76,0.08), 0 0 56px rgba(201,168,76,0.34)' }} />
            </div>
            <button onClick={copyLink} className="verify-btn" style={{ marginTop: 18, width: '100%', background: GOLD, border: 'none', color: BG, padding: '15px 18px', borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', transition: '0.18s ease' }}>
              {copied ? 'Link Copied' : 'Copy Verification Link'}
            </button>
          </aside>
        </section>

        <section className="verify-grid vault-up" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 430px', gap: 30, marginTop: 30 }}>
          <div style={{ ...s.panel, padding: '34px 38px' }}>
            <div style={{ ...s.kicker, marginBottom: 24 }}>Verification Record</div>
            <RecordRow label="Candidate" value={credential.candidateName} />
            <RecordRow label="Program" value={credential.programLabel} />
            <RecordRow label="Credential ID" value={credential.credentialId} color={GOLD} mono />
            <RecordRow label="Issue Date" value={issueDate} />
            <RecordRow label="Expiry Date" value={expiryDate} />
            <RecordRow label="Assessment Score" value={scoreText} color={TEAL} />
            <RecordRow label="Blockchain Standard" value="ERC-721 verified credential" />
            {credential.tokenId && <RecordRow label="Token ID" value={credential.tokenId} mono />}
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <InfoCard title="For Employers" body="Use this page as independent proof that the candidate completed the assessment and currently holds a valid ATAC Global CX credential." />
            <InfoCard title="For Agents" body="Share this link on resumes, LinkedIn, job applications, and client profiles as a live credential record." />
            <InfoCard title="Verification Notes" body="The credential ID, issue date, expiration date, status, and score are served directly from the ATAC verification system." />
          </div>
        </section>
      </main>
    </div>
  );
}

function VerifyHeader({ styles }) {
  return (
    <header style={styles.header}>
      <a href="https://atacglobalcx.com" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
        <img src={brandLogo} alt="ATAC Global CX" style={{ height: 62, width: 230, objectFit: 'contain', objectPosition: 'left center' }} />
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <a className="verify-link" href="/verify" style={{ color: MUTED, textDecoration: 'none', fontSize: 13, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Verify Another</a>
        <a className="verify-link" href="https://atacglobalcx.com/employers" style={{ color: GOLD, textDecoration: 'none', fontSize: 13, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>For Employers</a>
      </div>
    </header>
  );
}

function Metric({ label, value, color = WHITE }) {
  return (
    <div style={{ background: 'rgba(238,233,223,0.025)', border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '18px 16px', minHeight: 92 }}>
      <div style={{ fontFamily: FONT_D, fontSize: 28, color, lineHeight: 1 }}>{value}</div>
      <div style={{ color: SOFT, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 10 }}>{label}</div>
    </div>
  );
}

function RecordRow({ label, value, color = WHITE, mono = false }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '190px minmax(0,1fr)', gap: 18, alignItems: 'center', borderTop: `1px solid ${BORDER2}`, padding: '17px 0' }}>
      <div style={{ color: SOFT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color, fontSize: 15, fontWeight: 700, wordBreak: 'break-word', fontFamily: mono ? 'Consolas, monospace' : FONT_B }}>{value}</div>
    </div>
  );
}

function InfoCard({ title, body }) {
  return (
    <div style={{ background: BG2, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '24px 26px' }}>
      <div style={{ color: GOLD, fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{body}</p>
    </div>
  );
}
