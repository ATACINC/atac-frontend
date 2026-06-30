/**
 * ATAC Platform - ContactSalesModal.jsx
 * Path: frontend/src/components/ContactSalesModal.jsx
 *
 * Lead-capture modal for the pricing Team (contact-only) plan, built on the
 * shared ModalShell (backdrop blur-in, focus-trap, Esc, click-outside, and
 * reduced-motion handling come from there). Captcha is wired with the existing
 * useHcaptcha hook exactly as VerifyLanding/Login do (enabled while open).
 *
 * Submits POST /api/sales-leads with { company, contactName, email, teamSize,
 * message, website (hidden honeypot), hcaptchaToken }. Success shows a
 * confirmation; 400 validation and 429 rate-limit/captcha errors surface inline.
 * No Stripe checkout is involved.
 */

import { useState } from 'react';
import ModalShell from './chrome/ModalShell';
import { useHcaptcha } from '../hooks/useHcaptcha';
import { color, font, radius, goldButton } from '../designSystem/tokens';

const API_BASE = import.meta.env.VITE_API_URL;

const EMPTY = { company: '', contactName: '', email: '', teamSize: '', message: '', website: '' };

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '11px 14px', marginTop: 6,
  background: 'rgba(255,255,255,0.03)',
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  color: color.heading, fontSize: 15, fontFamily: font.body,
  outline: 'none',
};
const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
  color: color.secondary, marginBottom: 2,
};

function Field({ label, value, onChange, type = 'text', required, placeholder, textarea }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={labelStyle}>{label}</span>
      {textarea ? (
        <textarea value={value} onChange={onChange} rows={3} placeholder={placeholder} style={{ ...inputStyle, resize: 'vertical' }} />
      ) : (
        <input type={type} value={value} onChange={onChange} required={required} placeholder={placeholder} style={inputStyle} />
      )}
    </label>
  );
}

export default function ContactSalesModal({ open, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Captcha mounts only while the modal is open; enabled tracks that so the
  // widget renders on open and is torn down on close (same pattern as Login).
  const { token, reset, containerRef } = useHcaptcha({ enabled: open });

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    if (error) setError('');
  };

  const close = () => {
    setForm(EMPTY);
    setError('');
    setDone(false);
    setSubmitting(false);
    reset();
    onClose?.();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.company.trim()) { setError('Company is required.'); return; }
    if (!form.email.trim()) { setError('Work email is required.'); return; }
    if (!token) { setError('Please complete the captcha.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/sales-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: form.company.trim(),
          contactName: form.contactName.trim(),
          email: form.email.trim(),
          teamSize: form.teamSize.trim(),
          message: form.message.trim(),
          website: form.website, // honeypot: real users never see/fill this
          hcaptchaToken: token,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 400) { setError(data.error || 'Please check the form and try again.'); reset(); setSubmitting(false); return; }
      if (res.status === 429) { setError(data.error || 'Too many requests. Please wait a moment and try again.'); reset(); setSubmitting(false); return; }
      if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); reset(); setSubmitting(false); return; }

      setDone(true);
      setSubmitting(false);
    } catch {
      setError('Network error. Please try again.');
      reset();
      setSubmitting(false);
    }
  };

  const ghostBtn = {
    background: 'transparent', border: `1px solid ${color.border}`, color: color.body,
    borderRadius: radius.sm, padding: '13px 20px', fontFamily: font.body, fontSize: 13,
    fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
  };

  return (
    <ModalShell open={open} onClose={close} labelledBy="contact-sales-title">
      <div style={{ padding: '32px 34px', fontFamily: font.body, color: color.body, maxWidth: 560 }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <h2 id="contact-sales-title" style={{ fontFamily: font.display, fontWeight: 500, fontSize: 26, color: color.heading, margin: '0 0 12px' }}>
              Thanks, we will be in touch
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: color.body, margin: '0 0 24px' }}>
              Your message reached our sales team. We typically reply within one business day.
            </p>
            <button type="button" onClick={close} style={goldButton}>Close</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="ds-eyebrow" style={{ marginBottom: 10 }}>Team plan</div>
            <h2 id="contact-sales-title" style={{ fontFamily: font.display, fontWeight: 500, fontSize: 26, color: color.heading, margin: '0 0 6px' }}>
              Contact sales
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: color.secondary, margin: '0 0 22px' }}>
              Tell us about your team and we will put together the right plan.
            </p>

            {/* Honeypot: hidden from real users; a filled value flags a bot. */}
            <input
              type="text" name="website" value={form.website} onChange={set('website')}
              tabIndex={-1} autoComplete="off" aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            <Field label="Company *" value={form.company} onChange={set('company')} required />
            <Field label="Contact name" value={form.contactName} onChange={set('contactName')} />
            <Field label="Work email *" type="email" value={form.email} onChange={set('email')} required />
            <Field label="Team size" value={form.teamSize} onChange={set('teamSize')} placeholder="e.g. 25" />
            <Field label="Message" value={form.message} onChange={set('message')} textarea />

            <div ref={containerRef} style={{ margin: '6px 0 14px' }} />

            {error && <div role="alert" style={{ fontSize: 13, color: color.red, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={close} disabled={submitting} style={ghostBtn}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...goldButton, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Sending...' : 'Send message'}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalShell>
  );
}
