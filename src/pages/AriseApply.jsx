// src/pages/AriseApply.jsx
// Public landing form for Arise client opportunities (ATAC Anagenesis Inc.,
// Service Partner ID 1221605). No login. Posts to /api/arise-leads.
// Query params: ?src=fb|ig|email|...  ?opp=talent-pool
// Oct 28 pivot: open talent pool for upcoming client classes. CRSA first for everyone (free for applicants).
import { useState } from 'react';
import { useHcaptcha } from '../hooks/useHcaptcha';
import { isValidEmail } from '../utils/validation';

const CRSA_URL = 'https://app.atacglobalcx.com/login?action=register&src=arise-apply';
const API_BASE = import.meta.env.VITE_API_URL || 'https://atac-backend-production.up.railway.app';

const BG = '#080B12', BG2 = '#111722', GOLD = '#C9A84C', TEAL = '#1A8F69', WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.62)', BORDER = 'rgba(201,168,76,0.18)', RED = '#E05C52';
const FONT_D = '"Cormorant Garamond", Georgia, serif';
const FONT_B = '"Syne", "DM Sans", sans-serif';

const PROVINCES = [
  ['ON','Ontario'],['BC','British Columbia'],['AB','Alberta'],['MB','Manitoba'],['SK','Saskatchewan'],
  ['NS','Nova Scotia'],['NB','New Brunswick'],['NL','Newfoundland and Labrador'],['PE','Prince Edward Island'],
  ['NT','Northwest Territories'],['NU','Nunavut'],['YT','Yukon'],['QC','Quebec'],['OUTSIDE_CANADA','Outside Canada'],
];

