/**
 * ATAC Platform -- shared SMS phone + consent capture.
 * File: src/components/SmsConsentCapture.jsx
 *
 * ONE source of truth for the optional mobile field, the CASL consent
 * checkbox, SMS_CONSENT_VERSION and SMS_CONSENT_COPY. Used in three places:
 *
 *   1. Register form (pages/Login.jsx)       -> <SmsConsentFields />  (controlled)
 *   2. Post-payment confirmation (Dashboard)  -> <SmsConsentCapture source="post_payment_v1" />
 *   3. Assessment passed (Assessment result)  -> <SmsConsentCapture source="post_pass_v1" />
 *
 * Rules that must never change (CASL / TCPA):
 *   - the mobile field is OPTIONAL and never gates the surrounding flow
 *   - the consent checkbox is UNTICKED by default and disabled until a valid
 *     number is present; it is never pre-ticked
 *   - the copy states "Consent is not a condition of registration"
 *   - consent is submitted only when a valid E.164 AND the box are both present
 *
 * <SmsConsentCapture> is self-contained: it asks GET /api/candidate/me/sms-consent
 * and renders NOTHING when the candidate already has a phone on file, then
 * PATCHes /api/candidate/me/sms-consent on save (see atac-backend
 * routes/candidate.js). Fail-quiet: any API error hides the card rather than
 * blocking the screen it sits on.
 */

import { useEffect, useState } from 'react';
import API from '../api/client';
import { dialPrefix, normalizeToE164, isValidPhone, getPhoneError } from '../utils/phone';
import { color as ds, font as dsFont, goldButton } from '../designSystem/tokens';

export const SMS_CONSENT_VERSION = '1.0';
export const SMS_CONSENT_COPY =
  'Text me about my ATAC credential, deadlines, and offers at this number. ' +
  'Msg & data rates may apply. Reply STOP to opt out. Consent is not a condition of registration.';

/* Vault tokens (mirror pages/Login.jsx so the register form is pixel-identical) */
const GOLD     = '#C9A84C';
const WHITE    = '#EEE9DF';
const MUTED    = 'rgba(238,233,223,0.62)';
const RED      = '#E05C52';
const BORDER2  = 'rgba(238,233,223,0.08)';
const VAULT_BODY = "'Syne', 'DM Sans', system-ui, sans-serif";

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(8,11,18,0.6)', border: `1px solid ${BORDER2}`, borderRadius: 3,
  color: WHITE, fontFamily: VAULT_BODY, fontSize: 18, padding: '18px 20px', outline: 'none',
};

/**
 * Controlled phone + consent fields. The parent owns state so the register
 * form can read the values at submit time exactly as before.
 *
 * Props: phone, setPhone, smsConsent, setSmsConsent, country (ISO alpha-2),
 *        phoneError, setPhoneError, Field (optional label wrapper from the
 *        host page; falls back to a plain label), inputClassName (optional).
 */
export function SmsConsentFields({
  phone, setPhone, smsConsent, setSmsConsent, country,
  phoneError, setPhoneError, Field, inputClassName,
}) {
  const smsAllowed = isValidPhone(normalizeToE164(phone, country), country);
  const Wrap = Field || DefaultField;

  return (
    <>
      <Wrap label="Mobile Number (optional)">
        <input
          type="tel"
          className={inputClassName}
          style={inputClassName ? undefined : inputStyle}
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          placeholder="+1 555 123 4567"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
          onBlur={() => {
            const e164 = normalizeToE164(phone, country);
            if (e164) setPhone(e164);
            setPhoneError(getPhoneError(e164, country));
            if (!isValidPhone(e164, country)) setSmsConsent(false);
          }}
        />
        {phoneError && (
          <div style={{ fontSize: 14, color: RED, marginTop: 6 }}>{phoneError}</div>
        )}
      </Wrap>

      <label
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          margin: '2px 0 18px',
          cursor: smsAllowed ? 'pointer' : 'not-allowed',
          opacity: smsAllowed ? 1 : 0.5,
        }}
      >
        <input
          type="checkbox"
          checked={smsConsent}
          disabled={!smsAllowed}
          onChange={(e) => setSmsConsent(e.target.checked)}
          style={{
            marginTop: 3,
            width: 20,
            height: 20,
            accentColor: GOLD,
            cursor: smsAllowed ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 15, lineHeight: 1.55, color: MUTED }}>
          {SMS_CONSENT_COPY}
        </span>
      </label>
    </>
  );
}

function DefaultField({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontFamily: VAULT_BODY, fontSize: 14, fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: 10,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Self-contained high-intent capture card.
 * Props: source ('post_payment_v1' | 'post_pass_v1'), title, body (optional copy),
 *        style (optional wrapper override).
 */
export default function SmsConsentCapture({ source, title, body, style }) {
  const [visible, setVisible]       = useState(false);
  const [country, setCountry]       = useState('');
  const [phone, setPhone]           = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    let alive = true;
    API.get('/api/candidate/me/sms-consent')
      .then((res) => {
        if (!alive) return;
        const d = res.data || {};
        if (d.hasPhone) return;            // already on file: render nothing
        const iso = d.countryCode || '';
        setCountry(iso);
        setPhone(dialPrefix(iso));
        setVisible(true);
      })
      .catch(() => { /* fail-quiet: never block the host screen */ });
    return () => { alive = false; };
  }, []);

  if (!visible) return null;

  const e164 = normalizeToE164(phone, country);
  const canSave = Boolean(e164 && isValidPhone(e164, country) && smsConsent) && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true); setError('');
    try {
      await API.patch('/api/candidate/me/sms-consent', {
        phone: e164,
        smsConsent: true,
        smsConsentTextVersion: SMS_CONSENT_VERSION,
        source,
      });
      setSaved(true);
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'PHONE_ON_FILE') { setVisible(false); return; }
      setError(err?.response?.data?.error || 'Could not save your number. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid={`sms-capture-${source}`}
      className="vault-up"
      style={{
        background: ds.panel, border: `1px solid ${ds.border}`, borderRadius: 4,
        padding: '24px 28px', marginBottom: 28, ...style,
      }}
    >
      <div style={{ fontFamily: dsFont.display, fontSize: 22, color: ds.heading, marginBottom: 6 }}>
        {saved ? 'Text updates on' : (title || 'Get text updates')}
      </div>
      <div style={{ fontSize: 14, color: ds.body, lineHeight: 1.6, marginBottom: saved ? 0 : 18 }}>
        {saved
          ? `We'll text ${e164} with key updates. Reply STOP at any time to opt out.`
          : (body || 'Optional. Add your mobile and we will text you deadlines and next steps so nothing slips.')}
      </div>

      {!saved && (
        <>
          <SmsConsentFields
            phone={phone} setPhone={setPhone}
            smsConsent={smsConsent} setSmsConsent={setSmsConsent}
            country={country}
            phoneError={phoneError} setPhoneError={setPhoneError}
          />
          {error && <div style={{ fontSize: 14, color: RED, marginBottom: 12 }}>{error}</div>}
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            style={{ ...goldButton, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}
          >
            {saving ? 'Saving...' : 'Save my number'}
          </button>
        </>
      )}
    </div>
  );
}
