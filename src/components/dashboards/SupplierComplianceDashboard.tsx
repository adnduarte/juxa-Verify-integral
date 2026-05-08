import React, { useEffect, useState } from 'react';
import { Factory, ShieldCheck, ListChecks, type LucideIcon } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { collection, query, where, onSnapshot, addDoc } from '@/lib/localFirestore';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { DigidSignatureCard } from '../DigidSignatureCard';
import { toast } from 'react-hot-toast';

const STEPS = ['INTAKE', 'DOCUMENTS', 'LIST_CHECKS', 'FIELD_VISIT', 'SCORING', 'COMPLIANCE_REVIEW', 'APPROVED'];

type Variant = 'full' | 'embedded';

const sidebarItems: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'board', label: 'Tablero', icon: Factory },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'steps', label: 'Pasos IA + score', icon: ListChecks },
];

function EmbeddedSubNav({
  items,
  activeTab,
  onTabChange,
}: {
  items: typeof sidebarItems;
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              active
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export const SupplierComplianceDashboard: React.FC<{ variant?: Variant; organizationIdOverride?: string | null }> = ({
  variant = 'full',
  organizationIdOverride,
}) => {
  const { organizationId, user } = useAuthStatus();
  const orgForQueries = organizationIdOverride || organizationId;
  const { branding, hasProduct } = useTenant();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [tab, setTab] = useState('board');

  useEffect(() => {
    if (!orgForQueries) return;
    const q = query(collection(db, 'suppliers'), where('organizationId', '==', orgForQueries));
    return onSnapshot(q, (s) => setSuppliers(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () =>
      setSuppliers([])
    );
  }, [orgForQueries]);

  const addSupplier = async () => {
    if (!orgForQueries || !user) return;
    try {
      await addDoc(collection(db, 'suppliers'), {
        organizationId: orgForQueries,
        legalName: `Proveedor demo ${Date.now()}`,
        rfc: '',
        verificationStep: 'INTAKE',
        score: null,
        complianceNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast.success('Proveedor creado');
    } catch {
      toast.error('Error al crear proveedor');
    }
  };

  if (!hasProduct('supplierCompliance')) {
    return <div className="p-8 text-center text-slate-600">Módulo proveedores no habilitado.</div>;
  }

  const body = (
    <>
      {tab === 'board' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={addSupplier}
            className="text-sm px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium"
          >
            + Alta proveedor demo
          </button>
          {suppliers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 space-y-2">
              <p className="font-medium text-slate-800">Sin proveedores en esta organización</p>
              <p>Use «+ Alta proveedor demo» o el botón «Sembrar demo» en la barra superior del admin.</p>
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {suppliers.map((s) => (
                <li key={s.id} className="p-4 rounded-2xl border bg-white space-y-2">
                  <p className="font-bold">{s.legalName}</p>
                  <p className="text-xs text-slate-500">Paso: {s.verificationStep || '—'}</p>
                  <DigidSignatureCard contextType="supplier" contextId={s.id} title="Firma marco / NDA (DIGID)" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {tab === 'compliance' && (
        <p className="text-sm text-slate-600 max-w-prose">
          Registro de evidencias, listas restrictivas y re-evaluaciones; enlazar visitas de verificación en <code>field_visits</code> con propósito{' '}
          <code>SUPPLIER_VERIFY</code>.
        </p>
      )}
      {tab === 'steps' && (
        <ol className="list-decimal pl-6 text-sm text-slate-700 space-y-2">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
    </>
  );

  if (variant === 'embedded') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
        <EmbeddedSubNav items={sidebarItems} activeTab={tab} onTabChange={setTab} />
        {body}
      </div>
    );
  }

  return (
    <DashboardLayout
      title={`${branding.appName} · Proveedores`}
      subtitle="Validación automatizada, score, pasos y firma DIGID en contratos/actas"
      sidebarItems={sidebarItems}
      activeTab={tab}
      onTabChange={setTab}
    >
      {body}
    </DashboardLayout>
  );
};
