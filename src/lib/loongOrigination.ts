import type { Role } from '../contexts/AuthContext';
import type { LoongOperationalRules } from './loongOperationalRules';
import type { LoongMotorCreditPolicy, LoongPrecalInputs } from './loongMotorCredit';

/**
 * Pipeline Loong Motor (sin RRHH en CRM):
 * Intake vendedor → mesa inicial → arraigo (RRHH) → calificación formal (enlace) → mesa/supervisión → documentación → cobranza.
 * Compatibilidad: expedientes antiguos pueden tener calificación formal antes de arraigo (`CALIFICACION_FORMAL_OK` + enlace arraigo).
 */
export const LOONG_ORIGINATION_STAGES = [
  'BORRADOR',
  'MESA_INTAKE',
  'MESA_INTAKE_OK',
  'INVESTIGACION_ARRAIGO',
  'INVESTIGACION_ARRAIGO_OK',
  'PRECUALIFICADO',
  'ENLACE_CALIFICACION',
  'CALIFICACION_FORMAL_OK',
  'MESA_REVISION',
  'MESA_APROBADO',
  'SUPERVISION_REVISION',
  'SUPERVISION_APROBADO',
  'DOCUMENTACION_GENERADA',
  'FIRMAS_PENDIENTE',
  'ENTREGA_PROGRAMADA',
  'COBRANZA_ACTIVA',
  'CERRADO',
  'RECHAZADO',
] as const;

export type LoongOriginationStage = (typeof LOONG_ORIGINATION_STAGES)[number];

export type LoongOriginationHistoryEntry = {
  at: string;
  byUid: string;
  action: string;
  note?: string;
};

/** Pagos comerciales para segmentar CRM (enganche / fee investigación). */
export type LoongCommercialMilestones = {
  enganchePagado?: boolean;
  enganchePagadoAt?: string;
  investigacionPagada?: boolean;
  investigacionPagadaAt?: string;
};

export type LoongOriginationCase = {
  id: string;
  vendedorUid: string;
  vendedorEmail?: string;
  /** Nombre en perfil de cuenta del vendedor (opcional). */
  vendedorDisplayName?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  originationStage: LoongOriginationStage;
  createdAt: string;
  updatedAt: string;
  precalInputs?: Partial<LoongPrecalInputs>;
  precalScore?: number;
  precalPassed?: boolean;
  precalEstimatedPayment?: number;
  precalAmountFinanced?: number;
  mesaNote?: string;
  supervisionNote?: string;
  superadminNote?: string;
  modeloMoto?: string;
  vin?: string;
  generatedContractText?: string;
  generatedPagareText?: string;
  contractDocumentUrl?: string;
  pagareDocumentUrl?: string;
  deliveryScheduledAt?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  collectionPlan?: {
    installmentAmount: number;
    totalMonths: number;
    graceDaysLateFee: number;
    lateFeePct: number;
    notes?: string;
    policyDocumentUrl?: string;
    policyDocumentName?: string;
  };
  history?: LoongOriginationHistoryEntry[];
  linkedInvestigationId?: string;
  organizationId?: string;
  /** Enlace calificación formal */
  formalQualLinkId?: string;
  formalQualInvestigationId?: string;
  /** Copia del secreto del candidate_link para validar avance candidato (Firestore rules). */
  formalQualAdvanceSecret?: string;
  /** Enlace investigación arraigo (flujo HR) */
  arraigoLinkId?: string;
  arraigoInvestigationId?: string;
  formalQualScore?: number;
  formalQualPassed?: boolean;
  /** Entidad federativa del prospecto (precal / CRM). */
  entidadFederativa?: string;
  /** Expediente dado de alta en el CRM de precalificación. */
  registeredInCrm?: boolean;
  /** Puede promoverse al CRM (p. ej. tras precal). */
  availableForCrm?: boolean;
  /** Motivo de rechazo en etapas de mesa o supervisión. */
  rejectionReason?: string;
  /**
   * Snapshot de reglas/políticas usadas al crear el expediente.
   * Permite homologar el motor por entidad aunque el admin cambie políticas después.
   */
  policySnapshot?: {
    resolvedAt: string;
    creditPolicy: LoongMotorCreditPolicy;
    operationalRules?: LoongOperationalRules;
    /** Metadato libre (ej. "workspace_resolved" | "admin_default"). */
    source?: string;
  };
  /** CRM colocación: marcar cuando el prospecto cubrió enganche o investigación. */
  commercialMilestones?: LoongCommercialMilestones;
};

