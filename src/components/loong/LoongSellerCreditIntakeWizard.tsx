import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import {
  computeLoongPrecalScore,
  type LoongMotorCreditPolicy,
  type LoongPrecalInputs,
} from '../../lib/loongMotorCredit';
import type { LoongOriginationStage } from '../../lib/loongOrigination';
import { canStartLoongOriginationIntake } from '../../lib/productAccess';
import { useAuthStatus } from '../../contexts/AuthContext';
import {
  DEFAULT_LOONG_FINTECH_QUESTIONS,
  MEXICO_ENTIDADES,
  INCOME_PROOF_OPTIONS,
} from '../../lib/loongFintechIntake';
import { toast } from 'react-hot-toast';
import { ChevronRight, ChevronLeft, FileCheck } from 'lucide-react';
import { WorkflowStepper } from '../ui';
import { issueStandaloneLoongPrecalLink } from '../../lib/loongFlowRequests';
import type { LoongCatalogItem } from '../../lib/loongCatalog';

const WIZARD_STEPS = [
  { id: 'filtro', label: 'Filtro fintech' },
  { id: 'ine', label: 'INE y precal' },
  { id: 'ingresos', label: 'Comprobante ingresos' },
];

type Props = {
  creditPolicy: LoongMotorCreditPolicy;
  onComplete: () => void;
};

