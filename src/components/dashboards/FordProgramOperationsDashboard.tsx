import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  FileText,
  BarChart3,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Bot,
  Landmark,
  Shield,
  ClipboardList,
} from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, onSnapshot, query, orderBy, where, getDocs } from '@/lib/localFirestore';
import type { FordAgencyOnboardingRequestDoc } from '../../types/fordAgencyOnboarding';
import {
  approveFordAgencyProposal,
  FordAgencyOnboardingError,
  FORD_AGENCY_ONBOARDING_COLLECTION,
  rejectFordAgencyProposal,
  submitFordAgencyProposal,
} from '../../lib/fordAgencyOnboardingRequests';
import { useAuthStatus } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { DashboardLayout } from './DashboardLayout';
import { CreditApplicationsModule } from './CreditApplicationsModule';
import { FordOperationsChat } from './FordOperationsChat';
import { getCreditCrmCapabilities } from '../../lib/creditCrmCapabilities';
import { FordAuditPeriodPanel } from './FordAuditPeriodPanel';
import { BankingSecurityStandardsPanel } from '../platform/BankingSecurityStandardsPanel';
import { createFordAgencyOrganization, FORD_PROGRAM_ROOT_ORG_ID } from '../../lib/fordOrganizationProvisioning';
import { toast } from 'react-hot-toast';

