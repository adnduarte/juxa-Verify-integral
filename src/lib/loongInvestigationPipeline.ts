import { mesaPrecalFlowLabel, mesaPrecalFlowState, type MesaPrecalInvInput } from './mesaCreditDictamen';

/** Vendedor puede ver puntuaciones / etapas internas si hubo referencia favorable del motor o resolución favorable de mesa (o fase 2 liberada). */
export function vendorCanOpenDetailedLoongStatus(inv: Record<string, unknown> | null | undefined): boolean {
  if (!inv) return false;
  if (inv.mesaPrecalAutoPassed === true) return true;
  if (inv.mesaPrecalStatus === 'approved') return true;
  if (inv.loongPhase2Unlocked === true) return true;
  if (inv.originacionPhase2Unlocked === true) return true;
  return false;
}

export type PipelineStepUi = { key: string; label: string; hint: string; done: boolean; current: boolean };

/**
 * Pasos legibles para explicar al cliente final (crédito moto / precal Loong).
 */
export function buildLoongMotorPipelineSteps(inv: Record<string, unknown>): PipelineStepUi[] {
  const ls = String(inv.linkStatus || '');
  const precalSent =
    ls === 'PHASE_1_COMPLETED' ||
    ls === 'AWAITING_MESA' ||
    ls === 'IN_PROGRESS' ||
    ls === 'COMPLETED' ||
    Boolean(inv.candidateData);
  const ms = String(inv.mesaPrecalStatus || '');
  const motorDone =
    typeof inv.mesaPrecalAutoPassed === 'boolean' ||
    ms === 'pending' ||
    ms === 'approved' ||
    ms === 'rejected' ||
    ms === 'precal_failed' ||
    typeof inv.score === 'number';
  const mesaResolved = ms === 'approved' || ms === 'rejected' || ms === 'precal_failed';
  const mesaApproved = ms === 'approved' || inv.loongPhase2Unlocked === true || inv.originacionPhase2Unlocked === true;
  const phase2 =
    inv.loongPhase2Unlocked === true ||
    inv.originacionPhase2Unlocked === true ||
    inv.investigationScope === 'INTEGRAL';

  const linkIssued = Boolean(inv.candidateLink);
  const raw: Omit<PipelineStepUi, 'current'>[] = [
    {
      key: 'link',
      label: 'Enlace de precalificación',
      hint: 'Comparte el enlace; el candidato lo abre en el celular.',
      done: linkIssued,
    },
    {
      key: 'candidate',
      label: 'Cuestionario del candidato',
      hint: 'Hasta que envíe el formulario de precalificación.',
      done: precalSent,
    },
    {
      key: 'motor',
      label: 'Referencia automática (motor)',
      hint: 'Score de referencia y fila en mesa si aplica.',
      done: motorDone,
    },
    {
      key: 'mesa',
      label: 'Mesa de control',
      hint: 'Dictamen formal: procedente o no procedente.',
      done: mesaResolved,
    },
    {
      key: 'f2',
      label: 'Documentación y visita (fase 2)',
      hint: 'Solo si mesa autorizó continuar.',
      done: phase2,
    },
  ];

  const firstOpen = raw.findIndex((s) => !s.done);
  const allDone = firstOpen < 0;
  return raw.map((s, i) => ({
    ...s,
    current: !allDone && i === firstOpen,
  }));
}

export function loongInvestigationSummaryLine(inv: Record<string, unknown>): string {
  const flow = mesaPrecalFlowState(inv as MesaPrecalInvInput);
  return mesaPrecalFlowLabel(flow);
}

function isCreditLikeOrigination(inv: Record<string, unknown>): boolean {
  const t = String(inv.investigationType || '');
  const p = String(inv.clientProfile || '');
  return (
    t === 'CREDIT' ||
    t === 'LOONG_MOTOR' ||
    p === 'CREDIT' ||
    p === 'LOONG_MOTOR' ||
    p === 'SOCIOECONOMIC_CREDIT' ||
    inv.loongMotorPolicyApplies === true
  );
}

