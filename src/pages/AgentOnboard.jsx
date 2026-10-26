// src/pages/AgentOnboard.jsx
// Public signing page for the ATAC Anagenesis Master Services Agreement and
// Non-Disclosure Agreement. Reached from the invite email:
//   /arise/onboard/:token   (the token is the authentication; no login)
// GET /api/onboard/:token for prefill + agreement text, POST to sign.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isValidEmail } from '../utils/validation';

const API_BASE = import.meta.env.VITE_API_URL || 'https://atac-backend-production.up.railway.app';

const BG = '#080B12', BG2 = '#111722', GOLD = '#C9A84C', TEAL = '#1A8F69', WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.62)', BORDER = 'rgba(201,168,76,0.18)', RED = '#E05C52';
const FONT_D = '"Cormorant Garamond", Georgia, serif';
const FONT_B = '"Syne", "DM Sans", sans-serif';

const LANGS = ['English', 'French', 'Spanish', 'Mandarin', 'Hindi', 'Punjabi'];
const EXPERIENCE = ['Customer service', 'Sales', 'Healthcare', 'Finance', 'Accounting', 'Information technology', 'Travel', 'None yet, willing to learn'];
const PROVINCES = ['Ontario', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 'Nova Scotia', 'New Brunswick', 'Newfoundland and Labrador', 'Prince Edward Island', 'Northwest Territories', 'Nunavut', 'Yukon', 'Quebec', 'Other'];

const s = {
  page: { minHeight: '100vh', background: BG, color: WHITE, fontFamily: FONT_B, padding: '24px 16px 60px' },
  wrap: { maxWidth: 880, margin: '0 auto' },
  brand: { fontSize: 24, fontWeight: 800, letterSpacing: 2, color: WHITE },
  h1: { fontFamily: FONT_D, fontSize: 48, lineHeight: 1.08, fontWeight: 400, margin: '22px 0 10px', color: WHITE },
  sub: { color: MUTED, fontSize: 19, lineHeight: 1.6, margin: 0 },
  card: { background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '28px 26px', marginTop: 22 },
  step: { fontSize: 14, letterSpacing: 3, textTransform: 'uppercase', color: GOLD, fontWeight: 800, margin: 0 },
  h2: { fontFamily: FONT_D, fontSize: 32, fontWeight: 400, margin: '6px 0 4px', color: WHITE },
  label: { display: 'block', fontSize: 15, letterSpacing: 1, textTransform: 'uppercase', color: WHITE, fontWeight: 700, margin: '18px 0 8px' },
  input: { width: '100%', boxSizing: 'border-box', background: BG, color: WHITE, border: '1px solid rgba(238,233,223,0.18)', borderRadius: 6, padding: '14px 12px', fontSize: 18, fontFamily: FONT_B, outline: 'none' },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: (on) => ({ cursor: 'pointer', padding: '11px 15px', borderRadius: 6, border: `1px solid ${on ? TEAL : 'rgba(238,233,223,0.18)'}`, background: on ? 'rgba(26,143,105,0.18)' : BG, color: WHITE, fontSize: 17, fontWeight: 600, userSelect: 'none' }),
  doc: { background: '#F7F4EC', color: '#1F2328', borderRadius: 8, padding: '20px 22px', maxHeight: 460, overflowY: 'auto', fontFamily: 'Georgia, serif', fontSize: 15.5, lineHeight: 1.6, marginTop: 14 },
  check: { display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', fontSize: 18, lineHeight: 1.45, margin: '14px 0 0' },
  box: { width: 22, height: 22, marginTop: 3, flexShrink: 0 },
  btn: (dis) => ({ width: '100%', marginTop: 22, background: dis ? 'rgba(26,143,105,0.4)' : TEAL, color: '#fff', border: 0, borderRadius: 6, padding: '18px', fontSize: 21, fontWeight: 800, fontFamily: FONT_B, cursor: dis ? 'not-allowed' : 'pointer' }),
  ghost: { background: 'transparent', color: GOLD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 14px', fontSize: 15, fontWeight: 700, fontFamily: FONT_B, cursor: 'pointer' },
  err: { color: RED, fontSize: 17, marginTop: 12 },
  fine: { color: MUTED, fontSize: 15, lineHeight: 1.6, marginTop: 14 },
};

function fill(text, v) {
  return String(text)
    .replace(/\{\{FullName\}\}/g, v.fullName || '[your name]')
    .replace(/\{\{CSPID\}\}/g, v.cspId || 'not yet assigned')
    .replace(/\{\{SignedDate\}\}/g, v.date)
    .replace(/\{\{Address\}\}/g, v.address || '[your address]');
}

function DocText({ doc, values }) {
  return (
    <div style={s.doc} tabIndex={0} aria-label={doc.title}>
      <div style={{ fontWeight: 700, fontSize: 17, textTransform: 'uppercase', marginBottom: 4 }}>{doc.title}</div>
      <div style={{ fontSize: 12, color: '#57606a', marginBottom: 12 }}>Version {doc.version}</div>
      {doc.intro.map((p, i) => <p key={i} style={{ margin: '0 0 10px' }}>{fill(p, values)}</p>)}
      {doc.sections.map((sec) => (
        <div key={sec.h} style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700 }}>{sec.h}</div>
          {sec.items.length > 1
            ? <ol style={{ margin: '6px 0 0', paddingLeft: 22 }}>{sec.items.map((it, i) => <li key={i} style={{ marginBottom: 6 }}>{fill(it, values)}</li>)}</ol>
            : <p style={{ margin: '6px 0 0' }}>{fill(sec.items[0], values)}</p>}
        </div>
      ))}
    </div>
  );
}

