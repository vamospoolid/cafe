import React from 'react';
import { X, Calendar as CalendarIcon, Clock, User, Phone, MapPin, DollarSign, CheckCircle, Receipt, ArrowRight } from 'lucide-react';

import { toast, confirmAlert, errorAlert } from '../utils/alert';
interface ViewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: any;
}

const ViewReservationModal: React.FC<ViewReservationModalProps> = ({ isOpen, onClose, reservation }) => {
  if (!isOpen || !reservation) return null;

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '450px' }}>
        <div className="modal-header border-b border-gray-100 bg-white">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-gray-800">Detail Reservasi</h2>
            <span className="text-xs text-muted font-mono mt-1">{reservation.bookingNo}</span>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="modal-body space-y-5 p-6 bg-slate-50">
          
          {/* Status Badge */}
          <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm font-semibold text-gray-500">Status Saat Ini:</div>
            <span className={`badge ${reservation.status === 'Lunas' ? 'badge-success' : 'badge-warning'} px-3 py-1 text-sm font-bold flex items-center gap-1`}>
              {reservation.status === 'Lunas' ? <CheckCircle size={16} /> : <Clock size={16} />} 
              {reservation.status}
            </span>
          </div>

          {/* Customer Info */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-50 text-primary rounded-full flex items-center justify-center">
                <User size={24} />
              </div>
              <div>
                <div className="font-bold text-lg text-gray-800">{reservation.customer}</div>
                <div className="text-sm text-muted flex items-center gap-1 mt-1">
                  <Phone size={14} /> {reservation.phone}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-2 pt-4 border-t border-gray-100 text-sm">
              <div>
                <span className="text-muted block text-xs mb-1 flex items-center gap-1"><CalendarIcon size={12}/> Tanggal</span>
                <span className="font-semibold text-gray-800">{reservation.date}</span>
              </div>
              <div>
                <span className="text-muted block text-xs mb-1 flex items-center gap-1"><Clock size={12}/> Jam</span>
                <span className="font-semibold text-gray-800">19:00 (Estimasi)</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted block text-xs mb-1 flex items-center gap-1"><MapPin size={12}/> Lokasi Meja</span>
                <span className="font-semibold text-primary text-base">{reservation.table}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Estimasi Total</span>
              <span className="font-semibold text-gray-800">{formatCurrency(reservation.total)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Down Payment (DP)</span>
              <span className="font-semibold text-success">{formatCurrency(reservation.dp)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200 mt-2">
              <span className="text-sm font-bold text-gray-800">Sisa Tagihan</span>
              <span className="font-bold text-danger text-lg">{formatCurrency(reservation.sisa || (reservation.total - reservation.dp))}</span>
            </div>
          </div>

        </div>

        <div className="modal-footer flex flex-col gap-2 bg-white border-t border-gray-100">
          {reservation.status !== 'Lunas' && (
            <button type="button" className="btn btn-primary w-full justify-center py-3 text-base flex items-center gap-2" onClick={() => { toast('Mengarahkan ke pembayaran...', 'success'); onClose(); }}>
              <Receipt size={18} /> Tandai Lunas & Bayar Sisa
            </button>
          )}
          <button type="button" className="btn btn-accent w-full justify-center py-3 text-base flex items-center gap-2" onClick={() => { toast('Memulai pesanan meja...', 'success'); onClose(); }}>
            Check-In Pelanggan <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewReservationModal;
