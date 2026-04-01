import React from 'react';
import { RefreshCw } from 'lucide-react';
import { stageLabelEs, type LoongOriginationCase } from '../../lib/loongOrigination';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';

type Props = {
  cases: LoongOriginationCase[];
  loading: boolean;
  onRefresh: () => void;
  title?: string;
  subtitle?: string;
};

export const LoongOriginationCrmTable: React.FC<Props> = ({
  cases,
  loading,
  onRefresh,
  title = 'Expedientes de originación',
  subtitle,
}) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        Actualizar
      </button>
    </div>
    {loading ? (
      <JuxaVerifyLoader text="Cargando expedientes…" />
    ) : cases.length === 0 ? (
      <p className="text-sm text-slate-500 dark:text-slate-400">No hay expedientes.</p>
    ) : (
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Etapa</th>
              <th className="px-3 py-2">Precal</th>
              <th className="px-3 py-2">Formal</th>
              <th className="px-3 py-2">Org / vendedor</th>
              <th className="px-3 py-2">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80/80 dark:bg-slate-950/80">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{c.clientName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{c.clientEmail}</div>
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
                <td className="px-3 py-2 text-xs">
                  {c.formalQualScore != null ? (
                    <span className={c.formalQualPassed === false ? 'text-red-600' : 'text-emerald-700'}>
                      {c.formalQualScore} {c.formalQualPassed === false ? 'no' : c.formalQualPassed ? '✓' : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {c.organizationId || '—'}
                  <br />
                  {c.vendedorUid?.slice(0, 8)}…
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{c.updatedAt?.slice(0, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
