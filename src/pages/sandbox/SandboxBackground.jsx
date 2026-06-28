/**
 * ATAC Platform - SandboxBackground.jsx
 * Path: frontend/src/pages/sandbox/SandboxBackground.jsx
 *
 * Shared UI kit for the redesigned /sandbox flow. Despite the name this module
 * holds the whole post-gate shell:
 *   - SandboxBackground : ambient layers (grid + drifting glow + rotating seal
 *                         + full-width gold waveform), reused from the gate so
 *                         the flow continues visually from the entry screen.
 *   - SandboxFrame      : background + persistent chrome (header + 4-step
 *                         indicator OR a live-status slot + footer) + content.
 *   - SandboxConnecting : the "Connecting you to the call" screen.
 *   - MicOrb, ScoreDonut, Bars + small inline icons : design primitives.
 *
 * No business logic lives here. The gate is NOT rebuilt; only its background
 * recipe and seal asset are reused.
 */

import { T, SANDBOX_CSS } from './sandboxTheme';
import brandLogo from '../../assets/atac-globalcx-logo-header.png';
import certificateSeal from '../../assets/agcx-certificate-seal-cropped.png';

const SIM_NAME = 'Call Readiness Simulator(TM)';

/* ---------- animated bar group (waveform / mic bars / call wave) ---------- */
export function Bars({ count, maxH, width = 3, gap = 3, color, running = true, justify = 'center' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', justifyContent: justify, gap, width: justify === 'space-between' ? '100%' : 'auto' }}>
      {Array.from({ length: count }, (_, i) => {
        const h = Math.round(maxH * (0.34 + 0.66 * Math.abs(Math.sin(i * 0.7 + 1))));
        return (
          <span
            key={i}
            style={{
              display: 'block', width, height: h, borderRadius: 3, transformOrigin: 'bottom',
              background: color,
              animation: `sbxWave ${0.8 + (i % 5) * 0.13}s ease-in-out infinite`,
              animationDelay: `${i * 0.06}s`,
              animationPlayState: running ? 'running' : 'paused',
            }}
          />
        );
      })}
    </span>
  );
}

/* ---------- ambient background (reused from the gate) ---------- */
export function SandboxBackground() {
  return (
    <>
      {/* top gold hairline */}
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.55), transparent)', zIndex: 30 }} />
      {/* drifting gold glow */}
      <div aria-hidden="true" style={{ position: 'absolute', top: '4%', left: '60%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12), rgba(201,168,76,0) 62%)', filter: 'blur(22px)', animation: 'sbxGlowDrift 16s ease-in-out infinite', pointerEvents: 'none', zIndex: 0 }} />
      {/* faint 96px vertical grid */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 96px)', pointerEvents: 'none', zIndex: 0 }} />
      {/* slow rotating seal watermark */}
      <img src={certificateSeal} alt="" aria-hidden="true" style={{ position: 'absolute', right: -180, top: '50%', width: 680, height: 'auto', opacity: 0.05, pointerEvents: 'none', userSelect: 'none', zIndex: 0, animation: 'sbxSpin 120s linear infinite' }} />
      {/* full-width gold waveform along the bottom edge */}
      <div aria-hidden="true" className="sbx-wave-band" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, display: 'flex', alignItems: 'flex-end', opacity: 0.22, pointerEvents: 'none', zIndex: 0, WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 2.5%, #000 97.5%, transparent 100%)', maskImage: 'linear-gradient(90deg, transparent 0, #000 2.5%, #000 97.5%, transparent 100%)' }}>
        <Bars count={84} maxH={84} width={3} gap={0} justify="space-between" color="linear-gradient(180deg, rgba(201,168,76,0), rgba(201,168,76,0.85))" />
      </div>
    </>
  );
}

/* ---------- 4-step progress indicator ---------- */
const STEP_LABELS = ['Ready', 'Briefing', 'Live Call', 'Debrief'];

