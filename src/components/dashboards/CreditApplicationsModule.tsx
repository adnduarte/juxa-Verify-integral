import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Building2,
  Calculator,
  Clock,
  Search,
  Download,
  Brain,
  User,
  Scale,
  AlertTriangle,
  List,
  X,
} from 'lucide-react';
import { AIResultRenderer } from '../AIResultRenderer';
import type { MesaPrecalInvInput } from '../../lib/mesaCreditDictamen';
import {
  mesaPrecalFlowBadgeClass,
  mesaPrecalFlowLabel,
  mesaPrecalFlowState,
  parseMesaAutoReasons,
} from '../../lib/mesaCreditDictamen';

interface CreditApplicationsModuleProps {
  investigations: any[];
}

function safeJsonParse<T = any>(raw: unknown): T | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200'
      : score >= 40
        ? 'text-amber-800 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200'
        : 'text-red-700 bg-red-100 dark:bg-red-950/40 dark:text-red-200';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${color}`}>
      Score {Math.round(score)}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const stroke = s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';
  const dash = 226.2;
  const off = dash - (dash * s) / 100;
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r="36" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="transparent"
          stroke={stroke}
          strokeWidth="6"
          strokeDasharray={dash}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xl font-black text-slate-900 dark:text-slate-100">{Math.round(s)}</span>
    </div>
  );
}

function CreditScoreSection({ inv }: { inv: any }) {
  const dictamenObj = useMemo(() => safeJsonParse<any>(inv?.socioeconomicDictamen), [inv?.socioeconomicDictamen]);
  const dictamenFinal = dictamenObj?.dictamenFinal ?? null;
  const score = typeof inv?.score === 'number' ? inv.score : typeof dictamenObj?.score === 'number' ? dictamenObj.score : null;
  const scoreBreakdownObj =
    safeJsonParse<Record<string, number>>(inv?.scoreBreakdown) ??
    (dictamenObj?.scoreBreakdown && typeof dictamenObj.scoreBreakdown === 'object' ? dictamenObj.scoreBreakdown : null);
  const banderasRojas = Array.isArray(dictamenObj?.banderasRojas) ? dictamenObj.banderasRojas.map(String) : [];

  if (score === null && !dictamenFinal && banderasRojas.length === 0) return null;

  const estado = typeof dictamenFinal?.estado === 'string' ? dictamenFinal.estado : '';
  const resumen = typeof dictamenFinal?.resumen === 'string' ? dictamenFinal.resumen : '';
  const estadoClass =
    estado === 'VIABLE'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
      : estado === 'NO VIABLE'
        ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200';

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-bold text-slate-900 dark:text-slate-100">Calificación (score) y dictamen</h3>
        {typeof score === 'number' ? <ScoreBadge score={score} /> : null}
        {estado ? (
          <span className={`ml-auto rounded-full px-3 py-1 text-[10px] font-bold uppercase ${estadoClass}`}>{estado}</span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 p-4">
          {typeof score === 'number' ? (
            <ScoreRing score={score} />
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">Sin score numérico</p>
          )}
        </div>

        <div className="md:col-span-2 space-y-3">
          {resumen ? (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 p-4">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Resumen</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{resumen}</p>
            </div>
          ) : null}

          {scoreBreakdownObj ? (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 p-4">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Desglose de score</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(scoreBreakdownObj).map(([k, v]) => {
                  const val = Number(v) || 0;
                  return (
                    <div key={k} className="rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate">{k}</p>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{val} pts</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {banderasRojas.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-red-200/70 dark:border-red-900/40 bg-red-50/70 dark:bg-red-950/20 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-300" />
            <p className="text-xs font-bold text-red-700 dark:text-red-200 uppercase tracking-wider">Banderas rojas</p>
          </div>
          <ul className="mt-2 list-disc list-inside text-sm text-red-800 dark:text-red-100 space-y-1">
            {banderasRojas.map((b: string, idx: number) => (
              <li key={idx}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MesaDictamenOriginacionCard({ inv }: { inv: MesaPrecalInvInput & Record<string, unknown> }) {
  const flow = mesaPrecalFlowState(inv);
  const autoReasons = parseMesaAutoReasons(inv.mesaPrecalAutoReasons as string | undefined);
  const decidedAt = inv.mesaPrecalDecidedAt as string | undefined;
  const mesaNote = inv.mesaPrecalNote as string | undefined;
  const autoRef = inv.mesaAutomatedDictamen as string | undefined;
  const autoPassed = inv.mesaPrecalAutoPassed as boolean | undefined;
  const ms = inv.mesaPrecalStatus as string | undefined;

  return (
    <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/90 dark:border-indigo-900/50 dark:bg-indigo-950/30 p-5 mb-8">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Scale className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-bold text-slate-900 dark:text-slate-100">Dictamen y mesa de control (originación)</h3>
        <span
          className={`ml-auto rounded-full px-3 py-0.5 text-[10px] font-bold uppercase ${mesaPrecalFlowBadgeClass(flow)}`}
        >
          {mesaPrecalFlowLabel(flow)}
        </span>
      </div>
      <ol className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-xs font-bold text-indigo-600 ring-1 ring-indigo-200 dark:ring-indigo-800">
            1
          </span>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">Precalificación del candidato</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cuestionario y teléfono en enlace. Sin dictamen de mesa aún hasta cerrar esta etapa.
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-xs font-bold text-indigo-600 ring-1 ring-indigo-200 dark:ring-indigo-800">
            2
          </span>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">Motor automático (referencia)</p>
            {ms === 'precal_failed' ? (
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">No favorable. El expediente queda para revisión.</p>
            ) : autoPassed === true || ms === 'pending' || ms === 'approved' || ms === 'rejected' ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Resultado referencia:{' '}
                <strong>{autoPassed === true ? 'Favorable' : autoPassed === false ? 'No favorable' : '—'}</strong>
                {autoRef ? (
                  <span className="block mt-1 rounded-lg bg-white/80 dark:bg-slate-900/80 px-2 py-1 text-slate-700 dark:text-slate-200">
                    {autoRef}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pendiente de que el candidato envíe la precalificación.</p>
            )}
            {autoReasons.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-slate-600 dark:text-slate-300">
                {autoReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-xs font-bold text-indigo-600 ring-1 ring-indigo-200 dark:ring-indigo-800">
            3
          </span>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">Resolución mesa de control (vinculante)</p>
            {ms === 'pending' || inv.linkStatus === 'AWAITING_MESA' ? (
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                En análisis. La decisión final (procedente / no procedente) la registra mesa con fundamento.
              </p>
            ) : ms === 'approved' ? (
              <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-1 font-medium">
                Procedente — autorizado continuar con ubicación, INE y evidencias de arraigo.
              </p>
            ) : ms === 'rejected' ? (
              <p className="text-xs text-red-800 dark:text-red-200 mt-1 font-medium">No procedente — solicitud cerrada por mesa.</p>
            ) : ms === 'precal_failed' ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Sin paso de mesa: cortó la precalificación automática.</p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Aún no aplica hasta envío y reglas automáticas.</p>
            )}
            {mesaNote ? (
              <div className="mt-2 rounded-xl border border-indigo-200/60 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100">
                <span className="font-semibold text-indigo-800 dark:text-indigo-200">Fundamento / dictamen mesa:</span>
                <p className="mt-1 whitespace-pre-wrap">{mesaNote}</p>
                {decidedAt ? (
                  <p className="mt-2 text-[10px] text-slate-400">Registrado: {new Date(decidedAt).toLocaleString()}</p>
                ) : null}
              </div>
            ) : (ms === 'approved' || ms === 'rejected') && !mesaNote ? (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">Sin texto de fundamento en expediente.</p>
            ) : null}
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-xs font-bold text-indigo-600 ring-1 ring-indigo-200 dark:ring-indigo-800">
            4
          </span>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">Dictamen integral (IA)</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tras documentación y visita, se muestra abajo el análisis socioeconómico y dictamen final de riesgo.
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}

export const CreditApplicationsModule: React.FC<CreditApplicationsModuleProps> = ({ investigations }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterScope, setFilterScope] = useState<'ALL' | 'BASIC' | 'INTERMEDIATE' | 'ADVANCED'>('ALL');
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [listSheetOpen, setListSheetOpen] = useState(false);

  const creditApps = investigations.filter(inv => 
    inv.clientProfile === 'CREDIT' && 
    (searchTerm === '' || inv.title.toLowerCase().includes(searchTerm.toLowerCase()) || inv.id.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterScope === 'ALL' || inv.investigationScope === filterScope)
  );

  useEffect(() => {
    setSelectedApp((prev) => {
      if (!prev) return prev;
      return creditApps.some((a) => a.id === prev.id) ? prev : null;
    });
  }, [creditApps]);

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case 'BASIC':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">Pre-calificación</span>;
      case 'INTERMEDIATE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">Mesa de Control</span>;
      case 'ADVANCED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-700">Integral</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{scope}</span>;
    }
  };

  const renderAppList = (onPick: (app: (typeof creditApps)[0]) => void) => (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {creditApps.length === 0 ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">No se encontraron solicitudes.</div>
      ) : (
        creditApps.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => onPick(app)}
            className={`w-full p-4 text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-800/80 flex flex-col gap-2 ${
              selectedApp?.id === app.id ? 'bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
                INV-{app.id.substring(0, 6)}
              </span>
              {getScopeBadge(app.investigationScope)}
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 line-clamp-2">{app.title}</h3>
            <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <Clock className="w-3 h-3 shrink-0" />
                {new Date(app.createdAt).toLocaleDateString()}
              </div>
              <div className="flex flex-wrap items-center gap-1 justify-end">
                {((app.investigationScope === 'BASIC' && app.clientProfile === 'CREDIT') ||
                  (app.investigationScope === 'LOONG_PRECAL' &&
                    (app.clientProfile === 'LOONG_MOTOR' || app.investigationType === 'LOONG_MOTOR'))) ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase max-w-[200px] truncate ${mesaPrecalFlowBadgeClass(
                      mesaPrecalFlowState(app)
                    )}`}
                    title={mesaPrecalFlowLabel(mesaPrecalFlowState(app))}
                  >
                    {mesaPrecalFlowLabel(mesaPrecalFlowState(app))}
                  </span>
                ) : null}
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    app.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : app.status === 'PENDING'
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {app.status === 'COMPLETED' ? 'Completado' : app.status === 'PENDING' ? 'Pendiente' : 'En Proceso'}
                </span>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );

  return (
    <div className="w-full space-y-4">
      {/* Una sola franja de controles: evita segunda columna fija junto al menú principal */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Solicitudes de crédito</h2>
            <button
              type="button"
              onClick={() => setListSheetOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            >
              <List className="h-4 w-4" aria-hidden />
              Lista ({creditApps.length})
            </button>
          </div>

          <label className="sr-only" htmlFor="credit-app-picker">
            Elegir solicitud
          </label>
          <select
            id="credit-app-picker"
            value={selectedApp?.id ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedApp(id ? creditApps.find((a) => a.id === id) ?? null : null);
            }}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          >
            <option value="">— Elegir una solicitud —</option>
            {creditApps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.title} · INV-{app.id.substring(0, 6)} ·{' '}
                {app.investigationScope === 'BASIC'
                  ? 'Pre-cal'
                  : app.investigationScope === 'INTERMEDIATE'
                    ? 'Mesa'
                    : app.investigationScope === 'ADVANCED'
                      ? 'Integral'
                      : app.investigationScope}
              </option>
            ))}
          </select>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="search"
                placeholder="Buscar por nombre o ID…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar shrink-0">
              {(['ALL', 'BASIC', 'INTERMEDIATE', 'ADVANCED'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setFilterScope(scope)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                    filterScope === scope
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {scope === 'ALL' ? 'Todos' : scope === 'BASIC' ? 'Pre-cal' : scope === 'INTERMEDIATE' ? 'Mesa' : 'Integral'}
                </button>
              ))}
            </div>
          </div>

          {/* Lista auxiliar solo en escritorio: colapsable, no consume ancho fijo como segunda columna */}
          <details className="hidden lg:block border-t border-slate-100 dark:border-slate-800 pt-3 mt-2">
            <summary className="cursor-pointer text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2 py-1.5 select-none list-none marker:content-none [&::-webkit-details-marker]:hidden hover:text-slate-900 dark:hover:text-slate-100">
              <List className="h-4 w-4 shrink-0" aria-hidden />
              Ver lista de solicitudes (opcional)
            </summary>
            <div className="mt-2 max-h-[min(40vh,320px)] overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              {renderAppList((app) => setSelectedApp(app))}
            </div>
          </details>
        </div>
      </div>

      {/* Detalle a ancho completo del área de contenido */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden min-h-[min(70vh,720px)] flex flex-col">
        {selectedApp ? (
          <>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Detalle de Solicitud</span>
                  {getScopeBadge(selectedApp.investigationScope)}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedApp.title}</h2>
              </div>
              <div className="flex gap-2">
                <button className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedApp.investigationScope === 'BASIC' && selectedApp.clientProfile === 'CREDIT' ? (
                <MesaDictamenOriginacionCard inv={selectedApp} />
              ) : null}
              <CreditScoreSection inv={selectedApp} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Calculator className="w-4 h-4" /> Parámetros del Crédito
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Monto Capital:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">${selectedApp.montoCreditoCapital || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Monto c/Intereses:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">${selectedApp.montoCreditoIntereses || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Plazo:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{selectedApp.plazoFinanciamiento || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Tipo:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{selectedApp.tipoCredito || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {selectedApp.candidateData && (
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Perfilado de Pre-calificación
                    </h4>
                    {(() => {
                      try {
                        const data = JSON.parse(selectedApp.candidateData);
                        const pq = data.preQualQuestions;
                        if (!pq) return <p className="text-xs text-blue-400 italic">No hay datos de pre-calificación.</p>;
                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-600">Propósito:</span>
                              <span className="font-bold text-blue-900">{pq.propositoCredito || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-600">Antigüedad:</span>
                              <span className="font-bold text-blue-900">{pq.antiguedadEmpleo || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-600">Deudas:</span>
                              <span className="font-bold text-blue-900">{pq.tieneDeudasVigentes === 'Si' ? `$${pq.montoDeudasMensual}` : 'No'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-600">Garantía:</span>
                              <span className="font-bold text-blue-900">{pq.cuentaConGarantia === 'Si' ? pq.descripcionGarantia : 'No'}</span>
                            </div>
                          </div>
                        );
                      } catch (e) {
                        return <p className="text-xs text-red-400 italic">Error al cargar datos.</p>;
                      }
                    })()}
                  </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" /> Datos del Solicitante
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Estatus:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{selectedApp.status}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Fecha Solicitud:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{new Date(selectedApp.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">ID Investigación:</span>
                      <span className="font-mono text-[10px] text-slate-900 dark:text-slate-100">{selectedApp.id}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedApp.socioeconomicDictamen ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">Análisis de Inteligencia Artificial</h3>
                  </div>
                  <AIResultRenderer resultString={selectedApp.socioeconomicDictamen} />
                </div>
              ) : (
                <div className="p-12 text-center bg-slate-50 dark:bg-slate-950 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                  <Brain className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">Análisis Pendiente</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Aún no se ha generado el dictamen de IA para esta solicitud.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <Building2 className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Selecciona una solicitud</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              Usa el selector superior o, en el móvil, el botón «Lista» para elegir una solicitud y ver el análisis, parámetros y dictamen.
            </p>
          </div>
        )}
      </div>

      {listSheetOpen ? (
        <div className="fixed inset-0 z-[200] lg:hidden flex flex-col justify-end">
          <button
            type="button"
            aria-label="Cerrar lista"
            className="absolute inset-0 bg-black/50"
            onClick={() => setListSheetOpen(false)}
          />
          <div className="relative z-10 max-h-[78vh] rounded-t-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Solicitudes</h3>
              <button
                type="button"
                onClick={() => setListSheetOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {renderAppList((app) => {
                setSelectedApp(app);
                setListSheetOpen(false);
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