const STAGE_ORDER: LoongOriginationStage[] = [...LOONG_ORIGINATION_STAGES];

export function stageIndex(s: LoongOriginationStage): number {
  return STAGE_ORDER.indexOf(s);
}

export function nextStage(s: LoongOriginationStage): LoongOriginationStage | null {
  const i = stageIndex(s);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[i + 1];
}

/** Texto del flujo para banners (admin / superadmin configuran políticas en clients). */
export const LOONG_PIPELINE_FLOW_DESCRIPTION =
  'Originación: intake (filtro fintech + INE + precal sin buró en app) → mesa de control inicial → enlace investigación de arraigo (motor RRHH) → calificación formal candidato → mesa / supervisión → contrato y pagaré (simulación) → firmas → entrega → CRM cobranza. Expedientes antiguos pueden invertir el orden formal/arraigo; el sistema admite ambos.';

const mesaRoles = (role: Role, rules: LoongOperationalRules) =>
  role === 'ANALISTA_MESA_CONTROL' || (rules.allowSupervisorAsMesa && role === 'SUPERVISOR');

/**
 * Avance manual en pipeline (no incluye emisión de enlaces ni envío candidato).
 */
export function advanceStageAction(
  role: Role,
  current: LoongOriginationStage,
  rules: LoongOperationalRules,
  opts: { isOwner: boolean }
): { next: LoongOriginationStage; label: string } | null {
  const mesaOk = mesaRoles(role, rules) || role === 'ADMIN';

  switch (current) {
    case 'BORRADOR':
      return null;
    case 'MESA_INTAKE':
      if (!mesaOk) return null;
      return { next: 'MESA_INTAKE_OK', label: 'Aprobar intake (mesa)' };
    case 'MESA_INTAKE_OK':
      return null;
    case 'PRECUALIFICADO':
    case 'ENLACE_CALIFICACION':
    case 'CALIFICACION_FORMAL_OK':
      return null;
    case 'INVESTIGACION_ARRAIGO':
      if (!mesaOk) return null;
      return { next: 'INVESTIGACION_ARRAIGO_OK', label: 'Arraigo completado' };
    case 'INVESTIGACION_ARRAIGO_OK':
      if (!mesaOk) return null;
      return { next: 'PRECUALIFICADO', label: 'Habilitar calificación formal' };
    case 'MESA_REVISION':
      if (!mesaOk) return null;
      return { next: 'MESA_APROBADO', label: 'Aprobar mesa' };
    case 'MESA_APROBADO':
      if (role !== 'SUPERVISOR' && role !== 'ADMIN') return null;
      return { next: 'SUPERVISION_REVISION', label: 'Enviar a supervisión' };
    case 'SUPERVISION_REVISION':
      if (role !== 'SUPERVISOR' && role !== 'ADMIN') return null;
      return { next: 'SUPERVISION_APROBADO', label: 'Aprobar supervisión' };
    case 'SUPERVISION_APROBADO':
      if (role !== 'ADMIN') return null;
      return { next: 'DOCUMENTACION_GENERADA', label: 'Generar contrato y pagaré' };
    case 'DOCUMENTACION_GENERADA':
      if (!(opts.isOwner && role === 'CLIENTE') && role !== 'ADMIN') return null;
      return { next: 'FIRMAS_PENDIENTE', label: 'Pasar a firmas' };
    case 'FIRMAS_PENDIENTE':
      if (!(opts.isOwner && role === 'CLIENTE') && role !== 'ADMIN') return null;
      return { next: 'ENTREGA_PROGRAMADA', label: 'Programar entrega' };
    case 'ENTREGA_PROGRAMADA':
      if (role !== 'SUPERVISOR' && role !== 'ADMIN' && !(opts.isOwner && role === 'CLIENTE')) return null;
      return { next: 'COBRANZA_ACTIVA', label: 'Activar cobranza' };
    case 'COBRANZA_ACTIVA':
      if (role !== 'SUPERVISOR' && role !== 'ADMIN') return null;
      return { next: 'CERRADO', label: 'Cerrar expediente' };
    case 'RECHAZADO':
      return null;
    default:
      return null;
  }
}

