import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LOONG_ORIGINATION_STAGES,
  stageIndex,
  stageLabelEs,
  type LoongOriginationCase,
  type LoongOriginationStage,
} from '../../lib/loongOrigination';

type Props = {
  cases: LoongOriginationCase[];
  loading: boolean;
  onRefresh: () => void;
  backLinkTo?: string;
  backLinkLabel?: string;
  /** Dentro de DashboardLayout: encabezado compacto, sin H1 duplicado. */
  variant?: 'standalone' | 'embedded';
  showBackLink?: boolean;
};

const STAGES: LoongOriginationStage[] = [...LOONG_ORIGINATION_STAGES];

/** Etiqueta corta para cabecera (tooltip = nombre completo). */
function stageHeaderShort(s: LoongOriginationStage): string {
  const map: Partial<Record<LoongOriginationStage, string>> = {
    BORRADOR: 'Borr',
    MESA_INTAKE: 'M1',
    MESA_INTAKE_OK: 'M1✓',
    INVESTIGACION_ARRAIGO: 'Arr',
    INVESTIGACION_ARRAIGO_OK: 'Arr✓',
    PRECUALIFICADO: 'Prec',
    ENLACE_CALIFICACION: 'Enl',
    CALIFICACION_FORMAL_OK: 'For✓',
    MESA_REVISION: 'M2',
    MESA_APROBADO: 'M2✓',
    SUPERVISION_REVISION: 'Sup',
    SUPERVISION_APROBADO: 'Sup✓',
    DOCUMENTACION_GENERADA: 'Doc',
    FIRMAS_PENDIENTE: 'Fir',
    ENTREGA_PROGRAMADA: 'Ent',
    COBRANZA_ACTIVA: 'Cob',
    CERRADO: 'Fin',
    RECHAZADO: 'Rech',
  };
  return map[s] ?? s.slice(0, 3);
}

function cellState(
  caseStage: LoongOriginationStage,
  colStage: LoongOriginationStage,
  colIdx: number
): 'done' | 'current' | 'upcoming' | 'reject_terminal' {
  if (caseStage === 'RECHAZADO') {
    if (colStage === 'RECHAZADO') return 'reject_terminal';
    return 'upcoming';
  }
  const cur = stageIndex(caseStage);
  if (cur < 0) return 'upcoming';
  if (colIdx < cur) return 'done';
  if (colIdx === cur) return 'current';
  return 'upcoming';
}

