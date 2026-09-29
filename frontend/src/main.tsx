import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './tailwind-output.css'
import App from './App.tsx'

// Intercept fetch untuk handle URL dinamis & handle 401 (Unauthorized) secara global
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let finalInput = input;
  
  if (typeof input === 'string' && input.startsWith('/api')) {
    const defaultUrl = window.location.origin.includes('localhost') || window.location.origin.startsWith('file:') || window.location.origin.startsWith('capacitor:')
      ? 'http://localhost:5000'
      : window.location.origin;
    const baseUrl = localStorage.getItem('pos_backend_url') || defaultUrl;
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    finalInput = `${cleanBaseUrl}${input}`;
  }
  
  const response = await originalFetch(finalInput, init);
  
  if (response.status === 401) {
    // Cek apakah request yang gagal benar-benar mengirimkan pos_token kasir
    const posToken = localStorage.getItem('pos_token');
    const authHeader = String((init?.headers as any)?.Authorization || (init?.headers as any)?.authorization || '');
    const wasUsingPosToken = Boolean(posToken && authHeader.includes(posToken));

    // Jangan pernah redirect jika sedang di rute portal staf atau rute publik mandiri
    const isIndependentRoute = 
      window.location.pathname.startsWith('/staff') ||
      window.location.pathname.startsWith('/dapur-app') ||
      window.location.pathname.startsWith('/dinein') ||
      window.location.pathname.startsWith('/menu') ||
      window.location.pathname === '/login' ||
      window.location.pathname === '/' ||
      window.location.pathname === '/landing' ||
      window.location.pathname === '/landing-page';

    // HANYA redirect jika session kasir POS utama yang aktif ditolak tokennya
    if (wasUsingPosToken && !isIndependentRoute) {
      localStorage.removeItem('pos_user');
      localStorage.removeItem('pos_token');
      window.location.href = '/login';
    }
  }
  return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
