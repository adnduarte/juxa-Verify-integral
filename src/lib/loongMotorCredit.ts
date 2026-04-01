/**
 * Precalificación crédito motos — Loong Motor.
 * La política se puede sobreescribir desde Firestore (`clients/admin_simulator.loongMotorCreditPolicy`).
 */

export type LoongMotorCreditPolicy = {
  minDownPaymentPct: number;
  maxLoanToIncomeRatio: number;
  maxDebtToIncomeRatio: number;
  minJobMonths: number;
  minPassingScore: number;
  /** Umbral extra para la calificación formal del candidato (enlace). Si no se define, se usa minPassingScore. */
  formalQualMinPassingScore?: number;
  maxTermMonths: number;
  annualInterestPct: number;
  scoreWeights: {
    capacity: number;
    leverage: number;
    behavior: number;
  };
};

export const DEFAULT_LOONG_MOTOR_POLICY: LoongMotorCreditPolicy = {
  minDownPaymentPct: 15,
  maxLoanToIncomeRatio: 0.35,
  maxDebtToIncomeRatio: 0.45,
  minJobMonths: 6,
  minPassingScore: 62,
  maxTermMonths: 48,
  annualInterestPct: 22,
  scoreWeights: { capacity: 40, leverage: 35, behavior: 25 },
};

export type LoongPrecalInputs = {
  precioMoto: number;
  enganche: number;
  plazoMeses: number;
  ingresoMensual: number;
  gastosMensuales: number;
  antiguedadLaboralMeses: number;
  montoDeudas: number;
  buroNivel: 'excelente' | 'bueno' | 'regular' | 'malo' | 'sin_historial';
};

function pmt(ratePerPeriod: number, nper: number, pv: number): number {
  if (ratePerPeriod === 0) return pv / nper;
  return (pv * ratePerPeriod * Math.pow(1 + ratePerPeriod, nper)) / (Math.pow(1 + ratePerPeriod, nper) - 1);
}

export function mergeLoongPolicy(overrides: Partial<LoongMotorCreditPolicy> | null | undefined): LoongMotorCreditPolicy {
  if (!overrides) return { ...DEFAULT_LOONG_MOTOR_POLICY };
  return {
    ...DEFAULT_LOONG_MOTOR_POLICY,
    ...overrides,
    scoreWeights: {
      ...DEFAULT_LOONG_MOTOR_POLICY.scoreWeights,
      ...(overrides.scoreWeights || {}),
    },
  };
}

/** Encadenamiento plataforma → global → organización → perfil (sin mutar defaults de código). */
export function mergeLoongPolicyOnto(
  base: LoongMotorCreditPolicy,
  partial: Partial<LoongMotorCreditPolicy> | null | undefined
): LoongMotorCreditPolicy {
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    scoreWeights: {
      ...base.scoreWeights,
      ...(partial.scoreWeights || {}),
    },
  };
}

