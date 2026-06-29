import React, { useState, useEffect, useContext } from 'react';
import { X, Shield, Key, UserCheck, ShieldAlert, FileText } from 'lucide-react';
import { POSContext } from '../context/POSContext';

import { toast, confirmAlert, errorAlert } from '../utils/alert';
interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  onSave: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, initialData, onSave }) => {
  const posContext = useContext(POSContext);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    pin: '',
    role: 'Kasir',
    status: 'Aktif',
    permissions: {
      canVoid: false,
      canDiscount: false,
      canEditMenu: false,
      canViewReports: false
    }
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        username: initialData.username,
        password: '', 
        pin: '', 
        role: initialData.role,
        status: initialData.status,
        permissions: initialData.permissions || {
          canVoid: false,
          canDiscount: false,
          canEditMenu: false,
          canViewReports: false
        }
      });
    } else {
      setFormData({
        name: '',
        username: '',
        password: '',
        pin: '',
        role: 'Kasir',
        status: 'Aktif',
        permissions: { canVoid: false, canDiscount: false, canEditMenu: false, canViewReports: false }
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [name]: checked }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isEdit = !!initialData;
      const url = isEdit ? `/api/users/${initialData.id}` : '/api/users';
      
      const payload: any = { ...formData };
      if (isEdit) {
        if (!payload.password) delete payload.password;
        if (!payload.pin) delete payload.pin;
      }

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onSave();
        onClose();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyimpan data', 'error');
      }
    } catch (error) {
      console.error(error);
      toast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header bg-slate-50 border-b border-gray-200">
          <h2 className="modal-title flex items-center gap-2">
            <UserCheck className="text-primary" /> {initialData ? 'Edit Karyawan' : 'Tambah Karyawan'}
          </h2>
          <button className="icon-btn" onClick={onClose} disabled={loading}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4 max-h-[70vh] overflow-y-auto">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap</label>
                <input type="text" name="name" className="form-control" value={formData.name} onChange={handleChange} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Username (Login)</label>
                <input type="text" name="username" className="form-control" value={formData.username} onChange={handleChange} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password Login {initialData && <span className="text-xs text-muted font-normal">(Kosongkan jika tak diubah)</span>}
                </label>
                <div className="relative">
                  <Key size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input type="password" name="password" className="form-control pl-9" style={{ paddingLeft: '2.5rem' }} placeholder="••••••" value={formData.password} onChange={handleChange} required={!initialData} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  PIN Mesin Absensi {initialData && <span className="text-xs text-muted font-normal">(Opsional)</span>}
                </label>
                <input type="password" name="pin" maxLength={6} className="form-control font-mono tracking-widest text-center" placeholder="123456" value={formData.pin} onChange={handleChange} required={!initialData} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role / Peran</label>
                <select name="role" className="form-control" value={formData.role} onChange={handleChange}>
                  <option value="Kasir">Kasir</option>
                  <option value="Dapur">Dapur (KDS)</option>
                  <option value="Waiter">Pelayan (Waiter)</option>
                  <option value="Admin">Admin / Owner</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status Karyawan</label>
                <select name="status" className="form-control" value={formData.status} onChange={handleChange}>
                  <option value="Aktif">Aktif Bekerja</option>
                  <option value="Nonaktif">Nonaktif / Resign</option>
                </select>
              </div>
            </div>

            {formData.role !== 'Admin' ? (
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 mt-2">
                <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <Shield size={14} className="text-indigo-600" /> Batasan Hak Akses Fitur
                </h4>
                
                <div className="space-y-3">
                  {/* Permission 1: Void */}
                  <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all select-none">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                        <X size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Batalkan Pesanan (Void)</div>
                        <div className="text-[10px] text-slate-400">Otorisasi membatalkan bill lunas & kembalikan stok</div>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      name="canVoid" 
                      className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500/20" 
                      checked={formData.permissions.canVoid} 
                      onChange={handlePermissionChange} 
                    />
                  </label>

                  {/* Permission 2: Discount */}
                  <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all select-none">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <span className="text-[14px] font-bold">%</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Berikan Diskon Harga</div>
                        <div className="text-[10px] text-slate-400">Otorisasi diskon manual / diskon pembayaran</div>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      name="canDiscount" 
                      className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500/20" 
                      checked={formData.permissions.canDiscount} 
                      onChange={handlePermissionChange} 
                    />
                  </label>

                  {/* Permission 3: Edit Menu */}
                  <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all select-none">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                        <Key size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Ubah Data Menu & Harga</div>
                        <div className="text-[10px] text-slate-400">Otorisasi kelola stok, harga produk, & edit item</div>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      name="canEditMenu" 
                      className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500/20" 
                      checked={formData.permissions.canEditMenu} 
                      onChange={handlePermissionChange} 
                    />
                  </label>

                  {/* Permission 4: Reports */}
                  <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all select-none">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                        <FileText size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Lihat Laporan Penjualan</div>
                        <div className="text-[10px] text-slate-400">Akses melihat tab laporan keuangan & analytics</div>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      name="canViewReports" 
                      className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500/20" 
                      checked={formData.permissions.canViewReports} 
                      onChange={handlePermissionChange} 
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3 mt-2">
                <ShieldAlert className="text-indigo-600 mt-0.5 shrink-0" size={20} />
                <div>
                  <h4 className="font-bold text-indigo-900 text-sm">Akses Penuh Superadmin</h4>
                  <p className="text-xs text-indigo-700 mt-1">Role Admin memiliki kuasa tak terbatas untuk melihat, merubah, dan menghapus seluruh data pada sistem POOOS.</p>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer flex gap-3 bg-gray-50 border-t border-gray-200">
            <button type="button" className="btn btn-outline flex-1 justify-center" onClick={onClose} disabled={loading}>Batal</button>
            <button type="submit" className="btn btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Data Karyawan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
