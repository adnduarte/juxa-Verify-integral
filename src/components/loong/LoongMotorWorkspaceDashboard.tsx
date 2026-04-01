import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calculator, ExternalLink, MessageCircle, RefreshCw, Search, Truck, Users, Wallet } from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import type { Role } from '../../contexts/AuthContext';
import { DashboardLayout } from '../dashboards/DashboardLayout';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';
import {
  DEFAULT_LOONG_MOTOR_POLICY,
  computeLoongPrecalScore,
  mergeLoongPolicy,
  parseLoongPolicyJson,
  type LoongMotorCreditPolicy,
  type LoongPrecalInputs,
} from '../../lib/loongMotorCredit';
import { resolveLoongClientsDocIds, resolveLoongMotorPolicies } from '../../lib/loongMotorPolicyFirestore';
import {
  DEFAULT_LOONG_OPERATIONAL_RULES,
  mergeLoongOperationalRules,
  type LoongOperationalRules,
} from '../../lib/loongOperationalRules';
import {
  advanceStageAction,
  generateLoongContractAndPagare,
  LOONG_PIPELINE_FLOW_DESCRIPTION,
  stageLabelEs,
  type LoongOriginationCase,
  type LoongOriginationStage,
} from '../../lib/loongOrigination';
import {
  LOONG_CLIENT_JOURNEY_PHASE_ORDER,
  journeyPhaseFromOriginationStage,
  journeyPhaseTitleEs,
} from '../../lib/loongClientJourney';
import {
  candidateUrlForLink,
  issueArraigoInvestigationLink,
  issueFormalQualificationLink,
} from '../../lib/loongPipelineLinks';
import { toast } from 'react-hot-toast';
import { LoongTeamUsersPanel } from './LoongTeamUsersPanel';
import { LoongCobranzaCrmTab } from './LoongCobranzaCrmTab';
import { LoongSupportTicketsTab } from './LoongSupportTicketsTab';
import { LoongWorkspaceChatTab } from './LoongWorkspaceChatTab';
import { LoongOperationalCollectionEditor } from './LoongOperationalCollectionEditor';
import { FEATURE_WORKSPACE_CHAT_TICKETS } from '../../config/features';
import { buildLoongMotorSidebarItems, resolveLoongWorkspaceActiveTab, type LoongWorkspaceTabId } from './loongMotorSidebar';
import { LoongWorkspaceSettingsTab } from './LoongWorkspaceSettingsTab';
import { LoongMisExpedientesTab } from './LoongMisExpedientesTab';
import { LoongContractPreviewModal } from './LoongContractPreviewModal';
import { LoongFlowRequestsTab } from './LoongFlowRequestsTab';
import { LoongMesaPrecalQueuePanel } from './LoongMesaPrecalQueuePanel';
import { PercentSliderField } from '../ui';
import { shellClasses } from '../../config/brand';
import { DEFAULT_ORGANIZATION_ID_LOONG } from '../../lib/organizations';
import { mesaQueueDictamenExcerpt } from '../../lib/mesaQueueInvestigationPreview';
import { loongUserHasMesaDeskVisibility } from '../../lib/loongMesaDeskAccess';

type TabId = LoongWorkspaceTabId;

function roleSeesAllLoongCases(role: Role): boolean {
  return (
    role === 'ADMIN' ||
    role === 'SUPERVISOR' ||
    role === 'ANALISTA_MESA_CONTROL' ||
    role === 'GERENTE_DIRECTIVO' ||
    role === 'ANALISTA_CREDITO'
  );
}

const COBRANZA_OR_ATENCION_ORG_ROLES: Role[] = ['ADMIN_COBRANZA', 'AGENTE_COBRANZA', 'ATENCION_CLIENTE'];

