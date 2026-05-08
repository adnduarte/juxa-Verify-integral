import React, { useEffect, useState } from 'react';
import { Building2, Wallet, PhoneCall, type LucideIcon } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { collection, query, where, onSnapshot, addDoc } from '@/lib/localFirestore';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { toast } from 'react-hot-toast';

type Variant = 'full' | 'embedded';

const sidebarItems: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'originacion', label: 'Originación B2B', icon: Building2 },
  { id: 'cobranza', label: 'Cobranza', icon: PhoneCall },
  { id: 'cartera', label: 'Cartera', icon: Wallet },
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
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
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

export const B2BWorkspaceDashboard: React.FC<{ variant?: Variant; organizationIdOverride?: string | null }> = ({
  variant = 'full',
  organizationIdOverride,
}) => {
  const { organizationId, user } = useAuthStatus();
  const orgForQueries = organizationIdOverride || organizationId;
  const { branding, hasProduct } = useTenant();
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [tab, setTab] = useState('originacion');

  useEffect(() => {
    if (!orgForQueries) return;
    const q = query(collection(db, 'b2b_portfolios'), where('organizationId', '==', orgForQueries));
    return onSnapshot(
      q,
      (s) => setPortfolios(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setPortfolios([])
    );
  }, [orgForQueries]);

  const seedPortfolio = async () => {
    if (!orgForQueries || !user) return;
    try {
      await addDoc(collection(db, 'b2b_portfolios'), {
        organizationId: orgForQueries,
        name: 'Cartera corporativa demo',
        currency: 'MXN',
        totalExposure: 0,
        notes: 'Originación y cobranza B2B',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast.success('Cartera creada');
    } catch {
      toast.error('Error al crear cartera');
    }
  };

  if (!hasProduct('b2bCollections')) {
    return (
      <div className="p-8 text-center text-slate-600">
        El módulo B2B no está habilitado para su organización.
      </div>
    );
  }

  const body = (
    <>
      {tab === 'originacion' && (
        <p className="text-slate-600 text-sm max-w-prose">
          Use el perfil <strong>CREDIT</strong> y el laboratorio de originación existente; las operaciones quedan acotadas por{' '}
          <code>organizationId</code> en nuevas altas.
        </p>
      )}
      {tab === 'cobranza' && (
        <p className="text-slate-600 text-sm max-w-prose">
          Gestión de cuotas, promesas y visitas de cobranza enlazadas a <code>field_visits</code> con propósito <code>COLLECTION</code>.
        </p>
      )}
      {tab === 'cartera' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={seedPortfolio}
            className="text-sm px-4 py-2 rounded-xl bg-slate-900 text-white font-medium"
          >
            + Cartera demo
          </button>
          {portfolios.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 space-y-2">
              <p className="font-medium text-slate-800">Sin carteras B2B</p>
              <p>Use «+ Cartera demo» o «Sembrar demo» en la barra superior del admin.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {portfolios.map((p) => (
                <li key={p.id} className="p-4 rounded-2xl border bg-white">
                  <p className="font-bold">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.id}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
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
      title={`${branding.appName} · B2B`}
      subtitle="Originación compartida y cobranza con trazabilidad por tenant"
      sidebarItems={sidebarItems}
      activeTab={tab}
      onTabChange={setTab}
    >
      {body}
    </DashboardLayout>
  );
};
