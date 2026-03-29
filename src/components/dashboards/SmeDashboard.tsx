import React, { useState } from 'react';
import { Building2, FileText, TrendingUp, Settings, Plus, AlertTriangle, Bot } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';

export const SmeDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('applications');

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
          <h2 className="text-xl font-bold text-slate-900 mb-4">Solicitudes Activas</h2>
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-slate-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p>No hay solicitudes pendientes de revisión.</p>
          </div>
        </div>
      )}
      
      {activeTab === 'analysis' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Análisis de Riesgo</h2>
          <p className="text-slate-600">Revisa el score crediticio y la viabilidad de las empresas.</p>
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Documentación</h2>
          <p className="text-slate-600">Archivos adjuntos, actas constitutivas, estados financieros.</p>
        </div>
      )}

      {activeTab === 'rules' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Motor de Reglas (Pyme)</h2>
          <p className="text-slate-600">Configura los parámetros de aprobación (ej. ingresos mínimos, tiempo de operación).</p>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Alertas</h2>
          <p className="text-slate-600">Notificaciones sobre empresas con alto riesgo o documentos faltantes.</p>
        </div>
      )}

      {activeTab === 'ia-config' && (
        <IAConfigPanel />
      )}
    </DashboardLayout>
  );
};
