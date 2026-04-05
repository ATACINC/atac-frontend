import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TIERS = [
  {
    id: 'standard',
    name: 'Standard',
    price: 39,
    color: '#5DCAA5',
    features: [
      '40-question knowledge assessment',
      'ATAC Call Readiness Simulator™ (1 session)',
      'ERC-721 blockchain credential on pass',
      'PDF score report',
      'LinkedIn shareable badge',
    ],
    cta: 'Start for $39',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 59,
    color: '#378ADD',
    badge: 'Most Popular',
    features: [
      '40-question knowledge assessment',
      'ATAC Call Readiness Simulator™ (1 session)',
      'ERC-721 blockchain credential on pass',
      'PDF score report',
      'LinkedIn shareable badge',
      'Personalized gap analysis',
      'Custom development roadmap',
      '$20 credit toward full CRSA ($149)',
      '90-day score validity',
    ],
    cta: 'Start for $59',
  },
  {
    id: 'team',
    name: 'Team',
    price: 49,
    color: '#D4A843',
    features: [
      'Everything in Pro',
      'Team analytics dashboard',
      'Comparative candidate scoring',
      'ATS webhook integration',
      'Minimum 10 seats',
    ],
    cta: '$49/seat — Min 10 seats',
  },
];

export default function Payment() {
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(null);
  const [error,   setError]   = useState('');
  const [seats,   setSeats]   = useState(10);

  const candidateId = localStorage.getItem('atac_candidate_id');
  const token       = localStorage.getItem('atac_token');

  async function handlePay(tierId) {
    if (!candidateId) {
      setError('Session expired. Please log in again.');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    setLoading(tierId);
    setError('');

    try {
      const body = { candidateId, tier: tierId };
      if (tierId === 'team') body.seats = seats;

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/stripe/checkout`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Payment failed');

      // Redirect to Stripe Checkout
      window.location.href = data.url;

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(null);
    }
  }

  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>ATAC Global CX</div>
        <div style={styles.headerSub}>Blockchain-Verified CX Certification</div>
      </div>

      {/* Hero */}
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>Choose Your Assessment</h1>
        <p style={styles.heroSub}>
          Complete your 40-question assessment and ATAC Call Readiness Simulator™ session.
          Pass and earn a blockchain-verified credential — in 20 minutes.
        </p>
      </div>

      {/* Error */}
      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Tier cards */}
      <div style={styles.cards}>
        {TIERS.map(tier => (
          <div
            key={tier.id}
            style={{
              ...styles.card,
              borderColor: tier.badge ? tier.color : 'rgba(255,255,255,0.08)',
            }}
          >
            {tier.badge && (
              <div style={{ ...styles.badge, background: tier.color }}>
                {tier.badge}
              </div>
            )}

            <div style={styles.tierName}>{tier.name}</div>

            <div style={styles.priceRow}>
              <span style={{ ...styles.price, color: tier.color }}>
                ${tier.price}
              </span>
              {tier.id === 'team'
                ? <span style={styles.priceSub}>/seat</span>
                : <span style={styles.priceSub}>/one-time</span>
              }
            </div>

            {/* Seat selector for team */}
            {tier.id === 'team' && (
              <div style={styles.seatRow}>
                <label style={styles.seatLabel}>Seats</label>
                <input
                  type="number"
                  min={10}
                  value={seats}
                  onChange={e => setSeats(Math.max(10, parseInt(e.target.value) || 10))}
                  style={styles.seatInput}
                />
                <span style={styles.seatTotal}>
                  = ${(seats * 49).toLocaleString()} total
                </span>
              </div>
            )}

            <ul style={styles.features}>
              {tier.features.map((f, i) => (
                <li key={i} style={styles.feature}>
                  <span style={{ color: tier.color, marginRight: 8 }}>◆</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              style={{
                ...styles.btn,
                background:   loading === tier.id ? '#333' : tier.color,
                cursor:       loading === tier.id ? 'not-allowed' : 'pointer',
                opacity:      loading && loading !== tier.id ? 0.5 : 1,
              }}
              onClick={() => handlePay(tier.id)}
              disabled={!!loading}
            >
              {loading === tier.id ? 'Redirecting to Stripe…' : tier.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Trust line */}
      <div style={styles.trust}>
        🔒 Secured by Stripe &nbsp;·&nbsp; Blockchain credential on Polygon Mainnet &nbsp;·&nbsp; No subscription
      </div>

      {/* Cancelled state */}
      {new URLSearchParams(window.location.search).get('cancelled') && (
        <div style={styles.cancelledBanner}>
          Payment cancelled — no charge was made. Choose a tier above to continue.
        </div>
      )}

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight:       '100vh',
    background:      '#0D1B2E',
    color:           '#E8E6E0',
    fontFamily:      "'Inter', sans-serif",
    padding:         '0 0 60px',
  },
  header: {
    padding:         '20px 40px',
    borderBottom:    '1px solid rgba(255,255,255,0.06)',
    display:         'flex',
    alignItems:      'center',
    gap:             16,
  },
  logo: {
    fontSize:        18,
    fontWeight:      700,
    color:           '#5DCAA5',
    letterSpacing:   '0.5px',
  },
  headerSub: {
    fontSize:        12,
    color:           'rgba(255,255,255,0.4)',
  },
  hero: {
    textAlign:       'center',
    padding:         '60px 20px 40px',
  },
  heroTitle: {
    fontSize:        36,
    fontWeight:      700,
    margin:          '0 0 16px',
    color:           '#FFFFFF',
  },
  heroSub: {
    fontSize:        16,
    color:           'rgba(255,255,255,0.55)',
    maxWidth:        600,
    margin:          '0 auto',
    lineHeight:      1.6,
  },
  errorBanner: {
    background:      'rgba(220,50,50,0.15)',
    border:          '1px solid rgba(220,50,50,0.4)',
    color:           '#FF6B6B',
    padding:         '12px 24px',
    borderRadius:    8,
    margin:          '0 auto 24px',
    maxWidth:        800,
    textAlign:       'center',
    fontSize:        14,
  },
  cards: {
    display:         'flex',
    gap:             24,
    justifyContent:  'center',
    flexWrap:        'wrap',
    padding:         '0 24px',
    maxWidth:        1100,
    margin:          '0 auto',
  },
  card: {
    background:      'rgba(255,255,255,0.04)',
    border:          '1px solid',
    borderRadius:    16,
    padding:         '32px 28px',
    width:           320,
    position:        'relative',
    display:         'flex',
    flexDirection:   'column',
    gap:             0,
  },
  badge: {
    position:        'absolute',
    top:             -12,
    left:            '50%',
    transform:       'translateX(-50%)',
    padding:         '4px 16px',
    borderRadius:    20,
    fontSize:        11,
    fontWeight:      700,
    color:           '#0D1B2E',
    letterSpacing:   '0.5px',
    whiteSpace:      'nowrap',
  },
  tierName: {
    fontSize:        13,
    fontWeight:      600,
    letterSpacing:   '1px',
    textTransform:   'uppercase',
    color:           'rgba(255,255,255,0.5)',
    marginBottom:    12,
  },
  priceRow: {
    display:         'flex',
    alignItems:      'baseline',
    gap:             4,
    marginBottom:    8,
  },
  price: {
    fontSize:        48,
    fontWeight:      800,
    lineHeight:      1,
  },
  priceSub: {
    fontSize:        14,
    color:           'rgba(255,255,255,0.4)',
  },
  seatRow: {
    display:         'flex',
    alignItems:      'center',
    gap:             8,
    margin:          '8px 0 16px',
  },
  seatLabel: {
    fontSize:        13,
    color:           'rgba(255,255,255,0.5)',
  },
  seatInput: {
    width:           64,
    padding:         '4px 8px',
    background:      'rgba(255,255,255,0.08)',
    border:          '1px solid rgba(255,255,255,0.15)',
    borderRadius:    6,
    color:           '#fff',
    fontSize:        14,
    textAlign:       'center',
  },
  seatTotal: {
    fontSize:        13,
    color:           '#D4A843',
    fontWeight:      600,
  },
  features: {
    listStyle:       'none',
    padding:         0,
    margin:          '20px 0 28px',
    display:         'flex',
    flexDirection:   'column',
    gap:             10,
    flexGrow:        1,
  },
  feature: {
    fontSize:        13,
    color:           'rgba(255,255,255,0.7)',
    display:         'flex',
    alignItems:      'flex-start',
    lineHeight:      1.5,
  },
  btn: {
    width:           '100%',
    padding:         '14px 0',
    borderRadius:    8,
    border:          'none',
    fontSize:        14,
    fontWeight:      700,
    color:           '#0D1B2E',
    transition:      'opacity 0.2s',
    letterSpacing:   '0.3px',
  },
  trust: {
    textAlign:       'center',
    fontSize:        12,
    color:           'rgba(255,255,255,0.3)',
    marginTop:       40,
  },
  cancelledBanner: {
    background:      'rgba(212,168,67,0.12)',
    border:          '1px solid rgba(212,168,67,0.3)',
    color:           '#D4A843',
    padding:         '12px 24px',
    borderRadius:    8,
    margin:          '24px auto 0',
    maxWidth:        600,
    textAlign:       'center',
    fontSize:        14,
  },
};