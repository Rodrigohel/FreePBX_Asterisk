import { useAuth } from './hooks/useAuth.js';
import { useSettings } from './hooks/useSettings.js';
import PublicDashboard from './pages/PublicDashboard.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  const { user, checking, login, logout, isAuthenticated } = useAuth();
  const { settings, reloadSettings } = useSettings();

  if (checking) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Manrope',sans-serif" }}>Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <PublicDashboard onLogin={login} settings={settings} />;
  }

  return <Dashboard user={user} onLogout={logout} settings={settings} reloadSettings={reloadSettings} />;
}
