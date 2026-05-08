/**
 * Personas y organizaciones de desarrollo:
 * - En modo construcción local los datos viven en memoria (sin Firebase).
 * - Con `VITE_USE_FIREBASE=true` también crea cuentas en Firebase Auth (secondary).
 *
 * El bootstrap es idempotente: se puede llamar varias veces sin duplicar nada.
 */
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDocs, query, collection, where, setDoc } from '@/lib/localFirestore';
import { db, secondaryAuth } from '@/firebase';
import { isLocalConstructionMode } from '@/lib/localDataMode';
import {
  DEV_LOCAL_PERSONAS,
  DEV_LOCAL_PASSWORD,
  type DevPersona,
  localDevUidFromEmail,
} from '@/lib/devPersonasCatalog';
import { defaultTenantFeatures, type OrganizationDoc } from '@/types/saas';

export { DEV_LOCAL_PASSWORD, DEV_LOCAL_PERSONAS, localDevUidFromEmail, findDevPersonaByEmail } from '@/lib/devPersonasCatalog';

async function upsertUserDoc(uid: string, email: string, persona: DevPersona) {
  const now = new Date().toISOString();
  await setDoc(
    doc(db, 'users', uid),
    {
      uid,
      email: email.toLowerCase(),
      role: persona.role,
      clientType: persona.clientType || 'GRATUITO',
      clientProfile: persona.clientProfile,
      organizationId: persona.organizationId || 'default',
      resellerId: null,
      credits: 999,
      pagaresCredits: 99,
      createdAt: now,
      devLocalPersona: true,
      ...(persona.clientAccountRole ? { clientAccountRole: persona.clientAccountRole.toUpperCase() } : {}),
    },
    { merge: true }
  );
}

export async function bootstrapDevLocalUsers(): Promise<{ ok: number; errors: string[] }> {
  const errors: string[] = [];
  let ok = 0;

  if (isLocalConstructionMode()) {
    for (const persona of DEV_LOCAL_PERSONAS) {
      const email = persona.email.toLowerCase();
      const uid = localDevUidFromEmail(email);
      try {
        await upsertUserDoc(uid, email, persona);
        ok++;
      } catch (e) {
        errors.push(`${email}: ${String(e)}`);
      }
    }
    return { ok, errors };
  }

  for (const persona of DEV_LOCAL_PERSONAS) {
    const email = persona.email.toLowerCase();
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, DEV_LOCAL_PASSWORD);
      await upsertUserDoc(cred.user.uid, email, persona);
      await signOut(secondaryAuth);
      ok++;
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'auth/email-already-in-use') {
        try {
          const q = query(collection(db, 'users'), where('email', '==', email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const u = snap.docs[0];
            await upsertUserDoc(u.id, email, persona);
            ok++;
          } else {
            const uid = localDevUidFromEmail(email);
            await upsertUserDoc(uid, email, persona);
            ok++;
          }
        } catch (inner) {
          errors.push(`${email}: ${String(inner)}`);
        }
      } else {
        errors.push(`${email}: ${err.message || err.code || String(e)}`);
      }
    }
  }
  return { ok, errors };
}

/** Organizaciones demo que sembramos en modo local para que las verticales (Juxa Verify, Ford) funcionen out-of-the-box. */
const DEMO_ORGANIZATIONS: Array<Omit<OrganizationDoc, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'default',
    name: 'Juxa Verify',
    parentOrganizationId: null,
    branding: { appName: 'Juxa Verify', primaryColor: '#2563eb' },
    features: { ...defaultTenantFeatures },
    limits: { maxUsers: 500, investigationsPerMonth: 5000, signaturesPerMonth: 2000 },
  },
  {
    id: 'ford-credit-mx',
    name: 'Ford Crédito México',
    parentOrganizationId: null,
    branding: { appName: 'Ford Crédito México', primaryColor: '#003478' },
    features: { ...defaultTenantFeatures },
    partnerVertical: 'FORD_CREDIT_MX',
    fordProgramRoot: true,
    limits: { maxUsers: 5000, investigationsPerMonth: 50000, signaturesPerMonth: 25000 },
  },
  {
    id: 'ford-agencia-polanco',
    name: 'Ford Polanco',
    parentOrganizationId: 'ford-credit-mx',
    branding: { appName: 'Ford Polanco', primaryColor: '#003478' },
    features: { ...defaultTenantFeatures },
    partnerVertical: 'FORD_CREDIT_MX',
    fordProgramRoot: false,
  },
];

export async function bootstrapDevLocalOrganizations(): Promise<{ ok: number; errors: string[] }> {
  const errors: string[] = [];
  let ok = 0;
  const now = new Date().toISOString();
  for (const org of DEMO_ORGANIZATIONS) {
    try {
      await setDoc(
        doc(db, 'organizations', org.id),
        { ...org, createdAt: now, updatedAt: now },
        { merge: true }
      );
      ok++;
    } catch (e) {
      errors.push(`${org.id}: ${String(e)}`);
    }
  }
  return { ok, errors };
}

let _bootstrappedOnce = false;

/**
 * Bootstrap unificado para arrancar la app local sin pasos manuales.
 * Idempotente y silencioso: se llama desde `AuthProvider` al montarse.
 * En `VITE_USE_FIREBASE=true` no toca nada (los datos vienen de Firebase real).
 */
export async function ensureLocalDemoData(): Promise<void> {
  if (!isLocalConstructionMode()) return;
  if (_bootstrappedOnce) return;
  _bootstrappedOnce = true;
  try {
    await bootstrapDevLocalOrganizations();
    await bootstrapDevLocalUsers();
  } catch (e) {
    // Si falla algo, lo logueamos pero no rompemos la UI.
    console.warn('[ensureLocalDemoData] bootstrap parcial:', e);
  }
}
