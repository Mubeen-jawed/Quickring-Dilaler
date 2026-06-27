export default function CallStatus({ callState, callDuration, phoneNumber }) {
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const statusLabels = {
    idle: '',
    connecting: 'Connecting...',
    ringing: 'Ringing...',
    open: formatDuration(callDuration),
    closed: 'Call Ended',
    voicemail: 'Voicemail Detected',
  };

  if (callState === 'idle') return null;

  return (
    <div className={`call-status ${callState}`}>
      <div className="call-status-indicator">
        {callState === 'open' && <span className="pulse-dot" />}
        <span className="call-status-label">{statusLabels[callState]}</span>
      </div>
      {phoneNumber && (
        <div className="call-status-number">{phoneNumber}</div>
      )}
    </div>
  );
}
