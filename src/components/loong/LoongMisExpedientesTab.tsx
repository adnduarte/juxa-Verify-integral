import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ExternalLink, FileText, CheckCircle2, Clock, TrendingUp, ShieldAlert, Send } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { stageIndex, stageLabelEs, type LoongOriginationCase, type LoongOriginationStage } from '../../lib/loongOrigination';
import type { Role } from '../../contexts/AuthContext';
import { candidateUrlForLink } from '../../lib/loongPipelineLinks';
import type { LoongFlowRequest } from '../../lib/loongFlowRequests';
import { useVendorLoongPrecalInvestigations } from '../../hooks/useVendorLoongPrecalInvestigations';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';
import { LoongFlowRequestTrackingModal } from './LoongFlowRequestTrackingModal';
import { LoongVendorFlowRequestList } from './LoongVendorFlowRequestList';
import type { LoongOperationalRules } from '../../lib/loongOperationalRules';

function canSeeAllCases(role: Role): boolean {
  return (
    role === 'ADMIN' ||
    role === 'SUPERVISOR' ||
    role === 'ANALISTA_MESA_CONTROL' ||
    role === 'GERENTE_DIRECTIVO' ||
    role === 'ANALISTA_CREDITO'
  );
}

function commercialStatus(c: LoongOriginationCase): string {
  if (c.originationStage === 'RECHAZADO') return c.registeredInCrm ? 'Rechazado · en CRM' : 'Rechazado · recuperable';
  if (c.availableForCrm && !c.registeredInCrm) return 'Disponible CRM';
  if (c.registeredInCrm) return 'En CRM';
  return 'Activo';
}

function isPlacedStage(stage: LoongOriginationStage): boolean {
  // "Colocado": ya pasó a entrega/documentación/firma/cobranza o cerrado.
  const placedFrom: LoongOriginationStage = 'ENTREGA_PROGRAMADA';
  const idx = stageIndex(stage);
  const fromIdx = stageIndex(placedFrom);
  if (idx < 0 || fromIdx < 0) return false;
  return idx >= fromIdx && stage !== 'RECHAZADO';
}

function maskPhone(phone: string, canSeeSensitive: boolean): string {
  const t = (phone || '').trim();
  if (!t) return '—';
  if (canSeeSensitive) return t;
  const digits = t.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `***${digits.slice(-4)}`;
}

function isSystemCommentVisible(role: Role): boolean {
  return canSeeAllCases(role);
}

function safeHistoryForRole(c: LoongOriginationCase, role: Role) {
  const history = Array.isArray(c.history) ? c.history : [];
  if (isSystemCommentVisible(role)) return history;
  // Vendedor/usuario no privilegiado: ocultar referencias explícitas a mesa/supervisión y notas internas.
  return history.filter((h) => {
    const a = String(h?.action || '').toLowerCase();
    const n = String(h?.note || '').toLowerCase();
    return !(a.includes('mesa') || a.includes('supervis') || n.includes('mesa') || n.includes('supervis'));
  });
}

