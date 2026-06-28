import React, { useState, useEffect, useContext } from 'react';
import { X, DollarSign, Tag, FileText } from 'lucide-react';

interface CashFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

const CashFlowModal: React.FC<CashFlowModalProps> = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    type: 'Pengeluaran',
    category: '',
    amount: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave(formData);
    setLoading(false);
    setFormData({
      type: 'Pengeluaran',
      category: '',
      amount: '',
      description: ''
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header bg-gray-50 border-b border-gray-200">
          <h2 className="modal-title flex items-center gap-2">
            <DollarSign className="text-primary" /> 
            Catat Arus Kas
          </h2>
          <button className="icon-btn" onClick={onClose} disabled={loading}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Jenis Transaksi</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="type" 
                    value="Pemasukan" 
                    checked={formData.type === 'Pemasukan'}
                    onChange={handleChange}
                    className="w-4 h-4 text-success"
                  />
                  <span className="text-sm font-medium text-success">Pemasukan (In)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="type" 
                    value="Pengeluaran" 
                    checked={formData.type === 'Pengeluaran'}
                    onChange={handleChange}
                    className="w-4 h-4 text-danger"
                  />
                  <span className="text-sm font-medium text-danger">Pengeluaran (Out)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Kategori <span className="text-danger">*</span></label>
              <div className="relative">
                <Tag size={18} className="absolute left-3 top-3 text-muted" />
                <select 
                  name="category"
                  className="form-control pl-10" 
                  style={{ paddingLeft: '2.5rem' }}
                  value={formData.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">Pilih Kategori...</option>
                  {formData.type === 'Pengeluaran' ? (
                    <>
                      <option value="Bahan Baku">Beli Bahan Baku</option>
                      <option value="Operasional">Operasional (Listrik, Air)</option>
                      <option value="Gaji">Gaji Karyawan</option>
                      <option value="Lainnya">Lainnya</option>
                    </>
                  ) : (
                    <>
                      <option value="Modal">Tambahan Modal</option>
                      <option value="Pendapatan Luar">Pendapatan Lain-lain</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nominal (Rp) <span className="text-danger">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-muted font-bold">Rp</span>
                <input 
                  type="number" 
                  name="amount"
                  className="form-control pl-10 text-lg font-bold" 
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="0"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Catatan Tambahan</label>
              <div className="relative">
                <FileText size={18} className="absolute left-3 top-3 text-muted" />
                <textarea 
                  name="description"
                  className="form-control pl-10 py-3" 
                  style={{ paddingLeft: '2.5rem' }}
                  rows={3}
                  placeholder="Tulis rincian catatan disini..."
                  value={formData.description}
                  onChange={handleChange}
                  required
                ></textarea>
              </div>
            </div>
          </div>

          <div className="modal-footer flex gap-3 bg-gray-50 border-t border-gray-200">
            <button type="button" className="btn btn-outline flex-1 justify-center" onClick={onClose} disabled={loading}>Batal</button>
            <button type="submit" className="btn btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CashFlowModal;
