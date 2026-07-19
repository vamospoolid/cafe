import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Intercept fetch untuk handle URL dinamis & handle 401 (Unauthorized) secara global
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let finalInput = input;
  
  if (typeof input === 'string' && input.startsWith('/api')) {
    const baseUrl = localStorage.getItem('pos_backend_url') || 'http://localhost:5000';
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    finalInput = `${cleanBaseUrl}${input}`;
  }
  
  const response = await originalFetch(finalInput, init);
  
  if (response.status === 401) {
    // Jika token tidak valid / DB direstart, paksa logout
    if (localStorage.getItem('pos_token')) {
      localStorage.removeItem('pos_user');
      localStorage.removeItem('pos_token');
      window.location.href = '/';
    }
  }
  return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
