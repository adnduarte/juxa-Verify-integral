import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import { normalizeOrganizationId, SAAS_PRODUCT_IDS, type SaaSProductId } from '../../lib/organizations';
import { ADMIN_ROLE_OPTIONS, CLIENT_PROFILE_OPTIONS } from '../../config/accessProfiles';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  enabledProducts: SaaSProductId[];
  trialEndsAt?: string;
  allowedRoles?: string[];
};

export const EnterprisesPlatformTab: React.FC = () => {
  const { user, logUserAction } = useAuthStatus();
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'active' | 'suspended'>('active');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<SaaSProductId>>(
    () => new Set(['LOONG_MOTOR', 'CREDIT', 'HR'] as SaaSProductId[])
  );
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(() => new Set(ADMIN_ROLE_OPTIONS.map((o) => o.value)));
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteClientProfile, setInviteClientProfile] = useState('GENERAL');
  const [inviting, setInviting] = useState(false);
  const [wizId, setWizId] = useState('');
  const [wizName, setWizName] = useState('');
  const [wizAdminEmail, setWizAdminEmail] = useState('');
  const [wizVendorEmail, setWizVendorEmail] = useState('');
  const [wizBusy, setWizBusy] = useState(false);

  const orgLoginUrl = useMemo(() => {
    const base = window.location.origin;
    const id = (orgId.trim() || slug.trim()).trim();
    if (!id) return '';
    return `${base}/org/${encodeURIComponent(id)}/login`;
  }, [orgId, slug]);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'organizations'));
      const list: OrgRow[] = snap.docs.map((d) => {
        const x = d.data();
        const allowedRoles =
          Array.isArray((x as any).allowedRoles) && (x as any).allowedRoles.length > 0
            ? (x as any).allowedRoles.map(String)
            : undefined;
        return {
          id: d.id,
          name: typeof x.name === 'string' ? x.name : d.id,
          slug: typeof x.slug === 'string' ? x.slug : d.id,
          status: x.status === 'suspended' ? 'suspended' : 'active',
          enabledProducts: Array.isArray(x.enabledProducts)
            ? x.enabledProducts.filter((p: string): p is SaaSProductId =>
                (SAAS_PRODUCT_IDS as readonly string[]).includes(p)
              )
            : [],
          trialEndsAt: typeof x.trialEndsAt === 'string' ? x.trialEndsAt : undefined,
          allowedRoles,
        };
      });
      list.sort((a, b) => a.id.localeCompare(b.id));
      setRows(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleProduct = (p: SaaSProductId) => {
    setSelectedProducts((prev) => {
      const n = new Set(prev);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  };

  const toggleRole = (r: string) => {
    setSelectedRoles((prev) => {
      const n = new Set(prev);
      if (n.has(r)) n.delete(r);
      else n.add(r);
      return n;
    });
  };

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = normalizeOrganizationId(orgId.trim() || slug.trim() || null);
    if (!id) {
      alert('Indica un ID de documento válido (p. ej. loong_motor).');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {
        name: name.trim() || id,
        slug: slug.trim() || id,
        status,
        enabledProducts: Array.from(selectedProducts),
        allowedRoles: Array.from(selectedRoles),
        updatedAt: now,
      };
      if (trialEndsAt.trim()) payload.trialEndsAt = new Date(trialEndsAt).toISOString();
      const ref = doc(db, 'organizations', id);
      const existing = rows.find((r) => r.id === id);
      if (!existing) payload.createdAt = now;
      await setDoc(ref, payload, { merge: true });
      if (logUserAction && user) logUserAction(user.uid, 'PLATFORM_ORG_SAVE', { organizationId: id });
      setOrgId('');
      setName('');
      setSlug('');
      setTrialEndsAt('');
      setSelectedRoles(new Set(ADMIN_ROLE_OPTIONS.map((o) => o.value)));
      await load();
      alert('Organización guardada.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const inviteOrgAdmin = async () => {
    const email = inviteEmail.trim().toLowerCase();
    const id = normalizeOrganizationId(orgId.trim() || slug.trim() || null);
    if (!id) {
      alert('Primero selecciona o captura una organización (ID/Slug).');
      return;
    }
    if (!email) {
      alert('Ingresa el correo del admin de la entidad.');
      return;
    }
    setInviting(true);
    try {
      const now = new Date().toISOString();
      await setDoc(
        doc(db, 'pre_registered_users', email),
        {
          role: 'ADMIN',
          clientType: 'SUSCRIPCION',
          clientProfile: inviteClientProfile,
          credits: 0,
          pagaresCredits: 0,
          organizationId: id,
          createdAt: now,
          createdBy: user?.uid || '',
          note: `Invitación admin entidad: ${id}`,
        },
        { merge: true }
      );
      if (logUserAction && user) logUserAction(user.uid, 'PLATFORM_ORG_INVITE_ADMIN', { organizationId: id, email });
      setInviteEmail('');
      alert('Invitación creada. La persona debe registrarse en /login con ese correo.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al invitar.');
    } finally {
      setInviting(false);
    }
  };

  const copy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      alert('URL copiada.');
    } catch {
      alert(text);
    }
  };

  const removeOrg = async (id: string) => {
    if (!window.confirm(`¿Eliminar organización ${id}?`)) return;
    try {
      await deleteDoc(doc(db, 'organizations', id));
      if (logUserAction && user) logUserAction(user.uid, 'PLATFORM_ORG_DELETE', { organizationId: id });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  };

  const seedSaaSInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = normalizeOrganizationId(wizId.trim() || null);
    if (!id) {
      alert('Indica un ID de instancia (p. ej. acme_demo).');
      return;
    }
    setWizBusy(true);
    const now = new Date().toISOString();
    try {
      const products: SaaSProductId[] = ['CREDIT', 'HR', 'GENERAL'];
      await setDoc(
        doc(db, 'organizations', id),
        {
          name: wizName.trim() || id,
          slug: id,
          status: 'active' as const,
          enabledProducts: products,
          allowedRoles: ['ADMIN', 'SUPERVISOR', 'CLIENTE', 'INVESTIGADOR'],
          createdAt: now,
          updatedAt: now,
          note: 'Instancia creada con asistente plataforma (investigación / crédito).',
        },
        { merge: true }
      );

      const writeSandboxPreReg = async (rawEmail: string, role: string, profile: string, credits: number, note: string) => {
        const em = rawEmail.trim().toLowerCase();
        if (!em) return;
        await setDoc(
          doc(db, 'pre_registered_users', em),
          {
            role,
            clientType: 'GRATUITO',
            clientProfile: profile,
            credits,
            pagaresCredits: 0,
            organizationId: id,
            createdAt: now,
            createdBy: user?.uid || '',
            note,
            sandbox: true,
          },
          { merge: true }
        );
      };

      await writeSandboxPreReg(wizAdminEmail, 'ADMIN', 'CREDIT', 50, `[sandbox] Admin tenant · ${id}`);
      await writeSandboxPreReg(wizVendorEmail, 'CLIENTE', 'CREDIT', 20, `[sandbox] Usuario prueba · ${id}`);

      if (logUserAction && user) logUserAction(user.uid, 'PLATFORM_SAAS_INSTANCE_SEED', { organizationId: id });
      setOrgId(id);
      setName(wizName.trim() || id);
      setSlug(id);
      await load();
      alert(
        'Instancia guardada. Si capturaste correos, quedaron pre-registros sandbox (marca sandbox=true). Esas cuentas deben registrarse en /login.'
      );
      setWizId('');
      setWizName('');
      setWizAdminEmail('');
      setWizVendorEmail('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear instancia.');
    } finally {
      setWizBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80 p-5 text-sm text-slate-700 dark:text-slate-200">
        <p className="font-semibold text-slate-900 dark:text-slate-100">Organizaciones (multi-tenant)</p>
        <p className="mt-1">
          Cada usuario puede llevar <code className="rounded bg-white dark:bg-slate-900 px-1">organizationId</code> en Firestore. Las políticas Loong
          pueden leerse por org (fallback a documento global).{' '}
          <a href="/login/empresa?org=loong_motor" className="text-amber-700 underline">
            Vista acceso empresarial
          </a>
        </p>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          <strong className="text-slate-800 dark:text-slate-200">CRM y flujo completo de expedientes Loong</strong> están en otra sección del admin.
        </p>
        <Link
          to="/admin?tab=loong"
          className="mt-3 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Abrir Loong Motor (políticas + CRM originación)
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={load} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80">
          Actualizar lista
        </button>
      </div>

      <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/80 dark:bg-blue-950/30 p-6 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">Asistente: nueva instancia SaaS + perfiles de prueba</h3>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Crea <code className="rounded bg-white/80 dark:bg-slate-900 px-1">organizations/{'{id}'}</code> con productos CREDIT / HR / GENERAL y, opcionalmente, dos pre-registros marcados{' '}
          <code className="rounded px-1">sandbox</code> (admin y usuario de prueba). No modifica Loong Motor.
        </p>
        <form onSubmit={seedSaaSInstance} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">ID instancia (documento)</label>
            <input
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={wizId}
              onChange={(e) => setWizId(e.target.value)}
              placeholder="ej. acme_credit_demo"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nombre visible</label>
            <input
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={wizName}
              onChange={(e) => setWizName(e.target.value)}
              placeholder="Ej. Acme — demo"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Correo admin prueba (opcional)</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={wizAdminEmail}
              onChange={(e) => setWizAdminEmail(e.target.value)}
              placeholder="admin-demo@empresa.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Correo vendedor prueba (opcional)</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={wizVendorEmail}
              onChange={(e) => setWizVendorEmail(e.target.value)}
              placeholder="vendedor-demo@empresa.com"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={wizBusy}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {wizBusy ? 'Creando…' : 'Crear instancia y pre-registros sandbox'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Nueva / editar organización</h3>
        <form onSubmit={saveOrg} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">ID documento (Firestore)</label>
              <input
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="loong_motor"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nombre visible</label>
              <input
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Slug (URL)</label>
              <input
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="loong_motor"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Estado</label>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'suspended')}
              >
                <option value="active">Activa</option>
                <option value="suspended">Suspendida</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Fin de prueba organización (opcional)</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                value={trialEndsAt}
                onChange={(e) => setTrialEndsAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Productos habilitados</p>
            <div className="flex flex-wrap gap-2">
              {SAAS_PRODUCT_IDS.map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs">
                  <input type="checkbox" checked={selectedProducts.has(p)} onChange={() => toggleProduct(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Roles permitidos en la entidad</p>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Esto controla qué roles puede asignar el admin de esta organización al crear usuarios/pre-registros desde el front.
            </p>
            <div className="flex flex-wrap gap-2">
              {ADMIN_ROLE_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
                >
                  <input type="checkbox" checked={selectedRoles.has(o.value)} onChange={() => toggleRole(o.value)} />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar organización'}
          </button>
        </form>

        <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">URL de acceso por entidad</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100">
              {orgLoginUrl || 'Captura ID/slug para generar la URL'}
            </code>
            <button
              type="button"
              disabled={!orgLoginUrl}
              onClick={() => void copy(orgLoginUrl)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-900 disabled:opacity-50"
            >
              Copiar
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Esta pantalla es personalizada con el <strong>nombre</strong> configurado en la organización. No tiene registro abierto.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">Botón rápido: crear admin de entidad</h3>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Crea un pre-registro (invitación) para que la persona se registre sola en <code className="rounded bg-slate-50 dark:bg-slate-950 px-1">/login</code>.
          Quedará amarrada a la organización seleccionada y podrá gestionar usuarios/roles según los permitidos arriba.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Correo admin entidad</label>
            <input
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="admin@empresa.com"
              type="email"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Perfil producto</label>
            <select
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={inviteClientProfile}
              onChange={(e) => setInviteClientProfile(e.target.value)}
            >
              {CLIENT_PROFILE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={inviteOrgAdmin}
          disabled={inviting}
          className="mt-4 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {inviting ? 'Creando invitación…' : 'Invitar admin de entidad'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">Registradas</h3>
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Ninguna. Usa “Sembrar org Loong” o el formulario.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{r.name}</span>
                  <span className="text-slate-500 dark:text-slate-400"> · {r.id}</span>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Productos: {r.enabledProducts.join(', ') || '—'}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-amber-700 underline"
                    onClick={() => {
                      setOrgId(r.id);
                      setName(r.name);
                      setSlug(r.slug);
                      setStatus(r.status);
                      setSelectedProducts(new Set(r.enabledProducts));
                      setTrialEndsAt(r.trialEndsAt ? r.trialEndsAt.slice(0, 16) : '');
                      setSelectedRoles(
                        new Set(
                          (r.allowedRoles && r.allowedRoles.length > 0 ? r.allowedRoles : ADMIN_ROLE_OPTIONS.map((o) => o.value)).map(String)
                        )
                      );
                    }}
                  >
                    Cargar en formulario
                  </button>
                  <button type="button" className="text-xs text-red-600" onClick={() => removeOrg(r.id)}>
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
