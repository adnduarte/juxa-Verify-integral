import React, { useMemo, useState } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  Circle,
  ClipboardList,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { chatFordAuditAssistant } from '../../lib/gemini';

export interface AuditInvestigationLike {
  id: string;
  status?: string;
  creditPipelineStage?: string;
  organizationId?: string;
  vertical?: string;
  createdAt?: string;
  contractReference?: string;
  entityState?: string;
}

const GUIDED_STEPS = [
  {
    id: 'scope',
    title: 'Alcance temporal',
    detail: 'Define el periodo y revisa el volumen de expedientes incluidos.',
  },
  {
    id: 'desviaciones',
    title: 'Desviaciones de proceso',
    detail: 'Compara etapas del pipeline vs estados; identifica rebotes a agencia o mesa.',
  },
  {
    id: 'identidad',
    title: 'Consistencia identidad / documentación',
    detail:
      'Revisa preanálisis de identidad y señales de alteración (referencia: expedientes tipo doc base sin vs con usurpación).',
  },
  {
    id: 'riesgos',
    title: 'Riesgos y seguimiento',
    detail: 'Prioriza expedientes que requieran atención y documenta hallazgos.',
  },
];

function startOfDayISO(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function endOfDayISO(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

export interface FordAuditPeriodPanelProps {
  investigations: AuditInvestigationLike[];
  agencyLabelByOrgId?: Record<string, string>;
  variant?: 'admin' | 'ford_supervisor';
}

export const FordAuditPeriodPanel: React.FC<FordAuditPeriodPanelProps> = ({
  investigations,
  agencyLabelByOrgId,
  variant = 'ford_supervisor',
}) => {
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setMonth(defaultFrom.getMonth() - 1);

  const [fromDate, setFromDate] = useState(defaultFrom.toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10));
  const [guidedDone, setGuidedDone] = useState<Record<string, boolean>>({});
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const inPeriod = useMemo(() => {
    const start = startOfDayISO(new Date(fromDate));
    const end = endOfDayISO(new Date(toDate));
    return investigations.filter((inv) => {
      const c = inv.createdAt ? new Date(inv.createdAt).toISOString() : '';
      return c >= start && c <= end;
    });
  }, [investigations, fromDate, toDate]);

  const snapshot = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byStage: Record<string, number> = {};
    const byOrg: Record<string, number> = {};
    for (const inv of inPeriod) {
      const st = inv.status || 'UNKNOWN';
      const stg = inv.creditPipelineStage || 'SIN_ETAPA';
      const org = inv.organizationId || 'sin_org';
      byStatus[st] = (byStatus[st] || 0) + 1;
      byStage[stg] = (byStage[stg] || 0) + 1;
      byOrg[org] = (byOrg[org] || 0) + 1;
    }
    return {
      variant,
      period: { from: fromDate, to: toDate },
      expedientesEnPeriodo: inPeriod.length,
      porStatus: byStatus,
      porEtapaPipeline: byStage,
      porOrganizacionId: byOrg,
      etiquetasAgencia: agencyLabelByOrgId || {},
      muestraIds: inPeriod.slice(0, 12).map((i) => i.id),
    };
  }, [inPeriod, fromDate, toDate, variant, agencyLabelByOrgId]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatLoading(true);
    const nextHist = [...chatHistory, { role: 'user' as const, text }];
    setChatHistory(nextHist);
    setChatInput('');
    try {
      const reply = await chatFordAuditAssistant(nextHist, text, snapshot as Record<string, unknown>);
      setChatHistory([...nextHist, { role: 'model', text: reply || '(sin respuesta)' }]);
    } catch {
      setChatHistory([
        ...nextHist,
        { role: 'model', text: 'Error al consultar el asistente. Revisa la API de IA.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const presetQuestion =
    'Resume los riesgos principales en este periodo y qué revisar primero según el snapshot.';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CalendarRange className="w-6 h-6 text-[#003478]" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Auditoría por periodos</h2>
            <p className="text-xs text-slate-500">
              Vista agregada sobre expedientes; el asistente usa solo datos del panel (sin expedientes completos PDF).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desde</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hasta</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div className="text-sm text-slate-700">
            <strong>{inPeriod.length}</strong> expedientes en el periodo
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-5 h-5 text-blue-800" />
          <h3 className="font-bold text-blue-950">Flujo guiado (predeterminado)</h3>
        </div>
        <ol className="space-y-3">
          {GUIDED_STEPS.map((step, idx) => (
            <li key={step.id} className="flex gap-3">
              <button
                type="button"
                onClick={() => setGuidedDone((m) => ({ ...m, [step.id]: !m[step.id] }))}
                className="shrink-0 mt-0.5 text-blue-600"
              >
                {guidedDone[step.id] ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5 text-blue-300" />
                )}
              </button>
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  {idx + 1}. {step.title}
                </p>
                <p className="text-xs text-slate-600">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Por estatus</p>
          <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
            {Object.entries(snapshot.porStatus).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="font-bold">{v}</span>
              </li>
            ))}
            {Object.keys(snapshot.porStatus).length === 0 && (
              <li className="text-slate-400 text-xs">Sin datos</li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Por etapa pipeline</p>
          <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
            {Object.entries(snapshot.porEtapaPipeline).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="truncate mr-2">{k}</span>
                <span className="font-bold shrink-0">{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Por agencia</p>
          <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
            {Object.entries(snapshot.porOrganizacionId).map(([orgId, v]) => (
              <li key={orgId} className="flex justify-between gap-2">
                <span className="truncate" title={orgId}>
                  {agencyLabelByOrgId?.[orgId] || orgId}
                </span>
                <span className="font-bold shrink-0">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <h3 className="font-bold text-slate-900">Auditoría inteligente</h3>
          <ShieldCheck className="w-4 h-4 text-emerald-600 ml-auto" />
        </div>
        <button
          type="button"
          className="text-xs text-violet-700 underline mb-3"
          onClick={() => {
            setChatInput(presetQuestion);
          }}
        >
          Usar pregunta sugerida
        </button>
        <div className="rounded-xl bg-slate-50 border border-slate-100 max-h-64 overflow-y-auto p-3 space-y-2 text-sm mb-3">
          {chatHistory.length === 0 ? (
            <p className="text-slate-500 text-xs">
              Haz una pregunta sobre cumplimiento operativo, cuellos de botella o riesgos en el periodo seleccionado.
            </p>
          ) : (
            chatHistory.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-blue-100 text-blue-950 ml-8' : 'bg-white border border-slate-200 mr-8'}`}
              >
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  {m.role === 'user' ? 'Tú' : 'IA'}
                </span>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            ))
          )}
          {chatLoading && (
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Generando…
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder="Ej. ¿Qué agencias concentran devoluciones a agencia?"
            className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm"
          />
          <button
            type="button"
            onClick={sendChat}
            disabled={chatLoading}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
};