/** Crédito integral (dos fases en CandidateFlow): perfilamiento → documentos → IA → cierre. */
export function buildIntegralCreditTrajectorySteps(inv: Record<string, unknown>): PipelineStepUi[] {
  const ls = String(inv.linkStatus || '');
  const st = String(inv.status || '');
  const uploads = inv.uploadedFileUrls;
  const hasUploads =
    uploads != null && typeof uploads === 'object' && !Array.isArray(uploads) && Object.keys(uploads as object).length > 0;
  const hasAi = Boolean(
    inv.socioeconomicDictamen || inv.creditAnalysisResult || inv.identityValidationResult || inv.score != null
  );

  const phase1Done =
    ls === 'PHASE_1_COMPLETED' || ls === 'COMPLETED' || ls === 'AWAITING_MESA' || (ls === 'IN_PROGRESS' && Boolean(inv.candidateData));
  const phase2Done = ls === 'COMPLETED';
  const analysisDone = hasAi || (phase2Done && st !== 'PENDING');
  const closedDone = st === 'COMPLETED';

  const raw: Omit<PipelineStepUi, 'current'>[] = [
    {
      key: 'exp',
      label: 'Expediente de originación',
      hint: 'Alta en sistema y datos del caso.',
      done: true,
    },
    {
      key: 'p1',
      label: 'Candidato: perfilamiento (fase 1)',
      hint: 'Cuestionario inicial; el candidato usa el enlace que compartiste.',
      done: phase1Done,
    },
    {
      key: 'p2',
      label: 'Candidato: documentos y evidencias (fase 2)',
      hint: 'INE, comprobantes, selfie, fachada y ubicación cuando aplica.',
      done: phase2Done,
    },
    {
      key: 'ai',
      label: 'Análisis y dictamen',
      hint: 'Validaciones e informe IA (puedes generar dictamen desde el panel si falta).',
      done: analysisDone,
    },
    {
      key: 'close',
      label: 'Cierre del expediente',
      hint: 'Investigación marcada como completada.',
      done: closedDone,
    },
  ];

  const firstOpen = raw.findIndex((s) => !s.done);
  const allDone = firstOpen < 0;
  return raw.map((s, i) => ({
    ...s,
    current: !allDone && i === firstOpen,
  }));
}

/** Variante de etiquetas para BASIC con mesa (sin marca «solo moto»). */
export function buildMesaBasicTrajectorySteps(inv: Record<string, unknown>): PipelineStepUi[] {
  const steps = buildLoongMotorPipelineSteps(inv);
  const scope = String(inv.investigationScope || '');
  if (
    scope !== 'LOONG_PRECAL' &&
    inv.clientProfile !== 'LOONG_MOTOR' &&
    inv.investigationType !== 'LOONG_MOTOR' &&
    inv.loongMotorPolicyApplies !== true
  ) {
    return steps.map((s) =>
      s.key === 'link'
        ? { ...s, label: 'Enlace al candidato', hint: 'Comparte el enlace; solo el candidato debe abrirlo en su dispositivo.' }
        : s.key === 'candidate'
          ? { ...s, label: 'Cuestionario del candidato', hint: 'Precalificación o perfil hasta envío.' }
          : s
    );
  }
  return steps;
}

/**
 * Trayecto completo de originación para mostrar en «Ver detalles» (mesa, integral o precal moto).
 */
export function buildOriginationTrajectorySteps(inv: Record<string, unknown>): PipelineStepUi[] | null {
  if (!isCreditLikeOrigination(inv)) return null;
  const scope = String(inv.investigationScope || '');
  if (scope === 'LOONG_FORMAL_QUAL') {
    const submitted = String(inv.linkStatus || '') === 'COMPLETED' || Boolean(inv.candidateData);
    const raw: Omit<PipelineStepUi, 'current'>[] = [
      { key: 'fq1', label: 'Enlace de calificación formal', hint: 'Comparte el enlace al candidato.', done: Boolean(inv.candidateLink) },
      { key: 'fq2', label: 'Formulario del candidato', hint: 'Evaluación formal moto.', done: submitted },
      { key: 'fq3', label: 'Resolución en expediente Loong', hint: 'Resultado vinculado al caso de originación.', done: stComplete(inv) },
    ];
    return finalizeTrajectory(raw);
  }
  if (scope === 'INTEGRAL') {
    return buildIntegralCreditTrajectorySteps(inv);
  }
  return buildMesaBasicTrajectorySteps(inv);
}

function stComplete(inv: Record<string, unknown>): boolean {
  return String(inv.status || '') === 'COMPLETED';
}

function finalizeTrajectory(raw: Omit<PipelineStepUi, 'current'>[]): PipelineStepUi[] {
  const firstOpen = raw.findIndex((s) => !s.done);
  const allDone = firstOpen < 0;
  return raw.map((s, i) => ({
    ...s,
    current: !allDone && i === firstOpen,
  }));
}
