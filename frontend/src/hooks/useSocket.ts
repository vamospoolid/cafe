import { useEffect, useState } from 'react';
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
let lastUsedToken: string | undefined | null = null;

export const getSocket = (): Socket => {
  const currentToken = localStorage.getItem('pos_token') || undefined;
  const url = getSocketUrl();

  if (!socket) {
    lastUsedToken = currentToken;
    socket = io(url, {
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling'],
      auth: {
        token: currentToken
      }
    });
  } else if (currentToken !== lastUsedToken) {
    // Token berubah (misal: user login/logout atau ganti tenant) -> re-authenticate
    lastUsedToken = currentToken;
    socket.auth = { token: currentToken };
    if (socket.connected) {
      socket.disconnect();
    }
    socket.connect();
  } else if (socket.disconnected) {
    socket.connect();
  }
  return socket;
};

export const reconnectSocket = (explicitToken?: string): Socket => {
  const currentToken = explicitToken !== undefined ? explicitToken : (localStorage.getItem('pos_token') || undefined);
  lastUsedToken = currentToken;
  const url = getSocketUrl();

  if (socket) {
    socket.auth = { token: currentToken };
    if (socket.connected) {
      socket.disconnect();
    }
    socket.connect();
  } else {
    socket = io(url, {
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling'],
      auth: {
        token: currentToken
      }
    });
  }
  return socket;
};

export const useSocket = () => {
  const [sock, setSock] = useState<Socket>(() => getSocket());

  useEffect(() => {
    const s = getSocket();
    setSock(s);

    const handleConnect = () => {
      console.log('[Socket.IO] Connected:', s.id);
    };
    const handleConnectError = (err: Error) => {
      console.warn('[Socket.IO] Connection error:', err.message);
    };
    const handleDisconnect = (reason: string) => {
      console.log('[Socket.IO] Disconnected:', reason);
    };

    s.on('connect', handleConnect);
    s.on('connect_error', handleConnectError);
    s.on('disconnect', handleDisconnect);

    return () => {
      s.off('connect', handleConnect);
      s.off('connect_error', handleConnectError);
      s.off('disconnect', handleDisconnect);
    };
  }, []);

  return sock;
};

export default useSocket;
