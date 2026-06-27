import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { parsePhone } from '../utils/phoneFormat';

export default function BillingBar() {
  const { agent } = useAuth();
  const { socket } = useSocket();
  const [billing, setBilling] = useState({
    rate_per_minute: 0,
    total_minutes: 0,
    total_cost: 0,
  });

  useEffect(() => {
    api.getBilling().then(setBilling).catch(console.error);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => setBilling(data);
    socket.on('billing:updated', handler);
    return () => socket.off('billing:updated', handler);
  }, [socket]);

  const agentPhone = agent?.phone_number ? parsePhone(agent.phone_number) : null;

  return (
    <div className="billing-bar">
      {agentPhone && (
        <>
          <div className="billing-item">
            <span className="billing-label">Your Number</span>
            <span className="billing-value agent-number">{agentPhone.flag} {agentPhone.formatted}</span>
          </div>
          <div className="billing-divider" />
        </>
      )}
      <div className="billing-item">
        <span className="billing-label">Rate</span>
        <span className="billing-value">${billing.rate_per_minute}/min</span>
      </div>
      <div className="billing-divider" />
      <div className="billing-item">
        <span className="billing-label">This Month</span>
        <span className="billing-value">{billing.total_minutes} min</span>
      </div>
      <div className="billing-divider" />
      <div className="billing-item">
        <span className="billing-label">Total Cost</span>
        <span className="billing-value billing-cost">${billing.total_cost}</span>
      </div>
    </div>
  );
}
