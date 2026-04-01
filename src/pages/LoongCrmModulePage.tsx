import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStatus } from '../contexts/AuthContext';
import type { Role } from '../contexts/AuthContext';
import { DashboardLayout } from '../components/dashboards/DashboardLayout';
import { LoongCrmProspectPanel } from '../components/loong/LoongCrmProspectPanel';
import { LoongCrmRechazadosPanel } from '../components/loong/LoongCrmRechazadosPanel';
import { LoongOriginationCrmFlowBoard } from '../components/loong/LoongOriginationCrmFlowBoard';
import { AppBreadcrumb } from '../components/platform/AppBreadcrumb';
import { LoongSellerCreditIntakeWizard } from '../components/loong/LoongSellerCreditIntakeWizard';
import { LoongPlacementCrmHub } from '../components/loong/LoongPlacementCrmHub';
import { LoongClientJourneyDashboard } from '../components/loong/LoongClientJourneyDashboard';
import type { LoongClientJourneyPhase } from '../lib/loongClientJourney';
import { DEFAULT_LOONG_MOTOR_POLICY, type LoongMotorCreditPolicy } from '../lib/loongMotorCredit';
import { resolveLoongMotorPolicies } from '../lib/loongMotorPolicyFirestore';
import { DEFAULT_LOONG_OPERATIONAL_RULES, type LoongOperationalRules } from '../lib/loongOperationalRules';
import { type LoongOriginationCase } from '../lib/loongOrigination';
import {
  buildLoongMotorSidebarItems,
  resolveLoongWorkspaceActiveTab,
} from '../components/loong/loongMotorSidebar';
import { DEFAULT_ORGANIZATION_ID_LOONG } from '../lib/organizations';

function canSeeAllCases(role: Role): boolean {
  return (
    role === 'ADMIN' ||
    role === 'SUPERVISOR' ||
    role === 'ANALISTA_MESA_CONTROL' ||
    role === 'GERENTE_DIRECTIVO' ||
    role === 'ANALISTA_CREDITO'
  );
}

const COBRANZA_OR_ATENCION_ORG_ROLES: Role[] = ['ADMIN_COBRANZA', 'AGENTE_COBRANZA', 'ATENCION_CLIENTE'];

