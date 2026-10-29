// src/pages/Equipment.jsx
// Public equipment checklist for work-from-home applicants. No login.
// Source: Arise System and Equipment Policy, effective January 1, 2026.
// Linked from the talent-pool confirmation email, the ManyChat FAQ and /arise/apply.
const APPLY_URL = '/arise/apply?src=equipment';

const BG = '#080B12', BG2 = '#111722', GOLD = '#C9A84C', TEAL = '#1A8F69', WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.62)', BORDER = 'rgba(201,168,76,0.18)', RED = '#E05C52';
const FONT_D = '"Cormorant Garamond", Georgia, serif';
const FONT_B = '"Syne", "DM Sans", sans-serif';

const s = {
  page: { minHeight: '100vh', background: BG, color: WHITE, fontFamily: FONT_B, padding: '24px 16px 60px' },
  wrap: { maxWidth: 960, margin: '0 auto' },
  brand: { fontSize: 28, fontWeight: 800, letterSpacing: 2, color: WHITE },
  tag: { display: 'inline-block', background: GOLD, color: BG, fontSize: 15, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', padding: '8px 14px', borderRadius: 3, marginTop: 32 },
  h1: { fontFamily: FONT_D, fontSize: 56, lineHeight: 1.05, fontWeight: 400, margin: '16px 0 14px', color: WHITE },
  sub: { color: MUTED, fontSize: 21, lineHeight: 1.6, margin: 0 },
  h2: { fontFamily: FONT_D, fontSize: 34, fontWeight: 400, margin: '40px 0 12px', color: GOLD },
  card: { background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '26px 28px' },
  row: { display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 2fr', gap: 14, padding: '14px 0', borderBottom: '1px solid rgba(238,233,223,0.08)', fontSize: 19, lineHeight: 1.5 },
  k: { color: WHITE, fontWeight: 700 },
  v: { color: MUTED },
  rec: { color: GOLD, fontSize: 16, marginTop: 4 },
  no: { color: RED, fontWeight: 700 },
  list: { margin: '8px 0 0', paddingLeft: 24, color: MUTED, fontSize: 19, lineHeight: 1.7 },
  btn: { display: 'inline-block', marginTop: 28, background: TEAL, color: '#fff', textDecoration: 'none', borderRadius: 6, padding: '18px 28px', fontSize: 21, fontWeight: 800, fontFamily: FONT_B },
  fine: { color: MUTED, fontSize: 16, lineHeight: 1.6, marginTop: 28 },
};

function Row({ k, v, rec }) {
  return (
    <div style={s.row}>
      <div style={s.k}>{k}</div>
      <div>
        <div style={s.v}>{v}</div>
        {rec && <div style={s.rec}>Recommended: {rec}</div>}
      </div>
    </div>
  );
}

export default function Equipment() {
  return (
    <div style={s.page}><div style={s.wrap}>
      <div style={s.brand}>ATAC GLOBAL CX</div>
      <div style={s.tag}>Equipment check</div>
      <h1 style={s.h1}>What you need to work from home on a client program.</h1>
      <p style={s.sub}>These are the Arise platform minimums for 2026. Your PC goes through an automatic scan before class, so check this list first. If you are missing something, apply anyway. It just needs to be in place before class starts.</p>

      <h2 style={s.h2}>Your computer</h2>
      <div style={s.card}>
        <Row k="Operating system" v="Windows 11, genuine licensed copy, all updates installed. Beta or developer builds are not supported." />
        <Row k="Processor" v="Intel Core i3-9000, i5-7000, i7-5000 or i9 series or better; Pentium G5400 / N6400 or better; Celeron J4000 / N5000 or better; AMD Ryzen 3 or Athlon 3000 or better." />
        <Row k="Memory" v="4 GB RAM minimum." rec="8 GB" />
        <Row k="Hard drive" v="20 GB free, 60 GB total." rec="30 GB free" />
        <Row k="Monitor" v="1280 x 1024 or higher." rec="1920 x 1080. Some programs require two monitors." />
        <Row k="Ports" v="USB 3.0 port for your headset." />
        <div style={{ ...s.row, borderBottom: 0 }}>
          <div style={s.no}>Not supported</div>
          <div style={s.v}>Mac, Chromebook, netbooks, tablets, phones, and any ARM-based PC such as Microsoft Surface. Virtual machines (VMware, Parallels, VirtualBox) are not allowed.</div>
        </div>
      </div>

      <h2 style={s.h2}>Your internet</h2>
      <div style={s.card}>
        <Row k="Connection" v="Your PC must be plugged into your modem or router with an Ethernet cable. Wi-Fi is not allowed, even if it is fast." />
        <Row k="Speed" v="10 Mbps download, 3 Mbps upload, latency under 120 ms." rec="30 Mbps down, 10 Mbps up, under 50 ms" />
        <div style={{ ...s.row, borderBottom: 0 }}>
          <div style={s.no}>Not allowed</div>
          <div style={s.v}>Wi-Fi, cellular hotspots, 5G home internet, satellite (including Starlink), USB modems, VPNs and proxy services.</div>
        </div>
      </div>

      <h2 style={s.h2}>Headset, webcam and phone</h2>
      <div style={s.card}>
        <Row k="Headset" v="Hard-wired USB headset with phone-quality audio and a noise-cancelling mic. Bluetooth and 3.5 mm jack headsets will not pass. Examples: Plantronics Blackwire 3320, Logitech H570e, Jabra UC Voice. Typically $24 to $55." />
        <Row k="Webcam" v="Required for our client classes. You are on camera for class, role plays and a quick daily check-in." />
        <Row k="Smartphone" v="Any iOS or Android phone with a working camera, used only for the login code (multi-factor authentication). You cannot attend class or take calls on a phone." />
        <Row k="Keyboard and mouse" v="Hard-wired recommended." />
      </div>

      <h2 style={s.h2}>Settings and security</h2>
      <div style={s.card}>
        <ul style={s.list}>
          <li>Windows Firewall on, and Windows Security real-time protection on and up to date. Other antivirus software can conflict with the PC scan.</li>
          <li>An up-to-date browser: Edge, Chrome or Firefox.</li>
          <li>A quiet, private room. You service from your country of residence only.</li>
          <li>Use the same PC for the scan and for class. If you switch computers later, the new one has to pass the scan too.</li>
        </ul>
      </div>

      <a href={APPLY_URL} style={s.btn}>Join the talent pool</a>
      <p style={s.fine}>Some client programs have extra requirements, which we tell you about before you enrol. This checklist is based on the Arise System and Equipment Policy effective January 1, 2026. Equipment examples are for convenience only; ATAC Anagenesis Inc. is not affiliated with any retailer. Business opportunity on the Arise platform through ATAC Anagenesis Inc., not an offer of employment.</p>
    </div></div>
  );
}
