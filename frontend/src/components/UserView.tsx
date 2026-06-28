import React, { useState, useEffect, useContext } from 'react';
import { Users, UserPlus, Shield, Edit, Trash2, ShieldAlert } from 'lucide-react';
import UserModal from './UserModal';
import { POSContext } from '../context/POSContext';

import { toast, confirmAlert, errorAlert } from '../utils/alert';
const UserView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const handleDelete = async (id: number) => {
    const confirmResult = await confirmAlert('Konfirmasi', 'Apakah Anda yakin ingin menonaktifkan akun ini?');
    if (!confirmResult.isConfirmed) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
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
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="text-primary" /> Pengguna & Karyawan
          </h2>
          <p className="text-muted mt-1">Kelola data staf dan atur izin hak akses masing-masing akun.</p>
        </div>
        <button 
          className="btn btn-primary shadow-md" 
          onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}
        >
          <UserPlus size={18} /> Tambah Karyawan
        </button>
      </div>

      <div className="card flex-1 flex flex-col p-0 overflow-hidden shadow-sm">
        {/* Table Section */}
        <div className="table-responsive p-4 flex-1 overflow-y-auto">
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
              {loading ? (
                <tr><td colSpan={6} className="text-center py-4">Memuat data...</td></tr>
              ) : posContext?.user?.role !== 'Admin' ? (
                <tr><td colSpan={6} className="text-center py-8 text-red-500 font-bold">Hanya Admin yang dapat melihat dan mengelola data pengguna.</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4">Tidak ada data.</td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className={user.status === 'Nonaktif' ? 'opacity-60 bg-gray-50' : 'hover:bg-gray-50'}>
                  <td>
                    <div className="font-bold text-gray-800">{user.name}</div>
                  </td>
                  <td className="text-muted text-sm font-mono">{user.username}</td>
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
                        {user.permissions?.canVoid && <span className="text-[10px] bg-red-50 text-red-600 px-1 rounded border border-red-100">Void</span>}
                        {user.permissions?.canDiscount && <span className="text-[10px] bg-green-50 text-green-600 px-1 rounded border border-green-100">Diskon</span>}
                        {user.permissions?.canEditMenu && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1 rounded border border-indigo-100">Menu</span>}
                        {user.permissions?.canViewReports && <span className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded border border-blue-100">Laporan</span>}
                        {!user.permissions?.canVoid && !user.permissions?.canDiscount && !user.permissions?.canEditMenu && !user.permissions?.canViewReports && (
                          <span className="text-[10px] text-gray-400">Tidak ada akses khusus</span>
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
                        onClick={() => handleDelete(user.id)}
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
        
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center gap-2">
          <ShieldAlert size={16} className="text-amber-500" />
          <span className="text-xs text-gray-600">Catatan: Akun dengan role Admin tidak dapat dihapus dan memiliki akses mutlak.</span>
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
