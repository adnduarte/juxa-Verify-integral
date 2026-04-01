import React, { useMemo } from 'react';
import type { LoongOriginationCase } from '../../lib/loongOrigination';
import {
  LOONG_CLIENT_JOURNEY_PHASE_ORDER,
  journeyPhaseDescriptionEs,
  journeyPhaseFromOriginationStage,
  journeyPhaseTitleEs,
  type LoongClientJourneyPhase,
} from '../../lib/loongClientJourney';

type Props = {
  cases: LoongOriginationCase[];
  loading?: boolean;
  selectedPhase: LoongClientJourneyPhase | null;
  onSelectPhase: (phase: LoongClientJourneyPhase | null) => void;
};

export const LoongClientJourneyDashboard: React.FC<Props> = ({
  cases,
  loading,
  selectedPhase,
  onSelectPhase,
}) => {
  const counts = useMemo(() => {
    const byPhase: Record<LoongClientJourneyPhase, number> = {
      SOLICITUDES_PRECAL: 0,
      INICIO_SOLICITUD_FORMAL: 0,
      CLIENTES_POTENCIALES: 0,
      CONTRATO_FIRMA_ENTREGA: 0,
      COBRANZA: 0,
      RECHAZADO: 0,
    };
    for (const c of cases) {
      const p = journeyPhaseFromOriginationStage(c.originationStage);
      byPhase[p] += 1;
    }
    return byPhase;
  }, [cases]);

  const activeTotal = cases.length;

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Proceso comercial (5 fases)</h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Vista resumida del recorrido del cliente. Clic en una fase para filtrar la tabla de prospectos debajo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelectPhase(null)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedPhase === null
              ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/80'
          }`}
        >
          Todas ({loading ? '…' : activeTotal})
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {LOONG_CLIENT_JOURNEY_PHASE_ORDER.map((phase) => {
          const n = counts[phase];
          const selected = selectedPhase === phase;
          return (
            <button
              key={phase}
              type="button"
              title={journeyPhaseDescriptionEs(phase)}
              onClick={() => onSelectPhase(selected ? null : phase)}
              className={`rounded-xl border p-3 text-left text-xs transition-colors ${
                selected
                  ? 'border-blue-500 bg-blue-50/90 ring-1 ring-blue-500/30 dark:border-blue-500 dark:bg-blue-950/35'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
              }`}
            >
              <p className="font-semibold leading-snug text-slate-900 dark:text-slate-100">{journeyPhaseTitleEs(phase)}</p>
              <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                {journeyPhaseDescriptionEs(phase)}
              </p>
              <p className="mt-2 text-lg font-bold tabular-nums text-slate-800 dark:text-slate-200">
                {loading ? '—' : n}
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          title={journeyPhaseDescriptionEs('RECHAZADO')}
          onClick={() => onSelectPhase(selectedPhase === 'RECHAZADO' ? null : 'RECHAZADO')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            selectedPhase === 'RECHAZADO'
              ? 'border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-600 dark:bg-rose-950/40 dark:text-rose-100'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/80'
          }`}
        >
          {journeyPhaseTitleEs('RECHAZADO')}: {loading ? '…' : counts.RECHAZADO}
        </button>
      </div>
    </div>
  );
};
