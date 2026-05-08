/**
 * Quién puede ver "Configuración" de cuenta en paneles de cliente (`ClientDashboard`).
 * Valores en Firestore `users.clientAccountRole` (mayúsculas recomendadas).
 */
export const CLIENT_ACCOUNT_SETTINGS_SEATS = ['GERENCIA', 'DIRECCION', 'SUPERADMIN'] as const;

export type ClientAccountSeat = (typeof CLIENT_ACCOUNT_SETTINGS_SEATS)[number] | 'OPERATIVO';

export function normalizeClientAccountRole(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().toUpperCase();
  return s || null;
}

/** Plataforma superadmin siempre; en cliente solo asientos de mando o legacy sin campo. */
export function canAccessClientAccountSettings(role: string | null, clientAccountRole: string | null): boolean {
  if (role === 'ADMIN') return true;
  const seat = normalizeClientAccountRole(clientAccountRole);
  if (!seat) return true;
  if (seat === 'OPERATIVO') return false;
  return (CLIENT_ACCOUNT_SETTINGS_SEATS as readonly string[]).includes(seat);
}
