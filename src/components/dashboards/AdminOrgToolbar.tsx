import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Database, Layers } from 'lucide-react';
import { collection, getDocs } from '@/lib/localFirestore';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useAdminViewOrganization } from '../../contexts/AdminViewOrganizationContext';
import { seedDemoSectorData } from '../../lib/adminDemoSeed';
import { toast } from 'react-hot-toast';
import type { OrganizationDoc } from '../../types/saas';

const MENU_IGNORE_KEY = 'jv_admin_menu_ignore_contract';

export const AdminOrgToolbar: React.FC<{
  menuIgnoreContract: boolean;
  onMenuIgnoreContractChange: (v: boolean) => void;
}> = ({ menuIgnoreContract, onMenuIgnoreContractChange }) => {
  const { role, user } = useAuthStatus();
  const { branding } = useTenant();
  const primary = branding.primaryColor?.trim() || '#2563eb';
  const { viewOrganizationId, setViewOrganizationId, effectiveOrganizationId } = useAdminViewOrganization();
  const [orgs, setOrgs] = useState<OrganizationDoc[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadOrgs = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const snap = await (getDocs as (q: unknown) => Promise<{ docs: { id: string; data: () => object }[] }>)(
        collection(db as never, 'organizations')
      );
      setOrgs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrganizationDoc, 'id'>) })));
    } catch {
      setOrgs([]);
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  useEffect(() => {
    if (role === 'ADMIN') loadOrgs();
  }, [role, loadOrgs]);

  const runSeed = async () => {
    const org = effectiveOrganizationId;
    if (!org || !user?.uid) {
      toast.error('Seleccione organización o inicie sesión.');
      return;
    }
    setSeeding(true);
    try {
      await seedDemoSectorData({ organizationId: org, assignedToUid: user.uid });
      toast.success('Datos demo creados (B2B, proveedor, visita).');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo sembrar datos demo.');
    } finally {
      setSeeding(false);
    }
  };

  if (role !== 'ADMIN') return null;

  return (
    <div
      className="mb-3 shrink-0 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/50 ring-1 ring-slate-200/40"
      style={{ ['--jv-toolbar-primary' as string]: primary }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: primary }}
          >
            <Building2 className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Contexto operativo</p>
            <p className="text-xs text-slate-500 mt-0.5">Organización activa y datos de demostración</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 lg:items-end">
        <div className="lg:col-span-5 flex flex-col gap-1.5 min-w-0">
          <label className="text-xs font-medium text-slate-600" htmlFor="admin-view-org">
            Ver datos de la organización
          </label>
          <select
            id="admin-view-org"
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-100/80 focus:outline-none focus:ring-2 focus:ring-[color:var(--jv-toolbar-primary)] focus:border-transparent"
            value={viewOrganizationId ?? ''}
            disabled={loadingOrgs}
            onChange={(e) => setViewOrganizationId(e.target.value || null)}
          >
            <option value="">Predeterminada (mi usuario)</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.id})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 leading-snug">
            Consultas en <span className="font-mono text-slate-700">{effectiveOrganizationId || '—'}</span>. Sin orgs, use{' '}
            <strong className="font-semibold text-slate-600">Onboarding / tenants</strong>.
          </p>
        </div>
        <div className="lg:col-span-4 flex items-center">
          <label className="inline-flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none leading-snug">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300 text-[color:var(--jv-toolbar-primary)] focus:ring-[color:var(--jv-toolbar-primary)]"
              checked={menuIgnoreContract}
              onChange={(e) => {
                const v = e.target.checked;
                onMenuIgnoreContractChange(v);
                try {
                  if (v) localStorage.setItem(MENU_IGNORE_KEY, '1');
                  else localStorage.removeItem(MENU_IGNORE_KEY);
                } catch {
                  /* ignore */
                }
              }}
            />
            Mostrar menú completo (ignorar contrato de producto del tenant)
          </label>
        </div>
        <div className="lg:col-span-3 flex flex-col sm:flex-row lg:flex-col gap-2 sm:justify-end lg:justify-start">
          <button
            type="button"
            onClick={runSeed}
            disabled={seeding || !effectiveOrganizationId}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: primary }}
          >
            <Database className="w-4 h-4 shrink-0" />
            {seeding ? 'Sembrando…' : 'Sembrar demo'}
          </button>
          <button
            type="button"
            onClick={loadOrgs}
            disabled={loadingOrgs}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <Layers className="w-4 h-4 shrink-0" />
            Refrescar orgs
          </button>
        </div>
      </div>
    </div>
  );
};

export function readStoredMenuIgnoreContract(): boolean {
  try {
    return localStorage.getItem(MENU_IGNORE_KEY) === '1';
  } catch {
    return false;
  }
}
