import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login({ theme, toggleTheme }) {
  const { login, verifyTotp, cancelTotp, totpPending } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // TOTP code input (6 individual digits)
  const [totpDigits, setTotpDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  // Auto-focus first TOTP input when entering TOTP step
  useEffect(() => {
    if (totpPending && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [totpPending]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTotpDigitChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...totpDigits];
    newDigits[index] = value;
    setTotpDigits(newDigits);

    // Move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (value && index === 5) {
      const code = newDigits.join('');
      if (code.length === 6) {
        submitTotp(code);
      }
    }
  };

  const handleTotpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !totpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleTotpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;
    const newDigits = [...totpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setTotpDigits(newDigits);
    if (pasted.length === 6) {
      submitTotp(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  const submitTotp = async (code) => {
    setError('');
    setLoading(true);
    try {
      await verifyTotp(code);
    } catch (err) {
      setError(err.message || 'Invalid code');
      setTotpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = (e) => {
    e.preventDefault();
    const code = totpDigits.join('');
    if (code.length === 6) {
      submitTotp(code);
    }
  };

  const handleBack = () => {
    cancelTotp();
    setError('');
    setTotpDigits(['', '', '', '', '', '']);
  };

  // TOTP verification screen
  if (totpPending) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <div className="totp-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--kc-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 style={{ fontSize: '22px', marginTop: '8px' }}>Verification Required</h1>
            <p className="login-subtitle">Enter the 6-digit code from your Authenticator app</p>
          </div>

          <form onSubmit={handleTotpSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="totp-inputs" onPaste={handleTotpPaste}>
              {totpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleTotpDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleTotpKeyDown(i, e)}
                  className="totp-digit"
                  autoComplete="one-time-code"
                  disabled={loading}
                />
              ))}
            </div>

            <p className="totp-hint">Code refreshes every 30 seconds</p>

            <button
              type="submit"
              className="btn-login"
              disabled={loading || totpDigits.join('').length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <button className="totp-back-btn" onClick={handleBack} disabled={loading}>
            Back to login
          </button>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <div className="theme-toggle" style={{ display: 'inline-flex', gap: 12 }}>
              <span className="theme-toggle-label">
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
              <label className="toggle-switch">
                <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal login screen
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <h1>QUICKRING</h1>
          <p className="login-subtitle">Agent Dialer</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent1"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <div className="theme-toggle" style={{ display: 'inline-flex', gap: 12 }}>
            <span className="theme-toggle-label">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
            <label className="toggle-switch">
              <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
