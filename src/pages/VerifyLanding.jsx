// frontend/src/pages/VerifyLanding.jsx
// Employer verification portal landing page
// Route: /verify (app.atacglobalcx.com/verify)
// Flow: Employer pastes credential ID + enters email -> lead captured -> redirects to /verify/:credentialId

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'https://atac-backend-production.up.railway.app';

// Credential ID format: ATAC-C-YYYY-NNNNN (e.g., ATAC-C-2026-00002)
const CREDENTIAL_ID_REGEX = /^ATAC-C-\d{4}-\d{5}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function VerifyLanding() {
  const navigate = useNavigate();
  const [credentialId, setCredentialId] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    const cleanId = credentialId.trim().toUpperCase();
    if (!cleanId) e.credentialId = 'Credential ID required';
    else if (!CREDENTIAL_ID_REGEX.test(cleanId)) {
      e.credentialId = 'Format: ATAC-C-YYYY-NNNNN (e.g., ATAC-C-2026-00002)';
    }
    if (!email.trim()) e.email = 'Email required';
    else if (!EMAIL_REGEX.test(email.trim())) e.email = 'Enter a valid email';
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    setErrors({});
    setLoading(true);

    const cleanId = credentialId.trim().toUpperCase();

    try {
      // Lead capture - fire and forget, don't block verification on this
      fetch(`${API_BASE}/api/employer-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId: cleanId,
          email: email.trim().toLowerCase(),
          company: company.trim() || null,
          source: 'verify_landing',
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {}); // silent fail - don't block employer

      // Redirect to the existing verification result page
      navigate(`/verify/${cleanId}`);
    } catch (err) {
      console.error('Verify submit error:', err);
      // Still navigate - the verify page will show the real result
      navigate(`/verify/${cleanId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="https://atacglobalcx.com" className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-slate-900">ATAC</span>
            <span className="text-sm text-slate-500 font-medium">Global CX</span>
          </a>
          <a
            href="https://atacglobalcx.com/for-enterprise"
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            For Enterprise &rarr;
          </a>
        </div>
      </header>

      {/* Hero + Form */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-6 border border-emerald-200">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            BLOCKCHAIN-VERIFIED CREDENTIALS
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            Verify an ATAC Global CX Credential
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Paste a credential ID to confirm authenticity, score, and validity. Verification is
            instant and cryptographically proven on the blockchain.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8"
        >
          {/* Credential ID */}
          <div className="mb-5">
            <label htmlFor="credentialId" className="block text-sm font-semibold text-slate-900 mb-2">
              Credential ID
            </label>
            <input
              id="credentialId"
              type="text"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              placeholder="ATAC-C-2026-00002"
              className={`w-full px-4 py-3 rounded-lg border font-mono text-base tracking-wider uppercase
                ${errors.credentialId ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}
                focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900`}
              autoComplete="off"
              spellCheck="false"
              disabled={loading}
            />
            {errors.credentialId && (
              <p className="text-sm text-red-600 mt-1.5">{errors.credentialId}</p>
            )}
          </div>

          {/* Email */}
          <div className="mb-5">
            <label htmlFor="email" className="block text-sm font-semibold text-slate-900 mb-2">
              Your Work Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={`w-full px-4 py-3 rounded-lg border text-base
                ${errors.email ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}
                focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900`}
              autoComplete="email"
              disabled={loading}
            />
            {errors.email && <p className="text-sm text-red-600 mt-1.5">{errors.email}</p>}
            <p className="text-xs text-slate-500 mt-1.5">
              We&rsquo;ll send you the verification record for your files.
            </p>
          </div>

          {/* Company (optional) */}
          <div className="mb-6">
            <label htmlFor="company" className="block text-sm font-semibold text-slate-900 mb-2">
              Company <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme BPO Services"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-base
                focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              autoComplete="organization"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400
              text-white font-semibold py-3.5 rounded-lg transition-colors
              flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                </svg>
                Verifying&hellip;
              </>
            ) : (
              <>
                Verify Credential
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>

          <p className="text-xs text-slate-500 text-center mt-4">
            Free verification &middot; No account required &middot; Results in under 10 seconds
          </p>
        </form>

        {/* How it works */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              title: 'Paste credential ID',
              body: 'Find it on the candidate\u2019s certificate or LinkedIn profile.',
            },
            {
              step: '2',
              title: 'Blockchain check',
              body: 'We verify the credential against the on-chain record in real time.',
            },
            {
              step: '3',
              title: 'Instant result',
              body: 'See holder name, score breakdown, validity dates, and download proof.',
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 text-white font-bold text-sm mb-3">
                {item.step}
              </div>
              <h3 className="font-semibold text-slate-900 mb-1.5">{item.title}</h3>
              <p className="text-sm text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>

        {/* Enterprise CTA */}
        <div className="mt-12 bg-slate-900 rounded-2xl p-8 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Hiring at scale?
          </h2>
          <p className="text-slate-300 mb-6 max-w-md mx-auto">
            Get API access, bulk verification, and a custom employer dashboard for your hiring team.
          </p>
          <a
            href="mailto:enterprise@atacglobalcx.com?subject=Enterprise%20Verification%20API%20Inquiry"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Talk to sales
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </main>

      <footer className="border-t border-slate-200 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} ATAC Anagenesis Inc. &middot; ATAC Global CX &trade;
        </div>
      </footer>
    </div>
  );
}