export function StepIndicator({ active }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STEP_LABELS.map((label, i) => {
        const done = i < active;
        const cur = i === active;
        const ring = cur ? T.gold : done ? 'rgba(239,192,60,0.5)' : 'rgba(255,255,255,0.16)';
        const fill = cur ? `linear-gradient(135deg, ${T.goldBright}, ${T.gold})` : 'transparent';
        const fg = cur ? '#1A1206' : done ? T.goldSoft : 'rgba(131,135,145,0.5)';
        const labelColor = cur ? '#F1ECDF' : done ? T.muted : T.faint2;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px' }}>
            <span className={`sbx-step-dot ${cur ? 'sbx-step-cur' : done ? 'sbx-step-done' : 'sbx-step-future'}`} style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, border: `1px solid ${ring}`, background: fill, color: fg, transition: 'all 0.25s' }}>
              {done ? <CheckIcon size={12} color={T.goldSoft} /> : i + 1}
            </span>
            <span className="sbx-steps-labels" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: labelColor, whiteSpace: 'nowrap' }}>{label}</span>
            {i < 3 && <span className="sbx-steps-labels" aria-hidden="true" style={{ width: 26, height: 1, background: 'rgba(255,255,255,0.12)', margin: '0 10px' }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- persistent frame: background + header + main + footer ---------- */
export function SandboxFrame({ step = null, headerRight = null, children }) {
  const showTitle = !headerRight;
  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%', overflowX: 'hidden', background: `radial-gradient(1100px 720px at 66% 6%, rgba(201,168,76,0.10), rgba(201,168,76,0) 60%), radial-gradient(900px 640px at 8% 92%, rgba(26,143,105,0.16), rgba(26,143,105,0) 62%), ${T.bg}`, color: T.muted, fontFamily: T.fontBody, display: 'flex', flexDirection: 'column' }}>
      <style>{SANDBOX_CSS}</style>
      <SandboxBackground />

      <header className="sbx-chrome" style={{ position: 'relative', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '18px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,11,18,0.55)', backdropFilter: 'blur(8px)' }}>
        <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <img src={brandLogo} alt="ATAC Global CX" className="sbx-logo" style={{ height: 38, width: 'auto', display: 'block', filter: 'drop-shadow(0 4px 14px rgba(239,192,60,0.16))' }} />
          {showTitle && (
            <span className="sbx-wordmark" style={{ display: 'inline-flex', alignItems: 'center', gap: 18 }}>
              <span aria-hidden="true" style={{ height: 26, width: 1, background: 'rgba(255,255,255,0.1)', flex: '0 0 auto' }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.26em', textTransform: 'uppercase', color: '#8A8F9C', whiteSpace: 'nowrap' }}>{SIM_NAME}</span>
            </span>
          )}
        </div>
        <div className="sbx-chrome-right" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', minWidth: 0 }}>
          {headerRight || (step != null ? <StepIndicator active={step} /> : null)}
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>

      <footer className="sbx-chrome" style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 40px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(0deg, rgba(8,11,18,0.96), rgba(8,11,18,0.55))', fontSize: 11, letterSpacing: '0.08em', color: T.faint2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          2026 ATAC Global CX
          <Dot />
          {SIM_NAME}
        </span>
        <span style={{ color: '#7B7F89' }}>app.atacglobalcx.com/sandbox</span>
      </footer>
    </div>
  );
}

/* ---------- connecting screen (chunk load + pre-live) ---------- */
export function SandboxConnecting() {
  return (
    <section className="sbx-fade sbx-pad" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 40px 72px' }}>
      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <MicOrb />
        <h1 className="sbx-h" style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontSize: 'clamp(28px, 3.6vw, 38px)', lineHeight: 1.12, margin: '28px 0 14px', color: T.ink }}>Connecting you to the call</h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: T.muted, margin: '0 auto 22px', maxWidth: 420 }}>
          Allow microphone access when your browser asks. The customer will be on the line in a moment.
        </p>
        <span aria-hidden="true" style={{ display: 'inline-flex', gap: 7 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: T.gold, animation: `sbxDots 1.2s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
        </span>
      </div>
    </section>
  );
}

/* ---------- design primitives ---------- */
export function MicOrb({ size = 96 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto', borderRadius: '50%', background: 'radial-gradient(circle at 50% 38%, #14233c, #0a1322)', border: '1px solid rgba(239,192,60,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'sbxRingPulse 2.6s ease-out infinite' }}>
      <MicIcon size={Math.round(size * 0.36)} color={T.goldBright} />
    </div>
  );
}

export function ScoreDonut({ value }) {
  const v = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Math.round(Number(value)))) : null;
  const R = 52;
  const C = 2 * Math.PI * R;
  const off = v == null ? C : C * (1 - v / 100);
  return (
    <svg width="122" height="122" viewBox="0 0 122 122" role="img" aria-label={v == null ? 'Score unavailable' : `Demonstration score ${v} out of 100`}>
      <defs>
        <linearGradient id="sbxRingGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE39A" />
          <stop offset="60%" stopColor="#EFC03C" />
          <stop offset="100%" stopColor="#CC9A2E" />
        </linearGradient>
      </defs>
      <circle cx="61" cy="61" r={R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="9" />
      <circle cx="61" cy="61" r={R} fill="none" stroke="url(#sbxRingGrad)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 61 61)" />
      <text x="61" y="60" textAnchor="middle" dominantBaseline="middle" fontFamily={T.fontDisplay} fontSize="40" fill={T.goldBright}>{v == null ? 'NA' : v}</text>
      <text x="61" y="86" textAnchor="middle" dominantBaseline="middle" fontFamily={T.fontBody} fontSize="10" letterSpacing="2" fill="#7B7F89">OUT OF 100</text>
    </svg>
  );
}

export function Dot({ color = T.faint2, size = 4 }) {
  return <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: color, flex: '0 0 auto' }} />;
}

/* ---------- inline icons (ASCII-safe, no text) ---------- */
export function MicIcon({ size = 16, color = T.goldBright }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

export function ArrowIcon({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}

export function InfoIcon({ size = 17, color = T.goldSoft }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function CheckIcon({ size = 16, color = T.goldSoft }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function WarnIcon({ size = 34, color = '#E8B968' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function PhoneOffIcon({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" transform="rotate(135 12 12)" />
    </svg>
  );
}
