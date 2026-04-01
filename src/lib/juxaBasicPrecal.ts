/**
 * Precalificación automática (referencia) para originación BASIC Juxa.
 * La decisión final la toma mesa de control; esto solo sugiere paso / rechazo automático.
 */

export type JuxaBasicPrecalResult = {
  autoPassed: boolean;
  reasons: string[];
  summaryLine: string;
};

export function evaluateJuxaBasicPrecal(input: {
  montoSolicitado: number;
  ingresosMensuales: number;
  gastosMensuales: number;
  tieneDeudas: string;
  montoDeudas: number;
}): JuxaBasicPrecalResult {
  const reasons: string[] = [];
  const monto = Number.isFinite(input.montoSolicitado) && input.montoSolicitado > 0 ? input.montoSolicitado : 0;
  const ing = Number.isFinite(input.ingresosMensuales) ? input.ingresosMensuales : 0;
  const gas = Number.isFinite(input.gastosMensuales) ? input.gastosMensuales : 0;
  const deudas = Number.isFinite(input.montoDeudas) ? input.montoDeudas : 0;

  if (ing <= 0) {
    reasons.push('No hay ingresos mensuales declarados en el cuestionario.');
  }
  if (monto <= 0) {
    reasons.push('Monto solicitado no válido.');
  }

  const disposable = ing - gas;
  if (disposable <= 0) {
    reasons.push('Los gastos declarados superan o igualan a los ingresos.');
  }

  const roughPayment = monto > 0 ? monto / 24 : 0;
  if (roughPayment > 0 && disposable < roughPayment * 0.9) {
    reasons.push(
      `Capacidad estimada ajustada: el pago aproximado (${Math.round(roughPayment)} MXN/mes) supera el margen disponible declarado (${Math.round(disposable)} MXN).`
    );
  }

  if (input.tieneDeudas === 'si' && deudas > ing * 6) {
    reasons.push('Deudas declaradas muy altas respecto al ingreso mensual.');
  }

  const autoPassed = reasons.length === 0;
  return {
    autoPassed,
    reasons: autoPassed ? ['Precalificación automática favorable (referencia).'] : reasons,
    summaryLine: autoPassed
      ? 'Sugerencia automática: favorable — pendiente validación mesa de control.'
      : `Sugerencia automática: no favorable — ${reasons[0]}`,
  };
}
