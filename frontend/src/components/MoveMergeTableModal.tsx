import React, { useState } from 'react';
import { 
  X, ArrowRight, Merge, RefreshCw, Armchair, HelpCircle, 
  ArrowLeft, CheckCircle2, AlertTriangle, Users, Receipt, ShieldCheck
} from 'lucide-react';
import { toast } from '../utils/alert';

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
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [selectedTargetTable, setSelectedTargetTable] = useState<any | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>('Semua');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !sourceTable) return null;

  // Helper untuk mengecek status meja target (terisi jika ada order aktif apapun)
  const getTableStatus = (tableId: number): 'empty' | 'occupied' => {
    const isOccupied = activeOrders.some(o => o.tableId === tableId);
    return isOccupied ? 'occupied' : 'empty';
  };

  // Helper untuk mendapatkan order aktif pada meja
  const getTableActiveOrder = (tableId: number) => {
    return activeOrders.find(o => o.tableId === tableId);
  };

  const sourceActiveOrder = getTableActiveOrder(sourceTable.id);

  // Kategori area meja
  const uniqueAreas = Array.from(new Set(tables.map(t => (t.name && t.name.trim() !== '') ? t.name.trim() : 'Area Umum')));
  const areas = ['Semua', ...uniqueAreas];

  // Filter meja tujuan (sembunyikan meja asal)
  const targetTables = tables.filter(t => t.id !== sourceTable.id);
  const filteredTables = targetTables.filter(table => {
    const tableArea = (table.name && table.name.trim() !== '') ? table.name.trim() : 'Area Umum';
    return selectedArea === 'Semua' || tableArea === selectedArea;
  });

  const handleSelectTable = (table: any) => {
    setSelectedTargetTable(table);
    setStep('confirm');
  };

  const handleBackToSelect = () => {
    setStep('select');
  };

  const handleExecute = async () => {
    if (!selectedTargetTable) return;
    
    const targetStatus = getTableStatus(selectedTargetTable.id);
    const isMerge = targetStatus === 'occupied';
    const url = isMerge ? '/api/orders/merge-table' : '/api/orders/move-table';

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
          targetTableId: selectedTargetTable.id
        })
      });

      if (res.ok) {
        toast(isMerge ? 'Tagihan berhasil digabungkan!' : 'Meja berhasil dipindahkan!', 'success');
        onSuccess();
        onClose();
        setStep('select');
        setSelectedTargetTable(null);
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

  const isTargetOccupied = selectedTargetTable ? getTableStatus(selectedTargetTable.id) === 'occupied' : false;
  const targetActiveOrder = selectedTargetTable ? getTableActiveOrder(selectedTargetTable.id) : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div 
        className="bg-white w-full rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] transition-all"
        style={{ maxWidth: step === 'confirm' ? '540px' : '620px' }}
      >
        {/* ─── MODAL HEADER ─── */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {step === 'confirm' && (
              <button
                type="button"
                onClick={handleBackToSelect}
                disabled={submitting}
                className="p-1.5 rounded-xl hover:bg-slate-200/70 text-slate-600 active:scale-95 transition-all cursor-pointer mr-1"
                title="Kembali pilih meja"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <RefreshCw size={18} className={submitting ? 'animate-spin' : ''} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-800 truncate">
                {step === 'select' ? 'Pindah / Gabung Meja' : isTargetOccupied ? 'Konfirmasi Gabung Meja & Bill' : 'Konfirmasi Pindah Meja'}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                {step === 'select' ? 'Langkah 1 dari 2: Pilih Meja Tujuan' : 'Langkah 2 dari 2: Periksa Rincian & Eksekusi'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
            onClick={onClose}
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── STEP 1: PILIH MEJA TUJUAN ─── */}
        {step === 'select' && (
          <>
            {/* Info Asal Meja */}
            <div className="px-5 sm:px-6 py-3.5 bg-indigo-50/40 border-b border-slate-100 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex flex-col items-center justify-center font-black text-sm shadow-xs shrink-0">
                  {sourceTable.tableNo}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                    <span>Meja Asal: No. {sourceTable.tableNo}</span>
                    {sourceActiveOrder && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold">
                        {sourceActiveOrder.customerName || 'Tamu'}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">{sourceTable.name || 'Area Umum'}</div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <HelpCircle size={13} className="text-indigo-500" />
                <span>Klik meja tujuan</span>
              </div>
            </div>

            {/* Area Navigation Tabs */}
            <div className="px-5 sm:px-6 py-2.5 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
              {areas.map(area => (
                <button
                  key={area}
                  onClick={() => setSelectedArea(area)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedArea === area
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>

            {/* Modal Body: Target Tables Grid */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-50/70 flex-1">
              {filteredTables.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium text-xs">
                  Tidak ada meja tujuan yang tersedia di area ini.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {filteredTables.map(table => {
                    const status = getTableStatus(table.id);
                    const isOccupied = status === 'occupied';
                    const activeOrder = getTableActiveOrder(table.id);
                    
                    const cardBg = isOccupied
                      ? 'bg-amber-50/60 hover:bg-amber-100/70 border-amber-200 hover:border-amber-400 text-amber-900 shadow-xs'
                      : 'bg-white hover:bg-indigo-50/40 border-slate-200 hover:border-indigo-400 text-slate-800 shadow-xs';

                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => handleSelectTable(table)}
                        className={`flex flex-col items-center justify-between p-3.5 sm:p-4 border-2 rounded-2xl transition-all duration-150 text-center active:scale-[0.97] cursor-pointer hover:shadow-md ${cardBg}`}
                      >
                        <div className="w-full">
                          <div className="font-black text-base sm:text-lg leading-tight">{table.tableNo}</div>
                          <div className="text-[10px] font-semibold opacity-60 mt-0.5 truncate">{table.name || 'Umum'}</div>
                        </div>

                        <div className="mt-3 w-full pt-2.5 border-t border-dashed border-slate-300/80">
                          {isOccupied ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                <Merge size={10} /> GABUNG BILL
                              </span>
                              <span className="text-[10px] font-bold truncate max-w-[110px] text-amber-800 mt-0.5">
                                {activeOrder?.customerName || 'Pelanggan'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md shadow-2xs">
                                PINDAH MEJA
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold mt-0.5">
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
            <div className="px-5 sm:px-6 py-3 border-t border-slate-100 flex justify-end gap-2 bg-white shrink-0">
              <button
                type="button"
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                onClick={onClose}
              >
                Batal
              </button>
            </div>
          </>
        )}

        {/* ─── STEP 2: REVIEW & KONFIRMASI (IN-MODAL) ─── */}
        {step === 'confirm' && selectedTargetTable && (
          <>
            <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50/70 flex-1 space-y-4 sm:space-y-5">
              {/* Visual Transfer Flow Banner */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
                {/* Asal */}
                <div className="flex flex-col items-center text-center flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Meja Asal</div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                    {sourceTable.tableNo}
                  </div>
                  <div className="text-xs font-bold text-slate-800 mt-1.5 truncate max-w-[120px]">
                    {sourceActiveOrder?.customerName || 'Tamu Asal'}
                  </div>
                  <div className="text-[10px] text-slate-400">{sourceTable.name || 'Umum'}</div>
                </div>

                {/* Arrow Transfer */}
                <div className="flex flex-col items-center justify-center px-2">
                  <div className="p-2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    <ArrowRight size={18} className="text-indigo-600" />
                  </div>
                  <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest mt-1">
                    {isTargetOccupied ? 'Gabung Ke' : 'Pindah Ke'}
                  </span>
                </div>

                {/* Tujuan */}
                <div className="flex flex-col items-center text-center flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Meja Tujuan</div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shadow-sm text-white ${
                    isTargetOccupied ? 'bg-amber-500' : 'bg-emerald-600'
                  }`}>
                    {selectedTargetTable.tableNo}
                  </div>
                  <div className="text-xs font-bold text-slate-800 mt-1.5 truncate max-w-[120px]">
                    {isTargetOccupied ? (targetActiveOrder?.customerName || 'Tamu Tujuan') : 'Meja Kosong'}
                  </div>
                  <div className="text-[10px] text-slate-400">{selectedTargetTable.name || 'Umum'}</div>
                </div>
              </div>

              {/* Action Description & Impact Card */}
              {isTargetOccupied ? (
                <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-black text-sm text-amber-950">
                    <Merge size={18} className="text-amber-600" />
                    <span>Penyatuan Tagihan & Menu (Merge Bill)</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Pesanan aktif dari <strong>Meja {sourceTable.tableNo}</strong> akan disatukan ke dalam bill <strong>Meja {selectedTargetTable.tableNo}</strong> ({targetActiveOrder?.customerName || 'Pelanggan'}).
                  </p>
                  <div className="text-[11px] font-semibold text-amber-700 bg-amber-100/70 p-2.5 rounded-xl border border-amber-200">
                    ✓ Meja {sourceTable.tableNo} otomatis berstatus <strong>Kosong</strong> kembali setelah proses penggabungan.
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-4 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-black text-sm text-emerald-950">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <span>Relokasi Meja (Move Table)</span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Seluruh pesanan aktif di <strong>Meja {sourceTable.tableNo}</strong> akan dipindahkan ke <strong>Meja {selectedTargetTable.tableNo}</strong> tanpa mengubah rincian menu ataupun tagihan.
                  </p>
                  <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 p-2.5 rounded-xl border border-emerald-200">
                    ✓ Meja {sourceTable.tableNo} otomatis berstatus <strong>Kosong</strong> kembali.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white shrink-0">
              <button
                type="button"
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                onClick={handleBackToSelect}
                disabled={submitting}
              >
                <ArrowLeft size={14} />
                <span>Ganti Meja Tujuan</span>
              </button>

              <button
                type="button"
                onClick={handleExecute}
                disabled={submitting}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${
                  isTargetOccupied
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : isTargetOccupied ? (
                  <>
                    <Merge size={16} />
                    <span>Konfirmasi Gabung Bill</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Konfirmasi Pindah Meja</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MoveMergeTableModal;