const s = {
  page: { minHeight: '100vh', background: BG, color: WHITE, fontFamily: FONT_B, padding: '24px 16px 60px' },
  wrap: { maxWidth: 960, margin: '0 auto' },
  brand: { fontSize: 28, fontWeight: 800, letterSpacing: 2, color: WHITE },
  tag: { display: 'inline-block', background: GOLD, color: BG, fontSize: 15, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', padding: '8px 14px', borderRadius: 3, marginTop: 32 },
  h1: { fontFamily: FONT_D, fontSize: 64, lineHeight: 1.05, fontWeight: 400, margin: '16px 0 14px', color: WHITE },
  sub: { color: MUTED, fontSize: 22, lineHeight: 1.6, margin: 0 },
  facts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, margin: '22px 0 28px' },
  fact: { background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '16px 18px' },
  factK: { fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: GOLD, fontWeight: 800 },
  factV: { fontSize: 22, color: WHITE, marginTop: 6, fontWeight: 600 },
  card: { background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '34px 32px' },
  label: { display: 'block', fontSize: 16, letterSpacing: 1, textTransform: 'uppercase', color: WHITE, fontWeight: 700, margin: '22px 0 8px' },
  input: { width: '100%', boxSizing: 'border-box', background: BG, color: WHITE, border: `1px solid rgba(238,233,223,0.18)`, borderRadius: 6, padding: '16px 14px', fontSize: 20, fontFamily: FONT_B, outline: 'none' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  radioRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  chip: (on) => ({ cursor: 'pointer', padding: '14px 18px', borderRadius: 6, border: `1px solid ${on ? TEAL : 'rgba(238,233,223,0.18)'}`, background: on ? 'rgba(26,143,105,0.18)' : BG, color: WHITE, fontSize: 19, fontWeight: 600, userSelect: 'none' }),
  btn: (dis) => ({ width: '100%', marginTop: 22, background: dis ? 'rgba(26,143,105,0.4)' : TEAL, color: '#fff', border: 0, borderRadius: 6, padding: '20px', fontSize: 22, fontWeight: 800, fontFamily: FONT_B, cursor: dis ? 'not-allowed' : 'pointer' }),
  err: { color: RED, fontSize: 18, marginTop: 12 },
  fine: { color: MUTED, fontSize: 16, lineHeight: 1.6, marginTop: 18 },
};

function YesNo({ value, onChange }) {
  return (
    <div style={s.radioRow}>
      {[['yes', 'Yes'], ['no', 'No'], ['', 'Not sure']].map(([v, l]) => (
        <span key={l} role="button" tabIndex={0} style={s.chip(value === v)} onClick={() => onChange(v)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onChange(v)}>{l}</span>
      ))}
    </div>
  );
}

export default function AriseApply() {
  const params = new URLSearchParams(window.location.search);
  const source = (params.get('src') || 'landing').slice(0, 60);
  const opportunity = (params.get('opp') || 'talent-pool').slice(0, 60);

  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', province: '', onArise: '', cspId: '', hasWindows11: 'unset', hasUsbHeadset: 'unset', hasWebcam: 'unset', classTime: '', notes: '', website: '', country: '', marketingConsent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const { token: hcaptchaToken, containerRef, reset: resetCaptcha } = useHcaptcha();
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e && e.target ? e.target.value : e }));

  // Open intake: everyone can apply. Quebec / outside Canada are saved for future clients and routed to the CRSA.
  const outside = f.province === 'OUTSIDE_CANADA';
  const canSubmit = f.firstName && f.lastName && isValidEmail(f.email) && f.province && f.onArise !== '' && !!hcaptchaToken && !busy;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`${API_BASE}/api/arise-leads`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, hasWindows11: f.hasWindows11 === 'unset' ? '' : f.hasWindows11, hasUsbHeadset: f.hasUsbHeadset === 'unset' ? '' : f.hasUsbHeadset, hasWebcam: f.hasWebcam === 'unset' ? '' : f.hasWebcam, onArise: f.onArise === 'yes', source, opportunity, hcaptchaToken }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || 'Something went wrong. Please try again.'); if (typeof resetCaptcha === 'function') resetCaptcha(); setBusy(false); return; }
      setDone({ onArise: f.onArise === 'yes', eligible: j.ariseEligible !== false });
    } catch {
      setError('Network error. Please try again.'); setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={s.page}><div style={s.wrap}>
        <div style={s.brand}>ATAC <span style={{ color: GOLD }}>GLOBAL CX</span></div>
        <div style={{ ...s.card, marginTop: 28 }}>
          <div style={{ fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', color: TEAL, fontWeight: 800 }}>Application received</div>
          <h1 style={{ ...s.h1, fontSize: 54 }}>You are on the list, {f.firstName}.</h1>
          {!done.eligible ? (
            <p style={{ ...s.sub, color: WHITE, fontSize: 24 }}>Thanks for applying. This class is not open in your area, but we work with more than one client and we have saved your details for upcoming programs. Your next step is the free <b>CRSA readiness assessment</b>, which puts you at the front of the line. Use this same email ({f.email}) and it is covered automatically. <a href={CRSA_URL} style={{ color: GOLD }}>Start my free CRSA</a>.</p>
          ) : (
            <>
              <p style={{ ...s.sub, color: WHITE, fontSize: 24 }}>You are in our talent pool for upcoming client classes. <b>Step 1 is your free CRSA readiness assessment.</b> Create your account with this same email ({f.email}) and it is covered automatically, no card needed.</p>
              <a href={CRSA_URL} style={{ ...s.btn(false), display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>Start my free CRSA</a>
              <p style={{ ...s.sub, fontSize: 20, marginTop: 18 }}>{done.onArise
                ? <>Already on Arise? Log in at <a href="https://program.arise.com/" style={{ color: GOLD }}>program.arise.com</a> and make sure you are attached to <b>ATAC Anagenesis Inc. (Service Partner ID 1221605)</b>.</>
                : <>Once your CRSA is done, we will email you a personal Arise registration link. Classes fill first come, first served, so ready agents are placed first.</>}</p>
            </>
          )}
          <p style={s.fine}>A confirmation email with these steps is on its way to {f.email}. Check spam if it is not there in a few minutes. Questions: admin@atacglobalcx.com</p>
        </div>
      </div></div>
    );
  }

  return (
    <div style={s.page}><div style={s.wrap}>
      <div style={s.brand}>ATAC <span style={{ color: GOLD }}>GLOBAL CX</span></div>
      <div style={s.tag}>Now building our next class</div>
      <h1 style={s.h1}>Customer service from home. Get ready for the next class.</h1>
      <p style={s.sub}>Client classes fill first come, first served. Join our talent pool now, take the free CRSA readiness assessment, and be first in line when the next class opens.</p>
      <div style={s.facts}>
        <div style={s.fact}><div style={s.factK}>Step 1</div><div style={s.factV}>Apply (2 minutes)</div></div>
        <div style={s.fact}><div style={s.factK}>Step 2</div><div style={s.factV}>Free CRSA assessment</div></div>
        <div style={s.fact}><div style={s.factK}>Step 3</div><div style={s.factV}>Register on Arise</div></div>
        <div style={s.fact}><div style={s.factK}>You need</div><div style={s.factV}>Win 11, USB headset, webcam</div></div>
      </div>

      <form style={s.card} onSubmit={submit} noValidate>
        <div style={s.row}>
          <div><label style={s.label}>First name</label><input style={s.input} value={f.firstName} onChange={set('firstName')} autoComplete="given-name" /></div>
          <div><label style={s.label}>Last name</label><input style={s.input} value={f.lastName} onChange={set('lastName')} autoComplete="family-name" /></div>
        </div>
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" value={f.email} onChange={set('email')} autoComplete="email" />
        <label style={s.label}>Mobile phone</label>
        <input style={s.input} type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder="Optional, for class reminders" />
        <label style={s.label}>Province</label>
        <select style={s.input} value={f.province} onChange={set('province')}>
          <option value="">Select</option>
          {PROVINCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {outside && (<>
          <label style={s.label}>Country</label>
          <input style={s.input} value={f.country} onChange={set('country')} autoComplete="country-name" />
        </>)}

        <label style={s.label}>Do you already have an Arise profile?</label>
        <div style={s.radioRow}>
          <span role="button" tabIndex={0} style={s.chip(f.onArise === 'yes')} onClick={() => set('onArise')('yes')}>Yes, I am on Arise</span>
          <span role="button" tabIndex={0} style={s.chip(f.onArise === 'no')} onClick={() => set('onArise')('no')}>No, I am new</span>
        </div>
        {f.onArise === 'yes' && (<>
          <label style={s.label}>Your CSP ID (if you know it)</label>
          <input style={s.input} inputMode="numeric" value={f.cspId} onChange={set('cspId')} placeholder="5 to 10 digits" />
        </>)}

        <label style={s.label}>Windows 11 PC, fully updated?</label><YesNo value={f.hasWindows11} onChange={set('hasWindows11')} />
        <label style={s.label}>Hardwired USB headset?</label><YesNo value={f.hasUsbHeadset} onChange={set('hasUsbHeadset')} />
        <label style={s.label}>Webcam?</label><YesNo value={f.hasWebcam} onChange={set('hasWebcam')} />

        <label style={s.label}>Preferred class time (Mon to Fri)</label>
        <div style={s.radioRow}>
          {[['day', '9:00 a.m. to 3:00 p.m. ET'], ['evening', '4:00 p.m. to 10:00 p.m. ET'], ['either', 'Either']].map(([v, l]) => (
            <span key={v} role="button" tabIndex={0} style={s.chip(f.classTime === v)} onClick={() => set('classTime')(v)}>{l}</span>
          ))}
        </div>

        <label style={s.label}>Anything we should know? (optional)</label>
        <textarea style={{ ...s.input, minHeight: 70 }} value={f.notes} onChange={set('notes')} maxLength={1000} />

        {/* Honeypot: hidden from real users */}
        <div style={{ position: 'absolute', left: -9999, top: -9999 }} aria-hidden="true">
          <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label>
        </div>

        <label style={{ ...s.label, display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={f.marketingConsent} onChange={(e) => setF(p => ({ ...p, marketingConsent: e.target.checked }))} style={{ width: 22, height: 22, marginTop: 4 }} />
          <span>Yes, email me about future work from home opportunities and the CRSA credential. You can unsubscribe at any time.</span>
        </label>

        <div style={{ marginTop: 18 }}><div ref={containerRef} /></div>
        {error && <div style={s.err}>{error}</div>}
        <button type="submit" style={s.btn(!canSubmit)} disabled={!canSubmit}>{busy ? 'Sending...' : 'Join the talent pool'}</button>
        <p style={s.fine}>By applying you agree to be contacted by ATAC Anagenesis Inc. (ATAC Global CX) about this application and upcoming client classes. This is a business-to-business opportunity on the Arise platform, not an offer of employment. Enrollment on Arise includes a background check ($43.00 CAD), photo ID verification, a PC scan and a $20.00 CAD class confirmation deposit.</p>
      </form>
    </div></div>
  );
}
