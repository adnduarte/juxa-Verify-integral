/**
 * Cuentas demo para entorno de pruebas: deben existir en Firebase Auth
 * y tener el rol deseado en Firestore (`users/{uid}`).
 */
export type DemoAccount = {
  id: string;
  label: string;
  description: string;
  email: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'admin',
    label: 'Administrador',
    description: 'Panel completo y configuración.',
    email: 'demo.admin@juxa.test',
  },
  {
    id: 'analyst',
    label: 'Analista crédito',
    description: 'Flujos de mesa de control y análisis.',
    email: 'demo.analyst@juxa.test',
  },
  {
    id: 'client',
    label: 'Cliente / solicitante',
    description: 'Vista simplificada de solicitud.',
    email: 'demo.client@juxa.test',
  },
];

/** Contraseña compartida para cuentas demo (definir en .env.local, no commitear). */
export function getDemoSharedPassword(): string {
  return (import.meta.env.VITE_DEMO_SHARED_PASSWORD as string | undefined)?.trim() ?? '';
}

/**
 * Panel de acceso demo en login. Solo si VITE_SHOW_DEMO_LOGIN=true (no se activa solo en dev).
 */
export function isDemoQuickLoginEnabled(): boolean {
  return import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true';
}
