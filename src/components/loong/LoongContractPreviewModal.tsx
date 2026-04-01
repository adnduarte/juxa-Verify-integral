import React from 'react';
import { generateLoongContractAndPagare, type LoongOriginationCase } from '../../lib/loongOrigination';
import type { LoongMotorCreditPolicy } from '../../lib/loongMotorCredit';
import type { LoongOperationalRules } from '../../lib/loongOperationalRules';

export const LoongContractPreviewModal: React.FC<{
  caseRow: LoongOriginationCase;
  creditPolicy: LoongMotorCreditPolicy;
  opRules: LoongOperationalRules;
  onClose: () => void;
}> = ({ caseRow, creditPolicy, opRules, onClose }) => {
  const { contract, pagare } = generateLoongContractAndPagare(caseRow, creditPolicy, opRules);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Vista previa — contrato y pagaré (simulación)</h3>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            Cerrar
          </button>
        </div>
        <div className="grid flex-1 gap-4 overflow-auto p-4 md:grid-cols-2">
          <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80">
            <h4 className="border-b border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Contrato</h4>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap p-3 font-sans text-xs text-slate-800 dark:text-slate-200">{contract}</pre>
          </div>
          <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80">
            <h4 className="border-b border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Pagaré</h4>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap p-3 font-sans text-xs text-slate-800 dark:text-slate-200">{pagare}</pre>
          </div>
        </div>
        <p className="border-t border-slate-100 dark:border-slate-800 px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
          Texto generado con plantillas operativas y datos del expediente; no sustituye asesoría legal ni versión firmada.
        </p>
      </div>
    </div>
  );
};
