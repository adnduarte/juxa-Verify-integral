/**
 * Clientes empresariales (SaaS). Documento: organizations/{organizationId}
 */

export type OrganizationStatus = 'active' | 'suspended';

/** Productos que la plataforma puede habilitar por organización. */
export const SAAS_PRODUCT_IDS = [
  'HR',
  'CREDIT',
  'PROVIDER',
  'LOONG_MOTOR',
  'SME',
  'GENERAL',
] as const;

export type SaaSProductId = (typeof SAAS_PRODUCT_IDS)[number];

export type OrganizationRecord = {
  name: string;
  slug: string;
  status: OrganizationStatus;
  enabledProducts: SaaSProductId[];
  trialEndsAt?: string;
  createdAt: string;
  updatedAt: string;
  note?: string;
};

export const DEFAULT_ORGANIZATION_ID_LOONG = 'loong_motor';

/** Trim + lowercase para evitar duplicados lógicos por casing (p. ej. loong_motor vs Loong_motor). */
export function normalizeOrganizationId(id: string | null | undefined): string | null {
  if (id == null) return null;
  const t = String(id).trim().toLowerCase();
  return t.length > 0 ? t : null;
}

/**
 * organizationId persistido en users; si falta y el perfil es Loong, usa el tenant por defecto (solo cliente / escrituras).
 */
export function resolveEffectiveOrganizationId(
  organizationId: string | null | undefined,
  clientProfile: string | null | undefined
): string | null {
  const n = normalizeOrganizationId(organizationId ?? null);
  if (n) return n;
  if (clientProfile === 'LOONG_MOTOR') return DEFAULT_ORGANIZATION_ID_LOONG;
  return null;
}

/**
 * Cuentas corporativas @loong.mx: si no hay organizationId en Firestore, el auth las alinea a `loong_motor`.
 * Añade aquí otros dominios si en el futuro hay más tenants con regla similar.
 */
export function defaultOrganizationIdFromEmail(email: string | null | undefined): string | null {
  if (email == null || typeof email !== 'string') return null;
  const e = email.trim().toLowerCase();
  if (e.endsWith('@loong.mx')) return DEFAULT_ORGANIZATION_ID_LOONG;
  return null;
}

/**
 * Cuentas @loong.mx operativas (mesa, vendedor, comercial, soporte, cobranza, supervisor):
 * si quedaron con clientProfile GENERAL, alinear a LOONG_MOTOR para workspace Loong y reglas Firestore.
 */
const LOONG_MX_ROLES_UPGRADE_TO_MOTOR_PROFILE = new Set<string>([
  'CLIENTE',
  'ANALISTA_MESA_CONTROL',
  'EJECUTIVO_VENTAS',
  'ATENCION_CLIENTE',
  'ADMIN_COBRANZA',
  'AGENTE_COBRANZA',
  'SUPERVISOR',
  /** Admin/supervisor de concesionario: sin esto quedan en GENERAL y el registry los manda al Admin Juxa genérico. */
  'ADMIN',
  'GERENTE_DIRECTIVO',
  'ANALISTA_CREDITO',
  'INVESTIGADOR',
]);

export function shouldUpgradeClientProfileToLoongMotorForMxCorp(
  email: string | null | undefined,
  role: string | null | undefined,
  clientProfile: string | null | undefined
): boolean {
  if (!defaultOrganizationIdFromEmail(email)) return false;
  if (clientProfile === 'LOONG_MOTOR') return false;
  if (role == null || role === '') return false;
  return LOONG_MX_ROLES_UPGRADE_TO_MOTOR_PROFILE.has(role);
}

export function parseEnabledProducts(raw: unknown): SaaSProductId[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(SAAS_PRODUCT_IDS);
  return raw.filter((x): x is SaaSProductId => typeof x === 'string' && set.has(x as SaaSProductId));
}
