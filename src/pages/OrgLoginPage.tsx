import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Login } from './Login';
import type { OrganizationRecord } from '../lib/organizations';
import { parseEnabledProducts } from '../lib/organizations';

export const OrgLoginPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const safeOrgId = (orgId || '').trim();
  const [org, setOrg] = useState<OrganizationRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMissing(false);
      try {
        if (!safeOrgId) {
          setMissing(true);
          setOrg(null);
          return;
        }
        const snap = await getDoc(doc(db, 'organizations', safeOrgId));
        if (cancelled) return;
        if (!snap.exists()) {
          setMissing(true);
          setOrg(null);
          return;
        }
        const d = snap.data();
        setOrg({
          name: typeof d.name === 'string' ? d.name : safeOrgId,
          slug: typeof d.slug === 'string' ? d.slug : safeOrgId,
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
  }, [safeOrgId]);

  const subtitle = useMemo(() => {
    if (loading) return 'Cargando organización…';
    if (missing || !org) return 'Acceso por organización no disponible';
    if (org.status === 'suspended') return 'Organización suspendida';
    const t = org.trialEndsAt ? ` · Trial hasta ${new Date(org.trialEndsAt).toLocaleDateString('es-MX')}` : '';
    return `Acceso exclusivo para ${org.name} (sin registro abierto)${t}`;
  }, [loading, missing, org]);

  const title = org?.name ? `Acceso — ${org.name}` : 'Acceso por organización';

  // Sin registro abierto (lo gestiona el admin vía pre-registro / alta).
  return <Login mode="default" title={title} subtitle={subtitle} allowRegister={false} />;
};

