/** Correos que siempre reciben rol ADMIN al iniciar sesión (AuthContext + Firestore rules). */
export const SUPERADMIN_EMAILS: readonly string[] = [
  'aduarte@duarteaupartabogados.com',
  'amarquez@duarteaupartabogados.com',
  'mvazquez@juxa.mx',
  'aduarte@juxa.mx',
  'adnduarte1@gmail.com',
];

/**
 * Cuentas demo / operación Loong. Mantiene ADMIN aunque `users` quede desalineado;
 * el perfil LOONG_MOTOR sigue viniendo de Firestore o de `pre_registered_users` (resync en AuthContext).
 */
export const LOONG_SUPERADMIN_EMAILS = [
  'loong.superadmin@juxa.test',
  'loong.superadmin@juxa.mx',
  'loong.superadmin@juxa.ai',
] as const;

export function isSuperAdminEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return SUPERADMIN_EMAILS.includes(e) || (LOONG_SUPERADMIN_EMAILS as readonly string[]).includes(e);
}

/** Cuentas operación Loong: menú de administración simplificado (usuarios + CRM, sin módulos plataforma genéricos). */
export function isLoongSuperAdminEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return (LOONG_SUPERADMIN_EMAILS as readonly string[]).includes(e);
}
