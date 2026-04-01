import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Copy,
  Loader2,
  MessageSquare,
  Paperclip,
  CheckCircle2,
  Circle,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import toast from 'react-hot-toast';
import { db, storage } from '../../firebase';
import type { LoongFlowRequest } from '../../lib/loongFlowRequests';
import {
  buildLoongMotorPipelineSteps,
  loongInvestigationSummaryLine,
  vendorCanOpenDetailedLoongStatus,
} from '../../lib/loongInvestigationPipeline';
import {
  addVendorContactComment,
  addVendorContactFile,
  subscribeVendorContactThread,
  type VendorContactDoc,
} from '../../lib/loongVendorContact';
import {
  mesaPrecalFlowBadgeClass,
  mesaPrecalFlowLabel,
  mesaPrecalFlowState,
  type MesaPrecalInvInput,
} from '../../lib/mesaCreditDictamen';

type Props = {
  flowRequest: LoongFlowRequest;
  userUid: string;
  userEmail: string | null | undefined;
  onClose: () => void;
};

function storageContentTypeForFile(file: File): string {
  if (file.type && file.type.length > 0) return file.type;
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

export const LoongFlowRequestTrackingModal: React.FC<Props> = ({
  flowRequest,
  userUid,
  userEmail,
  onClose,
}) => {
  const invId = flowRequest.resolvedInvestigationId;
  const [inv, setInv] = useState<Record<string, unknown> | null>(null);
  const [loadingInv, setLoadingInv] = useState(false);
  const [thread, setThread] = useState<VendorContactDoc[]>([]);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadInv = useCallback(async () => {
    if (!invId) {
      setInv(null);
      return;
    }
    setLoadingInv(true);
    try {
      const snap = await getDoc(doc(db, 'investigations', invId));
      setInv(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo cargar el expediente.');
      setInv(null);
    } finally {
      setLoadingInv(false);
    }
  }, [invId]);

  useEffect(() => {
    void loadInv();
  }, [loadInv]);

  const canPost = Boolean(inv && inv.clientId === userUid);

  useEffect(() => {
    if (!invId) return;
    const unsub = subscribeVendorContactThread(
      db,
      invId,
      (rows) => setThread(rows),
      (e) => console.error(e)
    );
    return () => unsub();
  }, [invId]);

  const summaryLine = useMemo(() => (inv ? loongInvestigationSummaryLine(inv) : '—'), [inv]);
  const detailed = useMemo(() => vendorCanOpenDetailedLoongStatus(inv), [inv]);
  const steps = useMemo(() => (inv ? buildLoongMotorPipelineSteps(inv) : []), [inv]);
  const mesaFlowState = useMemo(
    () => (inv ? mesaPrecalFlowState(inv as MesaPrecalInvInput) : 'no_aplica'),
    [inv]
  );
  const mesaFlowLabel = useMemo(() => mesaPrecalFlowLabel(mesaFlowState), [mesaFlowState]);
  const vendorIneUrl = useMemo(() => {
    const u = inv?.uploadedFileUrls;
    if (u && typeof u === 'object' && !Array.isArray(u) && 'vendorIneFrente' in u) {
      const v = (u as Record<string, unknown>).vendorIneFrente;
      return typeof v === 'string' ? v : null;
    }
    return null;
  }, [inv]);

  const copyCliente = async () => {
    const text =
      `Estado de tu solicitud (referencia): ${summaryLine}. ` +
      (detailed && inv
        ? `Etapa actual del proceso: ${steps.find((s) => s.current)?.label || 'En curso'}.`
        : 'Tu solicitud sigue en revisión; te avisamos cuando haya novedad.');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Texto copiado para enviar al cliente');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const onSendComment = async () => {
    if (!invId || !canPost) return;
    const t = comment.trim();
    if (t.length < 2) {
      toast.error('Escribe al menos 2 caracteres.');
      return;
    }
    setSending(true);
    try {
      await addVendorContactComment(db, invId, { authorUid: userUid, authorEmail: userEmail, text: t });
      setComment('');
      toast.success('Comentario guardado');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar el comentario.');
    } finally {
      setSending(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !invId || !canPost) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Archivo máximo 15 MB.');
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 120);
      const path = `loong_vendor_docs/${invId}/${userUid}/${Date.now()}_${safe}`;
      const sref = ref(storage, path);
      await uploadBytes(sref, file, { contentType: storageContentTypeForFile(file) });
      const url = await getDownloadURL(sref);
      await addVendorContactFile(db, invId, {
        authorUid: userUid,
        authorEmail: userEmail,
        storageUrl: url,
        fileName: file.name,
        caption: '',
      });
      toast.success('Archivo subido');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo subir el archivo. Revisa reglas de Storage.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-labelledby="tracking-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <h2 id="tracking-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
            Seguimiento: {flowRequest.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/60 px-3 py-3 dark:border-emerald-900/45 dark:bg-emerald-950/25">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
              Ficha del prospecto (captura vendedor)
            </p>
            <dl className="mt-2 space-y-1.5 text-xs text-slate-800 dark:text-slate-200">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-slate-500 dark:text-slate-400">Referencia / título</dt>
                <dd className="font-mono font-semibold">{flowRequest.title}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-slate-500 dark:text-slate-400">Estado historial</dt>
                <dd>{flowRequest.status}</dd>
              </div>
              {flowRequest.clientName ? (
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Nombre asociado</dt>
                  <dd className="font-medium">{flowRequest.clientName}</dd>
                </div>
              ) : null}
              {flowRequest.candidatePhone ? (
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Teléfono</dt>
                  <dd>{flowRequest.candidatePhone}</dd>
                </div>
              ) : null}
              {flowRequest.candidateEmail ? (
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Correo</dt>
                  <dd className="break-all">{flowRequest.candidateEmail}</dd>
                </div>
              ) : null}
              {flowRequest.candidateCurp ? (
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">CURP</dt>
                  <dd className="font-mono">{flowRequest.candidateCurp}</dd>
                </div>
              ) : null}
              {flowRequest.candidateRfc ? (
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">RFC</dt>
                  <dd className="font-mono">{flowRequest.candidateRfc}</dd>
                </div>
              ) : null}
              {flowRequest.notes ? (
                <div className="rounded-lg border border-dashed border-emerald-200/80 bg-white/60 px-2 py-2 dark:border-emerald-900/40 dark:bg-slate-900/40">
                  <dt className="text-slate-500 dark:text-slate-400">Notas</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{flowRequest.notes}</dd>
                </div>
              ) : null}
            </dl>
            {!invId ? (
              <p className="mt-3 text-[11px] text-amber-900 dark:text-amber-200/90">
                Aún no hay expediente de precal vinculado a esta fila. Si el estado es «OPEN», puede estar pendiente en
                central; si ya generaste un enlace nuevo, abre la solicitud más reciente en la lista.
              </p>
            ) : null}
          </div>

          {!invId ? null : loadingInv ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando expediente…
            </div>
          ) : !inv ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              No se encontró la investigación en base de datos (revisa permisos o que el ID siga vigente).
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-sky-200/90 bg-sky-50/70 px-3 py-3 dark:border-sky-900/50 dark:bg-sky-950/25">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-200">
                    Expediente (misma vista que usa mesa)
                  </p>
                  {mesaFlowLabel ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${mesaPrecalFlowBadgeClass(mesaFlowState)}`}
                    >
                      {mesaFlowLabel}
                    </span>
                  ) : null}
                </div>
                <dl className="mt-2 space-y-1 text-xs text-slate-800 dark:text-slate-200">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-slate-500 dark:text-slate-400">ID investigación</dt>
                    <dd className="font-mono font-semibold">INV-{String(inv.id).slice(0, 6)}</dd>
                  </div>
                  {flowRequest.resolvedLinkId ? (
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-slate-500 dark:text-slate-400">ID enlace</dt>
                      <dd className="font-mono text-[11px]">{String(flowRequest.resolvedLinkId).slice(0, 12)}…</dd>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-slate-500 dark:text-slate-400">Estatus enlace</dt>
                    <dd>{String(inv.linkStatus || '—')}</dd>
                  </div>
                  {typeof inv.mesaPrecalStatus === 'string' && inv.mesaPrecalStatus ? (
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-slate-500 dark:text-slate-400">Mesa</dt>
                      <dd className="font-medium">{inv.mesaPrecalStatus}</dd>
                    </div>
                  ) : null}
                  {typeof inv.contactInfo === 'string' && inv.contactInfo ? (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Prospecto (vendedor)</dt>
                      <dd>{inv.contactInfo}</dd>
                    </div>
                  ) : null}
                  {typeof inv.candidatePhone === 'string' && inv.candidatePhone ? (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Tel.</dt>
                      <dd>{inv.candidatePhone}</dd>
                    </div>
                  ) : null}
                  {typeof inv.candidateEmail === 'string' && inv.candidateEmail ? (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Correo</dt>
                      <dd className="break-all">{inv.candidateEmail}</dd>
                    </div>
                  ) : null}
                </dl>
                {typeof inv.details === 'string' && inv.details.trim() ? (
                  <div className="mt-2 rounded-lg border border-sky-100 bg-white/80 px-2 py-2 text-[11px] whitespace-pre-wrap text-slate-700 dark:border-sky-900/40 dark:bg-slate-900/60 dark:text-slate-300">
                    {inv.details}
                  </div>
                ) : null}
                {vendorIneUrl ? (
                  <a
                    href={vendorIneUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-semibold text-sky-700 underline dark:text-sky-300"
                  >
                    Ver INE cargada por vendedor
                  </a>
                ) : null}
                <p className="mt-2 text-[10px] text-sky-900/80 dark:text-sky-200/75">
                  Si mesa de control aprueba, el expediente sigue al siguiente proceso (calificación / documentación). Este
                  mismo ID concentra precal del candidato y dictamen.
                </p>
              </div>

              <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 px-3 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-200">
                  Trayecto del proceso
                </p>
                <ul className="mt-2 space-y-1.5">
                  {steps.map((s) => (
                    <li key={s.key} className="flex gap-2 text-xs text-slate-800 dark:text-slate-200">
                      <span className="mt-0.5 shrink-0">
                        {s.done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : s.current ? (
                          <ChevronRight className="h-3.5 w-3.5 text-amber-600" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                        )}
                      </span>
                      <span>
                        <strong>{s.label}</strong>
                        {s.current ? ' · actual' : ''}
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400">{s.hint}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Resumen para el cliente
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{summaryLine}</p>
                <button
                  type="button"
                  onClick={() => void copyCliente()}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  <Copy className="h-3 w-3" />
                  Copiar mensaje sugerido (WhatsApp)
                </button>
              </div>

              {!detailed ? (
                <div className="flex gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  <Lock className="h-4 w-4 shrink-0" />
                  <p>
                    La <strong>puntuación del motor</strong> y el <strong>dictamen automático detallado</strong> se
                    muestran cuando exista preaprobación o resolución de mesa / fase 2. El trayecto de arriba sí se
                    actualiza con el avance del expediente.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                    Referencia técnica (desbloqueada)
                  </p>
                  {typeof inv.score === 'number' ? (
                    <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">
                      Score motor (referencia): <strong>{inv.score}</strong>
                      {typeof inv.mesaPrecalAutoPassed === 'boolean'
                        ? inv.mesaPrecalAutoPassed
                          ? ' · referencia favorable'
                          : ' · referencia no favorable'
                        : ''}
                    </p>
                  ) : null}
                  {typeof inv.mesaAutomatedDictamen === 'string' && inv.mesaAutomatedDictamen ? (
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">{inv.mesaAutomatedDictamen}</p>
                  ) : null}
                </div>
              )}

              {invId && canPost ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tu bitácora con el cliente
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Comentarios y archivos que subas quedan en el expediente (visible para ti y equipo Loong autorizado).
                  </p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="Ej. Cliente envió INE por WhatsApp, cita visita martes 11:00…"
                    className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void onSendComment()}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {sending ? 'Guardando…' : 'Guardar comentario'}
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                      <Paperclip className="h-3.5 w-3.5" />
                      {uploading ? 'Subiendo…' : 'Adjuntar archivo'}
                      <input type="file" className="hidden" accept="image/*,.pdf,.webp" onChange={(e) => void onPickFile(e)} disabled={uploading} />
                    </label>
                  </div>
                </div>
              ) : invId && inv ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Solo el vendedor que originó el expediente puede añadir comentarios y archivos aquí.
                </p>
              ) : null}

              {thread.length > 0 ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Historial
                  </p>
                  <ul className="mt-2 space-y-2">
                    {thread.map((t) => (
                      <li
                        key={t.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="text-[10px] text-slate-400">
                          {new Date(t.createdAt).toLocaleString()} ·{' '}
                          {t.kind === 'file' ? 'Archivo' : 'Comentario'}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-200">{t.text}</p>
                        {t.kind === 'file' && t.storageUrl ? (
                          <a
                            href={t.storageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-emerald-700 underline dark:text-emerald-400"
                          >
                            {t.fileName || 'Descargar'}
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
