import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  FileText,
  Settings,
  Zap,
  CheckCircle2,
  FileSignature,
  Plus,
  ArrowRight,
  SkipForward,
  Bot,
  Search,
  AlertCircle,
  PenLine,
} from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';
import { DigidSignatureCard } from '../DigidSignatureCard';
import { useAuthStatus } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { db, auth } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from '@/lib/localFirestore';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';

type Inv = {
  id: string;
  title?: string;
  status?: string;
  clientProfile?: string;
  investigationType?: string;
  createdAt?: string;
  candidateName?: string;
  candidateLink?: string;
};

type SigReq = {
  id: string;
  organizationId?: string;
  contextType?: string;
  contextId?: string;
  status?: string;
  createdAt?: string;
  digidEnvelopeId?: string;
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
      return 'Requiere atención';
    default:
      return s || '—';
  }
}

export const IntegralDashboard: React.FC = () => {
  const { user, organizationId } = useAuthStatus();
  const { branding, hasProduct } = useTenant();
  const primary = branding.primaryColor?.trim() || '#2563eb';

  const [activeTab, setActiveTab] = useState('origination');
  const [currentStep, setCurrentStep] = useState(1);
  const [investigations, setInvestigations] = useState<Inv[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [sigRequests, setSigRequests] = useState<SigReq[]>([]);
  const [rulesText, setRulesText] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(true);

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
        setLoadingInv(false);
      },
      (err) => {
        console.error(err);
        setLoadingInv(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const org = organizationId || 'default';
    const q = query(collection(db as never, 'signature_requests'), where('organizationId', '==', org));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SigReq);
        rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setSigRequests(rows);
      },
      () => setSigRequests([])
    );
    return () => unsub();
  }, [organizationId]);

  useEffect(() => {
    if (!auth.currentUser) return;
    (async () => {
      setRulesLoading(true);
      try {
        const snap = await getDoc(doc(db as never, 'clients', auth.currentUser.uid));
        if (snap.exists()) {
          const d = snap.data() as { politicasGenerales?: string };
          setRulesText(d.politicasGenerales?.trim() || null);
        } else {
          setRulesText(null);
        }
      } catch {
        setRulesText(null);
      } finally {
        setRulesLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const list = investigations;
    const by = (s: string) => list.filter((i) => i.status === s).length;
    return {
      total: list.length,
      completed: by('COMPLETED'),
      inProgress: by('IN_PROGRESS') + by('PENDING'),
      attention: by('REQUIRES_ATTENTION'),
    };
  }, [investigations]);

  const completedForPagare = useMemo(
    () => investigations.filter((i) => i.status === 'COMPLETED'),
    [investigations]
  );

  const sigByContextId = useMemo(() => {
    const m = new Map<string, SigReq>();
    sigRequests.forEach((s) => {
      if (s.contextType === 'investigation' && s.contextId) m.set(s.contextId, s);
    });
    return m;
  }, [sigRequests]);

  const investigationsForSignature = useMemo(() => {
    return investigations.filter((inv) => {
      const sig = sigByContextId.get(inv.id);
      return !sig || (sig.status && !['COMPLETED', 'MOCK'].includes(String(sig.status)));
    });
  }, [investigations, sigByContextId]);

  const handleNextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleSkipValidation = () => {
    setCurrentStep(3);
  };

  const sidebarItems = [
    { id: 'origination', label: 'Originación de Crédito', icon: Zap },
    { id: 'investigations', label: 'Investigaciones', icon: Search },
    { id: 'analysis', label: 'Motor de Análisis', icon: ShieldCheck },
    { id: 'validation', label: 'Validación Electrónica', icon: CheckCircle2 },
    { id: 'pagare', label: 'Originación de Pagaré', icon: FileSignature },
    { id: 'rules', label: 'Reglas Adaptables', icon: Settings },
    { id: 'ia-config', label: 'Configuración IA', icon: Bot },
  ];

  return (
    <DashboardLayout
      title="Servicio Integral"
      subtitle="Flujo completo de originación y validación"
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={
        <button
          type="button"
          onClick={() => {
            setActiveTab('origination');
            setCurrentStep(1);
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          style={{ backgroundColor: primary }}
        >
          <Plus className="w-4 h-4" />
          Nueva originación
        </button>
      }
    >
      {activeTab === 'origination' && (
        <div>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h2 className="text-xl font-bold text-slate-900">Originación de crédito</h2>
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-slate-100 text-slate-700">
              Servicio integral
            </span>
          </div>

          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 z-0 rounded-full" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 z-0 transition-all duration-500 rounded-full"
              style={{ width: `${(currentStep - 1) * 50}%`, backgroundColor: primary }}
            />
            {[
              { step: 1, label: 'Resumen', icon: ShieldCheck },
              { step: 2, label: 'Validación', icon: CheckCircle2 },
              { step: 3, label: 'Pagaré', icon: FileSignature },
            ].map((s) => (
              <div key={s.step} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    currentStep >= s.step ? 'border-transparent text-white' : 'bg-white border-slate-300 text-slate-400'
                  }`}
                  style={currentStep >= s.step ? { backgroundColor: primary } : undefined}
                >
                  <s.icon className="w-5 h-5" />
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${currentStep >= s.step ? '' : 'text-slate-500'}`}
                  style={currentStep >= s.step ? { color: primary } : undefined}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            {currentStep === 1 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Resumen operativo</h3>
                    <p className="text-sm text-slate-600">Datos en vivo desde tus investigaciones en Firestore.</p>
                  </div>
                </div>

                {loadingInv ? (
                  <div className="py-12 flex justify-center">
                    <JuxaVerifyLoader text="Cargando datos…" />
                  </div>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-3 gap-3 mb-6">
                      <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Total expedientes</span>
                        <span className="text-xl font-bold text-slate-900">{stats.total}</span>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Completados</span>
                        <span className="text-xl font-bold text-emerald-600">{stats.completed}</span>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">En curso / pendientes</span>
                        <span className="text-xl font-bold text-blue-600">{stats.inProgress}</span>
                      </div>
                    </div>
                    {stats.attention > 0 && (
                      <div className="mb-6 flex items-center gap-2 text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {stats.attention} expediente(s) requieren atención. Revísalos en <strong>Investigaciones</strong>.
                      </div>
                    )}
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('investigations')}
                        className="text-sm font-medium text-slate-600 hover:text-slate-900"
                      >
                        Ver tablero de investigaciones
                      </button>
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl font-medium"
                        style={{ backgroundColor: primary }}
                      >
                        Continuar al flujo
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Validación electrónica</h3>
                    <p className="text-sm text-slate-600">
                      Usa la pestaña <strong>Validación electrónica</strong> para firmas DIGID y seguimiento. Los pasos
                      siguientes son una guía; el detalle real está en cada pestaña.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-end mt-8">
                  <button
                    type="button"
                    onClick={() => setActiveTab('validation')}
                    className="flex items-center justify-center gap-2 px-6 py-2 border border-slate-200 text-slate-800 rounded-xl font-medium hover:bg-slate-50"
                  >
                    Ir a validación
                  </button>
                  <button onClick={handleSkipValidation} className="flex items-center justify-center gap-2 px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50">
                    <SkipForward className="w-4 h-4" />
                    Saltar este paso
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex items-center justify-center gap-2 px-6 py-2 text-white rounded-xl font-medium"
                    style={{ backgroundColor: primary }}
                  >
                    Siguiente
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                    <FileSignature className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Pagaré</h3>
                    <p className="text-sm text-slate-600">
                      Las originaciones de pagaré se gestionan cuando hay investigaciones completadas. Usa la pestaña
                      correspondiente.
                    </p>
                  </div>
                </div>
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl mb-6 text-center">
                  <FileSignature className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h4 className="font-medium text-slate-900 mb-1">Expedientes listos para revisión</h4>
                  <p className="text-sm text-slate-500 mb-4">{completedForPagare.length} investigación(es) completada(s)</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pagare')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium"
                    style={{ backgroundColor: primary }}
                  >
                    Ver originación de pagaré
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'investigations' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Panel de investigaciones</h2>
            <span className="text-xs text-slate-500">Actualización en tiempo real</span>
          </div>

          {loadingInv ? (
            <JuxaVerifyLoader text="Cargando investigaciones…" />
          ) : investigations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center text-slate-600">
              <Search className="w-10 h-10 mx-auto mb-3 text-slate-400" />
              <p className="font-medium text-slate-800">Aún no hay investigaciones</p>
              <p className="text-sm mt-1">Crea una desde el flujo de cliente o desde administración.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {investigations.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4 flex-wrap hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`p-3 rounded-xl shrink-0 ${
                        inv.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-600'
                          : inv.status === 'IN_PROGRESS'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-slate-50 text-slate-500'
                      }`}
                    >
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 truncate">
                          {inv.candidateName || inv.title || 'Sin título'}
                        </h3>
                        <span className="text-[10px] font-mono text-slate-400">{inv.id.slice(0, 12)}…</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {inv.investigationType || inv.clientProfile || '—'} ·{' '}
                        {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        inv.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : inv.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {statusLabel(inv.status)}
                    </span>
                    {inv.candidateLink && (
                      <a
                        href={`/candidate/${inv.candidateLink}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver enlace
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-slate-900 text-white rounded-xl">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">¿Listo para originar?</h3>
                <p className="text-sm text-slate-600 mb-4">Abre el asistente de originación para continuar el flujo.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('origination')}
                  className="px-4 py-2 text-white rounded-xl text-sm font-medium"
                  style={{ backgroundColor: primary }}
                >
                  Ir a originación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analysis' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Motor de análisis</h2>
          <p className="text-slate-600 mb-6 text-sm">Resumen derivado de tus expedientes en la plataforma.</p>
          {loadingInv ? (
            <JuxaVerifyLoader text="Cargando…" />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Completados</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.completed}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">En curso</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.inProgress}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Atención</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{stats.attention}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'validation' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Validación electrónica</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Solicitudes de firma DIGID y estado por expediente. Si no ves datos, activa el producto de firmas en{' '}
            <strong>Onboarding / tenants</strong> (superadmin).
          </p>

          {!hasProduct('digidSignatures') ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 mb-6">
              El producto <strong>digidSignatures</strong> no está activo para tu organización. Contacta al administrador
              para habilitarlo.
            </div>
          ) : null}

          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <PenLine className="w-4 h-4" />
              Solicitudes registradas
            </h3>
            {sigRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-slate-600 text-sm">
                No hay solicitudes de firma en esta organización. Inicia una desde un expediente abajo.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="p-3">Contexto</th>
                      <th className="p-3">ID</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sigRequests.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="p-3 font-mono text-xs">{r.contextType || '—'}</td>
                        <td className="p-3 font-mono text-xs">{r.contextId || '—'}</td>
                        <td className="p-3">{r.status || '—'}</td>
                        <td className="p-3 text-slate-500">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Iniciar o completar firma por expediente</h3>
            {investigationsForSignature.length === 0 ? (
              <p className="text-sm text-slate-600">No hay expedientes pendientes de firma en este momento.</p>
            ) : (
              <div className="space-y-6">
                {investigationsForSignature.map((inv) => (
                  <div key={inv.id} className="rounded-2xl border border-slate-200 p-4 bg-white">
                    <p className="text-sm font-medium text-slate-900 mb-2">
                      {inv.candidateName || inv.title || inv.id}
                    </p>
                    {hasProduct('digidSignatures') ? (
                      <DigidSignatureCard contextType="investigation" contextId={inv.id} title="Firma electrónica (DIGID)" />
                    ) : (
                      <p className="text-sm text-slate-500">Active el producto de firmas en el tenant para solicitar DIGID.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'pagare' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Originación de pagaré</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Expedientes con investigación completada. La generación de pagarés depende de su proceso interno; aquí
            visualiza el estado en plataforma.
          </p>
          {loadingInv ? (
            <JuxaVerifyLoader text="Cargando…" />
          ) : completedForPagare.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-600 text-sm">
              No hay investigaciones completadas aún. Cuando un expediente esté en estado completado, aparecerá aquí.
            </div>
          ) : (
            <ul className="space-y-3">
              {completedForPagare.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-4 flex-wrap rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <p className="font-medium text-slate-900">{inv.candidateName || inv.title}</p>
                    <p className="text-xs text-slate-500 font-mono">{inv.id}</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                    Listo para revisión operativa
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Reglas adaptables</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Texto de políticas configurado para tu cuenta en <code className="text-xs bg-slate-100 px-1 rounded">clients/{user?.uid?.slice(0, 8)}…</code>
          </p>
          {rulesLoading ? (
            <JuxaVerifyLoader text="Cargando reglas…" />
          ) : rulesText ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 prose prose-sm max-w-none text-slate-800 whitespace-pre-wrap">
              {rulesText}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-600 text-sm">
              No hay reglas de negocio cargadas en tu documento de cliente. Un administrador puede configurarlas en el
              panel administrativo.
            </div>
          )}
        </div>
      )}

      {activeTab === 'ia-config' && <IAConfigPanel />}
    </DashboardLayout>
  );
};
