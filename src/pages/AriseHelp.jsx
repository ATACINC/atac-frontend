// src/pages/AriseHelp.jsx
// Public self-serve help for agents joining ATAC Anagenesis Inc. on Arise. No login.
// Covers the three blockers seen in Oct 2026 replies: not attached to our IBO,
// can't log in, and confusing portal statuses. Linked from emails and ManyChat.
import { useState } from 'react';

const IBO_ID = '1221605';
const ARISE_REG = 'CAregistration@registration.arise.com';
const ADMIN = 'admin@atacglobalcx.com';
const APPLY_URL = '/arise/apply?src=help';

const BG = '#080B12', BG2 = '#111722', GOLD = '#C9A84C', TEAL = '#1A8F69', WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.68)', BORDER = 'rgba(201,168,76,0.18)';
const FONT_D = '"Cormorant Garamond", Georgia, serif';
const FONT_B = '"Syne", "DM Sans", sans-serif';

const s = {
  page: { minHeight: '100vh', background: BG, color: WHITE, fontFamily: FONT_B, padding: '24px 16px 60px' },
  wrap: { maxWidth: 900, margin: '0 auto' },
  brand: { fontSize: 28, fontWeight: 800, letterSpacing: 2, color: WHITE },
  tag: { display: 'inline-block', background: GOLD, color: BG, fontSize: 15, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', padding: '8px 14px', borderRadius: 3, marginTop: 32 },
  h1: { fontFamily: FONT_D, fontSize: 52, lineHeight: 1.08, fontWeight: 400, margin: '16px 0 14px', color: WHITE },
  sub: { color: MUTED, fontSize: 20, lineHeight: 1.6, margin: 0 },
  nav: { display: 'flex', flexWrap: 'wrap', gap: 10, margin: '26px 0 6px' },
  chip: { color: WHITE, textDecoration: 'none', border: `1px solid ${BORDER}`, background: BG2, borderRadius: 999, padding: '10px 16px', fontSize: 16, fontWeight: 700 },
  h2: { fontFamily: FONT_D, fontSize: 34, fontWeight: 400, margin: '44px 0 12px', color: GOLD, scrollMarginTop: 20 },
  card: { background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '24px 26px' },
  p: { color: MUTED, fontSize: 19, lineHeight: 1.65, margin: '0 0 12px' },
  b: { color: WHITE, fontWeight: 700 },
  ol: { margin: '6px 0 0', paddingLeft: 26, color: MUTED, fontSize: 19, lineHeight: 1.7 },
  li: { marginBottom: 8 },
  label: { display: 'block', color: WHITE, fontSize: 16, fontWeight: 700, margin: '18px 0 8px' },
  input: { width: '100%', maxWidth: 280, boxSizing: 'border-box', background: BG, color: WHITE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '14px 16px', fontSize: 18, fontFamily: FONT_B },
  pre: { whiteSpace: 'pre-wrap', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '16px 18px', color: WHITE, fontSize: 17, lineHeight: 1.6, margin: '14px 0 0', fontFamily: FONT_B },
  btnRow: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  btn: { display: 'inline-block', background: TEAL, color: '#fff', textDecoration: 'none', border: 0, borderRadius: 6, padding: '14px 22px', fontSize: 17, fontWeight: 800, fontFamily: FONT_B, cursor: 'pointer' },
  btnGhost: { display: 'inline-block', background: 'transparent', color: WHITE, textDecoration: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '14px 22px', fontSize: 17, fontWeight: 700, fontFamily: FONT_B, cursor: 'pointer' },
  row: { padding: '16px 0', borderBottom: '1px solid rgba(238,233,223,0.08)' },
  status: { display: 'inline-block', background: 'rgba(201,168,76,0.12)', color: GOLD, borderRadius: 4, padding: '4px 10px', fontSize: 16, fontWeight: 700, marginBottom: 6 },
  fine: { color: MUTED, fontSize: 15, lineHeight: 1.6, marginTop: 36 },
};

function CopyBlock({ text, mailto }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* clipboard blocked: text is still selectable */ }
  };
  return (
    <>
      <div style={s.pre}>{text}</div>
      <div style={s.btnRow}>
        <button type="button" style={s.btn} onClick={copy}>{copied ? 'Copied ✓' : 'Copy message'}</button>
        {mailto && <a style={s.btnGhost} href={mailto}>Open in my email</a>}
      </div>
    </>
  );
}

function Status({ name, children }) {
  return (
    <div style={s.row}>
      <div style={s.status}>{name}</div>
      <p style={{ ...s.p, margin: 0 }}>{children}</p>
    </div>
  );
}

