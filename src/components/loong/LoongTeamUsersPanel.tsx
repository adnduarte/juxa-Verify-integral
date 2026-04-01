import React, { useCallback, useEffect, useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, limit, query, setDoc, where, doc } from 'firebase/firestore';
import { Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import type { Role } from '../../contexts/AuthContext';
import { LOGIN_LOONG_MOTOR_URL } from '../../config/loongLinks';
import { secondaryAuth, signOutSecondaryAuth } from '../../lib/secondaryFirebaseAuth';
import {
  DEFAULT_ORGANIZATION_ID_LOONG,
  defaultOrganizationIdFromEmail,
  normalizeOrganizationId,
  resolveEffectiveOrganizationId,
} from '../../lib/organizations';
import { Link } from 'react-router-dom';
import { MEXICO_ENTIDADES } from '../../lib/loongFintechIntake';

export type LoongTier =
  | 'admin'
  | 'supervisor'
  | 'usuario'
  | 'mesa_control'
  | 'comercial_loong'
  | 'atencion_cliente'
  | 'admin_cobranza'
  | 'agente_cobranza';

const TIER_CONFIG: Record<LoongTier, { role: Role; credits: number; title: string; short: string }> = {
  admin: { role: 'ADMIN', credits: 999, title: 'Administrador', short: 'Admin' },
  supervisor: { role: 'SUPERVISOR', credits: 200, title: 'Supervisor', short: 'Supervisor' },
  usuario: { role: 'CLIENTE', credits: 10, title: 'Vendedor / concesionario', short: 'Ventas' },
  mesa_control: {
    role: 'ANALISTA_MESA_CONTROL',
    credits: 0,
    title: 'Mesa de control',
    short: 'Mesa',
  },
  comercial_loong: { role: 'EJECUTIVO_VENTAS', credits: 100, title: 'Comercial Loong (alta vendedores)', short: 'Comercial' },
  atencion_cliente: { role: 'ATENCION_CLIENTE', credits: 0, title: 'Atención al cliente', short: 'Soporte' },
  admin_cobranza: { role: 'ADMIN_COBRANZA', credits: 0, title: 'Admin cobranza (proveedor)', short: 'Cob. admin' },
  agente_cobranza: { role: 'AGENTE_COBRANZA', credits: 0, title: 'Agente cobranza', short: 'Cob. agente' },
};

/** Mesa de control cerca del inicio del desplegable para que se vea sin buscar. */
const LOONG_TIER_ORDER: LoongTier[] = [
  'usuario',
  'mesa_control',
  'comercial_loong',
  'supervisor',
  'admin',
  'atencion_cliente',
  'admin_cobranza',
  'agente_cobranza',
];

type TeamRow = {
  id: string;
  email?: string;
  role?: string;
  displayName?: string;
  organizationId?: string;
  clientProfile?: string;
};

function rowTenantOrganizationId(row: TeamRow): string | null {
  const fromDoc = normalizeOrganizationId(row.organizationId ?? null);
  if (fromDoc) return fromDoc;
  const fromProfile = resolveEffectiveOrganizationId(null, row.clientProfile);
  if (fromProfile) return fromProfile;
  return defaultOrganizationIdFromEmail(row.email ?? null);
}

type Props = {
  organizationId: string | null;
};

export const LoongTeamUsersPanel: React.FC<Props> = ({ organizationId: orgFromAuth }) => {
  const { user, logUserAction } = useAuthStatus();
  const orgId = normalizeOrganizationId(orgFromAuth) || DEFAULT_ORGANIZATION_ID_LOONG;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tier, setTier] = useState<LoongTier>('usuario');
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [branchNickname, setBranchNickname] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchEntity, setBranchEntity] = useState('');

  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const emptyUserSnap = { docs: [] } as Awaited<ReturnType<typeof getDocs>>;
      const [snapByOrg, snapLoongProfile, snapMesaTier, snapMesaRole, snapMesaEmailBand] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('organizationId', '==', orgId))),
        getDocs(query(collection(db, 'users'), where('clientProfile', '==', 'LOONG_MOTOR'))),
        getDocs(query(collection(db, 'users'), where('loongTeamTier', '==', 'mesa_control'))),
        getDocs(query(collection(db, 'users'), where('role', '==', 'ANALISTA_MESA_CONTROL'))),
        orgId === DEFAULT_ORGANIZATION_ID_LOONG
          ? getDocs(
              query(
                collection(db, 'users'),
                where('email', '>=', 'mesa'),
                where('email', '<', 'mesb'),
                limit(80)
              )
            )
          : Promise.resolve(emptyUserSnap),
      ]);
      const byId = new Map<string, TeamRow>();
      for (const snap of [snapByOrg, snapLoongProfile, snapMesaTier, snapMesaRole, snapMesaEmailBand]) {
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          byId.set(d.id, { id: d.id, ...data } as TeamRow);
        }
      }
      const list = [...byId.values()].filter((u) => {
        if (rowTenantOrganizationId(u) === orgId) return true;
        const em = (u.email || '').trim().toLowerCase();
        if (orgId === DEFAULT_ORGANIZATION_ID_LOONG && em.endsWith('@loong.mx')) {
          const local = em.split('@')[0] || '';
          if (/^mesa/i.test(local)) return true;
        }
        return false;
      });
      list.sort((a, b) => (a.email || a.id).localeCompare(b.email || b.id));
      setRows(list);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo cargar el equipo.');
    } finally {
      setLoadingList(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const tierLabel = (r?: string) => {
    const hit = (Object.keys(TIER_CONFIG) as LoongTier[]).find((k) => TIER_CONFIG[k].role === r);
    if (hit) return TIER_CONFIG[hit].title;
    return r || '—';
  };

  const handleCreateWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    const pw = password;
    if (!em || !pw || pw.length < 6) {
      toast.error('Correo válido y contraseña de al menos 6 caracteres.');
      return;
    }
    const cfg = TIER_CONFIG[tier];
    setCreating(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, em, pw);
      const uid = cred.user.uid;
      const extra: Record<string, unknown> = {};
      if (displayName.trim()) extra.displayName = displayName.trim();
      if (branchNickname.trim()) extra.branchNickname = branchNickname.trim();
      if (branchAddress.trim()) extra.branchAddress = branchAddress.trim();
      if (branchEntity) extra.branchEntity = branchEntity;
      await setDoc(
        doc(db, 'users', uid),
        {
          uid,
          email: em,
          phone: '',
          role: cfg.role,
          clientType: 'GRATUITO',
          clientProfile: 'LOONG_MOTOR',
          credits: cfg.credits,
          pagaresCredits: 0,
          organizationId: orgId,
          loongTeamTier: tier,
          createdAt: new Date().toISOString(),
          ...extra,
        },
        { merge: true }
      );
      if (logUserAction && user) logUserAction(user.uid, 'LOONG_CREATE_TEAM_USER', { email: em, role: cfg.role });
      setEmail('');
      setPassword('');
      setDisplayName('');
      setBranchNickname('');
      setBranchAddress('');
      setBranchEntity('');
      await loadList();
      toast.success(
        `Usuario creado. Acceso Loong: ${LOGIN_LOONG_MOTOR_URL} — mismo correo y contraseña que definiste aquí.`
      );
    } catch (err: unknown) {
      const c = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
      if (c === 'auth/email-already-in-use') {
        toast.error('Ese correo ya está registrado. Usa otro correo o restablece la cuenta desde Firebase Auth.');
      } else if (c === 'permission-denied') {
        toast.error('Sin permiso para guardar el perfil en Firestore (revisa reglas o despliega la última versión).');
      } else {
        toast.error(err instanceof Error ? err.message : 'No se pudo crear.');
      }
    } finally {
      await signOutSecondaryAuth();
      setCreating(false);
    }
  };

  const card = 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm';
  const labelCls = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300';
  const inputCls =
    'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500';

  return (
    <div className="space-y-8">
      <div className={card}>
        <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Usuarios del equipo</h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Cuentas activas de esta organización (perfil Loong). Para editar rol o créditos avanzados usa{' '}
          <Link to="/admin" className="font-medium text-emerald-700 underline">
            Admin Juxa → Usuarios
          </Link>
          .
        </p>
        {loadingList ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Aún no hay usuarios en esta organización. Crea el primero abajo.</p>
        ) : (
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-2.5 text-sm">
                <span className="font-medium text-slate-900 dark:text-slate-100">{r.email || r.id}</span>
                {r.displayName ? (
                  <span className="text-slate-500 dark:text-slate-400"> · {r.displayName}</span>
                ) : null}
                <span className="text-slate-500 dark:text-slate-400"> · {tierLabel(r.role)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={card}>
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Crear usuario del equipo</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Defines correo y contraseña; el usuario entra solo con esos datos. Guarda la contraseña de forma segura.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateWithPassword} className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="loong-create-email">
              Correo
            </label>
            <input
              id="loong-create-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="nombre@empresa.com"
              autoComplete="off"
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="loong-pw">
              Contraseña (mín. 6 caracteres)
            </label>
            <input
              id="loong-pw"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="La guardas tú y se la entregas al usuario"
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="loong-create-displayName">
                Nombre (trazabilidad)
              </label>
              <input
                id="loong-create-displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
                placeholder="Ej. Juan Pérez"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="loong-create-branchNick">
                Sobrenombre sucursal
              </label>
              <input
                id="loong-create-branchNick"
                value={branchNickname}
                onChange={(e) => setBranchNickname(e.target.value)}
                className={inputCls}
                placeholder="Ej. Matriz / Centro"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="loong-create-branchAddress">
                Domicilio sucursal
              </label>
              <input
                id="loong-create-branchAddress"
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                className={inputCls}
                placeholder="Calle, número, colonia, CP"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="loong-create-branchEntity">
                Entidad (sucursal)
              </label>
              <select
                id="loong-create-branchEntity"
                value={branchEntity}
                onChange={(e) => setBranchEntity(e.target.value)}
                className={inputCls}
              >
                <option value="">Selecciona…</option>
                {MEXICO_ENTIDADES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="loong-create-tier-select">
              Rol
            </label>
            <select
              id="loong-create-tier-select"
              value={tier}
              onChange={(e) => setTier(e.target.value as LoongTier)}
              className={inputCls}
            >
              {LOONG_TIER_ORDER.map((k) => (
                <option key={k} value={k}>
                  {TIER_CONFIG[k].title} ({TIER_CONFIG[k].short})
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              <strong className="font-medium text-slate-600 dark:text-slate-300">Mesa de control</strong> ve la pestaña
              homónima y la cola de precalificación; mismo acceso que admin/supervisor a esa cola.
            </p>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {creating ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      </div>
    </div>
  );
};
