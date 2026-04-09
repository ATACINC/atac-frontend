/**
 * ATAC Global CX — Candidate Dashboard
 * Final merged version
 * Premium "Vault" design + resilient live data mapping
 * File: src/pages/CandidateDashboard.jsx
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'https://atac-backend-production.up.railway.app';
const POLYGONSCAN = 'https://polygonscan.com/tx/';

const C = {
  bg: '#080B12',
  bg1: '#0C1018',
  bg2: '#101520',
  bg3: '#141B26',
  gold: '#C9A84C',
  gold2: '#D4B86A',
  goldDim: 'rgba(201,168,76,0.10)',
  goldBorder: 'rgba(201,168,76,0.18)',
  teal: '#1A8F69',
  teal2: '#22B589',
  tealDim: 'rgba(26,143,105,0.10)',
  red: '#E05C52',
  amber: '#D4851A',
  white: '#EEE9DF',
  muted: 'rgba(238,233,223,0.45)',
  faint: 'rgba(238,233,223,0.06)',
  ghost: 'rgba(238,233,223,0.03)',
  border: 'rgba(201,168,76,0.15)',
  border2: 'rgba(238,233,223,0.07)',
};

const F = {
  display: "'Cormorant Garamond','Times New Roman',serif",
  body: "'Syne','DM Sans',sans-serif",
};

const DIM_COLORS = ['#22B589', '#5B9BD5', '#C9A84C', '#D4537E', '#9B8FD4', '#26B589'];
const DIM_LABELS = ['Professionalism', 'Communication', 'CX Operations', 'Technology', 'Health & Safety', 'Remote Work'];
const DIM_KEYS = ['professionalism', 'communication', 'cx_operations', 'technology', 'health_safety', 'remote_work'];

function getToken() {
  return localStorage.getItem('atac_token') || '';
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function pickFirst(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function normalizeCredential(raw) {
  if (!raw || typeof raw !== 'object') return null;

  return {
    credential_id: pickFirst(raw.credential_id, raw.credentialId, raw.id),
    program: pickFirst(raw.program, raw.program_code, raw.code, 'CRSA'),
    issued_at: pickFirst(raw.issued_at, raw.issuedAt, raw.created_at, raw.issue_date),
    expires_at: pickFirst(raw.expires_at, raw.expiresAt, raw.expiry_date, raw.expiration_date),
    status: pickFirst(raw.status, raw.credential_status, 'active'),
    tx_hash: pickFirst(raw.tx_hash, raw.txHash, raw.blockchain_hash, raw.transaction_hash),
    token_id: pickFirst(raw.token_id, raw.tokenId, raw.nft_token_id),
    wallet_address: pickFirst(raw.wallet_address, raw.walletAddress, raw.blockchain_wallet),
    verify_url: pickFirst(raw.verify_url, raw.verifyUrl),
    holder_name: pickFirst(raw.holder_name, raw.name),
    raw,
  };
}

function normalizeAssessment(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const nestedDims =
    raw.dim_scores ||
    raw.dimensions ||
    raw.dimension_scores ||
    raw.dimensionScores ||
    raw.scores_by_dimension ||
    raw.breakdown ||
    {};

  return {
    score: pickFirst(raw.score, raw.total_score, raw.correct_answers, raw.correct, raw.points),
    percentage: pickFirst(raw.percentage, raw.score_percentage, raw.percent, raw.final_percentage),
    duration_minutes: pickFirst(raw.duration_minutes, raw.duration, raw.duration_mins, raw.time_minutes),
    passed:
      raw.passed !== undefined
        ? raw.passed
        : raw.status
          ? String(raw.status).toLowerCase() === 'passed'
          : raw.result
            ? String(raw.result).toLowerCase() === 'passed'
            : null,
    completed_at: pickFirst(raw.completed_at, raw.completedAt, raw.updated_at, raw.finished_at),
    credential_id: pickFirst(raw.credential_id, raw.credentialId),
    dim_scores: {
      professionalism: pickFirst(nestedDims.professionalism, nestedDims.Professionalism),
      communication: pickFirst(nestedDims.communication, nestedDims.Communication),
      cx_operations: pickFirst(nestedDims.cx_operations, nestedDims.cxOperations, nestedDims['cx operations'], nestedDims.operations),
      technology: pickFirst(nestedDims.technology, nestedDims.Technology),
      health_safety: pickFirst(nestedDims.health_safety, nestedDims.healthSafety, nestedDims['health & safety'], nestedDims.healthAndSafety),
      remote_work: pickFirst(nestedDims.remote_work, nestedDims.remoteWork, nestedDims['remote work']),
    },
    raw,
  };
}

function findActiveCredential(payload) {
  const all = toArray(payload).map(normalizeCredential).filter(Boolean);
  if (!all.length) return null;

  return (
    all.find((x) => ['active', 'valid', 'issued'].includes(String(x.status || '').toLowerCase())) ||
    all[0]
  );
}

function findBestAssessment(payload, credentialId) {
  const all = toArray(payload).map(normalizeAssessment).filter(Boolean);
  if (!all.length) return null;

  if (credentialId) {
    const exact = all.find((x) => x.credential_id && x.credential_id === credentialId);
    if (exact) return exact;
  }

  return all[0];
}

export default function CandidateDashboard() {
  const navigate = useNavigate();

  const [tab, setTab] = useState('overview');
  const [cred, setCred] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', err: false });

  const showToast = useCallback((msg, err = false) => {
    setToast({ show: true, msg, err });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate('/login');
      return;
    }

    (async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [profileRes, credRes, assessmentRes] = await Promise.all([
          fetch(`${API_BASE}/api/auth/me`, { headers }),
          fetch(`${API_BASE}/api/credentials/my`, { headers }),
          fetch(`${API_BASE}/api/assessment/my-results`, { headers }),
        ]);

        if (profileRes.status === 401) {
          navigate('/login');
          return;
        }

        const profileJson = await profileRes.json().catch(() => ({}));
        const credJson = await credRes.json().catch(() => null);
        const assessmentJson = await assessmentRes.json().catch(() => null);

        const normalizedCred = findActiveCredential(credJson);
        const normalizedAssessment = findBestAssessment(
          assessmentJson,
          normalizedCred?.credential_id || null
        );

        setCandidate(profileJson || null);
        setCred(normalizedCred);
        setAssessment(normalizedAssessment);
      } catch (err) {
        console.error('Candidate dashboard load failed:', err);
        showToast('Could not load dashboard data.', true);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, showToast]);

  const candidateName = candidate?.name || cred?.holder_name || 'Candidate';
  const candidateEmail = candidate?.email || '';
  const programCode = cred?.program || 'CRSA';
  const programFull =
    programCode === 'CRSA'
      ? 'Certified Remote Service Agent (CRSA)'
      : programCode === 'CCSA'
        ? 'Certified Customer Service Agent (CCSA)'
        : programCode === 'CCCA'
          ? 'Certified Contact Center Agent (CCCA)'
          : programCode === 'CRSS'
            ? 'Certified Remote Service Supervisor (CRSS)'
            : programCode;

  const score = pickFirst(
    assessment?.score,
    assessment?.raw?.score,
    assessment?.raw?.total_score
  );

  const percentage = pickFirst(
    assessment?.percentage,
    assessment?.raw?.percentage,
    assessment?.raw?.score_percentage
  );

  const duration = pickFirst(
    assessment?.duration_minutes,
    assessment?.raw?.duration_minutes,
    assessment?.raw?.duration
  );

  const passed = assessment?.passed;
  const txShort = cred?.tx_hash
    ? `${cred.tx_hash.slice(0, 6)}…${cred.tx_hash.slice(-4)}`
    : 'Verifying…';

  const verifyUrl = cred?.credential_id
    ? `atacglobalcx.com/verify/${cred.credential_id}`
    : 'atacglobalcx.com/verify';

  const polygonUrl = cred?.tx_hash ? `${POLYGONSCAN}${cred.tx_hash}` : null;

  const dimScores = useMemo(() => {
    const source = assessment?.dim_scores || {};
    const normalized = {};

    DIM_KEYS.forEach((key) => {
      const val = source[key];
      if (val === undefined || val === null || val === '') {
        normalized[key] = null;
        return;
      }

      const n = Number(val);
      normalized[key] = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
    });

    return normalized;
  }, [assessment]);

  const downloadCertificate = async () => {
    if (!cred?.credential_id) {
      showToast('No credential found.', true);
      return;
    }

    setDownloading(true);

    try {
      const res = await fetch(`${API_BASE}/api/certificate-embedded/${cred.credential_id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) {
        showToast('Could not generate certificate.', true);
        return;
      }

      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');

      if (!win) {
        showToast('Allow pop-ups to download.', true);
      } else {
        showToast('Certificate opened — File > Print > Save as PDF');
      }

      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Certificate download failed:', err);
      showToast('Network error.', true);
    } finally {
      setDownloading(false);
    }
  };

  const addToLinkedIn = () => {
    const id = cred?.credential_id || '';
    const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
      'Certified Remote Service Agent (CRSA)'
    )}&organizationName=${encodeURIComponent(
      'ATAC Global CX'
    )}&certUrl=${encodeURIComponent(`https://atacglobalcx.com/verify/${id}`)}&certId=${id}`;

    window.open(url, '_blank');
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(`https://${verifyUrl}`);
      showToast('Verification URL copied');
    } catch {
      showToast('Could not copy link.', true);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: F.body,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: C.muted,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          Loading…
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes vault-up { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes vault-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        .vt:hover { color: rgba(238,233,223,.7)!important }
        .vbtn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(201,168,76,.2) }
        .vgh:hover { border-color: rgba(201,168,76,.3)!important; color: #C9A84C!important }
        .vstep:hover { background: rgba(201,168,76,.04)!important }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: F.body, color: C.white }}>
        <div
          style={{
            background: C.bg3,
            borderBottom: `1px solid ${C.border}`,
            padding: '0 32px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                fontFamily: F.display,
                fontSize: 16,
                fontWeight: 500,
                color: C.gold,
                letterSpacing: '0.08em',
              }}
            >
              ATAC Global CX
            </div>
            <div style={{ width: 1, height: 16, background: C.border }} />
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: C.muted,
              }}
            >
              Candidate Portal
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: C.white, fontFamily: F.display }}>
                {candidateName}
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>{candidateEmail}</div>
            </div>

            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: C.goldDim,
                border: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: F.display,
                fontSize: 14,
                color: C.gold,
              }}
            >
              {initials(candidateName)}
            </div>

            <button
              onClick={() => {
                localStorage.clear();
                navigate('/login');
              }}
              style={{
                background: 'none',
                border: `1px solid ${C.border2}`,
                borderRadius: 3,
                padding: '5px 12px',
                fontSize: 10,
                color: C.muted,
                cursor: 'pointer',
                fontFamily: F.body,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {cred && (
          <div
            style={{
              background: 'linear-gradient(90deg,rgba(26,143,105,0.08) 0%,transparent 100%)',
              borderBottom: '1px solid rgba(26,143,105,0.15)',
              padding: '11px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              animation: 'vault-up 0.6s ease both',
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: C.teal2,
                animation: 'vault-pulse 2s infinite',
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 11, color: C.teal2, letterSpacing: '0.06em' }}>
              Credential minted on blockchain ·{' '}
              <span style={{ fontFamily: F.display, fontSize: 13 }}>{cred.credential_id}</span>
            </div>
            <div
              style={{
                marginLeft: 'auto',
                fontSize: 10,
                color: C.muted,
                letterSpacing: '0.06em',
              }}
            >
              Issued {fmtDate(cred.issued_at)} · Verify at atacglobalcx.com/verify
            </div>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 300px',
            maxWidth: 1160,
            margin: '0 auto',
            padding: '32px',
            gap: 24,
          }}
        >
          <div style={{ animation: 'vault-up 0.6s ease 0.1s both' }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.border2}`, marginBottom: 28 }}>
              {['overview', 'credentials', 'pathway'].map((t) => (
                <button
                  key={t}
                  className="vt"
                  onClick={() => setTab(t)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: `1px solid ${tab === t ? C.gold : 'transparent'}`,
                    padding: '10px 20px',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: tab === t ? C.gold : C.muted,
                    cursor: 'pointer',
                    fontFamily: F.body,
                    transition: 'all 0.2s',
                    marginBottom: -1,
                  }}
                >
                  {t === 'pathway' ? 'Upgrade Path' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: C.gold,
                    marginBottom: 16,
                  }}
                >
                  Assessment Results — {programCode} · {fmtDate(assessment?.completed_at || cred?.issued_at)}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4,1fr)',
                    gap: 10,
                    marginBottom: 28,
                  }}
                >
                  {[
                    { num: score ?? '—', lbl: 'Score / 40', pass: false },
                    {
                      num: percentage != null ? `${percentage}%` : '—',
                      lbl: 'Percentage',
                      pass: true,
                    },
                    {
                      num: duration != null ? `${duration}m` : '—',
                      lbl: 'Duration',
                      pass: false,
                    },
                    {
                      num:
                        passed === true ? 'PASS' : passed === false ? 'FAIL' : cred ? 'VALID' : '—',
                      lbl: 'Status',
                      pass: passed === true || !!cred,
                    },
                  ].map((card, i) => (
                    <div
                      key={i}
                      style={{
                        background: C.bg1,
                        border: `1px solid ${card.pass ? C.border : C.border2}`,
                        borderRadius: 4,
                        padding: '16px 14px',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: F.display,
                          fontSize: 28,
                          fontWeight: 300,
                          color: card.pass ? C.teal2 : C.white,
                          lineHeight: 1,
                          marginBottom: 6,
                        }}
                      >
                        {card.num}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                          color: C.muted,
                        }}
                      >
                        {card.lbl}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    height: 1,
                    background: `linear-gradient(90deg,${C.gold} 0%,transparent 60%)`,
                    marginBottom: 24,
                    opacity: 0.25,
                  }}
                />

                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: C.gold,
                    marginBottom: 16,
                  }}
                >
                  Performance by Dimension
                </div>

                <div style={{ marginBottom: 28 }}>
                  {DIM_KEYS.map((key, i) => {
                    const pct = dimScores[key];

                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: C.muted,
                            width: 150,
                            flexShrink: 0,
                          }}
                        >
                          {DIM_LABELS[i]}
                        </div>

                        <div
                          style={{
                            flex: 1,
                            height: 3,
                            background: 'rgba(238,233,223,0.05)',
                            borderRadius: 2,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: 3,
                              width: `${pct ?? 0}%`,
                              background: DIM_COLORS[i],
                              borderRadius: 2,
                              transition: 'width 1s ease',
                            }}
                          />
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: C.white,
                            width: 42,
                            textAlign: 'right',
                            fontFamily: F.display,
                            fontWeight: 300,
                          }}
                        >
                          {pct != null ? `${pct}%` : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {cred && (
                  <div
                    style={{
                      background: C.bg1,
                      border: `1px solid ${C.border2}`,
                      borderRadius: 4,
                      padding: '16px 20px',
                      marginBottom: 28,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 11, color: C.muted }}>Valid until</div>
                      <div
                        style={{
                          fontSize: 12,
                          color: C.white,
                          fontFamily: F.display,
                          fontWeight: 300,
                        }}
                      >
                        {fmtDate(cred.expires_at)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: C.muted }}>Status</div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '0.14em',
                          color: C.teal2,
                          textTransform: 'uppercase',
                        }}
                      >
                        {String(cred.status || 'active').toUpperCase()}
                      </div>
                    </div>

                    <div
                      style={{
                        height: 2,
                        background: 'rgba(238,233,223,0.04)',
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ height: 2, width: '4%', background: C.gold, borderRadius: 1 }} />
                    </div>
                  </div>
                )}

                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: C.gold,
                    marginBottom: 16,
                  }}
                >
                  Next Steps
                </div>

                {[
                  {
                    num: '01',
                    title: 'Download your certificate',
                    desc: 'Your signed PDF includes your credential ID, blockchain hash, and QR code.',
                    action: downloadCertificate,
                    cta: downloading ? 'Generating…' : 'Download PDF →',
                  },
                  {
                    num: '02',
                    title: 'Add CRSA to LinkedIn',
                    desc: 'Share your blockchain-verified credential as a professional certification.',
                    action: addToLinkedIn,
                    cta: 'Share on LinkedIn →',
                  },
                  {
                    num: '03',
                    title: 'Upgrade to CCSA — $129',
                    desc: 'Your Pro assessment credit is waiting. Apply it toward the next designation.',
                    action: () => showToast('Loading upgrade options…'),
                    cta: 'Claim credit →',
                  },
                ].map((step, i) => (
                  <div
                    key={i}
                    className="vstep"
                    onClick={step.action}
                    style={{
                      display: 'flex',
                      gap: 16,
                      padding: '14px 16px',
                      background: C.bg1,
                      border: `1px solid ${C.border2}`,
                      borderRadius: 4,
                      marginBottom: 8,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: F.display,
                        fontSize: 20,
                        fontWeight: 300,
                        color: C.gold,
                        opacity: 0.5,
                        flexShrink: 0,
                        lineHeight: 1,
                        paddingTop: 2,
                      }}
                    >
                      {step.num}
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.white, marginBottom: 4 }}>
                        {step.title}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, marginBottom: 8 }}>
                        {step.desc}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: C.teal2,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {step.cta}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {tab === 'credentials' && (
              <>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: C.gold,
                    marginBottom: 20,
                  }}
                >
                  Issued Credentials
                </div>

                {cred ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '16px 20px',
                      background: C.bg1,
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: C.teal2,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: C.white,
                          fontFamily: F.display,
                          fontWeight: 400,
                          marginBottom: 3,
                        }}
                      >
                        {programFull}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted }}>
                        {cred.credential_id} · {fmtDate(cred.issued_at)} → {fmtDate(cred.expires_at)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: '0.14em',
                        color: C.teal2,
                        background: 'rgba(26,143,105,0.1)',
                        border: '1px solid rgba(26,143,105,0.2)',
                        borderRadius: 2,
                        padding: '3px 8px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Valid
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: C.muted }}>No credentials issued yet.</div>
                )}

                {[
                  { label: 'Certified Customer Service Agent (CCSA)', price: '$129 with credit', op: 0.4 },
                  { label: 'Certified Contact Center Agent (CCCA)', price: '$179', op: 0.28 },
                  { label: 'Certified Remote Service Supervisor', price: '$249', op: 0.18 },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '16px 20px',
                      background: C.bg1,
                      border: `1px solid ${C.border2}`,
                      borderRadius: 4,
                      marginBottom: 8,
                      opacity: item.op,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: C.border2,
                        border: `1px solid ${C.border2}`,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: C.muted,
                          fontFamily: F.display,
                          fontWeight: 400,
                        }}
                      >
                        {item.label}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                        Not yet earned · {item.price}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: C.muted,
                        border: `1px solid ${C.border2}`,
                        borderRadius: 2,
                        padding: '3px 8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Locked
                    </div>
                  </div>
                ))}
              </>
            )}

            {tab === 'pathway' && (
              <>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: C.gold,
                    marginBottom: 8,
                  }}
                >
                  Certification Pathway
                </div>

                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.8, marginBottom: 24 }}>
                  Your full pathway to senior designation — each credential builds on the last.
                </div>

                {[
                  {
                    num: '01',
                    label: 'CRSA — Certified Remote Service Agent',
                    sub: `Completed · ${fmtDate(cred?.issued_at)} · Score ${percentage ?? '—'}%`,
                    done: true,
                  },
                  {
                    num: '02',
                    label: 'CCSA — Certified Customer Service Agent · $129',
                    sub: '$20 credit applied. Psychology, service recovery, product knowledge.',
                    done: false,
                    cta: 'Enrol with credit →',
                  },
                  {
                    num: '03',
                    label: 'CRSS — Supervisor Designation · $249',
                    sub: 'Remote QA, coaching at a distance, workforce management.',
                    done: false,
                    dim: true,
                  },
                  {
                    num: '04',
                    label: 'CCSM — Certified Customer Service Manager · $349',
                    sub: 'ISO-aligned. Leadership, HR, CX program design.',
                    done: false,
                    dim: true,
                  },
                ].map((step, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 20,
                      padding: '16px 20px',
                      background: step.done ? 'rgba(26,143,105,0.04)' : C.bg1,
                      border: `1px solid ${step.done ? 'rgba(26,143,105,0.2)' : C.border2}`,
                      borderRadius: 4,
                      marginBottom: 8,
                      opacity: step.dim ? 0.4 : 1,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: F.display,
                        fontSize: 22,
                        fontWeight: 300,
                        color: step.done ? C.teal2 : C.gold,
                        opacity: step.done ? 1 : 0.45,
                        flexShrink: 0,
                        lineHeight: 1,
                        paddingTop: 3,
                      }}
                    >
                      {step.done ? '✓' : step.num}
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          color: step.done ? C.teal2 : C.white,
                          fontFamily: F.display,
                          fontWeight: 400,
                          marginBottom: 4,
                        }}
                      >
                        {step.label}
                      </div>

                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{step.sub}</div>

                      {step.cta && (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: C.teal2,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            marginTop: 8,
                            cursor: 'pointer',
                          }}
                          onClick={() => showToast('Loading enrolment…')}
                        >
                          {step.cta}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div style={{ animation: 'vault-up 0.6s ease 0.2s both' }}>
            {cred && (
              <div
                style={{
                  background: '#F8F5ED',
                  border: '1px solid #D4C89A',
                  borderRadius: 4,
                  padding: '22px',
                  marginBottom: 16,
                  color: '#1A1208',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    borderBottom: '1px solid #E0D5B0',
                    paddingBottom: 12,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 8,
                        fontWeight: 600,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: '#8A7040',
                      }}
                    >
                      ATAC Global CX · Verified
                    </div>
                    <div
                      style={{
                        fontFamily: F.display,
                        fontSize: 12,
                        color: '#3D2E0A',
                        marginTop: 2,
                        fontWeight: 500,
                      }}
                    >
                      Certificate of Achievement
                    </div>
                  </div>

                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: '#0D1B2E',
                      border: '1.5px solid #C9A84C',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg viewBox="0 0 14 14" fill="none" width="11" height="11">
                      <polygon
                        points="7,1 8.8,5 13,5 9.7,7.8 10.9,12 7,9.6 3.1,12 4.3,7.8 1,5 5.2,5"
                        stroke="#C9A84C"
                        strokeWidth="0.8"
                        fill="none"
                      />
                    </svg>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: '#8A7040',
                      marginBottom: 5,
                    }}
                  >
                    Proudly Presented To
                  </div>
                  <div
                    style={{
                      fontFamily: F.display,
                      fontSize: 20,
                      fontStyle: 'italic',
                      color: '#1A1208',
                      marginBottom: 3,
                    }}
                  >
                    {candidateName}
                  </div>
                  <div style={{ fontSize: 10, color: '#1A8F69', fontWeight: 600 }}>{programFull}</div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    borderTop: '1px solid #E0D5B0',
                    paddingTop: 10,
                    marginBottom: 10,
                  }}
                >
                  {[
                    { k: 'Credential ID', v: cred.credential_id || '—' },
                    { k: 'Issue Date', v: fmtDate(cred.issued_at) },
                    { k: 'Status', v: 'Valid', green: true },
                    { k: 'Expires', v: fmtDate(cred.expires_at) },
                  ].map((row, i) => (
                    <div key={i}>
                      <div
                        style={{
                          fontSize: 8,
                          fontWeight: 600,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: '#8A7040',
                        }}
                      >
                        {row.k}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: row.green ? '#1A8F69' : '#1A1208',
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        {row.v}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    borderTop: '1px solid #E0D5B0',
                    paddingTop: 10,
                  }}
                >
                  <div style={{ fontSize: 8, color: '#8A7040' }}>
                    <div>Verify at</div>
                    <div style={{ fontWeight: 600, color: '#3D2E0A', fontSize: 9 }}>atacglobalcx.com/verify</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        width: 60,
                        height: 1,
                        background: '#8A7040',
                        marginBottom: 3,
                        marginLeft: 'auto',
                      }}
                    />
                    <div style={{ fontSize: 9, color: '#3D2E0A', fontWeight: 600 }}>Tugreofia Smith</div>
                    <div style={{ fontSize: 8, color: '#8A7040' }}>CEO & Lead Instructor</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px solid #E0D5B0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#1A8F69' }} />
                  <div style={{ fontSize: 8, color: '#8A7040' }}>
                    Blockchain-Verified · Token #{cred.token_id || 'N/A'} · {txShort}
                  </div>
                </div>
              </div>
            )}

            {[
              {
                label: downloading ? 'Generating…' : 'Download Certificate',
                action: downloadCertificate,
                bg: C.gold,
                color: C.bg,
                disabled: downloading,
              },
              {
                label: 'Add to LinkedIn',
                action: addToLinkedIn,
                bg: '#0A66C2',
                color: '#fff',
              },
              {
                label: 'View on Blockchain',
                action: () =>
                  polygonUrl ? window.open(polygonUrl, '_blank') : showToast('TX hash pending.', true),
                bg: C.teal,
                color: '#fff',
              },
              {
                label: 'Copy Shareable Link',
                action: copyUrl,
                bg: 'transparent',
                color: C.white,
                border: `1px solid ${C.border2}`,
              },
            ].map((btn, i) => (
              <button
                key={i}
                className={i === 3 ? 'vgh' : 'vbtn'}
                onClick={btn.action}
                disabled={btn.disabled}
                style={{
                  background: btn.bg,
                  color: btn.color,
                  border: btn.border || 'none',
                  width: '100%',
                  borderRadius: 3,
                  padding: '12px',
                  fontFamily: F.body,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  cursor: btn.disabled ? 'not-allowed' : 'pointer',
                  marginBottom: 8,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {btn.label}
              </button>
            ))}

            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: C.muted,
                  marginBottom: 8,
                }}
              >
                Verification URL
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  readOnly
                  value={verifyUrl}
                  style={{
                    flex: 1,
                    background: C.faint,
                    border: `1px solid ${C.border2}`,
                    borderRadius: 3,
                    padding: '8px 12px',
                    fontSize: 10,
                    color: C.muted,
                    fontFamily: F.body,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={copyUrl}
                  style={{
                    background: C.goldDim,
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    padding: '8px 12px',
                    fontSize: 10,
                    color: C.gold,
                    cursor: 'pointer',
                    fontFamily: F.body,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.08em',
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {cred?.wallet_address && (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  borderRadius: 4,
                  background: 'rgba(26,143,105,0.06)',
                  border: '1px solid rgba(26,143,105,0.18)',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: C.teal2,
                    marginBottom: 6,
                  }}
                >
                  Blockchain Wallet
                </div>
                <div style={{ fontSize: 11, color: C.white, wordBreak: 'break-all' }}>
                  {cred.wallet_address}
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            background: toast.err ? '#1A0A0A' : '#0A1A12',
            border: `1px solid ${toast.err ? 'rgba(224,92,82,.4)' : 'rgba(34,181,137,.4)'}`,
            color: toast.err ? C.red : C.teal2,
            fontFamily: F.body,
            fontSize: 11,
            letterSpacing: '0.06em',
            padding: '12px 20px',
            borderRadius: 3,
            opacity: toast.show ? 1 : 0,
            transform: toast.show ? 'translateY(0)' : 'translateY(-8px)',
            transition: 'all 0.3s',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          {toast.msg}
        </div>
      </div>
    </>
  );
}