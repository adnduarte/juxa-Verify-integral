/**
 * Reglas operativas Loong: originación, cobranza y plantillas de documentos.
 * Se guardan en Firestore junto a la política de precal (`clients/admin_simulator.loongOperationalRules`).
 */

export type LoongOriginationStageRule = {
  id: string;
  label: string;
  /** Roles de la app que pueden avanzar desde esta etapa (además de ADMIN). */
  allowedRoles: Array<'CLIENTE' | 'ANALISTA_MESA_CONTROL' | 'SUPERVISOR'>;
  description?: string;
};

export type LoongCollectionRules = {
  graceDaysBeforeLateFee: number;
  lateFeePctOfInstallment: number;
  /** Política de cobranza en texto plano (no markdown). */
  collectionPolicyNotes: string;
  /** Documento adjunto (PDF, DOC, etc.) subido a Storage — URL de descarga. */
  collectionPolicyDocumentUrl?: string;
  /** Nombre original del archivo para mostrar en UI. */
  collectionPolicyDocumentName?: string;
};

export type LoongOperationalRules = {
  /** Si true, SUPERVISOR puede actuar como mesa cuando no hay analista dedicado. */
  allowSupervisorAsMesa: boolean;
  /** Etapas y quién puede mover (referencia documental; la lógica está en código). */
  originationStages: LoongOriginationStageRule[];
  collection: LoongCollectionRules;
  /** Plantilla contrato — variables: {{clienteNombre}}, {{montoFinanciado}}, {{plazoMeses}}, {{cuota}}, {{tasaAnual}}, {{enganche}}, {{precioMoto}}, {{modeloMoto}}, {{vin}}, {{fecha}}, {{vendedor}} */
  contractTemplate: string;
  /** Plantilla pagaré — mismas variables + {{capital}}, {{intereses}} */
  pagareTemplate: string;
};

export const DEFAULT_LOONG_OPERATIONAL_RULES: LoongOperationalRules = {
  allowSupervisorAsMesa: true,
  originationStages: [
    { id: 'BORRADOR', label: 'Borrador vendedor', allowedRoles: ['CLIENTE'], description: 'Captura y precalificación en CRM.' },
    { id: 'MESA_INTAKE', label: 'Mesa — intake', allowedRoles: ['ANALISTA_MESA_CONTROL', 'SUPERVISOR'] },
    { id: 'MESA_INTAKE_OK', label: 'Intake aprobado', allowedRoles: ['CLIENTE'] },
    { id: 'PRECUALIFICADO', label: 'Listo calificación formal', allowedRoles: ['CLIENTE'] },
    { id: 'MESA_REVISION', label: 'Mesa de control', allowedRoles: ['ANALISTA_MESA_CONTROL', 'SUPERVISOR'] },
    { id: 'MESA_APROBADO', label: 'Mesa aprobó', allowedRoles: ['ANALISTA_MESA_CONTROL', 'SUPERVISOR'] },
    { id: 'SUPERVISION_REVISION', label: 'Supervisión', allowedRoles: ['SUPERVISOR'] },
    { id: 'SUPERVISION_APROBADO', label: 'Supervisión OK', allowedRoles: ['SUPERVISOR'] },
    { id: 'DOCUMENTACION_GENERADA', label: 'Contrato / pagaré generados', allowedRoles: [] },
    { id: 'FIRMAS_PENDIENTE', label: 'Firmas cliente', allowedRoles: ['CLIENTE'] },
    { id: 'ENTREGA_PROGRAMADA', label: 'Entrega moto', allowedRoles: ['CLIENTE', 'SUPERVISOR'] },
    { id: 'COBRANZA_ACTIVA', label: 'Cobranza activa', allowedRoles: ['SUPERVISOR'] },
    { id: 'CERRADO', label: 'Cerrado', allowedRoles: [] },
  ],
  collection: {
    graceDaysBeforeLateFee: 5,
    lateFeePctOfInstallment: 2,
    collectionPolicyNotes:
      'Moratorio después del periodo de gracia según reglas internas. Comunicación al cliente por canales oficiales Loong.',
  },
  contractTemplate: `CONTRATO DE CRÉDITO SIMPLE — LOONG MOTOR

Otorgante: Loong Motor / Concesionario autorizado.
Acreditado: {{clienteNombre}}.

Objeto: financiamiento de motocicleta {{modeloMoto}}.
Precio contado: {{precioMoto}} MXN. Enganche: {{enganche}} MXN.
Monto financiado: {{montoFinanciado}} MXN. Plazo: {{plazoMeses}} meses.
Tasa anual ordinaria: {{tasaAnual}}%. Pago mensual estimado: {{cuota}} MXN.

El acreditado se obliga al pago puntual conforme al calendario de amortización y al pagaré que se suscribe en el mismo acto.

Fecha de elaboración: {{fecha}}.
Asesor / vendedor: {{vendedor}}.

_________________________
Firma acreditado          _________________________
Firma representante`,

  pagareTemplate: `PAGARÉ

Por valor de {{montoFinanciado}} MXN ({{montoFinanciadoLetra}}) que pagaré incondicionalmente a la orden de Loong Motor.

Deudor: {{clienteNombre}}.
Capital: {{montoFinanciado}} MXN. Cuota periódica: {{cuota}} MXN. Plazo: {{plazoMeses}} meses.
En caso de mora, {{morasTexto}}.

Lugar y fecha: {{fecha}}.

_________________________
Firma deudor`,
};

export function mergeLoongOperationalRules(
  partial: Partial<LoongOperationalRules> | null | undefined
): LoongOperationalRules {
  if (!partial) return { ...DEFAULT_LOONG_OPERATIONAL_RULES };
  return {
    ...DEFAULT_LOONG_OPERATIONAL_RULES,
    ...partial,
    collection: {
      ...DEFAULT_LOONG_OPERATIONAL_RULES.collection,
      ...(partial.collection || {}),
    },
    originationStages: partial.originationStages?.length
      ? partial.originationStages
      : DEFAULT_LOONG_OPERATIONAL_RULES.originationStages,
  };
}

export function mergeLoongOperationalOnto(
  base: LoongOperationalRules,
  partial: Partial<LoongOperationalRules> | null | undefined
): LoongOperationalRules {
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    collection: {
      ...base.collection,
      ...(partial.collection || {}),
    },
    originationStages: partial.originationStages?.length
      ? partial.originationStages
      : base.originationStages,
  };
}
