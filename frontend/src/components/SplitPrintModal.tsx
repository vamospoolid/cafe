import React, { useState, useContext } from 'react';
import { 
  X, Printer, Utensils, Coffee, Receipt, CheckCircle, 
  Send, Layers, Sparkles, ChevronRight, AlertCircle 
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import ReceiptPrinter, { type PrintModeType } from './ReceiptPrinter';

interface SplitPrintModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

export const SplitPrintModal: React.FC<SplitPrintModalProps> = ({ order, isOpen, onClose }) => {
  const posContext = useContext(POSContext);
  const [selectedPreview, setSelectedPreview] = useState<PrintModeType>('all');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [activePrintJob, setActivePrintJob] = useState<{ mode: PrintModeType; order: any } | null>(null);

  if (!isOpen || !order) return null;

  const isShowcase = (item: any) => {
    const target = item.product?.category?.printerTarget;
    if (target === 'NONE') return true;
    const cat = (item.product?.category?.name || '').toLowerCase();
    const name = (item.product?.name || '').toLowerCase();
    return name.includes('air mineral') || name.includes('mineral water') || cat.includes('showcase') || cat.includes('display') || cat.includes('snack');
  };

  const isDrink = (item: any) => {
    if (isShowcase(item)) return false;
    const target = item.product?.category?.printerTarget;
    if (target === 'BAR') return true;
    if (target === 'KITCHEN') return false;
    const cat = (item.product?.category?.name || '').toLowerCase();
    const name = (item.product?.name || '').toLowerCase();
    return cat.includes('minum') || cat.includes('beverage') || cat.includes('drink') || cat.includes('tea') || cat.includes('kopi') || name.includes('ocha') || name.includes('ice') || name.includes('soda') || name.includes('latte');
  };

  const isKitchen = (item: any) => {
    if (isShowcase(item)) return false;
    if (isDrink(item)) return false;
    return true;
  };

  const kitchenItems = (order.items || []).filter(isKitchen);
  const barItems = (order.items || []).filter(isDrink);

  // Trigger TCP Network Print or fallback to standard thermal dialog
  const handlePrint = async (mode: PrintModeType) => {
    setLoadingAction(mode);
    try {
      const endpointMap: Record<string, string> = {
        receipt: '/api/printer/receipt',
        kitchen: '/api/printer/kitchen',
        bar: '/api/printer/bar',
        all: '/api/printer/all'
      };

      const endpoint = endpointMap[mode];
      const hasConfiguredIp = 
        (mode === 'kitchen' && (posContext?.settings?.kitchenPrinterIp || posContext?.settings?.printerIp)) ||
        (mode === 'bar' && (posContext?.settings?.barPrinterIp || posContext?.settings?.printerIp)) ||
        (mode === 'receipt' && posContext?.settings?.printerIp) ||
        (mode === 'all' && (posContext?.settings?.printerIp || posContext?.settings?.kitchenPrinterIp || posContext?.settings?.barPrinterIp));

      if (hasConfiguredIp) {
        // Try network socket print first
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${posContext?.token}`
          },
          body: JSON.stringify({ orderId: order.id })
        });

        if (res.ok) {
          toast(`Struk ${mode === 'kitchen' ? 'Dapur' : mode === 'bar' ? 'Bar' : 'Kasir'} berhasil dikirim ke printer jaringan!`, 'success');
          setLoadingAction(null);
          return;
        }
      }

      // Fallback: Browser thermal print window
      setActivePrintJob({ mode, order });
    } catch (err: any) {
      console.warn('Network print error, falling back to browser print:', err);
      setActivePrintJob({ mode, order });
    } finally {
      setLoadingAction(null);
    }
  };

  const fmt = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  return (
    <>
      <div 
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div 
          style={{
            background: 'white', borderRadius: '1.5rem', width: '100%', maxWidth: '850px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden',
            border: '1px solid #e2e8f0', animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* Header */}
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '1rem', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                <Printer size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                  Pusat Cetak Struk Multi-Printer
                </h3>
                <p style={{ margin: 0, fontSize: '.8rem', color: '#64748b' }}>
                  Pemisahan struk Dapur (Makanan), Bar (Minuman), dan Kasir (Tagihan)
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: '.75rem', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content: 2-Column (Left: Action Cards, Right: Ticket Preview) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', flex: 1, overflowY: 'auto' }}>
            
            {/* Left: Destination Print Buttons */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pilih Tujuan Cetak Struk
              </div>

              {/* 1. DAPUR (FOOD) */}
              <div 
                style={{
                  background: selectedPreview === 'kitchen' ? '#f5f3ff' : 'white',
                  border: selectedPreview === 'kitchen' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                  borderRadius: '1rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.6rem',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
                onClick={() => setSelectedPreview('kitchen')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '.6rem', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
                      <Utensils size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '.95rem', color: '#0f172a' }}>Struk Dapur (KOT / Makanan)</div>
                      <div style={{ fontSize: '.75rem', color: '#64748b' }}>{kitchenItems.length} menu makanan & ramen</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrint('kitchen'); }}
                    disabled={loadingAction === 'kitchen'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem 1rem',
                      background: '#ea580c', color: 'white', border: 'none', borderRadius: '.6rem',
                      fontWeight: 800, fontSize: '.8rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(234,88,12,0.3)'
                    }}
                  >
                    <Printer size={14} /> Cetak Dapur
                  </button>
                </div>
              </div>

              {/* 2. BAR (DRINKS) */}
              <div 
                style={{
                  background: selectedPreview === 'bar' ? '#f5f3ff' : 'white',
                  border: selectedPreview === 'bar' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                  borderRadius: '1rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.6rem',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
                onClick={() => setSelectedPreview('bar')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '.6rem', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                      <Coffee size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '.95rem', color: '#0f172a' }}>Struk Bar (BOT / Minuman)</div>
                      <div style={{ fontSize: '.75rem', color: '#64748b' }}>{barItems.length} menu minuman & dessert</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrint('bar'); }}
                    disabled={loadingAction === 'bar'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem 1rem',
                      background: '#059669', color: 'white', border: 'none', borderRadius: '.6rem',
                      fontWeight: 800, fontSize: '.8rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(5,150,105,0.3)'
                    }}
                  >
                    <Printer size={14} /> Cetak Bar
                  </button>
                </div>
              </div>

              {/* 3. KASIR (BILL) */}
              <div 
                style={{
                  background: selectedPreview === 'receipt' ? '#f5f3ff' : 'white',
                  border: selectedPreview === 'receipt' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                  borderRadius: '1rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.6rem',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
                onClick={() => setSelectedPreview('receipt')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '.6rem', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                      <Receipt size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '.95rem', color: '#0f172a' }}>Struk Kasir (Customer Bill)</div>
                      <div style={{ fontSize: '.75rem', color: '#64748b' }}>Total Tagihan: {fmt(order.total)}</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrint('receipt'); }}
                    disabled={loadingAction === 'receipt'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem 1rem',
                      background: '#2563eb', color: 'white', border: 'none', borderRadius: '.6rem',
                      fontWeight: 800, fontSize: '.8rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
                    }}
                  >
                    <Printer size={14} /> Cetak Kasir
                  </button>
                </div>
              </div>

              {/* 4. CETAK SEMUA SEKALIGUS */}
              <button
                onClick={() => handlePrint('all')}
                disabled={loadingAction === 'all'}
                style={{
                  marginTop: '.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem',
                  padding: '.85rem 1.25rem', background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                  color: 'white', border: 'none', borderRadius: '1rem', fontWeight: 900, fontSize: '.95rem',
                  cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.35)', transition: 'all 0.15s'
                }}
              >
                <Layers size={18} /> Cetak Semua Sekaligus (Split Potong)
              </button>
            </div>

            {/* Right: Real-time Slip Thermal Preview */}
            <div style={{ background: '#f8fafc', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '.75rem', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Pratinjau Kertas Thermal
                </span>
                <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '.2rem .5rem', borderRadius: '.4rem' }}>
                  Mode: {selectedPreview.toUpperCase()}
                </span>
              </div>

              {/* Thermal Paper Simulation Card */}
              <div 
                style={{
                  background: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)', fontFamily: "'Courier New', Courier, monospace",
                  fontSize: '.85rem', color: '#0f172a', lineHeight: 1.4
                }}
              >
                {selectedPreview === 'kitchen' && (
                  <div>
                    <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.1rem', marginBottom: '.25rem' }}>*** TIKET DAPUR ***</div>
                    <div style={{ textAlign: 'center', fontSize: '.75rem', fontWeight: 700, color: '#64748b' }}>[ MAKANAN / KITCHEN ]</div>
                    <div style={{ borderBottom: '2px solid #0f172a', margin: '.5rem 0' }} />
                    <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>MEJA: {order.table?.tableNo || order.orderType || 'Take Away'}</div>
                    <div style={{ fontSize: '.75rem' }}>No: {order.orderNumber} | {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div style={{ borderBottom: '1px dashed #cbd5e1', margin: '.5rem 0' }} />
                    <div style={{ fontWeight: 800, fontSize: '.75rem', marginBottom: '.35rem' }}>DAFTAR MENU:</div>
                    {kitchenItems.map((item: any, idx: number) => (
                      <div key={idx} style={{ marginBottom: '.4rem' }}>
                        <div style={{ fontWeight: 900, fontSize: '.95rem' }}>[{item.qty}x] {item.product?.name}</div>
                        {item.notes && <div style={{ fontSize: '.75rem', color: '#ea580c', fontWeight: 700 }}>&gt;&gt; Note: {item.notes}</div>}
                      </div>
                    ))}
                    {kitchenItems.length === 0 && <div style={{ fontSize: '.8rem', color: '#94a3b8' }}>(Tidak ada item makanan)</div>}
                  </div>
                )}

                {selectedPreview === 'bar' && (
                  <div>
                    <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.1rem', marginBottom: '.25rem' }}>*** TIKET BAR ***</div>
                    <div style={{ textAlign: 'center', fontSize: '.75rem', fontWeight: 700, color: '#64748b' }}>[ MINUMAN / BARISTA ]</div>
                    <div style={{ borderBottom: '2px solid #0f172a', margin: '.5rem 0' }} />
                    <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>MEJA: {order.table?.tableNo || order.orderType || 'Take Away'}</div>
                    <div style={{ fontSize: '.75rem' }}>No: {order.orderNumber} | {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div style={{ borderBottom: '1px dashed #cbd5e1', margin: '.5rem 0' }} />
                    <div style={{ fontWeight: 800, fontSize: '.75rem', marginBottom: '.35rem' }}>DAFTAR MENU:</div>
                    {barItems.map((item: any, idx: number) => (
                      <div key={idx} style={{ marginBottom: '.4rem' }}>
                        <div style={{ fontWeight: 900, fontSize: '.95rem' }}>[{item.qty}x] {item.product?.name}</div>
                        {item.notes && <div style={{ fontSize: '.75rem', color: '#059669', fontWeight: 700 }}>&gt;&gt; Note: {item.notes}</div>}
                      </div>
                    ))}
                    {barItems.length === 0 && <div style={{ fontSize: '.8rem', color: '#94a3b8' }}>(Tidak ada item minuman)</div>}
                  </div>
                )}

                {selectedPreview === 'receipt' && (
                  <div>
                    <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.1rem' }}>{posContext?.settings?.storeName || 'MUKI RAMEN'}</div>
                    <div style={{ textAlign: 'center', fontSize: '.75rem', color: '#64748b' }}>{posContext?.settings?.address || 'Jakarta'}</div>
                    <div style={{ borderBottom: '1px dashed #cbd5e1', margin: '.5rem 0' }} />
                    <div style={{ fontSize: '.75rem' }}>No: {order.orderNumber}</div>
                    <div style={{ fontSize: '.75rem' }}>Meja: {order.table?.tableNo || 'Take Away'}</div>
                    <div style={{ fontSize: '.75rem' }}>Waktu: {new Date(order.paidAt || order.createdAt).toLocaleString('id-ID')}</div>
                    <div style={{ borderBottom: '1px dashed #cbd5e1', margin: '.5rem 0' }} />
                    {(order.items || []).map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.25rem' }}>
                        <span>{item.qty}x {item.product?.name}</span>
                        <span style={{ fontWeight: 700 }}>{fmt(item.qty * item.price)}</span>
                      </div>
                    ))}
                    <div style={{ borderBottom: '1px dashed #cbd5e1', margin: '.5rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1rem' }}>
                      <span>TOTAL:</span>
                      <span>{fmt(order.total)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', marginTop: '.2rem' }}>
                      <span>Bayar:</span>
                      <span>{order.paymentMethod || 'Tunai'}</span>
                    </div>
                  </div>
                )}

                {selectedPreview === 'all' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ padding: '.5rem', background: '#fff7ed', borderRadius: '.5rem', border: '1px dashed #ea580c', fontSize: '.75rem' }}>
                      <strong>[1. Tiket Dapur Makanan]</strong>: {kitchenItems.length} item
                    </div>
                    <div style={{ padding: '.5rem', background: '#ecfdf5', borderRadius: '.5rem', border: '1px dashed #059669', fontSize: '.75rem' }}>
                      <strong>[2. Tiket Bar Minuman]</strong>: {barItems.length} item
                    </div>
                    <div style={{ padding: '.5rem', background: '#eff6ff', borderRadius: '.5rem', border: '1px dashed #2563eb', fontSize: '.75rem' }}>
                      <strong>[3. Struk Pelanggan]</strong>: Total {fmt(order.total)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Thermal Printer Dialog Trigger */}
      {activePrintJob && (
        <ReceiptPrinter
          order={activePrintJob.order}
          storeSettings={posContext?.settings}
          printMode={activePrintJob.mode}
          onClose={() => setActivePrintJob(null)}
        />
      )}
    </>
  );
};

export default SplitPrintModal;
