/**
 * Estado de originación BASIC con mesa de control y precal automática (referencia).
 */

export type MesaPrecalInvInput = {
  investigationScope?: string;
  clientProfile?: string;
  investigationType?: string;
  mesaPrecalStatus?: string;
  originacionPhase2Unlocked?: boolean;
  linkStatus?: string;
  loongPhase2Unlocked?: boolean;
  mesaPrecalAutoPassed?: boolean;
};

export type MesaPrecalFlowState =
  | 'no_aplica'
  | 'precal_en_curso'
  | 'precal_auto_fallida'
  | 'espera_mesa'
  | 'mesa_autorizo'
  | 'mesa_rechazo'
  | 'originacion_avanzada'
  | 'loong_e1_pendiente'
  | 'loong_e1_mesa_ref_ok'
  | 'loong_e1_mesa_ref_warn'
  | 'loong_e1_aprobada'
  | 'loong_e1_rechazo';

export function mesaPrecalFlowBadgeClass(state: MesaPrecalFlowState): string {
  switch (state) {
    case 'precal_auto_fallida':
    case 'mesa_rechazo':
    case 'loong_e1_rechazo':
      return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
    case 'precal_en_curso':
    case 'loong_e1_pendiente':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200';
    case 'espera_mesa':
    case 'loong_e1_mesa_ref_ok':
    case 'loong_e1_mesa_ref_warn':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
    case 'mesa_autorizo':
    case 'loong_e1_aprobada':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  }
}

function isLoongMotorPrecalInv(inv: MesaPrecalInvInput): boolean {
  return (
    inv.investigationScope === 'LOONG_PRECAL' &&
    (inv.clientProfile === 'LOONG_MOTOR' || inv.investigationType === 'LOONG_MOTOR')
  );
}

export function mesaPrecalFlowState(inv: MesaPrecalInvInput): MesaPrecalFlowState {
  if (isLoongMotorPrecalInv(inv)) {
    const ls = inv.linkStatus;
    const ms = inv.mesaPrecalStatus;
    const p2 = inv.loongPhase2Unlocked === true || inv.originacionPhase2Unlocked === true;
    if (p2 || ms === 'approved') return 'loong_e1_aprobada';
    if (ms === 'rejected' || ms === 'precal_failed') return 'loong_e1_rechazo';
    if (ls === 'PHASE_1_COMPLETED' && ms === 'pending') {
      return inv.mesaPrecalAutoPassed === false ? 'loong_e1_mesa_ref_warn' : 'loong_e1_mesa_ref_ok';
    }
    return 'loong_e1_pendiente';
  }

  const isBasicCredit =
    inv.investigationScope === 'BASIC' &&
    (inv.clientProfile === 'CREDIT' ||
      inv.clientProfile === 'SOCIOECONOMIC_CREDIT' ||
      inv.investigationType === 'CREDIT');
  if (!isBasicCredit) return 'no_aplica';

  const ms = inv.mesaPrecalStatus;
  if (!ms || ms === '') {
    if (inv.linkStatus === 'AWAITING_MESA') return 'espera_mesa';
    if (inv.originacionPhase2Unlocked) return 'mesa_autorizo';
    return 'precal_en_curso';
  }
  if (ms === 'precal_failed') return 'precal_auto_fallida';
  if (ms === 'pending') return 'espera_mesa';
  if (ms === 'rejected') return 'mesa_rechazo';
  if (ms === 'approved' || inv.originacionPhase2Unlocked) return 'mesa_autorizo';
  return 'originacion_avanzada';
}

export function mesaPrecalFlowLabel(state: MesaPrecalFlowState): string {
  switch (state) {
    case 'precal_en_curso':
      return 'Precalificación: pendiente envío del candidato';
    case 'precal_auto_fallida':
      return 'Precalificación automática no favorable';
    case 'espera_mesa':
      return 'En mesa de control (pendiente de resolución)';
    case 'mesa_autorizo':
      return 'Mesa: procedente — continuar originación';
    case 'mesa_rechazo':
      return 'Mesa: no procedente';
    case 'originacion_avanzada':
      return 'Originación en curso';
    case 'loong_e1_pendiente':
      return '1ª etapa: pendiente precal candidato (moto)';
    case 'loong_e1_mesa_ref_ok':
      return '1ª etapa: precal recibida · ref. favorable · mesa';
    case 'loong_e1_mesa_ref_warn':
      return '1ª etapa: precal recibida · ref. no favorable · mesa';
    case 'loong_e1_aprobada':
      return '1ª etapa aprobada — documentación';
    case 'loong_e1_rechazo':
      return '1ª etapa: no procede';
    default:
      return '';
  }
}

export function parseMesaAutoReasons(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j.map(String) : [String(j)];
  } catch {
    return [raw];
  }
}
