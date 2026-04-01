import {
  LOONG_ORIGINATION_STAGES,
  stageIndex,
  type LoongOriginationCase,
  type LoongOriginationStage,
} from './loongOrigination';

/** Etapas resumidas para la franja de “colocación” en CRM (después de intake inicial). */
export const LOONG_PLACEMENT_STRIP_STAGES: LoongOriginationStage[] = [
  'MESA_INTAKE_OK',
  'INVESTIGACION_ARRAIGO_OK',
  'CALIFICACION_FORMAL_OK',
  'MESA_APROBADO',
  'SUPERVISION_APROBADO',
  'DOCUMENTACION_GENERADA',
  'FIRMAS_PENDIENTE',
  'ENTREGA_PROGRAMADA',
  'COBRANZA_ACTIVA',
];

export function hasCommercialPaymentMilestone(c: LoongOriginationCase): boolean {
  const m = c.commercialMilestones;
  return !!(m?.enganchePagado || m?.investigacionPagada);
}

export function isTerminalOriginationStage(s: LoongOriginationStage): boolean {
  return s === 'CERRADO' || s === 'RECHAZADO';
}

export function isActiveOriginationCase(c: LoongOriginationCase): boolean {
  return !isTerminalOriginationStage(c.originationStage);
}

/** Prospectos sin pago registrado: foco en todo lo previo a colocación firme. */
export function isPreColocacionCrmSegment(c: LoongOriginationCase): boolean {
  return isActiveOriginationCase(c) && !hasCommercialPaymentMilestone(c);
}

/** Clientes con enganche o investigación pagados: seguimiento de avance. */
export function isColocacionActivaPagosSegment(c: LoongOriginationCase): boolean {
  return isActiveOriginationCase(c) && hasCommercialPaymentMilestone(c);
}

export function countCasesByStage(cases: LoongOriginationCase[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const s of LOONG_ORIGINATION_STAGES) acc[s] = 0;
  for (const c of cases) {
    const k = c.originationStage;
    if (k in acc) acc[k] += 1;
  }
  return acc;
}

export type StripCell = 'done' | 'current' | 'upcoming' | 'rejected';

export function placementStripCell(
  caseStage: LoongOriginationStage,
  colStage: LoongOriginationStage
): StripCell {
  if (caseStage === 'RECHAZADO') return 'rejected';
  const cur = stageIndex(caseStage);
  const col = stageIndex(colStage);
  if (cur < 0) return 'upcoming';
  if (cur < col) return 'upcoming';
  if (cur === col) return 'current';
  return 'done';
}
