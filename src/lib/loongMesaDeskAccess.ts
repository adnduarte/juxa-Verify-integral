import { DEFAULT_ORGANIZATION_ID_LOONG, defaultOrganizationIdFromEmail } from './organizations';

/**
 * Quién debe ver Mesa de control, Investigaciones y cola global (no solo «Mis solicitudes» de vendedor).
 * - Rol operativo explícito
 * - `loongTeamTier: mesa_control` en users (alta desde Equipo)
 * - Convención: correo local `mesa…` en @loong.mx (p. ej. mesa1@loong.mx) si quedó como CLIENTE por error
 */
export function loongUserHasMesaDeskVisibility(opts: {
  role: string | null;
  userEmail: string | null | undefined;
  loongTeamTier: string | null | undefined;
}): boolean {
  const { role, userEmail, loongTeamTier } = opts;
  if (!role) return false;
  if (role === 'ANALISTA_MESA_CONTROL' || role === 'SUPERVISOR' || role === 'ADMIN') return true;
  if (loongTeamTier === 'mesa_control') return true;

  const em = (userEmail || '').trim().toLowerCase();
  if (defaultOrganizationIdFromEmail(em) !== DEFAULT_ORGANIZATION_ID_LOONG) return false;
  const local = em.split('@')[0] || '';
  if (/^mesa/i.test(local)) return true;
  return false;
}
