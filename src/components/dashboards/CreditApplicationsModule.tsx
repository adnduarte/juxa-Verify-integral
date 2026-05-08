import React, { useMemo, useState } from 'react';
import {
  FileText,
  Building2,
  Calculator,
  Clock,
  Search,
  Download,
  Brain,
  User,
  LayoutList,
  Rows3,
  Sparkles,
  Loader2,
  ArrowUpDown,
} from 'lucide-react';
import { AIResultRenderer } from '../AIResultRenderer';
import { DigidSignatureCard } from '../DigidSignatureCard';
import { IdentityAntiUsurpationPanel } from '../IdentityAntiUsurpationPanel';
import {
  defaultCreditCrmCapabilities,
  type CreditCrmCapabilities,
} from '../../lib/creditCrmCapabilities';
import { entityLabelFromCode, MEXICO_ENTITY_STATES } from '../../lib/mexicoEntityStates';
import { parseCreditCrmFilterFromText, type ParsedCreditCrmFilter } from '../../lib/gemini';
import { toast } from 'react-hot-toast';

const PIPELINE: { id: string; label: string }[] = [
  { id: 'PRE_QUALIFICATION', label: 'Precalificación' },
  { id: 'MESA_CONTROL', label: 'Mesa de control' },
  { id: 'RETURN_TO_AGENCY', label: 'Regresado a agencia' },
  { id: 'ANALYSIS', label: 'Análisis' },
  { id: 'CONDITIONS', label: 'Condiciones' },
  { id: 'PLACEMENT', label: 'Colocación' },
  { id: 'SIGNED_CLOSED', label: 'Firma / cierre' },
];

interface CreditApplicationsModuleProps {
  investigations: any[];
  profiles?: string[];
  vertical?: string;
  /** id → nombre para columna agencia (vista programa). */
  agencyLabelByOrgId?: Record<string, string>;
  capabilities?: Partial<CreditCrmCapabilities>;
}

