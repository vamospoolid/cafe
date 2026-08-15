import { useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

const getSocketUrl = (): string => {
  const defaultUrl = window.location.origin.includes('localhost') || window.location.origin.startsWith('file:') || window.location.origin.startsWith('capacitor:')
    ? 'http://localhost:5000'
    : window.location.origin;
  const baseUrl = localStorage.getItem('pos_backend_url') || defaultUrl;
  return baseUrl;
};

// Singleton socket instance — satu koneksi untuk seluruh aplikasi
let socket: Socket | null = null;

const getSocket = (): Socket => {
  if (!socket || socket.disconnected) {
    const url = getSocketUrl();
    socket = io(url, {
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
};

export const useSocket = () => {
  const sock = useMemo(() => getSocket(), []);

  useEffect(() => {
    sock.on('connect', () => {
      console.log('[Socket.IO] Connected:', sock.id);
    });
    sock.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
    });
    sock.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
    });

    return () => {
      sock.off('connect');
      sock.off('connect_error');
      sock.off('disconnect');
    };
  }, [sock]);

  return sock;
};

export default useSocket;
