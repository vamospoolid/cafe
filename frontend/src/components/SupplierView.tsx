import React, { useState, useEffect, useContext } from 'react';
import { Truck, Plus, Edit2, Trash2, Phone, Mail, MapPin, Search, PackageSearch, MessageCircle, X, Sparkles, Building2, User } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface Supplier {
  id: number;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  _count?: {
    purchaseOrders: number;
    ingredients: number;
  };
}

const API = '/api';

const SupplierView: React.FC = () => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', contact: '', phone: '', email: '', address: '', notes: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/suppliers`, { headers });
      if (res.ok) {
        setSuppliers(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const openAdd = () => {
    setEditData(null);
    setForm({ name: '', contact: '', phone: '', email: '', address: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (s: Supplier) => {
    setEditData(s);
    setForm({
      name: s.name,
      contact: s.contact || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      notes: s.notes || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast('Nama supplier wajib diisi', 'error');
    const url = editData ? `${API}/suppliers/${editData.id}` : `${API}/suppliers`;
    const res = await fetch(url, {
      method: editData ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(form)
    });
    if (res.ok) {
      toast(editData ? 'Data supplier berhasil diperbarui' : 'Supplier baru berhasil ditambahkan', 'success');
      setShowModal(false);
      fetchData();
    } else {
      const err = await res.json();
      toast(err.error || 'Gagal menyimpan supplier', 'error');
    }
  };

  const handleDelete = async (s: Supplier) => {
    const confirm = await confirmAlert('Hapus Supplier', `Hapus "${s.name}" dari daftar pemasok?`);
    if (!confirm.isConfirmed) return;
    const res = await fetch(`${API}/suppliers/${s.id}`, { method: 'DELETE', headers });
    if (res.ok) {
      toast('Supplier berhasil dihapus', 'success');
      fetchData();
    } else {
      const err = await res.json();
      toast(err.error || 'Gagal menghapus supplier', 'error');
    }
  };

  const filtered = suppliers.filter(
    s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.phone || '').includes(search)
  );

  const totalPO = suppliers.reduce((s, x) => s + (x._count?.purchaseOrders || 0), 0);
  const totalBahan = suppliers.reduce((s, x) => s + (x._count?.ingredients || 0), 0);

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3 sm:gap-4">
      {/* HEADER / ACTION TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 sm:gap-4 shrink-0">
        <div className="hidden sm:block">
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            <Truck className="text-primary" size={24} /> Manajemen Pemasok / Supplier
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Kelola data vendor, kontak pemesanan bahan baku kopi &amp; dapur, serta riwayat purchase order</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama, PIC, nomor WA..."
              className="w-full pl-9 pr-7 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={openAdd}
            className="btn btn-primary text-xs sm:text-sm px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-primary/25 shrink-0"
          >
            <Plus size={16} />
            <span className="font-bold">Tambah Supplier</span>
          </button>
        </div>
      </div>

      {/* 3 METRIC STATS - 3 cols on mobile & desktop */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
        <div className="p-2.5 sm:p-3.5 bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm sm:text-2xl font-black text-indigo-600 tracking-tight">{suppliers.length}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">Total Pemasok</div>
          </div>
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Building2 size={15} className="sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-2.5 sm:p-3.5 bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm sm:text-2xl font-black text-blue-600 tracking-tight">{totalPO}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">Faktur PO</div>
          </div>
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <PackageSearch size={15} className="sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-2.5 sm:p-3.5 bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm sm:text-2xl font-black text-emerald-600 tracking-tight">{totalBahan}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">Bahan Tertaut</div>
          </div>
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Truck size={15} className="sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* SUPPLIERS GRID */}
      {loading ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center text-slate-400">
          <Truck size={32} className="mx-auto text-indigo-400 animate-pulse mb-2" />
          <p className="text-xs font-bold">Memuat daftar pemasok...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center text-slate-400">
          <Truck size={36} className="mx-auto text-slate-300 mb-2" />
          <h4 className="text-sm font-bold text-slate-700">Belum Ada Pemasok</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search ? 'Tidak ada supplier yang cocok dengan kata kunci pencarian.' : 'Silakan tambahkan supplier baru untuk melacak pemesanan bahan baku.'}
          </p>
          {!search && (
            <button
              onClick={openAdd}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-600/20 active:scale-95 transition-all"
            >
              <Plus size={15} /> Tambah Supplier Sekarang
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {filtered.map(s => {
            const cleanPhone = (s.phone || '').replace(/[^0-9]/g, '');
            const waNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

            return (
              <div
                key={s.id}
                className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5">
                  {/* Header Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                        <Building2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight truncate">{s.name}</h3>
                        {s.contact && (
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5 truncate">
                            <User size={11} className="text-slate-400 shrink-0" /> PIC: {s.contact}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(s)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 flex items-center justify-center transition-all active:scale-95"
                        title="Edit Supplier"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition-all active:scale-95"
                        title="Hapus Supplier"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Contacts & Address */}
                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    {s.phone && (
                      <div className="flex items-center justify-between gap-2 py-0.5">
                        <span className="flex items-center gap-1.5 text-slate-700 font-bold truncate">
                          <Phone size={13} className="text-slate-400 shrink-0" />
                          {s.phone}
                        </span>
                        {waNumber && (
                          <a
                            href={`https://wa.me/${waNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-100 transition-all shrink-0 active:scale-95"
                          >
                            <MessageCircle size={11} /> Chat WA
                          </a>
                        )}
                      </div>
                    )}

                    {s.email && (
                      <div className="flex items-center gap-1.5 text-slate-600 py-0.5">
                        <Mail size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{s.email}</span>
                      </div>
                    )}

                    {s.address && (
                      <div className="flex items-start gap-1.5 text-slate-600 py-0.5">
                        <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-relaxed text-[11px] sm:text-xs">{s.address}</span>
                      </div>
                    )}

                    {s.notes && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-xl border border-slate-100 mt-1 line-clamp-2">
                        "{s.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Footers Stats */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg sm:rounded-xl p-1.5 sm:p-2">
                    <span className="text-sm sm:text-base font-black text-indigo-700 block">{s._count?.purchaseOrders || 0}</span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-indigo-500 uppercase">Purchase Order</span>
                  </div>
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg sm:rounded-xl p-1.5 sm:p-2">
                    <span className="text-sm sm:text-base font-black text-emerald-700 block">{s._count?.ingredients || 0}</span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-emerald-500 uppercase">Bahan Baku</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

        {/* MODAL FORM SUPPLIER */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in">
            <div 
              className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:rounded-3xl p-5 sm:p-6 border-0 sm:border border-slate-100 shadow-2xl flex flex-col justify-between overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-inner">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 tracking-tight">
                      {editData ? 'Edit Data Pemasok' : 'Tambah Pemasok Baru'}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Informasi kontak & alamat vendor bahan baku
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowModal(false)} 
                  className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs flex-1 overflow-y-auto max-h-[calc(100vh-140px)] sm:max-h-[70vh] pr-1 py-3 pb-20 sm:pb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Nama Perusahaan / Supplier *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Contoh: CV. Sumber Biji Kopi Nusantara"
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Nama PIC / Sales
                    </label>
                    <input
                      type="text"
                      value={form.contact}
                      onChange={e => setForm(p => ({ ...p, contact: e.target.value }))}
                      placeholder="Budi Santoso"
                      className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Nomor Telepon / WA
                    </label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="0812xxxxxxxx"
                      className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Email Vendor</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="supplier@kopi.com"
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Alamat Gudang / Kantor</label>
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="Jl. Raya Kopi No. 12, Gudang Barat..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Catatan Tambahan (Term of Payment, dll)</label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="TOP 14 hari, minimal order 5kg roast beans..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3.5 border-t border-slate-100 bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Truck size={16} />
                  Simpan Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default SupplierView;
