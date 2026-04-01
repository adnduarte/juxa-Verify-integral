import React, { useState, useMemo, useEffect } from 'react';
import { FileText, Upload, Play, CheckCircle2, AlertCircle, Search, Clock, Briefcase, Building2, RefreshCw, Bot, MessageCircle, LifeBuoy } from 'lucide-react';
import { SocioEconomicValidationView } from '../SocioEconomicValidationView';
import { useAuthStatus } from '../../contexts/AuthContext';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';
import { LoongWorkspaceChatTab } from '../loong/LoongWorkspaceChatTab';
import { LoongSupportTicketsTab } from '../loong/LoongSupportTicketsTab';
import { FEATURE_WORKSPACE_CHAT_TICKETS } from '../../config/features';

export const InvestigatorDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('workspace');

  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const { user, logUserAction, organizationId, role } = useAuthStatus();

  const handleUpload = () => {
    setIsUploading(true);
    if (logUserAction && user) {
      logUserAction(user.uid, 'INVESTIGATOR_UPLOAD_DOCUMENT', { orderId: '123' });
    }
    setTimeout(() => setIsUploading(false), 1500);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    
    if (logUserAction && user) {
      logUserAction(user.uid, 'INVESTIGATOR_ANALYZE_DOCUMENT', { orderId: '123' });
    }

    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisComplete(true);
    }, 3000);
  };

  const sidebarItems = useMemo(() => {
    const all = [
      { id: 'workspace', label: 'Espacio de Trabajo', icon: Briefcase },
      { id: 'reports', label: 'Mis Reportes', icon: FileText },
      { id: 'history', label: 'Historial', icon: Clock },
      { id: 'chat', label: 'Chat', icon: MessageCircle },
      { id: 'tickets', label: 'Soporte / tickets', icon: LifeBuoy },
      { id: 'ia-config', label: 'Configuración IA', icon: Bot },
    ];
    if (FEATURE_WORKSPACE_CHAT_TICKETS) return all;
    return all.filter((i) => i.id !== 'chat' && i.id !== 'tickets');
  }, []);

  useEffect(() => {
    if (!FEATURE_WORKSPACE_CHAT_TICKETS && (activeTab === 'chat' || activeTab === 'tickets')) {
      setActiveTab('workspace');
    }
  }, [activeTab]);

  return (
    <div className="p-4 sm:p-8 h-full">
      <DashboardLayout
        title="Panel de Investigador"
        subtitle="Análisis de evidencia y generación de dictámenes"
        sidebarItems={sidebarItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {activeTab === 'workspace' && (
          <div className="grid lg:grid-cols-3 gap-6 h-full">
            {/* Left Column: Orders */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Mis Reportes en Progreso</h2>
              
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border-2 border-blue-600 shadow-sm cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">ORD-2026-089</span>
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Estudio Socioeconómico</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Candidato: Juan Pérez</p>
                <div className="flex items-center text-xs text-slate-400 dark:text-slate-500">
                  <Clock className="w-3 h-3 mr-1" /> Vence en 2 días
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-blue-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ORD-2026-090</span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Verificación de Crédito</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Empresa: Tech Solutions SA</p>
                <div className="flex items-center text-xs text-slate-400 dark:text-slate-500">
                  <Clock className="w-3 h-3 mr-1" /> Vence en 5 días
                </div>
              </div>
            </div>

            {/* Right Column: Active Workspace */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-full">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Espacio de Trabajo: ORD-2026-089</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Carga de Evidencia y Análisis IA</p>
                  </div>
                </div>
                
                <div className="p-6">
                  {/* Upload Area */}
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center mb-6 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                    <Upload className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                    <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Arrastra documentos o imágenes aquí</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">PDF, JPG, PNG (Max 10MB)</p>
                    <button 
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      {isUploading ? 'Cargando...' : 'Seleccionar Archivos'}
                    </button>
                  </div>

                  {/* AI Trigger */}
                  <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Search className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Motor de Validación IA</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                          Ejecuta el análisis automatizado sobre las evidencias cargadas para extraer datos, verificar similitud de imágenes y generar conclusiones preliminares.
                        </p>
                        <button
                          onClick={handleAnalyze}
                          disabled={isAnalyzing || analysisComplete}
                          className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
                            analysisComplete 
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isAnalyzing ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Analizando Evidencias...
                            </>
                          ) : analysisComplete ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Análisis Completado
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Ejecutar Análisis Socioeconómico IA
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* AI Results Mock */}
                  {analysisComplete && (
                    <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <SocioEconomicValidationView 
                        caseId="ORD-2026-089" 
                        onAuthorize={() => alert('Reporte autorizado y generado con éxito.')} 
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Mis Reportes</h2>
            <p className="text-slate-600 dark:text-slate-300">Historial de reportes generados y en proceso.</p>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Historial de Actividad</h2>
            <p className="text-slate-600 dark:text-slate-300">Registro de todas las acciones realizadas en la plataforma.</p>
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
    </div>
  );
};
