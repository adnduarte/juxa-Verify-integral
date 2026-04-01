import React, { useMemo } from 'react';
import {
  Brain,
  ClipboardCheck,
  Gavel,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AIResultRenderer } from './AIResultRenderer';
import { JuxaVerifyLoader } from './JuxaVerifyLoader';
import { parseMesaAutoReasons } from '../lib/mesaCreditDictamen';

function parseCandidateData(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function investigationShowsStage1Qualification(inv: {
  investigationType?: string;
  clientProfile?: string;
  loongMotorPolicyApplies?: boolean;
}): boolean {
  return (
    inv?.investigationType === 'CREDIT' ||
    inv?.clientProfile === 'CREDIT' ||
    inv?.clientProfile === 'LOONG_MOTOR' ||
    inv?.loongMotorPolicyApplies === true
  );
}

function StepBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
        active
          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
      }`}
    >
      {n}
    </span>
  );
}

export const InvestigationStage1QualificationPanel: React.FC<{
  inv: Record<string, unknown>;
  onGenerateDictamen: () => void;
  isGenerating: boolean;
}> = ({ inv, onGenerateDictamen, isGenerating }) => {
  const [openBreakdown, setOpenBreakdown] = React.useState(false);
  const data = useMemo(() => parseCandidateData(inv.candidateData), [inv.candidateData]);
  const hasLoongPrecal = Boolean(data?.loongPrecal);
  const hasFormalQual = Boolean(data?.loongFormalQual);
  const scope = String(inv.investigationScope || '');
  const mesaStatus = String(inv.mesaPrecalStatus || '');
  const reasons = parseMesaAutoReasons(
    typeof inv.mesaPrecalAutoReasons === 'string' ? inv.mesaPrecalAutoReasons : undefined
  );

  const score = typeof inv.score === 'number' ? inv.score : data && typeof data.score === 'number' ? data.score : null;
  const passedPrecal =
    typeof inv.mesaPrecalAutoPassed === 'boolean'
      ? inv.mesaPrecalAutoPassed
      : data && typeof data.passed === 'boolean'
        ? data.passed
        : null;

  const formalPassed =
    data && typeof data.formalPassed === 'boolean' ? data.formalPassed : null;
  const formalMin =
    data && typeof data.formalMinRequired === 'number' ? data.formalMinRequired : null;

  const mesaAutoText =
    typeof inv.mesaAutomatedDictamen === 'string' && inv.mesaAutomatedDictamen.trim()
      ? inv.mesaAutomatedDictamen.trim()
      : null;
  const mesaNote = typeof inv.mesaPrecalNote === 'string' ? inv.mesaPrecalNote.trim() : '';
  const mesaDecision = typeof inv.mesaPrecalDecision === 'string' ? inv.mesaPrecalDecision : '';
  const mesaDecidedAt = inv.mesaPrecalDecidedAt ? String(inv.mesaPrecalDecidedAt) : '';

  const dictamenIa =
    inv.socioeconomicDictamen || inv.creditAnalysisResult
      ? String(inv.creditAnalysisResult || inv.socioeconomicDictamen)
      : null;

  const breakdownStr = useMemo(() => {
    const b = data?.breakdown ?? inv.scoreBreakdown;
    if (b == null) return null;
    if (typeof b === 'string') return b;
    try {
      return JSON.stringify(b, null, 2);
    } catch {
      return null;
    }
  }, [data, inv.scoreBreakdown]);

  const showMesaUrgent = mesaStatus === 'pending' && (hasLoongPrecal || scope === 'BASIC');

  const card = 'rounded-2xl border p-4 shadow-sm';
  const cardTitle = 'text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3 dark:border-slate-700 dark:from-slate-950 dark:to-slate-900">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" aria-hidden />
            Etapa 1 · Precalificación, calificación formal y dictamen
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-xl">
            Orden operativo: resultado de precalificación → calificación final (cuando aplique) → dictamen de mesa / IA.
            Prioriza revisar la cola de mesa si el expediente está pendiente de resolución.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerateDictamen}
          disabled={isGenerating}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-purple-700 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generando…
            </>
          ) : (
            <>
              <Brain className="h-4 w-4" />
              Generar dictamen IA
            </>
          )}
        </button>
      </div>

      {showMesaUrgent ? (
        <div className="flex gap-3 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div>
            <p className="font-bold">Urgente: pendiente de mesa de control</p>
            <p className="mt-1 text-xs opacity-90">
              La precalificación del candidato ya está registrada. Falta dictaminar en mesa para liberar la siguiente
              etapa.
            </p>
          </div>
        </div>
      ) : null}

      {isGenerating ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <JuxaVerifyLoader text="Generando dictamen con IA…" />
        </div>
      ) : null}

      {/* ① Precalificación */}
      <div className={`${card} border-emerald-200/90 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20`}>
        <div className="flex items-start gap-3">
          <StepBadge n={1} active />
          <div className="min-w-0 flex-1">
            <h4 className={cardTitle + ' text-emerald-900 dark:text-emerald-200'}>
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              Precalificación (cuestionario / motor de referencia)
            </h4>

            {hasLoongPrecal ? (
              <div className="space-y-3 text-sm text-slate-800 dark:text-slate-200">
                <div className="flex flex-wrap gap-2">
                  {score != null ? (
                    <span className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-bold shadow-sm dark:bg-slate-900/80">
                      Score referencia: <strong className="text-emerald-700 dark:text-emerald-300">{score}</strong>
                    </span>
                  ) : null}
                  {passedPrecal != null ? (
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                        passedPrecal
                          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100'
                          : 'bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100'
                      }`}
                    >
                      Motor: {passedPrecal ? 'Referencia favorable' : 'Requiere criterio de mesa'}
                    </span>
                  ) : null}
                </div>
                {typeof data?.modeloMoto === 'string' && data.modeloMoto ? (
                  <p>
                    <strong>Modelo:</strong> {data.modeloMoto}
                  </p>
                ) : null}
                {data?.precioMoto != null ? (
                  <p>
                    <strong>Precio moto:</strong> ${Number(data.precioMoto).toLocaleString('es-MX')}
                  </p>
                ) : null}
                {data?.enganche != null ? (
                  <p>
                    <strong>Enganche:</strong> ${Number(data.enganche).toLocaleString('es-MX')}
                  </p>
                ) : null}
                {data?.plazoMeses != null ? (
                  <p>
                    <strong>Plazo:</strong> {String(data.plazoMeses)} meses
                  </p>
                ) : null}
                {reasons.length > 0 ? (
                  <div>
                    <p className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">Motivos motor</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-slate-700 dark:text-slate-300">
                      {reasons.slice(0, 12).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {breakdownStr ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setOpenBreakdown((o) => !o)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
                    >
                      {openBreakdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Desglose de puntos
                    </button>
                    {openBreakdown ? (
                      <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-emerald-200/60 bg-white/80 p-2 text-[10px] dark:border-emerald-900/40 dark:bg-slate-950">
                        {breakdownStr}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
                {data?.submittedAt ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enviado: {new Date(String(data.submittedAt)).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ) : data?.preQualQuestions && typeof data.preQualQuestions === 'object' ? (
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {(() => {
                  const pq = data.preQualQuestions as Record<string, unknown>;
                  return (
                    <>
                      <p>
                        <strong>Monto solicitado:</strong> ${String(pq.montoSolicitado ?? '')}
                      </p>
                      <p>
                        <strong>Ingresos mensuales:</strong> ${String(pq.ingresosMensuales ?? '')}
                      </p>
                      <p>
                        <strong>Gastos mensuales:</strong> ${String(pq.gastosMensuales ?? '')}
                      </p>
                      <p>
                        <strong>Deudas:</strong>{' '}
                        {pq.tieneDeudas === 'si' ? `Sí ($${pq.montoDeudas})` : 'No'}
                      </p>
                      <p>
                        <strong>Antigüedad laboral:</strong> {String(pq.antiguedadLaboral)} años
                      </p>
                      <p>
                        <strong>Contrato:</strong> {String(pq.tipoContrato)}
                      </p>
                      <p>
                        <strong>Vivienda:</strong> {String(pq.propiedadVivienda)}
                      </p>
                      <p>
                        <strong>Buró declarado:</strong> {String(pq.buroCredito)}
                      </p>
                    </>
                  );
                })()}
              </div>
            ) : score != null || passedPrecal != null ? (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Datos de cuestionario parciales en expediente.
                {score != null ? ` Score referencia: ${score}.` : ''}
                {passedPrecal != null
                  ? ` Referencia motor: ${passedPrecal ? 'favorable' : 'no favorable'}.`
                  : ''}
              </p>
            ) : (
              <p className="text-sm italic text-slate-500 dark:text-slate-400">
                Aún no hay precalificación registrada. Comparte el enlace al candidato para que complete el
                cuestionario.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ② Calificación formal */}
      <div className={`${card} border-violet-200/90 bg-violet-50/35 dark:border-violet-900/45 dark:bg-violet-950/20`}>
        <div className="flex items-start gap-3">
          <StepBadge n={2} active={hasFormalQual} />
          <div className="min-w-0 flex-1">
            <h4 className={cardTitle + ' text-violet-900 dark:text-violet-200'}>
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              Calificación final (formal moto)
            </h4>
            {hasFormalQual ? (
              <div className="space-y-2 text-sm text-slate-800 dark:text-slate-200">
                {score != null ? (
                  <p>
                    <strong>Score evaluación:</strong> {score}
                    {formalMin != null ? (
                      <span className="text-slate-600 dark:text-slate-400">
                        {' '}
                        (mín. requerido {formalMin})
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {formalPassed != null ? (
                  <span
                    className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${
                      formalPassed
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                        : 'bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                    }`}
                  >
                    Calificación formal: {formalPassed ? 'Aprobada' : 'No aprobada'}
                  </span>
                ) : null}
                {data?.submittedAt ? (
                  <p className="text-xs text-slate-500">
                    Enviado: {new Date(String(data.submittedAt)).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ) : scope === 'LOONG_FORMAL_QUAL' ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Pendiente: el candidato debe completar el formulario de <strong>calificación formal</strong> con el
                enlace que le compartiste.
              </p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                En la <strong>primera etapa</strong> de originación moto solo aplica precalificación y dictamen de mesa.
                La calificación formal se habilita cuando mesa autorice y se genere el enlace correspondiente.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ③ Dictamen final */}
      <div className={`${card} border-slate-300/80 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/50`}>
        <div className="flex items-start gap-3">
          <StepBadge n={3} active={Boolean(mesaAutoText || mesaDecision || dictamenIa)} />
          <div className="min-w-0 flex-1">
            <h4 className={cardTitle + ' text-slate-800 dark:text-slate-200'}>
              <Gavel className="h-4 w-4" aria-hidden />
              Dictamen final (mesa + IA documental)
            </h4>

            {mesaAutoText ? (
              <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Resumen automático (mesa / motor)
                </p>
                <p className="mt-1 whitespace-pre-wrap">{mesaAutoText}</p>
              </div>
            ) : null}

            {mesaStatus && mesaStatus !== '' ? (
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-slate-200 px-2 py-1 font-semibold dark:bg-slate-800">
                  Mesa: {mesaStatus}
                </span>
                {mesaDecision ? (
                  <span className="rounded-md bg-slate-200 px-2 py-1 font-semibold dark:bg-slate-800">
                    Decisión: {mesaDecision}
                  </span>
                ) : null}
                {mesaDecidedAt ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    {new Date(mesaDecidedAt).toLocaleString()}
                  </span>
                ) : null}
              </div>
            ) : null}

            {mesaNote ? (
              <div className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
                <p className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200">Nota de mesa</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-200">{mesaNote}</p>
              </div>
            ) : null}

            {dictamenIa ? (
              <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/25">
                <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">
                  Dictamen complementario (IA · evidencia / antecedentes)
                </p>
                <div className="mt-2 text-sm">
                  <AIResultRenderer resultString={dictamenIa} />
                </div>
              </div>
            ) : !mesaAutoText && !mesaNote ? (
              <p className="text-sm italic text-slate-500 dark:text-slate-400">
                Sin dictamen estructurado aún. Usa <strong>Generar dictamen IA</strong> cuando el candidato haya cargado
                evidencias o para un criterio orientativo con el antecedente del expediente.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