function countBy<T extends string>(items: T[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const x of items) {
    const k = x || 'SIN_DEFINIR';
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

export const FordProgramOperationsDashboard: React.FC = () => {
  const { role, user } = useAuthStatus();
  const { organization } = useTenant();
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [agencyName, setAgencyName] = useState('');
  const [agencySlug, setAgencySlug] = useState('');
  const [agencySaving, setAgencySaving] = useState(false);
  const [onboardingRequests, setOnboardingRequests] = useState<(FordAgencyOnboardingRequestDoc & { id: string })[]>(
    []
  );
  const [proposalNote, setProposalNote] = useState('');
  const [proposalSaving, setProposalSaving] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [onboardingActionId, setOnboardingActionId] = useState<string | null>(null);

  const refreshAgencies = useCallback(async () => {
    const q = query(
      collection(db, 'organizations'),
      where('parentOrganizationId', '==', FORD_PROGRAM_ROOT_ORG_ID)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => {
      const data = d.data() as { name?: string };
      return { id: d.id, name: data.name?.trim() || d.id };
    });
    setAgencies(list);
  }, []);

  useEffect(() => {
    void refreshAgencies().catch(() => setAgencies([]));
  }, [refreshAgencies]);

  useEffect(() => {
    if (!auth.currentUser || !role) return;
    const q = query(
      collection(db, FORD_AGENCY_ONBOARDING_COLLECTION),
      where('programVertical', '==', 'FORD_CREDIT_MX'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as FordAgencyOnboardingRequestDoc),
      }));
      setOnboardingRequests(rows);
    });
    return () => unsub();
  }, [role]);

  useEffect(() => {
    if (!auth.currentUser || !role) return;

    const q = query(
      collection(db, 'investigations'),
      where('vertical', '==', 'FORD_CREDIT_MX'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const invs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInvestigations(invs);
    });

    return () => unsub();
  }, [role]);

  const byStatus = useMemo(
    () => countBy(investigations.map((i) => String(i.status || 'UNKNOWN'))),
    [investigations]
  );
  const byPipeline = useMemo(
    () => countBy(investigations.map((i) => String(i.creditPipelineStage || 'SIN_ETAPA'))),
    [investigations]
  );
  const byOrg = useMemo(
    () => countBy(investigations.map((i) => String(i.organizationId || 'sin_org'))),
    [investigations]
  );

  const agencyLabelByOrgId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of agencies) {
      m[a.id] = a.name;
    }
    return m;
  }, [agencies]);

  const completed = useMemo(
    () => investigations.filter((i) => i.status === 'COMPLETED').length,
    [investigations]
  );
  const inProgress = useMemo(
    () => investigations.filter((i) => i.status === 'IN_PROGRESS' || i.status === 'PENDING').length,
    [investigations]
  );
  const attention = useMemo(
    () => investigations.filter((i) => i.status === 'REQUIRES_ATTENTION').length,
    [investigations]
  );

  const operationsSnapshot = useMemo(
    () => ({
      generatedAt: new Date().toISOString(),
      viewerRole: role,
      tenant: organization?.name ?? FORD_PROGRAM_ROOT_ORG_ID,
      programRootOrganizationId: FORD_PROGRAM_ROOT_ORG_ID,
      agenciesInNetwork: agencies,
      agencyCount: agencies.length,
      creditFilesTotal: investigations.length,
      byStatus,
      byPipelineStage: byPipeline,
      expedientesByOrganizationId: byOrg,
      highlights: {
        completed,
        inProgressOrPending: inProgress,
        requiresAttention: attention,
      },
    }),
    [role, organization?.name, agencies, investigations, byStatus, byPipeline, byOrg, completed, inProgress, attention]
  );

  const title =
    role === 'FORD_SUPERVISOR_DIRECCION'
      ? 'Ford Crédito MX · Dirección operativa'
      : 'Ford Crédito MX · Gerencia de supervisión';

  const subtitle =
    'Vista programa: agencias en red, expedientes de crédito, analítica de estatus y asistente IA para la operación.';

  const maxBar = Math.max(1, ...Object.values(byStatus));

  const canRegisterAgencyInProgram = role === 'FORD_SUPERVISOR_DIRECCION';
  const canProposeAgencyFourEyes = role === 'FORD_SUPERVISOR_GERENCIA';
  const canReviewFourEyes = role === 'FORD_SUPERVISOR_DIRECCION';

  const sortedOnboardingRequests = useMemo(() => {
    return [...onboardingRequests].sort((a, b) => {
      const pa = a.status === 'PENDING' ? 0 : 1;
      const pb = b.status === 'PENDING' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [onboardingRequests]);

  const pendingOnboardingCount = useMemo(
    () => onboardingRequests.filter((r) => r.status === 'PENDING').length,
    [onboardingRequests]
  );

  const sidebarItems = [
    { id: 'overview', label: 'Resumen operativo', icon: LayoutDashboard },
    { id: 'pipeline', label: 'Pipeline Ford', icon: Building2 },
    { id: 'audit', label: 'Auditoría IA', icon: ClipboardList },
    { id: 'agencias', label: 'Red y altas de agencias', icon: Landmark },
    { id: 'seguridad', label: 'Seguridad y cumplimiento', icon: Shield },
    { id: 'ai', label: 'Asistente IA', icon: Bot },
  ];

  const handleCreateAgency = async () => {
    if (!canRegisterAgencyInProgram) return;
    const name = agencyName.trim();
    const slug = agencySlug.trim();
    if (!name || !slug) {
      toast.error('Nombre y slug son obligatorios');
      return;
    }
    setAgencySaving(true);
    try {
      await createFordAgencyOrganization(db, { slug, displayName: name });
      toast.success(`Agencia "${name}" registrada en la red`);
      setAgencyName('');
      setAgencySlug('');
      await refreshAgencies();
    } catch (e) {
      console.error(e);
      toast.error('No se pudo crear la agencia');
    } finally {
      setAgencySaving(false);
    }
  };

  const handleSubmitProposal = async () => {
    if (!canProposeAgencyFourEyes || !user?.uid) return;
    setProposalSaving(true);
    try {
      await submitFordAgencyProposal(
        db,
        { slug: agencySlug, displayName: agencyName, note: proposalNote },
        { uid: user.uid, email: user.email ?? null }
      );
      toast.success('Solicitud enviada a Dirección para aprobación');
      setAgencyName('');
      setAgencySlug('');
      setProposalNote('');
    } catch (e) {
      if (e instanceof FordAgencyOnboardingError) {
        toast.error(e.message);
      } else {
        console.error(e);
        toast.error('No se pudo enviar la solicitud');
      }
    } finally {
      setProposalSaving(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    if (!canReviewFourEyes || !user?.uid) return;
    setOnboardingActionId(requestId);
    try {
      await approveFordAgencyProposal(db, requestId, { uid: user.uid, email: user.email ?? null });
      toast.success('Agencia creada en la red');
      await refreshAgencies();
    } catch (e) {
      if (e instanceof FordAgencyOnboardingError) {
        toast.error(e.message);
      } else {
        console.error(e);
        toast.error('No se pudo aprobar');
      }
    } finally {
      setOnboardingActionId(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!canReviewFourEyes || !user?.uid) return;
    setOnboardingActionId(requestId);
    try {
      await rejectFordAgencyProposal(db, requestId, { uid: user.uid, email: user.email ?? null }, rejectReason);
      toast.success('Solicitud rechazada');
      setRejectingId(null);
      setRejectReason('');
    } catch (e) {
      if (e instanceof FordAgencyOnboardingError) {
        toast.error(e.message);
      } else {
        console.error(e);
        toast.error('No se pudo rechazar');
      }
    } finally {
      setOnboardingActionId(null);
    }
  };

  return (
    <DashboardLayout
      title={title}
      subtitle={subtitle}
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      showFinancialComplianceAside
    >
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-500">Agencias en red</h3>
                <Building2 className="w-5 h-5 text-[#003478]" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{agencies.length}</p>
              <p className="text-xs text-slate-500 mt-1">Organizaciones bajo el programa central</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-500">Expedientes crédito</h3>
                <FileText className="w-5 h-5 text-slate-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{investigations.length}</p>
              <p className="text-xs text-slate-500 mt-1">Vertical Ford (todas las agencias)</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-500">Completados / en curso</h3>
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {completed} <span className="text-lg font-semibold text-slate-400">/</span>{' '}
                <span className="text-slate-700">{inProgress}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Histórico de estatus en datos actuales</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-amber-900">Requieren atención</h3>
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-3xl font-bold text-amber-950">{attention}</p>
              <p className="text-xs text-amber-800/80 mt-1">Seguimiento prioritario</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-[#003478]" />
                <h2 className="text-lg font-bold text-slate-900">Analítica por estatus</h2>
              </div>
              <div className="space-y-3">
                {Object.entries(byStatus).length === 0 ? (
                  <p className="text-sm text-slate-500">Aún no hay expedientes en la vertical.</p>
                ) : (
                  Object.entries(byStatus).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                        <span>{k}</span>
                        <span>{v}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#003478]/85 transition-all"
                          style={{ width: `${(v / maxBar) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-bold text-slate-900">Pipeline (etapa)</h2>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {Object.entries(byPipeline).length === 0 ? (
                  <p className="text-sm text-slate-500">Sin etapas registradas.</p>
                ) : (
                  Object.entries(byPipeline)
                    .sort((a, b) => b[1] - a[1])
                    .map(([stage, v]) => (
                      <div key={stage} className="flex justify-between text-sm border-b border-slate-100 pb-2">
                        <span className="text-slate-700 font-medium">{stage}</span>
                        <span className="text-slate-500">{v}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-bold text-slate-900">Carga por agencia</h2>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {agencies.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay agencias registradas bajo el programa.</p>
                ) : (
                  agencies.map((a) => (
                    <div key={a.id} className="flex justify-between text-sm py-2 border-b border-slate-50">
                      <span className="text-slate-800 font-medium truncate pr-2" title={a.id}>
                        {a.name}
                      </span>
                      <span className="text-slate-500 shrink-0">{byOrg[a.id] ?? 0} exp.</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <FordOperationsChat operationsSnapshot={operationsSnapshot} />
          </div>
        </div>
      )}

      {activeTab === 'agencias' && (
        <div className="space-y-6 max-w-4xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Roles y cuatro ojos (alta de agencias)</h2>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5 leading-relaxed">
              <li>
                <strong className="text-slate-800">Gerencia de supervisión</strong> (
                <code className="text-xs bg-slate-100 px-1 rounded">FORD_SUPERVISOR_GERENCIA</code>): envía una{' '}
                <strong>solicitud</strong> con nombre y slug; no crea la organización hasta que Dirección apruebe.
              </li>
              <li>
                <strong className="text-slate-800">Dirección del programa</strong> (
                <code className="text-xs bg-slate-100 px-1 rounded">FORD_SUPERVISOR_DIRECCION</code>): revisa solicitudes pendientes;{' '}
                <strong>aprobar</strong> crea la organización en Firestore. No puede aprobar una solicitud{' '}
                <strong>propia</strong> (distinto usuario / segregación de funciones).
              </li>
              <li>
                <strong className="text-slate-800">Dirección</strong> también puede usar el alta <strong>directa</strong> (sin solicitud previa) para casos
                urgentes o migraciones; queda auditado en la misma colección de organizaciones.
              </li>
              <li>
                <strong className="text-slate-800">ADMIN</strong> de plataforma: alta desde el panel SaaS “Onboarding / tenants”.
              </li>
            </ul>
          </div>

          {(canProposeAgencyFourEyes || canRegisterAgencyInProgram) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Cola de solicitudes</h2>
              <p className="text-sm text-slate-600 mb-4">
                Pendientes: <strong>{pendingOnboardingCount}</strong>. Las filas con estado PENDING requieren acción de Dirección (aprobar / rechazar).
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Nombre / slug</th>
                      <th className="p-3">Solicitante</th>
                      <th className="p-3">Notas</th>
                      <th className="p-3 w-48">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOnboardingRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500">
                          No hay solicitudes registradas.
                        </td>
                      </tr>
                    ) : (
                      sortedOnboardingRequests.map((row) => (
                        <React.Fragment key={row.id}>
                          <tr className="border-t border-slate-100 hover:bg-slate-50/80 align-top">
                            <td className="p-3 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold ${
                                  row.status === 'PENDING'
                                    ? 'bg-amber-100 text-amber-900'
                                    : row.status === 'APPROVED'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : 'bg-slate-200 text-slate-800'
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-medium text-slate-900">{row.proposedDisplayName}</div>
                              <code className="text-xs text-slate-500">{row.proposedOrganizationId}</code>
                              {row.createdOrganizationId && (
                                <div className="text-xs text-emerald-700 mt-1">Org creada: {row.createdOrganizationId}</div>
                              )}
                            </td>
                            <td className="p-3 text-slate-600 text-xs">
                              <div>{row.proposedByEmail || row.proposedByUid}</div>
                              <div className="text-slate-400">{row.createdAt?.slice(0, 16)?.replace('T', ' ')}</div>
                            </td>
                            <td className="p-3 text-slate-600 text-xs max-w-[200px]">
                              {row.proposalNote || '—'}
                              {row.status === 'REJECTED' && row.rejectionReason && (
                                <div className="mt-1 text-red-700">Motivo: {row.rejectionReason}</div>
                              )}
                            </td>
                            <td className="p-3">
                              {row.status === 'PENDING' && canReviewFourEyes ? (
                                rejectingId === row.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={rejectReason}
                                      onChange={(e) => setRejectReason(e.target.value)}
                                      placeholder="Motivo del rechazo"
                                      rows={2}
                                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
                                    />
                                    <div className="flex flex-wrap gap-1">
                                      <button
                                        type="button"
                                        disabled={!!onboardingActionId}
                                        onClick={() => handleRejectRequest(row.id)}
                                        className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-medium disabled:opacity-50"
                                      >
                                        Confirmar rechazo
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRejectingId(null);
                                          setRejectReason('');
                                        }}
                                        className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    <button
                                      type="button"
                                      disabled={!!onboardingActionId}
                                      onClick={() => handleApproveRequest(row.id)}
                                      className="px-2 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50"
                                    >
                                      {onboardingActionId === row.id ? 'Aprobando…' : 'Aprobar y crear org'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!!onboardingActionId}
                                      onClick={() => {
                                        setRejectingId(row.id);
                                        setRejectReason('');
                                      }}
                                      className="px-2 py-1.5 rounded-lg border border-red-200 text-red-800 text-xs font-medium disabled:opacity-50"
                                    >
                                      Rechazar…
                                    </button>
                                  </div>
                                )
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Agencias registradas en la red</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {agencies.length === 0 ? (
                <p className="text-sm text-slate-500">No hay agencias bajo el programa todavía.</p>
              ) : (
                agencies.map((a) => (
                  <div key={a.id} className="flex justify-between text-sm py-2 border-b border-slate-100">
                    <span className="font-medium text-slate-800">{a.name}</span>
                    <code className="text-xs text-slate-500">{a.id}</code>
                  </div>
                ))
              )}
            </div>
          </div>

          {canProposeAgencyFourEyes && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Solicitud de alta (Gerencia → Dirección)</h2>
              <p className="text-sm text-slate-600 mb-4">
                Completa nombre y slug; Dirección recibirá la solicitud en la tabla anterior. No podrás aprobar tu propia solicitud.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Nombre visible</label>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Ej. Ford Polanco"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Slug (id Firestore)</label>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono bg-white"
                    value={agencySlug}
                    onChange={(e) => setAgencySlug(e.target.value)}
                    placeholder="ford-agencia-polanco"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 uppercase">Nota para Dirección (opcional)</label>
                <textarea
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                  rows={2}
                  value={proposalNote}
                  onChange={(e) => setProposalNote(e.target.value)}
                  placeholder="Contexto operativo, ubicación, fecha prevista de arranque…"
                />
              </div>
              <button
                type="button"
                disabled={proposalSaving}
                onClick={handleSubmitProposal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {proposalSaving ? 'Enviando…' : 'Enviar solicitud de alta'}
              </button>
            </div>
          )}

          {canRegisterAgencyInProgram && (
            <div className="rounded-2xl border border-[#003478]/25 bg-[#003478]/[0.03] p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Alta directa (solo Dirección)</h2>
              <p className="text-sm text-slate-600 mb-4">
                Crea la organización de inmediato bajo <code className="text-xs bg-white px-1 rounded">{FORD_PROGRAM_ROOT_ORG_ID}</code>. Use preferentemente
                el flujo de solicitud salvo urgencias o migración.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Nombre visible</label>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Ej. Ford Polanco"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Slug (id Firestore)</label>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono bg-white"
                    value={agencySlug}
                    onChange={(e) => setAgencySlug(e.target.value)}
                    placeholder="ford-agencia-polanco"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={agencySaving}
                onClick={handleCreateAgency}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#003478' }}
              >
                {agencySaving ? 'Guardando…' : 'Registrar agencia en la red (directo)'}
              </button>
            </div>
          )}

          {!canProposeAgencyFourEyes && !canRegisterAgencyInProgram && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-950">
              <p className="font-semibold mb-1">Perfil de solo lectura para altas</p>
              <p className="leading-relaxed">
                Tu cuenta puede ver la cola y las agencias en red. Para enviar solicitudes usa un usuario{' '}
                <strong>Gerencia del programa</strong>; para aprobar o alta directa, <strong>Dirección del programa</strong>; para implementación técnica,{' '}
                <strong>ADMIN</strong> Juxa.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'seguridad' && <BankingSecurityStandardsPanel variant="full" />}

      {activeTab === 'audit' && (
        <FordAuditPeriodPanel
          investigations={investigations}
          agencyLabelByOrgId={agencyLabelByOrgId}
          variant="ford_supervisor"
        />
      )}

      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <p className="font-semibold mb-1">Supervisión · Pipeline completo</p>
            <p>
              Misma vista de solicitudes que mesa programa, orientada a lectura de cartera y etapas. Usa el asistente IA
              en Resumen para preguntas agregadas.
            </p>
          </div>
          <CreditApplicationsModule
            investigations={investigations}
            profiles={['CREDIT', 'FORD_CREDIT_MX']}
            vertical="FORD_CREDIT_MX"
            agencyLabelByOrgId={agencyLabelByOrgId}
            capabilities={getCreditCrmCapabilities({
              context: 'ford_program',
              role,
              clientAccountRole: null,
            })}
          />
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="max-w-3xl mx-auto">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm">
              El contexto del chat se actualiza con los datos del panel (expedientes y agencias actuales).
            </p>
          </div>
          <FordOperationsChat operationsSnapshot={operationsSnapshot} />
        </div>
      )}
    </DashboardLayout>
  );
};
