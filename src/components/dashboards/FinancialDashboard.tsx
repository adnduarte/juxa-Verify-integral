import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Users, Building2, CheckCircle2, Clock, AlertCircle, Plus, Search, Filter, ShieldCheck, Settings, Bot, MessageCircle, LifeBuoy } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { useAuthStatus } from '../../contexts/AuthContext';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';
import { PendientesAgentPanel } from './PendientesAgentPanel';
import { LoongWorkspaceChatTab } from '../loong/LoongWorkspaceChatTab';
import { LoongSupportTicketsTab } from '../loong/LoongSupportTicketsTab';
import { FEATURE_WORKSPACE_CHAT_TICKETS } from '../../config/features';

export const FinancialDashboard: React.FC = () => {
  const { role, user, organizationId } = useAuthStatus();
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('requests');

  useEffect(() => {
    if (!auth.currentUser || !role) return;

    // Internal roles can see all investigations
    const isInternal = ['ADMIN', 'SUPERVISOR', 'EJECUTIVO_VENTAS', 'ANALISTA_MESA_CONTROL', 'GERENTE_DIRECTIVO', 'ANALISTA_CREDITO', 'INVESTIGADOR_SOCIAL', 'REVISOR_RRHH', 'INVESTIGADOR'].includes(role);

    let q;
    if (isInternal) {
      q = query(
        collection(db, 'investigations'),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'investigations'),
        where('clientId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribeInv = onSnapshot(q, (snapshot) => {
      const invs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInvestigations(invs);
    });

    return () => {
      unsubscribeInv();
    };
  }, []);

  const completedCount = investigations.filter(i => i.status === 'COMPLETED').length;
  const inProgressCount = investigations.filter(i => i.status === 'IN_PROGRESS' || i.status === 'PENDING').length;
  const attentionCount = investigations.filter(i => i.status === 'REQUIRES_ATTENTION').length;

  const getTitle = () => {
    if (role === 'EJECUTIVO_VENTAS') return 'Panel Comercial';
    if (role === 'ANALISTA_MESA_CONTROL') return 'Mesa de Control Financiero';
    if (role === 'GERENTE_DIRECTIVO') return 'Panel Directivo Financiero';
    return 'Crédito Financiero';
  };

  const getSubtitle = () => {
    if (role === 'EJECUTIVO_VENTAS') return 'Gestión de solicitudes de crédito e investigación.';
    if (role === 'ANALISTA_MESA_CONTROL') return 'Monitoreo de avance técnico y asignación de recursos.';
    if (role === 'GERENTE_DIRECTIVO') return 'Aprobación de dictámenes y gestión de planes.';
    return 'Verificación de flujos y análisis de crédito.';
  };

  const sidebarItems = useMemo(() => {
    const all = [
      { id: 'requests', label: role === 'GERENTE_DIRECTIVO' ? 'Dictámenes' : 'Solicitudes', icon: FileText },
      { id: 'flows', label: 'Verificación de Flujos', icon: ShieldCheck },
      { id: 'validation', label: 'Validar Créditos', icon: CheckCircle2 },
      { id: 'rules', label: 'Reglas de Crédito', icon: Settings },
      { id: 'clients', label: 'Cartera de Clientes', icon: Users },
      { id: 'chat', label: 'Chat', icon: MessageCircle },
      { id: 'tickets', label: 'Soporte / tickets', icon: LifeBuoy },
      { id: 'ia-config', label: 'Configuración IA', icon: Bot },
    ];
    if (FEATURE_WORKSPACE_CHAT_TICKETS) return all;
    return all.filter((i) => i.id !== 'chat' && i.id !== 'tickets');
  }, [role]);

  useEffect(() => {
    if (!FEATURE_WORKSPACE_CHAT_TICKETS && (activeTab === 'chat' || activeTab === 'tickets')) {
      setActiveTab('requests');
    }
  }, [activeTab]);

  return (
    <DashboardLayout
      title={getTitle()}
      subtitle={getSubtitle()}
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={
        (role === 'EJECUTIVO_VENTAS' || role === 'CLIENTE') ? (
          <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Nueva Solicitud
          </button>
        ) : undefined
      }
    >
      {activeTab === 'requests' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Completados</h3>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{completedCount}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">En Progreso</h3>
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{inProgressCount}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Requieren Atención</h3>
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{attentionCount}</p>
            </div>
          </div>

          {/* Main Content Area based on Role */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {role === 'EJECUTIVO_VENTAS' && 'Mis Solicitudes'}
                {role === 'ANALISTA_MESA_CONTROL' && 'Cola de Trabajo'}
                {role === 'GERENTE_DIRECTIVO' && 'Dictámenes Pendientes de Aprobación'}
                {role === 'CLIENTE' && 'Mis Solicitudes de Crédito'}
              </h2>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Buscar..." 
                    className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64"
                  />
                </div>
                <button className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {investigations.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No hay registros disponibles.
                </div>
              ) : (
                investigations.map((inv) => (
                  <div key={inv.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${
                        inv.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' :
                        inv.status === 'PENDING' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' :
                        inv.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">INV-{inv.id.substring(0, 6)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            inv.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                            inv.status === 'PENDING' ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' :
                            inv.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {inv.status === 'COMPLETED' ? 'Completado' : 
                             inv.status === 'PENDING' ? 'Pendiente' : 
                             inv.status === 'IN_PROGRESS' ? 'En Progreso' : 'Requiere Atención'}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">{inv.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{inv.details}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex sm:flex-col gap-2">
                      <button className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                        Ver Detalles
                      </button>
                      {role === 'ANALISTA_MESA_CONTROL' && inv.status === 'PENDING' && (
                        <button className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                          Asignar Recurso
                        </button>
                      )}
                      {role === 'GERENTE_DIRECTIVO' && inv.status === 'COMPLETED' && (
                        <button className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
                          Aprobar Dictamen
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'pendientes-agent' && (
        <PendientesAgentPanel
          investigations={investigations}
          contextLabel="Crédito y mesa: atiende primero lo marcado como urgente y los pendientes más antiguos."
        />
      )}

      {activeTab === 'flows' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Verificación de Flujos</h2>
          <p className="text-slate-600 dark:text-slate-300">Monitorea el estado de las validaciones de identidad, buró de crédito y referencias.</p>
        </div>
      )}

      {activeTab === 'rules' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Reglas de Crédito</h2>
          <p className="text-slate-600 dark:text-slate-300">Ajusta los parámetros del motor de análisis de crédito financiero.</p>
        </div>
      )}

      {activeTab === 'clients' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Cartera de Clientes</h2>
          <p className="text-slate-600 dark:text-slate-300">Gestión de clientes y su historial crediticio.</p>
        </div>
      )}

      {activeTab === 'validation' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Validación de Créditos (Originación)</h2>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center">
            <ShieldCheck className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Módulo de Validación</h3>
            <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-6">
              Aquí podrás validar los créditos originados, revisar la documentación y aprobar o rechazar las solicitudes basándote en el análisis de riesgo.
            </p>
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Iniciar Validación Manual
            </button>
          </div>
        </div>
      )}

      {activeTab === 'ia-config' && (
        <IAConfigPanel />
      )}

      {FEATURE_WORKSPACE_CHAT_TICKETS && activeTab === 'chat' && user && role && (
        <LoongWorkspaceChatTab
          organizationId={organizationId}
          userUid={user.uid}
          userEmail={user.email ?? null}
          role={role}
        />
      )}

      {FEATURE_WORKSPACE_CHAT_TICKETS && activeTab === 'tickets' && user && role && (
        <LoongSupportTicketsTab organizationId={organizationId} userUid={user.uid} role={role} />
      )}
    </DashboardLayout>
  );
};
