import React, { useState, useEffect, useContext } from 'react';
import { QrCode, Printer, AlertTriangle } from 'lucide-react';
import PrintQRModal from './PrintQRModal';
import { POSContext } from '../context/POSContext';

const QRCodeView = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedQRTable, setSelectedQRTable] = useState<any>(null);
  
  const posContext = useContext(POSContext);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/tables', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        const rawBaseUrl = posContext?.settings?.qrCodeBaseUrl?.trim();
        let baseUrl = `${window.location.protocol}//${window.location.host}`;
        if (rawBaseUrl) {
          baseUrl = rawBaseUrl.startsWith('http://') || rawBaseUrl.startsWith('https://') 
            ? rawBaseUrl 
            : `${window.location.protocol}//${rawBaseUrl}`;
          if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
          }
        }

        // Memetakan data dari backend ke format tampilan QR
        const mappedTables = data.map((t: any) => ({
          ...t,
          no: `Meja ${t.tableNo}`,
          desc: `Kapasitas: ${t.capacity} Orang`,
          active: true, // Untuk UI toggle
          url: `${baseUrl}/dinein/table/${t.id}?ref=${t.tableNo}`
        }));
        setTables(mappedTables);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token) {
      fetchTables();
    }
  }, [posContext?.token, posContext?.settings]);

  const toggleActive = (id: number) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t));
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <QrCode className="text-primary" /> Generate QR Code Nomor Meja
        </h2>
        <p className="text-muted mt-1">Aktifkan QR Code untuk tiap meja. Pelanggan dapat scan untuk memesan sendiri (Dine In).</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : tables.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center flex flex-col items-center">
          <AlertTriangle size={48} className="text-orange-400 mb-3" />
          <h3 className="text-lg font-bold text-gray-800">Tidak Ada Data Meja</h3>
          <p className="text-muted max-w-md mx-auto mt-2">
            Anda belum menambahkan meja satupun ke dalam sistem. Silakan tambahkan meja melalui menu "Manajemen Meja" terlebih dahulu.
          </p>
        </div>
      ) : (
        <div className="qr-grid">
          {tables.map(table => (
            <div key={table.id} className={`qr-card ${!table.active ? 'inactive' : ''}`}>
              <div className="qr-card-header">
                <div>
                  <h3 className="qr-title">{table.no}</h3>
                  <p className="qr-desc">{table.desc}</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={table.active} onChange={() => toggleActive(table.id)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              
              <div className="qr-image-wrapper">
                {table.active ? (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(table.url)}`} 
                    alt={`QR Code ${table.no}`} 
                    className="qr-image"
                  />
                ) : (
                  <div className="qr-disabled-placeholder">
                    <QrCode size={48} className="text-gray-300 mb-2" />
                    <span>QR Nonaktif</span>
                  </div>
                )}
              </div>
              
              <div className="qr-url truncate px-2 text-center" title={table.url}>{table.url}</div>
              
              <button 
                className="btn btn-outline qr-print-btn flex justify-center items-center gap-2" 
                disabled={!table.active}
                onClick={() => { setSelectedQRTable(table); setIsPrintModalOpen(true); }}
              >
                <Printer size={16} /> Cetak
              </button>
            </div>
          ))}
        </div>
      )}

      <PrintQRModal 
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        tableData={selectedQRTable}
      />
    </div>
  );
};

export default QRCodeView;
