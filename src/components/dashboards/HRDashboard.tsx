import React, { useState, useEffect } from 'react';
import {
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Plus,
  Bot,
  Search,
  Eye,
  Brain,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';
import { AIResultRenderer } from '../AIResultRenderer';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/localFirestore';
import { db, auth } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import { HRMexicoWorkflowStrip } from './HRMexicoWorkflowStrip';
import { IdentityAntiUsurpationPanel } from '../IdentityAntiUsurpationPanel';

type Variant = 'full' | 'embedded';

const sidebarItems: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'candidates', label: 'Candidatos', icon: Users },
  { id: 'reports', label: 'Reportes y Dictámenes', icon: FileText },
  { id: 'rules', label: 'Reglas de Contratación', icon: CheckCircle2 },
  { id: 'alerts', label: 'Alertas de Riesgo', icon: AlertCircle },
  { id: 'ia-config', label: 'Configuración IA', icon: Bot },
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
                ? 'bg-indigo-700 text-white border-indigo-700 shadow-sm'
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

export const HRDashboard: React.FC<{ variant?: Variant }> = ({ variant = 'full' }) => {
  const { role } = useAuthStatus();
  const [activeTab, setActiveTab] = useState('candidates');
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!auth.currentUser || !role) return;

    const isInternal = [
      'ADMIN',
      'EJECUTIVO_VENTAS',
      'ANALISTA_MESA_CONTROL',
      'GERENTE_DIRECTIVO',
      'ANALISTA_CREDITO',
      'INVESTIGADOR_SOCIAL',
      'REVISOR_RRHH',
      'INVESTIGADOR',
    ].includes(role);

    let q;
    if (isInternal) {
      q = query(collection(db, 'investigations'), where('clientProfile', '==', 'HR'), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, 'investigations'),
        where('clientId', '==', auth.currentUser.uid),
        where('clientProfile', '==', 'HR'),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setInvestigations(docs);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching HR investigations:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [role]);

  const filteredInvestigations = investigations.filter(
    (inv) =>
      inv.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const newCandidateButton = (
    <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
      <Plus className="w-4 h-4" />
      Nuevo Candidato
    </button>
  );

  const tabBody = (
    <>
      {activeTab === 'candidates' && (
        <div className="space-y-6">
          <HRMexicoWorkflowStrip activeStage="VALIDATION" />
          <IdentityAntiUsurpationPanel
            compact
            caseSummary={`Resumen expedientes HR activos: ${investigations.length} candidatos. Filtro búsqueda: ${searchTerm || '(vacío)'}. Políticas IMSS/referencias según configuración tenant.`}
          />
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900">Candidatos en Proceso</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar candidato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                <div
                  key={inv.id}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{inv.candidateName}</h3>
                      <p className="text-sm text-slate-500 flex items-center mt-1">
                        <Briefcase className="w-3 h-3 mr-1" />
                        {inv.jobProfile?.vacancy || 'Puesto no especificado'}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        inv.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : inv.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {inv.status === 'COMPLETED' ? 'Completado' : inv.status === 'IN_PROGRESS' ? 'En Proceso' : 'Pendiente'}
                    </span>
                  </div>

                  {(inv.identityValidationResult ||
                    inv.creditAnalysisResult ||
                    inv.providerAnalysisResult ||
                    inv.socioeconomicDictamen) && (
                    <div className="mb-4">
                      <strong className="block mb-2 text-blue-800 flex items-center text-sm">
                        <Brain className="w-4 h-4 mr-2" />
                        Dictamen de IA (Arraigo y Estabilidad):
                      </strong>
                      <AIResultRenderer
                        resultString={
                          inv.identityValidationResult ||
                          inv.creditAnalysisResult ||
                          inv.providerAnalysisResult ||
                          inv.socioeconomicDictamen
                        }
                      />
                    </div>
                  )}

                  {inv.candidateData && (
                    <div className="border-t border-slate-100 pt-4 mt-4">
                      <strong className="block mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                        <FileText className="w-3 h-3 mr-1" />
                        Evidencia de Trazabilidad:
                      </strong>
                      <div className="flex flex-wrap gap-3">
                        {(() => {
                          try {
                            const cData =
                              typeof inv.candidateData === 'string' ? JSON.parse(inv.candidateData) : inv.candidateData;
                            const urls = [
                              { label: 'INE Front', url: cData.idFrontUrl },
                              { label: 'INE Back', url: cData.idBackUrl },
                              { label: 'Comprobante', url: cData.proofOfAddressUrl },
                              { label: 'Selfie', url: cData.selfieUrl },
                              { label: 'Fachada', url: cData.fotoFachadaUrl },
                            ].filter((item) => item.url);

                            return urls.map((item, idx) => (
                              <a
                                key={idx}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-white hover:border-blue-400 hover:text-blue-600 transition-all"
                              >
                                <Eye className="w-3 h-3" />
                                {item.label}
                              </a>
                            ));
                          } catch {
                            return <span className="text-xs text-slate-400 italic">Error al procesar evidencia</span>;
                          }
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-50">
                    <div className="flex items-center text-xs text-slate-400">
                      <Clock className="w-3 h-3 mr-1" />
                      Actualizado: {new Date(inv.updatedAt || inv.createdAt).toLocaleString()}
                    </div>
                    <button className="text-blue-600 text-sm font-bold hover:underline">Ver Detalles Completos</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 p-12 rounded-3xl border border-dashed border-slate-300 text-center text-slate-500">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">No se encontraron candidatos</p>
              <p className="text-sm">Comienza creando una nueva investigación.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Reportes y Dictámenes</h2>
          <p className="text-slate-600">Historial de validaciones y estudios socioeconómicos finalizados.</p>
        </div>
      )}

      {activeTab === 'rules' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Motor de Reglas (RRHH)</h2>
          <p className="text-slate-600">
            Configura los parámetros de validación para tus candidatos (ej. antecedentes, referencias).
          </p>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Alertas de Riesgo</h2>
          <p className="text-slate-600">Notificaciones sobre candidatos que no cumplen con los perfiles establecidos.</p>
        </div>
      )}

      {activeTab === 'ia-config' && <IAConfigPanel />}
    </>
  );

  if (variant === 'embedded') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
        <div className="mb-4">{newCandidateButton}</div>
        <EmbeddedSubNav items={sidebarItems} activeTab={activeTab} onTabChange={setActiveTab} />
        {tabBody}
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Recursos Humanos"
      subtitle="Gestión de candidatos y validaciones"
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={newCandidateButton}
    >
      {tabBody}
    </DashboardLayout>
  );
};
