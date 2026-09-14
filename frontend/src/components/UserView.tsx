import React, { useState, useEffect, useContext } from 'react';
import { Users, UserPlus, Shield, Edit, Trash2, ShieldAlert, Search, Phone, CheckCircle, XCircle } from 'lucide-react';
import UserModal from './UserModal';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert, errorAlert } from '../utils/alert';

const UserView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const posContext = useContext(POSContext);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        setUsers(await res.json());
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal mengambil data user', 'error');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token && posContext?.user?.role === 'Admin') {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [posContext?.token]);

  const handleDelete = async (id: number, name: string) => {
    const confirmResult = await confirmAlert('Konfirmasi', `Apakah Anda yakin ingin menonaktifkan akun staf "${name}"?`);
    if (!confirmResult.isConfirmed) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast(`Akun staf "${name}" dinonaktifkan.`, 'success');
        fetchUsers();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menghapus user', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Kasir': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Dapur': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Waiter': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-4">
      
      {/* HEADER / ACTION TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 sm:gap-4 shrink-0">
        <div className="hidden sm:block">
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            <Users className="text-primary" size={24} /> Pengguna &amp; Karyawan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Kelola data staf dan atur izin hak akses masing-masing akun</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            className="w-full sm:w-auto btn btn-primary shadow-md hover:shadow-lg flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all active:scale-95" 
            onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}
          >
            <UserPlus size={16} /> + Tambah Karyawan
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card p-3 bg-white shadow-sm border border-slate-200/80 rounded-2xl flex items-center gap-2.5 shrink-0">
        <Search size={16} className="text-slate-400 shrink-0 ml-1" />
        <input 
          type="text" 
          placeholder="Cari nama karyawan, username, atau role..." 
          className="w-full text-xs font-medium bg-transparent focus:outline-none placeholder:text-slate-400"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button 
            className="text-xs font-bold text-slate-400 hover:text-slate-600 px-1"
            onClick={() => setSearchQuery('')}
          >
            ✕
          </button>
        )}
      </div>

      {/* Content */}
      <div className="card flex-1 flex flex-col p-0 overflow-hidden shadow-sm bg-white rounded-2xl border border-slate-200/80 shrink-0">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium text-xs">Memuat data pengguna...</div>
        ) : posContext?.user?.role !== 'Admin' ? (
          <div className="p-12 text-center text-rose-500 font-bold text-xs">Hanya Admin yang dapat melihat dan mengelola data pengguna.</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium text-xs">Tidak ada data karyawan ditemukan.</div>
        ) : (
          <>
            {/* Mobile Cards List (< 640px) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <div 
                  key={user.id} 
                  className={`p-4 space-y-3 ${user.status === 'Nonaktif' ? 'opacity-60 bg-slate-50/50' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-sm flex items-center justify-center border border-indigo-100/80 shrink-0">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 leading-tight">{user.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">@{user.username}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-extrabold ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${user.status === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                        {user.status}
                      </span>
                    </div>
                  </div>

                  {/* Permissions Badges */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hak Akses:</div>
                    {user.role === 'Admin' ? (
                      <span className="text-xs text-primary font-bold flex items-center gap-1">
                        <Shield size={13} /> Akses Penuh Sistem
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.permissions?.canVoid && <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200">Void</span>}
                        {user.permissions?.canDiscount && <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">Diskon</span>}
                        {user.permissions?.canEditMenu && <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-200">Menu</span>}
                        {user.permissions?.canViewReports && <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200">Laporan</span>}
                        {!user.permissions?.canVoid && !user.permissions?.canDiscount && !user.permissions?.canEditMenu && !user.permissions?.canViewReports && (
                          <span className="text-[10px] text-slate-400 italic">Standar Kasir</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button 
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                    >
                      <Edit size={13} /> Edit Profil &amp; PIN
                    </button>
                    {user.role !== 'Admin' && (
                      <button 
                        className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
                        onClick={() => handleDelete(user.id, user.name)}
                      >
                        <Trash2 size={13} /> Hapus
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= 640px) */}
            <div className="hidden sm:block table-responsive p-0 overflow-x-auto">
              <table className="data-table w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th>NAMA LENGKAP</th>
                    <th>USERNAME</th>
                    <th>PERAN (ROLE)</th>
                    <th>HAK AKSES KHUSUS</th>
                    <th>STATUS</th>
                    <th className="text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className={user.status === 'Nonaktif' ? 'opacity-60 bg-gray-50' : 'hover:bg-gray-50'}>
                      <td>
                        <div className="font-bold text-gray-800 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-100">
                            {user.name.slice(0, 2).toUpperCase()}
                          </div>
                          {user.name}
                        </div>
                      </td>
                      <td className="text-muted text-sm font-mono">@{user.username}</td>
                      <td>
                        <span className={`text-xs px-2 py-1 rounded-md border font-bold ${getRoleBadge(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        {user.role === 'Admin' ? (
                          <span className="text-xs text-primary font-bold flex items-center gap-1">
                            <Shield size={12} /> Akses Penuh
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {user.permissions?.canVoid && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-bold">Void</span>}
                            {user.permissions?.canDiscount && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100 font-bold">Diskon</span>}
                            {user.permissions?.canEditMenu && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 font-bold">Menu</span>}
                            {user.permissions?.canViewReports && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-bold">Laporan</span>}
                            {!user.permissions?.canVoid && !user.permissions?.canDiscount && !user.permissions?.canEditMenu && !user.permissions?.canViewReports && (
                              <span className="text-[10px] text-gray-400">Standar</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${user.status === 'Aktif' ? 'badge-success' : 'badge-danger'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button 
                            className="icon-btn text-blue-600 bg-blue-50" 
                            title="Edit Data"
                            onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                          >
                            <Edit size={16}/>
                          </button>
                          <button 
                            className="icon-btn text-red-600 bg-red-50" 
                            title="Hapus Akun" 
                            disabled={user.role === 'Admin'}
                            onClick={() => handleDelete(user.id, user.name)}
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        
        <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
          <ShieldAlert size={15} className="text-amber-500 shrink-0" />
          <span className="text-[11px] text-slate-500">Akun dengan role Admin memiliki hak akses mutlak dan terlindungi dari penghapusan.</span>
        </div>
      </div>

      <UserModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedUser}
        onSave={() => fetchUsers()}
      />
    </div>
  );
};

export default UserView;

