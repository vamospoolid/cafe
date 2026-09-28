import React from 'react';
import { Navigate } from 'react-router-dom';
import { useVertical, type BusinessType } from '../context/VerticalContext';

interface VerticalGuardProps {
  allow: BusinessType | BusinessType[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * VerticalGuard ensures components and routes are only rendered
 * for tenants with matching businessType.
 * Prevents vertical feature bleeding across tenants.
 */
export const VerticalGuard: React.FC<VerticalGuardProps> = ({
  allow,
  fallback,
  children
}) => {
  const { businessType } = useVertical();
  const allowedList = Array.isArray(allow) ? allow : [allow];

  if (!allowedList.includes(businessType)) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default VerticalGuard;
