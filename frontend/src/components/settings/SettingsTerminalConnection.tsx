import React, { useState } from 'react';
import { Info, Check } from 'lucide-react';
import { toast } from '../../utils/alert';

export const SettingsTerminalConnection: React.FC = () => {
  const defaultUrl = window.location.origin.includes('localhost') || window.location.origin.startsWith('file:') || window.location.origin.startsWith('capacitor:')
    ? 'http://localhost:5000'
    : window.location.origin;
  const [backendUrl, setBackendUrl] = useState(
    localStorage.getItem('pos_backend_url') || defaultUrl
  );
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTestConnection = async () => {
    setTesting(true);
    setTestStatus('idle');
    setTestMessage('');
    try {
      const cleanUrl = backendUrl.trim().endsWith('/') ? backendUrl.trim().slice(0, -1) : backendUrl.trim();
      const res = await fetch(`${cleanUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.status === 'OK') {
        setTestStatus('success');
        setTestMessage('Terhubung! Server backend aktif dan merespon dengan baik.');
        toast('Koneksi ke server berhasil!', 'success');
      } else {
        setTestStatus('error');
        setTestMessage(data.message || 'Server merespon, namun status kesehatan tidak OK.');
        toast('Koneksi gagal: respon tidak valid', 'error');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || 'Gagal terhubung ke server. Pastikan alamat IP/URL benar, server telah dijalankan, dan berada di jaringan WiFi yang sama.');
      toast('Gagal terhubung ke server', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = () => {
    let cleanUrl = backendUrl.trim();
    if (!cleanUrl) {
      toast('Alamat URL Server tidak boleh kosong!', 'warning');
      return;
    }
    // Ensure it starts with http:// or https://
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    localStorage.setItem('pos_backend_url', cleanUrl);
    toast('Konfigurasi URL Server berhasil disimpan! Halaman akan dimuat ulang.', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 text-xs font-semibold text-indigo-800 flex items-start gap-3">
        <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
        <div>
          Secara bawaan (default), terminal kasir terhubung ke <strong>http://localhost:5000</strong>. 
          Anda dapat mengubahnya ke alamat IP server lokal di toko Anda (misal: <code>http://192.168.1.100:5000</code>) 
          atau URL domain VPS online (misal: <code>http://cafe.codenusa.id</code>) untuk menghubungkan terminal tablet ini.
        </div>
      </div>

      <div className="max-w-xl p-6 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
            Alamat URL / IP Server Backend
          </label>
          <input
            type="text"
            className="form-control bg-white font-mono text-sm"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="Contoh: http://localhost:5000 atau http://192.168.1.100:5000"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="btn btn-outline flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold w-1/2"
            style={{ border: '1px solid #e2e8f0' }}
          >
            {testing ? 'Menguji...' : 'Tes Koneksi'}
          </button>
          <button
            type="button"
            onClick={handleSaveConnection}
            className="btn btn-primary bg-indigo-600 border-indigo-600 text-xs font-bold py-2.5 px-4 w-1/2 flex items-center justify-center gap-2"
          >
            <Check size={14} />
            Simpan & Terapkan
          </button>
        </div>

        {testStatus !== 'idle' && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5 animate-fade-in ${
              testStatus === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                : 'bg-red-50 text-red-800 border border-red-100'
            }`}
          >
            {testStatus === 'success' ? (
              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">✓</div>
            ) : (
              <div className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">!</div>
            )}
            <div className="leading-relaxed">{testMessage}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsTerminalConnection;
