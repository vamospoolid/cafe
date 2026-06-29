import React, { useState, useEffect, useContext } from 'react';
import { Package, Plus, Edit2, Trash2, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, TrendingDown, TrendingUp, Search, History } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  buyPrice: number;
  supplierId: number | null;
  supplier?: { id: number; name: string } | null;
}

interface AdjustModalState {
  open: boolean;
  ingredient: Ingredient | null;
}

const API = '/api';

const IngredientView: React.FC = () => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<Ingredient | null>(null);
  const [adjustModal, setAdjustModal] = useState<AdjustModalState>({ open: false, ingredient: null });
  const [logs, setLogs] = useState<{ [id: number]: any[] }>({});
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const [form, setForm] = useState({ name: '', unit: 'gram', stock: '', minStock: '', buyPrice: '', supplierId: '' });
  const [adjustForm, setAdjustForm] = useState({ change: '', type: 'Restock', description: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resIng, resSup] = await Promise.all([
        fetch(`${API}/ingredients`, { headers }),
        fetch(`${API}/suppliers`, { headers })
      ]);
      if (resIng.ok) setIngredients(await resIng.json());
      if (resSup.ok) setSuppliers(await resSup.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchData(); }, [token]);

  const openAdd = () => {
    setEditData(null);
    setForm({ name: '', unit: 'gram', stock: '', minStock: '', buyPrice: '', supplierId: '' });
    setShowModal(true);
  };

  const openEdit = (ing: Ingredient) => {
    setEditData(ing);
    setForm({ name: ing.name, unit: ing.unit, stock: String(ing.stock), minStock: String(ing.minStock), buyPrice: String(ing.buyPrice), supplierId: ing.supplierId ? String(ing.supplierId) : '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.unit) return toast('Nama dan satuan wajib diisi', 'error');
    const body = { name: form.name, unit: form.unit, stock: Number(form.stock) || 0, minStock: Number(form.minStock) || 0, buyPrice: Number(form.buyPrice) || 0, supplierId: form.supplierId || null };
    const url = editData ? `${API}/ingredients/${editData.id}` : `${API}/ingredients`;
    const method = editData ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
    if (res.ok) { toast(editData ? 'Bahan baku diperbarui' : 'Bahan baku ditambahkan', 'success'); setShowModal(false); fetchData(); }
    else { const err = await res.json(); toast(err.error || 'Gagal menyimpan', 'error'); }
  };

  const handleDelete = async (ing: Ingredient) => {
    const confirm = await confirmAlert('Hapus Bahan Baku', `Hapus "${ing.name}"?`);
    if (!confirm.isConfirmed) return;
    const res = await fetch(`${API}/ingredients/${ing.id}`, { method: 'DELETE', headers });
    if (res.ok) { toast('Bahan baku dihapus', 'success'); fetchData(); }
    else { const err = await res.json(); toast(err.error || 'Gagal menghapus', 'error'); }
  };

  const handleAdjust = async () => {
    if (!adjustModal.ingredient || !adjustForm.change) return;
    const res = await fetch(`${API}/ingredients/${adjustModal.ingredient.id}/adjust`, {
      method: 'POST', headers,
      body: JSON.stringify({ change: Number(adjustForm.change), type: adjustForm.type, description: adjustForm.description })
    });
    if (res.ok) { toast('Stok berhasil disesuaikan', 'success'); setAdjustModal({ open: false, ingredient: null }); fetchData(); }
    else { const err = await res.json(); toast(err.error || 'Gagal menyesuaikan stok', 'error'); }
  };

  const toggleLog = async (id: number) => {
    if (expandedLog === id) { setExpandedLog(null); return; }
    setExpandedLog(id);
    if (!logs[id]) {
      const res = await fetch(`${API}/ingredients/${id}/logs`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLogs(prev => ({ ...prev, [id]: data }));
      }
    }
  };

  const filtered = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const lowStockCount = ingredients.filter(i => i.stock <= i.minStock).length;

  const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto', background: '#f4f6f9', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '.5rem', margin: 0, fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-main)' }}>
            <Package color="var(--primary)" size={24} /> Manajemen Bahan Baku
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', margin: '.25rem 0 0' }}>Kelola stok bahan baku & komposisi menu (Advanced Mode)</p>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.75rem 1.25rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '.875rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,.3)' }}>
          <Plus size={18} /> Tambah Bahan Baku
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.875rem' }}>
        {[
          { label: 'Total Bahan Baku', val: ingredients.length, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Stok Menipis', val: lowStockCount, color: '#dc2626', bg: '#fff1f2' },
          { label: 'Total Supplier Terhubung', val: new Set(ingredients.map(i => i.supplierId).filter(Boolean)).size, color: '#0369a1', bg: '#e0f2fe' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: '1rem', padding: '1rem 1.25rem', border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '.75rem', fontWeight: 700, color: s.color, opacity: .8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ background: 'white', borderRadius: '1rem', padding: '.75rem 1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
        <Search size={16} color="#94a3b8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari bahan baku..." style={{ border: 'none', outline: 'none', flex: 1, fontSize: '.875rem', color: 'var(--text-main)', background: 'transparent' }} />
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Memuat...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                {['NAMA BAHAN', 'SATUAN', 'STOK', 'MIN. STOK', 'HARGA BELI', 'SUPPLIER', 'AKSI'].map(h => (
                  <th key={h} style={{ padding: '.875rem 1rem', textAlign: 'left', fontSize: '.68rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ing, idx) => {
                const isLow = ing.stock <= ing.minStock;
                return (
                  <React.Fragment key={ing.id}>
                    <tr style={{ borderBottom: '1px solid #f8fafc', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '.875rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                          {isLow && <AlertTriangle size={14} color="#dc2626" />}
                          <span style={{ fontWeight: 700, color: isLow ? '#dc2626' : 'var(--text-main)', fontSize: '.875rem' }}>{ing.name}</span>
                        </div>
                        {isLow && (
                          <div style={{ fontSize: '.65rem', color: '#dc2626', fontWeight: 600, marginTop: '.15rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                            <AlertTriangle size={10} />
                            <span>Stok Menipis!</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '.875rem 1rem', fontSize: '.82rem', color: '#64748b' }}>{ing.unit}</td>
                      <td style={{ padding: '.875rem 1rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '.9rem', color: isLow ? '#dc2626' : '#166534' }}>{ing.stock.toLocaleString('id-ID')}</span>
                      </td>
                      <td style={{ padding: '.875rem 1rem', fontSize: '.82rem', color: '#64748b' }}>{ing.minStock.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '.875rem 1rem', fontSize: '.82rem', color: '#1d4ed8', fontWeight: 600 }}>{fmt(ing.buyPrice)}</td>
                      <td style={{ padding: '.875rem 1rem', fontSize: '.75rem', color: '#64748b' }}>{ing.supplier?.name || '—'}</td>
                      <td style={{ padding: '.875rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                          <button title="Edit" onClick={() => openEdit(ing)} style={{ width: 30, height: 30, border: '1.5px solid #bfdbfe', background: '#eff6ff', borderRadius: '.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                            <Edit2 size={13} />
                          </button>
                          <button title="Sesuaikan Stok" onClick={() => { setAdjustModal({ open: true, ingredient: ing }); setAdjustForm({ change: '', type: 'Restock', description: '' }); }} style={{ width: 30, height: 30, border: '1.5px solid #bbf7d0', background: '#f0fdf4', borderRadius: '.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>
                            <RefreshCw size={13} />
                          </button>
                          <button title="Riwayat Stok" onClick={() => toggleLog(ing.id)} style={{ width: 30, height: 30, border: '1.5px solid #e2e8f0', background: '#f8fafc', borderRadius: '.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                            {expandedLog === ing.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                          <button title="Hapus" onClick={() => handleDelete(ing)} style={{ width: 30, height: 30, border: '1.5px solid #fecaca', background: '#fff1f2', borderRadius: '.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Log Row */}
                    {expandedLog === ing.id && (
                      <tr>
                        <td colSpan={7} style={{ background: '#f8fafc', padding: '0 1rem 1rem' }}>
                          <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', marginBottom: '.5rem', paddingTop: '.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <History size={14} />
                            <span>Riwayat Mutasi Stok (50 Terakhir)</span>
                          </div>
                          {(logs[ing.id] || []).length === 0 ? (
                            <div style={{ color: '#94a3b8', fontSize: '.8rem' }}>Belum ada riwayat mutasi</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                              {(logs[ing.id] || []).map((log: any) => (
                                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'white', padding: '.4rem .75rem', borderRadius: '.5rem', border: '1px solid #e2e8f0' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                                    {log.change > 0 ? <TrendingUp size={12} color="#166534" /> : <TrendingDown size={12} color="#dc2626" />}
                                    <span style={{ fontWeight: 600, color: log.change > 0 ? '#166534' : '#dc2626' }}>{log.change > 0 ? '+' : ''}{log.change} {ing.unit}</span>
                                    <span style={{ fontSize: '.7rem', background: '#f1f5f9', padding: '.1rem .4rem', borderRadius: '.25rem', color: '#64748b' }}>{log.type}</span>
                                    {log.description && <span style={{ color: '#94a3b8', fontSize: '.7rem' }}>{log.description}</span>}
                                  </div>
                                  <span style={{ color: '#94a3b8', fontSize: '.7rem' }}>{new Date(log.createdAt).toLocaleString('id-ID')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ margin: '0 0 1.5rem', fontWeight: 800, fontSize: '1.1rem' }}>{editData ? 'Edit Bahan Baku' : 'Tambah Bahan Baku Baru'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>
              {[
                { label: 'Nama Bahan Baku *', key: 'name', type: 'text', placeholder: 'cth: Kopi Arabika' },
                { label: 'Stok Awal', key: 'stock', type: 'number', placeholder: '0' },
                { label: 'Minimum Stok (Alert)', key: 'minStock', type: 'number', placeholder: '0' },
                { label: 'Harga Beli per Satuan (Rp)', key: 'buyPrice', type: 'number', placeholder: '0' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '.35rem' }}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} style={{ width: '100%', padding: '.625rem .875rem', border: '1.5px solid #e2e8f0', borderRadius: '.625rem', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '.35rem' }}>Satuan *</label>
                <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={{ width: '100%', padding: '.625rem .875rem', border: '1.5px solid #e2e8f0', borderRadius: '.625rem', fontSize: '.875rem', outline: 'none' }}>
                  {['gram', 'kg', 'ml', 'liter', 'buah', 'pcs', 'botol', 'sachet', 'lembar'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '.35rem' }}>Supplier</label>
                <select value={form.supplierId} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value }))} style={{ width: '100%', padding: '.625rem .875rem', border: '1.5px solid #e2e8f0', borderRadius: '.625rem', fontSize: '.875rem', outline: 'none' }}>
                  <option value="">— Tanpa Supplier —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '.75rem', border: '1.5px solid #e2e8f0', borderRadius: '.75rem', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>Batal</button>
              <button onClick={handleSave} style={{ flex: 2, padding: '.75rem', border: 'none', borderRadius: '.75rem', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustModal.open && adjustModal.ingredient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ margin: '0 0 .5rem', fontWeight: 800, fontSize: '1.1rem' }}>Sesuaikan Stok</h3>
            <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '.85rem' }}>{adjustModal.ingredient.name} — Stok saat ini: <strong>{adjustModal.ingredient.stock} {adjustModal.ingredient.unit}</strong></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>
              <div>
                <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '.35rem' }}>Jenis Penyesuaian</label>
                <select value={adjustForm.type} onChange={e => setAdjustForm(p => ({ ...p, type: e.target.value }))} style={{ width: '100%', padding: '.625rem .875rem', border: '1.5px solid #e2e8f0', borderRadius: '.625rem', fontSize: '.875rem', outline: 'none' }}>
                  <option value="Restock">Restock (+)</option>
                  <option value="Penyesuaian">Penyesuaian Manual</option>
                  <option value="Rusak">Barang Rusak / Terbuang (-)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '.35rem' }}>
                  Jumlah ({adjustModal.ingredient.unit}) — Positif untuk tambah, Negatif untuk kurang
                </label>
                <input type="number" value={adjustForm.change} onChange={e => setAdjustForm(p => ({ ...p, change: e.target.value }))}
                  placeholder="cth: 500 atau -50" style={{ width: '100%', padding: '.625rem .875rem', border: '1.5px solid #e2e8f0', borderRadius: '.625rem', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '.35rem' }}>Keterangan (opsional)</label>
                <input type="text" value={adjustForm.description} onChange={e => setAdjustForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="cth: Restock dari CV. Sejahtera" style={{ width: '100%', padding: '.625rem .875rem', border: '1.5px solid #e2e8f0', borderRadius: '.625rem', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setAdjustModal({ open: false, ingredient: null })} style={{ flex: 1, padding: '.75rem', border: '1.5px solid #e2e8f0', borderRadius: '.75rem', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>Batal</button>
              <button onClick={handleAdjust} style={{ flex: 2, padding: '.75rem', border: 'none', borderRadius: '.75rem', background: '#166534', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Simpan Penyesuaian</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IngredientView;
