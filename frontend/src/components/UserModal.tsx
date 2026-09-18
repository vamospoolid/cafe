import React, { useState, useEffect, useContext } from 'react';
import { X, Shield, Key, UserCheck, ShieldAlert, FileText, ShoppingCart, Utensils, Warehouse, Users, Settings } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  onSave: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, initialData, onSave }) => {
  const posContext = useContext(POSContext);
  const [loading, setLoading] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    pin: '',
    role: 'CASHIER',
    roleId: '',
    employmentType: 'FULL_TIME',
    status: 'Aktif',
    permissions: {
      canVoid: false,
      canDiscount: false,
      canEditMenu: false,
      canViewReports: false,
      canManageStaff: false
    }
  });

  useEffect(() => {
    // Fetch available roles from backend
    const fetchRoles = async () => {
      try {
        const res = await fetch('/api/users/roles-permissions', {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableRoles(data.roles || []);
        }
      } catch (e) {
        console.error('Failed to fetch roles:', e);
      }
    };

    if (isOpen && posContext?.token) {
      fetchRoles();
    }
  }, [isOpen, posContext?.token]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        username: initialData.username || '',
        password: '', 
        pin: initialData.pin || '', 
        role: initialData.role || 'CASHIER',
        roleId: initialData.roleId || '',
        employmentType: initialData.employmentType || 'FULL_TIME',
        status: initialData.status || 'Aktif',
        permissions: initialData.permissions || {
          canVoid: false,
          canDiscount: false,
          canEditMenu: false,
          canViewReports: false,
          canManageStaff: false
        }
      });
    } else {
      setFormData({
        name: '',
        username: '',
        password: '',
        pin: '123456',
        role: 'CASHIER',
        roleId: 'role-system-cashier',
        employmentType: 'FULL_TIME',
        status: 'Aktif',
        permissions: {
          canVoid: false,
          canDiscount: false,
          canEditMenu: false,
          canViewReports: false,
          canManageStaff: false
        }
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'role') {
      const selectedRoleObj = availableRoles.find(r => r.name === value || r.id === value);
      const permKeys = selectedRoleObj?.permissions || [];
      
      const isOwnerOrAdmin = value === 'OWNER' || value === 'ADMIN' || value === 'Admin';
      setFormData(prev => ({
        ...prev,
        role: value,
        roleId: selectedRoleObj?.id || prev.roleId,
        permissions: {
          canVoid: isOwnerOrAdmin || permKeys.includes('pos.void'),
          canDiscount: isOwnerOrAdmin || permKeys.includes('pos.discount'),
          canEditMenu: isOwnerOrAdmin || permKeys.includes('products.manage'),
          canViewReports: isOwnerOrAdmin || permKeys.includes('reports.view'),
          canManageStaff: isOwnerOrAdmin || permKeys.includes('employees.manage')
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
        toast(isEdit ? 'Data staf berhasil diperbarui' : 'Staf baru berhasil ditambahkan', 'success');
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

  const isFullAccess = formData.role === 'OWNER' || formData.role === 'ADMIN' || formData.role === 'Admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div 
        className="bg-white w-full h-full md:h-auto md:max-w-xl md:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden animate-in fade-in zoom-in-95 duration-200 border-0 md:border border-slate-100"
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
                Atur akun staf, Role RBAC, PIN absensi/kasir, dan batas hak akses
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
          <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto max-h-[calc(100vh-140px)] md:max-h-[72vh] pb-24 md:pb-6">
            
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
                  PIN Absensi &amp; Ganti Kasir {initialData && <span className="text-[10px] text-slate-400 font-normal lowercase">(opsional)</span>}
                </label>
                <input type="password" name="pin" maxLength={8} className="form-control font-mono tracking-widest text-center" placeholder="123456" value={formData.pin} onChange={handleChange} required={!initialData} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Role &amp; Jabatan (RBAC)</label>
                <select name="role" className="form-control font-semibold" value={formData.role} onChange={handleChange}>
                  {availableRoles.length > 0 ? (
                    availableRoles.map(r => (
                      <option key={r.id} value={r.name}>{r.name} - {r.description?.split('-')[0]}</option>
                    ))
                  ) : (
                    <>
                      <option value="CASHIER">CASHIER (Kasir)</option>
                      <option value="KITCHEN">KITCHEN (Dapur)</option>
                      <option value="MANAGER">MANAGER (Manager Outlet)</option>
                      <option value="WAREHOUSE">WAREHOUSE (Gudang)</option>
                      <option value="HR">HR (Personalia)</option>
                      <option value="ADMIN">ADMIN (Administrator)</option>
                      <option value="OWNER">OWNER (Pemilik Usaha)</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Tipe Kepegawaian</label>
                <select name="employmentType" className="form-control font-bold text-slate-800" value={formData.employmentType} onChange={handleChange}>
                  <option value="FULL_TIME">Full Time (Ikut Bonus Omzet)</option>
                  <option value="DAILY_WORKER">Daily Worker (DW)</option>
                  <option value="PART_TIME">Part Time</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Status Akun</label>
                <select name="status" className="form-control" value={formData.status} onChange={handleChange}>
                  <option value="Aktif">Aktif Bekerja</option>
                  <option value="Nonaktif">Nonaktif / Resign</option>
                </select>
              </div>
            </div>

            {!isFullAccess ? (
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 mt-2">
                <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <Shield size={14} className="text-indigo-600" /> Kustomisasi Izin Khusus Staf Ini
                </h4>
                
                <div className="space-y-2.5">
                  {/* Permission 1: Void */}
                  <label className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all select-none">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                        <X size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Batalkan Pesanan (Void)</div>
                        <div className="text-[10px] text-slate-400">Otorisasi membatalkan bill lunas &amp; kembalikan stok</div>
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
                  <label className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all select-none">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                        <span className="text-[13px] font-bold">%</span>
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
                  <label className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all select-none">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                        <Key size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Ubah Data Menu &amp; Harga</div>
                        <div className="text-[10px] text-slate-400">Otorisasi kelola stok, harga produk, &amp; edit item</div>
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
                  <label className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all select-none">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                        <FileText size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Lihat Laporan Penjualan</div>
                        <div className="text-[10px] text-slate-400">Akses melihat tab laporan omzet &amp; keuangan</div>
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
                  <h4 className="font-bold text-indigo-900 text-sm">Hak Akses Sovereign ({formData.role})</h4>
                  <p className="text-xs text-indigo-700 mt-1">Role ini memiliki kuasa penuh atas seluruh data operasional, kasir, inventaris, dan konfigurasi outlet.</p>
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
