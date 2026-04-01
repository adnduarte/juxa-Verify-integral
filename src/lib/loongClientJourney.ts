import type { LoongOriginationStage } from './loongOrigination';

/** Fases comerciales (CRM) mapeadas desde `originationStage` técnico. */
export type LoongClientJourneyPhase =
  | 'SOLICITUDES_PRECAL'
  | 'INICIO_SOLICITUD_FORMAL'
  | 'CLIENTES_POTENCIALES'
  | 'CONTRATO_FIRMA_ENTREGA'
  | 'COBRANZA'
  | 'RECHAZADO';

export const LOONG_CLIENT_JOURNEY_PHASE_ORDER: LoongClientJourneyPhase[] = [
  'SOLICITUDES_PRECAL',
  'INICIO_SOLICITUD_FORMAL',
  'CLIENTES_POTENCIALES',
  'CONTRATO_FIRMA_ENTREGA',
  'COBRANZA',
];

export function journeyPhaseFromOriginationStage(stage: LoongOriginationStage): LoongClientJourneyPhase {
  if (stage === 'RECHAZADO') return 'RECHAZADO';

  const phase1: LoongOriginationStage[] = [
    'BORRADOR',
    'MESA_INTAKE',
    'MESA_INTAKE_OK',
    'INVESTIGACION_ARRAIGO',
    'INVESTIGACION_ARRAIGO_OK',
    'PRECUALIFICADO',
  ];
  if (phase1.includes(stage)) return 'SOLICITUDES_PRECAL';

  if (stage === 'ENLACE_CALIFICACION' || stage === 'CALIFICACION_FORMAL_OK') {
    return 'INICIO_SOLICITUD_FORMAL';
  }

  const phase3: LoongOriginationStage[] = [
    'MESA_REVISION',
    'MESA_APROBADO',
    'SUPERVISION_REVISION',
    'SUPERVISION_APROBADO',
  ];
  if (phase3.includes(stage)) return 'CLIENTES_POTENCIALES';

  const phase4: LoongOriginationStage[] = ['DOCUMENTACION_GENERADA', 'FIRMAS_PENDIENTE', 'ENTREGA_PROGRAMADA'];
  if (phase4.includes(stage)) return 'CONTRATO_FIRMA_ENTREGA';

  if (stage === 'COBRANZA_ACTIVA' || stage === 'CERRADO') return 'COBRANZA';

  return 'SOLICITUDES_PRECAL';
}

export function journeyPhaseTitleEs(phase: LoongClientJourneyPhase): string {
  switch (phase) {
    case 'SOLICITUDES_PRECAL':
      return 'Solicitudes y precalificaciones';
    case 'INICIO_SOLICITUD_FORMAL':
      return 'Inicio de solicitud (2.ª fase)';
    case 'CLIENTES_POTENCIALES':
      return 'Clientes potenciales';
    case 'CONTRATO_FIRMA_ENTREGA':
      return 'Contrato, firma y entrega';
    case 'COBRANZA':
      return 'Cobranza';
    case 'RECHAZADO':
      return 'Rechazado';
  }
}

export function journeyPhaseDescriptionEs(phase: LoongClientJourneyPhase): string {
  switch (phase) {
    case 'SOLICITUDES_PRECAL':
      return 'Intake, mesa inicial, arraigo y precalificación hasta listo para formalizar.';
    case 'INICIO_SOLICITUD_FORMAL':
      return 'Calificación formal y enlace al candidato.';
    case 'CLIENTES_POTENCIALES':
      return 'Mesa y supervisión hasta aprobación.';
    case 'CONTRATO_FIRMA_ENTREGA':
      return 'Documentación generada, firmas y entrega programada.';
    case 'COBRANZA':
      return 'Cobranza activa y cierre del expediente.';
    case 'RECHAZADO':
      return 'Expediente cerrado por rechazo en mesa o supervisión.';
    default:
      return '';
  }
}
