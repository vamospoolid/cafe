import React, { useState, useContext } from 'react';
import { X, Search, UserCheck, Star, Gift, Tag } from 'lucide-react';
import { POSContext } from '../context/POSContext';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: any) => void;
}

const CustomerModal: React.FC<CustomerModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState(false);
  
  const posContext = useContext(POSContext);

  if (!isOpen) return null;

  const searchCustomer = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?search=${phone}`, {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCustomer(data[0]);
          setName(data[0].name);
        } else {
          setCustomer(null);
        }
      } else {
        setCustomer(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const data: any = { phone, name: name || 'Pelanggan Umum' };
    
    if (customer) {
      data.id = customer.id;
      data.points = customer.points;
      
      const settings = posContext?.settings;
      const loyaltyEnabled = settings ? settings.loyaltyEnabled : true;
      const loyaltyPointValue = settings ? settings.loyaltyPointValue : 100;

      if (loyaltyEnabled && redeemPoints && customer.points > 0) {
        data.pointsUsed = customer.points;
        data.discountAmount = customer.points * loyaltyPointValue; 
      }
    }
    
    onSelect(data);
    onClose();
  };

  const settings = posContext?.settings;
  const loyaltyEnabled = settings ? settings.loyaltyEnabled : true;
  const loyaltyPointValue = settings ? settings.loyaltyPointValue : 100;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header bg-indigo-50 border-b border-indigo-100">
          <h2 className="modal-title flex items-center gap-2 text-indigo-800">
            <UserCheck className="text-indigo-600" /> Member & Poin
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="modal-body space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Cari Member (No. WA)</label>
            <div className="flex gap-2">
              <input 
                type="tel" 
                className="form-control flex-1" 
                placeholder="08123456789"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchCustomer()}
              />
              <button className="btn btn-primary px-3" onClick={searchCustomer} disabled={loading}>
                <Search size={18} />
              </button>
            </div>
          </div>

          <div className="p-4 border rounded-lg bg-gray-50 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Nama Pelanggan</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Nama (Otomatis / Input Baru)"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            {customer && loyaltyEnabled && (
              <div className="bg-indigo-100 border border-indigo-200 p-3 rounded-lg flex justify-between items-center mt-2">
                <div>
                  <div className="text-sm font-bold text-indigo-900 flex items-center gap-1">
                    <Star size={14} className="text-amber-500 fill-amber-500" /> Poin Member
                  </div>
                  <div className="text-2xl font-black text-indigo-700">{customer.points} <span className="text-xs font-normal">pts</span></div>
                  <div className="text-[10px] text-indigo-500 font-bold">Tier: {customer.tier || 'Bronze'}</div>
                </div>
                {customer.points > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-md shadow-sm border border-gray-200 hover:border-indigo-300">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded"
                      checked={redeemPoints}
                      onChange={e => setRedeemPoints(e.target.checked)}
                    />
                    <span className="text-xs font-bold text-gray-700 flex flex-col">
                      Tukar Diskon
                      <span className="text-[10px] text-green-600 font-bold">-Rp{(customer.points * loyaltyPointValue).toLocaleString('id-ID')}</span>
                    </span>
                  </label>
                )}
              </div>
            )}
            
            {!customer && phone.length > 8 && name && (
              <div className="text-xs text-blue-600 flex items-center gap-1 bg-blue-50 p-2 rounded">
                <Gift size={14} /> Pelanggan baru! Member otomatis terdaftar setelah checkout.
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer flex gap-3 border-t border-gray-200 bg-white">
          <button className="btn btn-outline flex-1 justify-center" onClick={onClose}>Batal</button>
          <button 
            className="btn btn-primary flex-1 justify-center" 
            onClick={handleConfirm}
            disabled={!name}
          >
            Terapkan & Lanjut
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;