export function computeLoongPrecalScore(
  inputs: LoongPrecalInputs,
  policy: LoongMotorCreditPolicy
): {
  score: number;
  passed: boolean;
  estimatedPayment: number;
  amountFinanced: number;
  breakdown: Record<string, { pts: number; max: number; note: string }>;
  reasons: string[];
} {
  const reasons: string[] = [];
  const precio = Math.max(0, inputs.precioMoto);
  const enganche = Math.max(0, inputs.enganche);
  const amountFinanced = Math.max(0, precio - enganche);
  const plazo = Math.min(Math.max(1, inputs.plazoMeses), policy.maxTermMonths);
  const ingreso = Math.max(1, inputs.ingresoMensual);
  const gastos = Math.max(0, inputs.gastosMensuales);
  const deudas = Math.max(0, inputs.montoDeudas);
  const net = ingreso - gastos;

  const downPct = precio > 0 ? (enganche / precio) * 100 : 0;
  if (downPct < policy.minDownPaymentPct) {
    reasons.push(`Enganche ${downPct.toFixed(1)}% inferior al mínimo ${policy.minDownPaymentPct}%`);
  }

  const monthlyRate = policy.annualInterestPct / 100 / 12;
  const estimatedPayment = amountFinanced > 0 ? pmt(monthlyRate, plazo, amountFinanced) : 0;
  const loanToIncome = ingreso > 0 ? estimatedPayment / ingreso : 1;
  if (loanToIncome > policy.maxLoanToIncomeRatio) {
    reasons.push(
      `Cuota estimada / ingreso (${(loanToIncome * 100).toFixed(1)}%) supera política (${(policy.maxLoanToIncomeRatio * 100).toFixed(0)}%)`
    );
  }

  const debtToIncome = ingreso > 0 ? (deudas + estimatedPayment) / ingreso : 1;
  if (debtToIncome > policy.maxDebtToIncomeRatio) {
    reasons.push(`Carga financiera total elevada frente a ingreso`);
  }

  if (inputs.antiguedadLaboralMeses < policy.minJobMonths) {
    reasons.push(`Antigüedad laboral inferior a ${policy.minJobMonths} meses`);
  }

  // --- Subscores 0-100 each bucket, then weighted
  const capRaw =
    loanToIncome <= policy.maxLoanToIncomeRatio * 0.6
      ? 100
      : loanToIncome <= policy.maxLoanToIncomeRatio
        ? 70
        : loanToIncome <= policy.maxLoanToIncomeRatio * 1.15
          ? 40
          : 15;
  const netRatio = net / ingreso;
  const capAdjusted = capRaw * (netRatio >= 0.25 ? 1 : netRatio >= 0.1 ? 0.85 : 0.6);

  const ltv = precio > 0 ? amountFinanced / precio : 1;
  const levRaw =
    downPct >= policy.minDownPaymentPct + 10
      ? 100
      : downPct >= policy.minDownPaymentPct
        ? 75
        : 35;
  const levLtv = ltv <= 0.75 ? 1 : ltv <= 0.85 ? 0.85 : 0.55;
  const leverageScore = levRaw * levLtv;

  const behaviorMap: Record<LoongPrecalInputs['buroNivel'], number> = {
    excelente: 95,
    bueno: 78,
    regular: 55,
    malo: 25,
    sin_historial: 60,
  };
  const behaviorScore = behaviorMap[inputs.buroNivel] ?? 50;

  const w = policy.scoreWeights;
  const wSum = w.capacity + w.leverage + w.behavior || 1;
  const score = Math.round(
    (capAdjusted * w.capacity + leverageScore * w.leverage + behaviorScore * w.behavior) / wSum
  );

  const passed = score >= policy.minPassingScore && reasons.length === 0;

  return {
    score: Math.min(100, Math.max(0, score)),
    passed,
    estimatedPayment,
    amountFinanced,
    breakdown: {
      capacidad: { pts: Math.round(capAdjusted), max: 100, note: 'Cuota vs ingreso y capacidad de pago' },
      estructura: { pts: Math.round(leverageScore), max: 100, note: 'Enganche y financiamiento sobre valor moto' },
      historial: { pts: Math.round(behaviorScore), max: 100, note: 'Autorreporte buró (validar en fase 2)' },
    },
    reasons,
  };
}

export function parseLoongPolicyJson(raw: string): LoongMotorCreditPolicy | null {
  try {
    const j = JSON.parse(raw) as Partial<LoongMotorCreditPolicy>;
    return mergeLoongPolicy(j);
  } catch {
    return null;
  }
}

/** Calificación formal (enlace candidato): aplica umbral configurable en política (admin Loong / superadmin). */
export function evaluateFormalQual(
  result: ReturnType<typeof computeLoongPrecalScore>,
  policy: LoongMotorCreditPolicy
): { passed: boolean; minRequired: number } {
  const minRequired = policy.formalQualMinPassingScore ?? policy.minPassingScore;
  const passed = result.passed && result.score >= minRequired;
  return { passed, minRequired };
}
