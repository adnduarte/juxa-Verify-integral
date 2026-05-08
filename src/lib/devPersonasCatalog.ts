export const DEV_LOCAL_PASSWORD = 'Twn5y7788';

export type DevPersona = {
  label: string;
  email: string;
  role: string;
  clientProfile: string;
  clientType?: string;
  /** Override de organización para vincular dev personas a tenants no-default (ej. Ford). */
  organizationId?: string;
  /** Quién ve "Configuración" de cuenta en panel cliente; omitido = acceso legacy. */
  clientAccountRole?: string;
};

export function localDevUidFromEmail(email: string): string {
  const slug = email
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 88);
  return `local_${slug || 'user'}`;
}

/** Personas sembradas en dev local y botones rápidos en Login: solo Juxa (plataforma) + vertical Ford. */
export const DEV_LOCAL_PERSONAS: DevPersona[] = [
  { label: 'Juxa · Superadmin', email: 'aduarte@duarteaupartabogados.com', role: 'ADMIN', clientProfile: 'GENERAL' },
  // Ford Crédito México (vertical por organización; clientProfile sigue siendo CREDIT)
  {
    label: 'Ford · F&I agencia (Polanco)',
    email: 'dev-ford-agencia@duarteaupartabogados.com',
    role: 'CLIENTE',
    clientProfile: 'CREDIT',
    organizationId: 'ford-agencia-polanco',
    clientAccountRole: 'OPERATIVO',
  },
  {
    label: 'Ford · Gerencia agencia (Polanco)',
    email: 'dev-ford-agencia-gerencia@duarteaupartabogados.com',
    role: 'CLIENTE',
    clientProfile: 'CREDIT',
    organizationId: 'ford-agencia-polanco',
    clientAccountRole: 'GERENCIA',
  },
  { label: 'Ford · Mesa programa (central)', email: 'dev-ford-mesa-programa@duarteaupartabogados.com', role: 'ANALISTA_MESA_CONTROL', clientProfile: 'GENERAL', organizationId: 'ford-credit-mx' },
  {
    label: 'Ford · Supervisión gerencia (programa)',
    email: 'dev-ford-supervision-gerencia@duarteaupartabogados.com',
    role: 'FORD_SUPERVISOR_GERENCIA',
    clientProfile: 'GENERAL',
    organizationId: 'ford-credit-mx',
  },
  {
    label: 'Ford · Supervisión dirección (programa)',
    email: 'dev-ford-supervision-direccion@duarteaupartabogados.com',
    role: 'FORD_SUPERVISOR_DIRECCION',
    clientProfile: 'GENERAL',
    organizationId: 'ford-credit-mx',
  },
  { label: 'Ford · Analista crédito', email: 'dev-ford-analista@duarteaupartabogados.com', role: 'ANALISTA_CREDITO', clientProfile: 'GENERAL', organizationId: 'ford-credit-mx' },
  { label: 'Ford · Superadmin', email: 'dev-ford-admin@duarteaupartabogados.com', role: 'ADMIN', clientProfile: 'GENERAL', organizationId: 'ford-credit-mx' },
];

export function findDevPersonaByEmail(email: string): DevPersona | undefined {
  const e = email.trim().toLowerCase();
  return DEV_LOCAL_PERSONAS.find((p) => p.email.toLowerCase() === e);
}
