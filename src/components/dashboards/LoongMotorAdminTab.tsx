import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bike,
  Save,
  RefreshCw,
  ChevronRight,
  FileCheck,
  Unlock,
  Gavel,
  PenLine,
  Calculator,
  ClipboardList,
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import {
  DEFAULT_LOONG_MOTOR_POLICY,
  computeLoongPrecalScore,
  mergeLoongPolicy,
  parseLoongPolicyJson,
  type LoongPrecalInputs,
} from '../../lib/loongMotorCredit';
import {
  LOONG_MOTOR_POLICY_CLIENT_ID,
  PLATFORM_LOONG_POLICY_COLLECTION,
  PLATFORM_LOONG_POLICY_DOC_ID,
} from '../../lib/loongMotorPolicyFirestore';
import { DEFAULT_LOONG_ANALYSIS_NARRATIVE_MOTOS } from '../../lib/loongMotorAnalysisPrompt';
import { LOONG_PRE_REGISTER_PATH } from '../../config/loongLinks';
import {
  DEFAULT_LOONG_OPERATIONAL_RULES,
  mergeLoongOperationalRules,
  type LoongOperationalRules,
} from '../../lib/loongOperationalRules';
import { LoongOperationalCollectionEditor } from '../loong/LoongOperationalCollectionEditor';
import { LoongSuperadminFlowHub } from '../loong/LoongSuperadminFlowHub';
import { LoongMesaPrecalQueuePanel } from '../loong/LoongMesaPrecalQueuePanel';
import { LoongTeamUsersPanel } from '../loong/LoongTeamUsersPanel';
import { PercentSliderField } from '../ui';
import { DEFAULT_ORGANIZATION_ID_LOONG, normalizeOrganizationId } from '../../lib/organizations';

type Props = { isPlatformSuper?: boolean };

