import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider, isManager, useAuth } from './auth';
import Shell from './Shell';
import { Spinner, ToastProvider } from './ui';
import Login from './pages/Login';
import Setup from './pages/Setup';
import ChangePassword from './pages/ChangePassword';
import Punch from './pages/Punch';
import MyTimesheet from './pages/MyTimesheet';
import MyRequests from './pages/MyRequests';
import Dashboard from './pages/admin/Dashboard';
import Employees from './pages/admin/Employees';
import EmployeeDetail from './pages/admin/EmployeeDetail';
import Approvals from './pages/admin/Approvals';
import CalendarPage from './pages/admin/CalendarPage';
import Bank from './pages/admin/Bank';
import Reports from './pages/admin/Reports';
import Audit from './pages/admin/Audit';
import SettingsPage from './pages/admin/SettingsPage';

function Routed() {
  const { user, loading, needsSetup } = useAuth();
  if (loading) return <Spinner />;
  if (needsSetup) return <Setup />;
  if (!user) return <Login />;
  if (user.mustChangePassword) return <ChangePassword forced />;
  const manager = isManager(user);
  const admin = user.role === 'ADMIN';
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Punch />} />
        <Route path="espelho" element={<MyTimesheet />} />
        <Route path="solicitacoes" element={<MyRequests />} />
        <Route path="senha" element={<ChangePassword />} />
        {manager && (
          <Route path="gestao">
            <Route index element={<Dashboard />} />
            <Route path="colaboradores" element={<Employees />} />
            <Route path="colaboradores/:id" element={<EmployeeDetail />} />
            <Route path="aprovacoes" element={<Approvals />} />
            <Route path="calendario" element={<CalendarPage />} />
            <Route path="banco" element={<Bank />} />
            <Route path="relatorios" element={<Reports />} />
            {admin && <Route path="auditoria" element={<Audit />} />}
            {admin && <Route path="configuracoes" element={<SettingsPage />} />}
          </Route>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routed />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
