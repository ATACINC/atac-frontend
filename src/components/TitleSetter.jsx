import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Centralized document.title management.
//
// Rendered once inside <BrowserRouter> in App.jsx. Watches useLocation
// and sets document.title on every route change from the path-to-title
// map below. No per-page wiring required; adding a new route only
// requires appending an entry here.
//
// Brand rule: separators in titles use middle-dot U+00B7 (·). NO
// em-dashes (U+2014) or en-dashes (U+2013) anywhere in this file.

const BRAND_SUFFIX = 'ATAC Global CX';
const DEFAULT_TITLE = BRAND_SUFFIX;
const FALLBACK_TITLE = `Page not found · ${BRAND_SUFFIX}`;

// Order matters: more specific patterns first so that, for example, the
// /login?action=register branch fires before the bare /login entry.
const ROUTE_TITLES = [
  {
    match: (p, s) =>
      p === '/login' && new URLSearchParams(s).get('action') === 'register',
    title: `Create account · ${BRAND_SUFFIX}`,
  },
  { match: (p) => p === '/login',      title: `Sign in · ${BRAND_SUFFIX}` },
  { match: (p) => p === '/signup',     title: `Create account · ${BRAND_SUFFIX}` },
  { match: (p) => p === '/forgot-password', title: `Reset password · ${BRAND_SUFFIX}` },
  { match: (p) => p === '/reset-password',  title: `Set a new password · ${BRAND_SUFFIX}` },
  { match: (p) => p === '/payment',    title: `Verify your email · ${BRAND_SUFFIX}` },
  { match: (p) => p === '/assessment', title: `Readiness Assessment · ${BRAND_SUFFIX}` },
  { match: (p) => p === '/dashboard',  title: `Dashboard · ${BRAND_SUFFIX}` },
  { match: (p) => p === '/employer',   title: `Employer portal · ${BRAND_SUFFIX}` },
  { match: (p) => p === '/try',        title: `Try the platform · ${BRAND_SUFFIX}` },
  { match: (p) => p === '/verify',     title: `Verify a credential · ${BRAND_SUFFIX}` },
  {
    match: (p) => /^\/verify\/[^/]+$/.test(p),
    title: `Credential verification · ${BRAND_SUFFIX}`,
  },
  {
    match: (p) => p === '/simulator' || p === '/simulator/',
    title: `Call Readiness Simulator · ${BRAND_SUFFIX}`,
  },
  {
    match: (p) => /^\/simulator\/briefing\/[^/]+$/.test(p),
    title: `Scenario briefing · ${BRAND_SUFFIX}`,
  },
  {
    match: (p) => /^\/simulator\/call\/[^/]+$/.test(p),
    title: `Live call · ${BRAND_SUFFIX}`,
  },
  {
    match: (p) => /^\/simulator\/results\/[^/]+$/.test(p),
    title: `Simulator results · ${BRAND_SUFFIX}`,
  },
  { match: (p) => p === '/', title: DEFAULT_TITLE },
];

export default function TitleSetter() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const hit = ROUTE_TITLES.find(({ match }) => match(pathname, search));
    document.title = hit ? hit.title : FALLBACK_TITLE;
  }, [pathname, search]);

  return null;
}
