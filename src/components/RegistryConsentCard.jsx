import { useState, useEffect } from 'react';
import API from '../api/client';
import { useToast } from '../hooks/useToast';

const GOLD = '#C9A84C';
const TEAL2 = '#22A67E';
const WHITE = '#EEE9DF';
const MUTED = 'rgba(238,233,223,0.45)';
const BORDER = 'rgba(201,168,76,0.15)';
const BORDER2 = 'rgba(238,233,223,0.07)';
const VAULT_BODY = "'Syne', 'DM Sans', sans-serif";

export default function RegistryConsentCard() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(false);
  const [hasCred, setHasCred] = useState(false);

  useEffect(() => {
    let active = true;
    API.get('/api/candidate/me/registry-consent')
      .then((res) => {
        if (!active) return;
        setConsent(!!res.data.consent);
        setHasCred(!!res.data.hasActiveCredential);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading || !hasCred) return null;

  const toggle = async () => {
    if (saving) return;
    const next = !consent;
    setConsent(next);
    setSaving(true);
    try {
      const res = await API.patch('/api/candidate/me/registry-consent', { consent: next });
      setConsent(!!res.data.consent);
      showToast(
        next ? 'Your name will now show on the public registry.'
             : 'Your name is now hidden on the public registry.',
        { type: 'success' }
      );
    } catch (err) {
      setConsent(!next);
      showToast('Could not update that setting. Please try again.', {
        type: 'error', title: 'Update failed',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: consent ? 'rgba(34,166,126,0.05)' : 'rgba(201,168,76,0.05)',
      border: `1px solid ${consent ? 'rgba(34,166,126,0.18)' : BORDER}`,
      borderRadius: 4, padding: '22px 24px',
    }}>
      <div style={{ fontSize: 12, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10, fontFamily: VAULT_BODY }}>
        Public Registry
      </div>
      <div style={{ fontSize: 14, color: MUTED, marginBottom: 16, lineHeight: 1.65, fontFamily: VAULT_BODY }}>
        When this is on, your first name and last initial appear next to your credential on our public wall (for example, Jordan M.). When off, your credential is still listed, just without your name.
      </div>
      <button type="button" role="switch" aria-checked={consent}
        aria-label="Show my name on the public registry"
        onClick={toggle} disabled={saving}
        style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', padding: 0, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: VAULT_BODY }}>
        <span style={{ width: 44, height: 24, borderRadius: 12, background: consent ? TEAL2 : BORDER2, border: `1px solid ${consent ? 'rgba(34,166,126,0.5)' : BORDER2}`, position: 'relative', transition: 'background 0.15s ease', flexShrink: 0 }}>
          <span style={{ position: 'absolute', top: 2, left: consent ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: WHITE, transition: 'left 0.15s ease' }} />
        </span>
        <span style={{ fontSize: 14, color: consent ? WHITE : MUTED }}>
          {consent ? 'Showing my name' : 'Show my name on the registry'}
        </span>
      </button>
    </div>
  );
}
