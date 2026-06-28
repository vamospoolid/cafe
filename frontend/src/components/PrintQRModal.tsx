import React, { useContext } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { POSContext } from '../context/POSContext';

import { toast, confirmAlert, errorAlert } from '../utils/alert';
interface PrintQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableData: any; // e.g., { no: 'A1', url: '...' }
}

const PrintQRModal: React.FC<PrintQRModalProps> = ({ isOpen, onClose, tableData }) => {
  const posContext = useContext(POSContext);
  if (!isOpen || !tableData) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header bg-gray-50 border-b border-gray-200">
          <h2 className="modal-title flex items-center gap-2">
            <Printer className="text-primary" /> Cetak QR Code Meja
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="modal-body flex flex-col items-center py-8">
          <p className="text-center text-sm text-muted mb-6">
            Preview cetak untuk thermal printer (Hitam Putih)
          </p>
 
          {/* Simulasi Kertas Struk / Akrilik Meja */}
          <div className="bg-white border-2 border-gray-300 border-dashed rounded-lg p-6 flex flex-col items-center" style={{ width: '220px' }}>
            <div className="font-bold text-xl mb-1 text-black">{posContext?.settings?.storeName || 'SOL CAFE'}</div>
            <div className="text-xs text-black mb-4">Scan untuk Memesan</div>
            
            {/* Mock QR Code */}
            <div className="w-40 h-40 bg-white border border-gray-200 flex items-center justify-center p-2 mb-4">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tableData.url)}`} alt="QR Code" />
            </div>

            <div className="text-sm font-bold text-black mb-1">MEJA</div>
            <div className="text-3xl font-black text-black">{tableData.no}</div>
          </div>
        </div>

        <div className="modal-footer flex flex-col sm:flex-row gap-3">
          <button type="button" className="btn btn-outline flex-1 justify-center gap-2" onClick={onClose}>
            <Download size={18} /> Simpan PDF
          </button>
          <button type="button" className="btn btn-primary flex-1 justify-center gap-2" onClick={() => {
            toast('Mengirim data ke Printer Thermal...', 'success');
            onClose();
          }}>
            <Printer size={18} /> Cetak Langsung
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintQRModal;
