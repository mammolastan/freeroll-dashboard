// hooks/useSocketConnectionStatus.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from '@/lib/socketClient';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export function useSocketConnectionStatus() {
  // Initialize based on current socket state
  const getInitialStatus = (): ConnectionStatus => {
    if (socket.connected) return 'connected';
    if (socket.disconnected) return 'disconnected';
    return 'connecting';
  };

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(getInitialStatus);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const reconnectIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Manual reconnect function
  const manualReconnect = useCallback(() => {
    setConnectionStatus('reconnecting');

    // Force disconnect and reconnect
    if (socket.connected) {
      socket.disconnect();
    }
    socket.connect();
  }, []);

  useEffect(() => {
    // Clear any existing fallback interval
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }

    const handleConnect = () => {
      setConnectionStatus('connected');
      setReconnectAttempt(0);

      // Clear fallback reconnect interval on successful connection
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
    };

    const handleDisconnect = () => {
      setConnectionStatus('disconnected');

      // Start fallback reconnection polling every 10 seconds
      if (!reconnectIntervalRef.current) {
        reconnectIntervalRef.current = setInterval(() => {
          if (!socket.connected) {
            setReconnectAttempt(prev => prev + 1);
            socket.connect();
          } else {
            if (reconnectIntervalRef.current) {
              clearInterval(reconnectIntervalRef.current);
              reconnectIntervalRef.current = null;
            }
          }
        }, 10000);
      }
    };

    const handleReconnectAttempt = (attempt: number) => {
      setConnectionStatus('reconnecting');
      setReconnectAttempt(attempt);
    };

    const handleReconnect = () => {
      setConnectionStatus('connected');
      setReconnectAttempt(0);
    };

    const handleConnectError = () => {
      setConnectionStatus('reconnecting');
    };

    // Set up listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.io.on('reconnect', handleReconnect);

    // Set initial status based on current socket state
    if (socket.connected) {
      setConnectionStatus('connected');
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.io.off('reconnect', handleReconnect);

      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
    };
  }, []);

  return {
    connectionStatus,
    reconnectAttempt,
    manualReconnect,
  };
}
