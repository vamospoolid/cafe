import React, { useState, useEffect, useContext } from 'react';
import { Truck, Plus, Edit2, Trash2, Phone, Mail, MapPin, Search, PackageSearch } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface Supplier { id: number; name: string; contact?: string; phone?: string; email?: string; address?: string; notes?: string; _count?: { purchaseOrders: number; ingredients: number }; }
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
      if (res.ok) setSuppliers(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchData(); }, [token]);

  const openAdd = () => { setEditData(null); setForm({ name: '', contact: '', phone: '', email: '', address: '', notes: '' }); setShowModal(true); };
  const openEdit = (s: Supplier) => { setEditData(s); setForm({ name: s.name, contact: s.contact || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '' }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name) return toast('Nama supplier wajib diisi', 'error');
    const url = editData ? `${API}/suppliers/${editData.id}` : `${API}/suppliers`;
    const res = await fetch(url, { method: editData ? 'PUT' : 'POST', headers, body: JSON.stringify(form) });
    if (res.ok) { toast(editData ? 'Supplier diperbarui' : 'Supplier ditambahkan', 'success'); setShowModal(false); fetchData(); }
    else { const err = await res.json(); toast(err.error || 'Gagal menyimpan', 'error'); }
  };

  const handleDelete = async (s: Supplier) => {
    const confirm = await confirmAlert('Hapus Supplier', `Hapus "${s.name}"?`);
    if (!confirm.isConfirmed) return;
    const res = await fetch(`${API}/suppliers/${s.id}`, { method: 'DELETE', headers });
    if (res.ok) { toast('Supplier dihapus', 'success'); fetchData(); }
    else { const err = await res.json(); toast(err.error || 'Gagal menghapus', 'error'); }
  };

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone || '').includes(search));

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto', background: '#f4f6f9', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '.5rem', margin: 0, fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-main)' }}>
            <Truck color="var(--primary)" size={24} /> Manajemen Supplier
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', margin: '.25rem 0 0' }}>Kelola data pemasok bahan baku dan produk</p>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.75rem 1.25rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '.875rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,.3)' }}>
          <Plus size={18} /> Tambah Supplier
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.875rem' }}>
        {[
          { label: 'Total Supplier', val: suppliers.length, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Total PO Dibuat', val: suppliers.reduce((s, x) => s + (x._count?.purchaseOrders || 0), 0), color: '#0369a1', bg: '#e0f2fe' },
          { label: 'Bahan Baku Tertaut', val: suppliers.reduce((s, x) => s + (x._count?.ingredients || 0), 0), color: '#166534', bg: '#f0fdf4' },
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama / telepon supplier..." style={{ border: 'none', outline: 'none', flex: 1, fontSize: '.875rem', background: 'transparent' }} />
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Memuat...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
          <Truck size={48} style={{ opacity: .3, margin: '0 auto 1rem', display: 'block' }} />
          <div style={{ fontWeight: 700 }}>Belum ada supplier</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filtered.map(s => (
            <div key={s.id} style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.875rem' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>{s.name}</div>
                  {s.contact && <div style={{ fontSize: '.78rem', color: '#64748b', marginTop: '.15rem' }}>PIC: {s.contact}</div>}
                </div>
                <div style={{ display: 'flex', gap: '.4rem' }}>
                  <button onClick={() => openEdit(s)} style={{ width: 30, height: 30, border: '1.5px solid #bfdbfe', background: '#eff6ff', borderRadius: '.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}><Edit2 size={13} /></button>
                  <button onClick={() => handleDelete(s)} style={{ width: 30, height: 30, border: '1.5px solid #fecaca', background: '#fff1f2', borderRadius: '.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}><Trash2 size={13} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                {s.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.78rem', color: '#475569' }}><Phone size={12} />{s.phone}</div>}
                {s.email && <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.78rem', color: '#475569' }}><Mail size={12} />{s.email}</div>}
                {s.address && <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.78rem', color: '#475569' }}><MapPin size={12} />{s.address}</div>}
                {s.notes && <div style={{ fontSize: '.72rem', color: '#94a3b8', fontStyle: 'italic', borderTop: '1px solid #f1f5f9', paddingTop: '.4rem', marginTop: '.2rem' }}>"{s.notes}"</div>}
              </div>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.875rem', paddingTop: '.75rem', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ flex: 1, textAlign: 'center', background: '#f5f3ff', borderRadius: '.5rem', padding: '.4rem' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7c3aed' }}>{s._count?.purchaseOrders || 0}</div>
                  <div style={{ fontSize: '.65rem', color: '#7c3aed', fontWeight: 600 }}>PO</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', background: '#f0fdf4', borderRadius: '.5rem', padding: '.4rem' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#166534' }}>{s._count?.ingredients || 0}</div>
                  <div style={{ fontSize: '.65rem', color: '#166534', fontWeight: 600 }}>Bahan Baku</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ margin: '0 0 1.5rem', fontWeight: 800, fontSize: '1.1rem' }}>{editData ? 'Edit Supplier' : 'Tambah Supplier Baru'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>
              {[
                { label: 'Nama Perusahaan / Supplier *', key: 'name', placeholder: 'cth: CV. Sumber Bahan Kopi' },
                { label: 'Nama PIC / Contact Person', key: 'contact', placeholder: 'cth: Budi Santoso' },
                { label: 'Nomor Telepon', key: 'phone', placeholder: '08xxxxxxxxxx' },
                { label: 'Email', key: 'email', placeholder: 'supplier@email.com' },
                { label: 'Alamat', key: 'address', placeholder: 'Jl. ...' },
                { label: 'Catatan', key: 'notes', placeholder: 'Catatan tambahan...' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '.35rem' }}>{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} style={{ width: '100%', padding: '.625rem .875rem', border: '1.5px solid #e2e8f0', borderRadius: '.625rem', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '.75rem', border: '1.5px solid #e2e8f0', borderRadius: '.75rem', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>Batal</button>
              <button onClick={handleSave} style={{ flex: 2, padding: '.75rem', border: 'none', borderRadius: '.75rem', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierView;
