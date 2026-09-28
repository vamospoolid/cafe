import React, { useState, useEffect, useContext, useMemo } from "react";
import {
  Package, Plus, Search, Edit, Trash2,
  AlertTriangle, CheckCircle, XCircle, Wallet,
  Grid, List, LayoutList, Barcode, Camera,
  Sparkles, ChevronRight, Layers, RotateCcw
} from "lucide-react";
import ProductModal from "./ProductModal";
import { CategoryModal } from "./CategoryModal";
import { POSContext } from "../context/POSContext";
import { toast, confirmAlert } from "../utils/alert";

type ViewMode = "ringkas" | "tabel" | "grid";

const ProductView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("ringkas");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStock, setFilterStock] = useState("Semua");

  const posContext = useContext(POSContext);
  const fmt = (val: number) => `Rp ${(val || 0).toLocaleString("id-ID")}`;

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products", { headers: { Authorization: `Bearer ${posContext?.token}` } });
      const data = await res.json();
      if (res.ok) setProducts(data);
    } catch (err) { console.error(err); }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories", { headers: { Authorization: `Bearer ${posContext?.token}` } });
      const data = await res.json();
      if (res.ok) setCategories(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (posContext?.token) {
      Promise.all([fetchProducts(), fetchCategories()]).finally(() => setLoading(false));
    }
  }, [posContext?.token]);

  const openAddModal = () => { setSelectedProduct(null); setIsModalOpen(true); };
  const openEditModal = (p: any) => { setSelectedProduct(p); setIsModalOpen(true); };

  const handleDelete = async (id: number) => {
    const result = await confirmAlert("Hapus Produk?", "Apakah Anda yakin ingin menghapus produk ini?");
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${posContext?.token}` } });
      if (res.ok) { fetchProducts(); toast("Produk berhasil dihapus", "success"); }
      else toast("Gagal menghapus produk", "error");
    } catch { toast("Terjadi kesalahan server", "error"); }
  };

  const handleSave = async (data: any) => {
    const isEdit = !!selectedProduct;
    try {
      const res = await fetch(isEdit ? `/api/products/${selectedProduct.id}` : "/api/products", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${posContext?.token}` },
        body: JSON.stringify(data)
      });
      if (res.ok) { setIsModalOpen(false); fetchProducts(); toast("Produk berhasil disimpan!", "success"); }
      else { const err = await res.json(); toast(`Error: ${err.error}`, "error"); }
    } catch { toast("Terjadi kesalahan saat menyimpan produk", "error"); }
  };

  const resetFilters = () => { setSearchQuery(""); setFilterCategory(""); setFilterStock("Semua"); };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.name?.toLowerCase().includes(q) && !p.barcode?.toLowerCase().includes(q)) return false;
      }
      if (filterCategory && String(p.categoryId) !== String(filterCategory)) return false;
      if (filterStock === "Stok Aman" && p.stock <= p.minStock) return false;
      if (filterStock === "Stok Menipis" && (p.stock <= 0 || p.stock > p.minStock)) return false;
      if (filterStock === "Habis" && p.stock > 0) return false;
      return true;
    });
  }, [products, searchQuery, filterCategory, filterStock]);

  const totalValue = products.reduce((sum, p) => sum + (p.buyPrice * p.stock), 0);
  const outOfStockCount = products.filter(p => p.stock <= 0 || p.isSoldOut).length;
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= p.minStock && !p.isSoldOut).length;
  const activeCount = products.filter(p => p.status === "Aktif").length;

  const getStockBadge = (p: any) => {
    if (p.stock <= 0 || p.isSoldOut) return { label: "0 pcs", cls: "bg-red-100 text-red-600 border-red-200" };
    if (p.stock <= p.minStock) return { label: `${p.stock} pcs`, cls: "bg-amber-100 text-amber-700 border-amber-200" };
    return { label: `${p.stock} pcs`, cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  };

  return (
    <div className="flex flex-col gap-0 pb-28 md:pb-6 bg-slate-50 min-h-screen">

      {/* PAGE HEADER */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20 shrink-0">
              <Package size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-800 leading-tight">Manajemen Produk</h1>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Kelola harga jual, stok &amp; klasifikasi kategori</p>
            </div>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-violet-500/25 active:scale-95 transition-all shrink-0"
          >
            <Plus size={15} /> Tambah
          </button>
        </div>

        {/* Quick Action Chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
          <button className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm active:scale-95 transition-all">
            <Sparkles size={12} /> AI Profit Advisor
          </button>
          <button className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-slate-600 shadow-sm active:scale-95 transition-all">
            <Barcode size={12} /> Cetak Barcode
          </button>
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-slate-600 shadow-sm active:scale-95 transition-all"
          >
            <Layers size={12} /> Kategori
          </button>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-slate-600 shadow-sm active:scale-95 transition-all"
          >
            <RotateCcw size={12} /> Reset Filter
          </button>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* STATS CARDS 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-3.5 flex items-center justify-between shadow-sm border border-slate-100/80">
            <div>
              <div className="text-2xl font-black text-slate-800">{products.length}</div>
              <div className="text-[11px] font-semibold text-slate-400 mt-0.5">Total Produk</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Package size={20} className="text-violet-600" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 flex items-center justify-between shadow-sm border border-slate-100/80">
            <div>
              <div className="text-2xl font-black text-slate-800">{activeCount}</div>
              <div className="text-[11px] font-semibold text-slate-400 mt-0.5">Produk Aktif</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle size={20} className="text-emerald-600" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 flex items-center justify-between shadow-sm border border-slate-100/80">
            <div>
              <div className="text-2xl font-black text-slate-800">{lowStockCount}</div>
              <div className="text-[11px] font-semibold text-slate-400 mt-0.5">Stok Menipis</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-500" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 flex items-center justify-between shadow-sm border border-slate-100/80">
            <div>
              <div className="text-2xl font-black text-slate-800">{outOfStockCount}</div>
              <div className="text-[11px] font-semibold text-slate-400 mt-0.5">Stok Habis</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <XCircle size={20} className="text-red-500" />
            </div>
          </div>
        </div>

        {/* NILAI STOK HPP */}
        <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-slate-100/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <Wallet size={20} className="text-indigo-600" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400">Nilai Stok (HPP)</div>
              <div className="text-lg font-black text-indigo-700 mt-0.5">{fmt(totalValue)}</div>
            </div>
          </div>
          <button className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl active:scale-95 transition-all">
            Nilai HPP
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5 shadow-sm border border-slate-200">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none font-medium"
              placeholder="Scan barcode atau ketik nama produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="w-11 h-11 rounded-2xl bg-violet-600 hover:bg-violet-700 flex items-center justify-center shadow-md shadow-violet-500/25 active:scale-95 transition-all shrink-0">
            <Camera size={18} className="text-white" />
          </button>
        </div>

        {/* FILTER ROW */}
        <div className="flex items-center gap-2">
          <select
            className="flex-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 px-3 py-2.5 shadow-sm outline-none"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Semua Ka...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            className="flex-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 px-3 py-2.5 shadow-sm outline-none"
            value={filterStock}
            onChange={(e) => setFilterStock(e.target.value)}
          >
            <option value="Semua">Semua Sto...</option>
            <option value="Stok Aman">Stok Aman</option>
            <option value="Stok Menipis">Stok Menipis</option>
            <option value="Habis">Habis</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm shrink-0">
            <button
              onClick={() => setViewMode("ringkas")}
              className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold transition-all ${viewMode === "ringkas" ? "bg-violet-600 text-white" : "text-slate-500"}`}
            >
              <LayoutList size={13} /> <span className="hidden sm:inline">Ringkas</span>
            </button>
            <button
              onClick={() => setViewMode("tabel")}
              className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold transition-all ${viewMode === "tabel" ? "bg-violet-600 text-white" : "text-slate-500"}`}
            >
              <List size={13} /> <span className="hidden sm:inline">Tabel</span>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold transition-all ${viewMode === "grid" ? "bg-violet-600 text-white" : "text-slate-500"}`}
            >
              <Grid size={13} /> <span className="hidden sm:inline">Grid</span>
            </button>
          </div>
        </div>

        {/* PRODUCT COUNT */}
        <div className="text-[11px] font-semibold text-slate-400 -mt-1">
          Menampilkan <span className="text-violet-600 font-bold">{filteredProducts.length}</span> dari {products.length} produk
        </div>

        {/* LOADING */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 rounded-full border-[3px] border-violet-200 border-t-violet-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-400">Memuat produk...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Package size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400">Tidak ada produk ditemukan</p>
            <p className="text-xs text-slate-300">Coba ubah filter pencarian</p>
          </div>

        ) : viewMode === "ringkas" ? (
          /* RINGKAS VIEW */
          <div className="flex flex-col gap-3">
            {filteredProducts.map((prod) => {
              const stock = getStockBadge(prod);
              return (
                <div key={prod.id} className="bg-white rounded-2xl shadow-sm border border-slate-100/80 overflow-hidden active:scale-[0.99] transition-all">
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60">
                      {prod.imageUrl ? (
                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={22} className="text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-slate-800 text-sm leading-tight truncate">{prod.name}</span>
                        {prod.status === "Aktif" && (
                          <span className="shrink-0 text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full">Aktif</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium mb-1 flex-wrap">
                        <span className="font-bold text-slate-500">{prod.barcode || `SKU-${prod.id}`}</span>
                        {prod.category && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span>{prod.category.name}</span>
                            {prod.subCategory && (
                              <>
                                <ChevronRight size={10} className="text-slate-300 shrink-0" />
                                <span>{prod.subCategory.name}</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                      <div className="text-xs font-black text-violet-700">Ecer: {fmt(prod.sellPrice)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-violet-500 active:bg-violet-100 transition-colors"
                          title="Barcode"
                        >
                          <Barcode size={13} />
                        </button>
                        <button
                          className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-violet-500 active:bg-violet-100 transition-colors"
                          onClick={() => openEditModal(prod)}
                          title="Edit"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 active:bg-rose-100 transition-colors"
                          onClick={() => handleDelete(prod.id)}
                          title="Hapus"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stock.cls}`}>
                        {stock.label}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-t border-slate-100 px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">HPP: {fmt(prod.buyPrice)}</span>
                    <span className="text-[10px] font-bold text-emerald-600">
                      Margin: {prod.buyPrice > 0 ? Math.round(((prod.sellPrice - prod.buyPrice) / prod.buyPrice) * 100) : 0}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        ) : viewMode === "grid" ? (
          /* GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredProducts.map((prod) => {
              const stock = getStockBadge(prod);
              return (
                <div key={prod.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col group active:scale-[0.98] transition-all">
                  <div className="relative aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                    {prod.imageUrl ? (
                      <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <Package size={36} className="text-slate-300" />
                    )}
                    <span className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${stock.cls}`}>
                      {stock.label}
                    </span>
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <div className="text-[10px] text-violet-600 font-bold truncate mb-0.5">{prod.category?.name || "Tanpa Kategori"}</div>
                    <h3 className="font-bold text-slate-800 text-xs leading-tight mb-2 line-clamp-2 flex-1">{prod.name}</h3>
                    <div className="text-sm font-black text-violet-700 mb-2">{fmt(prod.sellPrice)}</div>
                    <div className="flex gap-1 border-t border-slate-100 pt-2">
                      <button className="flex-1 py-1.5 flex justify-center items-center rounded-lg text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors" onClick={() => openEditModal(prod)}><Edit size={13} /></button>
                      <button className="flex-1 py-1.5 flex justify-center items-center rounded-lg text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors" onClick={() => handleDelete(prod.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        ) : (
          /* TABEL VIEW */
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Produk</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Kategori</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Harga</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Stok</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Status</th>
                    <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-slate-500 font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((prod) => {
                    const stock = getStockBadge(prod);
                    return (
                      <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60">
                              {prod.imageUrl ? (
                                <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-slate-300" /></div>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{prod.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{prod.barcode || "-"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100">
                            {prod.category?.name || "-"}
                          </span>
                          {prod.subCategory && (
                            <div className="text-[10px] text-slate-400 mt-0.5">&gt; {prod.subCategory.name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[10px] text-slate-400">HPP: {fmt(prod.buyPrice)}</div>
                          <div className="font-black text-violet-700">{fmt(prod.sellPrice)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stock.cls}`}>
                            {stock.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${prod.status === "Aktif" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                            {prod.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-violet-500 hover:bg-violet-100 transition-colors" onClick={() => openEditModal(prod)} title="Edit"><Edit size={13} /></button>
                            <button className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 hover:bg-rose-100 transition-colors" onClick={() => handleDelete(prod.id)} title="Hapus"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedProduct}
        categories={categories}
        onSave={handleSave}
        onManageCategories={() => setIsCategoryModalOpen(true)}
      />
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesUpdated={() => { fetchCategories(); fetchProducts(); }}
      />
    </div>
  );
};

export default ProductView;
