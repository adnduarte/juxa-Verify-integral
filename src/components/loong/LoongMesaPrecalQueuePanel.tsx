import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { CheckCircle2, ClipboardList, Link2, RefreshCw, Sparkles, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import { issueStandaloneLoongPrecalLink } from '../../lib/loongFlowRequests';
import { DEFAULT_ORGANIZATION_ID_LOONG } from '../../lib/organizations';
import { mesaQueueDictamenExcerpt, mesaQueueProcesoLine } from '../../lib/mesaQueueInvestigationPreview';
import { buildOriginationTrajectorySteps } from '../../lib/loongInvestigationPipeline';
import { loongUserHasMesaDeskVisibility } from '../../lib/loongMesaDeskAccess';

type InvRow = {
  id: string;
  title?: string;
  investigationScope?: string;
  clientProfile?: string;
  investigationType?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateLink?: string;
  organizationId?: string;
  mesaPrecalAutoPassed?: boolean;
  mesaPrecalAutoReasons?: string;
  mesaAutomatedDictamen?: string;
  candidateData?: string;
  score?: number;
  createdAt?: string;
  status?: string;
  linkStatus?: string;
  creditStage?: string;
  mesaPrecalStatus?: string;
  socioeconomicDictamen?: string;
  creditAnalysisResult?: string;
  identityValidationResult?: string;
  loongMotorPolicyApplies?: boolean;
};

function parseReasons(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j.map(String) : [String(j)];
  } catch {
    return [raw];
  }
}

