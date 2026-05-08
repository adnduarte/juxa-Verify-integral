import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Upload, Play, CheckCircle2, Search, Clock, Briefcase, Bot } from 'lucide-react';
import { SocioEconomicValidationView } from '../SocioEconomicValidationView';
import { useAuthStatus } from '../../contexts/AuthContext';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';
import { db } from '../../firebase';
import { collection, onSnapshot, orderBy, query } from '@/lib/localFirestore';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';

/** Cola global de expedientes pendientes de trabajo de campo / dictamen (MVP: sin assignedInvestigatorUid en Firestore). */
const QUEUE_STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'REQUIRES_ATTENTION']);

type Inv = {
  id: string;
  title?: string;
  status?: string;
  candidateName?: string;
  createdAt?: string;
  clientProfile?: string;
};

export const InvestigatorDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('workspace');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const { user, logUserAction } = useAuthStatus();

  const [investigations, setInvestigations] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db as never, 'investigations'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Inv);
        setInvestigations(all.slice(0, 80));
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const queue = useMemo(
    () => investigations.filter((i) => i.status && QUEUE_STATUSES.has(i.status)),
    [investigations]
  );

  const selected = useMemo(() => investigations.find((i) => i.id === selectedId) || null, [investigations, selectedId]);

  useEffect(() => {
    if (!selectedId && queue.length > 0) setSelectedId(queue[0].id);
  }, [queue, selectedId]);

  const handleUpload = () => {
    setIsUploading(true);
    if (logUserAction && user) {
      logUserAction(user.uid, 'INVESTIGATOR_UPLOAD_DOCUMENT', { investigationId: selectedId });
    }
    setTimeout(() => setIsUploading(false), 1500);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    if (logUserAction && user) {
      logUserAction(user.uid, 'INVESTIGATOR_ANALYZE_DOCUMENT', { investigationId: selectedId });
    }
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisComplete(true);
    }, 2000);
  };

  const sidebarItems = [
    { id: 'workspace', label: 'Espacio de Trabajo', icon: Briefcase },
    { id: 'reports', label: 'Mis Reportes', icon: FileText },
    { id: 'history', label: 'Historial', icon: Clock },
    { id: 'ia-config', label: 'Configuración IA', icon: Bot },
  ];

  return (
    <div className="p-4 sm:p-8 h-full min-h-0">
      <DashboardLayout
        title="Panel de Investigador"
        subtitle="Análisis de evidencia y generación de dictámenes"
        sidebarItems={sidebarItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {activeTab === 'workspace' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-3">
              <h2 className="text-lg font-bold text-slate-900">Cola de trabajo</h2>
              <p className="text-xs text-slate-500">
                Expedientes en PENDING, IN_PROGRESS o REQUIRES_ATTENTION (vista global MVP).
              </p>
              {loading ? (
                <JuxaVerifyLoader text="Cargando expedientes…" />
              ) : queue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                  No hay expedientes en cola. Revisa el listado completo en Historial o espera nuevas asignaciones.
                </div>
              ) : (
                queue.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(inv.id);
                      setAnalysisComplete(false);
                    }}
                    className={`w-full text-left bg-white p-4 rounded-2xl border shadow-sm transition-colors ${
                      selectedId === inv.id ? 'border-blue-600 ring-1 ring-blue-100' : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <span className="text-xs font-mono text-slate-500 truncate">{inv.id.slice(0, 14)}…</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          inv.status === 'REQUIRES_ATTENTION' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">{inv.candidateName || inv.title || 'Sin título'}</h3>
                    <p className="text-xs text-slate-500 mt-1">{inv.clientProfile || '—'}</p>
                    <div className="flex items-center text-xs text-slate-400 mt-2">
                      <Clock className="w-3 h-3 mr-1" />
                      {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'}
                    </div>
                  </button>
                ))
              )}

              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Todos los expedientes recientes</h3>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {investigations.slice(0, 15).map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(inv.id);
                        setAnalysisComplete(false);
                      }}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded-lg truncate ${
                        selectedId === inv.id ? 'bg-slate-200' : 'hover:bg-slate-100'
                      }`}
                    >
                      {inv.candidateName || inv.title || inv.id}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[420px]">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 truncate">
                      {selected ? `Expediente: ${selected.candidateName || selected.title || selected.id}` : 'Selecciona un expediente'}
                    </h2>
                    <p className="text-sm text-slate-500 font-mono truncate">{selected?.id ?? '—'}</p>
                  </div>
                </div>

                <div className="p-6">
                  {!selected ? (
                    <p className="text-sm text-slate-600">Elige un expediente en la columna izquierda para trabajar.</p>
                  ) : (
                    <>
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center mb-6 hover:bg-slate-50 transition-colors">
                        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-sm font-medium text-slate-900 mb-1">Carga de evidencia</h3>
                        <p className="text-xs text-slate-500 mb-4">PDF, JPG, PNG (integración con almacenamiento en producción)</p>
                        <button
                          type="button"
                          onClick={handleUpload}
                          disabled={isUploading}
                          className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          {isUploading ? 'Cargando…' : 'Seleccionar archivos'}
                        </button>
                      </div>

                      <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                            <Search className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-bold text-slate-900 mb-1">Motor de validación IA</h3>
                            <p className="text-sm text-slate-600 mb-4">
                              Ejecuta análisis asistido sobre la evidencia cargada para este expediente.
                            </p>
                            <button
                              type="button"
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
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                  Analizando…
                                </>
                              ) : analysisComplete ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Análisis completado
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-2" />
                                  Ejecutar análisis
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {analysisComplete && (
                        <div className="mt-6">
                          <SocioEconomicValidationView
                            caseId={selected.id}
                            onAuthorize={() => alert('Reporte registrado (demo).')}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Mis reportes</h2>
            {loading ? (
              <JuxaVerifyLoader text="Cargando…" />
            ) : (
              <div className="grid gap-3">
                {investigations
                  .filter((i) => i.status === 'COMPLETED')
                  .slice(0, 30)
                  .map((inv) => (
                    <div key={inv.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-medium text-slate-900">{inv.candidateName || inv.title}</p>
                        <p className="text-xs font-mono text-slate-500">{inv.id}</p>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg h-fit">
                        COMPLETED
                      </span>
                    </div>
                  ))}
                {investigations.filter((i) => i.status === 'COMPLETED').length === 0 && (
                  <p className="text-sm text-slate-600">No hay expedientes completados aún.</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Historial reciente</h2>
            <p className="text-sm text-slate-600 mb-4">Últimos expedientes visibles en Firestore (máx. 80).</p>
            {loading ? (
              <JuxaVerifyLoader text="Cargando…" />
            ) : (
              <ul className="space-y-2">
                {investigations.map((inv) => (
                  <li key={inv.id} className="text-sm border border-slate-100 rounded-lg px-3 py-2 flex justify-between gap-2">
                    <span className="font-mono text-xs text-slate-500">{inv.id.slice(0, 10)}…</span>
                    <span className="text-slate-800 truncate">{inv.candidateName || inv.title}</span>
                    <span className="text-xs text-slate-500 shrink-0">{inv.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'ia-config' && <IAConfigPanel />}
      </DashboardLayout>
    </div>
  );
};