function numToWordsEs(n: number): string {
  if (n <= 0) return 'cero';
  if (n < 1000) return String(n);
  return String(n);
}

export function applyTemplate(
  template: string,
  vars: Record<string, string | number | undefined>
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    const val = v === undefined || v === null ? '' : String(v);
    out = out.split(`{{${k}}}`).join(val);
  }
  return out;
}

export function generateLoongContractAndPagare(
  c: Pick<
    LoongOriginationCase,
    | 'clientName'
    | 'modeloMoto'
    | 'vin'
    | 'precalInputs'
    | 'precalEstimatedPayment'
    | 'precalAmountFinanced'
    | 'vendedorEmail'
  >,
  policy: { annualInterestPct: number; maxTermMonths: number },
  rules: LoongOperationalRules
): { contract: string; pagare: string } {
  const precio = c.precalInputs?.precioMoto ?? 0;
  const enganche = c.precalInputs?.enganche ?? 0;
  const plazo = c.precalInputs?.plazoMeses ?? 24;
  const montoFin = c.precalAmountFinanced ?? Math.max(0, precio - enganche);
  const cuota = c.precalEstimatedPayment ?? 0;
  const fecha = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });
  const morasTexto = `aplicará recargo del ${rules.collection.lateFeePctOfInstallment}% sobre la cuota vencida tras ${rules.collection.graceDaysBeforeLateFee} días naturales de gracia`;

  const common = {
    clienteNombre: c.clientName,
    precioMoto: precio.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
    enganche: enganche.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
    montoFinanciado: montoFin.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
    plazoMeses: plazo,
    cuota: cuota.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
    tasaAnual: policy.annualInterestPct,
    modeloMoto: c.modeloMoto || '—',
    vin: c.vin || 'PENDIENTE DE ASIGNAR',
    fecha,
    vendedor: c.vendedorEmail || '—',
    montoFinanciadoLetra: numToWordsEs(Math.round(montoFin)),
    morasTexto,
    capital: montoFin.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
    intereses: 'según tabla de amortización',
  };

  return {
    contract: applyTemplate(rules.contractTemplate, common),
    pagare: applyTemplate(rules.pagareTemplate, common),
  };
}

export function stageLabelEs(s: LoongOriginationStage): string {
  const m: Record<LoongOriginationStage, string> = {
    BORRADOR: 'Borrador',
    MESA_INTAKE: 'Mesa — revisión de intake',
    MESA_INTAKE_OK: 'Intake aprobado — emitir arraigo',
    PRECUALIFICADO: 'Listo para calificación formal',
    ENLACE_CALIFICACION: 'Calificación formal (enlace enviado)',
    CALIFICACION_FORMAL_OK: 'Calificación formal aprobada',
    INVESTIGACION_ARRAIGO: 'Investigación de arraigo',
    INVESTIGACION_ARRAIGO_OK: 'Arraigo aprobado',
    MESA_REVISION: 'Mesa de control',
    MESA_APROBADO: 'Mesa aprobó',
    SUPERVISION_REVISION: 'Supervisión',
    SUPERVISION_APROBADO: 'Supervisión OK — pendiente admin',
    DOCUMENTACION_GENERADA: 'Contrato y pagaré generados',
    FIRMAS_PENDIENTE: 'Firmas pendientes',
    ENTREGA_PROGRAMADA: 'Entrega programada',
    COBRANZA_ACTIVA: 'Cobranza activa',
    CERRADO: 'Cerrado',
    RECHAZADO: 'Rechazado (CRM)',
  };
  return m[s] || s;
}
