import { useCall } from '../contexts/CallContext';
import { parsePhone } from '../utils/phoneFormat';

export default function IncomingCallModal() {
  const { incomingCall, acceptIncoming, rejectIncoming } = useCall();

  if (!incomingCall) return null;

  const raw = incomingCall.customParameters?.get('callerNumber') || incomingCall.parameters.From || 'Unknown';
  const { flag, country, formatted } = parsePhone(raw);

  return (
    <div className="incoming-overlay">
      <div className="incoming-modal">
        <div className="incoming-ring-anim">
          <div className="incoming-ring-circle ring-1" />
          <div className="incoming-ring-circle ring-2" />
          <div className="incoming-ring-circle ring-3" />
          <div className="incoming-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
          </div>
        </div>

        <div className="incoming-info">
          <span className="incoming-label">Incoming Call</span>
          <span className="incoming-caller">
            {flag && <span className="incoming-flag">{flag}</span>}
            {formatted}
          </span>
          {country && <span className="incoming-country">{country}</span>}
        </div>

        <div className="incoming-actions">
          <button className="incoming-btn reject" onClick={rejectIncoming} title="Reject">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91" />
              <line x1="23" y1="1" x2="1" y2="23" />
            </svg>
          </button>
          <button className="incoming-btn accept" onClick={acceptIncoming} title="Accept">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