export default function AriseHelp() {
  const [csp, setCsp] = useState('');
  const [name, setName] = useState('');
  const id = csp.trim() || '[your CSP ID]';
  const who = name.trim() || '[your full name]';

  const attachMsg = `Hello Arise Registration,\n\nPlease attach my profile to ATAC Anagenesis Inc., IBO ID ${IBO_ID} (Service Partner ID), so I can enrol in their client classes.\n\nFull name: ${who}\nCSP ID: ${id}\n\nThank you.`;
  const loginMsg = `Hello Arise Registration,\n\nI can't log in to my Arise profile and the password reset email is not arriving. Please reset my login. If my profile is inactive, please reactivate it and attach it to ATAC Anagenesis Inc., IBO ID ${IBO_ID}.\n\nFull name: ${who}\nCSP ID: ${id}\n\nThank you.`;
  const mailto = (subject, body) => `mailto:${ARISE_REG}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div style={s.page}><div style={s.wrap}>
      <div style={s.brand}>ATAC GLOBAL CX</div>
      <div style={s.tag}>Arise help</div>
      <h1 style={s.h1}>Stuck on the Arise portal? Fix it in 2 minutes.</h1>
      <p style={s.sub}>Most issues come down to three things: your profile isn't attached to our IBO yet, you can't log in, or a status message you don't recognize. Pick yours below.</p>

      <nav style={s.nav}>
        <a style={s.chip} href="#cant-see">I can't see the class</a>
        <a style={s.chip} href="#login">I can't log in</a>
        <a style={s.chip} href="#not-eligible">"You are not eligible"</a>
        <a style={s.chip} href="#switching">I'm with another IBO</a>
        <a style={s.chip} href="#statuses">What does my status mean?</a>
      </nav>

      <div style={{ ...s.card, marginTop: 24 }}>
        <p style={{ ...s.p, margin: 0 }}>Fill these in once and every message on this page updates with your details.</p>
        <label style={s.label} htmlFor="csp">Your Arise CSP ID</label>
        <input id="csp" style={s.input} inputMode="numeric" placeholder="e.g. 3061667" value={csp} onChange={(e) => setCsp(e.target.value.replace(/[^0-9]/g, ''))} />
        <label style={s.label} htmlFor="nm">Your full name</label>
        <input id="nm" style={s.input} placeholder="First and last name" value={name} onChange={(e) => setName(e.target.value)} />
        <p style={{ ...s.p, margin: '14px 0 0', fontSize: 16 }}>Don't know your CSP ID? It's under My Profile in the Arise portal. Or email {ADMIN} and we'll look it up.</p>
      </div>

      <h2 id="cant-see" style={s.h2}>I can't see the class</h2>
      <div style={s.card}>
        <p style={s.p}>Client classes only show to agents attached to our IBO, <span style={s.b}>ATAC Anagenesis Inc. (IBO ID {IBO_ID})</span>. If you see "no matching clients" or "check back later", you're not attached yet.</p>
        <ol style={s.ol}>
          <li style={s.li}>Log in at <span style={s.b}>program.arise.com</span> on a Windows computer. Some classes don't show in the mobile app.</li>
          <li style={s.li}>Still not there? Send this message to <span style={s.b}>{ARISE_REG}</span>:</li>
        </ol>
        <CopyBlock text={attachMsg} mailto={mailto(`Attach CSP ${id} to IBO ${IBO_ID}`, attachMsg)} />
        <ol style={s.ol} start={3}>
          <li style={{ ...s.li, marginTop: 14 }}>Reply to our email (or write to {ADMIN}) to say it's sent. When your request reaches us, we accept it, usually the same day.</li>
          <li style={s.li}>Sign our short contractor agreement when it arrives, then sign any Arise agreements in the portal. We finalize you, and you can enrol.</li>
        </ol>
      </div>

      <h2 id="login" style={s.h2}>I can't log in</h2>
      <div style={s.card}>
        <p style={s.p}>Arise manages all logins, so ATAC can't reset your Arise password. This is the fastest way back in:</p>
        <ol style={s.ol}>
          <li style={s.li}>Go to <span style={s.b}>program.arise.com</span> and click <span style={s.b}>Forgot Password</span>. Use the email on your Arise profile.</li>
          <li style={s.li}>Check your inbox <span style={s.b}>and spam folder</span>. It can take up to 30 minutes. If you have more than one email address, check them all.</li>
          <li style={s.li}>A blank screen when you try to register usually means you already have a profile. Don't create a second one, because two profiles can block your enrolment.</li>
          <li style={s.li}>Nothing after 30 minutes? Send this to <span style={s.b}>{ARISE_REG}</span>:</li>
        </ol>
        <CopyBlock text={loginMsg} mailto={mailto(`Login reset for CSP ${id}`, loginMsg)} />
        <p style={{ ...s.p, marginTop: 16 }}>Locked out of your <span style={s.b}>ATAC Global CX</span> account instead (the CRSA assessment)? Use "Forgot password" at <a style={{ color: GOLD }} href="/login">app.atacglobalcx.com/login</a>.</p>
      </div>

      <h2 id="not-eligible" style={s.h2}>"You are not eligible"</h2>
      <div style={s.card}>
        <p style={s.p}>If you can see the class but get this banner, your profile is set up, but one of Arise's eligibility rules is flagged. The usual reasons:</p>
        <ol style={s.ol}>
          <li style={s.li}><span style={s.b}>You're enrolled in, or marked "interested" in, another opportunity.</span> Withdraw from it and the class should open. This is the most common one.</li>
          <li style={s.li}>You dropped or didn't pass a certification class in the last 60 days.</li>
          <li style={s.li}>Your Commitment Adherence score is below 90%.</li>
          <li style={s.li}>You live in a province the program doesn't cover.</li>
        </ol>
        <p style={{ ...s.p, marginTop: 14 }}>Tap the <span style={s.b}>(i)</span> button under "Learn More" on the class card. It often shows the exact reason. Send us a screenshot, and if it can be fixed, we'll work through it with you. If it can't, you go first in line for the next class.</p>
      </div>

      <h2 id="switching" style={s.h2}>I'm attached to another IBO</h2>
      <div style={s.card}>
        <p style={s.p}>You're welcome to move to us. Do it in this order so you don't lose a seat:</p>
        <ol style={s.ol}>
          <li style={s.li}>Ask Arise to move you to ATAC Anagenesis Inc., IBO ID {IBO_ID} (use the "I can't see the class" message above).</li>
          <li style={s.li}><span style={s.b}>Don't enrol in a class until we confirm you're finalized with us.</span> Changing IBOs can automatically drop an enrolment made under your old IBO.</li>
          <li style={s.li}>Already in a class with another IBO? Finish it first, then move. Arise advises against changing IBOs once class has started, because it can affect your attendance.</li>
        </ol>
      </div>

      <h2 id="statuses" style={s.h2}>What does my status mean?</h2>
      <div style={s.card}>
        <Status name="Pending">Your request reached us. We accept requests daily.</Status>
        <Status name="Agent has to sign agreement(s)">Sign the agreements or waivers waiting for you in the Arise portal. If the portal says "no agreements found", you're likely done. Tell us, and we'll clear it with Arise.</Status>
        <Status name="Finalization">You've signed everything. We're finalizing you, usually the same day.</Status>
        <Status name="Dropped: Service Partner Released Agent">This can show up right after you change IBOs. Don't re-enrol on your own. Email us, and we'll ask Arise to reinstate your seat. It's often fixed within minutes.</Status>
        <Status name="Fully Enrolled: Pending Deposit">You're in. Pay the class confirmation deposit in the portal to lock in your seat.</Status>
        <div style={{ ...s.row, borderBottom: 0 }}>
          <div style={s.status}>Background check shows "Resume"</div>
          <p style={{ ...s.p, margin: 0 }}>Click Resume and go through every screen to make sure there's no final Submit step. Watch your email and spam for the Netforce CPIC form. Once your part is submitted, the results can take several days, and that's on the vendor's side.</p>
        </div>
      </div>

      <h2 style={s.h2}>Still stuck?</h2>
      <div style={s.card}>
        <p style={s.p}>Email <a style={{ color: GOLD }} href={`mailto:${ADMIN}?subject=${encodeURIComponent(`Arise help: CSP ${id}`)}`}>{ADMIN}</a> with your CSP ID and a screenshot of what you see. A real person answers, and we follow up with Arise for you.</p>
        <p style={{ ...s.p, margin: 0 }}>Not on Arise yet? <a style={{ color: GOLD }} href={APPLY_URL}>Join our talent pool</a>. It takes 2 minutes, and you get a free CRSA readiness assessment. You can also check your setup against our <a style={{ color: GOLD }} href="/equipment">equipment list</a>.</p>
      </div>

      <p style={s.fine}>Arise, the Arise portal and its statuses belong to Arise Virtual Solutions. This page is general guidance from ATAC Anagenesis Inc. and Arise's own instructions take priority. Business opportunity on the Arise platform through ATAC Anagenesis Inc., not an offer of employment.</p>
    </div></div>
  );
}
