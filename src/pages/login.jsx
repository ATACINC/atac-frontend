import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import API from '../api/client';
import LanguageSelector from '../components/LanguageSelector';

const styles = {
  page:     { minHeight: '100vh', background: '#0D1B2E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' },
  card:     { background: '#122238', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 420, position: 'relative' },
  langRow:  { position: 'absolute', top: 16, right: 16 },
  logo:     { fontFamily: 'Georgia, serif', fontSize: 22, color: '#D4A843', letterSpacing: '0.06em', marginBottom: 4 },
  sub:      { fontSize: 12, color: 'rgba(245,243,238,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 32 },
  tabs:     { display: 'flex', marginBottom: 28, borderBottom: '1px solid rgba(245,243,238,0.1)' },
  tab:      (active) => ({ padding: '8px 20px', fontSize: 13, cursor: 'pointer', color: active ? '#D4A843' : 'rgba(245,243,238,0.5)', background: 'none', border: 'none', borderBottom: active ? '2px solid #D4A843' : '2px solid transparent', fontFamily: 'DM Sans, sans-serif' }),
  label:    { display: 'block', fontSize: 11, color: 'rgba(245,243,238,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 },
  labelOpt: { display: 'block', fontSize: 11, color: 'rgba(245,243,238,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 },
  input:    { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,243,238,0.1)', borderRadius: 6, padding: '10px 14px', fontSize: 14, color: '#F5F3EE', marginBottom: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' },
  inputOpt: { width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,243,238,0.08)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'rgba(245,243,238,0.7)', marginBottom: 4, outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' },
  hint:     { fontSize: 11, color: 'rgba(245,243,238,0.3)', marginBottom: 16, lineHeight: 1.4 },
  btn:      { width: '100%', background: '#D4A843', color: '#0D1B2E', border: 'none', borderRadius: 6, padding: '13px', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', marginTop: 8, fontFamily: 'DM Sans, sans-serif' },
  error:    { background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#E24B4A', marginBottom: 16 },
  divider:  { borderTop: '1px solid rgba(245,243,238,0.08)', margin: '20px 0 16px' },
  hint2:    { fontSize: 11, color: 'rgba(245,243,238,0.25)', marginBottom: 16, letterSpacing: '0.05em', textTransform: 'uppercase' },
};

function isValidWallet(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export default function Login() {
  const { t } = useTranslation();
  const [tab, setTab]       = useState('login');
  const [form, setForm]     = useState({ name: '', email: '', password: '', walletAddress: '' });
  const [error, setError]   = useState('');
  const [walletError, setWalletError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handle = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === 'walletAddress') setWalletError('');
  };

  const submit = async () => {
    setError('');
    setWalletError('');
    if (tab === 'register' && form.walletAddress && !isValidWallet(form.walletAddress)) {
      setWalletError('Invalid wallet address — must start with 0x and be 42 characters');
      return;
    }
    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload  = tab === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password, walletAddress: form.walletAddress || null };
      const res = await API.post(endpoint, payload);
      localStorage.setItem('atac_token',        res.data.token);
      localStorage.setItem('atac_candidate',    JSON.stringify(res.data.candidate));
      localStorage.setItem('atac_candidate_id', res.data.candidate.id);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Language selector — top right of card */}
        <div style={styles.langRow}>
          <LanguageSelector />
        </div>

        <div style={styles.logo}>{t('app.name')}</div>
        <div style={styles.sub}>{t('app.tagline')}</div>

        <div style={styles.tabs}>
          <button style={styles.tab(tab === 'login')}
            onClick={() => { setTab('login'); setError(''); }}>
            {t('auth.signIn')}
          </button>
          <button style={styles.tab(tab === 'register')}
            onClick={() => { setTab('register'); setError(''); }}>
            {t('auth.createAccount')}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {tab === 'register' && (
          <>
            <label style={styles.label} htmlFor="name">{t('auth.fullName')}</label>
<input style={styles.input} id="name" name="name" autoComplete="name"
              placeholder={t('auth.namePlaceholder')}
              value={form.name} onChange={handle} />
          </>
        )}

        <label style={styles.label} htmlFor="email">{t('auth.email')}</label>
<input style={styles.input} id="email" name="email" type="email" autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          value={form.email} onChange={handle} />

        <label style={styles.label} htmlFor="password">{t('auth.password')}</label>
<input style={styles.input} id="password" name="password" type="password" autoComplete="current-password"
          placeholder="••••••••"
          value={form.password} onChange={handle} />

        {tab === 'register' && (
          <>
            <div style={styles.divider} />
            <div style={styles.hint2}>Optional — Blockchain Credential</div>
            <label style={styles.labelOpt}>Wallet Address</label>
            <input
              style={{ ...styles.inputOpt, border: walletError ? '1px solid rgba(226,75,74,0.5)' : styles.inputOpt.border }}
              name="walletAddress"
              placeholder="0x... (MetaMask or any EVM wallet)"
              value={form.walletAddress}
              onChange={handle}
            />
            {walletError
              ? <div style={{ fontSize: 11, color: '#E24B4A', marginBottom: 12 }}>{walletError}</div>
              : <div style={styles.hint}>Your credential will be minted to this address. You can add this later from your dashboard.</div>
            }
          </>
        )}

        <button style={styles.btn} onClick={submit} disabled={loading}>
          {loading
            ? t('auth.signingIn')
            : tab === 'login' ? t('auth.signIn') : t('auth.createAccount')
          }
        </button>
      </div>
    </div>
  );
}