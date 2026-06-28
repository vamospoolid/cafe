import { createContext, useState, useEffect, type ReactNode } from 'react';

// Interfaces
export interface User {
  id: number;
  username: string;
  role: string;
  permissions: {
    canVoid: boolean;
    canDiscount: boolean;
    canEditMenu: boolean;
    canViewReports: boolean;
  };
}

interface POSContextType {
  user: User | null;
  token: string | null;
  settings: any;
  activeShift: any | null;
  login: (userData: User, token: string) => void;
  logout: () => void;
  fetchSettings: () => Promise<void>;
  fetchActiveShift: () => Promise<void>;
}

export const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);

  const fetchActiveShift = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/shifts/current', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveShift(data || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('pos_user');
    const savedToken = localStorage.getItem('pos_token');
    
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchSettings();
      fetchActiveShift();
    }
  }, [token]);

  const login = (userData: User, newToken: string) => {
    setUser(userData);
    setToken(newToken);
    localStorage.setItem('pos_user', JSON.stringify(userData));
    localStorage.setItem('pos_token', newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setSettings(null);
    setActiveShift(null);
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
  };

  return (
    <POSContext.Provider value={{ user, token, settings, activeShift, login, logout, fetchSettings, fetchActiveShift }}>
      {children}
    </POSContext.Provider>
  );
};
