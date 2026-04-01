import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore';
import toast from 'react-hot-toast';
import type { Role } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { isSuperAdminEmail } from '../../config/superadmins';
import { defaultOrganizationIdFromEmail } from '../../lib/organizations';

type ChatMessage = {
  id: string;
  organizationId: string;
  authorUid: string;
  authorRole: string;
  body: string;
  createdAt: string;
};

type Announcement = {
  id: string;
  organizationId: string;
  authorUid: string;
  authorRole: string;
  title: string;
  body: string;
  createdAt: string;
};

const STAFF_WIDE_ROLES: Role[] = [
  'ADMIN',
  'SUPERVISOR',
  'EJECUTIVO_VENTAS',
  'ANALISTA_MESA_CONTROL',
  'ATENCION_CLIENTE',
  'GERENTE_DIRECTIVO',
  'ANALISTA_CREDITO',
  'ADMIN_COBRANZA',
  'AGENTE_COBRANZA',
];

type Props = {
  organizationId: string | null;
  userUid: string;
  userEmail: string | null;
  role: Role;
};

async function resolveOrganizationId(
  uid: string,
  email: string | null,
  ctxOrg: string | null
): Promise<string | null> {
  if (ctxOrg?.trim()) return ctxOrg.trim();
  try {
    const u = await getDoc(doc(db, 'users', uid));
    if (u.exists()) {
      const o = u.data().organizationId;
      if (typeof o === 'string' && o.trim()) return o.trim();
    }
  } catch {
    /* ignore */
  }
  if (email?.trim()) {
    const em = email.trim().toLowerCase();
    try {
      const pr = await getDoc(doc(db, 'pre_registered_users', em));
      if (pr.exists()) {
        const po = pr.data().organizationId;
        if (typeof po === 'string' && po.trim()) return po.trim();
      }
    } catch {
      /* ignore */
    }
    const fromDomain = defaultOrganizationIdFromEmail(em);
    if (fromDomain) return fromDomain;
  }
  return null;
}

async function resolveBranchNickname(uid: string, email: string | null): Promise<string> {
  try {
    const u = await getDoc(doc(db, 'users', uid));
    if (u.exists()) {
      const b = u.data().branchNickname;
      if (typeof b === 'string' && b.trim()) return b.trim();
    }
  } catch {
    /* ignore */
  }
  if (email?.trim()) {
    try {
      const pr = await getDoc(doc(db, 'pre_registered_users', email.trim().toLowerCase()));
      if (pr.exists()) {
        const pb = pr.data().branchNickname;
        if (typeof pb === 'string' && pb.trim()) return pb.trim();
      }
    } catch {
      /* ignore */
    }
  }
  return '';
}

