import React, { useCallback, useEffect, useState } from 'react';
import { Link2, Play, RefreshCw, TestTube2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import type { LoongOriginationCase } from '../../lib/loongOrigination';
import {
  fetchOpenLoongFlowRequests,
  issueStandaloneLoongPrecalLink,
  markLoongFlowRequestDone,
  resolveLoongFlowRequestWithCase,
  type LoongFlowRequest,
} from '../../lib/loongFlowRequests';

const whatsAppUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export const LoongSuperadminFlowHub: React.FC = () => {
  const { user } = useAuthStatus();
  const [rows, setRows] = useState<LoongFlowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchOpenLoongFlowRequests(db));
    } catch (e) {
      console.error(e);
      toast.error('No se pudo cargar la cola.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado');
    } catch {
      toast.error(url);
    }
  };

  const messageForCandidate = (req: LoongFlowRequest, url: string) => {
    const nm = (req.clientName || '').trim();
    return (
      `Hola${nm ? ` ${nm}` : ''}.\n` +
      `Para continuar con tu solicitud, llena este formulario de precalificación:\n\n` +
      `${url}\n\n` +
      `Importante:\n- Es un cuestionario inicial.\n- Tarda ~3-5 minutos.\n\n` +
      `Si tienes dudas, responde a este mensaje.`
    );
  };

  const act = async (req: LoongFlowRequest, kind: 'precal' | 'test' | 'case' | 'done') => {
    if (!user?.uid) return;
    setBusyId(req.id);
    try {
      if (kind === 'done') {
        await markLoongFlowRequestDone(db, req.id, user.uid, {});
        toast.success('Marcado como atendido.');
        await load();
        return;
      }
      if (kind === 'test') {
        const { investigationId, linkId, url } = await issueStandaloneLoongPrecalLink(db, {
          title: `[Prueba] ${req.title}`,
          testMode: true,
          clientIdForInv: 'admin_simulator',
          organizationId: req.organizationId,
          requestedByUidForAudit: user.uid,
        });
        await markLoongFlowRequestDone(db, req.id, user.uid, { investigationId, linkId });
        await copyUrl(url);
        toast.success('Flujo de prueba creado (simulador).');
        await load();
        return;
      }
      if (kind === 'precal') {
        const { investigationId, linkId, url } = await issueStandaloneLoongPrecalLink(db, {
          title: req.title,
          testMode: false,
          clientIdForInv: req.requestedByUid,
          organizationId: req.organizationId,
          requestedByUidForAudit: user.uid,
          candidateEmail: req.candidateEmail || null,
          candidatePhone: req.candidatePhone || null,
        });
        await markLoongFlowRequestDone(db, req.id, user.uid, { investigationId, linkId });
        await copyUrl(url);
        toast.success('Enlace de precalificación listo.');
        await load();
        return;
      }
      if (kind === 'case') {
        if (!req.caseId) {
          toast.error('Falta expediente en la solicitud.');
          return;
        }
        const snap = await getDoc(doc(db, 'loong_origination_cases', req.caseId));
        if (!snap.exists()) {
          toast.error('Expediente no encontrado.');
          return;
        }
        const loongCase = { id: snap.id, ...snap.data() } as LoongOriginationCase;
        const { linkId, investigationId } = await resolveLoongFlowRequestWithCase(
          db,
          req,
          loongCase,
          user.uid,
          req.organizationId
        );
        await markLoongFlowRequestDone(db, req.id, user.uid, { linkId, investigationId });
        await copyUrl(`${window.location.origin}/candidate/${linkId}`);
        toast.success('Enlace emitido desde expediente.');
        await load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al procesar.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-6 shadow-sm ring-1 ring-emerald-900/[0.04]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Play className="h-5 w-5 text-emerald-600" aria-hidden />
            Centro de arranque de flujos Loong
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Cola enviada por mesa, comercial o vendedor. Desde aquí inicias precal, expediente vinculado o prueba — sin pasar por el simulador
            global de enlaces (ese sigue disponible abajo para otros casos).
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">No hay solicitudes abiertas.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{r.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {r.requesterRole} · {r.requestedByEmail || r.requestedByUid.slice(0, 8)} · intent: {r.intent}
                  </p>
                  {r.notes ? <p className="mt-2 text-slate-600 dark:text-slate-300">{r.notes}</p> : null}
                  {r.caseId ? (
                    <p className="mt-1 text-xs font-mono text-slate-500">Expediente: {r.caseId}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => act(r, 'precal')}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Generar enlace precal
                  </button>
                  {r.candidatePhone || r.candidateEmail ? (
                    <span className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-[11px] text-slate-700 dark:text-slate-200">
                      {r.candidatePhone || r.candidateEmail}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    disabled={
                      busyId === r.id ||
                      !r.caseId ||
                      (r.intent !== 'calificacion_formal' && r.intent !== 'investigacion_arraigo')
                    }
                    onClick={() => act(r, 'case')}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                    title={!r.caseId ? 'Añade expediente en la solicitud' : 'Formal o arraigo según intent'}
                  >
                    Desde expediente
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => act(r, 'test')}
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 disabled:opacity-50"
                  >
                    <TestTube2 className="h-3.5 w-3.5" />
                    Prueba
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => act(r, 'done')}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Cerrar
                  </button>
                  {r.resolvedLinkId ? (
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/candidate/${r.resolvedLinkId}`;
                        window.open(whatsAppUrl(messageForCandidate(r, url)), '_blank', 'noopener,noreferrer');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                      title="Abrir WhatsApp con mensaje prearmado"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      WhatsApp
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
