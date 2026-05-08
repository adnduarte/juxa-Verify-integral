import React, { useEffect, useMemo, useState } from 'react';
import { Building2, FileText, TrendingUp, Settings, AlertTriangle, Bot, Search, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';
import { useAuthStatus } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { db, auth } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot } from '@/lib/localFirestore';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';

type Inv = {
  id: string;
  title?: string;
  status?: string;
  clientProfile?: string;
  createdAt?: string;
  candidateName?: string;
};

function statusLabel(s: string | undefined) {
  switch (s) {
    case 'COMPLETED':
      return 'Completado';
    case 'IN_PROGRESS':
      return 'En progreso';
    case 'PENDING':
      return 'Pendiente';
    case 'REQUIRES_ATTENTION':
      return 'Atención';
    default:
      return s || '—';
  }
}

export const SmeDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('applications');
  const [investigations, setInvestigations] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);
  const { branding } = useTenant();
  const primary = branding.primaryColor?.trim() || '#2563eb';

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db as never, 'investigations'),
      where('clientId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInvestigations(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Inv));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const smeOnly = useMemo(
    () => investigations.filter((i) => (i.clientProfile || '').toUpperCase() === 'SME'),
    [investigations]
  );

  const stats = useMemo(() => {
    const list = smeOnly;
    const by = (s: string) => list.filter((i) => i.status === s).length;
    return {
      total: list.length,
      completed: by('COMPLETED'),
      pending: by('PENDING') + by('IN_PROGRESS'),
      attention: by('REQUIRES_ATTENTION'),
    };
  }, [smeOnly]);

  const alerts = useMemo(() => smeOnly.filter((i) => i.status === 'REQUIRES_ATTENTION'), [smeOnly]);

  const sidebarItems = [
    { id: 'applications', label: 'Solicitudes de Crédito', icon: Building2 },
    { id: 'analysis', label: 'Análisis de Riesgo', icon: TrendingUp },
    { id: 'documents', label: 'Documentación', icon: FileText },
    { id: 'rules', label: 'Reglas de Crédito', icon: Settings },
    { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
    { id: 'ia-config', label: 'Configuración IA', icon: Bot },
  ];

  return (
    <DashboardLayout
      title="Créditos PyME"
      subtitle="Gestión y análisis de solicitudes"
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          style={{ backgroundColor: primary }}
        >
          <Building2 className="w-4 h-4" />
          Nueva solicitud
        </button>
      }
    >
      {activeTab === 'applications' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Solicitudes PyME</h2>
          {loading ? (
            <JuxaVerifyLoader text="Cargando…" />
          ) : smeOnly.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p className="font-medium text-slate-800">No hay solicitudes con perfil PyME</p>
              <p className="text-sm text-slate-600 mt-2">
                Las investigaciones creadas con perfil <strong>SME</strong> aparecerán aquí. Otras solicitudes siguen en
                el listado general.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {smeOnly.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{inv.candidateName || inv.title || inv.id}</p>
                      <p className="text-xs text-slate-500">
                        {inv.createdAt ? new Date(inv.createdAt).toLocaleString() : '—'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-800">
                    {statusLabel(inv.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analysis' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Análisis de riesgo</h2>
          <p className="text-slate-600 mb-6 text-sm">Resumen derivado de tus solicitudes PyME.</p>
          {loading ? (
            <JuxaVerifyLoader text="Cargando…" />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                <p className="text-xs font-semibold text-slate-500 uppercase">Expedientes</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                <p className="text-xs font-semibold text-slate-500 uppercase">Completados</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.completed}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                <p className="text-xs font-semibold text-slate-500 uppercase">En proceso</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.pending}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                <p className="text-xs font-semibold text-slate-500 uppercase">Alertas</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{stats.attention}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Documentación</h2>
          <p className="text-slate-600 mb-6 text-sm">Expedientes PyME con evidencia en plataforma.</p>
          {loading ? (
            <JuxaVerifyLoader text="Cargando…" />
          ) : smeOnly.length === 0 ? (
            <p className="text-sm text-slate-600">Sin expedientes PyME.</p>
          ) : (
            <ul className="space-y-2">
              {smeOnly.map((inv) => (
                <li key={inv.id} className="flex items-center gap-2 text-sm text-slate-800 border border-slate-200 rounded-xl px-4 py-3 bg-white">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-mono text-xs text-slate-500">{inv.id}</span>
                  <span className="truncate">{inv.title || inv.candidateName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Reglas de crédito PyME</h2>
          <p className="text-slate-600 text-sm max-w-prose">
            Los parámetros de riesgo y aprobación se configuran en el módulo administrativo y en la configuración de IA
            por cliente. Usa <strong>Configuración IA</strong> para prompts y reglas asistidas.
          </p>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Alertas</h2>
          {loading ? (
            <JuxaVerifyLoader text="Cargando…" />
          ) : alerts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 text-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              No hay expedientes PyME que requieran atención.
            </div>
          ) : (
            <ul className="space-y-3">
              {alerts.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm"
                >
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900">{inv.candidateName || inv.title}</p>
                    <p className="text-xs text-slate-600 font-mono">{inv.id}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'ia-config' && <IAConfigPanel />}
    </DashboardLayout>
  );
};
