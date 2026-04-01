import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import { Card } from '../ui';
import toast from 'react-hot-toast';
import { X, CheckCircle2, Sparkles } from 'lucide-react';
import { mesaQueueDictamenExcerpt, mesaQueueProcesoLine } from '../../lib/mesaQueueInvestigationPreview';
import { buildOriginationTrajectorySteps } from '../../lib/loongInvestigationPipeline';

type InvRow = {
  id: string;
  title?: string;
  antecedenteId?: string;
  clientId?: string;
  mesaPrecalAutoPassed?: boolean;
  mesaPrecalAutoReasons?: string;
  mesaAutomatedDictamen?: string;
  candidateData?: string;
  createdAt?: string;
  status?: string;
  linkStatus?: string;
  creditStage?: string;
  mesaPrecalStatus?: string;
  socioeconomicDictamen?: string;
  creditAnalysisResult?: string;
  identityValidationResult?: string;
};

function parseReasons(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [String(j)];
  } catch {
    return [raw];
  }
}

export const MesaOrigenQueuePanel: React.FC = () => {
  const { user, logUserAction } = useAuthStatus();
  const [rows, setRows] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'investigations'),
        where('investigationScope', '==', 'BASIC'),
        where('clientProfile', '==', 'CREDIT'),
        where('mesaPrecalStatus', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(80)
      );
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as InvRow[]);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo cargar la cola de mesa. ¿Índice compuesto en Firestore?');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const decide = async (inv: InvRow, approved: boolean) => {
    setBusyId(inv.id);
    const note = (notes[inv.id] || '').trim();
    if (!note) {
      toast.error(
        approved
          ? 'Escribe el dictamen de autorización (fundamento de mesa).'
          : 'Escribe el fundamento del rechazo (no procedente).'
      );
      setBusyId(null);
      return;
    }
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'investigations', inv.id), {
        mesaPrecalStatus: approved ? 'approved' : 'rejected',
        mesaPrecalDecision: approved ? 'approved' : 'rejected',
        mesaPrecalNote: note || null,
        mesaPrecalDecidedAt: now,
        originacionPhase2Unlocked: approved,
        updatedAt: now,
        ...(approved
          ? { status: 'IN_PROGRESS', linkStatus: 'IN_PROGRESS', creditStage: 'MESA_CONTROL' }
          : { status: 'REQUIRES_ATTENTION', linkStatus: 'COMPLETED', creditStage: 'MESA_CONTROL' }),
      });
      const linksQ = query(collection(db, 'candidate_links'), where('investigationId', '==', inv.id), limit(5));
      const ls = await getDocs(linksQ);
      for (const d of ls.docs) {
        await updateDoc(d.ref, {
          status: approved ? 'IN_PROGRESS' : 'COMPLETED',
          updatedAt: now,
        });
      }
      logUserAction?.(user?.uid ?? '', 'MESA_ORIGEN_DECISION', {
        investigationId: inv.id,
        approved,
      });
      toast.success(approved ? 'Solicitud autorizada para continuar originación.' : 'Solicitud rechazada.');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar la decisión. Revisa permisos y reglas.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Mesa de control — originación BASIC</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Dictamen automático es referencia; la decisión final es tuya. Al aprobar, el candidato podrá continuar con domicilio,
            comprobantes y arraigo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Actualizar
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-sm text-slate-600 dark:text-slate-300">No hay solicitudes pendientes de mesa.</Card>
      ) : (
        <div className="space-y-4">
          {rows.map((inv) => {
            const reasons = parseReasons(inv.mesaPrecalAutoReasons);
            return (
              <Card key={inv.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{inv.title || 'Solicitante'}</p>
                    <p className="text-xs text-slate-500 font-mono">
                      {inv.antecedenteId || inv.id.slice(0, 10)} · inv {inv.id.slice(0, 8)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      inv.mesaPrecalAutoPassed
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    Auto: {inv.mesaPrecalAutoPassed ? 'favorable' : 'no favorable'}
                  </span>
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-300 list-disc pl-4 space-y-1">
                  {reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                {inv.mesaAutomatedDictamen ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Referencia automática (no editable):</span>{' '}
                    {inv.mesaAutomatedDictamen}
                  </div>
                ) : null}
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200">
                  <p className="font-semibold text-slate-600 dark:text-slate-300">Estado del expediente</p>
                  <p className="mt-1">{mesaQueueProcesoLine(inv as Record<string, unknown>)}</p>
                  {(() => {
                    const ex = mesaQueueDictamenExcerpt(inv as Record<string, unknown>);
                    return ex ? (
                      <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-600">
                        <p className="font-semibold text-slate-600 dark:text-slate-300">Investigación / dictamen</p>
                        <p className="mt-1 whitespace-pre-wrap">{ex}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-slate-500 dark:text-slate-400">
                        Sin dictamen de investigación en el documento todavía (esperado si solo hay precalificación).
                      </p>
                    );
                  })()}
                  {(() => {
                    const traj = buildOriginationTrajectorySteps(inv as Record<string, unknown>);
                    if (!traj?.length) return null;
                    return (
                      <ul className="mt-2 flex flex-wrap gap-1 border-t border-slate-200 pt-2 dark:border-slate-600">
                        {traj.map((s) => (
                          <li
                            key={s.key}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              s.done
                                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                                : s.current
                                  ? 'bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                            title={s.hint}
                          >
                            {s.done ? '✓ ' : ''}
                            {s.label}
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Dictamen y fundamento de mesa de control (obligatorio para dejar constancia; visible al cliente en expediente)
                  </label>
                  <textarea
                    value={notes[inv.id] ?? ''}
                    onChange={(e) => setNotes((p) => ({ ...p, [inv.id]: e.target.value }))}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                    placeholder="Ej. Procedente: se autoriza continuar originación sujeto a documentación. / No procedente: motivos según política…"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === inv.id}
                    onClick={() => void decide(inv, true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Autorizar continuación
                  </button>
                  <button
                    type="button"
                    disabled={busyId === inv.id}
                    onClick={() => void decide(inv, false)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Rechazar
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
