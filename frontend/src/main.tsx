import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Intercept fetch untuk handle 401 (Unauthorized) secara global
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
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
