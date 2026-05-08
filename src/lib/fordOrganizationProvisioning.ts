import { doc, setDoc } from '@/lib/localFirestore';
import { defaultTenantFeatures, type TenantBranding, type TenantFeatureFlags } from '../types/saas';

export const FORD_PROGRAM_ROOT_ORG_ID = 'ford-credit-mx';

export function normalizeFordAgencySlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
}

const FORD_BRANDING: TenantBranding = {
  appName: 'Ford Crédito México',
  primaryColor: '#003478',
};

const FORD_FEATURES: TenantFeatureFlags = {
  ...defaultTenantFeatures,
  creditOrigination: true,
  identityAntiUsurpation: true,
  digidSignatures: true,
};

/**
 * Garantiza la organización raíz del programa Ford Crédito MX en Firestore.
 */
export async function ensureFordProgramRoot(db: unknown): Promise<void> {
  const now = new Date().toISOString();
  await (setDoc as (ref: unknown, data: object) => Promise<void>)(
    doc(db as never, 'organizations', FORD_PROGRAM_ROOT_ORG_ID),
    {
      name: FORD_BRANDING.appName,
      parentOrganizationId: null,
      branding: FORD_BRANDING,
      features: FORD_FEATURES,
      partnerVertical: 'FORD_CREDIT_MX',
      fordProgramRoot: true,
      limits: { maxUsers: 5000, investigationsPerMonth: 50000, signaturesPerMonth: 25000 },
      createdAt: now,
      updatedAt: now,
    }
  );
}

/**
 * Crea una agencia (organización hija) bajo el programa Ford Crédito MX.
 */
export async function createFordAgencyOrganization(
  db: unknown,
  params: { slug: string; displayName: string }
): Promise<{ id: string }> {
  const id = normalizeFordAgencySlug(params.slug);
  const name = params.displayName.trim();
  const now = new Date().toISOString();
  await ensureFordProgramRoot(db);
  await (setDoc as (ref: unknown, data: object) => Promise<void>)(
    doc(db as never, 'organizations', id),
    {
      name,
      parentOrganizationId: FORD_PROGRAM_ROOT_ORG_ID,
      branding: { ...FORD_BRANDING, appName: name },
      features: FORD_FEATURES,
      partnerVertical: 'FORD_CREDIT_MX',
      fordProgramRoot: false,
      limits: {},
      createdAt: now,
      updatedAt: now,
    }
  );
  return { id };
}
