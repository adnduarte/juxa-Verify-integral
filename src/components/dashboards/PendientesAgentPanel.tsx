import React, { useMemo, useState } from 'react';
import { AlertCircle, Bot, Clock, ListFilter, Search, Zap } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';

type QueueFilter = 'all' | 'pending' | 'in_progress' | 'attention';

const canTakePendingCase = (role: string | undefined) =>
  !!role &&
  [
    'ADMIN',
    'SUPERVISOR',
    'ANALISTA_MESA_CONTROL',
    'INVESTIGADOR',
    'INVESTIGADOR_SOCIAL',
    'REVISOR_RRHH',
    'ANALISTA_CREDITO',
  ].includes(role);

function sortQueue(a: any, b: any) {
  const rank = (s: string) =>
    s === 'REQUIRES_ATTENTION' ? 0 : s === 'PENDING' ? 1 : s === 'IN_PROGRESS' ? 2 : 3;
  const dr = rank(a.status) - rank(b.status);
  if (dr !== 0) return dr;
  const ta = new Date(a.createdAt || 0).getTime();
  const tb = new Date(b.createdAt || 0).getTime();
  return ta - tb;
}

export const PendientesAgentPanel: React.FC<{
  investigations: any[];
  contextLabel?: string;
}> = ({ investigations, contextLabel }) => {
  const { role } = useAuthStatus();
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const pending = investigations.filter((i) => i.status === 'PENDING').length;
    const inProgress = investigations.filter((i) => i.status === 'IN_PROGRESS').length;
    const attention = investigations.filter((i) => i.status === 'REQUIRES_ATTENTION').length;
    return { pending, inProgress, attention, total: investigations.length };
  }, [investigations]);

  const queue = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (inv: any) => {
      if (!q) return true;
      const blob = [
        inv.id,
        inv.title,
        inv.details,
        inv.candidateName,
        inv.clientProfile,
        inv.investigationType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    };

    let list = investigations.filter((inv) => {
      if (inv.status === 'COMPLETED') return false;
      if (queueFilter === 'pending') return inv.status === 'PENDING';
      if (queueFilter === 'in_progress') return inv.status === 'IN_PROGRESS';
      if (queueFilter === 'attention') return inv.status === 'REQUIRES_ATTENTION';
      return ['PENDING', 'IN_PROGRESS', 'REQUIRES_ATTENTION'].includes(inv.status);
    });

    list = list.filter(matches).sort(sortQueue);
    return list;
  }, [investigations, queueFilter, search]);

  const takeCase = async (inv: any) => {
    if (!auth.currentUser || inv.status !== 'PENDING') return;
    setBusyId(inv.id);
    try {
      await updateDoc(doc(db, 'investigations', inv.id), {
        status: 'IN_PROGRESS',
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo actualizar el caso.');
    } finally {
      setBusyId(null);
    }
  };

  const showTake = canTakePendingCase(role);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-700 mb-1">
            <Bot className="w-6 h-6" />
            <span className="text-xs font-bold uppercase tracking-wider">Agente operativo</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Cola de pendientes</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
            {contextLabel ||
              'Prioriza lo urgente, filtra por estado y toma casos sin salir de esta vista.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium">
            Pendientes: <strong>{counts.pending}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 font-medium">
            En proceso: <strong>{counts.inProgress}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 font-medium">
            Atención: <strong>{counts.attention}</strong>
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por folio, título, candidato o detalle…"
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <ListFilter className="w-4 h-4 text-slate-400 dark:text-slate-500 hidden sm:block" />
          {(
            [
              ['all', 'Activos', counts.pending + counts.inProgress + counts.attention],
              ['pending', 'Sin iniciar', counts.pending],
              ['in_progress', 'En proceso', counts.inProgress],
              ['attention', 'Urgentes', counts.attention],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setQueueFilter(id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                queueFilter === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {queue.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <Clock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No hay elementos en esta vista.</p>
            <p className="text-sm mt-1">Prueba otro filtro o limpia la búsqueda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {queue.map((inv) => (
              <li
                key={inv.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/80/80 dark:bg-slate-950/80 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      inv.status === 'REQUIRES_ATTENTION'
                        ? 'bg-amber-100 text-amber-700'
                        : inv.status === 'PENDING'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {inv.status === 'REQUIRES_ATTENTION' ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        INV-{String(inv.id).substring(0, 8)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          inv.status === 'REQUIRES_ATTENTION'
                            ? 'bg-amber-100 text-amber-800'
                            : inv.status === 'PENDING'
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                              : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {inv.status === 'REQUIRES_ATTENTION'
                          ? 'Requiere atención'
                          : inv.status === 'PENDING'
                            ? 'Pendiente'
                            : 'En proceso'}
                      </span>
                      {inv.clientProfile && (
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
                          {inv.clientProfile}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {inv.candidateName || inv.title || 'Sin título'}
                    </h3>
                    {inv.details && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{inv.details}</p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      Creado: {new Date(inv.createdAt || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex sm:flex-col gap-2 flex-shrink-0">
                  {showTake && inv.status === 'PENDING' && (
                    <button
                      type="button"
                      disabled={busyId === inv.id}
                      onClick={() => takeCase(inv)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60 shadow-sm transition-colors"
                    >
                      <Zap className="w-4 h-4" />
                      {busyId === inv.id ? 'Guardando…' : 'Tomar caso'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
