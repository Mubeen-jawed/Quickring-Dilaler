import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useCall } from '../contexts/CallContext';

export default function Sidebar({ view, onViewChange, theme, toggleTheme }) {
  const { agent, logout } = useAuth();
  const { connected } = useSocket();
  const { deviceReady } = useCall();

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-logo">
          QUICKRING
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${view === 'dialer' ? 'active' : ''}`}
            onClick={() => onViewChange('dialer')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
            <span>Dialer</span>
          </button>

          <button
            className={`nav-item ${view === 'history' ? 'active' : ''}`}
            onClick={() => onViewChange('history')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>History</span>
          </button>

          <button
            className={`nav-item ${view === 'inbound' ? 'active' : ''}`}
            onClick={() => onViewChange('inbound')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 7 7 17" />
              <polyline points="17 17 7 17 7 7" />
            </svg>
            <span>Inbound</span>
          </button>

          <button
            className={`nav-item ${view === 'billing' ? 'active' : ''}`}
            onClick={() => onViewChange('billing')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            <span>Billing</span>
          </button>
        </nav>
      </div>

      <div className="sidebar-bottom">
        {/* Theme Toggle */}
        <div className="theme-toggle">
          <span className="theme-toggle-label">
            {theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <label className="toggle-switch">
            <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* Connection Status */}
        <div className="connection-status">
          <div className="status-row">
            <span className="status-row-left">
              <span className={`status-dot ${connected ? 'green' : 'orange'}`} />
              Socket
            </span>
            <span className={`status-badge ${connected ? 'connected' : 'connecting'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="status-row">
            <span className="status-row-left">
              <span className={`status-dot ${deviceReady ? 'green' : 'orange'}`} />
              Phone
            </span>
            <span className={`status-badge ${deviceReady ? 'connected' : 'connecting'}`}>
              {deviceReady ? 'Ready' : 'Click to init'}
            </span>
          </div>
        </div>

        {/* Agent Info */}
        <div className="agent-info">
          <div className="agent-avatar">
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div className="agent-details">
            <span className="agent-name">{agent.name}</span>
            <span className="agent-email">{agent.email}</span>
          </div>
          <button className="btn-logout" onClick={logout} title="Logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
