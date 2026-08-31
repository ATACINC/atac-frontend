/**
 * VerifyEmail: the one-click landing page for the link in the verification
 * email.  Route: /verify-email?id=<candidateId>&t=<token>
 *
 * NOT /verify. That route is VerifyLanding, the PUBLIC CREDENTIAL CHECKER, a
 * different product surface with no email-verification capability. The
 * verification email's primary button pointed there from 2026-06-24 until this
 * change, so anyone clicking the obvious button landed somewhere that could not
 * verify them and offered no way onward. VerifyLanding is untouched.
 *
 * WHY A BUTTON RATHER THAN VERIFYING ON LOAD. The token is single use.
 * Corporate mail scanners and inbox prefetchers follow links in email, so
 * verifying in a useEffect would let a scanner spend the token before the human
 * ever clicked, and the person would arrive at an already-dead link. The click
 * is what spends it, and the API call is a POST for the same reason.
 *
 * ADDITIVE. If anything here fails the user is exactly where they are today:
 * the failure state offers the existing 6-digit code entry, which is unchanged
 * and remains the primary path.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

const API_BASE =
  import.meta.env.VITE_API_URL || 'https://atac-backend-production.up.railway.app';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const candidateId = params.get('id') || '';
  const token = params.get('t') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const missing = !candidateId || !token;

  async function handleVerify() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-email-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'This verification link is no longer valid.');
        setLoading(false);
        return;
      }

      // Land authenticated, exactly as the code path does.
      if (data.token) localStorage.setItem('atac_token', data.token);
      if (data.candidate) {
        localStorage.setItem('atac_candidate', JSON.stringify(data.candidate));
      }
      navigate('/payment');
    } catch (err) {
      console.error('[verify-email] error', err);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f4f5f7', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      fontFamily: 'Arial, Helvetica, sans-serif',
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e3e6ea', borderRadius: 8,
        maxWidth: 520, width: '100%', padding: 32,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0D1B2E' }}>ATAC Global CX</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 24 }}>
          Blockchain-Verified CX Certification
        </div>

        <h1 style={{ fontSize: 20, margin: '0 0 12px', color: '#0D1B2E' }}>Verify your email</h1>

        {missing ? (
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#3a3f47' }}>
            This link is missing information. You can still verify with the 6 digit
            code from your email.
          </p>
        ) : (
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#3a3f47', margin: '0 0 22px' }}>
            One click and you are done.
          </p>
        )}

        {error && (
          <div role="alert" style={{
            background: '#fdf1f1', border: '1px solid #f2c9c9', borderRadius: 6,
            padding: '12px 14px', fontSize: 14, color: '#8a2020', margin: '0 0 18px',
          }}>
            {error}
          </div>
        )}

        {!missing && (
          <button
            type="button"
            onClick={handleVerify}
            disabled={loading}
            style={{
              background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 6,
              padding: '12px 26px', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Verifying...' : 'Verify my email'}
          </button>
        )}

        {/* A dead or expired link must degrade into today's behaviour, not a
            dead end. The 6 digit code entry lives on the payment step. */}
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#6b7280', margin: '22px 0 0' }}>
          Prefer to use the code, or this link did not work?{' '}
          <Link to="/payment" style={{ color: '#0D1B2E' }}>
            Enter your 6 digit code
          </Link>
          . If you are not signed in you will be asked to sign in first.
        </p>
      </div>
    </div>
  );
}
