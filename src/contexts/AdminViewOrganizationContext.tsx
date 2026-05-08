import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuthStatus } from './AuthContext';

const STORAGE_KEY = 'jv_admin_view_organization_id';

type Ctx = {
  /** When set, embedded admin modules query this org instead of the signed-in user's org. */
  viewOrganizationId: string | null;
  setViewOrganizationId: (id: string | null) => void;
  /** Resolved org for Firestore queries in admin sector tabs */
  effectiveOrganizationId: string | null;
};

const AdminViewOrganizationContext = createContext<Ctx | null>(null);

export const AdminViewOrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { organizationId } = useAuthStatus();
  const [viewOrganizationId, setViewState] = useState<string | null>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v && v.trim().length ? v.trim() : null;
    } catch {
      return null;
    }
  });

  const setViewOrganizationId = useCallback((id: string | null) => {
    setViewState(id);
    try {
      if (id && id.trim()) localStorage.setItem(STORAGE_KEY, id.trim());
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const effectiveOrganizationId = useMemo(
    () => viewOrganizationId || organizationId || null,
    [viewOrganizationId, organizationId]
  );

  const value = useMemo(
    () => ({ viewOrganizationId, setViewOrganizationId, effectiveOrganizationId }),
    [viewOrganizationId, setViewOrganizationId, effectiveOrganizationId]
  );

  return <AdminViewOrganizationContext.Provider value={value}>{children}</AdminViewOrganizationContext.Provider>;
};

export function useAdminViewOrganization(): Ctx {
  const ctx = useContext(AdminViewOrganizationContext);
  if (!ctx) {
    return {
      viewOrganizationId: null,
      setViewOrganizationId: () => {},
      effectiveOrganizationId: null,
    };
  }
  return ctx;
}
