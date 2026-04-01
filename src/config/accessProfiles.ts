/**
 * Opciones de rol y perfil para altas admin y pre-registro (deben alinearse con firestore.rules / isValidUser).
 * Nota: “Loong Motor” es un PERFIL (cliente/operación), no un rol. Ej.: Rol = Usuario + Perfil = Loong Motor.
 */

export const ADMIN_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'SUPERVISOR', label: 'Supervisor (operaciones / Loong)' },
  { value: 'CLIENTE', label: 'Usuario / cliente final' },
  { value: 'CLIENTE_FINANCIERO', label: 'Usuario — cliente financiero / banco' },
  { value: 'SOLICITANTE', label: 'Solicitante' },
  { value: 'INVESTIGADOR', label: 'Investigador' },
  { value: 'INVESTIGADOR_SOCIAL', label: 'Investigador social' },
  { value: 'ANALISTA_CREDITO', label: 'Analista crédito' },
  { value: 'ANALISTA_MESA_CONTROL', label: 'Mesa de control' },
  { value: 'EJECUTIVO_VENTAS', label: 'Ejecutivo ventas' },
  { value: 'GERENTE_DIRECTIVO', label: 'Gerente directivo' },
  { value: 'REVISOR_RRHH', label: 'Revisor RRHH' },
  { value: 'ATENCION_CLIENTE', label: 'Atención al cliente (Loong)' },
  { value: 'ADMIN_COBRANZA', label: 'Admin cobranza / proveedor (Loong)' },
  { value: 'AGENTE_COBRANZA', label: 'Agente cobranza (Loong)' },
];

export const CLIENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'GRATUITO', label: 'Gratuito' },
  { value: 'BOLSA', label: 'Bolsa' },
  { value: 'SUSCRIPCION', label: 'Suscripción' },
];

/** Etiqueta legible para pie de panel / UI (Firestore guarda el value en inglés). */
export function roleLabelEs(role: string | null | undefined): string {
  if (role == null || role === '') return '—';
  const hit = ADMIN_ROLE_OPTIONS.find((o) => o.value === role);
  return hit?.label ?? role;
}

export const CLIENT_PROFILE_OPTIONS: { value: string; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'INVESTIGACION', label: 'Solo investigación (SaaS)' },
  { value: 'INTEGRAL', label: 'Integral' },
  { value: 'ORIGINACION', label: 'Originación' },
  { value: 'HR', label: 'Recursos humanos' },
  { value: 'PROVIDER', label: 'Proveedor' },
  { value: 'CREDIT', label: 'Crédito (general)' },
  { value: 'LOONG_MOTOR', label: 'Loong Motor — crédito moto (usa con rol Usuario u Operaciones)' },
  { value: 'SME', label: 'Pyme' },
];