export const LoongMotorWorkspaceDashboard: React.FC = () => {
  const { user, role, logUserAction, organizationId, effectiveOrganizationId, loongTeamTier } = useAuthStatus();
  const canManageTeam = role === 'ADMIN' || role === 'SUPERVISOR';
  const investigatorOnly = role === 'INVESTIGADOR';
  const atencionOnly = role === 'ATENCION_CLIENTE';
  const cobranzaOnly = role === 'ADMIN_COBRANZA' || role === 'AGENTE_COBRANZA';
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  const mesaDeskVisible = useMemo(
    () =>
      loongUserHasMesaDeskVisibility({
        role: role ?? '',
        userEmail: user?.email ?? null,
        loongTeamTier,
      }),
    [role, user?.email, loongTeamTier]
  );

  const vendorSalesOnly =
    role === 'CLIENTE' &&
    !canManageTeam &&
    !investigatorOnly &&
    !atencionOnly &&
    !cobranzaOnly &&
    !mesaDeskVisible;

  const activeTab = useMemo(
    () =>
      resolveLoongWorkspaceActiveTab(pathname, search, {
        investigatorOnly,
        atencionOnly,
        cobranzaOnly,
        role,
        canManageTeam,
        userEmail: user?.email ?? null,
        loongTeamTier,
      }) as TabId,
    [pathname, search, investigatorOnly, atencionOnly, cobranzaOnly, role, canManageTeam, user?.email, loongTeamTier]
  );

  const highlightInvId = useMemo(() => {
    const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    return sp.get('highlightInv')?.trim() ?? '';
  }, [search]);

  const [cases, setCases] = useState<LoongOriginationCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [creditPolicy, setCreditPolicy] = useState<LoongMotorCreditPolicy>({ ...DEFAULT_LOONG_MOTOR_POLICY });
  const [opRules, setOpRules] = useState<LoongOperationalRules>({ ...DEFAULT_LOONG_OPERATIONAL_RULES });
  const [policyJson, setPolicyJson] = useState(JSON.stringify(DEFAULT_LOONG_MOTOR_POLICY, null, 2));
  const [opRulesJson, setOpRulesJson] = useState(JSON.stringify(DEFAULT_LOONG_OPERATIONAL_RULES, null, 2));
  const [policyMsg, setPolicyMsg] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [invRows, setInvRows] = useState<any[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);

  const sidebarItems = useMemo(
    () =>
      buildLoongMotorSidebarItems({
        investigatorOnly,
        atencionOnly,
        cobranzaOnly,
        canManageTeam,
        role,
        userEmail: user?.email ?? null,
        loongTeamTier,
      }),
    [investigatorOnly, atencionOnly, cobranzaOnly, canManageTeam, role, user?.email, loongTeamTier]
  );

  const loadPolicies = useCallback(async () => {
    try {
      const { creditPolicy, operationalRules } = await resolveLoongMotorPolicies(db, {
        organizationId,
        actingUserId: user?.uid ?? null,
        applyPersonalOverrides: true,
      });
      setCreditPolicy(creditPolicy);
      setPolicyJson(JSON.stringify(creditPolicy, null, 2));
      setOpRules(operationalRules);
      setOpRulesJson(JSON.stringify(operationalRules, null, 2));
    } catch (e) {
      console.error(e);
    }
  }, [organizationId, user?.uid]);

  const loadCases = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingCases(true);
    try {
      let snap;
      if (role && (roleSeesAllLoongCases(role) || mesaDeskVisible)) {
        snap = await getDocs(collection(db, 'loong_origination_cases'));
      } else if (role && organizationId && COBRANZA_OR_ATENCION_ORG_ROLES.includes(role)) {
        const q = query(
          collection(db, 'loong_origination_cases'),
          where('organizationId', '==', organizationId)
        );
        snap = await getDocs(q);
      } else {
        const q = query(collection(db, 'loong_origination_cases'), where('vendedorUid', '==', user.uid));
        snap = await getDocs(q);
      }
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as LoongOriginationCase[];
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setCases(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCases(false);
    }
  }, [user?.uid, role, organizationId, mesaDeskVisible]);

  const loadInvestigations = useCallback(async () => {
    setLoadingInv(true);
    try {
      const byId = new Map<string, Record<string, unknown>>();
      const mergeSnap = (snap: Awaited<ReturnType<typeof getDocs>>) => {
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          byId.set(d.id, { id: d.id, ...data });
        }
      };

      const snapLoong = await getDocs(
        query(collection(db, 'investigations'), where('clientProfile', '==', 'LOONG_MOTOR'), limit(400))
      );
      mergeSnap(snapLoong);

      /** Originación BASIC (CREDIT) y bandera Loong: antes no aparecían aquí solo con perfil LOONG_MOTOR. */
      if (!investigatorOnly) {
        const orgKey =
          (effectiveOrganizationId ?? organizationId ?? '').trim() || DEFAULT_ORGANIZATION_ID_LOONG;
        const snapCredit = await getDocs(
          query(
            collection(db, 'investigations'),
            where('organizationId', '==', orgKey),
            where('clientProfile', '==', 'CREDIT'),
            limit(400)
          )
        );
        mergeSnap(snapCredit);
        const snapLoongFlag = await getDocs(
          query(
            collection(db, 'investigations'),
            where('organizationId', '==', orgKey),
            where('loongMotorPolicyApplies', '==', true),
            limit(400)
          )
        );
        mergeSnap(snapLoongFlag);
      }

      const list = [...byId.values()].sort(
        (a, b) =>
          new Date(String(b.updatedAt || b.createdAt || 0)).getTime() -
          new Date(String(a.updatedAt || a.createdAt || 0)).getTime()
      );
      setInvRows(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInv(false);
    }
  }, [investigatorOnly, effectiveOrganizationId, organizationId]);

  useEffect(() => {
    loadPolicies();
    if (investigatorOnly) loadInvestigations();
    else if (!atencionOnly) loadCases();
  }, [loadPolicies, loadCases, loadInvestigations, investigatorOnly, atencionOnly]);

  /** Vendedor: entrada en /dashboard sin ?tab= → arranque de precal (solo captura inicial). */
  useEffect(() => {
    if (!vendorSalesOnly || pathname !== '/dashboard') return;
    const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    if (!sp.has('tab')) {
      navigate('/dashboard?tab=flow-requests', { replace: true });
    }
  }, [vendorSalesOnly, pathname, search, navigate]);

  useEffect(() => {
    if (activeTab === 'investigaciones') loadInvestigations();
  }, [activeTab, loadInvestigations]);

  useEffect(() => {
    if (
      activeTab === 'pipeline' ||
      activeTab === 'entrega' ||
      activeTab === 'cobranza-crm' ||
      activeTab === 'mis-expedientes'
    ) {
      if (!atencionOnly) loadCases();
    }
  }, [activeTab, loadCases, atencionOnly]);

  const savePolicies = async () => {
    const parsed = parseLoongPolicyJson(policyJson);
    if (!parsed) {
      setPolicyMsg('JSON de precalificación inválido.');
      return;
    }
    let parsedOp: LoongOperationalRules;
    try {
      parsedOp = mergeLoongOperationalRules(JSON.parse(opRulesJson) as Partial<LoongOperationalRules>);
    } catch {
      setPolicyMsg('JSON de reglas operativas inválido.');
      return;
    }
    setSavingPolicy(true);
    setPolicyMsg('');
    try {
      const targetClientDoc = resolveLoongClientsDocIds(organizationId)[0];
      await setDoc(
        doc(db, 'clients', targetClientDoc),
        {
          loongMotorCreditPolicy: mergeLoongPolicy(parsed),
          loongOperationalRules: parsedOp,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setCreditPolicy(mergeLoongPolicy(parsed));
      setOpRules(parsedOp);
      setPolicyMsg('Guardado. Precalificación y originación usan estas reglas.');
      if (logUserAction && user) logUserAction(user.uid, 'LOONG_WORKSPACE_POLICY_SAVE', {});
    } catch (e) {
      setPolicyMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingPolicy(false);
    }
  };

  if (investigatorOnly) {
    return (
      <div className="p-4 sm:p-8 h-full">
        <DashboardLayout
          title="Loong Motor"
          subtitle="Solo investigación para crédito moto — sin RRHH"
          sidebarItems={sidebarItems}
          activeTab={activeTab}
          onTabChange={() => {}}
        >
          <InvestigacionesTab
            rows={invRows}
            loading={loadingInv}
            onRefresh={loadInvestigations}
            highlightInvId={highlightInvId}
          />
        </DashboardLayout>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 h-full">
      <DashboardLayout
        title="Loong Motor"
        subtitle={
          vendorSalesOnly
            ? 'Alta de prospectos crédito moto y seguimiento de expedientes'
            : 'Originación, CRM, precalificación y cobranza — perfil dedicado'
        }
        sidebarItems={sidebarItems}
        activeTab={activeTab}
        onTabChange={() => {}}
      >
        {activeTab === 'mesa-control' && <LoongMesaPrecalQueuePanel />}
        {activeTab === 'flow-requests' && role && (
          <LoongFlowRequestsTab
            role={role}
            cases={cases}
            showMesaQueue={
              role === 'ANALISTA_MESA_CONTROL' || role === 'EJECUTIVO_VENTAS' || mesaDeskVisible
            }
          />
        )}
        {activeTab === 'pipeline' && (
          <PipelineTab
            cases={cases}
            loading={loadingCases}
            onRefresh={loadCases}
            role={role}
            userUid={user?.uid || ''}
            organizationId={organizationId}
            opRules={opRules}
            creditPolicy={creditPolicy}
            logUserAction={logUserAction}
            seeAllOrgCases={Boolean(role && (roleSeesAllLoongCases(role) || mesaDeskVisible))}
          />
        )}
        {activeTab === 'precal' && (
          <PrecalTab creditPolicy={creditPolicy} onReloadPolicy={loadPolicies} />
        )}
        {activeTab === 'investigaciones' && (
          <InvestigacionesTab
            rows={invRows}
            loading={loadingInv}
            onRefresh={loadInvestigations}
            highlightInvId={highlightInvId}
          />
        )}
        {activeTab === 'entrega' && <EntregaTab cases={cases} loading={loadingCases} onRefresh={loadCases} />}
        {activeTab === 'cobranza-crm' && user && (
          <LoongCobranzaCrmTab
            cases={cases}
            loadingCases={loadingCases}
            organizationId={organizationId}
            userUid={user.uid}
            role={role}
            onRefreshCases={loadCases}
          />
        )}
        {FEATURE_WORKSPACE_CHAT_TICKETS && activeTab === 'chat' && user && (
          <LoongWorkspaceChatTab
            organizationId={organizationId}
            userUid={user.uid}
            userEmail={user.email}
            role={role}
          />
        )}
        {FEATURE_WORKSPACE_CHAT_TICKETS && activeTab === 'tickets' && user && (
          role && (
            <LoongSupportTicketsTab
              organizationId={effectiveOrganizationId ?? organizationId}
              userUid={user.uid}
              role={role}
            />
          )
        )}
        {activeTab === 'equipo' && canManageTeam && (
          <LoongTeamUsersPanel organizationId={effectiveOrganizationId ?? organizationId} />
        )}
        {activeTab === 'politicas' && (role === 'ADMIN' || role === 'SUPERVISOR') && (
          <PoliticasTab
            policyJson={policyJson}
            setPolicyJson={setPolicyJson}
            opRulesJson={opRulesJson}
            setOpRulesJson={setOpRulesJson}
            opRules={opRules}
            setOpRules={setOpRules}
            policyMsg={policyMsg}
            saving={savingPolicy}
            onSave={savePolicies}
          />
        )}
        {activeTab === 'mis-expedientes' && user && (
          <LoongMisExpedientesTab
            cases={cases}
            loading={loadingCases}
            onRefresh={loadCases}
            userUid={user.uid}
            userEmail={user.email}
            role={role}
            opRules={opRules}
          />
        )}
        {activeTab === 'configuracion' && <LoongWorkspaceSettingsTab />}
      </DashboardLayout>
    </div>
  );
};

const PipelineTab: React.FC<{
  cases: LoongOriginationCase[];
  loading: boolean;
  onRefresh: () => void;
  role: Role;
  userUid: string;
  organizationId: string | null;
  opRules: LoongOperationalRules;
  creditPolicy: LoongMotorCreditPolicy;
  logUserAction?: (userId: string, action: string, details?: any) => Promise<void>;
  seeAllOrgCases: boolean;
}> = ({
  cases,
  loading,
  onRefresh,
  role,
  userUid,
  organizationId,
  opRules,
  creditPolicy,
  logUserAction,
  seeAllOrgCases,
}) => {
  const [deliveryModal, setDeliveryModal] = useState<LoongOriginationCase | null>(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryAddr, setDeliveryAddr] = useState('');
  const [mesaNote, setMesaNote] = useState('');
  const [supNote, setSupNote] = useState('');
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [previewCase, setPreviewCase] = useState<LoongOriginationCase | null>(null);

  const canIssueArraigo = (c: LoongOriginationCase) =>
    c.originationStage === 'MESA_INTAKE_OK' ||
    (c.originationStage === 'CALIFICACION_FORMAL_OK' && c.formalQualPassed !== false);

  const canIssuePipelineLinks = (c: LoongOriginationCase) =>
    seeAllOrgCases || c.vendedorUid === userUid;

  const pushHistory = (c: LoongOriginationCase, action: string, note?: string) => [
    ...(c.history || []),
    { at: new Date().toISOString(), byUid: userUid, action, note },
  ];

  const applyAdvance = async (c: LoongOriginationCase, next: LoongOriginationStage, label: string, extra: Record<string, unknown> = {}) => {
    const ref = doc(db, 'loong_origination_cases', c.id);
    let payload: Record<string, unknown> = {
      originationStage: next,
      updatedAt: new Date().toISOString(),
      history: pushHistory(c, label),
      ...extra,
    };

    if (next === 'DOCUMENTACION_GENERADA' && c.originationStage === 'SUPERVISION_APROBADO') {
      const snapPolicy = c.policySnapshot?.creditPolicy ?? creditPolicy;
      const snapRules = c.policySnapshot?.operationalRules ?? opRules;
      const { contract, pagare } = generateLoongContractAndPagare(c, snapPolicy, snapRules);
      payload = {
        ...payload,
        generatedContractText: contract,
        generatedPagareText: pagare,
        collectionPlan: {
          installmentAmount: c.precalEstimatedPayment ?? 0,
          totalMonths: c.precalInputs?.plazoMeses ?? 24,
          graceDaysLateFee: snapRules.collection.graceDaysBeforeLateFee,
          lateFeePct: snapRules.collection.lateFeePctOfInstallment,
          notes: snapRules.collection.collectionPolicyNotes,
          policyDocumentUrl: snapRules.collection.collectionPolicyDocumentUrl,
          policyDocumentName: snapRules.collection.collectionPolicyDocumentName,
        },
      };
    }

    await updateDoc(ref, payload as any);
    if (logUserAction) await logUserAction(userUid, 'LOONG_ORIGINATION_ADVANCE', { caseId: c.id, next });
    onRefresh();
  };

  const onClickAdvance = async (c: LoongOriginationCase) => {
    const act = advanceStageAction(role, c.originationStage, opRules, { isOwner: c.vendedorUid === userUid });
    if (!act) return;

    if (act.next === 'ENTREGA_PROGRAMADA' && c.originationStage === 'FIRMAS_PENDIENTE') {
      setDeliveryModal(c);
      setDeliveryDate('');
      setDeliveryAddr('');
      return;
    }

    let extra: Record<string, unknown> = {};
    if (c.originationStage === 'MESA_REVISION' && mesaNote.trim()) {
      extra.mesaNote = mesaNote.trim();
      setMesaNote('');
    }
    if (c.originationStage === 'SUPERVISION_REVISION' && supNote.trim()) {
      extra.supervisionNote = supNote.trim();
      setSupNote('');
    }

    await applyAdvance(c, act.next, act.label, extra);
  };

  const confirmDelivery = async () => {
    if (!deliveryModal || !deliveryDate) return;
    const c = deliveryModal;
    await applyAdvance(c, 'ENTREGA_PROGRAMADA', 'Entrega programada', {
      deliveryScheduledAt: new Date(deliveryDate).toISOString(),
      deliveryAddress: deliveryAddr || null,
    });
    setDeliveryModal(null);
  };

  const copyCandidateUrl = async (linkId: string) => {
    const url = candidateUrlForLink(linkId);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado al portapapeles');
    } catch {
      toast.error(url);
    }
  };

  const onIssueFormalQualLink = async (c: LoongOriginationCase) => {
    setLinkBusyId(c.id);
    try {
      const { linkId } = await issueFormalQualificationLink(db, c, userUid, organizationId ?? undefined);
      await onRefresh();
      await copyCandidateUrl(linkId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo emitir el enlace de calificación formal');
    } finally {
      setLinkBusyId(null);
    }
  };

  const onIssueArraigoLink = async (c: LoongOriginationCase) => {
    setLinkBusyId(c.id);
    try {
      const { linkId } = await issueArraigoInvestigationLink(db, c, userUid, organizationId ?? undefined);
      await onRefresh();
      await copyCandidateUrl(linkId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo emitir el enlace de arraigo');
    } finally {
      setLinkBusyId(null);
    }
  };

  const journeyCounts = useMemo(() => {
    const by = {
      SOLICITUDES_PRECAL: 0,
      INICIO_SOLICITUD_FORMAL: 0,
      CLIENTES_POTENCIALES: 0,
      CONTRATO_FIRMA_ENTREGA: 0,
      COBRANZA: 0,
      RECHAZADO: 0,
    };
    for (const c of cases) {
      const p = journeyPhaseFromOriginationStage(c.originationStage);
      by[p] += 1;
    }
    return by;
  }, [cases]);

  return (
    <div className="space-y-6">
      {(role === 'ADMIN' || role === 'SUPERVISOR' || role === 'ANALISTA_MESA_CONTROL') && (
        <details className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
          <summary className="cursor-pointer select-none">
            <strong>Flujo de originación</strong> <span className="text-emerald-800/80">(ver detalle)</span>
          </summary>
          <div className="mt-2 space-y-2">
            <p>{LOONG_PIPELINE_FLOW_DESCRIPTION}</p>
            <p>
              Las plantillas y moratorios se configuran en <strong>Políticas y reglas</strong>.
            </p>
          </div>
        </details>
      )}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Pipeline de originación</h2>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2.5 text-[11px] dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-slate-600 dark:text-slate-400">Proceso comercial (5 fases)</span>
          {LOONG_CLIENT_JOURNEY_PHASE_ORDER.map((ph, idx) => (
            <span key={ph} className="text-slate-700 dark:text-slate-300" title={journeyPhaseTitleEs(ph)}>
              {idx + 1}. {journeyPhaseTitleEs(ph)} ({loading ? '…' : journeyCounts[ph]})
            </span>
          ))}
          <span className="text-rose-700 dark:text-rose-400">
            Rech. ({loading ? '…' : journeyCounts.RECHAZADO})
          </span>
        </div>
        <Link
          to="/dashboard/loong/crm"
          className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          Ver proceso completo y filtros en CRM
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      {(role === 'ANALISTA_MESA_CONTROL' || role === 'SUPERVISOR' || role === 'ADMIN') && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Nota mesa (opcional)</span>
            <input
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={mesaNote}
              onChange={(e) => setMesaNote(e.target.value)}
              placeholder="Al aprobar mesa…"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Nota supervisión (opcional)</span>
            <input
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={supNote}
              onChange={(e) => setSupNote(e.target.value)}
              placeholder="Al aprobar supervisión…"
            />
          </label>
        </div>
      )}
      {loading ? (
        <JuxaVerifyLoader text="Cargando casos…" />
      ) : cases.length === 0 ? (
        <p className="text-sm text-slate-500">
          No hay expedientes. Usa <strong>CRM precalificación</strong> (asistente o alta rápida) para crear solicitudes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Etapa</th>
                <th className="px-3 py-2">Precal</th>
                <th className="px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.map((c) => {
                const act = advanceStageAction(role, c.originationStage, opRules, { isOwner: c.vendedorUid === userUid });
                const showFormal = canIssuePipelineLinks(c) && c.originationStage === 'PRECUALIFICADO';
                const showArraigoBtn = canIssuePipelineLinks(c) && canIssueArraigo(c);
                const simulateStages: LoongOriginationCase['originationStage'][] = [
                  'MESA_INTAKE',
                  'MESA_INTAKE_OK',
                  'INVESTIGACION_ARRAIGO',
                  'INVESTIGACION_ARRAIGO_OK',
                  'PRECUALIFICADO',
                  'ENLACE_CALIFICACION',
                  'CALIFICACION_FORMAL_OK',
                  'MESA_REVISION',
                  'MESA_APROBADO',
                  'SUPERVISION_REVISION',
                  'SUPERVISION_APROBADO',
                ];
                const showSimulate =
                  canIssuePipelineLinks(c) && !!c.precalInputs && simulateStages.includes(c.originationStage);
                const hasRowAction = !!(act || showFormal || showArraigoBtn || showSimulate);
                return (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{c.clientName}</div>
                      <div className="text-xs text-slate-500">{c.clientEmail}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        {stageLabelEs(c.originationStage)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {c.precalScore != null ? (
                        <span className={c.precalPassed ? 'text-emerald-700' : 'text-amber-700'}>
                          {c.precalScore} {c.precalPassed ? '✓' : 'rev.'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1.5">
                        {act ? (
                          <button
                            type="button"
                            onClick={() => onClickAdvance(c)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            {act.label}
                          </button>
                        ) : null}
                        {showFormal ? (
                          <button
                            type="button"
                            disabled={linkBusyId === c.id}
                            onClick={() => onIssueFormalQualLink(c)}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-50"
                          >
                            {linkBusyId === c.id ? 'Generando…' : 'Enlace calificación formal'}
                          </button>
                        ) : null}
                        {showArraigoBtn ? (
                          <button
                            type="button"
                            disabled={linkBusyId === c.id}
                            onClick={() => onIssueArraigoLink(c)}
                            className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                          >
                            {linkBusyId === c.id ? 'Generando…' : 'Enlace investigación arraigo'}
                          </button>
                        ) : null}
                        {showSimulate ? (
                          <button
                            type="button"
                            onClick={() => setPreviewCase(c)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            Simular contrato / pagaré
                          </button>
                        ) : null}
                        {!hasRowAction ? <span className="text-xs text-slate-400">—</span> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {previewCase && (
        <LoongContractPreviewModal
          caseRow={previewCase}
          creditPolicy={creditPolicy}
          opRules={opRules}
          onClose={() => setPreviewCase(null)}
        />
      )}

      {deliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">Programar entrega</h4>
            <p className="mt-1 text-sm text-slate-500">{deliveryModal.clientName}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-slate-600">Fecha y hora</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
              <label className="block text-xs font-medium text-slate-600">Dirección / taller</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                value={deliveryAddr}
                onChange={(e) => setDeliveryAddr(e.target.value)}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={() => setDeliveryModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={confirmDelivery}
                disabled={!deliveryDate}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PrecalTab: React.FC<{
  creditPolicy: LoongMotorCreditPolicy;
  onReloadPolicy: () => void;
}> = ({ creditPolicy, onReloadPolicy }) => {
  const [precio, setPrecio] = useState('45000');
  const [enganche, setEnganche] = useState('8000');
  const [plazo, setPlazo] = useState('24');
  const [ingreso, setIngreso] = useState('12000');
  const [gastos, setGastos] = useState('6500');
  const [antig, setAntig] = useState('12');
  const [deudas, setDeudas] = useState('0');
  const [buro, setBuro] = useState<LoongPrecalInputs['buroNivel']>('bueno');
  const [result, setResult] = useState<ReturnType<typeof computeLoongPrecalScore> | null>(null);

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-slate-600">
        Motor de precalificación compartido con el enlace de candidato. Los parámetros numéricos salen de políticas guardadas.
      </p>
      <button type="button" onClick={onReloadPolicy} className="text-xs text-emerald-700 underline">
        Recargar política desde Firestore
      </button>
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ['Precio', precio, setPrecio],
            ['Enganche', enganche, setEnganche],
            ['Plazo', plazo, setPlazo],
            ['Ingreso', ingreso, setIngreso],
            ['Gastos', gastos, setGastos],
            ['Antigüedad', antig, setAntig],
            ['Deudas', deudas, setDeudas],
          ] as [string, string, (s: string) => void][]
        ).map(([label, v, setVal]) => (
          <label key={label} className="text-xs">
            <span className="text-slate-500">{label}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={v}
              onChange={(e) => setVal(e.target.value)}
            />
          </label>
        ))}
        <label className="text-xs sm:col-span-2">
          <span className="text-slate-500">Buró (autorreporte)</span>
          <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={buro} onChange={(e) => setBuro(e.target.value as LoongPrecalInputs['buroNivel'])}>
            <option value="excelente">Excelente</option>
            <option value="bueno">Bueno</option>
            <option value="regular">Regular</option>
            <option value="malo">Malo</option>
            <option value="sin_historial">Sin historial</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={() => {
          const inputs: LoongPrecalInputs = {
            precioMoto: Number(precio) || 0,
            enganche: Number(enganche) || 0,
            plazoMeses: Number(plazo) || 24,
            ingresoMensual: Number(ingreso) || 1,
            gastosMensuales: Number(gastos) || 0,
            antiguedadLaboralMeses: Number(antig) || 0,
            montoDeudas: Number(deudas) || 0,
            buroNivel: buro,
          };
          setResult(computeLoongPrecalScore(inputs, creditPolicy));
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white"
      >
        <Calculator className="h-4 w-4" />
        Calcular
      </button>
      {result && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="font-semibold text-slate-900">Score {result.score}</div>
          <div className="mt-1 text-slate-600">Cuota ~ {result.estimatedPayment.toFixed(2)} · {result.passed ? 'Pasa' : 'Revisión manual'}</div>
        </div>
      )}
    </div>
  );
};

function investigationStatusBadgeClass(status: unknown): string {
  const s = String(status ?? '').toUpperCase();
  if (s.includes('PROGRESS') || s === 'IN_PROGRESS') {
    return 'bg-sky-100 text-sky-900 ring-1 ring-sky-200 dark:bg-sky-950/80 dark:text-sky-100 dark:ring-sky-800';
  }
  if (s.includes('PENDING') || s === 'PENDING') {
    return 'bg-amber-100 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-100 dark:ring-amber-800';
  }
  if (s.includes('ATTENTION') || s.includes('REJECT') || s === 'REQUIRES_ATTENTION') {
    return 'bg-rose-100 text-rose-900 ring-1 ring-rose-200 dark:bg-rose-950/70 dark:text-rose-100 dark:ring-rose-800';
  }
  if (s.includes('COMPLET')) {
    return 'bg-slate-200 text-slate-800 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600';
  }
  return 'bg-slate-100 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600';
}

const InvestigacionesTab: React.FC<{
  rows: any[];
  loading: boolean;
  onRefresh: () => void;
  highlightInvId?: string;
}> = ({ rows, loading, onRefresh, highlightInvId }) => {
  const rowRefs = React.useRef<Record<string, HTMLTableRowElement | null>>({});

  React.useEffect(() => {
    if (!highlightInvId || loading) return;
    const el = rowRefs.current[highlightInvId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightInvId, loading, rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700 dark:text-slate-300 max-w-3xl">
          Precalificación moto (perfil Loong Motor), originación BASIC/integral de la organización y expedientes con política
          Loong. Incluye dictamen de IA cuando ya existe en el documento.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Actualizar
        </button>
      </div>
      {loading ? (
        <JuxaVerifyLoader text="Cargando…" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No hay expedientes en esta vista. Genera enlaces de precalificación o revisa la cola en Mesa de control.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    Título / perfil
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    Dictamen / análisis
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    Enlace
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((inv) => {
                  const hi = highlightInvId === inv.id;
                  const excerpt = mesaQueueDictamenExcerpt(inv as Record<string, unknown>, 280);
                  return (
                    <tr
                      key={inv.id}
                      ref={(el) => {
                        rowRefs.current[inv.id] = el;
                      }}
                      className={`transition-colors hover:bg-slate-100/90 dark:hover:bg-slate-900 ${
                        hi
                          ? 'bg-amber-50 ring-2 ring-inset ring-amber-300 dark:bg-amber-950/30 dark:ring-amber-700'
                          : 'bg-white odd:bg-slate-50/90 dark:bg-slate-950 dark:odd:bg-slate-900/70'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <span className="line-clamp-2">{inv.title || inv.id}</span>
                        <span className="mt-0.5 block font-mono text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          {inv.id}
                        </span>
                        <span className="mt-1 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {String(inv.clientProfile ?? '—')}
                          {inv.investigationScope ? ` · ${String(inv.investigationScope)}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex max-w-full items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${investigationStatusBadgeClass(inv.status)}`}
                        >
                          {String(inv.status ?? '—')}
                        </span>
                        {inv.linkStatus ? (
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Enlace: {String(inv.linkStatus)}</p>
                        ) : null}
                        {inv.mesaPrecalStatus ? (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            Mesa precal: {String(inv.mesaPrecalStatus)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-600 dark:text-slate-300 max-w-[280px]">
                        {excerpt ? (
                          <span className="line-clamp-6 whitespace-pre-wrap">{excerpt}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {inv.candidateLink ? (
                          <a
                            href={`${window.location.origin}/candidate/${inv.candidateLink}`}
                            className="inline-flex items-center gap-1 font-semibold text-blue-700 underline decoration-blue-700/30 underline-offset-2 hover:text-blue-900 hover:decoration-blue-900 dark:text-blue-400 dark:decoration-blue-400/40 dark:hover:text-blue-300"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir
                            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
                          </a>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const EntregaTab: React.FC<{
  cases: LoongOriginationCase[];
  loading: boolean;
  onRefresh: () => void;
}> = ({ cases, loading, onRefresh }) => {
  const filtered = cases.filter((c) =>
    ['DOCUMENTACION_GENERADA', 'FIRMAS_PENDIENTE', 'ENTREGA_PROGRAMADA', 'COBRANZA_ACTIVA', 'CERRADO'].includes(c.originationStage)
  );
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Borradores automáticos de <strong>contrato</strong> y <strong>pagaré</strong> tras la aprobación del superadmin Loong. Plan de cobranza según reglas inyectadas.
      </p>
      <button type="button" onClick={onRefresh} className="text-sm text-emerald-700 underline">
        Actualizar
      </button>
      {loading ? (
        <JuxaVerifyLoader text="Cargando…" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Aún no hay expedientes en documentación o posteriores.</p>
      ) : (
        <div className="space-y-6">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{c.clientName}</h3>
                <span className="text-xs font-medium text-amber-800">{stageLabelEs(c.originationStage)}</span>
              </div>
              {c.deliveryScheduledAt && (
                <p className="text-xs text-slate-600">
                  Entrega: {new Date(c.deliveryScheduledAt).toLocaleString('es-MX')} {c.deliveryAddress ? `· ${c.deliveryAddress}` : ''}
                </p>
              )}
              {c.collectionPlan && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  <strong>Cobranza:</strong> cuota {c.collectionPlan.installmentAmount?.toFixed?.(2) ?? c.collectionPlan.installmentAmount} ·{' '}
                  {c.collectionPlan.totalMonths} meses · gracia {c.collectionPlan.graceDaysLateFee} d · moratorio {c.collectionPlan.lateFeePct}%
                  {c.collectionPlan.notes ? (
                    <div className="mt-1 whitespace-pre-wrap">{c.collectionPlan.notes}</div>
                  ) : null}
                  {c.collectionPlan.policyDocumentUrl ? (
                    <a
                      href={c.collectionPlan.policyDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block font-medium text-emerald-700 underline"
                    >
                      {c.collectionPlan.policyDocumentName || 'Documento de política de cobranza'}
                    </a>
                  ) : null}
                </div>
              )}
              {c.generatedContractText && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-emerald-800">Ver contrato (borrador)</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900/5 p-3 text-xs">{c.generatedContractText}</pre>
                </details>
              )}
              {c.generatedPagareText && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-emerald-800">Ver pagaré (borrador)</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900/5 p-3 text-xs">{c.generatedPagareText}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PoliticasTab: React.FC<{
  policyJson: string;
  setPolicyJson: (s: string) => void;
  opRulesJson: string;
  setOpRulesJson: (s: string) => void;
  opRules: LoongOperationalRules;
  setOpRules: (r: LoongOperationalRules) => void;
  policyMsg: string;
  saving: boolean;
  onSave: () => void;
}> = ({ policyJson, setPolicyJson, opRulesJson, setOpRulesJson, opRules, setOpRules, policyMsg, saving, onSave }) => (
  <div className="max-w-4xl space-y-6">
    <p className="text-sm text-slate-600 dark:text-slate-400">
      Inyecta aquí las reglas de <strong>precalificación</strong>, <strong>originación</strong> (plantillas) y el resto de <strong>reglas operativas</strong>. La{' '}
      <strong>política de cobranza</strong> (texto plano y archivo) se edita en el recuadro siguiente; se refleja en el JSON de cobranza al guardar.
    </p>
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Política de crédito / precal (JSON)</h3>
      <PolicyQuickEditor policyJson={policyJson} onChangeJson={setPolicyJson} />
      <textarea
        className={`h-48 w-full rounded-xl p-3 font-mono text-xs ${shellClasses.field}`}
        value={policyJson}
        onChange={(e) => setPolicyJson(e.target.value)}
      />
    </div>
    <LoongOperationalCollectionEditor
      value={opRules.collection}
      onChange={(col) => {
        let base: LoongOperationalRules;
        try {
          base = mergeLoongOperationalRules(JSON.parse(opRulesJson) as Partial<LoongOperationalRules>);
        } catch {
          base = opRules;
        }
        const next = mergeLoongOperationalRules({ ...base, collection: col });
        setOpRules(next);
        setOpRulesJson(JSON.stringify(next, null, 2));
      }}
    />
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        Reglas operativas completas (JSON) — plantillas, originación, cobranza
      </h3>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        El bloque{' '}
        <code className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-800 dark:text-slate-200">
          collection
        </code>{' '}
        se sincroniza con el editor de política de cobranza. Puedes pegar JSON importado o ajustar a mano.
      </p>
      <textarea
        className={`h-64 w-full rounded-xl p-3 font-mono text-xs ${shellClasses.field}`}
        value={opRulesJson}
        onChange={(e) => {
          setOpRulesJson(e.target.value);
          try {
            setOpRules(mergeLoongOperationalRules(JSON.parse(e.target.value) as Partial<LoongOperationalRules>));
          } catch {
            /* esperar a que el JSON sea válido */
          }
        }}
      />
    </div>
    {policyMsg && (
      <p
        className={`text-sm font-medium ${
          policyMsg.startsWith('Error') || policyMsg.includes('inválido')
            ? 'text-red-600 dark:text-red-400'
            : policyMsg.includes('Guardado')
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {policyMsg}
      </p>
    )}
    <button
      type="button"
      disabled={saving}
      onClick={onSave}
      className={`${shellClasses.ctaPrimary} disabled:opacity-50 disabled:pointer-events-none`}
    >
      {saving ? 'Guardando…' : 'Guardar políticas'}
    </button>
    <p className="text-xs text-slate-500 dark:text-slate-400">
      Usuarios del equipo: pestaña <strong className="text-slate-700 dark:text-slate-200">Equipo</strong> (alta con correo y contraseña).
    </p>
  </div>
);

const PolicyQuickEditor: React.FC<{
  policyJson: string;
  onChangeJson: (s: string) => void;
}> = ({ policyJson, onChangeJson }) => {
  let parsed: Partial<LoongMotorCreditPolicy> | null = null;
  let ok = true;
  try {
    parsed = (JSON.parse(policyJson) || {}) as Partial<LoongMotorCreditPolicy>;
  } catch {
    ok = false;
  }

  const effective = mergeLoongPolicy(parsed);

  const patch = (p: Partial<LoongMotorCreditPolicy>) => {
    let base: Partial<LoongMotorCreditPolicy> = {};
    try {
      base = (JSON.parse(policyJson) || {}) as Partial<LoongMotorCreditPolicy>;
    } catch {
      base = {};
    }
    const next = { ...base, ...p };
    onChangeJson(JSON.stringify(next, null, 2));
  };

  return (
    <div className={`mb-3 ${shellClasses.surfaceCard} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Editor rápido (porcentajes)</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Arrastra para ajustar; se sincroniza con el JSON de abajo.</p>
        </div>
        {!ok ? (
          <span className="text-xs font-semibold text-red-600">JSON inválido: corrígelo para habilitar el editor.</span>
        ) : null}
      </div>
      <div className={`mt-3 grid gap-4 sm:grid-cols-2 ${!ok ? 'opacity-50 pointer-events-none' : ''}`}>
        <PercentSliderField
          label="Enganche mínimo"
          value={effective.minDownPaymentPct}
          onChange={(v) => patch({ minDownPaymentPct: Math.max(0, v || 0) })}
          min={0}
          max={60}
          step={1}
          precision={0}
          helpText="Porcentaje del precio de la moto."
          disabled={!ok}
        />
        <PercentSliderField
          label="Tasa anual de referencia"
          value={effective.annualInterestPct}
          onChange={(v) => patch({ annualInterestPct: Math.max(0, v || 0) })}
          min={0}
          max={120}
          step={0.5}
          precision={1}
          helpText="Se usa para estimar cuota en precalificación."
          disabled={!ok}
        />
        <PercentSliderField
          label="Relación máxima cuota / ingreso"
          value={effective.maxLoanToIncomeRatio}
          onChange={(v) => patch({ maxLoanToIncomeRatio: Math.max(0, Math.min(1, v || 0)) })}
          ratioValue
          min={5}
          max={90}
          step={1}
          precision={0}
          helpText="Cuota estimada / ingreso mensual."
          disabled={!ok}
        />
        <PercentSliderField
          label="Relación máxima (deudas + cuota) / ingreso"
          value={effective.maxDebtToIncomeRatio}
          onChange={(v) => patch({ maxDebtToIncomeRatio: Math.max(0, Math.min(1, v || 0)) })}
          ratioValue
          min={5}
          max={95}
          step={1}
          precision={0}
          helpText="Carga total / ingreso mensual."
          disabled={!ok}
        />
      </div>
    </div>
  );
};