export const LoongSellerCreditIntakeWizard: React.FC<Props> = ({ creditPolicy, onComplete }) => {
  const {
    user,
    clientType,
    creditsBalance,
    organizationId,
    effectiveOrganizationId,
    orgEnabledProducts,
    orgTrialEndsAt,
    userTrialEndsAt,
    userTrialProduct,
    maxFreeInvestigations,
  } = useAuthStatus();

  const [vendedorDisplayName, setVendedorDisplayName] = useState('');
  const [vendorBranchNickname, setVendorBranchNickname] = useState('');
  const [vendorBranchAddress, setVendorBranchAddress] = useState('');
  const [vendorBranchEntity, setVendorBranchEntity] = useState('');
  const [savingVendorProfile, setSavingVendorProfile] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const d = snap.exists() ? snap.data() : null;
        const fromDoc = d && typeof d.displayName === 'string' ? d.displayName : '';
        setVendedorDisplayName((fromDoc || user.displayName || '').trim());
        setVendorBranchNickname(d && typeof d.branchNickname === 'string' ? d.branchNickname : '');
        setVendorBranchAddress(d && typeof d.branchAddress === 'string' ? d.branchAddress : '');
        setVendorBranchEntity(d && typeof d.branchEntity === 'string' ? d.branchEntity : '');
      } catch {
        setVendedorDisplayName((user.displayName || '').trim());
      }
    })();
  }, [user?.uid, user?.displayName]);

  const ensureVendorProfile = async () => {
    if (!user?.uid) return;
    const dn = vendedorDisplayName.trim();
    if (!dn) {
      toast.error('Indica tu nombre para trazabilidad.');
      return;
    }
    setSavingVendorProfile(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          displayName: dn,
          ...(vendorBranchNickname.trim() ? { branchNickname: vendorBranchNickname.trim() } : {}),
          ...(vendorBranchAddress.trim() ? { branchAddress: vendorBranchAddress.trim() } : {}),
          ...(vendorBranchEntity.trim() ? { branchEntity: vendorBranchEntity.trim() } : {}),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      toast.success('Datos guardados.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar tu perfil.');
    } finally {
      setSavingVendorProfile(false);
    }
  };

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [fintechAnswers, setFintechAnswers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEFAULT_LOONG_FINTECH_QUESTIONS.map((q) => [q.id, false]))
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [entidad, setEntidad] = useState('');
  const [modelo, setModelo] = useState('');
  const [precio, setPrecio] = useState('45000');
  const [enganche, setEnganche] = useState('8000');
  const [plazo, setPlazo] = useState('24');
  const [ingreso, setIngreso] = useState('12000');
  const [gastos, setGastos] = useState('6500');
  const [antig, setAntig] = useState('12');
  const [deudas, setDeudas] = useState('0');
  const [ineFront, setIneFront] = useState<File | null>(null);
  const [ineBack, setIneBack] = useState<File | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);

  const [incomeProof, setIncomeProof] = useState<string>(INCOME_PROOF_OPTIONS[0]);
  const [vendorNote, setVendorNote] = useState('');
  const [catalogItems, setCatalogItems] = useState<LoongCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogMode, setCatalogMode] = useState<'catalog' | 'manual'>('catalog');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');

  const fintechPassed = DEFAULT_LOONG_FINTECH_QUESTIONS.every((q) => fintechAnswers[q.id] === q.expectTrue);

  const resolveOrgIdForWrite = async (): Promise<string | null> => {
    if (!user?.uid) return null;
    if (effectiveOrganizationId) return effectiveOrganizationId;
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

  const catalogOrgId = effectiveOrganizationId || organizationId;

  useEffect(() => {
    if (!catalogOrgId) return;
    (async () => {
      setCatalogLoading(true);
      try {
        const q = query(collection(db, 'loong_catalog_items'), where('organizationId', '==', catalogOrgId));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as LoongCatalogItem[];
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setCatalogItems(list.filter((r) => r.active !== false));
      } catch (e) {
        console.error(e);
      } finally {
        setCatalogLoading(false);
      }
    })();
  }, [catalogOrgId]);

  const selectedCatalog = useMemo(
    () => catalogItems.find((c) => c.id === selectedCatalogId) || null,
    [catalogItems, selectedCatalogId]
  );

  useEffect(() => {
    if (catalogMode !== 'catalog') return;
    if (!selectedCatalog) return;
    setModelo((prev) => (prev.trim() ? prev : selectedCatalog.name));
    setPrecio(String(selectedCatalog.price || ''));
  }, [catalogMode, selectedCatalog]);

  const persistRejected = async (reason: string) => {
    if (!user?.uid) return;
    const now = new Date().toISOString();
    const orgId = await resolveOrgIdForWrite();
    await addDoc(collection(db, 'loong_origination_cases'), {
      vendedorUid: user.uid,
      vendedorEmail: user.email || '',
      ...(vendedorDisplayName ? { vendedorDisplayName } : {}),
      clientName: name.trim() || 'Prospecto sin nombre',
      clientEmail: (email.trim() || 'pendiente@local').toLowerCase(),
      clientPhone: phone.trim() || ' ',
      entidadFederativa: entidad || '',
      originationStage: 'RECHAZADO' as LoongOriginationStage,
      rejectionReason: reason,
      rejectedAt: now,
      availableForCrm: true,
      registeredInCrm: false,
      fintechFilterPassed: false,
      fintechFilterResponses: fintechAnswers,
      createdAt: now,
      updatedAt: now,
      ...(orgId ? { organizationId: orgId } : {}),
      policySnapshot: {
        resolvedAt: now,
        creditPolicy,
        source: 'intake_rejected',
      },
    });
  };

  const handleStep1Next = async () => {
    if (!fintechPassed) {
      if (!name.trim() || !email.trim() || !entidad) {
        toast.error('Para registrar el rechazo indica nombre, correo y entidad federativa.');
        return;
      }
      setSaving(true);
      try {
        await persistRejected('No superó el filtro fintech en captura.');
        toast.success('Registro guardado como rechazado (recuperable en CRM).');
        onComplete();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar.');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!name.trim() || !email.trim() || !phone.trim() || !entidad) {
      toast.error('Completa nombre, correo, teléfono y entidad federativa.');
      return;
    }
    if (!vendedorDisplayName.trim()) {
      toast.error('Antes de continuar, captura tu nombre (trazabilidad) y guárdalo.');
      return;
    }
    if (!shareUrl) {
      const ok = window.confirm(
        'Aún no generas el enlace para el candidato.\n\nRecomendado: generar y compartir el enlace (WhatsApp) para que el candidato complete el precalificador.\n\n¿Deseas continuar de todos modos (sin enlace)?'
      );
      if (!ok) return;
    }
    setStep(2);
  };

  const buildCandidateWhatsAppMessage = (url: string) => {
    const nm = name.trim() || 'tu solicitud';
    const model = (modelo.trim() || selectedCatalog?.name || '').trim();
    const price = Number(precio) || selectedCatalog?.price || 0;
    const priceLine = price > 0 ? `\n- Precio referencia: $${Number(price).toLocaleString('es-MX')}` : '';
    const modelLine = model ? `\n- Modelo: ${model}` : '';
    return (
      `Hola ${nm}.\n` +
      `Para continuar con la precalificación de crédito moto, llena este formulario desde tu celular:\n\n` +
      `${url}\n\n` +
      `Importante:\n- Es un cuestionario (sin INE ni fotos todavía).\n- Tarda ~3-5 minutos.${modelLine}${priceLine}\n\n` +
      `Si tienes dudas, respóndeme por aquí.`
    );
  };

  const openWhatsApp = (url: string) => {
    const text = buildCandidateWhatsAppMessage(url);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareCandidateLink = async () => {
    if (!user?.uid) return;
    if (!fintechPassed) {
      toast.error('Primero completa el filtro fintech en “Sí/No”.');
      return;
    }
    if (!name.trim() || !email.trim() || !phone.trim() || !entidad) {
      toast.error('Completa nombre, correo, teléfono y entidad federativa antes de compartir.');
      return;
    }
    setShareBusy(true);
    try {
      const prefillModeloMoto = modelo.trim() || selectedCatalog?.name || '';
      const prefillPrecioMoto = Number(precio) || selectedCatalog?.price || 0;
      const { url } = await issueStandaloneLoongPrecalLink(db, {
        title: `Precalificación Loong · ${name.trim()}`,
        testMode: false,
        clientIdForInv: user.uid,
        organizationId: effectiveOrganizationId,
        requestedByUidForAudit: user.uid,
        candidateEmail: email.trim(),
        candidatePhone: phone.trim(),
        prefill: {
          ...(prefillModeloMoto ? { modeloMoto: prefillModeloMoto } : {}),
          ...(prefillPrecioMoto > 0 ? { precioMoto: prefillPrecioMoto } : {}),
        },
      });
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Enlace copiado. Compártelo al candidato.');
      } catch {
        toast.success('Enlace listo.');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el enlace.');
    } finally {
      setShareBusy(false);
    }
  };

  const handleStep2Next = async () => {
    if (!user?.uid) return;
    if (!ineFront || !ineBack) {
      toast.error('Sube ambas caras de la identificación oficial.');
      return;
    }
    const gate = canStartLoongOriginationIntake({
      clientType: clientType || 'GRATUITO',
      credits: creditsBalance,
      investigationsCount: 0,
      organizationId: effectiveOrganizationId ?? organizationId,
      orgEnabledProducts,
      orgTrialEndsAt,
      userTrialEndsAt,
      userTrialProduct,
      maxFreeInvestigations,
    });
    if (!gate.ok) {
      toast.error(gate.reason || 'No puedes iniciar un expediente Loong.');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
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

      const docRef = await addDoc(collection(db, 'loong_origination_cases'), {
        vendedorUid: user.uid,
        vendedorEmail: user.email || '',
        ...(vendedorDisplayName ? { vendedorDisplayName } : {}),
        ...(vendorBranchNickname.trim() ? { vendedorBranchNickname: vendorBranchNickname.trim() } : {}),
        ...(vendorBranchAddress.trim() ? { vendedorBranchAddress: vendorBranchAddress.trim() } : {}),
        ...(vendorBranchEntity.trim() ? { vendedorBranchEntity: vendorBranchEntity.trim() } : {}),
        clientName: name.trim(),
        clientEmail: email.trim().toLowerCase(),
        clientPhone: phone.trim(),
        entidadFederativa: entidad,
        modeloMoto: modelo.trim(),
        originationStage: 'BORRADOR' as LoongOriginationStage,
        fintechFilterPassed: true,
        fintechFilterResponses: fintechAnswers,
        precalInputs: inputs,
        precalScore: res.score,
        precalPassed: res.passed,
        precalEstimatedPayment: res.estimatedPayment,
        precalAmountFinanced: res.amountFinanced,
        createdAt: now,
        updatedAt: now,
        history: [
          {
            at: now,
            byUid: user.uid,
            action: 'Intake: expediente nuevo (sin investigación Juxa previa)',
            note: 'Documentos y precal sin buró en cuestionario',
          },
        ],
        ...(orgId ? { organizationId: orgId } : {}),
        policySnapshot: {
          resolvedAt: now,
          creditPolicy,
          source: 'intake_created',
        },
      });

      const id = docRef.id;
      setCaseId(id);

      const frontRef = ref(storage, `loong_intake/${user.uid}/${id}/ine_front`);
      const backRef = ref(storage, `loong_intake/${user.uid}/${id}/ine_back`);
      await uploadBytes(frontRef, ineFront);
      await uploadBytes(backRef, ineBack);
      const frontUrl = await getDownloadURL(frontRef);
      const backUrl = await getDownloadURL(backRef);

      await updateDoc(doc(db, 'loong_origination_cases', id), {
        ineFrontUrl: frontUrl,
        ineBackUrl: backUrl,
        updatedAt: new Date().toISOString(),
      });

      setStep(3);
    } catch (e) {
      console.error(e);
      const code = typeof (e as any)?.code === 'string' ? String((e as any).code) : '';
      if (code.includes('permission-denied')) {
        toast.error('No se pudo guardar: permisos u organización aún no disponible. Reintenta en unos segundos.');
      } else {
        toast.error(e instanceof Error ? e.message : 'Error al guardar documentos.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStep3Submit = async () => {
    if (!user?.uid || !caseId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'loong_origination_cases', caseId), {
        incomeProofType: incomeProof,
        incomeProofVendorNote: vendorNote.trim(),
        originationStage: 'MESA_INTAKE' as LoongOriginationStage,
        updatedAt: now,
        history: arrayUnion({
          at: now,
          byUid: user.uid,
          action: 'Enviado a mesa de control',
          note: incomeProof,
        }),
      });
      toast.success('Solicitud enviada a mesa de control.');
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <FileCheck className="h-6 w-6 text-emerald-600" />
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nueva solicitud (crédito moto)</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Se crea un expediente de originación con tu usuario; no requiere una solicitud de crédito ni investigación Juxa previa. Luego: fintech, INE y mesa.
          </p>
        </div>
      </div>
      {user?.email ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-slate-100">Registrado como:</span>{' '}
          {vendedorDisplayName ? `${vendedorDisplayName} · ` : ''}
          {user.email}
        </div>
      ) : null}

      <div className="mb-5 rounded-xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/50">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Datos del vendedor (trazabilidad)</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nombre vendedor</label>
            <input
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              placeholder="Ej. Juan Pérez"
              value={vendedorDisplayName}
              onChange={(e) => setVendedorDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Sobrenombre sucursal</label>
            <input
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              placeholder="Ej. Matriz / Centro / Norte"
              value={vendorBranchNickname}
              onChange={(e) => setVendorBranchNickname(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Domicilio sucursal</label>
            <input
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              placeholder="Calle, número, colonia, CP"
              value={vendorBranchAddress}
              onChange={(e) => setVendorBranchAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Entidad (sucursal)</label>
            <select
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={vendorBranchEntity}
              onChange={(e) => setVendorBranchEntity(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {MEXICO_ENTIDADES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={ensureVendorProfile}
              disabled={savingVendorProfile}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              {savingVendorProfile ? 'Guardando…' : 'Guardar datos'}
            </button>
          </div>
        </div>
      </div>

      <WorkflowStepper steps={WIZARD_STEPS} currentIndex={step - 1} />

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Esta es la <strong>primera parte del cuestionario</strong>. Confirma cada punto con el prospecto. Si no cumple, se guardará como rechazado para CRM.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" placeholder="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <select className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" value={entidad} onChange={(e) => setEntidad(e.target.value)}>
              <option value="">Entidad federativa</option>
              {MEXICO_ENTIDADES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            {DEFAULT_LOONG_FINTECH_QUESTIONS.map((q) => (
              <label key={q.id} className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!fintechAnswers[q.id]}
                  onChange={(e) => setFintechAnswers((prev) => ({ ...prev, [q.id]: e.target.checked }))}
                />
                <span>{q.label}</span>
              </label>
            ))}
          </div>
          {organizationId ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  <strong>Precio:</strong> selecciona del catálogo o captura manual (se usará para precargar el enlace al candidato).
                </p>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setCatalogMode('catalog')}
                    className={`rounded-md px-2 py-1 ${catalogMode === 'catalog' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}
                  >
                    Catálogo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogMode('manual')}
                    className={`rounded-md px-2 py-1 ${catalogMode === 'manual' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}
                  >
                    Manual
                  </button>
                </div>
              </div>
              {catalogMode === 'catalog' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                    value={selectedCatalogId}
                    onChange={(e) => setSelectedCatalogId(e.target.value)}
                    disabled={catalogLoading}
                  >
                    <option value="">{catalogLoading ? 'Cargando catálogo…' : 'Elegir modelo del catálogo'}</option>
                    {catalogItems.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · ${Number(c.price || 0).toLocaleString('es-MX')}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                    placeholder="Modelo (opcional)"
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                  />
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                    placeholder="Modelo moto"
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                    placeholder="Precio lista"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={shareBusy}
                  onClick={() => void handleShareCandidateLink()}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {shareBusy ? 'Generando…' : 'Compartir enlace al candidato'}
                </button>
                {shareUrl ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openWhatsApp(shareUrl)}
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Enviar por WhatsApp
                    </button>
                    <a href={shareUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-slate-700 dark:text-slate-200 hover:underline">
                      Abrir enlace
                    </a>
                  </div>
                ) : null}
              </div>
              {shareUrl ? (
                <input
                  readOnly
                  value={shareUrl}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono"
                />
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleStep1Next}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {fintechPassed ? 'Continuar' : 'Registrar rechazo'} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Identificación oficial y datos de precalificación (sin buró en formulario; se usa sin historial para el motor).</p>
          <input className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" placeholder="Modelo moto" value={modelo} onChange={(e) => setModelo(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Precio" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={enganche} onChange={(e) => setEnganche(e.target.value)} placeholder="Enganche" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="Plazo meses" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={ingreso} onChange={(e) => setIngreso(e.target.value)} placeholder="Ingreso" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={gastos} onChange={(e) => setGastos(e.target.value)} placeholder="Gastos" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={antig} onChange={(e) => setAntig(e.target.value)} placeholder="Antigüedad meses" />
            <input className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm" value={deudas} onChange={(e) => setDeudas(e.target.value)} placeholder="Deudas" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              INE frente
              <input type="file" accept="image/*,.pdf" className="mt-1 block w-full text-sm" onChange={(e) => setIneFront(e.target.files?.[0] ?? null)} />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-300">
              INE reverso
              <input type="file" accept="image/*,.pdf" className="mt-1 block w-full text-sm" onChange={(e) => setIneBack(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="flex justify-between gap-2">
            <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm">
              <ChevronLeft className="h-4 w-4" /> Atrás
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleStep2Next}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Subiendo…' : 'Continuar'} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Manera de acreditar ingresos y nota para mesa de control.</p>
          <select className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" value={incomeProof} onChange={(e) => setIncomeProof(e.target.value)}>
            {INCOME_PROOF_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <textarea
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            rows={3}
            placeholder="Comentarios para mesa (opcional)"
            value={vendorNote}
            onChange={(e) => setVendorNote(e.target.value)}
          />
          <div className="flex justify-between gap-2">
            <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm">
              <ChevronLeft className="h-4 w-4" /> Atrás
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleStep3Submit}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Enviando…' : 'Enviar a mesa'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
