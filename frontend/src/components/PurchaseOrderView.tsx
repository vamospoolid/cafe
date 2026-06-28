import React, { useState, useEffect, useContext } from 'react';
import { ClipboardList, Plus, Eye, Send, PackageCheck, XCircle, Search, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface POItem { id?: number; productId?: number | null; ingredientId?: number | null; itemName: string; unit: string; qtyOrdered: number; qtyReceived?: number; unitPrice: number; subtotal?: number; }
interface PO { id: number; poNumber: string; status: string; totalAmount: number; orderedAt: string; supplier: { name: string }; user: { name: string }; _count?: { items: number }; items?: POItem[]; }

const API = '/api';
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  Draft: { bg: '#f1f5f9', color: '#64748b' },
  Dikirim: { bg: '#dbeafe', color: '#1d4ed8' },
  'Diterima Sebagian': { bg: '#fef9c3', color: '#92400e' },
  Diterima: { bg: '#dcfce7', color: '#166534' },
  Dibatalkan: { bg: '#fee2e2', color: '#991b1b' },
};
const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const PurchaseOrderView: React.FC = () => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;
  const settings = posContext?.settings;
  const isAdvanced = (settings as any)?.ingredientTrackingEnabled ?? false;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [pos, setPos] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailPO, setDetailPO] = useState<PO | null>(null);
  const [receiveModal, setReceiveModal] = useState<PO | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<number, string>>({});

  const [newPO, setNewPO] = useState({ supplierId: '', notes: '', items: [] as POItem[] });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filterStatus ? `?status=${filterStatus}` : '';
      const [rPos, rSup, rProd, rIng] = await Promise.all([
        fetch(`${API}/purchase-orders${params}`, { headers }),
        fetch(`${API}/suppliers`, { headers }),
        fetch(`${API}/products`, { headers }),
        fetch(`${API}/ingredients`, { headers }),
      ]);
      if (rPos.ok) setPos(await rPos.json());
      if (rSup.ok) setSuppliers(await rSup.json());
      if (rProd.ok) setProducts(await rProd.json());
      if (rIng.ok) setIngredients(await rIng.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchData(); }, [token, filterStatus]);

  const addItem = () => setNewPO(p => ({ ...p, items: [...p.items, { itemName: '', unit: isAdvanced ? 'gram' : 'pcs', qtyOrdered: 1, unitPrice: 0 }] }));
  const removeItem = (i: number) => setNewPO(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: string, val: any) => setNewPO(p => {
    const items = [...p.items];
    (items[i] as any)[field] = val;
    if (field === 'productId' && val) {
      const prod = products.find((x: any) => x.id === Number(val));
      if (prod) { items[i].itemName = prod.name; items[i].unit = 'pcs'; items[i].unitPrice = prod.buyPrice || 0; }
    }
    if (field === 'ingredientId' && val) {
      const ing = ingredients.find((x: any) => x.id === Number(val));
      if (ing) { items[i].itemName = ing.name; items[i].unit = ing.unit; items[i].unitPrice = ing.buyPrice || 0; }
    }
    return { ...p, items };
  });

  const handleCreate = async () => {
    if (!newPO.supplierId) return toast('Pilih supplier terlebih dahulu', 'error');
    if (newPO.items.length === 0) return toast('Tambahkan minimal 1 item', 'error');
    const items = newPO.items.map(it => ({ ...it, qtyOrdered: Number(it.qtyOrdered), unitPrice: Number(it.unitPrice) }));
    const res = await fetch(`${API}/purchase-orders`, { method: 'POST', headers, body: JSON.stringify({ supplierId: newPO.supplierId, notes: newPO.notes, items }) });
    if (res.ok) { toast('Purchase Order berhasil dibuat', 'success'); setShowCreate(false); setNewPO({ supplierId: '', notes: '', items: [] }); fetchData(); }
    else { const err = await res.json(); toast(err.error || 'Gagal membuat PO', 'error'); }
  };

  const handleSend = async (po: PO) => {
    const c = await confirmAlert('Kirim PO', `Tandai PO ${po.poNumber} sebagai Dikirim?`);
    if (!c.isConfirmed) return;
    const res = await fetch(`${API}/purchase-orders/${po.id}/send`, { method: 'PATCH', headers });
    if (res.ok) { toast('PO berhasil dikirim', 'success'); fetchData(); }
    else { const err = await res.json(); toast(err.error, 'error'); }
  };

  const handleCancel = async (po: PO) => {
    const c = await confirmAlert('Batalkan PO', `Batalkan PO ${po.poNumber}?`, 'warning');
    if (!c.isConfirmed) return;
    const res = await fetch(`${API}/purchase-orders/${po.id}/cancel`, { method: 'PATCH', headers });
    if (res.ok) { toast('PO dibatalkan', 'success'); fetchData(); }
    else { const err = await res.json(); toast(err.error, 'error'); }
  };

  const openReceive = async (po: PO) => {
    const res = await fetch(`${API}/purchase-orders/${po.id}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setReceiveModal(data);
      const init: Record<number, string> = {};
      (data.items || []).forEach((it: any) => { init[it.id] = String(it.qtyOrdered - (it.qtyReceived || 0)); });
      setReceiveQtys(init);
    }
  };

  const handleReceive = async () => {
    if (!receiveModal) return;
    const receivedItems = Object.entries(receiveQtys).map(([itemId, qty]) => ({ itemId: Number(itemId), qtyReceived: Number(qty) })).filter(x => x.qtyReceived > 0);
    const res = await fetch(`${API}/purchase-orders/${receiveModal.id}/receive`, { method: 'PATCH', headers, body: JSON.stringify({ receivedItems }) });
    if (res.ok) { toast('Penerimaan barang berhasil diproses', 'success'); setReceiveModal(null); fetchData(); }
    else { const err = await res.json(); toast(err.error || 'Gagal', 'error'); }
  };

  const filtered = pos.filter(p => p.poNumber.toLowerCase().includes(search.toLowerCase()) || (p.supplier?.name || '').toLowerCase().includes(search.toLowerCase()));
  const totalDraft = pos.filter(p => p.status === 'Draft').length;
  const totalDikirim = pos.filter(p => p.status === 'Dikirim').length;
  const totalDiterima = pos.filter(p => p.status === 'Diterima').length;

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto', background: '#f4f6f9', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '.5rem', margin: 0, fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-main)' }}>
            <ClipboardList color="var(--primary)" size={24} /> Purchase Order
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', margin: '.25rem 0 0' }}>
            Mode: <strong style={{ color: isAdvanced ? '#7c3aed' : '#0369a1' }}>{isAdvanced ? 'ðŸ”¬ Advanced (Bahan Baku)' : 'ðŸ“¦ Simple (Produk Jadi)'}</strong>
          </p>
        </div>
        <button onClick={() => { setShowCreate(true); setNewPO({ supplierId: '', notes: '', items: [] }); }} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.75rem 1.25rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '.875rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,.3)' }}>
          <Plus size={18} /> Buat PO Baru
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.875rem' }}>
        {[
          { label: 'Total PO', val: pos.length, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Draft', val: totalDraft, color: '#64748b', bg: '#f8fafc' },
          { label: 'Dikirim', val: totalDikirim, color: '#1d4ed8', bg: '#dbeafe' },
          { label: 'Diterima', val: totalDiterima, color: '#166534', bg: '#dcfce7' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: '1rem', padding: '1rem 1.25rem', border: `1px solid ${s.color}22`, cursor: 'pointer' }} onClick={() => setFilterStatus(s.label === 'Total PO' ? '' : s.label)}>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '.75rem', fontWeight: 700, color: s.color, opacity: .8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '.75rem' }}>
        <div style={{ flex: 1, background: 'white', borderRadius: '1rem', padding: '.75rem 1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <Search size={16} color="#94a3b8" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nomor PO / supplier..." style={{ border: 'none', outline: 'none', flex: 1, fontSize: '.875rem', background: 'transparent' }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '.75rem 1rem', border: '1px solid #e2e8f0', borderRadius: '1rem', background: 'white', fontSize: '.875rem', cursor: 'pointer' }}>
          <option value="">Semua Status</option>
          {['Draft', 'Dikirim', 'Diterima Sebagian', 'Diterima', 'Dibatalkan'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* PO List */}
      <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Memuat...</div> :
          filtered.length === 0 ? <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}><ClipboardList size={48} style={{ opacity: .3, margin: '0 auto 1rem', display: 'block' }} /><div style={{ fontWeight: 700 }}>Belum ada Purchase Order</div></div> :
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                  {['NO. PO', 'SUPPLIER', 'TOTAL', 'STATUS', 'TGL PO', 'AKSI'].map(h => (
                    <th key={h} style={{ padding: '.875rem 1rem', textAlign: 'left', fontSize: '.68rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((po, idx) => {
                  const sc = STATUS_COLOR[po.status] || STATUS_COLOR.Draft;
                  return (
                    <tr key={po.id} style={{ borderBottom: '1px solid #f8fafc', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '.875rem 1rem' }}><span style={{ fontWeight: 700, fontSize: '.82rem', fontFamily: 'monospace', color: '#7c3aed' }}>{po.poNumber}</span></td>
                      <td style={{ padding: '.875rem 1rem', fontSize: '.85rem', fontWeight: 600 }}>{po.supplier.name}</td>
                      <td style={{ padding: '.875rem 1rem', fontWeight: 700, color: '#166534', fontSize: '.85rem' }}>{fmt(po.totalAmount)}</td>
                      <td style={{ padding: '.875rem 1rem' }}>
                        <span style={{ padding: '.25rem .625rem', borderRadius: '.375rem', fontSize: '.72rem', fontWeight: 700, background: sc.bg, color: sc.color }}>{po.status}</span>
                      </td>
                      <td style={{ padding: '.875rem 1rem', fontSize: '.78rem', color: '#64748b' }}>{new Date(po.orderedAt).toLocaleDateString('id-ID')}</td>
                      <td style={{ padding: '.875rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                          {po.status === 'Draft' && <button onClick={() => handleSend(po)} title="Kirim PO" style={{ display: 'flex', alignItems: 'center', gap: '.3rem', padding: '.35rem .6rem', border: 'none', background: '#dbeafe', color: '#1d4ed8', borderRadius: '.5rem', cursor: 'pointer', fontSize: '.72rem', fontWeight: 700 }}><Send size={12} />Kirim</button>}
                          {['Dikirim', 'Diterima Sebagian'].includes(po.status) && <button onClick={() => openReceive(po)} title="Terima Barang" style={{ display: 'flex', alignItems: 'center', gap: '.3rem', padding: '.35rem .6rem', border: 'none', background: '#dcfce7', color: '#166534', borderRadius: '.5rem', cursor: 'pointer', fontSize: '.72rem', fontWeight: 700 }}><PackageCheck size={12} />Terima</button>}
                          {['Draft', 'Dikirim'].includes(po.status) && <button onClick={() => handleCancel(po)} title="Batalkan" style={{ width: 28, height: 28, border: '1.5px solid #fecaca', background: '#fff1f2', borderRadius: '.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}><XCircle size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        }
      </div>

      {/* Create PO Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '2rem 1rem' }}>
          <div style={{ background: 'white', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: 700, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <h3 style={{ margin: '0 0 1.5rem', fontWeight: 800, fontSize: '1.15rem' }}>ðŸ“‹ Buat Purchase Order Baru</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.875rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '.35rem' }}>Supplier *</label>
                <select value={newPO.supplierId} onChange={e => setNewPO(p => ({ ...p, supplierId: e.target.value }))} style={{ width: '100%', padding: '.625rem .875rem', border: '1.5px solid #e2e8f0', borderRadius: '.625rem', fontSize: '.875rem' }}>
                  <option value="">â€” Pilih Supplier â€”</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '.35rem' }}>Catatan</label>
                <input value={newPO.notes} onChange={e => setNewPO(p => ({ ...p, notes: e.target.value }))} placeholder="Catatan PO..." style={{ width: '100%', padding: '.625rem .875rem', border: '1.5px solid #e2e8f0', borderRadius: '.625rem', fontSize: '.875rem', boxSizing: 'border-box' }} />
              </div>
            </div>
            {/* Items */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.625rem' }}>
                <label style={{ fontSize: '.85rem', fontWeight: 700, color: '#475569' }}>Item PO</label>
                <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: '.3rem', padding: '.35rem .75rem', background: '#f5f3ff', border: '1.5px solid #ddd6fe', color: '#7c3aed', borderRadius: '.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '.78rem' }}><Plus size={13} /> Tambah Item</button>
              </div>
              {newPO.items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '.5rem', marginBottom: '.5rem', alignItems: 'center' }}>
                  {isAdvanced ? (
                    <select value={it.ingredientId || ''} onChange={e => updateItem(i, 'ingredientId', e.target.value)} style={{ padding: '.5rem', border: '1.5px solid #e2e8f0', borderRadius: '.5rem', fontSize: '.8rem' }}>
                      <option value="">â€” Pilih Bahan Baku â€”</option>
                      {ingredients.map((x: any) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
                    </select>
                  ) : (
                    <select value={it.productId || ''} onChange={e => updateItem(i, 'productId', e.target.value)} style={{ padding: '.5rem', border: '1.5px solid #e2e8f0', borderRadius: '.5rem', fontSize: '.8rem' }}>
                      <option value="">â€” Pilih Produk â€”</option>
                      {products.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  )}
                  <input type="text" value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)} placeholder="Satuan" style={{ padding: '.5rem', border: '1.5px solid #e2e8f0', borderRadius: '.5rem', fontSize: '.8rem', textAlign: 'center' }} />
                  <input type="number" value={it.qtyOrdered} onChange={e => updateItem(i, 'qtyOrdered', e.target.value)} placeholder="Qty" style={{ padding: '.5rem', border: '1.5px solid #e2e8f0', borderRadius: '.5rem', fontSize: '.8rem', textAlign: 'center' }} />
                  <input type="number" value={it.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} placeholder="Harga/unit" style={{ padding: '.5rem', border: '1.5px solid #e2e8f0', borderRadius: '.5rem', fontSize: '.8rem', textAlign: 'right' }} />
                  <button onClick={() => removeItem(i)} style={{ width: 30, height: 30, border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: '.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
                </div>
              ))}
              {newPO.items.length > 0 && (
                <div style={{ textAlign: 'right', fontWeight: 800, color: '#166534', fontSize: '.95rem', padding: '.5rem 0' }}>
                  Total: {fmt(newPO.items.reduce((s, it) => s + (Number(it.qtyOrdered) * Number(it.unitPrice)), 0))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '.75rem' }}>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '.75rem', border: '1.5px solid #e2e8f0', borderRadius: '.75rem', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
              <button onClick={handleCreate} style={{ flex: 2, padding: '.75rem', border: 'none', borderRadius: '.75rem', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Simpan PO</button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {receiveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 .5rem', fontWeight: 800, fontSize: '1.1rem' }}>ðŸ“¦ Terima Barang</h3>
            <p style={{ color: '#64748b', fontSize: '.85rem', margin: '0 0 1.25rem' }}>{receiveModal.poNumber} â€” {receiveModal.supplier.name}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
              {(receiveModal.items || []).map((it: any) => {
                const remaining = it.qtyOrdered - it.qtyReceived;
                return (
                  <div key={it.id} style={{ background: '#f8fafc', borderRadius: '.75rem', padding: '.875rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '.875rem' }}>{it.itemName}</span>
                      <span style={{ fontSize: '.75rem', color: '#64748b' }}>Dipesan: {it.qtyOrdered} {it.unit} | Sudah diterima: {it.qtyReceived}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      <label style={{ fontSize: '.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>Terima sekarang ({it.unit}):</label>
                      <input type="number" value={receiveQtys[it.id] || ''} onChange={e => setReceiveQtys(p => ({ ...p, [it.id]: e.target.value }))}
                        max={remaining} min={0} placeholder={`maks ${remaining}`}
                        style={{ flex: 1, padding: '.4rem .75rem', border: '1.5px solid #e2e8f0', borderRadius: '.5rem', fontSize: '.875rem' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setReceiveModal(null)} style={{ flex: 1, padding: '.75rem', border: '1.5px solid #e2e8f0', borderRadius: '.75rem', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
              <button onClick={handleReceive} style={{ flex: 2, padding: '.75rem', border: 'none', borderRadius: '.75rem', background: '#166534', color: 'white', cursor: 'pointer', fontWeight: 700 }}>âœ… Konfirmasi Penerimaan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderView;