export const LoongWorkspaceChatTab: React.FC<Props> = ({ organizationId, userUid, userEmail, role }) => {
  const [mode, setMode] = useState<'chat' | 'announcements'>('chat');
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(null);
  const [branchNickname, setBranchNickname] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  const [chatSubTab, setChatSubTab] = useState<'general' | 'team'>('general');
  const [staffTeamKey, setStaffTeamKey] = useState('');

  const [chatRows, setChatRows] = useState<ChatMessage[]>([]);
  const [annRows, setAnnRows] = useState<Announcement[]>([]);
  const [body, setBody] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [sending, setSending] = useState(false);

  const isStaffWide = !!(role && STAFF_WIDE_ROLES.includes(role));
  const platformOrLoongSuper = userEmail ? isSuperAdminEmail(userEmail) : false;

  const canPostGeneral = isStaffWide || platformOrLoongSuper;
  const canPostAnnouncements = (role === 'ADMIN' || role === 'SUPERVISOR') || platformOrLoongSuper;

  const teamKeyActive = useMemo(() => {
    if (chatSubTab !== 'team') return '';
    if (isStaffWide) return staffTeamKey.trim();
    return branchNickname.trim();
  }, [chatSubTab, isStaffWide, staffTeamKey, branchNickname]);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const [org, br] = await Promise.all([
        resolveOrganizationId(userUid, userEmail, organizationId),
        resolveBranchNickname(userUid, userEmail),
      ]);
      setResolvedOrgId(org);
      setBranchNickname(br);
    } finally {
      setProfileLoading(false);
    }
  }, [userUid, userEmail, organizationId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const orgId = resolvedOrgId;

  useEffect(() => {
    let unsubChat: Unsubscribe | null = null;
    let unsubAnn: Unsubscribe | null = null;
    setChatRows([]);
    setAnnRows([]);
    if (!orgId) return;

    const annRef = collection(db, 'organizations', orgId, 'announcements');
    const annQ = query(annRef, orderBy('createdAt', 'desc'), limit(50));
    unsubAnn = onSnapshot(
      annQ,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Announcement[];
        setAnnRows(list);
      },
      (err) => {
        console.error(err);
        toast.error('No se pudieron cargar comunicados.');
      }
    );

    if (mode !== 'chat') {
      return () => {
        if (unsubAnn) unsubAnn();
      };
    }

    if (chatSubTab === 'general') {
      const ref = collection(db, 'organizations', orgId, 'chat_general', 'messages');
      const qy = query(ref, orderBy('createdAt', 'desc'), limit(120));
      unsubChat = onSnapshot(
        qy,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ChatMessage[];
          list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
          setChatRows(list);
        },
        (err) => {
          console.error(err);
          toast.error('No se pudo abrir el chat general.');
        }
      );
    } else if (teamKeyActive) {
      const ref = collection(db, 'organizations', orgId, 'chat_teams', teamKeyActive, 'messages');
      const qy = query(ref, orderBy('createdAt', 'desc'), limit(120));
      unsubChat = onSnapshot(
        qy,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ChatMessage[];
          list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
          setChatRows(list);
        },
        (err) => {
          console.error(err);
          toast.error('No se pudo abrir el chat del equipo.');
        }
      );
    }

    return () => {
      if (unsubChat) unsubChat();
      if (unsubAnn) unsubAnn();
    };
  }, [orgId, mode, chatSubTab, teamKeyActive]);

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !body.trim()) return;
    if (chatSubTab === 'team' && !teamKeyActive) {
      toast.error('Indica el equipo/sucursal o completa tu sucursal en perfil.');
      return;
    }
    if (chatSubTab === 'general' && !canPostGeneral) {
      toast.error('Solo personal autorizado puede escribir en el chat general.');
      return;
    }
    if (chatSubTab === 'team' && !isStaffWide && role === 'CLIENTE' && !branchNickname.trim()) {
      toast.error('Tu usuario no tiene sucursal/equipo asignado. Pídele a tu admin que lo configure.');
      return;
    }
    setSending(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        organizationId: orgId,
        authorUid: userUid,
        authorRole: role || '—',
        body: body.trim(),
        createdAt: now,
      };
      const col =
        chatSubTab === 'general'
          ? collection(db, 'organizations', orgId, 'chat_general', 'messages')
          : collection(db, 'organizations', orgId, 'chat_teams', teamKeyActive, 'messages');
      await addDoc(col, payload);
      setBody('');
    } catch (err) {
      const code = typeof (err as { code?: string })?.code === 'string' ? String((err as { code?: string }).code) : '';
      if (code.includes('permission-denied')) toast.error('Sin permisos para enviar (revisa tenant/equipo).');
      else toast.error(err instanceof Error ? err.message : 'No se pudo enviar.');
    } finally {
      setSending(false);
    }
  };

  const postAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !canPostAnnouncements) return;
    if (!annTitle.trim() || !annBody.trim()) {
      toast.error('Título y mensaje requeridos.');
      return;
    }
    setSending(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'organizations', orgId, 'announcements'), {
        organizationId: orgId,
        authorUid: userUid,
        authorRole: role || '—',
        title: annTitle.trim(),
        body: annBody.trim(),
        createdAt: now,
      });
      setAnnTitle('');
      setAnnBody('');
      toast.success('Comunicado publicado.');
      setMode('announcements');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo publicar.');
    } finally {
      setSending(false);
    }
  };

  if (profileLoading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando perfil de organización…</p>;
  }

  if (!orgId) {
    return (
      <p className="text-sm text-amber-800">
        No se pudo resolver tu <strong>organización</strong> (ni en tu usuario ni en pre-registro). Contacta a tu admin.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Comunicación</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Chat general (organización), chat por equipo/sucursal (aislado por tenant) y comunicados.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode('chat')}
            className={`rounded-lg px-3 py-1.5 ${
              mode === 'chat'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setMode('announcements')}
            className={`rounded-lg px-3 py-1.5 ${
              mode === 'announcements'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            Comunicados
          </button>
        </div>
      </div>

      {mode === 'chat' ? (
        <div className="space-y-4">
          <div className="inline-flex flex-wrap gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-1 text-sm">
            <button
              type="button"
              onClick={() => setChatSubTab('general')}
              className={`rounded-lg px-3 py-1.5 ${
                chatSubTab === 'general'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => setChatSubTab('team')}
              className={`rounded-lg px-3 py-1.5 ${
                chatSubTab === 'team'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              Mi equipo
            </button>
          </div>

          {chatSubTab === 'team' && isStaffWide && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Equipo / sucursal (debe coincidir con el nombre en alta de usuarios)
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={staffTeamKey}
                onChange={(e) => setStaffTeamKey(e.target.value)}
                placeholder="Ej. Sucursal Centro"
              />
            </div>
          )}

          {chatSubTab === 'team' && !isStaffWide && !branchNickname.trim() && (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Tu cuenta no tiene <strong>sucursal/equipo</strong> (branch). Pide a tu administrador que lo asigne en Equipo / perfil para usar el chat de equipo.
            </p>
          )}

          {chatSubTab === 'team' && !isStaffWide && branchNickname.trim() && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Equipo asignado: <strong className="text-slate-800 dark:text-slate-200">{branchNickname}</strong>
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {chatSubTab === 'general' ? 'Chat general' : 'Chat del equipo'}
              </h3>
              <ul className="mt-3 max-h-[420px] space-y-3 overflow-y-auto text-sm">
                {chatSubTab === 'team' && !teamKeyActive ? (
                  <li className="text-slate-500 dark:text-slate-400">Indica el equipo (staff) o asigna sucursal (vendedor).</li>
                ) : (
                  <>
                    {chatRows.map((m) => (
                      <li key={m.id} className="rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-2">
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          {m.authorRole} · {m.createdAt}
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-200">{m.body}</div>
                      </li>
                    ))}
                    {chatRows.length === 0 && (
                      <li className="text-slate-500 dark:text-slate-400">Sin mensajes.</li>
                    )}
                  </>
                )}
              </ul>
            </div>

            <form
              onSubmit={sendChat}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/70 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Enviar mensaje</h3>
              {chatSubTab === 'general' && !canPostGeneral && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Puedes <strong>leer</strong> el chat general. Para escribir aquí se requiere rol de staff, superadmin Loong o plataforma.
                </p>
              )}
              <textarea
                className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                rows={6}
                placeholder="Escribe aquí…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={chatSubTab === 'general' ? !canPostGeneral : !teamKeyActive}
              />
              <button
                type="submit"
                disabled={
                  sending ||
                  !body.trim() ||
                  (chatSubTab === 'general' && !canPostGeneral) ||
                  (chatSubTab === 'team' && !teamKeyActive)
                }
                className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Comunicados</h3>
            <ul className="mt-3 space-y-3">
              {annRows.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{a.title}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{a.createdAt}</div>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{a.body}</div>
                  <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">por {a.authorRole}</div>
                </li>
              ))}
              {annRows.length === 0 && <li className="text-slate-500 dark:text-slate-400">Sin comunicados.</li>}
            </ul>
          </div>

          {canPostAnnouncements ? (
            <form
              onSubmit={postAnnouncement}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/70 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Nuevo comunicado</h3>
              <input
                className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                placeholder="Título"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
              />
              <textarea
                className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                rows={6}
                placeholder="Mensaje"
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
              />
              <button
                type="submit"
                disabled={sending || !annTitle.trim() || !annBody.trim()}
                className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sending ? 'Publicando…' : 'Publicar'}
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/70 p-4 text-sm text-slate-600 dark:text-slate-300">
              Solo <strong>admin / supervisor</strong> de la organización o cuentas de plataforma pueden publicar comunicados.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