export const CreditApplicationsModule: React.FC<CreditApplicationsModuleProps> = ({
  investigations,
  profiles = ['CREDIT'],
  vertical,
  agencyLabelByOrgId,
  capabilities: capabilitiesPartial,
}) => {
  const caps = useMemo(
    () => ({ ...defaultCreditCrmCapabilities, ...capabilitiesPartial }),
    [capabilitiesPartial]
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [filterScope, setFilterScope] = useState<'ALL' | 'BASIC' | 'INTERMEDIATE' | 'ADVANCED'>('ALL');
  const [filterPipeline, setFilterPipeline] = useState<string>('ALL');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAgency, setFilterAgency] = useState('');
  const [sortKey, setSortKey] = useState<'createdAt' | 'contractReference' | 'entityState'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'cards' | 'crm'>('crm');
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [genQuery, setGenQuery] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [aiParsed, setAiParsed] = useState<ParsedCreditCrmFilter | null>(null);

  const agencyIds = useMemo(() => {
    const fromProp = agencyLabelByOrgId ? Object.keys(agencyLabelByOrgId) : [];
    const fromData = [...new Set(investigations.map((i) => i.organizationId).filter(Boolean))] as string[];
    return [...new Set([...fromProp, ...fromData])];
  }, [agencyLabelByOrgId, investigations]);

  const creditApps = useMemo(() => {
    let rows = investigations.filter((inv) => {
      const profileOk = profiles.includes(inv.clientProfile);
      const verticalOk = !vertical || inv.vertical === vertical;
      const kw =
        (aiParsed?.keywords && String(aiParsed.keywords).trim()) ||
        searchTerm.trim().toLowerCase();
      const searchOk =
        kw === '' ||
        (inv.title || '').toLowerCase().includes(kw) ||
        (inv.id || '').toLowerCase().includes(kw) ||
        String(inv.contractReference || '')
          .toLowerCase()
          .includes(kw);
      const scopeOk = filterScope === 'ALL' || inv.investigationScope === filterScope;
      const pipeOk =
        filterPipeline === 'ALL' || (inv.creditPipelineStage || 'PRE_QUALIFICATION') === filterPipeline;
      const entityOk = !filterEntity || String(inv.entityState || '').toUpperCase() === filterEntity;
      const agencyOk = !filterAgency || inv.organizationId === filterAgency;

      let aiOk = true;
      if (aiParsed) {
        if (aiParsed.pipelineStage && (inv.creditPipelineStage || 'PRE_QUALIFICATION') !== aiParsed.pipelineStage) {
          aiOk = false;
        }
        if (
          aiParsed.entityState &&
          String(inv.entityState || '').toUpperCase() !== String(aiParsed.entityState).toUpperCase()
        ) {
          aiOk = false;
        }
        if (aiParsed.organizationId && inv.organizationId !== aiParsed.organizationId) {
          aiOk = false;
        }
      }

      return profileOk && verticalOk && searchOk && scopeOk && pipeOk && entityOk && agencyOk && aiOk;
    });

    rows = [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'createdAt') {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return sortDir === 'desc' ? tb - ta : ta - tb;
      }
      if (sortKey === 'contractReference') {
        const ca = String(a.contractReference || '');
        const cb = String(b.contractReference || '');
        return ca.localeCompare(cb, 'es') * dir;
      }
      const ea = String(a.entityState || '');
      const eb = String(b.entityState || '');
      return ea.localeCompare(eb, 'es') * dir;
    });

    return rows;
  }, [
    investigations,
    profiles,
    vertical,
    searchTerm,
    filterScope,
    filterPipeline,
    filterEntity,
    filterAgency,
    sortKey,
    sortDir,
    aiParsed,
  ]);

  const pipelineLabel = (id: string | undefined) =>
    PIPELINE.find((p) => p.id === id)?.label || id || '—';

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case 'BASIC':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
            Pre-calificación
          </span>
        );
      case 'INTERMEDIATE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">
            Mesa de Control
          </span>
        );
      case 'ADVANCED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
            Integral
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
            {scope}
          </span>
        );
    }
  };

  const runGenerativeFilter = async () => {
    if (!caps.canUseGenerativeFilter || !genQuery.trim()) return;
    setGenLoading(true);
    try {
      const parsed = await parseCreditCrmFilterFromText(genQuery.trim(), agencyIds);
      if (!parsed) {
        toast.error('No se pudo interpretar el filtro. Prueba filtros manuales.');
        return;
      }
      setAiParsed(parsed);
      if (parsed.pipelineStage) setFilterPipeline(parsed.pipelineStage);
      if (parsed.entityState) setFilterEntity(parsed.entityState.toUpperCase());
      if (parsed.organizationId) setFilterAgency(parsed.organizationId);
      if (parsed.keywords) setSearchTerm(parsed.keywords);
      toast.success('Filtro aplicado');
    } catch {
      toast.error('Error al interpretar con IA');
    } finally {
      setGenLoading(false);
    }
  };

  const clearAiFilter = () => {
    setAiParsed(null);
    setGenQuery('');
  };

  const exportCsv = () => {
    if (!caps.canExportList) {
      toast.error('Tu rol no permite exportar esta lista.');
      return;
    }
    const headers = ['id', 'title', 'contractReference', 'entityState', 'organizationId', 'pipeline', 'status', 'createdAt'];
    const lines = [
      headers.join(','),
      ...creditApps.map((r) =>
        [
          r.id,
          `"${String(r.title || '').replace(/"/g, '""')}"`,
          r.contractReference || '',
          r.entityState || '',
          r.organizationId || '',
          r.creditPipelineStage || '',
          r.status || '',
          r.createdAt || '',
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm_credit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV generado');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
        <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">Solicitudes de Crédito</h2>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setViewMode('crm')}
                className={`px-2 py-1 flex items-center gap-1 ${viewMode === 'crm' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
              >
                <Rows3 className="w-3 h-3" /> CRM
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2 py-1 flex items-center gap-1 ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
              >
                <LayoutList className="w-3 h-3" /> Lista
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar título, ID, contrato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {caps.canUseGenerativeFilter && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-2 space-y-2">
              <p className="text-[10px] font-bold text-violet-800 uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Filtro asistido (IA)
              </p>
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder='Ej. "mes de control en Jalisco"'
                  value={genQuery}
                  onChange={(e) => setGenQuery(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-violet-200 rounded-lg bg-white"
                />
                <button
                  type="button"
                  disabled={genLoading}
                  onClick={() => runGenerativeFilter()}
                  className="shrink-0 px-2 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                </button>
              </div>
              {aiParsed && (
                <button type="button" onClick={clearAiFilter} className="text-[10px] text-violet-700 underline">
                  Quitar filtro IA
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Etapa</label>
              <select
                value={filterPipeline}
                onChange={(e) => setFilterPipeline(e.target.value)}
                className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="ALL">Todas</option>
                {PIPELINE.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Entidad</label>
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Todas</option>
                {MEXICO_ENTITY_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {agencyIds.length > 0 && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Agencia</label>
              <select
                value={filterAgency}
                onChange={(e) => setFilterAgency(e.target.value)}
                className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Todas</option>
                {agencyIds.map((oid) => (
                  <option key={oid} value={oid}>
                    {agencyLabelByOrgId?.[oid] || oid}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" /> Orden
            </span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="createdAt">Fecha</option>
              <option value="contractReference">Contrato</option>
              <option value="entityState">Entidad</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white"
            >
              {sortDir === 'asc' ? 'Asc' : 'Desc'}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!caps.canExportList || creditApps.length === 0}
              title={!caps.canExportList ? 'No permitido para tu rol' : 'Exportar CSV'}
              className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40 flex items-center gap-1 ml-auto"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(['ALL', 'BASIC', 'INTERMEDIATE', 'ADVANCED'] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => setFilterScope(scope)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                  filterScope === scope ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {scope === 'ALL' ? 'Todos' : scope === 'BASIC' ? 'Pre-cal' : scope === 'INTERMEDIATE' ? 'Mesa' : 'Integral'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {creditApps.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No se encontraron solicitudes.</div>
          ) : viewMode === 'crm' ? (
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-100 text-slate-600 sticky top-0">
                <tr>
                  <th className="px-2 py-2 font-bold">Contrato</th>
                  <th className="px-2 py-2 font-bold">Ent.</th>
                  <th className="px-2 py-2 font-bold">Etapa</th>
                  <th className="px-2 py-2 font-bold">Est.</th>
                </tr>
              </thead>
              <tbody>
                {creditApps.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={`cursor-pointer hover:bg-blue-50/80 border-b border-slate-50 ${
                      selectedApp?.id === app.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-2 py-2 font-mono text-[10px]">
                      {app.contractReference || '—'}
                      <div className="text-slate-400 font-sans truncate max-w-[120px]">{app.title}</div>
                    </td>
                    <td className="px-2 py-2 text-[10px]">{entityLabelFromCode(app.entityState) || '—'}</td>
                    <td className="px-2 py-2 text-[10px]">{pipelineLabel(app.creditPipelineStage)}</td>
                    <td className="px-2 py-2 text-[10px]">{String(app.status || '').slice(0, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            creditApps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedApp(app)}
                className={`w-full p-4 text-left transition-all hover:bg-slate-50 flex flex-col gap-2 ${
                  selectedApp?.id === app.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    INV-{app.id.substring(0, 6)}
                  </span>
                  <div className="flex items-center gap-1">
                    {app.vertical === 'FORD_CREDIT_MX' && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-600 text-white">
                        Ford
                      </span>
                    )}
                    {getScopeBadge(app.investigationScope)}
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 line-clamp-1">{app.title}</h3>
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                  <span className="font-mono">{app.contractReference || 'Sin contrato'}</span>
                  <span>·</span>
                  <span>{entityLabelFromCode(app.entityState) || 'Sin entidad'}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    {new Date(app.createdAt).toLocaleDateString()}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      app.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : app.status === 'PENDING'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {app.status === 'COMPLETED'
                      ? 'Completado'
                      : app.status === 'PENDING'
                        ? 'Pendiente'
                        : 'En Proceso'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[700px] flex flex-col">
        {selectedApp ? (
          <>
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detalle de Solicitud</span>
                  {getScopeBadge(selectedApp.investigationScope)}
                  {selectedApp.contractReference && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-mono">
                      Contrato {selectedApp.contractReference}
                    </span>
                  )}
                  {selectedApp.entityState && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {entityLabelFromCode(selectedApp.entityState)}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900">{selectedApp.title}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!caps.canExportList}
                  title={!caps.canExportList ? 'No disponible para tu rol' : 'Descarga (usa export CSV en lista)'}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-40"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-8 p-4 rounded-2xl bg-slate-900 text-white">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Pipeline originación → colocación
                </p>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE.map((step, i) => {
                    const current = (selectedApp.creditPipelineStage as string | undefined) || 'PRE_QUALIFICATION';
                    const curIdx = PIPELINE.findIndex((p) => p.id === current);
                    const active = i <= curIdx;
                    return (
                      <span
                        key={step.id}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          active ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {step.label}
                      </span>
                    );
                  })}
                </div>
                {selectedApp.score != null && (
                  <p className="text-sm mt-3 text-slate-300">
                    Score interno: <strong className="text-white">{selectedApp.score}</strong>
                    {selectedApp.scoreBreakdown && (
                      <span className="block text-xs text-slate-400 mt-1 font-mono truncate">
                        {String(selectedApp.scoreBreakdown).slice(0, 200)}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {caps.canViewMesaReturnDetails &&
                selectedApp.creditPipelineStage === 'RETURN_TO_AGENCY' &&
                selectedApp.mesaReturnReason && (
                  <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">
                      Devuelto por mesa
                    </p>
                    <p className="text-sm text-amber-900">{selectedApp.mesaReturnReason}</p>
                  </div>
                )}

              {selectedApp.identityPreAnalysis && (
                <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Preanálisis de identidad
                  </p>
                  <p className="text-sm text-slate-900">
                    Riesgo: <strong>{selectedApp.identityPreAnalysis.riskScore}/100</strong> · Recomendación:{' '}
                    <strong>{selectedApp.identityPreAnalysis.recommendation}</strong>
                  </p>
                  {Array.isArray(selectedApp.identityPreAnalysis.factors) &&
                    selectedApp.identityPreAnalysis.factors.length > 0 && (
                      <ul className="list-disc pl-5 text-xs text-slate-600 mt-2">
                        {selectedApp.identityPreAnalysis.factors.slice(0, 4).map((f: string, i: number) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {caps.canViewIdentityAntiUsurpation && (
                  <IdentityAntiUsurpationPanel
                    compact
                    caseSummary={`Crédito ${selectedApp.id}. Estado ${selectedApp.status}. Dictamen socioeconómico: ${selectedApp.socioeconomicDictamen ? 'presente' : 'pendiente'}.`}
                  />
                )}
                {!caps.canViewIdentityAntiUsurpation && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    El panel anti-usurpación no está disponible para tu asiento.
                  </div>
                )}
                {caps.canViewDigidPlacement ? (
                  <DigidSignatureCard
                    contextType="credit_app"
                    contextId={selectedApp.id}
                    title="Firma electrónica colocación (DIGID)"
                  />
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    La gestión de firma DIGID no está disponible para tu rol en esta vista.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Calculator className="w-4 h-4" /> Parámetros del Crédito
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Contrato / referencia:</span>
                      <span className="font-bold text-slate-900 font-mono text-xs">
                        {selectedApp.contractReference || 'N/D'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Entidad:</span>
                      <span className="font-bold text-slate-900">
                        {entityLabelFromCode(selectedApp.entityState) || 'N/D'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Agencia:</span>
                      <span className="font-bold text-slate-900 text-right max-w-[55%] truncate">
                        {(selectedApp.organizationId && agencyLabelByOrgId?.[selectedApp.organizationId]) ||
                          selectedApp.organizationId ||
                          'N/D'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Monto Capital:</span>
                      <span className="font-bold text-slate-900">${selectedApp.montoCreditoCapital || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Monto c/Intereses:</span>
                      <span className="font-bold text-slate-900">${selectedApp.montoCreditoIntereses || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Plazo:</span>
                      <span className="font-bold text-slate-900">{selectedApp.plazoFinanciamiento || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Tipo:</span>
                      <span className="font-bold text-slate-900">{selectedApp.tipoCredito || 'N/A'}</span>
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
                              <span className="font-bold text-blue-900">
                                {pq.tieneDeudasVigentes === 'Si' ? `$${pq.montoDeudasMensual}` : 'No'}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-600">Garantía:</span>
                              <span className="font-bold text-blue-900">
                                {pq.cuentaConGarantia === 'Si' ? pq.descripcionGarantia : 'No'}
                              </span>
                            </div>
                          </div>
                        );
                      } catch {
                        return <p className="text-xs text-red-400 italic">Error al cargar datos.</p>;
                      }
                    })()}
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" /> Datos del Solicitante
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Estatus:</span>
                      <span className="font-bold text-slate-900">{selectedApp.status}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Fecha Solicitud:</span>
                      <span className="font-bold text-slate-900">
                        {new Date(selectedApp.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">ID Investigación:</span>
                      <span className="font-mono text-[10px] text-slate-900">{selectedApp.id}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedApp.socioeconomicDictamen ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-slate-900">Análisis de Inteligencia Artificial</h3>
                  </div>
                  <AIResultRenderer resultString={selectedApp.socioeconomicDictamen} />
                </div>
              ) : (
                <div className="p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  <Brain className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="font-bold text-slate-900 mb-2">Análisis Pendiente</h3>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    Aún no se ha generado el dictamen de IA para esta solicitud.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Building2 className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Selecciona una solicitud</h3>
            <p className="text-slate-500 max-w-md">
              Elige una solicitud de la lista para ver contrato, entidad, pipeline y dictamen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
