import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { accessToken, isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const [agents, setAgents] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const socket = io({
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket.IO connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message);
      setConnected(false);
    });

    socket.on('agents:list', (list) => {
      setAgents(list);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setAgents([]);
    };
  }, [isAuthenticated, accessToken]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, agents }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