export const LoongOriginationCrmFlowBoard: React.FC<Props> = ({
  cases,
  loading,
  onRefresh,
  backLinkTo = '/admin',
  backLinkLabel = 'Administración',
  variant = 'standalone',
  showBackLink = true,
}) => {
  const sorted = useMemo(
    () => [...cases].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [cases]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {variant === 'embedded' ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Detalle por etapa del sistema
              </h2>
              <p className="mt-0.5 max-w-3xl text-xs text-slate-600 dark:text-slate-400">
                Cada columna es una etapa técnica del motor (18 etapas). Complementa la vista de 5 fases comerciales arriba.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                CRM originación Loong
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
                Flujo completo visible por expediente: cada columna es una etapa del pipeline. Sin paneles extra ni
                desplegables — desplaza horizontalmente si hace falta.
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Sincronizando…</span>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">{sorted.length} expedientes</span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
          {showBackLink ? (
            <Link
              to={backLinkTo}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800/80"
            >
              {backLinkLabel}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="max-h-[calc(100vh-12rem)] overflow-auto">
          <table className="w-max min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-950">
              <tr>
                <th className="sticky left-0 z-30 min-w-[200px] border-r border-slate-200 bg-slate-100 px-2 py-2 font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
                  Cliente / moto
                </th>
                <th className="sticky left-[200px] z-30 min-w-[120px] border-r border-slate-200 bg-slate-100 px-2 py-2 font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
                  Datos clave
                </th>
                {STAGES.map((st) => (
                  <th
                    key={st}
                    title={stageLabelEs(st)}
                    className="min-w-[44px] max-w-[52px] border-r border-slate-200/80 px-0.5 py-2 text-center align-bottom text-[10px] font-bold uppercase leading-tight text-slate-600 dark:border-slate-700 dark:text-slate-400"
                  >
                    <span className="inline-block rotate-0 whitespace-normal break-words">{stageHeaderShort(st)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && sorted.length === 0
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="animate-pulse bg-slate-50/50 dark:bg-slate-900/50">
                      <td className="sticky left-0 z-10 border-r border-slate-100 bg-slate-50 px-2 py-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="mt-2 h-2 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                      </td>
                      <td className="sticky left-[200px] z-10 border-r border-slate-100 bg-slate-50 px-2 py-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="h-8 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                      </td>
                      {STAGES.map((st) => (
                        <td key={st} className="border-r border-slate-50 px-0 py-2 dark:border-slate-800">
                          <div className="mx-auto h-6 w-5 rounded bg-slate-200 dark:bg-slate-700" />
                        </td>
                      ))}
                    </tr>
                  ))
                : null}

              {!loading && sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + STAGES.length}
                    className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No hay expedientes. Los nuevos aparecerán aquí al crearse en el workspace o CRM.
                  </td>
                </tr>
              ) : null}

              {sorted.map((c) => {
                const isReject = c.originationStage === 'RECHAZADO';
                return (
                  <tr
                    key={c.id}
                    className={
                      isReject
                        ? 'bg-red-50/80 dark:bg-red-950/20'
                        : 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10'
                    }
                  >
                    <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-2 py-2 align-top dark:border-slate-700 dark:bg-slate-900">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{c.clientName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.clientEmail}</div>
                      {c.modeloMoto ? (
                        <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">{c.modeloMoto}</div>
                      ) : null}
                      {isReject && c.rejectionReason ? (
                        <div className="mt-1 line-clamp-2 text-[11px] text-red-700 dark:text-red-300">
                          {c.rejectionReason}
                        </div>
                      ) : null}
                    </td>
                    <td className="sticky left-[200px] z-10 border-r border-slate-200 bg-white px-2 py-2 align-top text-[11px] dark:border-slate-700 dark:bg-slate-900">
                      <div className="space-y-1 text-slate-600 dark:text-slate-300">
                        <div>
                          <span className="text-slate-400">Etapa:</span>{' '}
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {stageLabelEs(c.originationStage)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Org:</span> {c.organizationId || '—'}
                        </div>
                        <div className="truncate font-mono text-[10px] text-slate-500" title={c.vendedorEmail || c.vendedorUid}>
                          {c.vendedorEmail || `${c.vendedorUid?.slice(0, 10)}…`}
                        </div>
                        <div>
                          Precal:{' '}
                          {c.precalScore != null ? (
                            <span className={c.precalPassed ? 'text-emerald-700' : 'text-amber-700'}>
                              {c.precalScore}
                              {c.precalPassed ? ' ✓' : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                        </div>
                        <div>
                          Formal:{' '}
                          {c.formalQualScore != null ? (
                            <span className={c.formalQualPassed === false ? 'text-red-600' : 'text-emerald-700'}>
                              {c.formalQualScore}
                              {c.formalQualPassed ? ' ✓' : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                        </div>
                        <div className="text-slate-400">{c.updatedAt?.slice(0, 16) ?? '—'}</div>
                      </div>
                    </td>
                    {STAGES.map((st, colIdx) => {
                      const state = cellState(c.originationStage, st, colIdx);
                      const title = `${stageLabelEs(st)} — ${c.clientName}`;
                      if (state === 'reject_terminal') {
                        return (
                          <td
                            key={st}
                            title={title}
                            className="border-r border-slate-100 px-0 py-1 text-center align-middle dark:border-slate-800"
                          >
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-200 text-sm font-bold text-red-900 dark:bg-red-900/50 dark:text-red-100">
                              ⊗
                            </span>
                          </td>
                        );
                      }
                      if (state === 'done') {
                        return (
                          <td
                            key={st}
                            title={title}
                            className="border-r border-slate-100 px-0 py-1 text-center align-middle dark:border-slate-800"
                          >
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                              ✓
                            </span>
                          </td>
                        );
                      }
                      if (state === 'current') {
                        return (
                          <td
                            key={st}
                            title={title}
                            className="border-r border-slate-100 px-0 py-1 text-center align-middle dark:border-slate-800"
                          >
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-200 ring-2 ring-amber-500 dark:bg-amber-900/50 dark:ring-amber-400">
                              <span className="h-2 w-2 rounded-full bg-amber-700 dark:bg-amber-300" />
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={st}
                          title={title}
                          className="border-r border-slate-50 px-0 py-1 text-center align-middle dark:border-slate-800/80"
                        >
                          <span className="inline-block h-7 w-7 rounded-md bg-slate-100 dark:bg-slate-800/80" />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-500">
        Leyenda: verde = etapa ya superada; ámbar = etapa actual; vacío = pendiente; ⊗ = rechazado. Pasa el cursor
        sobre la cabecera para el nombre completo de cada fase.
      </p>
    </div>
  );
};