export const LoongMotorAdminTab: React.FC<Props> = ({ isPlatformSuper = false }) => {
  const { user, logUserAction, effectiveOrganizationId, organizationId } = useAuthStatus();
  const [policyJson, setPolicyJson] = useState(JSON.stringify(DEFAULT_LOONG_MOTOR_POLICY, null, 2));
  const [opRulesJson, setOpRulesJson] = useState(JSON.stringify(DEFAULT_LOONG_OPERATIONAL_RULES, null, 2));
  const [opRulesLive, setOpRulesLive] = useState<LoongOperationalRules>(mergeLoongOperationalRules(DEFAULT_LOONG_OPERATIONAL_RULES));
  const [policyMessage, setPolicyMessage] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [emissionId, setEmissionId] = useState<string | null>(null);
  const [contractUrl, setContractUrl] = useState('');
  const [pagareUrl, setPagareUrl] = useState('');
  const [emissionNotes, setEmissionNotes] = useState('');
  const [simPrecio, setSimPrecio] = useState('45000');
  const [simEnganche, setSimEnganche] = useState('8000');
  const [simPlazo, setSimPlazo] = useState('24');
  const [simIngreso, setSimIngreso] = useState('12000');
  const [simGastos, setSimGastos] = useState('6500');
  const [simAntig, setSimAntig] = useState('12');
  const [simDeudas, setSimDeudas] = useState('0');
  const [simBuro, setSimBuro] = useState<LoongPrecalInputs['buroNivel']>('bueno');
  const [simResult, setSimResult] = useState<ReturnType<typeof computeLoongPrecalScore> | null>(null);
  const [simError, setSimError] = useState('');

  const [platformCreditJson, setPlatformCreditJson] = useState('{}');
  const [platformOpJson, setPlatformOpJson] = useState('{}');
  const [platformNarrative, setPlatformNarrative] = useState(DEFAULT_LOONG_ANALYSIS_NARRATIVE_MOTOS);
  const [platformMsg, setPlatformMsg] = useState('');
  const [savingPlatform, setSavingPlatform] = useState(false);

  const loadPlatformPolicy = async () => {
    if (!isPlatformSuper) return;
    try {
      const snap = await getDoc(doc(db, PLATFORM_LOONG_POLICY_COLLECTION, PLATFORM_LOONG_POLICY_DOC_ID));
      if (!snap.exists()) {
        setPlatformCreditJson('{}');
        setPlatformOpJson('{}');
        setPlatformNarrative(DEFAULT_LOONG_ANALYSIS_NARRATIVE_MOTOS);
        return;
      }
      const d = snap.data();
      if (d.loongMotorCreditPolicy) setPlatformCreditJson(JSON.stringify(d.loongMotorCreditPolicy, null, 2));
      else setPlatformCreditJson('{}');
      if (d.loongOperationalRules) setPlatformOpJson(JSON.stringify(d.loongOperationalRules, null, 2));
      else setPlatformOpJson('{}');
      if (typeof d.loongAnalysisNarrativeMotos === 'string' && d.loongAnalysisNarrativeMotos.trim()) {
        setPlatformNarrative(d.loongAnalysisNarrativeMotos);
      } else {
        setPlatformNarrative(DEFAULT_LOONG_ANALYSIS_NARRATIVE_MOTOS);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const savePlatformPolicy = async () => {
    let creditPartial: Record<string, unknown> = {};
    let opPartial: Record<string, unknown> = {};
    try {
      creditPartial = JSON.parse(platformCreditJson || '{}') as Record<string, unknown>;
    } catch {
      setPlatformMsg('JSON de política numérica (plataforma) inválido.');
      return;
    }
    try {
      opPartial = JSON.parse(platformOpJson || '{}') as Record<string, unknown>;
    } catch {
      setPlatformMsg('JSON de reglas operativas (plataforma) inválido.');
      return;
    }
    setSavingPlatform(true);
    setPlatformMsg('');
    try {
      await setDoc(
        doc(db, PLATFORM_LOONG_POLICY_COLLECTION, PLATFORM_LOONG_POLICY_DOC_ID),
        {
          loongMotorCreditPolicy: creditPartial,
          loongOperationalRules: opPartial,
          loongAnalysisNarrativeMotos: platformNarrative.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setPlatformMsg('Plantilla plataforma guardada. Se aplica antes del documento global y del de cada organización.');
      if (logUserAction && user) logUserAction(user.uid, 'LOONG_PLATFORM_POLICY_SAVE', {});
    } catch (e) {
      setPlatformMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingPlatform(false);
    }
  };

  const loadPolicy = async () => {
    try {
      const snap = await getDoc(doc(db, 'clients', LOONG_MOTOR_POLICY_CLIENT_ID));
      if (snap.exists()) {
        const d = snap.data();
        if (d.loongMotorCreditPolicy) {
          setPolicyJson(JSON.stringify(d.loongMotorCreditPolicy, null, 2));
        }
        if (d.loongOperationalRules) {
          setOpRulesJson(JSON.stringify(mergeLoongOperationalRules(d.loongOperationalRules as Partial<LoongOperationalRules>), null, 2));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadInvestigations = async () => {
    setLoading(true);
    try {
      const orgKey =
        normalizeOrganizationId(effectiveOrganizationId ?? organizationId) ?? DEFAULT_ORGANIZATION_ID_LOONG;
      const q =
        isPlatformSuper || orgKey === DEFAULT_ORGANIZATION_ID_LOONG
          ? query(collection(db, 'investigations'), where('clientProfile', '==', 'LOONG_MOTOR'))
          : query(
              collection(db, 'investigations'),
              where('clientProfile', '==', 'LOONG_MOTOR'),
              where('organizationId', '==', orgKey)
            );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      setRows(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
    loadInvestigations();
    loadPlatformPolicy();
  }, [isPlatformSuper, effectiveOrganizationId, organizationId]);

  useEffect(() => {
    try {
      setOpRulesLive(mergeLoongOperationalRules(JSON.parse(opRulesJson) as Partial<LoongOperationalRules>));
    } catch {
      /* JSON incompleto al escribir */
    }
  }, [opRulesJson]);

  const savePolicy = async () => {
    const parsed = parseLoongPolicyJson(policyJson);
    if (!parsed) {
      setPolicyMessage('JSON de precalificación inválido.');
      return;
    }
    let mergedOp: LoongOperationalRules;
    try {
      mergedOp = mergeLoongOperationalRules(JSON.parse(opRulesJson) as Partial<LoongOperationalRules>);
    } catch {
      setPolicyMessage('JSON de reglas operativas (originación/cobranza) inválido.');
      return;
    }
    setSavingPolicy(true);
    setPolicyMessage('');
    try {
      const merged = mergeLoongPolicy(parsed);
      await setDoc(
        doc(db, 'clients', LOONG_MOTOR_POLICY_CLIENT_ID),
        {
          loongMotorCreditPolicy: merged,
          loongOperationalRules: mergedOp,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setPolicyMessage('Política y reglas operativas guardadas (precal, plantillas contrato/pagaré y cobranza).');
      if (logUserAction && user) logUserAction(user.uid, 'LOONG_POLICY_SAVE', {});
    } catch (e) {
      setPolicyMessage('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingPolicy(false);
    }
  };

  const findLinkForInv = async (investigationId: string) => {
    const q = query(collection(db, 'candidate_links'), where('investigationId', '==', investigationId));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0];
  };

  const enablePhase2 = async (inv: any) => {
    if (!confirm('¿Habilitar fase 2 (documentación, visita y arraigo) para esta solicitud?')) return;
    try {
      const linkSnap = await findLinkForInv(inv.id);
      await updateDoc(doc(db, 'investigations', inv.id), {
        loongPhase2Unlocked: true,
        investigationScope: 'INTEGRAL',
        creditStage: 'QUALIFICATION',
        status: 'IN_PROGRESS',
        updatedAt: new Date().toISOString(),
      });
      if (linkSnap) {
        await updateDoc(doc(db, 'candidate_links', linkSnap.id), {
          investigationScope: 'INTEGRAL',
          status: 'IN_PROGRESS',
          updatedAt: new Date().toISOString(),
        });
      }
      if (logUserAction && user) logUserAction(user.uid, 'LOONG_ENABLE_PHASE2', { investigationId: inv.id });
      await loadInvestigations();
    } catch (e) {
      alert('Error: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const authorizeCredit = async (inv: any) => {
    if (!confirm('¿Marcar crédito como autorizado (post-mesa)?')) return;
    try {
      await updateDoc(doc(db, 'investigations', inv.id), {
        creditStage: 'AUTHORIZED',
        updatedAt: new Date().toISOString(),
      });
      if (logUserAction && user) logUserAction(user.uid, 'LOONG_AUTHORIZE', { investigationId: inv.id });
      await loadInvestigations();
    } catch (e) {
      alert('Error: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const saveEmission = async () => {
    if (!emissionId) return;
    try {
      await updateDoc(doc(db, 'investigations', emissionId), {
        creditStage: 'EMISSION',
        contractDocumentUrl: contractUrl || null,
        pagareDocumentUrl: pagareUrl || null,
        emissionNotes: emissionNotes || null,
        updatedAt: new Date().toISOString(),
      });
      if (logUserAction && user) logUserAction(user.uid, 'LOONG_EMISSION', { investigationId: emissionId });
      setEmissionId(null);
      setContractUrl('');
      setPagareUrl('');
      setEmissionNotes('');
      await loadInvestigations();
    } catch (e) {
      alert('Error: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const stageLabel = (s: string | undefined) => {
    const map: Record<string, string> = {
      PRE_QUALIFICATION: 'Precalificación',
      QUALIFICATION: 'Expediente / visita',
      VISIT_PENDING: 'Visita en curso',
      MESA_CONTROL: 'Mesa de control',
      AUTHORIZED: 'Autorizado',
      EMISSION: 'Emisión (contrato)',
    };
    return s ? map[s] || s : '—';
  };

  return (
    <div className="space-y-8">
      <LoongSuperadminFlowHub />
      <LoongMesaPrecalQueuePanel />
      {isPlatformSuper && (
        <div className="rounded-2xl border border-violet-200/90 bg-violet-50/90 dark:border-violet-800/60 dark:bg-violet-950/40 p-6 shadow-sm ring-1 ring-violet-900/[0.04]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
              <Gavel className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Superadmin — estructura general Loong</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Capa plataforma: se fusiona antes de <code className="text-xs">clients/admin_simulator</code> y del documento de cada
                organización. Los admins siguen definiendo originación y cobranza en su tenant; los usuarios pueden añadir ajustes solo en su
                perfil (pestaña Configuración Loong).
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Narrativa IA — segmento motos</label>
              <textarea
                value={platformNarrative}
                onChange={(e) => setPlatformNarrative(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-slate-800 dark:text-slate-200"
                spellCheck
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Overrides numéricos (JSON parcial, opcional)
                </label>
                <textarea
                  value={platformCreditJson}
                  onChange={(e) => setPlatformCreditJson(e.target.value)}
                  rows={10}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80 p-3 font-mono text-xs"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Reglas operativas parciales (JSON, opcional)
                </label>
                <textarea
                  value={platformOpJson}
                  onChange={(e) => setPlatformOpJson(e.target.value)}
                  rows={10}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80 p-3 font-mono text-xs"
                  spellCheck={false}
                />
              </div>
            </div>
            {platformMsg && (
              <p
                className={`text-sm ${platformMsg.includes('Error') || platformMsg.includes('inválido') ? 'text-red-600' : 'text-emerald-600'}`}
              >
                {platformMsg}
              </p>
            )}
            <button
              type="button"
              onClick={savePlatformPolicy}
              disabled={savingPlatform}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingPlatform ? 'Guardando…' : 'Guardar plantilla plataforma'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3 shadow-sm">
        <p className="text-sm text-emerald-950">
          <strong>CRM originación</strong> vive en un módulo aparte: tabla global de expedientes y enlaces al flujo de concesionario.
        </p>
        <Link
          to="/admin/loong/crm"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          Abrir módulo CRM originación
        </Link>
      </div>
      <div className="space-y-4 rounded-2xl border border-amber-200/90 bg-amber-50/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2 text-sm text-amber-950">
            <p>
              <strong className="font-semibold">Equipo Loong</strong> — alta directa: tú defines correo y contraseña; el usuario entra por el
              acceso Loong. Misma pantalla que la pestaña Equipo del panel concesionario.
            </p>
          </div>
          <Link
            to={LOONG_PRE_REGISTER_PATH}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-600/40 bg-white/90 px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100/80"
          >
            <ClipboardList className="h-4 w-4" />
            Equipo (pantalla completa)
          </Link>
        </div>
        <LoongTeamUsersPanel organizationId={effectiveOrganizationId ?? organizationId} />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/[0.02]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-sm">
            <Bike className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Loong Motor — políticas de precalificación</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ajusta reglas y ponderaciones; el candidato en precalificación consume esta configuración en tiempo real.
            </p>
          </div>
        </div>
        <AdminPolicyQuickEditor policyJson={policyJson} onChangeJson={setPolicyJson} />
        <textarea
          value={policyJson}
          onChange={(e) => setPolicyJson(e.target.value)}
          rows={14}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80 p-4 font-mono text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-500/20"
          spellCheck={false}
        />
        {policyMessage && (
          <p
            className={`mt-3 text-sm ${policyMessage.includes('Error') || policyMessage.includes('inválido') ? 'text-red-600' : 'text-emerald-600'}`}
          >
            {policyMessage}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={savePolicy}
            disabled={savingPolicy}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {savingPolicy ? 'Guardando…' : 'Guardar política y reglas'}
          </button>
          <button
            type="button"
            onClick={() => setPolicyJson(JSON.stringify(DEFAULT_LOONG_MOTOR_POLICY, null, 2))}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
          >
            Restaurar precal por defecto
          </button>
        </div>
      </div>

      <LoongOperationalCollectionEditor
        value={opRulesLive.collection}
        onChange={(col) => {
          const next = mergeLoongOperationalRules({ ...opRulesLive, collection: col });
          setOpRulesLive(next);
          setOpRulesJson(JSON.stringify(next, null, 2));
        }}
      />

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/[0.02]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <FileCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reglas operativas completas (JSON)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Plantillas de contrato y pagaré, originación y cobranza. El bloque <code className="rounded bg-slate-100 dark:bg-slate-800 px-1">collection</code> se sincroniza con el editor de política de cobranza.
            </p>
          </div>
        </div>
        <textarea
          value={opRulesJson}
          onChange={(e) => setOpRulesJson(e.target.value)}
          rows={12}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80 p-4 font-mono text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => {
            setOpRulesJson(JSON.stringify(DEFAULT_LOONG_OPERATIONAL_RULES, null, 2));
            setOpRulesLive(mergeLoongOperationalRules(DEFAULT_LOONG_OPERATIONAL_RULES));
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
        >
          Restaurar reglas operativas por defecto
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/[0.02]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Simulador (política del editor)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Prueba el JSON de arriba sin guardar ni generar enlace; mismo motor que el candidato al enviar precalificación.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Precio moto', value: simPrecio, set: setSimPrecio, type: 'number' as const },
            { label: 'Enganche', value: simEnganche, set: setSimEnganche, type: 'number' as const },
            { label: 'Plazo (meses)', value: simPlazo, set: setSimPlazo, type: 'number' as const },
            { label: 'Ingreso mensual', value: simIngreso, set: setSimIngreso, type: 'number' as const },
            { label: 'Gastos mensuales', value: simGastos, set: setSimGastos, type: 'number' as const },
            { label: 'Antigüedad laboral (meses)', value: simAntig, set: setSimAntig, type: 'number' as const },
            { label: 'Monto deudas', value: simDeudas, set: setSimDeudas, type: 'number' as const },
          ].map((f) => (
            <div key={f.label}>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{f.label}</label>
              <input
                type={f.type}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-400"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
              />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Buró (autorreporte)</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-400"
              value={simBuro}
              onChange={(e) => setSimBuro(e.target.value as LoongPrecalInputs['buroNivel'])}
            >
              <option value="excelente">Excelente</option>
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="malo">Malo</option>
              <option value="sin_historial">Sin historial</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSimError('');
              setSimResult(null);
              const parsed = parseLoongPolicyJson(policyJson);
              if (!parsed) {
                setSimError('Corrige el JSON de la política antes de simular.');
                return;
              }
              const policy = mergeLoongPolicy(parsed);
              const inputs: LoongPrecalInputs = {
                precioMoto: Number(simPrecio) || 0,
                enganche: Number(simEnganche) || 0,
                plazoMeses: Number(simPlazo) || 1,
                ingresoMensual: Number(simIngreso) || 1,
                gastosMensuales: Number(simGastos) || 0,
                antiguedadLaboralMeses: Number(simAntig) || 0,
                montoDeudas: Number(simDeudas) || 0,
                buroNivel: simBuro,
              };
              setSimResult(computeLoongPrecalScore(inputs, policy));
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
          >
            <Calculator className="h-4 w-4" />
            Simular
          </button>
        </div>
        {simError && <p className="mt-3 text-sm text-red-600">{simError}</p>}
        {simResult && (
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  simResult.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {simResult.passed ? 'Pasa precalificación' : 'Requiere revisión'}
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">Score {simResult.score}</span>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                Cuota ~ ${simResult.estimatedPayment.toFixed(2)} · Financiado ${simResult.amountFinanced.toFixed(0)}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {Object.entries(simResult.breakdown).map(([k, row]) => (
                <div key={k} className="rounded-lg border border-white bg-white dark:bg-slate-900 px-3 py-2 text-xs">
                  <p className="font-semibold capitalize text-slate-800 dark:text-slate-200">{k}</p>
                  <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {row.pts} <span className="text-slate-500 dark:text-slate-400 font-normal">/ {row.max}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{row.note}</p>
                </div>
              ))}
            </div>
            {simResult.reasons.length > 0 && (
              <ul className="mt-3 list-inside list-disc text-sm text-red-700">
                {simResult.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-900/[0.02]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Pipeline crédito motos</h3>
          </div>
          <button
            type="button"
            onClick={loadInvestigations}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Como vendedor / admin (<code className="rounded bg-slate-100 dark:bg-slate-800 px-1">aduarte@juxa.mx</code>), habilita la fase 2 cuando la
          precalificación sea favorable; tras el dictamen de mesa, autoriza y registra contrato y pagaré.
        </p>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando solicitudes…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No hay solicitudes Loong Motor. Genera un enlace desde el simulador.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Solicitud</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3">Score precal.</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80/50 dark:bg-slate-950/50">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{inv.title || inv.id}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{stageLabel(inv.creditStage)}</td>
                    <td className="px-4 py-3">
                      {inv.score != null ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          {inv.score}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{inv.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {inv.investigationScope === 'LOONG_PRECAL' &&
                          inv.creditStage === 'PRE_QUALIFICATION' &&
                          !inv.loongPhase2Unlocked && (
                            <button
                              type="button"
                              onClick={() => enablePhase2(inv)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              <Unlock className="h-3 w-3" />
                              Fase 2
                            </button>
                          )}
                        {inv.creditStage === 'MESA_CONTROL' && (
                          <button
                            type="button"
                            onClick={() => authorizeCredit(inv)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            <Gavel className="h-3 w-3" />
                            Autorizar
                          </button>
                        )}
                        {inv.creditStage === 'AUTHORIZED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEmissionId(inv.id);
                              setContractUrl(inv.contractDocumentUrl || '');
                              setPagareUrl(inv.pagareDocumentUrl || '');
                              setEmissionNotes(inv.emissionNotes || '');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                          >
                            <PenLine className="h-3 w-3" />
                            Emisión
                          </button>
                        )}
                        <a
                          href={
                            inv.candidateLink
                              ? `${window.location.origin}/candidate/${inv.candidateLink}`
                              : '#'
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                          onClick={(e) => {
                            if (!inv.candidateLink) e.preventDefault();
                          }}
                        >
                          Enlace
                          <ChevronRight className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {emissionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Emisión — contrato y pagaré</h4>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Registra URLs o referencias de documentos firmados.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Contrato (URL o referencia)</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  value={contractUrl}
                  onChange={(e) => setContractUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Pagaré (URL o referencia)</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  value={pagareUrl}
                  onChange={(e) => setPagareUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Notas</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  rows={2}
                  value={emissionNotes}
                  onChange={(e) => setEmissionNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmissionId(null)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEmission}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Guardar emisión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminPolicyQuickEditor: React.FC<{
  policyJson: string;
  onChangeJson: (s: string) => void;
}> = ({ policyJson, onChangeJson }) => {
  let parsed: any = null;
  let ok = true;
  try {
    parsed = JSON.parse(policyJson || '{}');
  } catch {
    ok = false;
  }
  const effective = mergeLoongPolicy(parsed);
  const patch = (p: Partial<typeof effective>) => {
    let base: any = {};
    try {
      base = JSON.parse(policyJson || '{}');
    } catch {
      base = {};
    }
    onChangeJson(JSON.stringify({ ...base, ...p }, null, 2));
  };

  return (
    <div className="mb-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Editor rápido (porcentajes)</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Ajuste visual; actualiza el JSON.</p>
        </div>
        {!ok ? <span className="text-xs font-semibold text-red-600">JSON inválido</span> : null}
      </div>
      <div className={`mt-3 grid gap-4 md:grid-cols-2 ${!ok ? 'opacity-50 pointer-events-none' : ''}`}>
        <PercentSliderField
          label="Enganche mínimo"
          value={effective.minDownPaymentPct}
          onChange={(v) => patch({ minDownPaymentPct: Math.max(0, v || 0) } as any)}
          min={0}
          max={60}
          step={1}
          precision={0}
          disabled={!ok}
        />
        <PercentSliderField
          label="Tasa anual"
          value={effective.annualInterestPct}
          onChange={(v) => patch({ annualInterestPct: Math.max(0, v || 0) } as any)}
          min={0}
          max={120}
          step={0.5}
          precision={1}
          disabled={!ok}
        />
        <PercentSliderField
          label="Máx. cuota/ingreso"
          value={effective.maxLoanToIncomeRatio}
          onChange={(v) => patch({ maxLoanToIncomeRatio: Math.max(0, Math.min(1, v || 0)) } as any)}
          ratioValue
          min={5}
          max={90}
          step={1}
          precision={0}
          disabled={!ok}
        />
        <PercentSliderField
          label="Máx. (deudas+cuota)/ingreso"
          value={effective.maxDebtToIncomeRatio}
          onChange={(v) => patch({ maxDebtToIncomeRatio: Math.max(0, Math.min(1, v || 0)) } as any)}
          ratioValue
          min={5}
          max={95}
          step={1}
          precision={0}
          disabled={!ok}
        />
      </div>
    </div>
  );
};
