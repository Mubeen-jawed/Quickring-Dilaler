import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api';
import { useSocket } from './SocketContext';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { socket } = useSocket();
  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const initStartedRef = useRef(false);
  const [deviceReady, setDeviceReady] = useState(false);
  const [callState, setCallState] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const timerRef = useRef(null);
  const durationRef = useRef(0);

  const startTimer = useCallback(() => {
    setCallDuration(0);
    durationRef.current = 0;
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setCallDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const initDevice = useCallback(async () => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    try {
      // Request microphone permission (browser gesture requirement)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());

      const { Device } = await import('@twilio/voice-sdk');
      const { token } = await api.getTwilioToken();

      if (deviceRef.current) {
        deviceRef.current.destroy();
      }

      const device = new Device(token, {
        codecPreferences: ['opus', 'pcmu'],
        logLevel: 1,
        allowIncomingWhileBusy: false,
      });

      device.on('registered', () => {
        console.log('Twilio Device registered');
        setDeviceReady(true);
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      });

      device.on('error', (err) => {
        console.error('Twilio Device error:', err);
      });

      device.on('tokenWillExpire', async () => {
        try {
          const { token: newToken } = await api.getTwilioToken();
          device.updateToken(newToken);
        } catch (err) {
          console.error('Failed to refresh Twilio token:', err);
        }
      });

      device.on('incoming', (call) => {
        const callerNumber = call.customParameters?.get('callerNumber') || call.parameters.From;
        console.log('Incoming call from:', callerNumber);
        setIncomingCall(call);

        // Log immediately so missed/rejected calls appear in history
        api.logCall({
          callSid: call.parameters.CallSid,
          phoneNumber: callerNumber,
          direction: 'inbound',
        }).catch((err) => console.error('Failed to log inbound call:', err));

        call.on('cancel', () => {
          // Caller hung up before agent answered — missed call
          setIncomingCall(null);
          api.updateCall(call.parameters.CallSid, {
            status: 'no-answer',
          }).catch((err) => console.error('Failed to update missed call:', err));
        });

        call.on('disconnect', () => {
          setIncomingCall(null);
          setCallState('closed');
          stopTimer();
          setTimeout(() => {
            setCallState('idle');
            setCallDuration(0);
            setIsMuted(false);
          }, 2000);
        });
      });

      await device.register();
      deviceRef.current = device;
    } catch (err) {
      console.error('Failed to init Twilio device:', err);
      initStartedRef.current = false;
    }
  }, [stopTimer]);

  // Listen for server-side call events (accurate answer detection & voicemail)
  useEffect(() => {
    if (!socket) return;

    const handleAnswered = ({ callSid }) => {
      // Only start timer if this is our active outbound call still in ringing state
      if (callRef.current && callRef.current.parameters.CallSid === callSid) {
        setCallState('open');
        startTimer();
      }
    };

    socket.on('call:answered', handleAnswered);

    return () => {
      socket.off('call:answered', handleAnswered);
    };
  }, [socket, startTimer, stopTimer]);

  // One-time click listener to trigger device init (browser gesture requirement)
  useEffect(() => {
    const handleClick = () => {
      document.removeEventListener('click', handleClick);
      initDevice();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [initDevice]);

  const acceptIncoming = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.accept();
    setCallState('open');
    startTimer();
    callRef.current = incomingCall;
    setIncomingCall(null);

    incomingCall.on('disconnect', () => {
      setCallState('closed');
      stopTimer();
      callRef.current = null;
      api.updateCall(incomingCall.parameters.CallSid, {
        status: 'completed',
        duration: durationRef.current,
      }).catch((err) => console.error('Failed to update call:', err));
      setTimeout(() => {
        setCallState('idle');
        setCallDuration(0);
        setIsMuted(false);
      }, 2000);
    });
  }, [incomingCall, startTimer, stopTimer]);

  const rejectIncoming = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.reject();
    api.updateCall(incomingCall.parameters.CallSid, {
      status: 'canceled',
    }).catch((err) => console.error('Failed to update rejected call:', err));
    setIncomingCall(null);
  }, [incomingCall]);

  const makeCall = useCallback(async (phoneNumber) => {
    if (!deviceRef.current) return;

    try {
      setCallState('connecting');
      const call = await deviceRef.current.connect({
        params: { To: phoneNumber },
      });

      callRef.current = call;
      let callLogged = false;

      // Log the call as soon as we have a CallSid
      const ensureLogged = () => {
        if (callLogged) return;
        callLogged = true;
        api.logCall({
          callSid: call.parameters.CallSid,
          phoneNumber,
          direction: 'outbound',
        }).catch((err) => console.error('Failed to log call:', err));
      };

      call.on('ringing', () => {
        setCallState('ringing');
        ensureLogged();
      });

      call.on('accept', () => {
        // Don't start timer here — wait for call:answered from server
        // which fires only when the remote party actually picks up.
        // Keep state as 'ringing' until then.
        ensureLogged();
      });

      call.on('disconnect', () => {
        setCallState('closed');
        stopTimer();
        // Don't send client-side duration — the server's child-status
        // callback updates with Twilio's authoritative duration.
        api.updateCall(call.parameters.CallSid, {
          status: 'completed',
        }).catch((err) => console.error('Failed to update call:', err));
        setTimeout(() => {
          setCallState('idle');
          setCallDuration(0);
          setIsMuted(false);
        }, 2000);
      });

      call.on('cancel', () => {
        setCallState('closed');
        stopTimer();
        ensureLogged();
        api.updateCall(call.parameters.CallSid, {
          status: 'canceled',
        }).catch((err) => console.error('Failed to update call:', err));
        setTimeout(() => {
          setCallState('idle');
          setCallDuration(0);
        }, 1500);
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        ensureLogged();
        api.updateCall(call.parameters.CallSid, {
          status: 'failed',
        }).catch((err) => console.error('Failed to update failed call:', err));
        setCallState('idle');
        stopTimer();
        setCallDuration(0);
      });
    } catch (err) {
      console.error('Failed to make call:', err);
      setCallState('idle');
    }
  }, [startTimer, stopTimer]);

  const hangUp = useCallback(() => {
    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (callRef.current) {
      const muted = !callRef.current.isMuted();
      callRef.current.mute(muted);
      setIsMuted(muted);
    }
  }, []);

  const sendDtmf = useCallback((digit) => {
    if (callRef.current) {
      callRef.current.sendDigits(digit);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, [stopTimer]);

  return (
    <CallContext.Provider value={{
      deviceReady,
      callState,
      callDuration,
      isMuted,
      incomingCall,
      makeCall,
      hangUp,
      toggleMute,
      sendDtmf,
      acceptIncoming,
      rejectIncoming,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
