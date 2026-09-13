import React, { useState, useEffect, useContext } from 'react';
import { 
  X, Plus, Edit2, Trash2, FolderPlus, Printer, Layers, 
  Check, AlertCircle, RefreshCw, ChevronRight, CornerDownRight 
} from 'lucide-react';
import Swal from 'sweetalert2';
import { POSContext } from '../context/POSContext';

export interface CategoryItem {
  id: number;
  name: string;
  printerTarget: string;
  parentId?: number | null;
  parent?: CategoryItem | null;
  subCategories?: CategoryItem[];
  _count?: {
    products?: number;
    subProducts?: number;
  };
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated?: () => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onCategoriesUpdated
}) => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    printerTarget: 'KITCHEN',
    parentId: ''
  });

  const posContext = useContext(POSContext);
  const token = posContext?.token || localStorage.getItem('pos_token');

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      printerTarget: 'KITCHEN',
      parentId: ''
    });
  };

  const handleOpenAddMain = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      printerTarget: 'KITCHEN',
      parentId: ''
    });
    setIsFormOpen(true);
  };

  const handleOpenAddSub = (parentCat: CategoryItem) => {
    setEditingCategory(null);
    setFormData({
      name: '',
      printerTarget: parentCat.printerTarget || 'KITCHEN',
      parentId: parentCat.id.toString()
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (category: CategoryItem) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      printerTarget: category.printerTarget || 'KITCHEN',
      parentId: category.parentId ? category.parentId.toString() : ''
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Validasi Gagal',
        text: 'Nama kategori tidak boleh kosong.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        printerTarget: formData.printerTarget,
        parentId: formData.parentId ? Number(formData.parentId) : null
      };

      let url = '/api/categories';
      let method = 'POST';

      if (editingCategory) {
        url = `/api/categories/${editingCategory.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: editingCategory ? 'Kategori Diperbarui' : 'Kategori Ditambahkan',
          text: `Kategori "${formData.name}" berhasil ${editingCategory ? 'diperbarui' : 'disimpan'}.`,
          timer: 1500,
          showConfirmButton: false
        });
        resetForm();
        await fetchCategories();
        if (onCategoriesUpdated) onCategoriesUpdated();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Menyimpan',
          text: resData.error || 'Terjadi kesalahan pada server.',
          confirmButtonColor: '#4f46e5'
        });
      }
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error Jaringan',
        text: 'Tidak dapat menghubungi server.',
        confirmButtonColor: '#4f46e5'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (category: CategoryItem) => {
    const isSub = !!category.parentId;
    const confirmRes = await Swal.fire({
      title: `Hapus ${isSub ? 'Sub-Kategori' : 'Kategori'}?`,
      text: `Apakah Anda yakin ingin menghapus "${category.name}"? Kategori yang masih memiliki produk tidak dapat dihapus.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (!confirmRes.isConfirmed) return;

    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const resData = await res.json();
      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Dihapus',
          text: `${isSub ? 'Sub-Kategori' : 'Kategori'} "${category.name}" berhasil dihapus.`,
          timer: 1500,
          showConfirmButton: false
        });
        await fetchCategories();
        if (onCategoriesUpdated) onCategoriesUpdated();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Menghapus',
          text: resData.error || 'Tidak dapat menghapus kategori.',
          confirmButtonColor: '#4f46e5'
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Terjadi kesalahan sistem saat menghapus kategori.',
        confirmButtonColor: '#4f46e5'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Layers size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Manajemen Kategori & Sub-Kategori</h3>
              <p className="text-xs text-slate-500">Kelola kategori menu utama, sub-kategori, dan target routing printer</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          
          {/* TOP ACTION BAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-bold text-slate-800">{categories.length}</span> Kategori Utama
              <span className="text-slate-300">|</span>
              <span className="font-bold text-slate-800">
                {categories.reduce((acc, cat) => acc + (cat.subCategories?.length || 0), 0)}
              </span> Sub-Kategori
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={fetchCategories}
                disabled={loading}
                className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 px-3 flex items-center gap-1.5 rounded-lg border border-slate-300"
                title="Refresh Daftar"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleOpenAddMain}
                className="btn btn-primary text-xs py-2 px-3 flex items-center gap-1.5 rounded-lg shadow-sm font-semibold"
              >
                <Plus size={15} />
                Tambah Kategori Utama
              </button>
            </div>
          </div>

          {/* ADD / EDIT FORM DRAWER / PANEL */}
          {isFormOpen && (
            <form onSubmit={handleSubmit} className="bg-indigo-50/60 border-2 border-indigo-200 rounded-2xl p-5 shadow-md space-y-4 animate-scale-up">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                <div className="font-bold text-sm text-indigo-900 flex items-center gap-2">
                  <FolderPlus size={18} className="text-indigo-600" />
                  {editingCategory 
                    ? `Edit ${editingCategory.parentId ? 'Sub-Kategori' : 'Kategori'}: ${editingCategory.name}`
                    : (formData.parentId ? 'Tambah Sub-Kategori Baru' : 'Tambah Kategori Utama Baru')
                  }
                </div>
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold p-1 hover:bg-indigo-100 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Nama Kategori */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Kategori <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ramen, Minuman, Snack"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-control text-sm bg-white"
                    autoFocus
                  />
                </div>

                {/* Induk Kategori (Parent) */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Induk Kategori (Parent)
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="form-control text-sm bg-white"
                  >
                    <option value="">-- Kategori Utama (Tanpa Induk) --</option>
                    {categories
                      .filter(c => !editingCategory || c.id !== editingCategory.id)
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} (Kategori Utama)
                        </option>
                      ))
                    }
                  </select>
                </div>

                {/* Routing Printer */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Routing Printer Otomatis
                  </label>
                  <select
                    value={formData.printerTarget}
                    onChange={(e) => setFormData({ ...formData, printerTarget: e.target.value })}
                    className="form-control text-sm bg-white"
                  >
                    <option value="KITCHEN">🍳 Dapur (Kitchen Printer)</option>
                    <option value="BAR">🍹 Bar (Barista / Minuman)</option>
                    <option value="NONE">🥤 Kasir / Showcase Saja</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-indigo-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn bg-white hover:bg-slate-100 text-slate-700 text-xs py-2 px-4 rounded-lg border border-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs py-2 px-5 rounded-lg shadow-sm font-semibold flex items-center gap-1.5"
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingCategory ? 'Simpan Perubahan' : 'Tambahkan Kategori'}
                </button>
              </div>
            </form>
          )}

          {/* CATEGORIES LIST HIERARCHY */}
          <div className="space-y-4">
            {loading && categories.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-indigo-500" />
                <span className="text-xs">Memuat daftar kategori...</span>
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500 space-y-3">
                <Layers size={36} className="mx-auto text-slate-300" />
                <div className="text-sm font-bold">Belum Ada Kategori Menu</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Tambahkan kategori utama seperti Makanan, Minuman, atau Camilan untuk mengelompokkan menu Anda.
                </p>
                <button
                  onClick={handleOpenAddMain}
                  className="btn btn-primary text-xs py-2 px-4 rounded-lg font-semibold"
                >
                  <Plus size={14} /> Tambah Kategori Pertama
                </button>
              </div>
            ) : (
              categories.map((mainCat) => {
                const subCats = mainCat.subCategories || [];
                const mainProductCount = mainCat._count?.products || 0;

                return (
                  <div 
                    key={mainCat.id} 
                    className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-all"
                  >
                    {/* MAIN CATEGORY ROW */}
                    <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {mainCat.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                            {mainCat.name}
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {mainProductCount} Produk
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Printer size={12} className="text-slate-400" />
                            Target: <span className="font-semibold text-slate-700">
                              {mainCat.printerTarget === 'KITCHEN' ? '🍳 Dapur' : mainCat.printerTarget === 'BAR' ? '🍹 Bar' : '🥤 Showcase / Kasir'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>{subCats.length} Sub-kategori</span>
                          </div>
                        </div>
                      </div>

                      {/* ACTION BUTTONS FOR MAIN CATEGORY */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenAddSub(mainCat)}
                          className="btn bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs py-1.5 px-2.5 rounded-lg flex items-center gap-1 font-semibold transition-colors"
                          title="Tambah Sub-Kategori di bawah kategori ini"
                        >
                          <Plus size={13} />
                          + Sub-Kategori
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(mainCat)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit Kategori Utama"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(mainCat)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Kategori Utama"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* SUB CATEGORIES LIST */}
                    {subCats.length > 0 ? (
                      <div className="p-3 divide-y divide-slate-100 bg-white">
                        {subCats.map((subCat) => {
                          const subProductCount = subCat._count?.subProducts || subCat._count?.products || 0;
                          return (
                            <div 
                              key={subCat.id}
                              className="py-2.5 px-3 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-2.5 pl-3">
                                <CornerDownRight size={15} className="text-slate-400" />
                                <div>
                                  <div className="font-semibold text-xs text-slate-700 flex items-center gap-2">
                                    {subCat.name}
                                    <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                                      {subProductCount} Produk
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                    Printer: {subCat.printerTarget === 'KITCHEN' ? '🍳 Dapur' : subCat.printerTarget === 'BAR' ? '🍹 Bar' : '🥤 Showcase / Kasir'}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(subCat)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                  title="Edit Sub-Kategori"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(subCat)}
                                  className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                  title="Hapus Sub-Kategori"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-3 px-6 text-xs text-slate-400 italic flex items-center gap-2">
                        <CornerDownRight size={13} className="text-slate-300" />
                        Belum ada sub-kategori. Klik "+ Sub-Kategori" di atas untuk menambahkan.
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <AlertCircle size={14} />
            Perubahan kategori otomatis tersinkronisasi ke katalog produk & POS
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn bg-slate-800 hover:bg-slate-900 text-white text-xs py-2 px-5 rounded-xl font-semibold shadow-sm"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
