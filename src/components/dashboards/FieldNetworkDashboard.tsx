import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, ClipboardList, type LucideIcon } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { collection, query, where, onSnapshot, addDoc } from '@/lib/localFirestore';
import { db, auth } from '../../firebase';
import type { Role } from '../../contexts/AuthContext';
import { useAuthStatus } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { toast } from 'react-hot-toast';

type Variant = 'full' | 'embedded';

interface Props {
  role: Role;
  variant?: Variant;
  /** Admin: consultar visitas de otra organización */
  organizationIdOverride?: string | null;
}

const sidebarItems: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'visits', label: 'Visitas asignadas', icon: MapPin },
  { id: 'network', label: 'Red y SLA', icon: Navigation },
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
                ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
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

export const FieldNetworkDashboard: React.FC<Props> = ({ role, variant = 'full', organizationIdOverride }) => {
  const { organizationId, user } = useAuthStatus();
  const orgForQueries = organizationIdOverride || organizationId;
  const { branding } = useTenant();
  const [visits, setVisits] = useState<any[]>([]);
  const [tab, setTab] = useState('visits');

  useEffect(() => {
    if (!auth.currentUser || !orgForQueries) return;
    const org = orgForQueries;
    const uid = auth.currentUser.uid;
    const isNetwork = role === 'OPERADOR_RED_VISITAS';
    const q = isNetwork
      ? query(collection(db, 'field_visits'), where('organizationId', '==', org))
      : query(
          collection(db, 'field_visits'),
          where('organizationId', '==', org),
          where('assignedToUid', '==', uid)
        );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setVisits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (e) => {
        console.error(e);
        setVisits([]);
      }
    );
    return () => unsub();
  }, [orgForQueries, role]);

  const createDemoVisit = async () => {
    if (!user || !orgForQueries) return;
    try {
      await addDoc(collection(db, 'field_visits'), {
        organizationId: orgForQueries,
        investigationId: null,
        portfolioId: null,
        assignedToUid: user.uid,
        purpose: 'INVESTIGATION',
        status: 'SCHEDULED',
        notes: 'Visita demo — trazabilidad campo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast.success('Visita registrada');
    } catch (e) {
      toast.error('No se pudo crear la visita');
    }
  };

  const body = (
    <>
      {tab === 'visits' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">Trazabilidad de campo</h2>
            <button
              type="button"
              onClick={createDemoVisit}
              className="text-sm px-4 py-2 rounded-xl bg-blue-600 text-white font-medium"
            >
              + Demo visita
            </button>
          </div>
          {visits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 space-y-2">
              <p className="font-medium text-slate-800">Sin visitas en esta organización</p>
              <p>Use «+ Demo visita» o «Sembrar demo» en la barra superior del admin para datos de prueba.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visits.map((v) => (
                <li
                  key={v.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-white flex justify-between gap-4"
                >
                  <div>
                    <p className="font-mono text-xs text-slate-400">{v.id}</p>
                    <p className="font-semibold text-slate-900">{v.purpose}</p>
                    <p className="text-sm text-slate-600">{v.status}</p>
                  </div>
                  <ClipboardList className="w-8 h-8 text-slate-300 shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {tab === 'network' && (
        <div className="p-6 rounded-2xl border border-slate-200 bg-white text-sm text-slate-600">
          Métricas de red, disputas y conectores externos (Rocketpin / pins) se integran aquí como conectores opcionales; la fuente de verdad de visitas es{' '}
          <code>field_visits</code>.
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
      title={branding.appName}
      subtitle={
        role === 'OPERADOR_RED_VISITAS'
          ? 'Operador de red: validación de proveedores de visita y trazabilidad'
          : 'Agencia / campo: visitas de investigación, cobranza y servicios adicionales'
      }
      sidebarItems={sidebarItems}
      activeTab={tab}
      onTabChange={setTab}
    >
      {body}
    </DashboardLayout>
  );
};
