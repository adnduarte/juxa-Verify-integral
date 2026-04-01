import React, { useState, useMemo, useEffect } from 'react';
import { Building2, FileText, TrendingUp, Settings, Plus, AlertTriangle, Bot, MessageCircle, LifeBuoy } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';
import { LoongWorkspaceChatTab } from '../loong/LoongWorkspaceChatTab';
import { LoongSupportTicketsTab } from '../loong/LoongSupportTicketsTab';
import { useAuthStatus } from '../../contexts/AuthContext';
import { FEATURE_WORKSPACE_CHAT_TICKETS } from '../../config/features';

export const SmeDashboard: React.FC = () => {
  const { organizationId, user, role } = useAuthStatus();
  const [activeTab, setActiveTab] = useState('applications');

  const sidebarItems = useMemo(() => {
    const all = [
      { id: 'applications', label: 'Solicitudes de Crédito', icon: Building2 },
      { id: 'analysis', label: 'Análisis de Riesgo', icon: TrendingUp },
      { id: 'documents', label: 'Documentación', icon: FileText },
      { id: 'rules', label: 'Reglas de Crédito', icon: Settings },
      { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
      { id: 'chat', label: 'Chat', icon: MessageCircle },
      { id: 'tickets', label: 'Soporte / tickets', icon: LifeBuoy },
      { id: 'ia-config', label: 'Configuración IA', icon: Bot },
    ];
    if (FEATURE_WORKSPACE_CHAT_TICKETS) return all;
    return all.filter((i) => i.id !== 'chat' && i.id !== 'tickets');
  }, []);

  useEffect(() => {
    if (!FEATURE_WORKSPACE_CHAT_TICKETS && (activeTab === 'chat' || activeTab === 'tickets')) {
      setActiveTab('applications');
    }
  }, [activeTab]);

  return (
    <DashboardLayout
      title="Créditos Pyme"
      subtitle="Gestión y análisis de solicitudes"
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={
        <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Nueva Solicitud
        </button>
      }
    >
      {activeTab === 'applications' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Solicitudes Activas</h2>
          <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-400 dark:text-slate-500" />
            <p>No hay solicitudes pendientes de revisión.</p>
          </div>
        </div>
      )}
      
      {activeTab === 'analysis' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Análisis de Riesgo</h2>
          <p className="text-slate-600 dark:text-slate-300">Revisa el score crediticio y la viabilidad de las empresas.</p>
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Documentación</h2>
          <p className="text-slate-600 dark:text-slate-300">Archivos adjuntos, actas constitutivas, estados financieros.</p>
        </div>
      )}

      {activeTab === 'rules' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Motor de Reglas (Pyme)</h2>
          <p className="text-slate-600 dark:text-slate-300">Configura los parámetros de aprobación (ej. ingresos mínimos, tiempo de operación).</p>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Alertas</h2>
          <p className="text-slate-600 dark:text-slate-300">Notificaciones sobre empresas con alto riesgo o documentos faltantes.</p>
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
