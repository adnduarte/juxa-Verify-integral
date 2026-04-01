import React, { useMemo, useState } from 'react';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { UserPlus } from 'lucide-react';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import {
  computeLoongPrecalScore,
  type LoongMotorCreditPolicy,
  type LoongPrecalInputs,
} from '../../lib/loongMotorCredit';
import { stageLabelEs, type LoongOriginationCase, type LoongOriginationStage } from '../../lib/loongOrigination';
import { canStartLoongOriginationIntake } from '../../lib/productAccess';
import type { LoongOperationalRules } from '../../lib/loongOperationalRules';
import { MEXICO_ENTIDADES } from '../../lib/loongFintechIntake';
import { journeyPhaseFromOriginationStage, journeyPhaseTitleEs, type LoongClientJourneyPhase } from '../../lib/loongClientJourney';

export const LoongCrmProspectPanel: React.FC<{
  user: { uid: string; email: string | null } | null;
  cases: LoongOriginationCase[];
  loading: boolean;
  onRefresh: () => void;
  creditPolicy: LoongMotorCreditPolicy;
  opRules: LoongOperationalRules;
  logUserAction?: (userId: string, action: string, details?: any) => Promise<void>;
  /** Filtra la tabla “Últimos registros CRM” por fase de negocio. */
  journeyPhaseFilter?: LoongClientJourneyPhase | null;
}> = ({ user, cases, loading, onRefresh, creditPolicy, opRules, logUserAction, journeyPhaseFilter = null }) => {
  const {
    clientType,
    creditsBalance,
    organizationId,
    orgEnabledProducts,
    orgTrialEndsAt,
    userTrialEndsAt,
    userTrialProduct,
    maxFreeInvestigations,
  } = useAuthStatus();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [modelo, setModelo] = useState('');
  const [precio, setPrecio] = useState('45000');
  const [enganche, setEnganche] = useState('8000');
  const [plazo, setPlazo] = useState('24');
  const [ingreso, setIngreso] = useState('12000');
  const [gastos, setGastos] = useState('6500');
  const [antig, setAntig] = useState('12');
  const [deudas, setDeudas] = useState('0');
  const [entidad, setEntidad] = useState('');
  const [saving, setSaving] = useState(false);
  const [simResult, setSimResult] = useState<ReturnType<typeof computeLoongPrecalScore> | null>(null);

  const tableCases = useMemo(() => {
    if (journeyPhaseFilter == null) return cases;
    return cases.filter((c) => journeyPhaseFromOriginationStage(c.originationStage) === journeyPhaseFilter);
  }, [cases, journeyPhaseFilter]);

  const resolveOrgIdForWrite = async (): Promise<string | null> => {
    if (!user?.uid) return null;
    if (organizationId) return organizationId;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const d = snap.exists() ? snap.data() : null;
      const org = d && typeof (d as any).organizationId === 'string' ? String((d as any).organizationId) : '';
      const trimmed = org.trim();
      return trimmed ? trimmed : null;
    } catch {
      return null;
    }
  };

  const runPrecal = () => {
    const inputs: LoongPrecalInputs = {
      precioMoto: Number(precio) || 0,
      enganche: Number(enganche) || 0,
      plazoMeses: Number(plazo) || 24,
      ingresoMensual: Number(ingreso) || 1,
      gastosMensuales: Number(gastos) || 0,
      antiguedadLaboralMeses: Number(antig) || 0,
      montoDeudas: Number(deudas) || 0,
      buroNivel: 'sin_historial',
    };
    setSimResult(computeLoongPrecalScore(inputs, creditPolicy));
  };

  const createCase = async () => {
    if (!user?.uid || !name.trim() || !email.trim() || !phone.trim() || !entidad) return;
    const gate = canStartLoongOriginationIntake({
      clientType: clientType || 'GRATUITO',
      credits: creditsBalance,
      investigationsCount: 0,
      organizationId: organizationId ?? undefined,
      orgEnabledProducts,
      orgTrialEndsAt,
      userTrialEndsAt,
      userTrialProduct,
      maxFreeInvestigations,
    });
    if (!gate.ok) {
      alert(gate.reason || 'No puedes crear expedientes Loong con la configuración actual.');
      return;
    }
    setSaving(true);
    try {
      let vendedorDisplayName = '';
      try {
        const uSnap = await getDoc(doc(db, 'users', user.uid));
        if (uSnap.exists() && typeof uSnap.data().displayName === 'string') {
          vendedorDisplayName = uSnap.data().displayName.trim();
        }
      } catch {
        /* opcional */
      }
      const orgId = await resolveOrgIdForWrite();
      const inputs: LoongPrecalInputs = {
        precioMoto: Number(precio) || 0,
        enganche: Number(enganche) || 0,
        plazoMeses: Number(plazo) || 24,
        ingresoMensual: Number(ingreso) || 1,
        gastosMensuales: Number(gastos) || 0,
        antiguedadLaboralMeses: Number(antig) || 0,
        montoDeudas: Number(deudas) || 0,
        buroNivel: 'sin_historial',
      };
      const res = computeLoongPrecalScore(inputs, creditPolicy);
      const now = new Date().toISOString();
      const row: Record<string, unknown> = {
        vendedorUid: user.uid,
        vendedorEmail: user.email || '',
        ...(vendedorDisplayName ? { vendedorDisplayName } : {}),
        clientName: name.trim(),
        clientEmail: email.trim().toLowerCase(),
        clientPhone: phone.trim(),
        entidadFederativa: entidad,
        modeloMoto: modelo.trim(),
        originationStage: 'MESA_INTAKE' as LoongOriginationStage,
        precalInputs: inputs,
        precalScore: res.score,
        precalPassed: res.passed,
        precalEstimatedPayment: res.estimatedPayment,
        precalAmountFinanced: res.amountFinanced,
        createdAt: now,
        updatedAt: now,
        history: [{ at: now, byUid: user.uid, action: 'Alta CRM → mesa (precal sin buró en formulario)', note: res.passed ? 'Pasa motor' : 'Revisión' }],
        policySnapshot: {
          resolvedAt: now,
          creditPolicy,
          operationalRules: opRules,
          source: 'workspace_resolved',
        },
      };
      if (orgId) row.organizationId = orgId;
      await addDoc(collection(db, 'loong_origination_cases'), row);
      if (logUserAction) await logUserAction(user.uid, 'LOONG_CRM_CREATE', { email });
      setName('');
      setEmail('');
      setPhone('');
      setEntidad('');
      onRefresh();
    } catch (e) {
      const code = typeof (e as any)?.code === 'string' ? String((e as any).code) : '';
      if (code.includes('permission-denied')) {
        alert('No se pudo guardar: permisos u organización aún no disponible. Reintenta en unos segundos.');
      } else {
        alert('Error: ' + (e instanceof Error ? e.message : String(e)));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Alta rápida del prospecto: no consume solicitudes de crédito / investigaciones Juxa. El expediente queda a nombre de tu usuario y entra a mesa; tras aprobación, arraigo y calificación formal.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            Nuevo prospecto
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" placeholder="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" placeholder="Modelo moto" value={modelo} onChange={(e) => setModelo(e.target.value)} />
            <select className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm sm:col-span-2" value={entidad} onChange={(e) => setEntidad(e.target.value)}>
              <option value="">Entidad federativa (requerido)</option>
              {MEXICO_ENTIDADES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <h4 className="mb-2 mt-4 text-xs font-bold uppercase text-slate-400 dark:text-slate-500">Datos para precalificación</h4>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Precio" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={enganche} onChange={(e) => setEnganche(e.target.value)} placeholder="Enganche" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="Plazo meses" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={ingreso} onChange={(e) => setIngreso(e.target.value)} placeholder="Ingreso" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={gastos} onChange={(e) => setGastos(e.target.value)} placeholder="Gastos" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={antig} onChange={(e) => setAntig(e.target.value)} placeholder="Antigüedad meses" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={deudas} onChange={(e) => setDeudas(e.target.value)} placeholder="Deudas" />
            <p className="sm:col-span-3 text-xs text-slate-500 dark:text-slate-400">Buró no se captura en este formulario; el motor aplica perfil sin historial declarado.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={runPrecal} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80">
              Simular sin guardar
            </button>
            <button
              type="button"
              disabled={saving || !name.trim() || !email.trim() || !phone.trim() || !entidad}
              onClick={createCase}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar y enviar a mesa'}
            </button>
          </div>
          {simResult && (
            <div className={`mt-4 rounded-xl p-3 text-sm ${simResult.passed ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
              Score {simResult.passed ? 'aprobatorio' : 'revisión'}: <strong>{simResult.score}</strong> · Cuota ~ {simResult.estimatedPayment.toFixed(2)}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Reglas activas (resumen)</h3>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <li>Mesa: analista dedicado o supervisor si está permitido en políticas.</li>
            <li>Moratorio: {opRules.collection.graceDaysBeforeLateFee} días de gracia, {opRules.collection.lateFeePctOfInstallment}% sobre cuota.</li>
            <li>Plantillas de contrato y pagaré usan variables {'{{clienteNombre}}'}, {'{{montoFinanciado}}'}, etc.</li>
          </ul>
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">Edita políticas completas en la pestaña Políticas y reglas del panel.</p>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Últimos registros CRM</h3>
        {journeyPhaseFilter != null && (
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Filtro: <strong className="text-slate-700 dark:text-slate-300">{journeyPhaseTitleEs(journeyPhaseFilter)}</strong>{' '}
            ({tableCases.length} expediente{tableCases.length === 1 ? '' : 's'})
          </p>
        )}
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Etapa</th>
                </tr>
              </thead>
              <tbody>
                {tableCases.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No hay expedientes en esta fase.
                    </td>
                  </tr>
                ) : (
                  tableCases.slice(0, 20).map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{c.clientName}</td>
                      <td className="px-3 py-2">{c.precalScore ?? '—'}</td>
                      <td className="px-3 py-2">{stageLabelEs(c.originationStage)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
