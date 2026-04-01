/**
 * Cuentas fijas para acceso rápido en login (Loong) y para `npm run seed:demo`.
 * Contraseña compartida: VITE_LOONG_QUICK_PASSWORD en .env.local (no commitear).
 * Mantén esta lista alineada con `LOONG_QUICK_USERS` en scripts/seed-demo.mjs.
 */

import type { Role } from '../contexts/AuthContext';

export type LoongQuickUser = {
  id: string;
  label: string;
  email: string;
  role: Role;
  credits: number;
};

export const LOONG_QUICK_USERS: LoongQuickUser[] = [
  {
    id: 'loong_superadmin',
    label: 'Superadmin Loong',
    email: 'loong.superadmin@juxa.test',
    role: 'ADMIN',
    credits: 999,
  },
  {
    id: 'loong_supervisor',
    label: 'Supervisor Loong',
    email: 'loong.supervisor@juxa.test',
    role: 'SUPERVISOR',
    credits: 200,
  },
  {
    id: 'loong_vendedor',
    label: 'Vendedor Loong',
    email: 'loong.vendedor@juxa.test',
    role: 'CLIENTE',
    credits: 50,
  },
  {
    id: 'loong_comercial',
    label: 'Comercial Loong (alta vendedores)',
    email: 'loong.comercial@juxa.test',
    role: 'EJECUTIVO_VENTAS',
    credits: 100,
  },
  {
    id: 'loong_mesa',
    label: 'Mesa de control',
    email: 'loong.mesa@juxa.test',
    role: 'ANALISTA_MESA_CONTROL',
    credits: 0,
  },
  {
    id: 'loong_atencion',
    label: 'Atención al cliente',
    email: 'loong.atencion@juxa.test',
    role: 'ATENCION_CLIENTE',
    credits: 0,
  },
  {
    id: 'loong_cobranza_admin',
    label: 'Admin cobranza',
    email: 'loong.cobranza.admin@juxa.test',
    role: 'ADMIN_COBRANZA',
    credits: 0,
  },
  {
    id: 'loong_cobranza_agente',
    label: 'Agente cobranza',
    email: 'loong.cobranza.agente@juxa.test',
    role: 'AGENTE_COBRANZA',
    credits: 0,
  },
];

export function getLoongQuickPassword(): string {
  let v = (import.meta.env.VITE_LOONG_QUICK_PASSWORD as string | undefined)?.trim() ?? '';
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/** Muestra botones de acceso rápido Loong en /login (p. ej. con ?loong=1 o variable global). */
export function isLoongQuickLoginVisible(): boolean {
  if (import.meta.env.VITE_SHOW_LOONG_QUICK_LOGIN === 'true') return true;
  if (typeof window !== 'undefined' && window.location.search.includes('loong=')) return true;
  return import.meta.env.DEV;
}
