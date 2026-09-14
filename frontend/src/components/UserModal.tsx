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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 overflow-y-auto animate-fade-in">
      <div 
        className="bg-white w-full h-[95vh] md:h-auto md:max-w-xl rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-bottom duration-200 md:animate-none border border-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
              <UserCheck size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                {initialData ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Atur akun staf, PIN absensi, dan batasan hak akses fitur
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shadow-sm" 
            onClick={onClose} 
            disabled={loading}
          >
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto max-h-[calc(100vh-140px)] md:max-h-[72vh] pb-32 md:pb-6">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Nama Lengkap *</label>
                <input type="text" name="name" className="form-control" placeholder="Contoh: Sarah Angelina" value={formData.name} onChange={handleChange} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Username (Login) *</label>
                <input type="text" name="username" className="form-control" placeholder="sarah_pos" value={formData.username} onChange={handleChange} required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Password Login {initialData && <span className="text-[10px] text-slate-400 font-normal lowercase">(kosongkan jika tak diubah)</span>}
                </label>
                <div className="relative">
                  <Key size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input type="password" name="password" className="form-control pl-9" style={{ paddingLeft: '2.5rem' }} placeholder="••••••" value={formData.password} onChange={handleChange} required={!initialData} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  PIN Absensi & Ganti Kasir {initialData && <span className="text-[10px] text-slate-400 font-normal lowercase">(opsional)</span>}
                </label>
                <input type="password" name="pin" maxLength={6} className="form-control font-mono tracking-widest text-center" placeholder="123456" value={formData.pin} onChange={handleChange} required={!initialData} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Role / Peran Utama</label>
                <select name="role" className="form-control" value={formData.role} onChange={handleChange}>
                  <option value="Kasir">Kasir</option>
                  <option value="Dapur">Dapur (KDS)</option>
                  <option value="Waiter">Pelayan (Waiter)</option>
                  <option value="Admin">Admin / Owner</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Status Karyawan</label>
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
                  <p className="text-xs text-indigo-700 mt-1">Role Admin memiliki kuasa tak terbatas untuk melihat, merubah, dan menghapus seluruh data pada sistem POS.</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center gap-3 shrink-0">
            <button 
              type="button" 
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs transition-all active:scale-95" 
              onClick={onClose} 
              disabled={loading}
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2" 
              disabled={loading}
            >
              <UserCheck size={16} />
              {loading ? 'Menyimpan...' : 'Simpan Data Karyawan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