export const LoongMisExpedientesTab: React.FC<{
  cases: LoongOriginationCase[];
  loading: boolean;
  onRefresh: () => void;
  userUid: string;
  userEmail?: string | null;
  role: Role;
  opRules: LoongOperationalRules;
}> = ({ cases, loading, onRefresh, userUid, userEmail, role, opRules }) => {
  const [myPrecalFlowRows, setMyPrecalFlowRows] = useState<LoongFlowRequest[]>([]);
  const [precalTracking, setPrecalTracking] = useState<LoongFlowRequest | null>(null);
  const isVendorConcesionario = role === 'CLIENTE';
  const vendorPrecalInvById = useVendorLoongPrecalInvestigations(isVendorConcesionario ? userUid : undefined);

  const messageForCandidate = useCallback((url: string, refTitle: string) => {
    return (
      `Hola.\n` +
      `Para continuar con tu precalificación de crédito moto, llena este formulario desde tu celular:\n\n` +
      `${url}\n\n` +
      `Referencia: ${refTitle || 'Precalificación'}\n` +
      `Tarda ~3-5 minutos.`
    );
  }, []);

  const openWhatsAppShare = useCallback(
    (url: string, refTitle: string) => {
      window.open(`https://wa.me/?text=${encodeURIComponent(messageForCandidate(url, refTitle))}`, '_blank', 'noopener,noreferrer');
    },
    [messageForCandidate]
  );

  useEffect(() => {
    if (!isVendorConcesionario || !userUid) {
      setMyPrecalFlowRows([]);
      return;
    }
    const q = query(collection(db, 'loong_flow_requests'), where('requestedByUid', '==', userUid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as LoongFlowRequest[];
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMyPrecalFlowRows(list.slice(0, 200));
      },
      (e) => console.error('[LoongMisExpedientesTab] loong_flow_requests', e)
    );
    return () => unsub();
  }, [isVendorConcesionario, userUid]);

  const rows = useMemo(() => {
    if (canSeeAllCases(role)) return cases;
    return cases.filter((c) => c.vendedorUid === userUid);
  }, [cases, role, userUid]);

  const canSeeSensitive = canSeeAllCases(role);
  const [selectedId, setSelectedId] = useState<string>('');
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  const myProspected = rows.length;
  const myPlaced = rows.filter((c) => isPlacedStage(c.originationStage)).length;
  const myConversion = myProspected > 0 ? (myPlaced / myProspected) * 100 : 0;

  const bySeller = useMemo(() => {
    if (!canSeeAllCases(role)) return [];
    const map = new Map<
      string,
      {
        vendedorUid: string;
        vendedorDisplayName: string;
        vendedorEmail: string;
        prospectados: number;
        colocados: number;
      }
    >();
    for (const c of rows) {
      const uid = c.vendedorUid || '—';
      const cur =
        map.get(uid) ||
        ({
          vendedorUid: uid,
          vendedorDisplayName: (c.vendedorDisplayName || '').trim(),
          vendedorEmail: (c.vendedorEmail || '').trim(),
          prospectados: 0,
          colocados: 0,
        } as const);
      map.set(uid, {
        ...cur,
        vendedorDisplayName: cur.vendedorDisplayName || (c.vendedorDisplayName || '').trim(),
        vendedorEmail: cur.vendedorEmail || (c.vendedorEmail || '').trim(),
        prospectados: cur.prospectados + 1,
        colocados: cur.colocados + (isPlacedStage(c.originationStage) ? 1 : 0),
      });
    }
    const list = [...map.values()];
    list.sort((a, b) => b.colocados - a.colocados || b.prospectados - a.prospectados);
    return list;
  }, [rows, role]);

  const exportCsv = () => {
    const header = ['cliente', 'email', 'telefono', 'entidad', 'etapa', 'estado_comercial', 'actualizado'];
    const lines = rows.map((c) =>
      [
        c.clientName,
        c.clientEmail,
        c.clientPhone || '',
        c.entidadFederativa || '',
        stageLabelEs(c.originationStage),
        commercialStatus(c),
        c.updatedAt || '',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([header.join(',') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `loong_expedientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isVendorConcesionario ? 'Mis solicitudes' : 'Mis expedientes'}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {isVendorConcesionario
              ? 'Enlaces de precalificación que generas en «Iniciar precalificación» y expedientes de originación a tu nombre.'
              : 'Módulo de solicitudes: estatus, expediente (reglas + info requerida + comentarios de sistema) y seguimiento comercial.'}
            {!canSeeAllCases(role) && !isVendorConcesionario ? ' Solo ves los que originaste.' : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 disabled:opacity-50"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {isVendorConcesionario ? (
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/25 p-5 shadow-sm">
          {precalTracking ? (
            <LoongFlowRequestTrackingModal
              flowRequest={precalTracking}
              userUid={userUid}
              userEmail={userEmail}
              onClose={() => setPrecalTracking(null)}
            />
          ) : null}
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden />
            <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
              Precalificación (enlaces al candidato){' '}
              <span className="font-normal text-emerald-800/80 dark:text-emerald-200/80">({myPrecalFlowRows.length})</span>
            </h3>
          </div>
          <p className="mt-1 text-xs text-emerald-900/85 dark:text-emerald-200/80">
            Mismo historial que en «Iniciar precalificación»; expediente, mesa y enlace se actualizan en vivo.
          </p>
          {myPrecalFlowRows.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-900/70 dark:text-emerald-200/70">
              Aún no hay enlaces. Ve a <strong>Iniciar precalificación</strong>, escribe un título y pulsa generar enlace.
            </p>
          ) : (
            <LoongVendorFlowRequestList
              rows={myPrecalFlowRows}
              invById={vendorPrecalInvById}
              onOpenTracking={(r) => setPrecalTracking(r)}
              onShareWhatsApp={openWhatsAppShare}
              variant="emerald"
            />
          )}
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Prospectados</p>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{myProspected}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Colocados</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{myPlaced}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Conversión</p>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{myConversion.toFixed(0)}%</p>
        </div>
      </div>

      {/* Admin/Supervisor: seller breakdown */}
      {canSeeAllCases(role) && bySeller.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Estadísticas por vendedor</h3>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Vendedor</th>
                  <th className="px-3 py-2">Prospectados</th>
                  <th className="px-3 py-2">Colocados</th>
                  <th className="px-3 py-2">Conversión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bySeller.map((s) => {
                  const conv = s.prospectados > 0 ? (s.colocados / s.prospectados) * 100 : 0;
                  return (
                    <tr key={s.vendedorUid} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {(s.vendedorDisplayName || '').trim() || s.vendedorUid.slice(0, 8) + '…'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{s.vendedorEmail || '—'}</div>
                      </td>
                      <td className="px-3 py-2 font-semibold">{s.prospectados}</td>
                      <td className="px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-300">{s.colocados}</td>
                      <td className="px-3 py-2">{conv.toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {loading ? (
        <JuxaVerifyLoader text="Cargando expedientes…" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isVendorConcesionario
            ? 'No hay expedientes de originación CRM todavía (tabla inferior). Los enlaces de precal van arriba.'
            : 'No hay expedientes visibles.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  {canSeeAllCases(role) ? <th className="px-3 py-2">Vendedor</th> : null}
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Entidad</th>
                  <th className="px-3 py-2">Estatus</th>
                  <th className="px-3 py-2">Precal</th>
                  <th className="px-3 py-2">Comercial</th>
                  <th className="px-3 py-2">Enlaces</th>
                  <th className="px-3 py-2">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((c) => {
                  const active = selectedId === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${active ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
                      title="Click para ver expediente"
                    >
                      {canSeeAllCases(role) ? (
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {(c.vendedorDisplayName || '').trim() || (c.vendedorEmail || '').trim() || c.vendedorUid.slice(0, 8) + '…'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{(c.vendedorEmail || '').trim() || '—'}</div>
                        </td>
                      ) : null}
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{c.clientName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{c.clientEmail}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          {maskPhone(c.clientPhone || '', canSeeSensitive)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{c.entidadFederativa || '—'}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          {stageLabelEs(c.originationStage)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {c.precalScore != null ? (
                          <span className={c.precalPassed ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>
                            {c.precalScore} {c.precalPassed ? '✓' : 'rev.'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{commercialStatus(c)}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex flex-col gap-1">
                          {c.formalQualLinkId ? (
                            <a
                              href={candidateUrlForLink(c.formalQualLinkId)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-700 underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Formal <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                          {c.arraigoLinkId ? (
                            <a
                              href={candidateUrlForLink(c.arraigoLinkId)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-violet-700 underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Arraigo <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                          {!c.formalQualLinkId && !c.arraigoLinkId ? '—' : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{c.updatedAt?.slice(0, 16) ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Expediente</h3>
            </div>

            {!selected ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Selecciona una solicitud para ver su expediente.</p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Estatus</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{stageLabelEs(selected.originationStage)}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ID: {selected.id.slice(0, 10)}…</p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Reglas (resumen)</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-200">
                    <li>Gracia moratorio: {opRules.collection.graceDaysBeforeLateFee} días</li>
                    <li>Recargo: {opRules.collection.lateFeePctOfInstallment}% sobre cuota</li>
                    <li>Plantillas: contrato y pagaré parametrizados</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Información necesaria</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-200">
                    <li>
                      {selected.precalScore != null ? '✓' : '—'} Precalificación (score)
                    </li>
                    <li>
                      {selected.arraigoLinkId ? '✓' : '—'} Enlace arraigo
                    </li>
                    <li>
                      {selected.formalQualLinkId ? '✓' : '—'} Enlace calificación formal
                    </li>
                    <li>
                      {selected.contractDocumentUrl || selected.generatedContractText ? '✓' : '—'} Contrato
                    </li>
                    <li>
                      {selected.pagareDocumentUrl || selected.generatedPagareText ? '✓' : '—'} Pagaré
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Comentarios de sistema
                  </p>
                  <ul className="mt-2 space-y-2 text-xs text-slate-700 dark:text-slate-200">
                    {safeHistoryForRole(selected, role).slice(-8).map((h, idx) => (
                      <li key={idx} className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 px-2.5 py-2">
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">{String(h.at || '').slice(0, 16)}</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{String(h.action || '')}</div>
                        {h.note ? <div className="mt-1 whitespace-pre-wrap">{String(h.note)}</div> : null}
                      </li>
                    ))}
                    {safeHistoryForRole(selected, role).length === 0 ? (
                      <li className="text-slate-500 dark:text-slate-400">Sin comentarios visibles.</li>
                    ) : null}
                    {!isSystemCommentVisible(role) ? (
                      <li className="text-[11px] text-slate-400 dark:text-slate-500">
                        Nota: dictámenes y notas internas de mesa/supervisión no se muestran en este módulo.
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
