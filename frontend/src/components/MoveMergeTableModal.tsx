import React, { useState } from 'react';
import { X, ArrowRight, Merge, RefreshCw, Armchair, HelpCircle } from 'lucide-react';
import { toast, confirmAlert } from '../utils/alert';

interface MoveMergeTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTable: any;
  tables: any[];
  activeOrders: any[];
  onSuccess: () => void;
  token: string;
}

const MoveMergeTableModal: React.FC<MoveMergeTableModalProps> = ({
  isOpen,
  onClose,
  sourceTable,
  tables,
  activeOrders,
  onSuccess,
  token
}) => {
  const [selectedArea, setSelectedArea] = useState<string>('Semua');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !sourceTable) return null;

  // Helper untuk mengecek status meja target
  const getTableStatus = (tableId: number): 'empty' | 'occupied' => {
    const isOccupied = activeOrders.some(o => o.tableId === tableId && o.status === 'Pending');
    return isOccupied ? 'occupied' : 'empty';
  };

  // Helper untuk mendapatkan order aktif pada meja
  const getTableActiveOrder = (tableId: number) => {
    return activeOrders.find(o => o.tableId === tableId && o.status === 'Pending');
  };

  // Kategori area meja
  const uniqueAreas = Array.from(new Set(tables.map(t => (t.name && t.name.trim() !== '') ? t.name.trim() : 'Area Umum')));
  const areas = ['Semua', ...uniqueAreas];

  // Filter meja tujuan (sembunyikan meja asal)
  const targetTables = tables.filter(t => t.id !== sourceTable.id);
  const filteredTables = targetTables.filter(table => {
    const tableArea = (table.name && table.name.trim() !== '') ? table.name.trim() : 'Area Umum';
    return selectedArea === 'Semua' || tableArea === selectedArea;
  });

  const handleAction = async (targetTable: any) => {
    const targetStatus = getTableStatus(targetTable.id);
    const isMerge = targetStatus === 'occupied';
    
    let title = '';
    let message = '';
    let url = '';

    if (isMerge) {
      const targetOrder = getTableActiveOrder(targetTable.id);
      title = 'Gabung Tagihan';
      message = `Apakah Anda yakin ingin menggabungkan tagihan Meja ${sourceTable.tableNo} ke Meja ${targetTable.tableNo} (${targetOrder?.customerName || 'Pelanggan'})? Ini akan memindahkan seluruh item pesanan dan menghitung ulang total harga.`;
      url = '/api/orders/merge-table';
    } else {
      title = 'Pindah Meja';
      message = `Apakah Anda yakin ingin memindahkan seluruh pesanan aktif dari Meja ${sourceTable.tableNo} ke Meja ${targetTable.tableNo}?`;
      url = '/api/orders/move-table';
    }

    const confirmResult = await confirmAlert(title, message);
    if (!confirmResult.isConfirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceTableId: sourceTable.id,
          targetTableId: targetTable.id
        })
      });

      if (res.ok) {
        toast(isMerge ? 'Tagihan berhasil digabungkan!' : 'Meja berhasil dipindahkan!', 'success');
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        toast(err.error || 'Terjadi kesalahan sistem', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Gagal menghubungi server.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay backdrop-blur-sm bg-slate-900/30" style={{ zIndex: 10000 }}>
      <div className="modal-content !rounded-3xl border border-slate-100 shadow-2xl p-0 overflow-hidden" style={{ maxWidth: '640px', width: '95%' }}>
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2 text-slate-800">
              <RefreshCw className="text-indigo-650 animate-spin-slow" size={20} />
              Pindah / Gabung Meja
            </h2>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Memindahkan pesanan atau menggabungkan bill meja aktif</p>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Info Asal Meja */}
        <div className="px-6 py-4 bg-indigo-50/30 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex flex-col items-center justify-center font-black text-indigo-700 text-sm">
              {sourceTable.tableNo}
            </div>
            <div>
              <div className="font-bold text-slate-700">Meja Asal</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{sourceTable.name || 'Area Umum'}</div>
            </div>
          </div>
          <ArrowRight className="text-slate-350" size={18} />
          <div className="flex items-center gap-2 text-slate-500 font-medium bg-white px-3 py-2 rounded-xl border border-slate-150 shadow-2xs">
            <HelpCircle size={14} className="text-indigo-500" />
            <span>Pilih Meja Tujuan di bawah</span>
          </div>
        </div>

        {/* Area Navigation Tabs */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-wrap gap-1.5">
          {areas.map(area => (
            <button
              key={area}
              onClick={() => setSelectedArea(area)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedArea === area
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-650'
              }`}
            >
              {area}
            </button>
          ))}
        </div>

        {/* Modal Body: Target Tables Grid */}
        <div className="p-6 max-h-[380px] overflow-y-auto bg-slate-50">
          {filteredTables.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              Tidak ada meja tujuan yang tersedia di area ini.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredTables.map(table => {
                const status = getTableStatus(table.id);
                const isOccupied = status === 'occupied';
                const activeOrder = getTableActiveOrder(table.id);
                
                const cardBg = isOccupied
                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 hover:border-amber-300 text-amber-900 shadow-sm'
                  : 'bg-white hover:bg-indigo-50/20 border-slate-200 hover:border-indigo-400 text-slate-800 shadow-2xs';

                return (
                  <button
                    key={table.id}
                    onClick={() => handleAction(table)}
                    disabled={submitting}
                    className={`flex flex-col items-center justify-between p-4 border-2 rounded-2xl transition-all duration-200 text-center active:scale-[0.98] ${cardBg}`}
                  >
                    <div>
                      <div className="font-black text-lg leading-none">{table.tableNo}</div>
                      <div className="text-[9px] font-bold opacity-60 mt-1">{table.name || 'Umum'}</div>
                    </div>

                    <div className="mt-4 w-full pt-2.5 border-t border-dashed border-inherit">
                      {isOccupied ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[8px] font-black bg-amber-500 text-white px-2 py-0.5 rounded flex items-center gap-1">
                            <Merge size={8} /> GABUNG BILL
                          </span>
                          <span className="text-[9px] font-extrabold truncate max-w-[120px] text-amber-800">
                            {activeOrder?.customerName || 'Pelanggan'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded">
                            PINDAH MEJA
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold mt-1">
                            Meja Kosong
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white">
          <button
            type="button"
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold rounded-xl text-xs transition-all active:scale-[0.98]"
            onClick={onClose}
            disabled={submitting}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveMergeTableModal;
