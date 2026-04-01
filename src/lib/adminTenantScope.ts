import type { Role } from '../contexts/AuthContext';
import { DEFAULT_ORGANIZATION_ID_LOONG, normalizeOrganizationId } from './organizations';
import { isSuperAdminEmail } from '../config/superadmins';

export type AdminUserScope =
  | { kind: 'platform_all' }
  | {
      kind: 'organization';
      organizationId: string;
      /** Perfiles que pueden mostrarse aunque aún no tengan organizationId (onboarding). */
      looseProfiles: ('LOONG_MOTOR' | 'HR')[];
    };

type ResolveParams = {
  adminEmail: string | null | undefined;
  role: Role;
  clientProfile: string;
  organizationId: string | null;
};

/**
 * Alcance de listados en /admin → Usuarios.
 * Plataforma (superadmin por correo): todos.
 * Admins con rol ADMIN sin `organizationId` y sin perfil tenant Loong: directorio completo (superadmin operativo / cuentas históricas).
 * Resto: solo su organización, con reglas por vertical.
 */
export function resolveAdminUserScope(p: ResolveParams): AdminUserScope {
  if (p.adminEmail && isSuperAdminEmail(p.adminEmail)) {
    return { kind: 'platform_all' };
  }

  const orgNorm = normalizeOrganizationId(p.organizationId);
  if (p.role === 'ADMIN' && p.clientProfile !== 'LOONG_MOTOR' && !orgNorm) {
    return { kind: 'platform_all' };
  }

  const orgFromField = orgNorm;

  if (p.clientProfile === 'LOONG_MOTOR') {
    const oid = orgFromField || DEFAULT_ORGANIZATION_ID_LOONG;
    return { kind: 'organization', organizationId: oid, looseProfiles: ['LOONG_MOTOR'] };
  }

  if (p.clientProfile === 'HR') {
    if (!orgFromField) return { kind: 'platform_all' };
    return { kind: 'organization', organizationId: orgFromField, looseProfiles: ['HR'] };
  }

  if (p.clientProfile === 'PROVIDER') {
    if (!orgFromField) return { kind: 'platform_all' };
    return { kind: 'organization', organizationId: orgFromField, looseProfiles: [] };
  }

  if (p.clientProfile === 'CREDIT' && orgFromField) {
    return { kind: 'organization', organizationId: orgFromField, looseProfiles: [] };
  }

  if (orgFromField) {
    return { kind: 'organization', organizationId: orgFromField, looseProfiles: [] };
  }

  return { kind: 'platform_all' };
}

export function userMatchesAdminScope(
  u: Record<string, unknown> & { id?: string },
  scope: AdminUserScope
): boolean {
  if (scope.kind === 'platform_all') return true;

  const oid = normalizeOrganizationId(typeof u.organizationId === 'string' ? u.organizationId : null) || '';
  const scopeOrg = normalizeOrganizationId(scope.organizationId) || scope.organizationId;
  const prof = typeof u.clientProfile === 'string' ? u.clientProfile : '';

  if (oid && oid === scopeOrg) return true;

  for (const loose of scope.looseProfiles) {
    if (prof === loose && (!oid || oid === scopeOrg)) return true;
  }

  if (scopeOrg === DEFAULT_ORGANIZATION_ID_LOONG) {
    const em = typeof u.email === 'string' ? u.email.toLowerCase() : '';
    if (em.endsWith('@loong.mx') || em.includes('loong.')) return true;
  }

  return false;
}

export function preRegMatchesAdminScope(
  row: { organizationId?: string; clientProfile?: string; id?: string },
  scope: AdminUserScope
): boolean {
  if (scope.kind === 'platform_all') return true;

  const oid = normalizeOrganizationId(typeof row.organizationId === 'string' ? row.organizationId : null) || '';
  const scopeOrg = normalizeOrganizationId(scope.organizationId) || scope.organizationId;
  const prof = typeof row.clientProfile === 'string' ? row.clientProfile : '';
  const emailKey = typeof row.id === 'string' ? row.id.toLowerCase() : '';

  if (oid && oid === scopeOrg) return true;

  for (const loose of scope.looseProfiles) {
    if (prof === loose && (!oid || oid === scopeOrg)) return true;
  }

  if (scopeOrg === DEFAULT_ORGANIZATION_ID_LOONG) {
    if (emailKey.endsWith('@loong.mx') || emailKey.includes('loong.')) return true;
  }

  return false;
}

export function defaultOrganizationIdForNewUser(scope: AdminUserScope, explicit: string | undefined): string | undefined {
  const exNorm = normalizeOrganizationId(explicit);
  if (exNorm) return exNorm;
  if (scope.kind === 'organization') return scope.organizationId;
  return undefined;
}
