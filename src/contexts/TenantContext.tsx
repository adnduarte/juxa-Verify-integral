import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from '@/lib/localFirestore';
import { db } from '../firebase';
import { useAuthStatus } from './AuthContext';
import {
  OrganizationDoc,
  TenantBranding,
  TenantFeatureFlags,
  defaultTenantFeatures,
} from '../types/saas';

const DEFAULT_BRANDING: TenantBranding = {
  appName: 'Juxa Verify',
  primaryColor: '#2563eb',
};

interface TenantContextValue {
  organizationId: string | null;
  resellerId: string | null;
  organization: OrganizationDoc | null;
  features: TenantFeatureFlags;
  branding: TenantBranding;
  loading: boolean;
  hasProduct: (p: keyof TenantFeatureFlags) => boolean;
}

const TenantContext = createContext<TenantContextValue>({
  organizationId: null,
  resellerId: null,
  organization: null,
  features: defaultTenantFeatures,
  branding: DEFAULT_BRANDING,
  loading: true,
  hasProduct: () => true,
});

export const useTenant = () => useContext(TenantContext);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, organizationId, resellerId, loading: authLoading } = useAuthStatus();
  const [organization, setOrganization] = useState<OrganizationDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authLoading) return;
      if (!user || !organizationId) {
        setOrganization(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'organizations', organizationId));
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data() as Omit<OrganizationDoc, 'id'>;
          setOrganization({ id: snap.id, ...d });
        } else {
          setOrganization(null);
        }
      } catch {
        if (!cancelled) setOrganization(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, organizationId, authLoading]);

  const value = useMemo<TenantContextValue>(() => {
    const features = { ...defaultTenantFeatures, ...(organization?.features ?? {}) };
    const branding = organization?.branding ?? DEFAULT_BRANDING;
    return {
      organizationId: organizationId ?? null,
      resellerId: resellerId ?? null,
      organization,
      features,
      branding,
      loading: authLoading || loading,
      hasProduct: (key) => Boolean(features[key]),
    };
  }, [organization, organizationId, resellerId, authLoading, loading]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