function createdMs(iso: string | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Incluye casos que deben dictaminarse aunque falte `mesaPrecalStatus` en Firestore o solo exista `linkStatus`. */
function mesaQueueNeedsHumanDecision(inv: InvRow): boolean {
  const ms = inv.mesaPrecalStatus;
  if (ms === 'approved' || ms === 'rejected' || ms === 'precal_failed') return false;
  if (ms === 'pending') return true;
  const ls = inv.linkStatus || '';
  if (ls === 'AWAITING_MESA') return true;
  if (
    inv.investigationScope === 'LOONG_PRECAL' &&
    inv.clientProfile === 'LOONG_MOTOR' &&
    ls === 'PHASE_1_COMPLETED'
  ) {
    if (inv.status === 'COMPLETED') return false;
    return true;
  }
  return false;
}

export const LoongMesaPrecalQueuePanel: React.FC = () => {
  const { user, role, logUserAction, effectiveOrganizationId, organizationId, loongTeamTier } = useAuthStatus();
  const [rows, setRows] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [manualTitle, setManualTitle] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  const mesaOperator = useMemo(
    () =>
      role === 'ANALISTA_MESA_CONTROL' ||
      role === 'SUPERVISOR' ||
      role === 'ADMIN' ||
      loongUserHasMesaDeskVisibility({
        role: role ?? '',
        userEmail: user?.email ?? null,
        loongTeamTier,
      }),
    [role, user?.email, loongTeamTier]
  );

  /** Misma idea que canSeeAllCases en el workspace: mesa y admin ven cola global. */
  const mesaGlobalQueue = mesaOperator;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const effectiveOrgId =
        (effectiveOrganizationId ?? organizationId ?? '').trim() || DEFAULT_ORGANIZATION_ID_LOONG;

      const qPrecal = query(
        collection(db, 'investigations'),
        where('investigationScope', '==', 'LOONG_PRECAL'),
        where('clientProfile', '==', 'LOONG_MOTOR'),
        where('mesaPrecalStatus', '==', 'pending'),
        limit(100)
      );

      const qBasicOrg = mesaGlobalQueue
        ? query(
            collection(db, 'investigations'),
            where('investigationScope', '==', 'BASIC'),
            where('clientProfile', '==', 'CREDIT'),
            where('mesaPrecalStatus', '==', 'pending'),
            limit(100)
          )
        : query(
            collection(db, 'investigations'),
            where('organizationId', '==', effectiveOrgId),
            where('investigationScope', '==', 'BASIC'),
            where('clientProfile', '==', 'CREDIT'),
            where('mesaPrecalStatus', '==', 'pending'),
            limit(100)
          );

      const qBasicLoongFlag = query(
        collection(db, 'investigations'),
        where('investigationScope', '==', 'BASIC'),
        where('loongMotorPolicyApplies', '==', true),
        where('mesaPrecalStatus', '==', 'pending'),
        limit(100)
      );

      const qBasicAwaitingMesa = mesaGlobalQueue
        ? query(
            collection(db, 'investigations'),
            where('investigationScope', '==', 'BASIC'),
            where('clientProfile', '==', 'CREDIT'),
            where('linkStatus', '==', 'AWAITING_MESA'),
            limit(100)
          )
        : query(
            collection(db, 'investigations'),
            where('organizationId', '==', effectiveOrgId),
            where('investigationScope', '==', 'BASIC'),
            where('clientProfile', '==', 'CREDIT'),
            where('linkStatus', '==', 'AWAITING_MESA'),
            limit(100)
          );

      const qBasicLoongAwaitingMesa = query(
        collection(db, 'investigations'),
        where('investigationScope', '==', 'BASIC'),
        where('loongMotorPolicyApplies', '==', true),
        where('linkStatus', '==', 'AWAITING_MESA'),
        limit(100)
      );

      const qPrecalPhase1Done = query(
        collection(db, 'investigations'),
        where('investigationScope', '==', 'LOONG_PRECAL'),
        where('clientProfile', '==', 'LOONG_MOTOR'),
        where('linkStatus', '==', 'PHASE_1_COMPLETED'),
        limit(100)
      );

      const runQuery = async (q: ReturnType<typeof query>) => {
        try {
          return { ok: true as const, snap: await getDocs(q) };
        } catch (err) {
          return { ok: false as const, err };
        }
      };

      const results = await Promise.all([
        runQuery(qPrecal),
        runQuery(qBasicOrg),
        runQuery(qBasicLoongFlag),
        runQuery(qBasicAwaitingMesa),
        runQuery(qBasicLoongAwaitingMesa),
        runQuery(qPrecalPhase1Done),
      ]);

      const failures = results.filter((r) => !r.ok) as { ok: false; err: unknown }[];
      if (failures.length > 0) {
        for (const f of failures) {
          console.error('[LoongMesaPrecalQueue] consulta fallida:', f.err);
        }
        const first = failures[0].err;
        const code =
          first && typeof first === 'object' && 'code' in first ? String((first as { code: string }).code) : '';
        const msg =
          first && typeof first === 'object' && 'message' in first
            ? String((first as { message: string }).message)
            : '';

        if (code === 'permission-denied') {
          toast.error(
            'Sin permiso para leer la cola de mesa. Cierra sesión y vuelve a entrar, o revisa en Firestore users tu rol y loongTeamTier.'
          );
        } else if (code === 'failed-precondition' || /index/i.test(msg)) {
          toast.error(
            'Falta índice en Firestore para una consulta. Ejecuta: npm run deploy:firestore-indexes'
          );
        } else {
          toast.error(
            msg ? `Cola mesa: ${msg.slice(0, 120)}${msg.length > 120 ? '…' : ''}` : 'No se pudo cargar la cola de mesa.'
          );
        }
      }

      const emptySnap = { docs: [] } as Awaited<ReturnType<typeof getDocs>>;
      const snapPrecal = results[0].ok ? results[0].snap : emptySnap;
      const snapBasicOrg = results[1].ok ? results[1].snap : emptySnap;
      const snapBasicFlag = results[2].ok ? results[2].snap : emptySnap;
      const snapBasicAwaiting = results[3].ok ? results[3].snap : emptySnap;
      const snapBasicLoongAwaiting = results[4].ok ? results[4].snap : emptySnap;
      const snapPrecalPhase1 = results[5].ok ? results[5].snap : emptySnap;

      const byId = new Map<string, InvRow>();

      const pushRows = (docs: typeof snapPrecal.docs, filter?: (r: InvRow) => boolean) => {
        for (const d of docs) {
          const data = d.data() as Record<string, unknown>;
          const row = { id: d.id, ...data } as InvRow;
          if (filter && !filter(row)) continue;
          byId.set(row.id, row);
        }
      };

      const orgOk = (r: InvRow) => !r.organizationId || r.organizationId === effectiveOrgId;
      const needsMesa = (r: InvRow) => mesaQueueNeedsHumanDecision(r);

      if (mesaGlobalQueue) {
        pushRows(snapPrecal.docs);
        pushRows(snapBasicOrg.docs);
        pushRows(snapBasicFlag.docs);
        pushRows(snapBasicAwaiting.docs, needsMesa);
        pushRows(snapBasicLoongAwaiting.docs, (r) => needsMesa(r));
        pushRows(snapPrecalPhase1.docs, needsMesa);
      } else {
        pushRows(
          snapPrecal.docs,
          (r) => (!r.organizationId || r.organizationId === effectiveOrgId)
        );
        pushRows(snapBasicOrg.docs);
        pushRows(snapBasicFlag.docs, (r) => orgOk(r));
        pushRows(snapBasicAwaiting.docs, (r) => needsMesa(r));
        pushRows(snapBasicLoongAwaiting.docs, (r) => needsMesa(r) && orgOk(r));
        pushRows(snapPrecalPhase1.docs, (r) => needsMesa(r) && orgOk(r));
      }

      const list = [...byId.values()].sort((a, b) => createdMs(b.createdAt) - createdMs(a.createdAt));
      setRows(list);
    } catch (e) {
      console.error(e);
      toast.error('Error inesperado al cargar la cola de mesa. Revisa la consola del navegador.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveOrganizationId, organizationId, mesaGlobalQueue]);

  useEffect(() => {
    void load();
  }, [load]);

  const findLinkDocId = async (investigationId: string, candidateLinkId?: string) => {
    if (candidateLinkId) {
      const snap = await getDoc(doc(db, 'candidate_links', candidateLinkId));
      if (snap.exists()) return snap.id;
    }
    const lq = query(collection(db, 'candidate_links'), where('investigationId', '==', investigationId), limit(5));
    const ls = await getDocs(lq);
    return ls.empty ? null : ls.docs[0].id;
  };

  const decide = async (inv: InvRow, approved: boolean) => {
    if (!mesaOperator) {
      toast.error('Tu rol no puede dictaminar en esta mesa.');
      return;
    }
    setBusyId(inv.id);
    const note = (notes[inv.id] || '').trim();
    if (!note) {
      toast.error(
        approved
          ? 'Escribe el dictamen de autorización (fundamento de mesa).'
          : 'Escribe el fundamento del rechazo.'
      );
      setBusyId(null);
      return;
    }
    const now = new Date().toISOString();
    try {
      const linkDocId = await findLinkDocId(inv.id, inv.candidateLink);
      const isBasicCreditMesa =
        inv.investigationScope === 'BASIC' &&
        (inv.clientProfile === 'CREDIT' || inv.loongMotorPolicyApplies === true);

      if (isBasicCreditMesa) {
        await updateDoc(doc(db, 'investigations', inv.id), {
          mesaPrecalStatus: approved ? 'approved' : 'rejected',
          mesaPrecalDecision: approved ? 'approved' : 'rejected',
          mesaPrecalNote: note,
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
      } else if (approved) {
        await updateDoc(doc(db, 'investigations', inv.id), {
          mesaPrecalStatus: 'approved',
          mesaPrecalDecision: 'approved',
          mesaPrecalNote: note,
          mesaPrecalDecidedAt: now,
          loongPhase2Unlocked: true,
          investigationScope: 'INTEGRAL',
          creditStage: 'QUALIFICATION',
          status: 'IN_PROGRESS',
          linkStatus: 'IN_PROGRESS',
          updatedAt: now,
        });
        if (linkDocId) {
          await updateDoc(doc(db, 'candidate_links', linkDocId), {
            investigationScope: 'INTEGRAL',
            status: 'IN_PROGRESS',
            updatedAt: now,
          });
        }
      } else {
        await updateDoc(doc(db, 'investigations', inv.id), {
          mesaPrecalStatus: 'rejected',
          mesaPrecalDecision: 'rejected',
          mesaPrecalNote: note,
          mesaPrecalDecidedAt: now,
          status: 'REQUIRES_ATTENTION',
          linkStatus: 'COMPLETED',
          updatedAt: now,
        });
        if (linkDocId) {
          await updateDoc(doc(db, 'candidate_links', linkDocId), {
            status: 'COMPLETED',
            updatedAt: now,
          });
        }
      }
      logUserAction?.(user?.uid ?? '', 'LOONG_MESA_PRECAL_DECISION', { investigationId: inv.id, approved });
      toast.success(approved ? 'Precalificación admitida: fase 2 habilitada.' : 'Solicitud rechazada.');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar. Revisa permisos o vuelve a intentar.');
    } finally {
      setBusyId(null);
    }
  };

  const onManualPrecalLink = async () => {
    if (!user?.uid || !mesaOperator) return;
    const t = manualTitle.trim();
    if (!t) {
      toast.error('Indica un título o referencia del prospecto.');
      return;
    }
    setManualBusy(true);
    try {
      const { url } = await issueStandaloneLoongPrecalLink(db, {
        title: t,
        testMode: false,
        clientIdForInv: user.uid,
        organizationId: effectiveOrganizationId ?? undefined,
        requestedByUidForAudit: user.uid,
      });
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Enlace de precalificación copiado.');
      } catch {
        toast.success(url);
      }
      setManualTitle('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el enlace.');
    } finally {
      setManualBusy(false);
    }
  };

  const card =
    'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm';

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-amber-600" aria-hidden />
              Mesa de control — precalificación Loong Motor
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Incluye precalificación moto (LOONG_PRECAL) y originación BASIC de tu organización en espera de mesa. Admite o rechaza cuando el
              candidato ya envió el cuestionario. Al autorizar BASIC, se habilita la fase 2 (documentación). También puedes generar un enlace nuevo o
              dar de alta en el CRM.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-emerald-600" />
              Iniciar precalificación (enlace)
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Genera un enlace para que el candidato complete el cuestionario en su celular.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Ej. Precal — Juan Pérez"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={manualBusy || !mesaOperator}
                onClick={() => void onManualPrecalLink()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {manualBusy ? 'Generando…' : 'Generar enlace'}
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/40 p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              Alta manual en CRM
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Crea un expediente con simulación y envío directo a mesa (MESA_INTAKE).
            </p>
            <Link
              to="/dashboard/loong/crm"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Abrir CRM precalificación
            </Link>
          </div>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cola pendiente de dictamen</h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">No hay precalificaciones esperando mesa.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {rows.map((inv) => {
              const reasons = parseReasons(inv.mesaPrecalAutoReasons);
              return (
                <li
                  key={inv.id}
                  className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{inv.title || 'Solicitud Loong'}</p>
                        {inv.investigationScope === 'BASIC' ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                            Originación BASIC
                          </span>
                        ) : (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                            Precal moto
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{inv.id.slice(0, 12)}…</p>
                      {(inv.candidateEmail || inv.candidatePhone) && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {inv.candidateEmail || '—'} · {inv.candidatePhone || '—'}
                        </p>
                      )}
                      {typeof inv.score === 'number' && (
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-1">Score motor: {inv.score}</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        inv.mesaPrecalAutoPassed
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                          : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                      }`}
                    >
                      <Sparkles className="h-3 w-3" />
                      Auto: {inv.mesaPrecalAutoPassed ? 'favorable' : 'revisar'}
                    </span>
                  </div>
                  {reasons.length > 0 && (
                    <ul className="text-xs text-slate-600 dark:text-slate-300 list-disc pl-4 space-y-0.5">
                      {reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {inv.mesaAutomatedDictamen ? (
                    <p className="text-xs text-slate-600 dark:text-slate-400 rounded-lg bg-white/80 dark:bg-slate-900/60 px-3 py-2 border border-slate-200/80 dark:border-slate-700">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Referencia: </span>
                      {inv.mesaAutomatedDictamen}
                    </p>
                  ) : null}
                  <div className="rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-200">
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Estado del expediente</p>
                    <p className="mt-1 leading-relaxed">{mesaQueueProcesoLine(inv as Record<string, unknown>)}</p>
                    {(() => {
                      const ex = mesaQueueDictamenExcerpt(inv as Record<string, unknown>);
                      return ex ? (
                        <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-600">
                          <p className="font-semibold text-slate-600 dark:text-slate-300">Investigación / dictamen (IA o manual)</p>
                          <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{ex}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-slate-500 dark:text-slate-400">
                          Aún no hay dictamen de investigación en el expediente (normal si solo concluyó la precalificación y falta mesa o fase 2).
                        </p>
                      );
                    })()}
                    {(() => {
                      const traj = buildOriginationTrajectorySteps(inv as Record<string, unknown>);
                      if (!traj?.length) return null;
                      return (
                        <ul className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-600">
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
                  <div className="flex flex-wrap gap-3 text-xs font-semibold">
                    {inv.candidateLink ? (
                      <a
                        href={`${window.location.origin}/candidate/${inv.candidateLink}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Ver enlace candidato
                      </a>
                    ) : null}
                    <Link
                      to={`/dashboard?tab=investigaciones&highlightInv=${encodeURIComponent(inv.id)}`}
                      className="inline-flex text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Abrir en Investigaciones (lista completa)
                    </Link>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Dictamen y fundamento (obligatorio)
                    </label>
                    <textarea
                      value={notes[inv.id] ?? ''}
                      onChange={(e) => setNotes((p) => ({ ...p, [inv.id]: e.target.value }))}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                      placeholder="Ej. Procedente: se admite precalificación y se habilita fase 2…"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === inv.id || !mesaOperator}
                      onClick={() => void decide(inv, true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Admitir / habilitar fase 2
                    </button>
                    <button
                      type="button"
                      disabled={busyId === inv.id || !mesaOperator}
                      onClick={() => void decide(inv, false)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Rechazar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
