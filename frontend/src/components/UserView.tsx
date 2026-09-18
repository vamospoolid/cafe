import React, { useState, useEffect, useContext } from 'react';
import { Users, UserPlus, Shield, Edit, Trash2, Search, Phone, CheckCircle, XCircle } from 'lucide-react';
import UserModal from './UserModal';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

const UserView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const posContext = useContext(POSContext);

  const canViewEmployees = posContext?.hasPermission('employees.view') || posContext?.user?.role === 'Admin' || posContext?.user?.role === 'OWNER';
  const canManageEmployees = posContext?.hasPermission('employees.manage') || posContext?.user?.role === 'Admin' || posContext?.user?.role === 'OWNER';

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
    if (posContext?.token && canViewEmployees) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [posContext?.token, canViewEmployees]);

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
        toast(err.error || 'Gagal menonaktifkan user', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleBadge = (role: string) => {
    const upper = (role || '').toUpperCase();
    switch (upper) {
      case 'OWNER': return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
      case 'ADMIN': return 'bg-purple-100 text-purple-700 border-purple-200 font-bold';
      case 'MANAGER': return 'bg-indigo-100 text-indigo-700 border-indigo-200 font-bold';
      case 'CASHIER':
      case 'KASIR': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'KITCHEN':
      case 'DAPUR': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'WAREHOUSE':
      case 'GUDANG': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'HR': return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'WAITER': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getEmploymentBadge = (type?: string) => {
    switch (type) {
      case 'DAILY_WORKER':
        return { label: 'Daily Worker (DW)', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'PART_TIME':
        return { label: 'Part Time', color: 'bg-sky-50 text-sky-700 border-sky-200' };
      case 'FULL_TIME':
      default:
        return { label: 'Full Time (Bonus Omzet)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
  };

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.role && u.role.toLowerCase().includes(q));
  });

  if (!canViewEmployees) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
        <Shield size={48} className="text-slate-300" />
        <h3 className="text-lg font-bold text-slate-700">Akses Terbatas</h3>
        <p className="text-sm text-slate-500">Anda memerlukan izin akses manajemen karyawan untuk melihat halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-4">
      
      {/* HEADER / ACTION TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 sm:gap-4 shrink-0">
        <div className="hidden sm:block">
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            <Users className="text-primary" size={24} /> Pengguna &amp; Karyawan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Kelola data staf, tipe kepegawaian, dan atur izin hak akses masing-masing akun dalam outlet</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Cari nama, username, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {canManageEmployees && (
            <button
              onClick={() => {
                setSelectedUser(null);
                setIsModalOpen(true);
              }}
              className="btn btn-primary text-xs sm:text-sm px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-primary/25 shrink-0"
            >
              <UserPlus size={16} />
              <span className="font-bold">Tambah Staf</span>
            </button>
          )}
        </div>
      </div>

      {/* STAFF LIST TABLE / CARDS */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Memuat data staf...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
            <Users size={36} className="text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Tidak ada staf yang cocok</p>
            <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau tambahkan staf baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] sm:text-xs">
                <tr>
                  <th className="py-3 px-4">Nama / Username</th>
                  <th className="py-3 px-4">Role &amp; Jabatan</th>
                  <th className="py-3 px-4">Tipe Kepegawaian</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Izin Fitur Utama</th>
                  {canManageEmployees && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((u) => {
                  const empBadge = getEmploymentBadge(u.employmentType);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-xs text-slate-400 font-mono">@{u.username}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] border ${getRoleBadge(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] border font-medium ${empBadge.color}`}>
                          {empBadge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${u.status === 'Aktif' ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {u.status === 'Aktif' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {u.permissions?.canVoid && (
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] px-1.5 py-0.5 rounded font-medium">Void</span>
                          )}
                          {u.permissions?.canDiscount && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded font-medium">Diskon</span>
                          )}
                          {u.permissions?.canEditMenu && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-1.5 py-0.5 rounded font-medium">Menu</span>
                          )}
                          {u.permissions?.canViewReports && (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] px-1.5 py-0.5 rounded font-medium">Laporan</span>
                          )}
                          {u.role === 'OWNER' || u.role === 'Admin' ? (
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-bold">Akses Penuh</span>
                          ) : null}
                        </div>
                      </td>
                      {canManageEmployees && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-lg transition-all"
                              title="Edit Karyawan"
                            >
                              <Edit size={16} />
                            </button>
                            {u.role !== 'Admin' && u.role !== 'OWNER' && (
                              <button
                                onClick={() => handleDelete(u.id, u.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Nonaktifkan"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <UserModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialData={selectedUser}
          onSave={() => {
            setIsModalOpen(false);
            fetchUsers();
          }}
        />
      )}

    </div>
  );
};

export default UserView;
