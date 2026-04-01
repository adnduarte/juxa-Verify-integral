import React, { useCallback, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { BarChart3, CircleDollarSign, Search, Users } from 'lucide-react';
import { db } from '../../firebase';
import type { Role } from '../../contexts/AuthContext';
import { shellClasses } from '../../config/brand';
import {
  stageLabelEs,
  type LoongOriginationCase,
  type LoongOriginationStage,
} from '../../lib/loongOrigination';
import {
  LOONG_PLACEMENT_STRIP_STAGES,
  countCasesByStage,
  isActiveOriginationCase,
  isColocacionActivaPagosSegment,
  isPreColocacionCrmSegment,
  isTerminalOriginationStage,
  placementStripCell,
  type StripCell,
} from '../../lib/loongPlacementCrm';
import { toast } from 'react-hot-toast';

type HubTab = 'resumen' | 'previa' | 'pagos';

function stripHeaderShort(s: LoongOriginationStage): string {
  const map: Partial<Record<LoongOriginationStage, string>> = {
    MESA_INTAKE_OK: 'Intake',
    INVESTIGACION_ARRAIGO_OK: 'Arraigo',
    CALIFICACION_FORMAL_OK: 'Formal',
    MESA_APROBADO: 'Mesa',
    SUPERVISION_APROBADO: 'Sup.',
    DOCUMENTACION_GENERADA: 'Docs',
    FIRMAS_PENDIENTE: 'Firmas',
    ENTREGA_PROGRAMADA: 'Entrega',
    COBRANZA_ACTIVA: 'Cobranza',
  };
  return map[s] ?? s.slice(0, 4);
}

function canEditMilestones(role: Role | null, userUid: string | undefined, c: LoongOriginationCase): boolean {
  if (!userUid) return false;
  if (c.vendedorUid === userUid) return true;
  return role === 'ADMIN' || role === 'SUPERVISOR' || role === 'ANALISTA_MESA_CONTROL';
}

function cellClass(cell: StripCell): string {
  switch (cell) {
    case 'done':
      return 'bg-[var(--color-juxa-accent-muted)] text-[var(--color-juxa-accent)] ring-1 ring-[color-mix(in_srgb,var(--color-juxa-accent)_25%,transparent)]';
    case 'current':
      return 'bg-[var(--color-juxa-accent)] text-[var(--color-juxa-accent-foreground)] shadow-sm';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200 ring-1 ring-red-200/80 dark:ring-red-900/50';
    default:
      return 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500';
  }
}

const PipelineStrip: React.FC<{ stage: LoongOriginationStage }> = ({ stage }) => (
  <div className="flex flex-wrap items-center gap-1">
    {LOONG_PLACEMENT_STRIP_STAGES.map((col) => {
      const cell = placementStripCell(stage, col);
      return (
        <span
          key={col}
          title={stageLabelEs(col)}
          className={`inline-flex h-7 min-w-[2rem] items-center justify-center rounded-md px-1 text-[10px] font-semibold ${cellClass(cell)}`}
        >
          {stripHeaderShort(col)}
        </span>
      );
    })}
  </div>
);

export const LoongPlacementCrmHub: React.FC<{
  cases: LoongOriginationCase[];
  loading: boolean;
  onRefresh: () => void;
  role: Role | null;
  userUid: string | undefined;
}> = ({ cases, loading, onRefresh, role, userUid }) => {
  const [tab, setTab] = useState<HubTab>('resumen');
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeCases = useMemo(() => cases.filter(isActiveOriginationCase), [cases]);
  const previaList = useMemo(() => activeCases.filter(isPreColocacionCrmSegment), [activeCases]);
  const pagosList = useMemo(() => activeCases.filter(isColocacionActivaPagosSegment), [activeCases]);
  const closedN = useMemo(() => cases.filter((c) => c.originationStage === 'CERRADO').length, [cases]);
  const rejectedN = useMemo(() => cases.filter((c) => c.originationStage === 'RECHAZADO').length, [cases]);

  const byStage = useMemo(() => countCasesByStage(cases), [cases]);

  const funnelPrev = useMemo(() => {
    const inMesaIntake = cases.filter((c) => c.originationStage === 'MESA_INTAKE' || c.originationStage === 'BORRADOR').length;
    const postIntake = cases.filter((c) => {
      const s = c.originationStage;
      return !isTerminalOriginationStage(s) && ['MESA_INTAKE_OK', 'INVESTIGACION_ARRAIGO', 'INVESTIGACION_ARRAIGO_OK', 'PRECUALIFICADO', 'ENLACE_CALIFICACION'].includes(s);
    }).length;
    const formalPlus = cases.filter((c) => {
      const s = c.originationStage;
      return !isTerminalOriginationStage(s) && ['CALIFICACION_FORMAL_OK', 'MESA_REVISION', 'MESA_APROBADO', 'SUPERVISION_REVISION', 'SUPERVISION_APROBADO'].includes(s);
    }).length;
    const cierreColoc = cases.filter((c) => {
      const s = c.originationStage;
      return !isTerminalOriginationStage(s) && ['DOCUMENTACION_GENERADA', 'FIRMAS_PENDIENTE', 'ENTREGA_PROGRAMADA'].includes(s);
    }).length;
    const cobranza = cases.filter((c) => c.originationStage === 'COBRANZA_ACTIVA').length;
    return { inMesaIntake, postIntake, formalPlus, cierreColoc, cobranza };
  }, [cases]);

  const patchMilestones = useCallback(
    async (c: LoongOriginationCase, patch: Partial<NonNullable<LoongOriginationCase['commercialMilestones']>>) => {
      if (!canEditMilestones(role, userUid, c)) {
        toast.error('No tienes permiso para actualizar pagos en este expediente.');
        return;
      }
      setBusyId(c.id);
      const now = new Date().toISOString();
      const m = c.commercialMilestones || {};
      const eng = 'enganchePagado' in patch ? !!patch.enganchePagado : !!m.enganchePagado;
      const inv = 'investigacionPagada' in patch ? !!patch.investigacionPagada : !!m.investigacionPagada;
      try {
        await updateDoc(doc(db, 'loong_origination_cases', c.id), {
          commercialMilestones: {
            enganchePagado: eng,
            enganchePagadoAt: eng ? m.enganchePagadoAt || now : null,
            investigacionPagada: inv,
            investigacionPagadaAt: inv ? m.investigacionPagadaAt || now : null,
          },
          updatedAt: now,
        });
        toast.success('Pagos actualizados');
        onRefresh();
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      } finally {
        setBusyId(null);
      }
    },
    [onRefresh, role, userUid]
  );

  const tabs: { id: HubTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'resumen', label: 'Resumen', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'previa', label: 'Fase previa (colocación)', icon: <Users className="h-4 w-4" />, count: previaList.length },
    { id: 'pagos', label: 'Clientes con pago', icon: <CircleDollarSign className="h-4 w-4" />, count: pagosList.length },
  ];

  return (
    <div className={`${shellClasses.surfaceCard} mb-8 overflow-hidden p-0`}>
      <div className="border-b border-slate-200/90 px-4 py-4 dark:border-slate-800 sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">CRM clientes activos — colocación Loong</h2>
            <p className="mt-0.5 max-w-3xl text-xs text-slate-600 dark:text-slate-400">
              Resumen operativo, prospectos en fase previa a colocación y expedientes con enganche o investigación pagados para seguir el flujo.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={`${shellClasses.btnSecondary} mt-2 shrink-0 sm:mt-0`}
          >
            {loading ? 'Actualizando…' : 'Actualizar datos'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id ? shellClasses.navActive : shellClasses.navInactive
              }`}
            >
              {t.icon}
              {t.label}
              {t.count != null ? (
                <span className="rounded-md bg-white/30 px-1.5 text-xs dark:bg-black/20">{t.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6">
        {tab === 'resumen' && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700/80 dark:bg-slate-950/40">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Activos</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{activeCases.length}</p>
                <p className="mt-1 text-xs text-slate-500">Sin cerrar ni rechazar</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700/80 dark:bg-slate-950/40">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Fase previa</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{previaList.length}</p>
                <p className="mt-1 text-xs text-slate-500">Sin enganche / investigación marcados</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700/80 dark:bg-slate-950/40">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Con pago registrado</p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-juxa-accent)]">{pagosList.length}</p>
                <p className="mt-1 text-xs text-slate-500">Enganche o investigación</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700/80 dark:bg-slate-950/40">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cerrados / rechazados</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {closedN} / {rejectedN}
                </p>
                <p className="mt-1 text-xs text-slate-500">Histórico en esta vista</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Embudo colocación (activos por bloque)</h3>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Agrupación orientativa para ver carga de trabajo hasta cobranza.
              </p>
              <div className="grid gap-2 sm:grid-cols-5">
                {[
                  { k: 'Intake / borrador', n: funnelPrev.inMesaIntake },
                  { k: 'Post-intake / precal', n: funnelPrev.postIntake },
                  { k: 'Formal / mesas', n: funnelPrev.formalPlus },
                  { k: 'Docs / firmas / entrega', n: funnelPrev.cierreColoc },
                  { k: 'Cobranza activa', n: funnelPrev.cobranza },
                ].map((row) => (
                  <div
                    key={row.k}
                    className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700/80 dark:bg-slate-900/60"
                  >
                    <p className="text-[10px] font-medium uppercase leading-tight text-slate-500 dark:text-slate-400">{row.k}</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{row.n}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Expedientes por etapa (todos)</h3>
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Etapa</th>
                      <th className="px-3 py-2 font-semibold">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byStage)
                      .filter(([, n]) => n > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([st, n]) => (
                        <tr key={st} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{stageLabelEs(st as LoongOriginationStage)}</td>
                          <td className="px-3 py-1.5 font-medium">{n}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'previa' && (
          <div>
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200/80 bg-slate-50/90 p-3 text-xs text-slate-600 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-slate-400">
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>
                Aquí concentras <strong className="text-slate-800 dark:text-slate-200">todo lo previo a colocación firme</strong>: alta, mesa inicial, arraigo, precalificación y calificación formal, mientras{' '}
                <strong className="text-slate-800 dark:text-slate-200">no</strong> marques enganche o investigación pagados. Cuando cobres, usa los toggles o pasa al tab «Clientes con pago».
              </p>
            </div>
            <CaseTable
              rows={previaList}
              loading={loading}
              showMilestones
              showStrip
              busyId={busyId}
              onPatchMilestones={patchMilestones}
              role={role}
              userUid={userUid}
            />
          </div>
        )}

        {tab === 'pagos' && (
          <div>
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200/80 bg-slate-50/90 p-3 text-xs text-slate-600 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-slate-400">
              <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-juxa-accent)]" />
              <p>
                Expedientes con <strong className="text-slate-800 dark:text-slate-200">enganche o investigación</strong> registrados como pagados. La franja muestra en qué punto del flujo de colocación va cada cliente.
              </p>
            </div>
            <CaseTable
              rows={pagosList}
              loading={loading}
              showMilestones
              showStrip
              busyId={busyId}
              onPatchMilestones={patchMilestones}
              role={role}
              userUid={userUid}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const CaseTable: React.FC<{
  rows: LoongOriginationCase[];
  loading: boolean;
  showMilestones?: boolean;
  showStrip?: boolean;
  busyId: string | null;
  onPatchMilestones: (c: LoongOriginationCase, p: Partial<NonNullable<LoongOriginationCase['commercialMilestones']>>) => void;
  role: Role | null;
  userUid: string | undefined;
}> = ({ rows, loading, showMilestones, showStrip, busyId, onPatchMilestones, role, userUid }) => {
  if (loading && rows.length === 0) {
    return <p className="text-sm text-slate-500">Cargando expedientes…</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No hay expedientes en este apartado.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs dark:border-slate-700 dark:bg-slate-800/80">
          <tr>
            <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">Cliente</th>
            <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">Etapa actual</th>
            {showMilestones ? (
              <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">Pagos</th>
            ) : null}
            {showStrip ? (
              <th className="min-w-[320px] px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">Flujo colocación</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const edit = canEditMilestones(role, userUid, c);
            const m = c.commercialMilestones;
            const busy = busyId === c.id;
            return (
              <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 align-top">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{c.clientName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{c.clientEmail}</p>
                  {c.vendedorEmail ? (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Vend.: {c.vendedorEmail}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2 align-top text-xs text-slate-700 dark:text-slate-300">
                  {stageLabelEs(c.originationStage)}
                </td>
                {showMilestones ? (
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col gap-1.5">
                      <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-[var(--color-juxa-accent)] focus:ring-[var(--color-juxa-accent)]"
                          checked={!!m?.enganchePagado}
                          disabled={!edit || busy}
                          onChange={(e) => onPatchMilestones(c, { enganchePagado: e.target.checked })}
                        />
                        <span>Enganche</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-[var(--color-juxa-accent)] focus:ring-[var(--color-juxa-accent)]"
                          checked={!!m?.investigacionPagada}
                          disabled={!edit || busy}
                          onChange={(e) => onPatchMilestones(c, { investigacionPagada: e.target.checked })}
                        />
                        <span>Investigación</span>
                      </label>
                    </div>
                  </td>
                ) : null}
                {showStrip ? (
                  <td className="px-3 py-2 align-top">
                    <PipelineStrip stage={c.originationStage} />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
