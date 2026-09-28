import React, { createContext, useContext, useMemo } from 'react';
import { usePOS } from './POSContext';

export type BusinessType = 'CAFE' | 'BENGKEL' | 'RETAIL' | 'LAUNDRY';

export interface VerticalNavItem {
  to: string;
  label: string;
  iconName: string; // lucide icon identifier
  badgeKey?: string;
  planBadge?: { key: string; tag: string };
  roles?: string[];
  section?: string;
}

export interface VerticalProfile {
  businessType: BusinessType;
  displayName: string;
  orderTerm: string;
  itemTerm: string;
  tableTerm: string;
  customerTerm: string;
  enableKds: boolean;
  enableTables: boolean;
  enableVehicles: boolean;
  enableMechanics: boolean;
  enableInvoices: boolean;
  enablePriceTiers: boolean;
  enableMultiUom?: boolean;
  enableDeliveryOrders?: boolean;
  barcodeFirstUX?: boolean;
}

interface VerticalContextType {
  businessType: BusinessType;
  isBengkel: boolean;
  isCafe: boolean;
  isRetail: boolean;
  isLaundry: boolean;
  profile: VerticalProfile;
  orderTerm: string;
}

const VERTICAL_PROFILES: Record<BusinessType, VerticalProfile> = {
  CAFE: {
    businessType: 'CAFE',
    displayName: 'Kafe & Resto',
    orderTerm: 'Pesanan',
    itemTerm: 'Menu & Resep',
    tableTerm: 'Nomor Meja',
    customerTerm: 'Pelanggan',
    enableKds: true,
    enableTables: true,
    enableVehicles: false,
    enableMechanics: false,
    enableInvoices: false,
    enablePriceTiers: false,
    enableMultiUom: false,
    enableDeliveryOrders: false,
    barcodeFirstUX: false,
  },
  BENGKEL: {
    businessType: 'BENGKEL',
    displayName: 'Bengkel Motor & Mobil',
    orderTerm: 'SPK (Surat Perintah Kerja)',
    itemTerm: 'Sparepart & Jasa',
    tableTerm: 'Pit / Stall Servis',
    customerTerm: 'Pelanggan & Pemilik Kendaraan',
    enableKds: false,
    enableTables: false,
    enableVehicles: true,
    enableMechanics: true,
    enableInvoices: true,
    enablePriceTiers: true,
    enableMultiUom: false,
    enableDeliveryOrders: false,
    barcodeFirstUX: false,
  },
  RETAIL: {
    businessType: 'RETAIL',
    displayName: 'Toko Grosir & Retail',
    orderTerm: 'Faktur Penjualan',
    itemTerm: 'Produk & Sembako',
    tableTerm: 'Nomor Rak / Gudang',
    customerTerm: 'Pelanggan / Warung Langganan',
    enableKds: false,
    enableTables: false,
    enableVehicles: false,
    enableMechanics: false,
    enableInvoices: true,
    enablePriceTiers: true,
    enableMultiUom: true,
    enableDeliveryOrders: true,
    barcodeFirstUX: true,
  },
  LAUNDRY: {
    businessType: 'LAUNDRY',
    displayName: 'Laundry & Kiloan',
    orderTerm: 'Nota Cuci',
    itemTerm: 'Layanan Cuci',
    tableTerm: 'Rak Simpan / Keranjang',
    customerTerm: 'Pelanggan',
    enableKds: false,
    enableTables: true,
    enableVehicles: false,
    enableMechanics: false,
    enableInvoices: false,
    enablePriceTiers: false,
    enableMultiUom: false,
    enableDeliveryOrders: false,
    barcodeFirstUX: false,
  }
};

const VerticalContext = createContext<VerticalContextType | undefined>(undefined);

export const VerticalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pos = usePOS();

  // Resolve businessType with strict precedence:
  // 1. User/Tenant active membership businessType
  // 2. Settings businessType
  // 3. Cached pos_business_type
  // 4. Default: 'CAFE'
  const businessType: BusinessType = useMemo(() => {
    let raw = pos.user?.businessType;
    if (!raw) {
      try {
        const saved = localStorage.getItem('pos_user') || localStorage.getItem('user');
        if (saved) {
          const parsed = JSON.parse(saved);
          raw = parsed?.businessType;
        }
      } catch (e) {}
    }
    if (!raw) {
      raw = pos.settings?.businessType || localStorage.getItem('pos_business_type');
    }

    if (raw && (raw === 'BENGKEL' || raw === 'CAFE' || raw === 'RETAIL' || raw === 'LAUNDRY')) {
      return raw as BusinessType;
    }
    return 'CAFE';
  }, [pos.user?.businessType, pos.settings?.businessType]);

  const profile = useMemo(() => {
    return VERTICAL_PROFILES[businessType] || VERTICAL_PROFILES.CAFE;
  }, [businessType]);

  const value = useMemo<VerticalContextType>(() => ({
    businessType,
    isBengkel: businessType === 'BENGKEL',
    isCafe: businessType === 'CAFE',
    isRetail: businessType === 'RETAIL',
    isLaundry: businessType === 'LAUNDRY',
    profile,
    orderTerm: profile.orderTerm,
  }), [businessType, profile]);

  return (
    <VerticalContext.Provider value={value}>
      {children}
    </VerticalContext.Provider>
  );
};

export const useVertical = (): VerticalContextType => {
  const context = useContext(VerticalContext);
  if (!context) {
    throw new Error('useVertical must be used within a VerticalProvider');
  }
  return context;
};

export default VerticalContext;
