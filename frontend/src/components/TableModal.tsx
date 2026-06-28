import React, { useState, useEffect } from 'react';
import { X, Grid, Users, Info } from 'lucide-react';

interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (table: any) => void;
  initialData?: any;
}

const TableModal: React.FC<TableModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState({
    tableNo: '',
    name: '',
    capacity: 2,
    status: 'Aktif',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        tableNo: initialData.tableNo || '',
        name: initialData.name || '',
        capacity: initialData.capacity || 2,
        status: initialData.status || 'Aktif',
      });
    } else {
      setFormData({
        tableNo: '',
        name: '',
        capacity: 2,
        status: 'Aktif',
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) onSave(formData);
  };

  return (
    <div className="modal-overlay backdrop-blur-sm bg-slate-900/30">
      <div className="modal-content !rounded-3xl border border-slate-100 shadow-2xl p-0 overflow-hidden" style={{ maxWidth: '400px' }}>
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-black flex items-center gap-2 text-slate-800">
            <Grid className="text-indigo-600" size={20} /> 
            {initialData ? 'Edit Meja' : 'Tambah Meja Baru'}
          </h2>
          <button 
            type="button"
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors" 
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSave}>
          {/* Modal Body */}
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Nomor / Kode Meja <span className="text-rose-500">*</span>
              </label>
              <input 
                type="text" 
                name="tableNo"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-extrabold text-lg placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all outline-none" 
                placeholder="Contoh: A1"
                value={formData.tableNo}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Area Lokasi (Zone)
              </label>
              <div className="relative">
                <Info size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  name="name"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all outline-none text-sm" 
                  placeholder="Contoh: Indoor, Outdoor, VIP"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Kapasitas Kursi
                </label>
                <div className="relative">
                  <Users size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="number" 
                    name="capacity"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all outline-none text-sm" 
                    placeholder="2"
                    min="1"
                    value={formData.capacity}
                    onChange={handleChange}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Status</label>
                <select 
                  name="status"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all outline-none text-sm" 
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Perbaikan">Sedang Perbaikan</option>
                </select>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-6 pt-0 flex gap-3">
            <button 
              type="button" 
              className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-bold rounded-xl transition-all text-sm flex justify-center" 
              onClick={onClose}
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] text-white font-bold rounded-xl shadow-sm shadow-indigo-100 transition-all text-sm flex justify-center" 
              disabled={!formData.tableNo.trim()}
            >
              {initialData ? 'Simpan' : 'Tambahkan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TableModal;
