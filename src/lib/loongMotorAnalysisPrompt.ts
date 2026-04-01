import type { LoongMotorCreditPolicy } from './loongMotorCredit';
import type { LoongOperationalRules } from './loongOperationalRules';

/**
 * Narrativa base segmento motos (MX): riesgos, prendario, uso productivo vs personal.
 * Superadmin puede sustituir/ampliar vía `platform_policy/loong_motor.loongAnalysisNarrativeMotos`.
 */
export const DEFAULT_LOONG_ANALYSIS_NARRATIVE_MOTOS = `CONTEXTO EXPERTO — CRÉDITO MOTOCICLETA (MÉXICO):
- Activo de alto riesgo de robo y desvalorización; validar uso (reparto/trabajo vs ocio) y congruencia ingreso–cuota.
- LTV y enganche son clave: menor enganche implica mayor riesgo de recuperación en mora temprana.
- Ingresos informales frecuentes: exige coherencia entre comprobantes, domicilio y estabilidad laboral declarada.
- Cobranza: priorizar contacto temprano, acuerdos de pago documentados y seguimiento de garantía prendaria según política del acreditante.
- En dictamen, cruza siempre capacidad de pago (cuota/ingreso), carga total de deuda y señales de sobreendeudamiento.`;

export function buildLoongMotorOriginationPromptAppendix(
  credit: LoongMotorCreditPolicy,
  op: LoongOperationalRules,
  narrativeMotos: string
): string {
  const col = op.collection;
  const moraText = `Tras ${col.graceDaysBeforeLateFee} días de gracia: recargo ${col.lateFeePctOfInstallment}% sobre cuota vencida (referencia operativa).`;

  return [
    narrativeMotos.trim(),
    '',
    'POLÍTICA NUMÉRICA DE ORIGINACIÓN (APLICAR EN EL ANÁLISIS; NO INVENTAR OTROS UMBRALES):',
    `- Enganche mínimo: ${credit.minDownPaymentPct}% del precio de la unidad.`,
    `- Relación máxima cuota/ingreso: ${(credit.maxLoanToIncomeRatio * 100).toFixed(0)}%.`,
    `- Relación máxima (deudas actuales + cuota)/ingreso: ${(credit.maxDebtToIncomeRatio * 100).toFixed(0)}%.`,
    `- Antigüedad laboral mínima: ${credit.minJobMonths} meses.`,
    `- Score mínimo precalificación: ${credit.minPassingScore} (formal: ${credit.formalQualMinPassingScore ?? credit.minPassingScore}).`,
    `- Plazo máximo: ${credit.maxTermMonths} meses. Tasa anual de referencia: ${credit.annualInterestPct}%.`,
    `- Ponderación score: capacidad ${credit.scoreWeights.capacity}%, apalancamiento ${credit.scoreWeights.leverage}%, comportamiento ${credit.scoreWeights.behavior}%.`,
    '',
    'POLÍTICA DE COBRANZA Y MORA (TEXTO OPERATIVO):',
    col.collectionPolicyNotes || '—',
    moraText,
    '',
    'Al emitir dictamen, menciona explícitamente si el perfil observado respeta o viola los umbrales anteriores.',
  ].join('\n');
}
