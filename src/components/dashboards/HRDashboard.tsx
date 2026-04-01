import React, { useState, useEffect, useMemo } from 'react';
import { Users, FileText, CheckCircle2, AlertCircle, Briefcase, Plus, Bot, Search, Eye, Brain, Clock, MessageCircle, LifeBuoy } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';
import { AIResultRenderer } from '../AIResultRenderer';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import { PendientesAgentPanel } from './PendientesAgentPanel';
import { LoongWorkspaceChatTab } from '../loong/LoongWorkspaceChatTab';
import { LoongSupportTicketsTab } from '../loong/LoongSupportTicketsTab';
import { FEATURE_WORKSPACE_CHAT_TICKETS } from '../../config/features';

export const HRDashboard: React.FC = () => {
  const { role, organizationId, user } = useAuthStatus();
  const [activeTab, setActiveTab] = useState('candidates');
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!auth.currentUser || !role) return;

    // Internal roles can see all investigations with HR profile
    const isInternal = ['ADMIN', 'SUPERVISOR', 'EJECUTIVO_VENTAS', 'ANALISTA_MESA_CONTROL', 'GERENTE_DIRECTIVO', 'ANALISTA_CREDITO', 'INVESTIGADOR_SOCIAL', 'REVISOR_RRHH', 'INVESTIGADOR'].includes(role);

    let q;
    if (isInternal) {
      q = query(
        collection(db, 'investigations'),
        where('clientProfile', '==', 'HR'),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'investigations'),
        where('clientId', '==', auth.currentUser.uid),
        where('clientProfile', '==', 'HR'),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvestigations(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching HR investigations:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredInvestigations = investigations.filter(inv => 
    inv.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sidebarItems = useMemo(() => {
    const all = [
      { id: 'candidates', label: 'Candidatos', icon: Users },
      { id: 'reports', label: 'Reportes y Dictámenes', icon: FileText },
      { id: 'rules', label: 'Reglas de Contratación', icon: CheckCircle2 },
      { id: 'alerts', label: 'Alertas de Riesgo', icon: AlertCircle },
      { id: 'chat', label: 'Chat', icon: MessageCircle },
      { id: 'tickets', label: 'Soporte / tickets', icon: LifeBuoy },
      { id: 'ia-config', label: 'Configuración IA', icon: Bot },
    ];
    if (FEATURE_WORKSPACE_CHAT_TICKETS) return all;
    return all.filter((i) => i.id !== 'chat' && i.id !== 'tickets');
  }, []);

  useEffect(() => {
    if (!FEATURE_WORKSPACE_CHAT_TICKETS && (activeTab === 'chat' || activeTab === 'tickets')) {
      setActiveTab('candidates');
    }
  }, [activeTab]);

  return (
    <DashboardLayout
      title="Recursos Humanos"
      subtitle="Gestión de candidatos y validaciones"
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={
        <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Nuevo Candidato
        </button>
      }
    >
      {activeTab === 'candidates' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Candidatos en Proceso</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Buscar candidato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredInvestigations.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredInvestigations.map((inv) => (
                <div key={inv.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{inv.candidateName}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center mt-1">
                        <Briefcase className="w-3 h-3 mr-1" />
                        {inv.jobProfile?.vacancy || 'Puesto no especificado'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      inv.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                      inv.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}>
                      {inv.status === 'COMPLETED' ? 'Completado' : 
                       inv.status === 'IN_PROGRESS' ? 'En Proceso' : 'Pendiente'}
                    </span>
                  </div>

                  {/* AI Results */}
                  {(inv.identityValidationResult || inv.creditAnalysisResult || inv.providerAnalysisResult || inv.socioeconomicDictamen) && (
                    <div className="mb-4">
                      <strong className="block mb-2 text-blue-800 flex items-center text-sm">
                        <Brain className="w-4 h-4 mr-2" />
                        Dictamen de IA (Arraigo y Estabilidad):
                      </strong>
                      <AIResultRenderer resultString={inv.identityValidationResult || inv.creditAnalysisResult || inv.providerAnalysisResult || inv.socioeconomicDictamen} />
                    </div>
                  )}

                  {/* Traceability Evidence */}
                  {inv.candidateData && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                      <strong className="block mb-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center">
                        <FileText className="w-3 h-3 mr-1" />
                        Evidencia de Trazabilidad:
                      </strong>
                      <div className="flex flex-wrap gap-3">
                        {(() => {
                          try {
                            const cData = typeof inv.candidateData === 'string' ? JSON.parse(inv.candidateData) : inv.candidateData;
                            const urls = [
                              { label: 'INE Front', url: cData.idFrontUrl },
                              { label: 'INE Back', url: cData.idBackUrl },
                              { label: 'Comprobante', url: cData.proofOfAddressUrl },
                              { label: 'Selfie', url: cData.selfieUrl },
                              { label: 'Fachada', url: cData.fotoFachadaUrl }
                            ].filter(item => item.url);

                            return urls.map((item, idx) => (
                              <a 
                                key={idx} 
                                href={item.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white hover:border-blue-400 hover:text-blue-600 transition-all"
                              >
                                <Eye className="w-3 h-3" />
                                {item.label}
                              </a>
                            ));
                          } catch (e) {
                            return <span className="text-xs text-slate-400 dark:text-slate-500 italic">Error al procesar evidencia</span>;
                          }
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-50">
                    <div className="flex items-center text-xs text-slate-400 dark:text-slate-500">
                      <Clock className="w-3 h-3 mr-1" />
                      Actualizado: {new Date(inv.updatedAt || inv.createdAt).toLocaleString()}
                    </div>
                    <button className="text-blue-600 text-sm font-bold hover:underline">
                      Ver Detalles Completos
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-950 p-12 rounded-3xl border border-dashed border-slate-300 dark:border-slate-600 text-center text-slate-500 dark:text-slate-400">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">No se encontraron candidatos</p>
              <p className="text-sm">Comienza creando una nueva investigación.</p>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'pendientes-agent' && (
        <PendientesAgentPanel
          investigations={investigations}
          contextLabel="RR.HH.: cola de candidatos activos (pendientes, en proceso y que requieren atención)."
        />
      )}

      {activeTab === 'reports' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Reportes y Dictámenes</h2>
          <p className="text-slate-600 dark:text-slate-300">Historial de validaciones y estudios socioeconómicos finalizados.</p>
        </div>
      )}

      {activeTab === 'rules' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Motor de Reglas (RRHH)</h2>
          <p className="text-slate-600 dark:text-slate-300">Configura los parámetros de validación para tus candidatos (ej. antecedentes, referencias).</p>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Alertas de Riesgo</h2>
          <p className="text-slate-600 dark:text-slate-300">Notificaciones sobre candidatos que no cumplen con los perfiles establecidos.</p>
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