export const LoongCrmModulePage: React.FC = () => {
  const { user, role, logUserAction, organizationId, clientProfile, orgEnabledProducts, loongTeamTier } =
    useAuthStatus();
  const canManageTeam = role === 'ADMIN' || role === 'SUPERVISOR';
  const investigatorOnly = role === 'INVESTIGADOR';
  const atencionOnly = role === 'ATENCION_CLIENTE';
  const cobranzaOnly = role === 'ADMIN_COBRANZA' || role === 'AGENTE_COBRANZA';

  const { pathname, search } = useLocation();

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
      }),
    [pathname, search, investigatorOnly, atencionOnly, cobranzaOnly, role, canManageTeam, user?.email, loongTeamTier]
  );

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

  const [cases, setCases] = useState<LoongOriginationCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [creditPolicy, setCreditPolicy] = useState<LoongMotorCreditPolicy>({ ...DEFAULT_LOONG_MOTOR_POLICY });
  const [opRules, setOpRules] = useState<LoongOperationalRules>({ ...DEFAULT_LOONG_OPERATIONAL_RULES });
  const [showIntake, setShowIntake] = useState(false);
  const intakeRef = useRef<HTMLDivElement | null>(null);
  const [selectedJourneyPhase, setSelectedJourneyPhase] = useState<LoongClientJourneyPhase | null>(null);

  const loadPolicies = useCallback(async () => {
    try {
      const { creditPolicy, operationalRules } = await resolveLoongMotorPolicies(db, {
        organizationId,
        actingUserId: user?.uid ?? null,
        applyPersonalOverrides: true,
      });
      setCreditPolicy(creditPolicy);
      setOpRules(operationalRules);
    } catch (e) {
      console.error(e);
    }
  }, [organizationId, user?.uid]);

  const loadCases = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingCases(true);
    try {
      let snap;
      if (role && canSeeAllCases(role)) {
        snap = await getDocs(collection(db, 'loong_origination_cases'));
      } else if (role && organizationId && COBRANZA_OR_ATENCION_ORG_ROLES.includes(role)) {
        const q = query(collection(db, 'loong_origination_cases'), where('organizationId', '==', organizationId));
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
  }, [user?.uid, role, organizationId]);

  useEffect(() => {
    loadPolicies();
    loadCases();
  }, [loadPolicies, loadCases]);

  const isLoongMotorContext =
    clientProfile === 'LOONG_MOTOR' ||
    organizationId === DEFAULT_ORGANIZATION_ID_LOONG ||
    (orgEnabledProducts?.includes('LOONG_MOTOR') ?? false);

  if (!isLoongMotorContext) {
    return <Navigate to="/dashboard" replace />;
  }
  if (role === 'CLIENTE') {
    // Vendedor concesionario: no entra al CRM; solo captura inicial y solicita arranque a central.
    return <Navigate to="/dashboard?tab=flow-requests" replace />;
  }
  if (investigatorOnly || atencionOnly || cobranzaOnly) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="h-full p-4 sm:p-8">
      <DashboardLayout
        title="Loong Motor"
        subtitle="CRM colocación: clientes activos, estadísticas, fase previa y expedientes con pagos"
        sidebarItems={sidebarItems}
        activeTab={activeTab}
        onTabChange={() => {}}
      >
        <AppBreadcrumb
          items={[
            { label: 'Panel', to: '/dashboard' },
            { label: 'CRM moto Loong' },
          ]}
        />
        <LoongClientJourneyDashboard
          cases={cases}
          loading={loadingCases}
          selectedPhase={selectedJourneyPhase}
          onSelectPhase={setSelectedJourneyPhase}
        />
        <LoongPlacementCrmHub
          cases={cases}
          loading={loadingCases}
          onRefresh={loadCases}
          role={role}
          userUid={user?.uid}
        />
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setShowIntake(true);
              setTimeout(() => intakeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            }}
            className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-5 text-left shadow-sm transition hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/25"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Iniciar solicitud</p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Nueva solicitud (crédito moto)</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Captura prospecto, genera enlace y sube INE. Se guarda para CRM y seguimiento.
            </p>
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('loong-crm-prospectos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/60"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">CRM</p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Prospectos y expedientes</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {loadingCases ? 'Cargando…' : `${cases.length} registros`} · actualiza, revisa etapas y acciones.
            </p>
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('loong-crm-tablero')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/60"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Flujo</p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Tablero por etapa</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Visualiza el pipeline completo y avanza casos según reglas operativas.
            </p>
          </button>
        </div>

        <div ref={intakeRef} className="scroll-mt-24" id="loong-crm-intake">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Nueva solicitud</p>
            <button
              type="button"
              onClick={() => setShowIntake((v) => !v)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/70"
            >
              {showIntake ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {showIntake ? <LoongSellerCreditIntakeWizard creditPolicy={creditPolicy} onComplete={loadCases} /> : null}
        </div>
        <div className="mt-10">
          <div id="loong-crm-prospectos" className="scroll-mt-24" />
          <LoongCrmProspectPanel
            user={user}
            cases={cases}
            loading={loadingCases}
            onRefresh={loadCases}
            creditPolicy={creditPolicy}
            opRules={opRules}
            logUserAction={logUserAction}
            journeyPhaseFilter={selectedJourneyPhase}
          />
        </div>
        <LoongCrmRechazadosPanel cases={cases} onRefresh={loadCases} />
        <div className="mt-10 min-h-0 flex-1 border-t border-slate-200 pt-6 dark:border-slate-700">
          <div id="loong-crm-tablero" className="scroll-mt-24" />
          <LoongOriginationCrmFlowBoard
            variant="embedded"
            showBackLink={false}
            cases={cases}
            loading={loadingCases}
            onRefresh={loadCases}
            backLinkTo="/dashboard"
            backLinkLabel="Panel principal"
          />
        </div>
      </DashboardLayout>
    </div>
  );
};

/** Tablero global de expedientes (reutilizable en /admin pestaña CRM y en /admin/loong/crm). */
export const LoongOriginationCrmAdminPanel: React.FC<{
  variant?: 'standalone' | 'embedded';
  showBackLink?: boolean;
  backLinkTo?: string;
  backLinkLabel?: string;
}> = ({
  variant = 'standalone',
  showBackLink = true,
  backLinkTo = '/admin',
  backLinkLabel = 'Administración',
}) => {
  const [caseRows, setCaseRows] = useState<LoongOriginationCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);

  const loadOriginationCases = useCallback(async () => {
    setLoadingCases(true);
    try {
      const snap = await getDocs(collection(db, 'loong_origination_cases'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as LoongOriginationCase[];
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setCaseRows(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    loadOriginationCases();
  }, [loadOriginationCases]);

  return (
    <LoongOriginationCrmFlowBoard
      cases={caseRows}
      loading={loadingCases}
      onRefresh={loadOriginationCases}
      variant={variant}
      showBackLink={showBackLink}
      backLinkTo={backLinkTo}
      backLinkLabel={backLinkLabel}
    />
  );
};

/** Vista global de expedientes para admin de plataforma — tablero de flujo completo por etapa. */
export const LoongOriginationCrmAdminPage: React.FC = () => {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col p-4 sm:p-6">
      <AppBreadcrumb
        items={[
          { label: 'Administración', to: '/admin' },
          { label: 'CRM originación' },
        ]}
      />
      <LoongOriginationCrmAdminPanel
        variant="standalone"
        showBackLink
        backLinkTo="/admin"
        backLinkLabel="Administración"
      />
    </div>
  );
};
