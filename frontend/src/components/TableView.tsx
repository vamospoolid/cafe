import React, { useState, useEffect, useContext } from 'react';
import { Plus, Edit, Trash2, Map, List, Armchair, Clock, Users, Coffee, Lock, Play, Scissors } from 'lucide-react';
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
          
          {/* View Toggles */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/60 self-start md:self-auto">
            <button
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'map' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setViewMode('map')}
            >
              <Map size={16} /> Visual Grid
            </button>
            <button
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setViewMode('list')}
            >
              <List size={16} /> Tabel Data
            </button>
          </div>
        </div>

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
          <div className="p-8 bg-slate-100 flex-1 overflow-y-auto">
            {filteredTables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 w-full">
                <Armchair size={48} className="text-slate-350 mb-3" />
                <p className="font-semibold text-sm">Tidak ada meja di area "{selectedArea}"</p>
                <p className="text-xs text-slate-400 mt-1">Anda bisa menambahkan meja baru ke area ini dengan tombol di atas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredTables.map(table => {
                  const activeOrder = getTableActiveOrder(table.id);
                  const tableStatus = getTableStatus(table.id);
                  const isOccupied = tableStatus !== 'empty';
                  const isServed = tableStatus === 'served';

                  const cardStyle = {
                    empty:   'bg-white border-transparent hover:border-emerald-200 hover:shadow-md',
                    cooking: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 shadow-amber-100/50',
                    served:  'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-400 shadow-blue-100/50',
                  }[tableStatus];

                  const dotStyle = {
                    empty:   'bg-emerald-400',
                    cooking: 'bg-amber-500 animate-pulse',
                    served:  'bg-blue-500 animate-pulse',
                  }[tableStatus];

                  const numStyle = {
                    empty:   'text-slate-700',
                    cooking: 'text-amber-600',
                    served:  'text-blue-600',
                  }[tableStatus];

                  const infoBorderStyle = {
                    empty:   '',
                    cooking: 'border border-amber-200/50',
                    served:  'border border-blue-200/60',
                  }[tableStatus];

                  return (
                    <div
                      key={table.id}
                      className={`relative flex flex-col justify-between p-5 rounded-2xl border-2 transition-all duration-300 shadow-sm ${cardStyle}`}
                    >
                      {/* Header: Status Indicator & Kapasitas */}
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-3 h-3 rounded-full shadow-sm ${dotStyle}`}></div>
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                          <Users size={12} /> {table.capacity}
                        </div>
                      </div>

                      {/* Tengah: Nomor Meja */}
                      <div className="text-center mb-6">
                        <h3 className={`text-5xl font-black mb-1 ${numStyle}`}>{table.tableNo}</h3>
                        <p className="text-xs font-semibold text-slate-400">{table.name || 'Area Umum'}</p>
                      </div>

                      {/* Info Aktif / Tombol Aksi */}
                      {isOccupied ? (
                        <div className={`bg-white/60 p-3 rounded-xl mb-4 ${infoBorderStyle}`}>
                          <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                            <Coffee size={12} className={isServed ? 'text-blue-500' : 'text-amber-500'} />
                            {activeOrder.customerName}
                          </div>
                          <div className="text-sm font-black text-primary">{formatCurrency(activeOrder.total)}</div>
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1"><Clock size={10} /> {getWaitTime(activeOrder.createdAt)} yang lalu</div>
                            {activeOrder.status === 'Paid' ? (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#ecfdf5', color: '#047857', padding: '0.1rem 0.4rem', borderRadius: '0.35rem' }}>âœ“ DIBAYAR</span>
                            ) : isServed ? (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#dbeafe', color: '#1d4ed8', padding: '0.1rem 0.4rem', borderRadius: '0.35rem' }}>âœ“ DISAJIKAN</span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center mb-4">
                          <span className="text-sm font-bold text-emerald-500 opacity-50">SIAP DIGUNAKAN</span>
                        </div>
                      )}

                      {/* Footer: Tombol */}
                      <div className="flex gap-2 mt-auto">
                        {isOccupied ? (
                          <>
                            <button
                              className="px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100 flex items-center justify-center gap-1"
                              title="Pecah Tagihan (Split Bill)"
                              onClick={() => {
                                const tableOrders = activeOrders.filter(o => o.tableId === table.id);
                                setSplitTableId(table.id);
                                setSplitTableName(`Meja ${table.tableNo}`);
                                setSplitActiveOrders(tableOrders);
                                setIsSplitOpen(true);
                              }}
                            >
                              <Scissors size={14} /> Split
                            </button>
                            {activeOrder.status === 'Paid' ? (
                              <button
                                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1"
                                onClick={() => handleReleaseTable(activeOrder.id)}
                              >
                                âœ“ Kosongkan
                              </button>
                            ) : (
                              <button
                                className={`flex-1 py-2 text-xs font-bold text-white rounded-lg transition-colors shadow-sm ${
                                  isServed ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary hover:bg-primary/90'
                                }`}
                                onClick={() => { setSelectedOrderToPay(activeOrder); setIsCheckoutOpen(true); }}
                              >
                                {isServed ? 'ðŸ’³ Bayar' : 'Lunasi (Pay)'}
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" onClick={() => { setSelectedTable(table); setIsModalOpen(true); }}>Edit</button>
                            <button className="flex-1 py-2 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors" onClick={() => handleDelete(table.id)}>Hapus</button>
                          </>
                        )}
                      </div>
                    </div>
                  )
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
    </div>
  );
};

export default TableView;
