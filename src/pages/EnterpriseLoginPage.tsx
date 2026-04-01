import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { brand, brandClasses } from '../config/brand';
import { LOGIN_LOONG_MOTOR_URL } from '../config/loongLinks';
import type { OrganizationRecord, SaaSProductId } from '../lib/organizations';
import { parseEnabledProducts } from '../lib/organizations';
import { ThemeToggle } from '../components/ThemeToggle';
import { PageHeader } from '../components/ui/PageHeader';

const PRODUCT_LABELS: Record<SaaSProductId, string> = {
  HR: 'Recursos humanos',
  CREDIT: 'Investigación de crédito',
  PROVIDER: 'Proveedores',
  LOONG_MOTOR: 'Loong Motor — crédito moto',
  SME: 'PyME',
  GENERAL: 'General',
};

export const EnterpriseLoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get('org') || 'loong_motor';
  const [org, setOrg] = useState<OrganizationRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMissing(false);
      try {
        const snap = await getDoc(doc(db, 'organizations', orgId));
        if (cancelled) return;
        if (!snap.exists()) {
          setMissing(true);
          setOrg(null);
          return;
        }
        const d = snap.data();
        setOrg({
          name: typeof d.name === 'string' ? d.name : orgId,
          slug: typeof d.slug === 'string' ? d.slug : orgId,
          status: d.status === 'suspended' ? 'suspended' : 'active',
          enabledProducts: parseEnabledProducts(d.enabledProducts),
          trialEndsAt: typeof d.trialEndsAt === 'string' ? d.trialEndsAt : undefined,
          createdAt: typeof d.createdAt === 'string' ? d.createdAt : '',
          updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : '',
          note: typeof d.note === 'string' ? d.note : undefined,
        });
      } catch {
        if (!cancelled) setMissing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return (
    <div className={`relative min-h-screen ${brandClasses.pageGradient} text-slate-900 dark:text-slate-100`}>
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle size="sm" />
      </div>
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-12">
        <div className="flex gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${brandClasses.logoMark}`}
          >
            {brand.logoMark}
          </div>
          <PageHeader
            className="!mb-0 flex-1 [&_h1]:text-xl"
            title="Acceso empresarial"
            description={`Organización: ${orgId}`}
          />
        </div>

        {loading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
        {missing && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-50/90 p-4 text-sm text-amber-950 dark:bg-black/20 dark:text-amber-100">
            No se encontró la empresa o el acceso no está activo. Verifica el enlace o contacta a Juxa Verify.
          </div>
        )}
        {!loading && org && org.status === 'suspended' && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-100">
            Esta organización está suspendida.
          </div>
        )}
        {!loading && org && org.status === 'active' && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Bienvenido a <strong className="text-slate-900 dark:text-white">{org.name}</strong>. Inicia sesión con el correo que te dio de alta tu
              administrador.
            </p>
            {org.trialEndsAt && (
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                Periodo de prueba organización hasta: {new Date(org.trialEndsAt).toLocaleString('es-MX')}
              </p>
            )}
            <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-black/20">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Productos habilitados</p>
              <ul className="space-y-2 text-sm">
                {(org.enabledProducts.length > 0 ? org.enabledProducts : (['GENERAL'] as SaaSProductId[])).map((p) => (
                  <li key={p} className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-200">
                    <span>{PRODUCT_LABELS[p] || p}</span>
                    {p === 'LOONG_MOTOR' && (
                      <Link to={LOGIN_LOONG_MOTOR_URL} className="text-amber-700 underline dark:text-amber-400">
                        Entrar Loong
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              to="/login"
              className="inline-flex justify-center rounded-xl bg-amber-500 px-4 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-amber-400"
            >
              Ir a inicio de sesión
            </Link>
          </>
        )}

        <Link to="/" className="text-center text-xs text-slate-500 dark:text-slate-400 underline">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
};
