import type { SaaSProductId } from './organizations';

export type ProductAccessContext = {
  clientType: string;
  credits: number;
  investigationsCount: number;
  organizationId: string | null;
  /** Si la org tiene lista vacía o null, no se restringe por producto (legacy). */
  orgEnabledProducts: SaaSProductId[] | null;
  orgTrialEndsAt: string | null;
  userTrialEndsAt: string | null;
  userTrialProduct: SaaSProductId | null;
  maxFreeInvestigations: number | null;
};

function mapInvestigationTypeToProduct(t: string): SaaSProductId {
  if (t === 'HR' || t === 'CREDIT' || t === 'LOONG_MOTOR' || t === 'SME' || t === 'PROVIDER' || t === 'GENERAL') {
    return t;
  }
  return 'GENERAL';
}

export function investigationTypeToProductId(investigationType: string): SaaSProductId {
  return mapInvestigationTypeToProduct(investigationType);
}

/**
 * Comprueba si el usuario puede iniciar una investigación del tipo dado.
 * Respeta trials de org/usuario, productos habilitados y límites GRATUITO/BOLSA.
 */
export function canUseProduct(
  ctx: ProductAccessContext,
  investigationType: string
): { ok: boolean; reason?: string } {
  const product = investigationTypeToProductId(investigationType);
  const now = Date.now();

  if (ctx.orgTrialEndsAt) {
    const t = new Date(ctx.orgTrialEndsAt).getTime();
    if (!Number.isNaN(t) && t < now) {
      return { ok: false, reason: 'El periodo de prueba de tu organización ha finalizado. Contacta a Juxa Verify.' };
    }
  }

  if (ctx.userTrialEndsAt) {
    const t = new Date(ctx.userTrialEndsAt).getTime();
    if (!Number.isNaN(t) && t < now) {
      return { ok: false, reason: 'Tu periodo de prueba ha finalizado.' };
    }
  }

  if (ctx.orgEnabledProducts && ctx.orgEnabledProducts.length > 0) {
    if (!ctx.orgEnabledProducts.includes(product)) {
      return {
        ok: false,
        reason: 'Tu empresa no tiene habilitado este tipo de investigación. Solicita acceso al administrador.',
      };
    }
  }

  if (
    ctx.userTrialProduct &&
    ctx.userTrialProduct === product &&
    ctx.maxFreeInvestigations != null &&
    ctx.maxFreeInvestigations >= 0
  ) {
    if (ctx.investigationsCount >= ctx.maxFreeInvestigations) {
      return {
        ok: false,
        reason: `Has alcanzado el límite de prueba (${ctx.maxFreeInvestigations} investigaciones) para este producto.`,
      };
    }
    return { ok: true };
  }

  if (ctx.clientType === 'GRATUITO' && ctx.investigationsCount >= 10) {
    return {
      ok: false,
      reason: 'Has alcanzado el límite de 10 investigaciones gratuitas. Actualiza tu plan para continuar.',
    };
  }

  if (ctx.clientType === 'BOLSA' && ctx.credits <= 0) {
    return { ok: false, reason: 'No tienes créditos suficientes.' };
  }

  return { ok: true };
}

/**
 * Alta de expediente Loong (originación / intake vendedor).
 * No usa cupo de investigaciones ni créditos de “solicitud de crédito” genérica en Juxa:
 * solo trials de org/usuario y producto LOONG_MOTOR habilitado en la organización.
 */
export function canStartLoongOriginationIntake(ctx: ProductAccessContext): { ok: boolean; reason?: string } {
  const now = Date.now();

  if (ctx.orgTrialEndsAt) {
    const t = new Date(ctx.orgTrialEndsAt).getTime();
    if (!Number.isNaN(t) && t < now) {
      return { ok: false, reason: 'El periodo de prueba de tu organización ha finalizado. Contacta a Juxa Verify.' };
    }
  }

  if (ctx.userTrialEndsAt) {
    const t = new Date(ctx.userTrialEndsAt).getTime();
    if (!Number.isNaN(t) && t < now) {
      return { ok: false, reason: 'Tu periodo de prueba ha finalizado.' };
    }
  }

  if (ctx.orgEnabledProducts && ctx.orgEnabledProducts.length > 0) {
    if (!ctx.orgEnabledProducts.includes('LOONG_MOTOR')) {
      return {
        ok: false,
        reason: 'Tu empresa no tiene habilitado Loong Motor. Solicita acceso al administrador.',
      };
    }
  }

  return { ok: true };
}

/** Límite de investigaciones “gratis” para mostrar en UI (plan GRATUITO o trial por producto). */
export function gratuitousInvestigationCap(ctx: ProductAccessContext): number {
  if (
    ctx.userTrialProduct &&
    ctx.maxFreeInvestigations != null &&
    ctx.maxFreeInvestigations >= 0
  ) {
    return ctx.maxFreeInvestigations;
  }
  return 10;
}
