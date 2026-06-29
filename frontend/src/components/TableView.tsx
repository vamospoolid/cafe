import React, { useState, useEffect, useContext, useRef } from 'react';
import { Plus, Edit, Trash2, Map, List, Armchair, Clock, Users, Coffee, Lock, Play, Scissors, Check, CreditCard, X, Info } from 'lucide-react';
import TableModal from './TableModal';
import CheckoutModal from './CheckoutModal';
import OpenShiftModal from './OpenShiftModal';
import SplitBillModal from './SplitBillModal';
import { POSContext } from '../context/POSContext';
import useSocket from '../hooks/useSocket';

import { toast, confirmAlert, errorAlert } from '../utils/alert';
const TableView = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [selectedArea, setSelectedArea] = useState<string>('Semua');
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedOrderToPay, setSelectedOrderToPay] = useState<any>(null);
  const [isOpenShiftOpen, setIsOpenShiftOpen] = useState(false);

  // Split bill states
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [splitTableId, setSplitTableId] = useState<number | null>(null);
  const [splitTableName, setSplitTableName] = useState('');
  const [splitActiveOrders, setSplitActiveOrders] = useState<any[]>([]);

  const posContext = useContext(POSContext);
  const socket = useSocket();

  const [isEditMode, setIsEditMode] = useState(false);
  const [tempPositions, setTempPositions] = useState<any[]>([]);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [actionTable, setActionTable] = useState<any>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  const startEditMode = () => {
    setIsEditMode(true);
    setTempPositions(tables.map(t => ({ id: t.id, posX: t.posX || 10, posY: t.posY || 10 })));
  };

  const handleCancelLayout = () => {
    setIsEditMode(false);
    setTempPositions([]);
  };

  const handleSaveLayout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tables/layout', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ layouts: tempPositions })
      });
      if (res.ok) {
        toast('Tata letak meja berhasil disimpan!', 'success');
        setIsEditMode(false);
        fetchData();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyimpan tata letak', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, tableId: number) => {
    if (!isEditMode) return;
    e.preventDefault();
    const tablePos = tempPositions.find(p => p.id === tableId);
    if (!tablePos) return;

    setDraggedId(tableId);
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: tablePos.posX,
      posY: tablePos.posY
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (draggedId === null || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStart.current.mouseX;
    const deltaY = e.clientY - dragStart.current.mouseY;

    const pctDeltaX = (deltaX / rect.width) * 100;
    const pctDeltaY = (deltaY / rect.height) * 100;

    let newPosX = Math.max(1, Math.min(88, dragStart.current.posX + pctDeltaX));
    let newPosY = Math.max(1, Math.min(88, dragStart.current.posY + pctDeltaY));

    // Snap to 2% grid
    newPosX = Math.round(newPosX / 2) * 2;
    newPosY = Math.round(newPosY / 2) * 2;

    setTempPositions(prev => prev.map(p => p.id === draggedId ? { ...p, posX: newPosX, posY: newPosY } : p));
  };

  const handleMouseUp = () => {
    setDraggedId(null);
  };

  useEffect(() => {
    if (draggedId !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedId]);

  const handleTableClick = (table: any) => {
    if (isEditMode) return;
    setActionTable(table);
  };

  const fetchData = async () => {
    try {
      const [resTables, resOrders] = await Promise.all([
        fetch('/api/tables', { headers: { Authorization: `Bearer ${posContext?.token}` } }),
        fetch('/api/orders?active=true', { headers: { Authorization: `Bearer ${posContext?.token}` } })
      ]);
      if (resTables.ok) setTables(await resTables.json());
      if (resOrders.ok) setActiveOrders(await resOrders.json());
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token) {
      fetchData();
    }
  }, [posContext?.token]);

  useEffect(() => {
    socket.on('order:new', fetchData);
    socket.on('order:void', fetchData);
    socket.on('order:paid', fetchData);
    socket.on('kds:statusChanged', fetchData);

    return () => {
      socket.off('order:new', fetchData);
      socket.off('order:void', fetchData);
      socket.off('order:paid', fetchData);
      socket.off('kds:statusChanged', fetchData);
    };
  }, [socket]);

  const handleDelete = async (id: number) => {
    const confirmResult = await confirmAlert('Konfirmasi', 'Apakah Anda yakin ingin menghapus meja ini?');
    if (!confirmResult.isConfirmed) return;
    try {
      const res = await fetch(`/api/tables/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menghapus meja', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReleaseTable = async (orderIdStr: string | number) => {
    try {
      const ids = String(orderIdStr).split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
      setLoading(true);
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${posContext?.token}`
      };
      
      await Promise.all(ids.map(id => 
        fetch(`/api/kds/${id}/status`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ kdsStatus: 'Served' })
        })
      ));
      
      toast('Meja berhasil dikosongkan!', 'success');
      fetchData();
    } catch (err) {
      console.error(err);
      toast('Gagal mengosongkan meja.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: any) => {
    const isEdit = !!selectedTable;
    const url = isEdit ? `/api/tables/${selectedTable.id}` : '/api/tables';

    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getTableActiveOrder = (tableId: number) => {
    const tableOrders = activeOrders.filter(o => o.tableId === tableId);
    if (tableOrders.length === 0) return null;
    if (tableOrders.length === 1) {
      const normalizedItems = (tableOrders[0].items || []).map((item: any) => ({
        ...item,
        product: item.product || { id: item.productId, name: item.product?.name || 'Menu' }
      }));
      return {
        ...tableOrders[0],
        items: normalizedItems
      };
    }

    // Combine multiple orders
    const mergedItemsObj: { [key: number]: any } = {};
    let subtotal = 0;
    let tax = 0;
    let serviceCharge = 0;
    let total = 0;

    tableOrders.forEach(order => {
      subtotal += order.subtotal;
      tax += order.tax;
      serviceCharge += order.serviceCharge;
      total += order.total;

      (order.items || []).forEach((item: any) => {
        const existing = mergedItemsObj[item.productId];
        if (existing) {
          existing.qty += item.qty;
          existing.subtotal += item.subtotal;
          if (item.notes) {
            existing.notes = existing.notes ? `${existing.notes}, ${item.notes}` : item.notes;
          }
        } else {
          mergedItemsObj[item.productId] = {
            ...item,
            product: item.product || { id: item.productId, name: item.product?.name || 'Menu' }
          };
        }
      });
    });

    const mergedItems = Object.values(mergedItemsObj);
    const commaSeparatedIds = tableOrders.map(o => o.id).join(',');

    return {
      id: commaSeparatedIds,
      orderNumber: `Combined (${tableOrders.length} Pesanan)`,
      customerName: tableOrders[0].customerName,
      customerPhone: tableOrders[0].customerPhone || '',
      customerId: tableOrders[0].customerId,
      tableId: tableOrders[0].tableId,
      subtotal,
      tax,
      serviceCharge,
      total,
      items: mergedItems,
      createdAt: tableOrders[0].createdAt,
      kdsStatus: tableOrders.every(o => o.kdsStatus === 'Served') ? 'Served' : 'Cooking'
    };
  };

  // 3 states: empty | cooking (Pending/Cooking/Ready) | served (Served)
  const getTableStatus = (tableId: number): 'empty' | 'cooking' | 'served' => {
    const tableOrders = activeOrders.filter(o => o.tableId === tableId);
    if (tableOrders.length === 0) return 'empty';
    const allServed = tableOrders.every(o => o.kdsStatus === 'Served');
    return allServed ? 'served' : 'cooking';
  };

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  const getWaitTime = (createdAt: string) => {
    const mins = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
    return `${mins} mnt`;
  };

  const isShiftRequired = posContext?.user?.role === 'Kasir' || posContext?.user?.role === 'Admin';
  const hasActiveShift = posContext?.activeShift !== null;

  if (isShiftRequired && !hasActiveShift) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50/50 p-6 text-center min-h-[500px]">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200/80 shadow-lg flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 border border-indigo-100">
            <Lock size={28} className="animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Shift Belum Dibuka</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Untuk mulai melayani transaksi penjualan di kasir, Anda harus membuka shift baru dan memasukkan saldo modal laci awal terlebih dahulu.
          </p>
          <button 
            className="w-full btn btn-primary mt-6 py-3 rounded-xl font-bold text-sm shadow-md hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            onClick={() => setIsOpenShiftOpen(true)}
          >
            <Play size={16} /> Buka Shift Kasir Sekarang
          </button>
        </div>

        <OpenShiftModal 
          isOpen={isOpenShiftOpen} 
          onClose={() => setIsOpenShiftOpen(false)} 
          onSuccess={() => posContext?.fetchActiveShift()} 
          mode="open" 
        />
      </div>
    );
  }

  // Get unique areas (zones) from tables, defaulting empty/null to 'Area Umum'
  const uniqueAreas = Array.from(new Set(tables.map(t => (t.name && t.name.trim() !== '') ? t.name.trim() : 'Area Umum')));
  const areas = ['Semua', ...uniqueAreas];

  // Filter tables by currently selected area tab
  const filteredTables = tables.filter(table => {
    const tableArea = (table.name && table.name.trim() !== '') ? table.name.trim() : 'Area Umum';
    return selectedArea === 'Semua' || tableArea === selectedArea;
  });

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <Armchair className="text-primary" /> Manajemen Meja & Area
          </h2>
          <p className="text-muted mt-1">Kelola tata letak meja dan pantau status pesanan (pending bill/kds) secara real-time.</p>
        </div>
        <button className="btn btn-primary shadow-md hover:shadow-lg transition-all" onClick={() => { setSelectedTable(null); setIsModalOpen(true); }}>
          <Plus size={18} /> Tambah Meja
        </button>
      </div>

      <div className="card flex-1 flex flex-col p-0 overflow-hidden border border-gray-200 shadow-sm">
        {isEditMode ? (
          <div className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 p-4 w-full justify-between">
            <span className="text-xs font-bold text-amber-800 flex items-center gap-2">
              <Info size={16} className="text-amber-600 shrink-0" />
              <span>Mode Edit Tata Letak: Silakan geser (drag) meja untuk mengatur posisinya sesuai tata letak kafe Anda.</span>
            </span>
            <div className="flex gap-2">
              <button type="button" className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm transition-all" onClick={handleCancelLayout}>Batal</button>
              <button type="button" className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all" onClick={handleSaveLayout}>Simpan Posisi</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 p-4 border-b border-gray-200 bg-white">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Area Classification Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {areas.map(area => {
                const count = tables.filter(t => {
                  const tArea = (t.name && t.name.trim() !== '') ? t.name.trim() : 'Area Umum';
                  return area === 'Semua' || tArea === area;
                }).length;
                const isActive = selectedArea === area;
                return (
                  <button
                    key={area}
                    onClick={() => setSelectedArea(area)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {area} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-indigo-500 text-indigo-50' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Status Legends */}
            <div className="flex gap-2 text-[10px] font-semibold border-t lg:border-t-0 lg:border-l border-slate-150 pt-2 lg:pt-0 lg:pl-4">
              <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Kosong</span>
              <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div> Diproses</span>
              <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Sudah Disajikan</span>
            </div>
          </div>
          
          {/* View Toggles & Layout Editor Button */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            {viewMode === 'map' && (
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
                onClick={startEditMode}
              >
                <Map size={14} className="text-indigo-600" /> Atur Posisi Meja
              </button>
            )}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/60">
              <button
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'map' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setViewMode('map')}
              >
                <Map size={16} /> Denah Visual
              </button>
              <button
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setViewMode('list')}
              >
                <List size={16} /> Tabel Data
              </button>
            </div>
          </div>
          </div>
        )}

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="font-semibold">Menyinkronkan status meja...</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="p-0 flex-1 overflow-y-auto bg-white">
            <table className="data-table w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 shadow-sm">
                <tr>
                  <th className="px-6 py-4">NOMOR MEJA</th>
                  <th className="px-6 py-4">KAPASITAS</th>
                  <th className="px-6 py-4">STATUS SISTEM</th>
                  <th className="px-6 py-4">KONDISI SAAT INI</th>
                  <th className="px-6 py-4">INFO PESANAN</th>
                  <th className="px-6 py-4 text-right">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTables.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400 font-medium">Belum ada data meja di area ini.</td>
                  </tr>
                ) : filteredTables.map(table => {
                  const activeOrder = getTableActiveOrder(table.id);
                  return (
                    <tr key={table.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-black text-xl text-slate-800">{table.tableNo}</div>
                        <div className="text-xs text-muted font-medium">{table.name || 'Tanpa keterangan'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full w-max">
                          <Users size={14} /> {table.capacity} Kursi
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${table.status === 'Aktif' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                          {table.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {activeOrder ? (
                          <span className={`badge font-bold animate-pulse ${
                            activeOrder.kdsStatus === 'Served'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            {activeOrder.kdsStatus === 'Served' ? 'SUDAH DISAJIKAN' : 'DIPROSES'}
                          </span>
                        ) : (
                          <span className="badge bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold">KOSONG</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {activeOrder ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-sm text-slate-800">{activeOrder.customerName}</span>
                            <span className="text-xs font-semibold text-primary">{formatCurrency(activeOrder.total)}</span>
                            <span className="text-xs text-muted flex items-center gap-1"><Clock size={12} /> Menunggu: {getWaitTime(activeOrder.createdAt)}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="p-2 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors" onClick={() => { setSelectedTable(table); setIsModalOpen(true); }}><Edit size={16} /></button>
                          {activeOrder ? (
                            <>
                              <button
                                className="px-3 py-1 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors font-semibold text-xs flex items-center gap-1 border border-indigo-100"
                                onClick={() => {
                                  const tableOrders = activeOrders.filter(o => o.tableId === table.id);
                                  setSplitTableId(table.id);
                                  setSplitTableName(`Meja ${table.tableNo}`);
                                  setSplitActiveOrders(tableOrders);
                                  setIsSplitOpen(true);
                                }}
                              >
                                <Scissors size={12} /> Split
                              </button>
                              {activeOrder.status === 'Paid' ? (
                                <button className="px-3 py-1 rounded-lg text-white font-bold bg-emerald-600 hover:bg-emerald-700 transition-colors" onClick={() => handleReleaseTable(activeOrder.id)}>Kosongkan</button>
                              ) : (
                                <button className="px-3 py-1 rounded-lg text-white font-bold bg-primary hover:bg-primary/90 transition-colors" onClick={() => { setSelectedOrderToPay(activeOrder); setIsCheckoutOpen(true); }}>Bayar</button>
                              )}
                            </>
                          ) : (
                            <button className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors" onClick={() => handleDelete(table.id)}><Trash2 size={16} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 bg-slate-100 flex-1 overflow-y-auto min-h-[600px] relative">
            {filteredTables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 w-full">
                <Armchair size={48} className="text-slate-355 mb-3" />
                <p className="font-semibold text-sm">Tidak ada meja di area "{selectedArea}"</p>
                <p className="text-xs text-slate-400 mt-1">Anda bisa menambahkan meja baru ke area ini dengan tombol di atas.</p>
              </div>
            ) : (
              <div 
                ref={canvasRef}
                className="relative w-full h-[580px] bg-slate-150 rounded-2xl overflow-hidden border border-slate-300 shadow-inner"
                style={{
                  backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
                  backgroundSize: '24px 24px',
                  backgroundPosition: '-12px -12px',
                  backgroundColor: '#f1f5f9'
                }}
              >
                {filteredTables.map(table => {
                  const activeOrder = getTableActiveOrder(table.id);
                  const tableStatus = getTableStatus(table.id);
                  const isOccupied = tableStatus !== 'empty';

                  const tempPos = tempPositions.find(p => p.id === table.id);
                  const posX = isEditMode && tempPos ? tempPos.posX : (table.posX || 10);
                  const posY = isEditMode && tempPos ? tempPos.posY : (table.posY || 10);

                  const cardStyle = {
                    empty:   'bg-white border-slate-200 text-slate-800 hover:border-indigo-400',
                    cooking: 'bg-amber-500 border-amber-600 text-white shadow-md shadow-amber-500/20',
                    served:  'bg-blue-600 border-blue-700 text-white shadow-md shadow-blue-600/20',
                  }[tableStatus];

                  const isCircle = table.shape === 'circle';
                  const isServed = tableStatus === 'served';
                  const isPaid = activeOrder && activeOrder.status === 'Paid';

                  return (
                    <div
                      key={table.id}
                      onMouseDown={(e) => handleMouseDown(e, table.id)}
                      onClick={() => handleTableClick(table)}
                      style={{
                        position: 'absolute',
                        left: `${posX}%`,
                        top: `${posY}%`,
                        width: '120px',
                        height: '120px',
                        cursor: isEditMode ? 'move' : 'pointer',
                        zIndex: draggedId === table.id ? 50 : 10,
                        transition: draggedId === table.id ? 'none' : 'left 0.1s ease-out, top 0.1s ease-out',
                        userSelect: 'none'
                      }}
                      className={`flex flex-col items-center justify-between p-2.5 border-2 text-center select-none shadow-sm ${
                        isCircle ? 'rounded-full' : 'rounded-2xl'
                      } ${cardStyle} ${isEditMode ? 'hover:scale-105 border-indigo-500 ring-4 ring-indigo-200' : 'hover:scale-[1.02] hover:shadow-md'}`}
                    >
                      {/* Nomor Meja & Keterangan */}
                      <div>
                        <div className="font-black text-xl tracking-tight leading-none text-slate-800">{table.tableNo}</div>
                        <div className="text-[8px] font-bold opacity-75 truncate max-w-[90px] mx-auto mt-0.5 text-slate-500">
                          {table.name || 'Umum'}
                        </div>
                      </div>
                      
                      {isOccupied ? (
                        <div className="flex flex-col items-center w-full">
                          {/* Nama Pelanggan */}
                          <div className="text-[9px] font-extrabold truncate max-w-[100px] leading-tight mb-0.5">
                            {activeOrder.customerName}
                          </div>
                          
                          {/* Status Badge */}
                          <div className="mb-1">
                            {isPaid ? (
                              <span className="text-[8px] font-black bg-emerald-500 text-white px-1.5 py-0.2 rounded">DIBAYAR</span>
                            ) : isServed ? (
                              <span className="text-[8px] font-black bg-blue-500 text-white px-1.5 py-0.2 rounded">SUDAH SIAP</span>
                            ) : (
                              <span className="text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.2 rounded animate-pulse">MENUNGGU</span>
                            )}
                          </div>
                          
                          {/* Total Bill */}
                          <div className="text-[10px] font-black tracking-wide bg-slate-900/10 px-2 py-0.5 rounded-full">
                            {formatCurrency(activeOrder.total)}
                          </div>
                          
                          {/* Waktu Tunggu */}
                          <div className="text-[8px] font-semibold mt-0.5 opacity-85 flex items-center gap-0.5 justify-center">
                            <Clock size={8} /> {getWaitTime(activeOrder.createdAt)}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            KOSONG
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 mt-1">Siap Pakai</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <TableModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedTable}
        onSave={handleSave}
      />

      {selectedOrderToPay && (
        <CheckoutModal 
          isOpen={isCheckoutOpen}
          onClose={() => { setIsCheckoutOpen(false); setSelectedOrderToPay(null); }}
          onSuccess={() => {
            setIsCheckoutOpen(false);
            setSelectedOrderToPay(null);
            fetchData();
          }}
          total={selectedOrderToPay.total}
          subtotal={selectedOrderToPay.subtotal}
          tax={selectedOrderToPay.tax}
          serviceCharge={selectedOrderToPay.serviceCharge}
          cart={selectedOrderToPay.items || []}
          customer={{ name: selectedOrderToPay.customerName, phone: selectedOrderToPay.customerPhone, id: selectedOrderToPay.customerId, tableId: selectedOrderToPay.tableId }}
          orderId={selectedOrderToPay.id}
        />
      )}

      {splitTableId !== null && (
        <SplitBillModal
          isOpen={isSplitOpen}
          onClose={() => {
            setIsSplitOpen(false);
            setSplitTableId(null);
          }}
          tableId={splitTableId}
          tableName={splitTableName}
          activeOrders={splitActiveOrders}
          onSplitSuccess={(newOrder) => {
            setIsSplitOpen(false);
            setSplitTableId(null);
            
            const normalizedItems = (newOrder.items || []).map((item: any) => ({
              ...item,
              product: item.product || { id: item.productId, name: 'Menu' }
            }));
            
            setSelectedOrderToPay({
              ...newOrder,
              items: normalizedItems
            });
            setIsCheckoutOpen(true);
          }}
        />
      )}

      {/* Modal Detail & Aksi Meja (Action Sheet) */}
      {actionTable && (
        <div className="modal-overlay backdrop-blur-sm bg-slate-900/30">
          <div className="modal-content !rounded-3xl border border-slate-100 shadow-2xl p-0 overflow-hidden" style={{ maxWidth: '420px', width: '90%' }}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-black flex items-center gap-2 text-slate-800">
                <Armchair className="text-indigo-600" size={20} /> 
                Detail Meja {actionTable.tableNo}
              </h2>
              <button 
                type="button"
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors" 
                onClick={() => setActionTable(null)}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Info Meja */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Lokasi Area</div>
                  <div className="font-bold text-slate-700 text-sm mt-0.5">{actionTable.name || 'Area Umum'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Kapasitas</div>
                  <div className="font-bold text-slate-700 text-sm mt-0.5">{actionTable.capacity} Kursi</div>
                </div>
              </div>

              {/* Status Pesanan */}
              {(() => {
                const activeOrder = getTableActiveOrder(actionTable.id);
                if (activeOrder) {
                  const isServed = getTableStatus(actionTable.id) === 'served';
                  return (
                    <div className="space-y-4">
                      <div className="border-t border-slate-150 pt-4">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Informasi Tagihan Aktif</div>
                        <div className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-2xl space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800 text-base">{activeOrder.customerName}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${isServed ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700 animate-pulse'}`}>
                              {isServed ? 'DISAJIKAN' : 'DIPROSES'}
                            </span>
                          </div>
                          
                          <div className="flex justify-between text-xs text-slate-500 font-semibold">
                            <span>Waktu Transaksi</span>
                            <span className="flex items-center gap-1"><Clock size={12} /> {getWaitTime(activeOrder.createdAt)} yang lalu</span>
                          </div>

                          <div className="flex justify-between text-sm pt-2 border-t border-indigo-100/50">
                            <span className="font-bold text-slate-600">Total Tagihan</span>
                            <span className="font-black text-indigo-700 text-base">{formatCurrency(activeOrder.total)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          className="flex-1 py-3 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 font-bold rounded-2xl transition-all text-xs flex items-center justify-center gap-1.5"
                          onClick={() => {
                            const tableOrders = activeOrders.filter(o => o.tableId === actionTable.id);
                            setSplitTableId(actionTable.id);
                            setSplitTableName(`Meja ${actionTable.tableNo}`);
                            setSplitActiveOrders(tableOrders);
                            setIsSplitOpen(true);
                            setActionTable(null);
                          }}
                        >
                          <Scissors size={14} /> Split Bill
                        </button>

                        {activeOrder.status === 'Paid' ? (
                          <button
                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-100"
                            onClick={() => {
                              handleReleaseTable(activeOrder.id);
                              setActionTable(null);
                            }}
                          >
                            <Check size={14} /> Kosongkan Meja
                          </button>
                        ) : (
                          <button
                            className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-bold rounded-2xl transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-100"
                            onClick={() => {
                              setSelectedOrderToPay(activeOrder);
                              setIsCheckoutOpen(true);
                              setActionTable(null);
                            }}
                          >
                            <CreditCard size={14} /> Bayar Tagihan
                          </button>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="space-y-4">
                      <div className="border-t border-slate-150 pt-4 flex flex-col items-center justify-center py-6 text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">KOSONG</span>
                        <p className="text-[11px] text-slate-400 mt-2 font-medium">Meja ini siap digunakan oleh pelanggan baru.</p>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          className="flex-1 py-3 bg-slate-100 hover:bg-slate-250 text-slate-700 font-bold rounded-2xl transition-all text-xs flex items-center justify-center gap-1.5"
                          onClick={() => {
                            setSelectedTable(actionTable);
                            setIsModalOpen(true);
                            setActionTable(null);
                          }}
                        >
                          <Edit size={14} /> Edit Meja
                        </button>
                        
                        <button
                          className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-2xl border border-rose-100 transition-all text-xs flex items-center justify-center gap-1.5"
                          onClick={() => {
                            handleDelete(actionTable.id);
                            setActionTable(null);
                          }}
                        >
                          <Trash2 size={14} /> Hapus Meja
                        </button>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableView;
