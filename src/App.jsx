import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login      from './pages/Login';
import SignupPage from './pages/SignupPage';
import Assessment from './pages/Assessment';
import Dashboard  from './pages/Dashboard';
import Payment    from './pages/Payment';
import EmployerPortal from './pages/EmployerPortal';
import Trial from './pages/Trial';
import Verify from './pages/Verify';
import VerifyLanding from './pages/VerifyLanding';
import { ToastProvider } from './components/ToastProvider';
import TitleSetter from './components/TitleSetter';

// ── M2 Simulator (ATAC Call Readiness Simulator) ────────────────────────
// The /simulator/* route tree lazy-loads its own chunk so the @elevenlabs/client
// SDK (and supporting code) is only downloaded when a user actually enters the
// simulator flow. First-load bundle for everyone else stays unaffected.
//
// The old text-based Simulator.jsx is no longer routed. It remains on disk
// pending M2.1 cleanup; see TODO comment in that file.
const SimulatorEntry          = lazy(() => import('./pages/simulator/SimulatorEntry'));
const SimulatorBriefing       = lazy(() => import('./pages/simulator/Briefing'));
const SimulatorCall           = lazy(() => import('./pages/simulator/Call'));
const SimulatorResults        = lazy(() => import('./pages/simulator/Results'));
import SimulatorLoadingScreen from './pages/simulator/SimulatorLoadingScreen';
import SimulatorErrorBoundary from './components/SimulatorErrorBoundary';

// Invite-only voice demonstration. Public (no PrivateRoute), not in the main
// nav, reachable directly by URL so it can be shared with specific invitees.
// Lazy-loaded so its chunk (and the voice SDK it pulls only at the call step)
// stays out of the main bundle.
const SandboxPage = lazy(() => import('./pages/sandbox/SandboxPage'));

function PrivateRoute({ children }) {
  const token = localStorage.getItem('atac_token');
  return token ? children : <Navigate to="/login" replace />;
}

// Hard redirect to an external URL. <Navigate> only handles internal
// routes, so this small component fires window.location.replace on
// mount. Used for /admin which lives in a separate Vercel project.
function ExternalRedirect({ to }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <TitleSetter />
        <Routes>
          <Route path="/login"      element={<Login />} />
          <Route path="/signup"     element={<SignupPage />} />
          <Route path="/payment"    element={<PrivateRoute><Payment /></PrivateRoute>} />
          <Route path="/assessment" element={<PrivateRoute><Assessment /></PrivateRoute>} />
          {/* /simulator/* - lazy-loaded sub-tree, single Suspense boundary */}
          <Route
            path="/simulator/*"
            element={
              <PrivateRoute>
                <SimulatorErrorBoundary>
                  <Suspense fallback={<SimulatorLoadingScreen />}>
                    <Routes>
                      <Route index                 element={<SimulatorEntry />} />
                      <Route path="briefing/:sessionId" element={<SimulatorBriefing />} />
                      <Route path="call/:sessionId"     element={<SimulatorCall />} />
                      <Route path="results/:sessionId"  element={<SimulatorResults />} />
                    </Routes>
                  </Suspense>
                </SimulatorErrorBoundary>
              </PrivateRoute>
            }
          />
          <Route path="/dashboard"  element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/employer" element={<PrivateRoute><EmployerPortal /></PrivateRoute>} />
          <Route path="/admin" element={<ExternalRedirect to="https://admin.atacglobalcx.com" />} />
          <Route path="/"           element={<Navigate to="/dashboard" replace />} />
          <Route path="/try" element={<Trial />} />
          <Route
            path="/sandbox"
            element={
              <Suspense fallback={<SimulatorLoadingScreen />}>
                <SandboxPage />
              </Suspense>
            }
          />
          <Route path="/verify" element={<VerifyLanding />} />
          <Route path="/verify/:credentialId" element={<Verify />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
