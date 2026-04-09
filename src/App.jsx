import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login      from './pages/login';
import Assessment from './pages/Assessment';
import Simulator  from './pages/Simulator';
import Dashboard  from './pages/Dashboard';
import Payment    from './pages/Payment';
import EmployerPortal from './pages/EmployerPortal';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('atac_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"      element={<Login />} />
        <Route path="/payment"    element={<PrivateRoute><Payment /></PrivateRoute>} />
        <Route path="/assessment" element={<PrivateRoute><Assessment /></PrivateRoute>} />
        <Route path="/simulator"  element={<PrivateRoute><Simulator /></PrivateRoute>} />
        <Route path="/dashboard"  element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/employer" element={<PrivateRoute><EmployerPortal /></PrivateRoute>} />
        <Route path="/"           element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}