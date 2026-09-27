import React from 'react';
import { usePOS } from '../context/POSContext';
import { FeatureLockedPaywall } from './FeatureLockedPaywall';

interface FeatureGuardProps {
  featureKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ 
  featureKey, 
  children, 
  fallback 
}) => {
  const { hasFeature, user } = usePOS();

  // Platform admin & superadmin bypass feature gating
  if (user?.role === 'SUPERADMIN' || user?.isPlatformAdmin || (user?.role === 'OWNER' && user?.username === 'admin')) {
    return <>{children}</>;
  }

  const isAllowed = hasFeature(featureKey);

  if (!isAllowed) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <FeatureLockedPaywall featureKey={featureKey} />;
  }

  return <>{children}</>;
};

export default FeatureGuard;
