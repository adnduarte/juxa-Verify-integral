/**
 * Reglas ad hoc por tipo de crédito y segmento de riesgo (originación BASIC).
 * Ajusta campos de pre-calificación y evidencias requeridas sin depender de Firestore.
 */

export const CREDIT_TYPE_PERSONAL = 'Personal';
export const CREDIT_TYPE_MOTORCYCLE = 'Crédito Motocicleta';

export type RiskSegmentCode = 'SEGMENTO_A' | 'SEGMENTO_B' | 'SEGMENTO_C';

export type AdaptiveCreditQuestionnaire = {
  riskSegment: RiskSegmentCode;
  label: string;
  /** Pre-calificación: datos específicos de moto */
  showMotorcycleFields: boolean;
  /** Referencia telefónica (solo segmento más exigente) */
  requirePersonalReferencePhone: boolean;
  requireSala: boolean;
  requireComedor: boolean;
  requireCocina: boolean;
  requireHabitacion: boolean;
};

const MOTOR_THRESHOLDS = {
  /** Hasta este monto (MXN): segmento A */
  aMax: 45_000,
  /** Hasta este monto (MXN): segmento B; arriba = C */
  bMax: 100_000,
} as const;

export function isMotorcycleCreditType(tipo: string | null | undefined): boolean {
  if (!tipo) return false;
  const t = tipo.trim().toLowerCase();
  return t.includes('motocicleta') || t.includes('moto ') || t === 'moto';
}

/**
 * Segmento de riesgo ad hoc para crédito motocicleta según monto solicitado (MXN).
 */
export function resolveMotorcycleRiskSegment(amountMxn: number): RiskSegmentCode {
  const m = Number.isFinite(amountMxn) && amountMxn > 0 ? amountMxn : 0;
  if (m <= MOTOR_THRESHOLDS.aMax) return 'SEGMENTO_A';
  if (m <= MOTOR_THRESHOLDS.bMax) return 'SEGMENTO_B';
  return 'SEGMENTO_C';
}

export function resolveRiskSegmentForTipo(
  tipoCredito: string | null | undefined,
  amountMxn: number
): RiskSegmentCode | null {
  if (!isMotorcycleCreditType(tipoCredito)) return null;
  return resolveMotorcycleRiskSegment(amountMxn);
}

export function getAdaptiveCreditQuestionnaire(
  tipoCredito: string | null | undefined,
  riskSegment: string | null | undefined,
  amountMxn: number
): AdaptiveCreditQuestionnaire {
  const motor = isMotorcycleCreditType(tipoCredito);
  const segment: RiskSegmentCode = motor
    ? ['SEGMENTO_A', 'SEGMENTO_B', 'SEGMENTO_C'].includes(String(riskSegment))
      ? (riskSegment as RiskSegmentCode)
      : resolveMotorcycleRiskSegment(amountMxn)
    : 'SEGMENTO_B';

  if (!motor) {
    return {
      riskSegment: 'SEGMENTO_B',
      label: 'Crédito general',
      showMotorcycleFields: false,
      requirePersonalReferencePhone: false,
      requireSala: true,
      requireComedor: true,
      requireCocina: true,
      requireHabitacion: true,
    };
  }

  const labels: Record<RiskSegmentCode, string> = {
    SEGMENTO_A: 'Segmento A — riesgo controlado (monto bajo)',
    SEGMENTO_B: 'Segmento B — riesgo medio',
    SEGMENTO_C: 'Segmento C — riesgo alto (monto elevado)',
  };

  if (segment === 'SEGMENTO_A') {
    return {
      riskSegment: 'SEGMENTO_A',
      label: labels.SEGMENTO_A,
      showMotorcycleFields: true,
      requirePersonalReferencePhone: false,
      requireSala: true,
      requireComedor: false,
      requireCocina: false,
      requireHabitacion: false,
    };
  }
  if (segment === 'SEGMENTO_B') {
    return {
      riskSegment: 'SEGMENTO_B',
      label: labels.SEGMENTO_B,
      showMotorcycleFields: true,
      requirePersonalReferencePhone: false,
      requireSala: true,
      requireComedor: false,
      requireCocina: true,
      requireHabitacion: true,
    };
  }
  return {
    riskSegment: 'SEGMENTO_C',
    label: labels.SEGMENTO_C,
    showMotorcycleFields: true,
    requirePersonalReferencePhone: true,
    requireSala: true,
    requireComedor: true,
    requireCocina: true,
    requireHabitacion: true,
  };
}