function SignaturePad({ onChange }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const points = useRef(0);

  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111111';
  }, []);

  function pos(e) {
    const c = ref.current; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function down(e) {
    e.preventDefault(); ref.current.setPointerCapture?.(e.pointerId);
    drawing.current = true; const p = pos(e); const ctx = ref.current.getContext('2d');
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }
  function move(e) {
    if (!drawing.current) return;
    e.preventDefault(); const p = pos(e); const ctx = ref.current.getContext('2d');
    ctx.lineTo(p.x, p.y); ctx.stroke(); points.current += 1;
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(points.current > 12 ? ref.current.toDataURL('image/png') : '');
  }
  function clear() {
    const c = ref.current; const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    points.current = 0; onChange('');
  }

  return (
    <div>
      <canvas ref={ref} width={600} height={180} aria-label="Draw your signature"
        style={{ width: '100%', maxWidth: 600, height: 'auto', aspectRatio: '600 / 180', background: '#fff', borderRadius: 6, touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, maxWidth: 600 }}>
        <span style={{ color: MUTED, fontSize: 14 }}>Sign with your finger, stylus or mouse.</span>
        <button type="button" style={s.ghost} onClick={clear}>Clear</button>
      </div>
    </div>
  );
}

export default function AgentOnboard() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, error: '', code: '' });
  const [docs, setDocs] = useState([]);
  const [f, setF] = useState({
    firstName: '', lastName: '', email: '', phone: '', cspId: '',
    line1: '', line2: '', city: '', province: '', postal: '', country: 'Canada',
    languages: [], otherLang: '', bilingual: null, experience: [],
    msaRead: false, msaUnderstand: false, msaAgree: false, ndaAgree: false,
    typedName: '', signedPlace: '', signaturePng: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const toggle = (k, v) => setF((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));

  useEffect(() => {
    let off = false;
    fetch(`${API_BASE}/api/onboard/${encodeURIComponent(token || '')}`)
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => {
        if (off) return;
        if (!ok) { setState({ loading: false, error: j.error || 'This link could not be opened.', code: j.code || '' }); return; }
        setDocs(j.docs || []);
        const a = j.agent || {};
        setF((p) => ({ ...p, firstName: a.firstName || '', lastName: a.lastName || '', email: a.email || '', phone: a.phone || '', cspId: a.cspId || '' }));
        setState({ loading: false, error: '', code: '' });
      })
      .catch(() => !off && setState({ loading: false, error: 'Network error. Please refresh the page.', code: '' }));
    return () => { off = true; };
  }, [token]);

  const msa = docs.find((d) => d.type === 'msa');
  const nda = docs.find((d) => d.type === 'nda');
  const fullName = `${f.firstName} ${f.lastName}`.trim();
  const address = [f.line1, f.line2, f.city, f.province, f.postal, f.country].filter(Boolean).join(', ');
  const values = { fullName, cspId: f.cspId, address, date: new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) };
  const nameMatches = f.typedName.trim().toLowerCase().replace(/\s+/g, ' ') === fullName.toLowerCase().replace(/\s+/g, ' ');
  const detailsOk = f.firstName && f.lastName && isValidEmail(f.email) && f.line1 && f.city && f.province && f.postal;
  const canSubmit = detailsOk && f.msaRead && f.msaUnderstand && f.msaAgree && f.ndaAgree && nameMatches && !!f.signaturePng && !busy;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setError('');
    try {
      const languages = [...f.languages, ...(f.otherLang.trim() ? [f.otherLang.trim()] : [])];
      const r = await fetch(`${API_BASE}/api/onboard/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone, cspId: f.cspId,
          address: { line1: f.line1, line2: f.line2, city: f.city, province: f.province, postal: f.postal, country: f.country },
          languages, bilingual: f.bilingual, experience: f.experience,
          msa: { read: f.msaRead, understand: f.msaUnderstand, agree: f.msaAgree }, nda: { agree: f.ndaAgree },
          typedName: f.typedName, signedPlace: f.signedPlace, signaturePng: f.signaturePng,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || 'Something went wrong. Please try again.'); setBusy(false); return; }
      setDone(true);
      window.scrollTo(0, 0);
    } catch {
      setError('Network error. Please try again.'); setBusy(false);
    }
  }

  const Brand = <div style={s.brand}>ATAC <span style={{ color: GOLD }}>GLOBAL CX</span></div>;

  if (state.loading) return <div style={s.page}><div style={s.wrap}>{Brand}<p style={{ ...s.sub, marginTop: 30 }}>Loading your agreements...</p></div></div>;
  if (state.error) {
    return (
      <div style={s.page}><div style={s.wrap}>{Brand}
        <div style={s.card}>
          <div style={s.step}>{state.code === 'ALREADY_SIGNED' ? 'Already signed' : 'Link problem'}</div>
          <p style={{ ...s.sub, color: WHITE, fontSize: 21, marginTop: 10 }}>{state.error}</p>
          <p style={s.fine}>Questions: admin@atacglobalcx.com</p>
        </div>
      </div></div>
    );
  }
  if (done) {
    return (
      <div style={s.page}><div style={s.wrap}>{Brand}
        <div style={s.card}>
          <div style={{ ...s.step, color: TEAL }}>Signed</div>
          <h1 style={s.h1}>Thank you, {f.firstName}.</h1>
          <p style={{ ...s.sub, color: WHITE, fontSize: 21 }}>Your Master Services Agreement and Non-Disclosure Agreement with ATAC Anagenesis Inc. are signed. PDF copies are on their way to {f.email}.</p>
          <p style={{ ...s.sub, fontSize: 19, marginTop: 14 }}>Next: if you have not already, sign the confidentiality and waiver agreements on your Arise home page at <a href="https://link.arise.com" style={{ color: GOLD }}>link.arise.com</a>. We will then finalize you, and you can enroll in your client opportunity.</p>
        </div>
      </div></div>
    );
  }

  return (
    <div style={s.page}><div style={s.wrap}>
      {Brand}
      <h1 style={s.h1}>Your ATAC Anagenesis agreements</h1>
      <p style={s.sub}>Confirm your details, read both agreements, then sign once at the bottom. About 10 minutes. You will get a PDF copy of everything you sign.</p>

      <form onSubmit={submit} noValidate>
        <div style={s.card}>
          <p style={s.step}>Step 1 of 4</p>
          <h2 style={s.h2}>Your details</h2>
          <div style={s.row}>
            <div><label style={s.label}>First name</label><input style={s.input} value={f.firstName} onChange={set('firstName')} autoComplete="given-name" /></div>
            <div><label style={s.label}>Last name</label><input style={s.input} value={f.lastName} onChange={set('lastName')} autoComplete="family-name" /></div>
          </div>
          <div style={s.row}>
            <div><label style={s.label}>Email</label><input style={s.input} type="email" value={f.email} onChange={set('email')} autoComplete="email" /></div>
            <div><label style={s.label}>Phone</label><input style={s.input} type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></div>
          </div>
          <label style={s.label}>Arise CSP ID</label>
          <input style={s.input} inputMode="numeric" value={f.cspId} onChange={set('cspId')} placeholder="Found in the Arise portal" />
          <label style={s.label}>Home address</label>
          <input style={s.input} value={f.line1} onChange={set('line1')} placeholder="Street address" autoComplete="address-line1" />
          <input style={{ ...s.input, marginTop: 8 }} value={f.line2} onChange={set('line2')} placeholder="Unit, apartment (optional)" autoComplete="address-line2" />
          <div style={{ ...s.row, marginTop: 8 }}>
            <input style={s.input} value={f.city} onChange={set('city')} placeholder="City" autoComplete="address-level2" />
            <select style={s.input} value={f.province} onChange={set('province')} aria-label="Province">
              <option value="">Province</option>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input style={s.input} value={f.postal} onChange={set('postal')} placeholder="Postal code" autoComplete="postal-code" />
          </div>
          <label style={s.label}>Languages you speak and read fluently</label>
          <div style={s.chips}>
            {LANGS.map((l) => <span key={l} role="button" tabIndex={0} style={s.chip(f.languages.includes(l))} onClick={() => toggle('languages', l)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle('languages', l)}>{l}</span>)}
          </div>
          <input style={{ ...s.input, marginTop: 8 }} value={f.otherLang} onChange={set('otherLang')} placeholder="Other language (optional)" />
          <label style={s.label}>Are you bilingual?</label>
          <div style={s.chips}>
            {[[true, 'Yes'], [false, 'No']].map(([v, l]) => <span key={l} role="button" tabIndex={0} style={s.chip(f.bilingual === v)} onClick={() => setF((p) => ({ ...p, bilingual: v }))}>{l}</span>)}
          </div>
          <label style={s.label}>Experience</label>
          <div style={s.chips}>
            {EXPERIENCE.map((x) => <span key={x} role="button" tabIndex={0} style={s.chip(f.experience.includes(x))} onClick={() => toggle('experience', x)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle('experience', x)}>{x}</span>)}
          </div>
        </div>

        {msa && (
          <div style={s.card}>
            <p style={s.step}>Step 2 of 4</p>
            <h2 style={s.h2}>Master Services Agreement</h2>
            <p style={s.fine}>Scroll inside the box to read the full agreement. It includes a $30.00 CAD platform usage fee per semi-monthly invoice (section B).</p>
            <DocText doc={msa} values={values} />
            <label style={s.check}><input type="checkbox" style={s.box} checked={f.msaRead} onChange={set('msaRead')} />I have carefully read each section of this Agreement.</label>
            <label style={s.check}><input type="checkbox" style={s.box} checked={f.msaUnderstand} onChange={set('msaUnderstand')} />I understand each section of this Agreement.</label>
            <label style={s.check}><input type="checkbox" style={s.box} checked={f.msaAgree} onChange={set('msaAgree')} />I agree to each section of this Agreement.</label>
          </div>
        )}

        {nda && (
          <div style={s.card}>
            <p style={s.step}>Step 3 of 4</p>
            <h2 style={s.h2}>Non-Disclosure Agreement</h2>
            <DocText doc={nda} values={values} />
            <label style={s.check}><input type="checkbox" style={s.box} checked={f.ndaAgree} onChange={set('ndaAgree')} />I have read and agree to this Non-Disclosure Agreement.</label>
          </div>
        )}

        <div style={s.card}>
          <p style={s.step}>Step 4 of 4</p>
          <h2 style={s.h2}>Sign</h2>
          <p style={s.fine}>Your signature below is applied to both agreements.</p>
          <SignaturePad onChange={(png) => setF((p) => ({ ...p, signaturePng: png }))} />
          <label style={s.label}>Type your full name to sign</label>
          <input style={s.input} value={f.typedName} onChange={set('typedName')} placeholder={fullName || 'First and last name'} />
          {f.typedName && !nameMatches && <div style={{ ...s.err, fontSize: 15 }}>Type your name exactly as in Step 1: {fullName}</div>}
          <label style={s.label}>Signed at (city, province)</label>
          <input style={s.input} value={f.signedPlace} onChange={set('signedPlace')} placeholder="e.g. Oshawa, Ontario" />
          {error && <div style={s.err}>{error}</div>}
          {!detailsOk && <div style={s.fine}>Complete your name, email and full address in Step 1.</div>}
          <button type="submit" style={s.btn(!canSubmit)} disabled={!canSubmit}>{busy ? 'Signing...' : 'Sign both agreements'}</button>
          <p style={s.fine}>By clicking Sign, you agree that your electronic signature is the legal equivalent of your handwritten signature. We record the date, time, IP address and agreement version with your signature.</p>
        </div>
      </form>
    </div></div>
  );
}
