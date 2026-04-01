import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import type { Role } from '../../contexts/AuthContext';
import { stageLabelEs, type LoongOriginationCase } from '../../lib/loongOrigination';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';

type CommentRow = {
  id: string;
  caseId?: string;
  body?: string;
  authorRole?: string;
  createdAt?: string;
};

const COBRANZA_STAGES: LoongOriginationCase['originationStage'][] = [
  'FIRMAS_PENDIENTE',
  'ENTREGA_PROGRAMADA',
  'COBRANZA_ACTIVA',
  'CERRADO',
];

type Props = {
  cases: LoongOriginationCase[];
  loadingCases: boolean;
  organizationId: string | null;
  userUid: string;
  role: Role;
  onRefreshCases: () => void;
};

export const LoongCobranzaCrmTab: React.FC<Props> = ({
  cases,
  loadingCases,
  organizationId,
  userUid,
  role,
  onRefreshCases,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const cobranzaCases = useMemo(
    () => cases.filter((c) => COBRANZA_STAGES.includes(c.originationStage)),
    [cases]
  );

  const loadComments = useCallback(async () => {
    if (!organizationId) {
      setComments([]);
      return;
    }
    setLoadingComments(true);
    try {
      const q = query(collection(db, 'loong_cobranza_comments'), where('organizationId', '==', organizationId));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CommentRow[];
      list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      setComments(list);
    } catch (e) {
      console.error(e);
      toast.error('No se pudieron cargar los comentarios de cobranza.');
    } finally {
      setLoadingComments(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !selectedCaseId.trim() || !commentBody.trim()) {
      toast.error('Selecciona expediente y escribe un comentario.');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'loong_cobranza_comments'), {
        organizationId,
        caseId: selectedCaseId.trim(),
        authorUid: userUid,
        authorRole: role || '—',
        body: commentBody.trim(),
        createdAt: new Date().toISOString(),
      });
      setCommentBody('');
      toast.success('Comentario registrado.');
      await loadComments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const commentsByCase = useMemo(() => {
    const m = new Map<string, CommentRow[]>();
    for (const c of comments) {
      const k = c.caseId || '';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [comments]);

  if (!organizationId) {
    return (
      <p className="text-sm text-amber-800">
        Tu usuario debe tener <strong>organizationId</strong> en Firestore para usar el CRM de cobranza.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Seguimiento de cobranza por expediente (etapas posteriores a documentación). Los comentarios son solo para equipo
        interno y proveedor de cobranza.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Expedientes en cobranza / entrega</h2>
        <button
          type="button"
          onClick={() => {
            onRefreshCases();
            loadComments();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
        >
          <RefreshCw className={`h-4 w-4 ${loadingCases ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {loadingCases ? (
        <JuxaVerifyLoader text="Cargando expedientes…" />
      ) : cobranzaCases.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No hay expedientes en etapa de firmas, entrega o cobranza aún.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Etapa</th>
                <th className="px-3 py-2">Comentarios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cobranzaCases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80/80 dark:bg-slate-950/80">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{c.clientName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{c.clientEmail}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {stageLabelEs(c.originationStage)}
                    </span>
                  </td>
                  <td className="max-w-md px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                    {(commentsByCase.get(c.id) || []).slice(0, 3).map((cm) => (
                      <div key={cm.id} className="mb-1 border-l-2 border-amber-200 pl-2">
                        <span className="text-slate-400 dark:text-slate-500">{cm.createdAt?.slice(0, 10)} · </span>
                        {cm.body}
                      </div>
                    ))}
                    {(commentsByCase.get(c.id) || []).length === 0 ? '—' : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={submitComment} className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5">
        <h3 className="mb-3 text-sm font-semibold text-amber-950">Nuevo comentario de cobranza</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Expediente
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
            >
              <option value="">— Elegir —</option>
              {cobranzaCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.clientName} · {stageLabelEs(c.originationStage)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
          Comentario
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            rows={3}
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Gestión de cobranza, acuerdos, seguimiento con proveedor…"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Registrar comentario'}
        </button>
      </form>

      {loadingComments ? null : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Historial reciente (todos los expedientes)</h4>
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm text-slate-700 dark:text-slate-200">
            {comments.slice(0, 40).map((cm) => (
              <li key={cm.id} className="border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{cm.caseId}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500"> · {cm.createdAt}</span>
                <p className="mt-0.5">{cm.body}</p>
              </li>
            ))}
            {comments.length === 0 && <li className="text-slate-500 dark:text-slate-400">Sin comentarios aún.</li>}
          </ul>
        </div>
      )}
    </div>
  );
};
