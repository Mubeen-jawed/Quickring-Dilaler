import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { CallProvider } from './contexts/CallContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dialer from './components/Dialer';
import CallHistory from './components/CallHistory';
import InboundHistory from './components/InboundHistory';
import BillingBar from './components/BillingBar';
import BillingReport from './components/BillingReport';
import IncomingCallModal from './components/IncomingCallModal';

export default function App() {
  const { isAuthenticated, totpPending } = useAuth();
  const [view, setView] = useState('dialer');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  if (!isAuthenticated || totpPending) {
    return <Login theme={theme} toggleTheme={toggleTheme} />;
  }

  return (
    <SocketProvider>
      <CallProvider>
        <div className="app-layout">
          <IncomingCallModal />
          <Sidebar
            view={view}
            onViewChange={setView}
            theme={theme}
            toggleTheme={toggleTheme}
          />
          <main className="main-content">
            <div className="main-inner">
              <BillingBar />
              {view === 'dialer' && <Dialer />}
              {view === 'history' && <CallHistory />}
              {view === 'inbound' && <InboundHistory />}
              {view === 'billing' && <BillingReport />}
            </div>
          </main>
        </div>
      </CallProvider>
    </SocketProvider>
  );
}
