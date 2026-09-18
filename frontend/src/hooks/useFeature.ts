import { useContext } from 'react';
import { POSContext } from '../context/POSContext';

/**
 * Hook untuk mengecek apakah fitur tertentu diaktifkan untuk tenant saat ini.
 * Contoh: const isKdsActive = useFeature('pos.kds');
 */
export function useFeature(featureKey: string): boolean {
  const context = useContext(POSContext);
  if (!context) {
    console.warn('[useFeature] POSContext not found, returning false');
    return false;
  }
  return context.hasFeature(featureKey);
}

/**
 * Hook untuk mengakses daftar lengkap fitur aktif dan info paket langganan tenant.
 */
export function useFeatures() {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('useFeatures must be used within a POSProvider');
  }

  return {
    features: context.features,
    hasFeature: context.hasFeature,
    tenantPlan: context.tenantPlan,
    refreshFeatures: context.fetchTenantFeatures
  };
}

export default useFeature;
