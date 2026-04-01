import React, { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import type { Role } from '../../contexts/AuthContext';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';

type Ticket = {
  id: string;
  organizationId?: string;
  createdByUid?: string;
  subject?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type MessageRow = {
  id: string;
  authorUid?: string;
  authorRole?: string;
  body?: string;
  createdAt?: string;
};

type Props = {
  organizationId: string | null;
  userUid: string;
  role: Role;
};

export const LoongSupportTicketsTab: React.FC<Props> = ({ organizationId, userUid, role }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [creating, setCreating] = useState(false);
  const [replying, setReplying] = useState(false);

  const staffCanManage = role === 'ATENCION_CLIENTE' || role === 'ADMIN' || role === 'SUPERVISOR';

  const loadTickets = useCallback(async () => {
    if (!organizationId) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Important: Firestore rules allow non-staff users to read ONLY their own tickets.
      // If we query by organization only, the query becomes invalid (could match other users' docs) and Firestore rejects it.
      const base = collection(db, 'loong_support_tickets');
      const q = staffCanManage
        ? query(base, where('organizationId', '==', organizationId))
        : query(base, where('organizationId', '==', organizationId), where('createdByUid', '==', userUid));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Ticket[];
      list.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
      setTickets(list);
    } catch (e) {
      console.error(e);
      toast.error('No se pudieron cargar los tickets.');
    } finally {
      setLoading(false);
    }
  }, [organizationId, staffCanManage, userUid]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const loadMessages = useCallback(
    async (ticketId: string) => {
      setLoadingMsg(true);
      try {
        const snap = await getDocs(collection(db, 'loong_support_tickets', ticketId, 'messages'));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MessageRow[];
        list.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
        setMessages(list);
      } catch (e) {
        console.error(e);
        toast.error('No se pudieron cargar los mensajes.');
        setMessages([]);
      } finally {
        setLoadingMsg(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !newSubject.trim()) {
      toast.error('Asunto requerido.');
      return;
    }
    setCreating(true);
    try {
      const now = new Date().toISOString();
      const ref = await addDoc(collection(db, 'loong_support_tickets'), {
        organizationId,
        createdByUid: userUid,
        subject: newSubject.trim(),
        status: 'abierto',
        createdAt: now,
        updatedAt: now,
      });
      if (newBody.trim()) {
        await addDoc(collection(db, 'loong_support_tickets', ref.id, 'messages'), {
          authorUid: userUid,
          authorRole: role || '—',
          body: newBody.trim(),
          createdAt: now,
        });
      }
      setNewSubject('');
      setNewBody('');
      toast.success('Ticket creado.');
      await loadTickets();
      setSelectedId(ref.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear ticket.');
    } finally {
      setCreating(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !replyBody.trim()) return;
    setReplying(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'loong_support_tickets', selectedId, 'messages'), {
        authorUid: userUid,
        authorRole: role || '—',
        body: replyBody.trim(),
        createdAt: now,
      });
      await updateDoc(doc(db, 'loong_support_tickets', selectedId), {
        updatedAt: now,
        status: staffCanManage ? 'en_atencion' : 'abierto',
      });
      setReplyBody('');
      toast.success('Mensaje enviado.');
      await loadMessages(selectedId);
      await loadTickets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar.');
    } finally {
      setReplying(false);
    }
  };

  const passToSupport = async (ticketId: string) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'loong_support_tickets', ticketId), {
        status: 'en_atencion',
        updatedAt: now,
      });
      toast.success('Enviado a atención al cliente.');
      await loadTickets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const setStatus = async (ticketId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'loong_support_tickets', ticketId), {
        status,
        updatedAt: new Date().toISOString(),
      });
      await loadTickets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  if (!organizationId) {
    return (
      <p className="text-sm text-amber-800">
        Falta <strong>organizationId</strong> en tu perfil para usar tickets de soporte.
      </p>
    );
  }

  const selected = tickets.find((t) => t.id === selectedId);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tickets</h2>
          <button
            type="button"
            onClick={loadTickets}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {loading ? (
          <JuxaVerifyLoader text="Cargando…" />
        ) : (
          <ul className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    selectedId === t.id ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">{t.subject}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t.status} · {t.createdAt?.slice(0, 16)}
                  </div>
                </button>
              </li>
            ))}
            {tickets.length === 0 && <li className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">No hay tickets.</li>}
          </ul>
        )}

        <form onSubmit={createTicket} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Nuevo ticket</h3>
          <input
            className="mb-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            placeholder="Asunto"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
          />
          <textarea
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            rows={3}
            placeholder="Detalle (opcional, se guarda como primer mensaje)"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creando…' : 'Crear ticket'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        {!selectedId || !selected ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Selecciona un ticket o crea uno nuevo.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{selected.subject}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Estado: {selected.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.createdByUid === userUid && selected.status === 'abierto' && (
                  <button
                    type="button"
                    onClick={() => passToSupport(selected.id)}
                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-900"
                  >
                    Pasar a atención
                  </button>
                )}
                {staffCanManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => setStatus(selected.id, 'en_atencion')}
                      className="rounded-lg border px-2 py-1 text-xs"
                    >
                      En atención
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(selected.id, 'cerrado')}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
                    >
                      Cerrar
                    </button>
                  </>
                )}
              </div>
            </div>

            {loadingMsg ? (
              <JuxaVerifyLoader text="Mensajes…" />
            ) : (
              <ul className="mb-4 max-h-64 space-y-3 overflow-y-auto text-sm">
                {messages.map((m) => (
                  <li key={m.id} className="rounded-lg bg-slate-50 dark:bg-slate-950 px-3 py-2">
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      {m.authorRole} · {m.createdAt}
                    </div>
                    <p className="mt-1 text-slate-800 dark:text-slate-200">{m.body}</p>
                  </li>
                ))}
                {messages.length === 0 && <li className="text-slate-500 dark:text-slate-400">Sin mensajes aún.</li>}
              </ul>
            )}

            <form onSubmit={sendReply} className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <textarea
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                rows={3}
                placeholder="Escribe una respuesta…"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
              />
              <button
                type="submit"
                disabled={replying || !replyBody.trim()}
                className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {replying ? 'Enviando…' : 'Enviar mensaje'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
