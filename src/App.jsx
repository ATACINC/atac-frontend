import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import Login      from './pages/Login';
import SignupPage from './pages/SignupPage';
import Assessment from './pages/Assessment';
import Simulator  from './pages/Simulator';
import Dashboard  from './pages/Dashboard';
import Payment    from './pages/Payment';
import EmployerPortal from './pages/EmployerPortal';
import Trial from './pages/Trial';
import Verify from './pages/Verify';
import VerifyLanding from './pages/VerifyLanding';
import { ToastProvider } from './components/ToastProvider';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('atac_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"      element={<Login />} />
          <Route path="/signup"     element={<SignupPage />} />
          <Route path="/payment"    element={<PrivateRoute><Payment /></PrivateRoute>} />
          <Route path="/assessment" element={<PrivateRoute><Assessment /></PrivateRoute>} />
          <Route path="/simulator"  element={<PrivateRoute><Simulator /></PrivateRoute>} />
          <Route path="/dashboard"  element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/employer" element={<PrivateRoute><EmployerPortal /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
          <Route path="/"           element={<Navigate to="/dashboard" replace />} />
          <Route path="/try" element={<Trial />} />
          <Route path="/verify" element={<VerifyLanding />} />
          <Route path="/verify/:credentialId" element={<Verify />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
