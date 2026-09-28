import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Wrench, Search, Check, X } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';

export const ServiceTypeManager: React.FC = () => {
  const { token } = usePOS();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [vehicleFilter, setVehicleFilter] = useState<string>('ALL');

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formVehicleType, setFormVehicleType] = useState<string>('MOTOR');
  const [formRetail, setFormRetail] = useState<string>('');
  const [formMitra, setFormMitra] = useState<string>('');
  const [formGrosir, setFormGrosir] = useState<string>('');

  const fetchServices = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/bengkel/service-types?vehicleType=${vehicleFilter}&search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setServices(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
      toast('Gagal memuat katalog jasa', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, vehicleFilter, search]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormVehicleType('MOTOR');
    setFormRetail('');
    setFormMitra('');
    setFormGrosir('');
    setShowModal(true);
  };

  const handleOpenEdit = (srv: any) => {
    setEditingId(srv.id);
    setFormName(srv.name);
    setFormDescription(srv.description || '');
    setFormVehicleType(srv.vehicleType || 'MOTOR');
    setFormRetail(String(srv.priceRetail));
    setFormMitra(srv.priceMitra != null ? String(srv.priceMitra) : '');
    setFormGrosir(srv.priceGrosir != null ? String(srv.priceGrosir) : '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formRetail.trim()) {
      toast('Nama jasa dan harga retail wajib diisi', 'warning');
      return;
    }

    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        vehicleType: formVehicleType,
        priceRetail: parseFloat(formRetail),
        priceMitra: formMitra ? parseFloat(formMitra) : null,
        priceGrosir: formGrosir ? parseFloat(formGrosir) : null
      };

      const url = editingId ? `/api/bengkel/service-types/${editingId}` : '/api/bengkel/service-types';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast(`Jasa "${formName}" berhasil ${editingId ? 'diperbarui' : 'ditambahkan'}!`, 'success');
        setShowModal(false);
        fetchServices();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyimpan data jasa', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menonaktifkan jasa "${name}"?`)) return;
    try {
      const res = await fetch(`/api/bengkel/service-types/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast(`Jasa "${name}" dinonaktifkan`, 'success');
        fetchServices();
      }
    } catch (e) {
      console.error(e);
      toast('Gagal menghapus jasa', 'error');
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Katalog Jasa & Servis Bengkel</h1>
          <p className="text-sm text-slate-500">
            Kelola daftar pekerjaan bengkel (Tune Up, Ganti Oli, dll) beserta tarif harga 3-Tier (Umum, Mitra, Grosir).
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Plus size={18} />
          Tambah Jasa Baru
        </button>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama jasa..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 font-medium">Filter Kendaraan:</span>
          {(['ALL', 'MOTOR', 'MOBIL'] as const).map(vt => (
            <button
              key={vt}
              onClick={() => setVehicleFilter(vt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                vehicleFilter === vt
                  ? 'bg-purple-700 text-white border-purple-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {vt === 'ALL' ? 'Semua' : vt}
            </button>
          ))}
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-4">Nama Jasa</th>
                <th className="p-4">Tipe Kendaraan</th>
                <th className="p-4 text-right">Harga UMUM</th>
                <th className="p-4 text-right">Harga MITRA</th>
                <th className="p-4 text-right">Harga GROSIR</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                    Memuat katalog jasa...
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                    Belum ada jasa ditemukan.
                  </td>
                </tr>
              ) : (
                services.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-slate-400 mt-0.5">{s.description}</div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {s.vehicleType}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-900">
                      Rp {s.priceRetail.toLocaleString('id-ID')}
                    </td>
                    <td className="p-4 text-right text-slate-600">
                      {s.priceMitra != null ? `Rp ${s.priceMitra.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="p-4 text-right text-slate-600">
                      {s.priceGrosir != null ? `Rp ${s.priceGrosir.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit Service */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingId ? 'Edit Jasa Bengkel' : 'Tambah Jasa Baru'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Jasa</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Servis Ringan + Tune Up"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Kendaraan</label>
                <select
                  value={formVehicleType}
                  onChange={(e) => setFormVehicleType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="MOTOR">Motor</option>
                  <option value="MOBIL">Mobil</option>
                  <option value="ALL">Semua Jenis Kendaraan</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Harga UMUM</label>
                  <input
                    type="number"
                    required
                    value={formRetail}
                    onChange={(e) => setFormRetail(e.target.value)}
                    placeholder="85000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Harga MITRA</label>
                  <input
                    type="number"
                    value={formMitra}
                    onChange={(e) => setFormMitra(e.target.value)}
                    placeholder="75000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Harga GROSIR</label>
                  <input
                    type="number"
                    value={formGrosir}
                    onChange={(e) => setFormGrosir(e.target.value)}
                    placeholder="65000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi Tambahan</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Rincian poin pengecekan atau deskripsi jasa..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-purple-700 text-white font-bold text-sm hover:bg-purple-800 shadow-sm"
                >
                  Simpan Jasa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceTypeManager;
