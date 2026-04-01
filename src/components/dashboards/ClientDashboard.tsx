import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Download, CheckCircle2, Clock, AlertCircle, X, Plus, Briefcase, Building2, Link as LinkIcon, Send, ShieldAlert, ExternalLink, Code, Bot, Trash2, Brain, MapPin, User, FileCheck, Image as ImageIcon, Calculator, ClipboardCheck, Search, Home, CreditCard, Settings, Zap, MessageCircle, LifeBuoy, Route, Circle, ChevronRight } from 'lucide-react';
import { db, auth, storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, setDoc, onSnapshot, query, where, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import DOMPurify from 'dompurify';
import { useAuthStatus } from '../../contexts/AuthContext';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';
import { AIResultRenderer } from '../AIResultRenderer';
import { JuxaVerifyLoader } from '../JuxaVerifyLoader';
import { JuxaVerifyChat } from '../JuxaVerifyChat';
import { LocationViewer } from '../LocationViewer';
import { CreditApplicationsModule } from './CreditApplicationsModule';
import { handleFirestoreError, OperationType } from '../../firebase';
import { analyzeCandidateData } from '../../lib/gemini';
import { buildLoongMotorOfficialAnalysisInjection } from '../../lib/loongMotorPolicyFirestore';
import { canUseProduct, gratuitousInvestigationCap } from '../../lib/productAccess';
import { DEFAULT_ORGANIZATION_ID_LOONG } from '../../lib/organizations';
import {
  CREDIT_TYPE_MOTORCYCLE,
  CREDIT_TYPE_PERSONAL,
  resolveRiskSegmentForTipo,
} from '../../lib/creditProductQuestionnaire';
import { isSuperAdminEmail } from '../../config/superadmins';
import { FEATURE_WORKSPACE_CHAT_TICKETS } from '../../config/features';
import {
  mesaPrecalFlowBadgeClass,
  mesaPrecalFlowLabel,
  mesaPrecalFlowState,
  type MesaPrecalInvInput,
} from '../../lib/mesaCreditDictamen';
import { buildOriginationTrajectorySteps } from '../../lib/loongInvestigationPipeline';
import toast from 'react-hot-toast';
import { LoongWorkspaceChatTab } from '../loong/LoongWorkspaceChatTab';
import { LoongSupportTicketsTab } from '../loong/LoongSupportTicketsTab';
import {
  InvestigationStage1QualificationPanel,
  investigationShowsStage1Qualification,
} from '../InvestigationStage1QualificationPanel';

function bypassInvestigationProductGates(email: string | null | undefined): boolean {
  if (!email) return false;
  if (email === 'contacto@inaeecij.com') return true;
  return isSuperAdminEmail(email);
}

/** Ordenar en cliente y evitar índice compuesto clientId+createdAt en Firestore. */
function investigationCreatedMs(createdAt: unknown): number {
  if (
    createdAt != null &&
    typeof createdAt === 'object' &&
    'toMillis' in createdAt &&
    typeof (createdAt as { toMillis: () => unknown }).toMillis === 'function'
  ) {
    const n = (createdAt as { toMillis: () => number }).toMillis();
    return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
  }
  if (typeof createdAt === 'string') {
    const t = Date.parse(createdAt);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

const FIRESTORE_REQUEST_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), FIRESTORE_REQUEST_TIMEOUT_MS);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function parseOptionalAmount(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function safeParseInvestigationCandidateData(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function investigationHasAnyAiSurface(inv: {
  identityValidationResult?: unknown;
  creditAnalysisResult?: unknown;
  providerAnalysisResult?: unknown;
  socioeconomicDictamen?: unknown;
}): boolean {
  return !!(
    inv.identityValidationResult ||
    inv.creditAnalysisResult ||
    inv.providerAnalysisResult ||
    inv.socioeconomicDictamen
  );
}

export const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'INVESTIGATIONS' | 'CREDIT_APPS' | 'chat' | 'tickets' | 'settings'>('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkflowChoiceOpen, setIsWorkflowChoiceOpen] = useState(false);
  const [isQuickCreditOpen, setIsQuickCreditOpen] = useState(false);
  const [quickCreditPersonName, setQuickCreditPersonName] = useState('');
  const [quickCreditAmount, setQuickCreditAmount] = useState('');
  const [quickCreditTipo, setQuickCreditTipo] = useState(CREDIT_TYPE_PERSONAL);
  /** Originación rápida Loong: precio de unidad vs monto a financiar indicado manualmente. */
  const [quickCreditLoongValorOrigen, setQuickCreditLoongValorOrigen] = useState<'precio_moto' | 'monto_manual'>(
    'precio_moto'
  );
  const [isQuickCreditSubmitting, setIsQuickCreditSubmitting] = useState(false);
  const [isPagareModalOpen, setIsPagareModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [pagaresCredits, setPagaresCredits] = useState<number | null>(null);
  const [clientType, setClientType] = useState<string | null>(null);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const {
    user,
    role,
    logUserAction,
    logout,
    clientProfile,
    organizationId,
    effectiveOrganizationId,
    orgEnabledProducts,
    orgTrialEndsAt,
    userTrialEndsAt,
    userTrialProduct,
    maxFreeInvestigations,
  } = useAuthStatus();
  
  // New state for dynamic forms
  const [investigationType, setInvestigationType] = useState<'HR' | 'CREDIT' | 'GENERAL'>('HR');
  const [isDirectInvestigation, setIsDirectInvestigation] = useState(false);
  const [investigationScope, setInvestigationScope] = useState<'SIMPLE' | 'INTEGRAL' | 'BASIC' | 'INTERMEDIATE' | 'ADVANCED'>('SIMPLE');
  const [selectedInvestigation, setSelectedInvestigation] = useState<any>(null);
  const [isDirectInputModalOpen, setIsDirectInputModalOpen] = useState(false);
  const [directInputInvestigation, setDirectInputInvestigation] = useState<any>(null);
  const [preQualQuestions, setPreQualQuestions] = useState({
    montoSolicitado: '',
    ingresosMensuales: '',
    gastosMensuales: '',
    tieneDeudas: 'no',
    montoDeudas: '',
    antiguedadLaboral: '',
    tipoContrato: 'Indefinido',
    propiedadVivienda: 'Propia',
    buroCredito: 'Excelente'
  });

  const sidebarItems = useMemo(() => {
    const all = [
      { id: 'overview', label: 'Inicio', icon: Home },
      { id: 'INVESTIGATIONS', label: 'Investigaciones', icon: Search },
      { id: 'CREDIT_APPS', label: 'Solicitudes de Crédito', icon: CreditCard },
      { id: 'chat', label: 'Chat', icon: MessageCircle },
      { id: 'tickets', label: 'Soporte / tickets', icon: LifeBuoy },
      { id: 'settings', label: 'Configuración', icon: Settings },
    ] as const;
    if (FEATURE_WORKSPACE_CHAT_TICKETS) return [...all];
    return all.filter((i) => i.id !== 'chat' && i.id !== 'tickets');
  }, []);

  useEffect(() => {
    if (!FEATURE_WORKSPACE_CHAT_TICKETS && (activeTab === 'chat' || activeTab === 'tickets')) {
      setActiveTab('overview');
    }
  }, [activeTab]);
  
  // HR specific fields
  const [jobProfile, setJobProfile] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  
  // Financial specific fields
  const [creditApp, setCreditApp] = useState<File | null>(null);
  const [visitAddress, setVisitAddress] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [montoCreditoCapital, setMontoCreditoCapital] = useState('');
  const [montoCreditoIntereses, setMontoCreditoIntereses] = useState('');
  const [plazoFinanciamiento, setPlazoFinanciamiento] = useState('');
  const [tipoCredito, setTipoCredito] = useState('Personal');

  // Provider specific fields
  const [providerReferences, setProviderReferences] = useState<File | null>(null);
  const [providerFiles, setProviderFiles] = useState<File | null>(null);

  // Candidate Link fields
  const generateLink = true;
  const [sendViaSystem, setSendViaSystem] = useState(false);
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');

  const productAccessCtx = useMemo(
    () => ({
      clientType: clientType || 'GRATUITO',
      credits: userCredits ?? 0,
      investigationsCount: investigations.length,
      organizationId: effectiveOrganizationId ?? organizationId,
      orgEnabledProducts,
      orgTrialEndsAt,
      userTrialEndsAt,
      userTrialProduct,
      maxFreeInvestigations,
    }),
    [
      clientType,
      userCredits,
      investigations.length,
      effectiveOrganizationId,
      organizationId,
      orgEnabledProducts,
      orgTrialEndsAt,
      userTrialEndsAt,
      userTrialProduct,
      maxFreeInvestigations,
    ]
  );

  /** RRHH y proveedores: solo investigación. El resto elige originación vs investigación. */
  const preferWorkflowChooser = clientProfile !== 'HR' && clientProfile !== 'PROVIDER';

  const canStartLoongOriginacion =
    clientProfile === 'LOONG_MOTOR' ||
    organizationId === DEFAULT_ORGANIZATION_ID_LOONG ||
    effectiveOrganizationId === DEFAULT_ORGANIZATION_ID_LOONG ||
    (orgEnabledProducts?.includes('LOONG_MOTOR') ?? false);

  const runInvestigationGateCheckForType = (type: 'HR' | 'CREDIT' | 'GENERAL'): boolean => {
    if (!bypassInvestigationProductGates(auth.currentUser?.email ?? null)) {
      const gate = canUseProduct(productAccessCtx, type);
      if (!gate.ok) {
        alert(gate.reason || 'No puedes crear más investigaciones con tu plan actual.');
        return false;
      }
    }
    return true;
  };

  const runInvestigationGateCheck = (): boolean => runInvestigationGateCheckForType(investigationType);

  /** Superadmin / cuenta ilimitada: va directo al formulario de investigación (ahorra un paso). */
  const skipWorkflowChooser =
    preferWorkflowChooser && bypassInvestigationProductGates(auth.currentUser?.email ?? null);

  const canQuickCreditLink = useMemo(() => {
    if (bypassInvestigationProductGates(user?.email ?? null)) return true;
    return canUseProduct(productAccessCtx, 'CREDIT').ok;
  }, [user?.email, productAccessCtx]);

  /** Loong: sin modal genérico RRHH/crédito — CRM (cliente existente o alta) o pestaña precal del vendedor. */
  const openLoongMotorInvestigationEntry = () => {
    if (!runInvestigationGateCheckForType('CREDIT')) return;
    if (role === 'CLIENTE') {
      setActiveTab('INVESTIGATIONS');
      toast.success('En esta vista usa «Originación crédito» o tu listado de expedientes. Mesa y admin gestionan clientes en el CRM Loong.');
      return;
    }
    navigate('/dashboard/loong/crm');
    toast.success('CRM Loong: elige un prospecto registrado o registra uno nuevo y arranca la investigación.');
  };

  const openClientWorkflowEntry = () => {
    if (canStartLoongOriginacion) {
      openLoongMotorInvestigationEntry();
      return;
    }
    if (!preferWorkflowChooser) {
      if (!runInvestigationGateCheck()) return;
      setIsModalOpen(true);
      return;
    }
    if (skipWorkflowChooser) {
      if (!runInvestigationGateCheck()) return;
      setIsModalOpen(true);
      return;
    }
    setIsWorkflowChoiceOpen(true);
  };

  const openQuickCreditModal = () => {
    if (!runInvestigationGateCheckForType('CREDIT')) return;
    setQuickCreditPersonName('');
    setQuickCreditAmount('');
    setQuickCreditTipo(canStartLoongOriginacion ? CREDIT_TYPE_MOTORCYCLE : CREDIT_TYPE_PERSONAL);
    setQuickCreditLoongValorOrigen('precio_moto');
    setIsQuickCreditOpen(true);
  };

  const submitQuickCreditLink = async () => {
    if (!auth.currentUser) return;
    const nombre = quickCreditPersonName.trim();
    const amountNorm = quickCreditAmount.trim().replace(/,/g, '');
    const monto = Number(amountNorm);

    if (!nombre || nombre.length < 3) {
      toast.error('Escribe el nombre completo del solicitante (mín. 3 caracteres).');
      return;
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('Indica la cantidad solicitada en pesos (número mayor a cero).');
      return;
    }

    if (!bypassInvestigationProductGates(auth.currentUser.email)) {
      const gate = canUseProduct(productAccessCtx, 'CREDIT');
      if (!gate.ok) {
        toast.error(gate.reason || 'No puedes crear esta investigación.');
        return;
      }
    }

    setIsQuickCreditSubmitting(true);
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const generateId = () =>
      Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

    try {
      const investigationId = generateId();
      const candidateLinkId = generateId();
      const antecedenteId = `ANT-${investigationId.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase()}`;
      const createdAt = new Date().toISOString();
      const amountLabel = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto);
      const tipoLinea = canStartLoongOriginacion
        ? CREDIT_TYPE_MOTORCYCLE
        : quickCreditTipo.trim() || CREDIT_TYPE_PERSONAL;
      const riskSeg = resolveRiskSegmentForTipo(tipoLinea, monto);
      const valorOrigenLabel =
        quickCreditLoongValorOrigen === 'precio_moto' ? 'Precio de la motocicleta (referencia)' : 'Monto a financiar (manual)';
      const detailsBlock = [
        '=== Antecedente de originación de crédito ===',
        `ID expediente: ${antecedenteId}`,
        `ID interno: ${investigationId}`,
        `Solicitante: ${nombre}`,
        `Tipo de crédito: ${tipoLinea}`,
        ...(canStartLoongOriginacion ? [`Origen del monto: ${valorOrigenLabel}`] : []),
        ...(riskSeg ? [`Segmento de riesgo (ad hoc): ${riskSeg}`] : []),
        `${canStartLoongOriginacion ? 'Monto registrado (MXN)' : 'Cantidad solicitada'}: ${amountLabel}`,
        `Registrado: ${createdAt}`,
        'Estado: pre-calificación (fase 1) — cuestionario del candidato.',
      ].join('\n');

      const investigationData: Record<string, unknown> = {
        id: investigationId,
        clientId: auth.currentUser.uid,
        requestedBy: auth.currentUser.uid,
        status: 'PENDING',
        title: nombre,
        details: detailsBlock,
        antecedenteId,
        clientProfile: 'CREDIT',
        investigationType: 'CREDIT',
        investigationScope: 'BASIC',
        isDirect: false,
        candidateLink: candidateLinkId,
        linkStatus: 'PENDING',
        visitAddress: '',
        contactInfo: '',
        tipoCredito: tipoLinea,
        montoCreditoCapital: monto,
        creditStage: 'PRE_QUALIFICATION',
        createdAt,
        updatedAt: createdAt,
      };
      if (riskSeg) investigationData.riskSegment = riskSeg;
      if (effectiveOrganizationId) investigationData.organizationId = effectiveOrganizationId;
      if (canStartLoongOriginacion) {
        investigationData.loongValorMontoOrigen = quickCreditLoongValorOrigen;
        investigationData.loongMotorPolicyApplies = true;
      }

      await setDoc(doc(db, 'investigations', investigationId), investigationData);

      const linkPayload: Record<string, unknown> = {
        linkId: candidateLinkId,
        investigationId,
        clientId: auth.currentUser.uid,
        clientProfile: 'CREDIT',
        investigationType: 'CREDIT',
        investigationScope: 'BASIC',
        title: nombre,
        antecedenteId,
        tipoCredito: tipoLinea,
        status: 'PENDING',
        createdAt,
        updatedAt: createdAt,
      };
      if (riskSeg) linkPayload.riskSegment = riskSeg;
      if (effectiveOrganizationId) linkPayload.organizationId = effectiveOrganizationId;
      if (canStartLoongOriginacion) {
        linkPayload.loongValorMontoOrigen = quickCreditLoongValorOrigen;
        linkPayload.loongMotorPolicyApplies = true;
      }

      await setDoc(doc(db, 'candidate_links', candidateLinkId), linkPayload);

      setInvestigations((prev) => {
        const row = { id: investigationId, ...investigationData };
        return [row, ...prev.filter((p) => p.id !== investigationId)];
      });

      if (!bypassInvestigationProductGates(auth.currentUser.email) && clientType === 'BOLSA' && userCredits !== null && userCredits > 0) {
        try {
          await updateDoc(userRef, {
            credits: userCredits - 1,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error('Credit deduction failed:', e);
        }
      }

      if (logUserAction && user) {
        logUserAction(user.uid, 'CLIENT_CREDIT_ORIGINATION_INTAKE', {
          investigationId,
          candidateLinkId,
          antecedenteId,
          title: nombre,
          montoCreditoCapital: monto,
        });
      }

      const url = `${window.location.origin}/candidate/${candidateLinkId}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* ignore */
      }

      toast.success(
        `Expediente ${antecedenteId} creado. Enlace copiado al portapapeles: compártelo con el candidato para que él abra el formulario (no uses este enlace desde tu sesión de vendedor).`,
        { duration: 7000 }
      );
      setIsQuickCreditOpen(false);
    } catch (err) {
      console.error('Quick credit origination error:', err);
      toast.error('No se pudo registrar la originación. Revisa permisos, reglas Firestore y conexión.');
    } finally {
      setIsQuickCreditSubmitting(false);
    }
  };

  const confirmInvestigationPath = () => {
    if (!runInvestigationGateCheck()) return;
    setIsWorkflowChoiceOpen(false);
    setIsModalOpen(true);
  };

  const goOriginacionPath = () => {
    setIsWorkflowChoiceOpen(false);
    if (canStartLoongOriginacion) {
      navigate('/dashboard/loong/crm');
    } else {
      setActiveTab('CREDIT_APPS');
    }
  };

  const handleDownloadPDF = async (inv: any) => {
    if (logUserAction && user) {
      logUserAction(user.uid, 'CLIENT_DOWNLOAD_DICTAMEN_PDF', { investigationId: inv.id });
    }

    // 1. SAFE PARSING OF AI CONTENT
    let dictamen: any = {};
    try {
      if (inv.socioeconomicDictamen) {
        const rawContent = typeof inv.socioeconomicDictamen === 'string' 
          ? inv.socioeconomicDictamen 
          : JSON.stringify(inv.socioeconomicDictamen);
        
        const cleanJson = rawContent
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        dictamen = JSON.parse(cleanJson);
      }
    } catch (e) {
      console.error("Error parsing dictamen:", e);
      dictamen = { error: "Contenido no disponible en formato estructurado" };
    }

    const veredicto = dictamen.dictamenFinal?.estado || (inv.status === 'COMPLETED' ? 'VIABLE' : 'PENDIENTE');
    const veredictoColor = veredicto === 'VIABLE' ? '#10b981' : veredicto === 'NO VIABLE' ? '#ef4444' : '#f59e0b';

    // 2. CREATE HIDDEN HTML TEMPLATE
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.padding = '40px';
    container.style.backgroundColor = '#ffffff';
    container.style.fontFamily = 'Helvetica, Arial, sans-serif';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.color = '#334155';
    document.body.appendChild(container);

    const candidateData = inv.candidateData ? JSON.parse(inv.candidateData) : {};
    const lat = candidateData.mapPosition?.lat || 0;
    const lng = candidateData.mapPosition?.lng || 0;
    const API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;
    
    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=600x300&markers=color:red%7C${lat},${lng}&key=${API_KEY}`;
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&fov=90&pitch=10&key=${API_KEY}`;

    const renderSection = (title: string, content: string) => `
      <div style="margin-bottom: 30px; page-break-inside: avoid;">
        <h2 style="color: #1E3A8A; font-size: 20px; margin-bottom: 10px; font-weight: bold;">${title}</h2>
        <hr style="border-top: 2px solid #E5E7EB; margin: 10px 0 20px 0;" />
        <div style="line-height: 1.6; font-size: 14px;">${content}</div>
      </div>
    `;

    const renderList = (items: any) => {
      if (!items) return '';
      if (typeof items === 'string') return `<p>${items}</p>`;
      if (Array.isArray(items)) {
        return `<ul style="padding-left: 20px; margin: 0;">${items.map(i => `<li style="margin-bottom: 8px;">${i}</li>`).join('')}</ul>`;
      }
      if (typeof items === 'object') {
        return Object.entries(items).map(([k, v]) => `
          <div style="margin-bottom: 12px;">
            <strong style="color: #1e293b;">${k}:</strong> ${typeof v === 'object' ? JSON.stringify(v) : v}
          </div>
        `).join('');
      }
      return '';
    };

    const alertsHtml = dictamen.alertas && Array.isArray(dictamen.alertas) && dictamen.alertas.length > 0 
      ? `
        <div style="margin-bottom: 30px; page-break-inside: avoid; background-color: #FEF2F2; border-left: 5px solid #DC2626; padding: 20px; border-radius: 8px; color: #991B1B;">
          <h3 style="margin-top: 0; font-size: 18px; margin-bottom: 10px;">Banderas Rojas Detectadas</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${dictamen.alertas.map((a: string) => `<li style="margin-bottom: 5px;">${a}</li>`).join('')}
          </ul>
        </div>
      ` : '';

    container.innerHTML = DOMPurify.sanitize(`
      <div style="max-width: 100%;">
        <!-- HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 3px solid #1E3A8A; padding-bottom: 20px;">
          <div style="text-align: left;">
            <h1 style="font-size: 24px; color: #1E3A8A; margin: 0; font-weight: 900;">JUXA VERIFY</h1>
            <p style="font-size: 12px; color: #64748b; margin-top: 5px;">REPORTE DE VERIFICACIÓN INTELIGENTE</p>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; padding: 8px 20px; border-radius: 6px; background-color: ${veredictoColor}; color: white; font-weight: bold; font-size: 18px;">
              ${veredicto}
            </div>
          </div>
        </div>

        <!-- RESUMEN EJECUTIVO -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="color: #1E3A8A; font-size: 20px; margin-bottom: 10px; font-weight: bold;">Resumen Ejecutivo</h2>
          <hr style="border-top: 2px solid #E5E7EB; margin: 10px 0 20px 0;" />
          <p style="font-size: 15px; line-height: 1.6; color: #334155; font-style: italic; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
            ${dictamen.dictamenFinal?.resumen || 'Análisis ejecutivo generado por IA para la validación de perfil y veracidad de datos.'}
          </p>
        </div>

        <!-- DATOS GENERALES -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; page-break-inside: avoid;">
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px;">
            <p style="margin: 5px 0; font-size: 13px;"><strong>Candidato:</strong> ${inv.title}</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>ID Reporte:</strong> INV-${inv.id.substring(0, 8).toUpperCase()}</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px;">
            <p style="margin: 5px 0; font-size: 13px;"><strong>Perfil:</strong> ${inv.clientProfile}</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>Ubicación:</strong> ${candidateData.location || 'Coordenadas GPS'}</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>Coordenadas:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
          </div>
        </div>

        ${alertsHtml}

        <!-- CRUCE DE FACHADA Y ENTORNO (Rule 2) -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="color: #1E3A8A; font-size: 20px; margin-bottom: 10px; font-weight: bold;">Cruce de Fachada y Entorno</h2>
          <hr style="border-top: 2px solid #E5E7EB; margin: 10px 0 20px 0;" />
          <div style="display: flex; gap: 20px;">
            <div style="flex: 1; text-align: center;">
              ${candidateData.fotoFachadaUrl ? `
                <img src="${candidateData.fotoFachadaUrl}" style="width: 100%; height: 220px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" />
                <p style="font-size: 12px; font-weight: bold; color: #1E3A8A; margin-top: 10px;">Evidencia de Fachada (Candidato)</p>
              ` : '<div style="height: 220px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8;">No disponible</div>'}
            </div>
            <div style="flex: 1; text-align: center;">
              <img src="${streetViewUrl}" style="width: 100%; height: 220px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" />
              <p style="font-size: 12px; font-weight: bold; color: #1E3A8A; margin-top: 10px;">Street View (Coordenadas GPS)</p>
            </div>
          </div>
        </div>

        <!-- MAPA DE UBICACIÓN -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="color: #1E3A8A; font-size: 20px; margin-bottom: 10px; font-weight: bold;">Geolocalización Satelital</h2>
          <hr style="border-top: 2px solid #E5E7EB; margin: 10px 0 20px 0;" />
          <img src="${staticMapUrl}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" />
        </div>

        <!-- SECCIONES DE ANÁLISIS IA -->
        ${dictamen.congruenciaIngresos ? renderSection('Análisis de Ingresos y Estabilidad', renderList(dictamen.congruenciaIngresos)) : ''}
        ${dictamen.congruenciaDomicilio ? renderSection('Validación de Domicilio y Entorno', renderList(dictamen.congruenciaDomicilio)) : ''}
        ${dictamen.analisisDocumental ? renderSection('Verificación Documental (ID/Comprobantes)', renderList(dictamen.analisisDocumental)) : ''}
        ${dictamen.entornoSocial ? renderSection('Contexto Social y Referencias', renderList(dictamen.entornoSocial)) : ''}

        <!-- GALERÍA DE EVIDENCIAS -->
        <div style="margin-top: 40px;">
          <h2 style="color: #1E3A8A; font-size: 20px; margin-bottom: 10px; font-weight: bold;">Galería de Evidencias Fotográficas</h2>
          <hr style="border-top: 2px solid #E5E7EB; margin: 10px 0 20px 0;" />
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            ${Object.entries(candidateData)
              .filter(([key, val]) => key.toLowerCase().includes('url') && typeof val === 'string' && val.startsWith('http') && key !== 'fotoFachadaUrl')
              .map(([key, url]) => `
                <div style="page-break-inside: avoid; margin-bottom: 30px; text-align: center;">
                  <img src="${url}" style="width: 100%; height: 240px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" />
                  <p style="font-size: 11px; color: #1E3A8A; margin-top: 8px; text-transform: uppercase; font-weight: bold;">
                    ${key.replace('Url', '').replace('foto', '').replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                </div>
              `).join('')}
          </div>
        </div>

        <!-- FOOTER -->
        <div style="margin-top: 60px; padding-top: 30px; border-top: 2px solid #1E3A8A; text-align: center; color: #64748b; font-size: 11px;">
          <p style="font-weight: bold; color: #1E3A8A; margin-bottom: 5px;">JUXA LEGALTECH HUB - REPORTE CONFIDENCIAL</p>
          <p>Este documento fue generado automáticamente mediante algoritmos de IA y validación GPS. La alteración de este reporte constituye una falta grave.</p>
          <p>© ${new Date().getFullYear()} Duarte-Aupart Abogados, S.C. Todos los derechos reservados.</p>
        </div>
      </div>
    `);

    try {
      const images = container.getElementsByTagName('img');
      const promises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(promises);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Reporte_JUXA_${inv.id.substring(0, 8).toUpperCase()}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Hubo un error al generar el PDF. Por favor intente de nuevo.");
    } finally {
      document.body.removeChild(container);
    }
  };

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setInvestigations([]);
      return;
    }

    const userRef = doc(db, 'users', uid);
    const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserCredits(data.credits || 0);
        setPagaresCredits(data.pagaresCredits || 0);
        setClientType(data.clientType || 'GRATUITO');
      }
    });

    /** Misma idea que listados internos (FinancialDashboard): mesa y analistas ven expedientes del tenant, no solo clientId = su UID. */
    const orgWideInvestigationRoles: Array<string> = [
      'ADMIN',
      'SUPERVISOR',
      'EJECUTIVO_VENTAS',
      'ANALISTA_MESA_CONTROL',
      'GERENTE_DIRECTIVO',
      'ANALISTA_CREDITO',
      'INVESTIGADOR_SOCIAL',
      'REVISOR_RRHH',
      'INVESTIGADOR',
    ];
    /**
     * Cuentas de mesa mal dados de alta como CLIENTE + CREDIT en el tenant Loong (vendedores usan LOONG_MOTOR → otro panel).
     * Sin esto, la query queda clientId == uid y no ven precal de vendedores.
     */
    const loongOrgCreditDeskSeesTenant =
      role === 'CLIENTE' &&
      clientProfile === 'CREDIT' &&
      effectiveOrganizationId === DEFAULT_ORGANIZATION_ID_LOONG;

    const tenantDirectoryMode =
      !bypassInvestigationProductGates(user?.email ?? null) &&
      !!effectiveOrganizationId &&
      (orgWideInvestigationRoles.includes(role ?? '') || loongOrgCreditDeskSeesTenant);

    const q = tenantDirectoryMode
      ? query(collection(db, 'investigations'), where('organizationId', '==', effectiveOrganizationId))
      : query(collection(db, 'investigations'), where('clientId', '==', uid));

    const unsubscribeInv = onSnapshot(
      q,
      (snapshot) => {
        const invs = snapshot.docs
          .map((d): { id: string } & Record<string, unknown> => ({
            id: d.id,
            ...(d.data() as Record<string, unknown>),
          }))
          .sort((a, b) => {
            const ac = typeof a.createdAt === 'string' ? a.createdAt : undefined;
            const bc = typeof b.createdAt === 'string' ? b.createdAt : undefined;
            return investigationCreatedMs(bc) - investigationCreatedMs(ac);
          });
        setInvestigations(invs);
      },
      (err) => {
        console.error('[ClientDashboard] investigations query:', err);
        toast.error(
          'No se pudo cargar el listado de expedientes. Revisa permisos en Firestore o tu conexión.'
        );
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeInv();
    };
  }, [user?.uid, user?.email, role, clientProfile, effectiveOrganizationId]);

  const handleDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestigation) return;

    setIsSubmitting(true);
    setError('');

    try {
      const invRef = doc(db, 'investigations', selectedInvestigation.id);
      
      // Update status to in progress
      await updateDoc(invRef, {
        status: 'IN_PROGRESS',
        updatedAt: new Date().toISOString()
      });

      // Prepare data for AI analysis
      const candidateData = {
        preQualQuestions,
        submittedAt: new Date().toISOString()
      };

      // Call AI analysis
      const analysisResult = await analyzeCandidateData(
        JSON.stringify(candidateData),
        null, // No files for pre-qual direct input
        'CREDIT',
        'BASIC',
        {
          montoCreditoCapital: selectedInvestigation.montoCreditoCapital,
          montoCreditoIntereses: selectedInvestigation.montoCreditoIntereses,
          plazoFinanciamiento: selectedInvestigation.plazoFinanciamiento,
          tipoCredito: selectedInvestigation.tipoCredito
        }
      );

      // Update investigation with results
      await updateDoc(invRef, {
        status: 'COMPLETED',
        candidateData: JSON.stringify(candidateData),
        socioeconomicDictamen: analysisResult,
        creditAnalysisResult: analysisResult,
        updatedAt: new Date().toISOString()
      });

      setIsDirectInputModalOpen(false);
      // Refresh selected investigation to show results
      const updatedDoc = await getDoc(invRef);
      if (updatedDoc.exists()) {
        setSelectedInvestigation({ id: updatedDoc.id, ...updatedDoc.data() });
      }
    } catch (err) {
      console.error("Error in direct submission:", err);
      setError('Error al procesar la investigación directa. Por favor intente de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const specialistGate = bypassInvestigationProductGates(auth.currentUser.email);

    if (!specialistGate) {
      const gate = canUseProduct(productAccessCtx, investigationType);
      if (!gate.ok) {
        setError(gate.reason || 'No puedes crear esta investigación.');
        return;
      }
    }

    if (investigationType === 'HR') {
      const hasCv = !!cvFile;
      const jp = jobProfile.trim().length;
      const det = details.trim().length;
      if (!hasCv) {
        if (specialistGate) {
          if (jp < 40 && det < 80) {
            setError(
              'Modo especialista: sin CV debes describir el puesto (mín. 40 caracteres) o el expediente en instrucciones (mín. 80). También puedes adjuntar el CV.'
            );
            toast.error('Completa el contexto del caso o adjunta el CV.');
            return;
          }
        } else {
          setError('Carga el CV del candidato (PDF o Word) para activar la validación inteligente del perfil.');
          toast.error('Falta el CV del candidato.');
          return;
        }
      } else {
        const maxCv = 15 * 1024 * 1024;
        if (cvFile.size > maxCv) {
          setError('El CV supera 15 MB. Reduce el tamaño o sube otro archivo.');
          toast.error('Archivo demasiado grande.');
          return;
        }
      }
    }

    if (sendViaSystem) {
      const em = candidateEmail.trim();
      const ph = candidatePhone.trim();
      if (!em || !ph) {
        setError('Indica correo y teléfono del candidato para el envío automático, o desmarca esa opción.');
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    const timeoutMsg = `La operación tardó más de ${FIRESTORE_REQUEST_TIMEOUT_MS / 1000}s. Revisa tu conexión e inténtalo de nuevo.`;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);

      const generateId = () => {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
      };

      const investigationId = generateId();
      const candidateLinkId = generateLink ? generateId() : null;

      let cvUploadedUrls: Record<string, string> | undefined;
      if (investigationType === 'HR' && cvFile) {
        const safeName = cvFile.name.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'cv';
        const storageRef = ref(
          storage,
          `investigations_cv/${auth.currentUser.uid}/${investigationId}/${safeName}`
        );
        const snapshot = await withTimeout(
          uploadBytes(storageRef, cvFile, { contentType: cvFile.type || 'application/octet-stream' }),
          timeoutMsg
        );
        const cvUrl = await withTimeout(getDownloadURL(snapshot.ref), timeoutMsg);
        cvUploadedUrls = { cv: cvUrl };
      }

      let investigationData: Record<string, unknown> = {
        id: investigationId,
        clientId: auth.currentUser.uid,
        requestedBy: auth.currentUser.uid,
        status: 'PENDING',
        title: title.trim(),
        details: details.trim(),
        clientProfile: investigationType,
        investigationType,
        investigationScope: investigationType === 'CREDIT' ? investigationScope : 'INTEGRAL',
        isDirect: isDirectInvestigation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (effectiveOrganizationId) {
        investigationData.organizationId = effectiveOrganizationId;
      }

      if (cvUploadedUrls) {
        investigationData.uploadedFileUrls = cvUploadedUrls;
      }

      if (investigationType === 'CREDIT' && isDirectInvestigation) {
        const formData = new FormData(e.currentTarget as HTMLFormElement);
        investigationData.candidateData = JSON.stringify({
          ocupacion: formData.get('direct_ocupacion'),
          ingresoMensual: formData.get('direct_ingreso'),
          location: formData.get('direct_domicilio'),
        });
      }

      if (generateLink && !isDirectInvestigation) {
        investigationData.candidateLink = candidateLinkId;
        investigationData.linkStatus = 'PENDING';
        if (sendViaSystem) {
          investigationData.candidateEmail = candidateEmail.trim();
          investigationData.candidatePhone = candidatePhone.trim();
        }
      }

      if (investigationType === 'HR') {
        investigationData = {
          ...investigationData,
          jobProfile: jobProfile.trim(),
          cvFileName: cvFile ? cvFile.name : null,
          smartValidationRequested: true,
        };
      } else if (investigationType === 'CREDIT') {
        investigationData = {
          ...investigationData,
          visitAddress,
          contactInfo,
          montoCreditoCapital: parseOptionalAmount(montoCreditoCapital),
          montoCreditoIntereses: parseOptionalAmount(montoCreditoIntereses),
          plazoFinanciamiento: plazoFinanciamiento.trim() || null,
          tipoCredito: tipoCredito.trim() || null,
          creditAppFileName: creditApp ? creditApp.name : null,
        };
      }

      const docRef = doc(db, 'investigations', investigationId);
      await withTimeout(setDoc(docRef, investigationData), timeoutMsg);

      const actualInvestigationId = investigationId;

      void logUserAction?.(user?.uid ?? auth.currentUser.uid, 'CLIENT_REQUEST_INVESTIGATION', {
        investigationId: actualInvestigationId,
        type: investigationType,
        title: title.trim(),
        specialistHr: specialistGate && investigationType === 'HR',
      });

      if (generateLink && candidateLinkId) {
        const linkPayload: Record<string, unknown> = {
          linkId: candidateLinkId,
          investigationId: actualInvestigationId,
          clientId: auth.currentUser.uid,
          clientProfile: investigationType,
          investigationType,
          investigationScope: investigationType === 'CREDIT' ? investigationScope : 'INTEGRAL',
          title: title.trim(),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (effectiveOrganizationId) linkPayload.organizationId = effectiveOrganizationId;
        await withTimeout(setDoc(doc(db, 'candidate_links', candidateLinkId), linkPayload), timeoutMsg);
        const shareUrl = `${window.location.origin}/candidate/${candidateLinkId}`;
        try {
          await navigator.clipboard.writeText(shareUrl);
        } catch {
          /* ignore */
        }
      }

      if (!specialistGate && clientType === 'BOLSA' && userCredits !== null && userCredits > 0) {
        try {
          await withTimeout(
            updateDoc(userRef, {
              credits: userCredits - 1,
              updatedAt: new Date().toISOString(),
            }),
            timeoutMsg
          );
        } catch (err) {
          console.error('Credit deduction failed:', err);
        }
      }

      toast.success(
        generateLink && candidateLinkId
          ? 'Investigación creada. Enlace del candidato copiado al portapapeles: compártelo para que él lo abra (no uses ese enlace desde tu sesión de vendedor).'
          : 'Investigación creada. Ya puedes compartir el enlace con el candidato.'
      );
      setIsModalOpen(false);
      resetForm();
    } catch (err: unknown) {
      console.error('Investigation Request Error:', err);
      let errorMessage = 'Error al solicitar la investigación. Inténtalo de nuevo.';

      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code === 'permission-denied') {
        errorMessage =
          'Permiso denegado en Firestore. Comprueba reglas desplegadas, organización del usuario y que el correo de superadmin esté autorizado en reglas.';
      } else if (code === 'storage/unauthorized') {
        errorMessage = 'No se pudo subir el CV (Storage). Verifica reglas de Storage y que estés autenticado.';
      } else if (err instanceof Error && err.message) {
        try {
          const parsedError = JSON.parse(err.message);
          errorMessage = `Error de Firestore (${parsedError.operationType} en ${parsedError.path}): ${parsedError.error}`;
        } catch {
          errorMessage =
            err.message.includes('tiempo de espera') || err.message.includes('agotado')
              ? err.message
              : err.message.includes('FirebaseError') || err.message.includes('PERMISSION_DENIED')
                ? 'Permiso denegado o datos inválidos. Revisa reglas de Firestore y el formato de los datos enviados.'
                : err.message;
        }
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDetails('');
    setJobProfile('');
    setCvFile(null);
    setVisitAddress('');
    setContactInfo('');
    setMontoCreditoCapital('');
    setMontoCreditoIntereses('');
    setPlazoFinanciamiento('');
    setTipoCredito('Personal');
    setCreditApp(null);
    setProviderReferences(null);
    setProviderFiles(null);
    setSendViaSystem(false);
    setCandidateEmail('');
    setCandidatePhone('');
  };

  const completedCount = investigations.filter(i => i.status === 'COMPLETED').length;
  const inProgressCount = investigations.filter(i => i.status === 'IN_PROGRESS' || i.status === 'PENDING').length;
  const attentionCount = investigations.filter(i => i.status === 'REQUIRES_ATTENTION').length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Enlace copiado al portapapeles');
  };

  const handleDeleteInvestigation = async (id: string, candidateLinkId?: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta investigación? Esta acción no se puede deshacer.')) {
      try {
        await deleteDoc(doc(db, 'investigations', id));
        if (candidateLinkId) {
          await deleteDoc(doc(db, 'candidate_links', candidateLinkId));
        }
        setInvestigations((prev) => prev.filter((inv) => inv.id !== id));
      } catch (error) {
        console.error("Error deleting investigation:", error);
        alert("Hubo un error al eliminar la investigación.");
      }
    }
  };

  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'chat'>('info');

  useEffect(() => {
    if (!FEATURE_WORKSPACE_CHAT_TICKETS && detailTab === 'chat') setDetailTab('info');
  }, [detailTab]);

  const handleReanalyze = async (inv: any) => {
    if (!inv || !auth.currentUser) return;
    setIsReanalyzing(true);
    setError('');

    try {
      const urls = inv.uploadedFileUrls || {};
      const candidateData = safeParseInvestigationCandidateData(inv.candidateData);

      let businessRules = '';
      let scoringConfig: unknown = null;
      try {
        const clientDoc = await getDoc(doc(db, 'clients', auth.currentUser.uid));
        if (clientDoc.exists()) {
          const cd = clientDoc.data();
          businessRules = cd.politicasGenerales || '';
          scoringConfig = cd.scoringConfig || null;
        }
      } catch (err) {
        console.warn("Could not fetch business rules:", err);
      }

      let loongOriginationInjection = '';
      if (inv.clientProfile === 'LOONG_MOTOR' || inv.loongMotorPolicyApplies === true) {
        try {
          loongOriginationInjection = await buildLoongMotorOfficialAnalysisInjection(
            db,
            inv.organizationId ?? null
          );
        } catch (e) {
          console.warn('Loong policy injection:', e);
        }
      }

      const { analyzeCandidateData } = await import('../../lib/gemini');

      const imageParts = [
        urls.fotoFachadaUrl,
        urls.fotoSalaUrl,
        urls.fotoComedorUrl,
        urls.fotoCocinaUrl,
        urls.fotoHabitacionUrl,
        urls.idFrontUrl,
        urls.idBackUrl,
        urls.proofOfAddressUrl,
        urls.selfieUrl
      ].filter(Boolean);

      const aiPayload = {
        ...candidateData,
        perfil: inv.clientProfile,
        puesto: inv.jobProfile?.vacancy || 'No especificado',
        montoCreditoCapital: inv.montoCreditoCapital,
        montoCreditoIntereses: inv.montoCreditoIntereses,
        plazoFinanciamiento: inv.plazoFinanciamiento,
        tipoCredito: inv.tipoCredito,
        investigationScope: inv.investigationScope,
        creditStage: inv.creditStage,
        antecedenteExpediente:
          typeof inv.details === 'string' && inv.details.trim() ? inv.details.trim() : undefined,
        notaContextoManual:
          imageParts.length === 0
            ? 'Sin evidencia fotográfica aún: dictamen basado en antecedente y datos declarados en expediente (pre-calificación o enlace pendiente). Indica limitaciones en el resumen.'
            : undefined,
      };

      const aiResult = await analyzeCandidateData(
        aiPayload,
        imageParts,
        businessRules,
        'none',
        scoringConfig ?? undefined,
        loongOriginationInjection || undefined
      );

      const updateData: Record<string, unknown> = {
        socioeconomicDictamen: aiResult,
        updatedAt: new Date().toISOString(),
      };

      try {
        const p = JSON.parse(aiResult) as { score?: number; scoreBreakdown?: unknown };
        if (typeof p.score === 'number') updateData.score = p.score;
        if (p.scoreBreakdown && typeof p.scoreBreakdown === 'object') {
          updateData.scoreBreakdown = JSON.stringify(p.scoreBreakdown);
        }
      } catch {
        /* score opcional */
      }

      if (inv.clientProfile === 'HR') updateData.identityValidationResult = aiResult;
      else if (inv.clientProfile === 'PROVIDER') updateData.providerAnalysisResult = aiResult;
      else updateData.creditAnalysisResult = aiResult;

      await updateDoc(doc(db, 'investigations', inv.id), updateData);

      setSelectedInvestigation({ ...inv, ...updateData });

      if (logUserAction && user) {
        logUserAction(user.uid, 'CLIENT_REANALYZE_IA', { investigationId: inv.id });
      }

      toast.success('Dictamen generado y guardado en el expediente.');
    } catch (err: unknown) {
      console.error('Re-analysis failed:', err);
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError('Error al generar dictamen con IA: ' + msg);
      toast.error('No se pudo generar el dictamen. Revisa la API de IA o intenta de nuevo.');
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleGeneratePagare = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    // Check credits
    if (!bypassInvestigationProductGates(auth.currentUser.email) && (pagaresCredits === null || pagaresCredits <= 0)) {
      alert('No tienes créditos de pagarés suficientes. Por favor, adquiere más créditos.');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const pagareData = {
      monto: formData.get('monto') as string,
      montoLetra: formData.get('montoLetra') as string,
      lugarFecha: formData.get('lugarFecha') as string,
      beneficiario: formData.get('beneficiario') as string,
      lugarPago: formData.get('lugarPago') as string,
      fechaVencimiento: formData.get('fechaVencimiento') as string,
      deudorNombre: formData.get('deudorNombre') as string,
      deudorDireccion: formData.get('deudorDireccion') as string,
      deudorTelefono: formData.get('deudorTelefono') as string,
    };

    try {
      // Deduct credit
      if (!bypassInvestigationProductGates(auth.currentUser.email) && pagaresCredits !== null && pagaresCredits > 0) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          pagaresCredits: pagaresCredits - 1
        });
      }

      if (logUserAction && user) {
        logUserAction(user.uid, 'CLIENT_GENERATE_PAGARE', { amount: pagareData.monto, debtor: pagareData.deudorNombre });
      }

      // Generate PDF
      const docPdf = new jsPDF();
      
      docPdf.setFontSize(16);
      docPdf.setFont(undefined, 'bold');
      docPdf.text('PAGARÉ', 105, 20, { align: 'center' });
      
      docPdf.setFontSize(12);
      docPdf.setFont(undefined, 'normal');
      
      docPdf.text(`BUENO POR: $${pagareData.monto}`, 150, 30);
      docPdf.text(`Lugar y fecha de expedición: ${pagareData.lugarFecha}`, 20, 40);
      
      const bodyText = `Por este PAGARÉ me(nos) obligo(amos) a pagar incondicionalmente a la orden de ${pagareData.beneficiario} en ${pagareData.lugarPago} el día ${pagareData.fechaVencimiento} la cantidad de $${pagareData.monto} (${pagareData.montoLetra}). Valor recibido a mi(nuestra) entera satisfacción.`;
      
      const splitBody = docPdf.splitTextToSize(bodyText, 170);
      docPdf.text(splitBody, 20, 55);
      
      docPdf.text('DATOS DEL DEUDOR:', 20, 90);
      docPdf.text(`Nombre: ${pagareData.deudorNombre}`, 20, 100);
      docPdf.text(`Dirección: ${pagareData.deudorDireccion}`, 20, 110);
      docPdf.text(`Teléfono: ${pagareData.deudorTelefono}`, 20, 120);
      
      docPdf.text('_________________________________', 105, 160, { align: 'center' });
      docPdf.text('Firma del Deudor', 105, 170, { align: 'center' });
      
      docPdf.save(`Pagare_${pagareData.deudorNombre.replace(/\s+/g, '_')}.pdf`);
      
      setIsPagareModalOpen(false);
      alert('Pagaré generado exitosamente.');
    } catch (error) {
      console.error('Error al generar pagaré:', error);
      alert('Error al generar el pagaré.');
    }
  };

  const investigationListPanel = (listTitle: string) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{listTitle}</h2>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {investigations.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-300">No tienes investigaciones solicitadas aún.</p>
            <p className="text-sm mt-2 max-w-md mx-auto">
              {preferWorkflowChooser
                ? 'Arriba puedes elegir si inicias originación de crédito o una nueva investigación con enlace al candidato.'
                : 'Usa «Nueva investigación» para crear tu primera solicitud.'}
            </p>
          </div>
        ) : (
          investigations.map((inv) => (
            <div
              key={inv.id}
              className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${
                    inv.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-600'
                      : inv.status === 'PENDING'
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        : inv.status === 'IN_PROGRESS'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {inv.clientProfile === 'HR' ? (
                    <Briefcase className="w-5 h-5" />
                  ) : inv.clientProfile === 'CREDIT' ? (
                    <Building2 className="w-5 h-5" />
                  ) : inv.clientProfile === 'PROVIDER' ? (
                    <Building2 className="w-5 h-5" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      INV-{inv.id.substring(0, 6)}
                    </span>
                    {inv.antecedenteId ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                        {inv.antecedenteId}
                      </span>
                    ) : null}
                    {inv.tipoCredito ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
                        {inv.tipoCredito}
                      </span>
                    ) : null}
                    {inv.riskSegment ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        {inv.riskSegment}
                      </span>
                    ) : null}
                    {((inv.investigationScope === 'BASIC' &&
                      (inv.clientProfile === 'CREDIT' || inv.investigationType === 'CREDIT')) ||
                      (inv.investigationScope === 'LOONG_PRECAL' &&
                        (inv.clientProfile === 'LOONG_MOTOR' || inv.investigationType === 'LOONG_MOTOR'))) ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase max-w-[220px] truncate ${mesaPrecalFlowBadgeClass(
                          mesaPrecalFlowState(inv)
                        )}`}
                        title={mesaPrecalFlowLabel(mesaPrecalFlowState(inv))}
                      >
                        {mesaPrecalFlowLabel(mesaPrecalFlowState(inv))}
                      </span>
                    ) : null}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        inv.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : inv.status === 'PENDING'
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                            : inv.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {inv.status === 'COMPLETED'
                        ? 'Completado'
                        : inv.status === 'PENDING'
                          ? 'Pendiente'
                          : inv.status === 'IN_PROGRESS'
                            ? 'En Progreso'
                            : 'Requiere Atención'}
                    </span>
                    {inv.clientProfile && inv.clientProfile !== 'GENERAL' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
                        {inv.clientProfile === 'HR'
                          ? 'RRHH'
                          : inv.clientProfile === 'CREDIT'
                            ? 'Crédito'
                            : 'Proveedor'}
                      </span>
                    )}
                    {inv.candidateLink && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 ${
                          inv.linkStatus === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : inv.linkStatus === 'OPENED'
                              ? 'bg-blue-100 text-blue-700'
                              : inv.linkStatus === 'IN_PROGRESS'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <LinkIcon className="w-3 h-3" />
                        Enlace:{' '}
                        {inv.linkStatus === 'COMPLETED'
                          ? 'Completado'
                          : inv.linkStatus === 'OPENED'
                            ? 'Abierto'
                            : inv.linkStatus === 'IN_PROGRESS'
                              ? 'En Progreso'
                              : 'Enviado/Pendiente'}
                      </span>
                    )}
                    {inv.loongMotorPolicyApplies &&
                    inv.investigationScope === 'BASIC' &&
                    typeof inv.mesaPrecalAutoPassed === 'boolean' &&
                    (inv.mesaPrecalStatus === 'pending' || inv.linkStatus === 'AWAITING_MESA') ? (
                      <span className="w-full basis-full text-[10px] leading-snug text-slate-600 dark:text-slate-400">
                        Primera etapa — motor referencia:{' '}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {inv.mesaPrecalAutoPassed ? 'favorable' : 'no favorable'}
                        </strong>
                        {inv.mesaPrecalStatus === 'pending' ? ' · mesa pendiente' : ''}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">{inv.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{inv.details}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'}
                  </p>
                  {inv.candidateLink && (
                    <div className="mt-2 flex flex-col gap-2">
                      {inv.clientProfile === 'HR' || inv.investigationScope === 'BASIC' ? (
                        <div className="flex items-center gap-3 flex-wrap bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 w-full sm:w-auto">
                            {inv.investigationScope === 'BASIC' ? 'Enlace de Pre-calificación' : 'Enlace del Candidato'}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(`${window.location.origin}/candidate/${inv.candidateLink}`)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
                          >
                            <LinkIcon className="w-3 h-3 mr-1" /> Copiar enlace
                          </button>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 w-full sm:w-auto">
                            Solo el candidato debe abrir este enlace.
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 flex-wrap bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 w-full sm:w-auto">
                              Paso 1: Perfilamiento
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(`${window.location.origin}/candidate/${inv.candidateLink}?phase=1`)
                              }
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
                            >
                              <LinkIcon className="w-3 h-3 mr-1" /> Copiar enlace
                            </button>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 w-full sm:w-auto">
                              Solo el candidato debe abrir este enlace.
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 w-full sm:w-auto">
                              Paso 2: Continuación (Documentos)
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(`${window.location.origin}/candidate/${inv.candidateLink}?phase=2`)
                              }
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
                            >
                              <LinkIcon className="w-3 h-3 mr-1" /> Copiar enlace
                            </button>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 w-full sm:w-auto">
                              Solo el candidato debe abrir este enlace.
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex sm:flex-col gap-2">
                {inv.investigationScope === 'BASIC' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDirectInputInvestigation(inv);
                      setIsDirectInputModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Investigar y Descargar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedInvestigation(inv)}
                  className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                >
                  Ver Detalles
                </button>
                {inv.status === 'COMPLETED' && (
                  <button
                    type="button"
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar PDF
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteInvestigation(inv.id, inv.candidateLink)}
                  className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {user?.email && isSuperAdminEmail(user.email) && (
        <div className="sticky top-0 z-30 shrink-0 border-b border-amber-200/90 bg-amber-50/95 px-4 py-2.5 dark:border-amber-800/50 dark:bg-amber-950/50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 text-sm text-amber-950 dark:text-amber-100">
            <Link
              to="/dashboard"
              className="font-semibold text-amber-900 underline decoration-amber-700/70 underline-offset-2 hover:text-amber-950 dark:text-amber-50 dark:decoration-amber-400/80"
            >
              ← Volver a administración
            </Link>
            <span className="text-amber-900/85 dark:text-amber-200/90">
              Vista de originación (prototipo cliente): «Originación crédito» registra nombre, monto e ID de expediente; luego se abre el cuestionario del candidato. «Nueva solicitud» sigue siendo el flujo completo con enlace.
            </span>
          </div>
        </div>
      )}
    <DashboardLayout
      title="Panel de Cliente"
      subtitle={user?.email || ''}
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as any)}
    >
      {activeTab === 'overview' && (
        <div className="p-4 sm:p-8 space-y-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mis Reportes</h1>
              {clientType === 'BOLSA' && (
                <div className="flex gap-4 mt-1">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Créditos Inv.: <span className="font-bold text-slate-900 dark:text-slate-100">{userCredits}</span></p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Créditos Pagarés: <span className="font-bold text-slate-900 dark:text-slate-100">{pagaresCredits}</span></p>
                </div>
              )}
              {clientType === 'SUSCRIPCION' && (
                <div className="flex gap-4 mt-1">
                  <p className="text-sm text-emerald-600 font-medium">Suscripción Activa</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Créditos Pagarés: <span className="font-bold text-slate-900 dark:text-slate-100">{pagaresCredits}</span></p>
                </div>
              )}
              {clientType === 'GRATUITO' && (
                <div className="flex gap-4 mt-1">
                  <p className="text-sm text-blue-600 font-medium">
                    Plan Gratuito ({investigations.length}/{gratuitousInvestigationCap(productAccessCtx)} investigaciones usadas)
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Créditos Pagarés: <span className="font-bold text-slate-900 dark:text-slate-100">{pagaresCredits}</span></p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {canQuickCreditLink && (
                <button
                  type="button"
                  onClick={openQuickCreditModal}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm flex items-center"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Originación crédito
                </button>
              )}
              <button
                type="button"
                onClick={openClientWorkflowEntry}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                {preferWorkflowChooser ? 'Nueva solicitud' : 'Nueva investigación'}
              </button>
            </div>
          </div>
          {investigationListPanel('Mis expedientes e investigaciones')}
        </div>
      )}

      {activeTab === 'INVESTIGATIONS' && (
        <div className="p-4 sm:p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Completados</h3>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{completedCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">En Progreso</h3>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{inProgressCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Requieren Atención</h3>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{attentionCount}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {canStartLoongOriginacion
            ? role === 'CLIENTE'
              ? 'Loong Motor: usa «Precal / solicitudes» para enlaces al candidato y seguimiento. Mesa y admin gestionan expedientes en el CRM.'
              : 'Loong Motor: «Nueva solicitud» abre el CRM de colocación para asociar la investigación a un cliente ya registrado o dar de alta uno nuevo (captura + expediente).'
            : preferWorkflowChooser
              ? skipWorkflowChooser
                ? 'Originación de crédito: primero nombre y monto (antecedente + ID), luego el cuestionario del candidato. O usa «Nueva solicitud» para el flujo completo.'
                : '¿Originación de crédito o una investigación con enlace al candidato? Mismo punto de entrada que en el resumen.'
              : 'Crea una nueva solicitud de investigación cuando lo necesites.'}
        </p>
        <div className="flex flex-wrap gap-2 shrink-0">
          {canQuickCreditLink && (
            <button
              type="button"
              onClick={openQuickCreditModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Zap className="w-4 h-4" />
              Originación crédito
            </button>
          )}
          <button
            type="button"
            onClick={openClientWorkflowEntry}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {canStartLoongOriginacion
              ? role === 'CLIENTE'
                ? 'Precal / solicitudes'
                : 'CRM · cliente / expediente'
              : preferWorkflowChooser
                ? 'Nueva solicitud'
                : 'Nueva investigación'}
          </button>
        </div>
      </div>

      {investigationListPanel('Historial de Investigaciones')}
    </div>
  )}

      {activeTab === 'CREDIT_APPS' && (
        <div className="p-4 sm:p-8">
          <CreditApplicationsModule investigations={investigations} />
        </div>
      )}

      {FEATURE_WORKSPACE_CHAT_TICKETS && activeTab === 'chat' && user && role && (
        <div className="p-4 sm:p-8">
          <LoongWorkspaceChatTab
            organizationId={effectiveOrganizationId ?? organizationId}
            userUid={user.uid}
            userEmail={user.email ?? null}
            role={role}
          />
        </div>
      )}

      {FEATURE_WORKSPACE_CHAT_TICKETS && activeTab === 'tickets' && user && role && (
        <div className="p-4 sm:p-8">
          <LoongSupportTicketsTab organizationId={effectiveOrganizationId ?? organizationId} userUid={user.uid} role={role} />
        </div>
      )}

      {isWorkflowChoiceOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-8 border border-slate-200 dark:border-slate-700">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">¿Qué deseas hacer?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Elige el siguiente paso de tu flujo: primero originación o una investigación con enlace al candidato.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkflowChoiceOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0 ml-2"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button
                type="button"
                onClick={goOriginacionPath}
                className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 text-left transition-all"
              >
                <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 dark:text-slate-100">Iniciar originación</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {canStartLoongOriginacion
                      ? 'Abrir el CRM de precalificación Loong Motor (nuevo expediente de crédito moto).'
                      : 'Ir a solicitudes de crédito y seguimiento de expedientes en tu panel.'}
                  </p>
                </div>
                <CreditCard className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0 mt-1" />
              </button>
              <button
                type="button"
                onClick={confirmInvestigationPath}
                className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-left transition-all"
              >
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                  <Search className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 dark:text-slate-100">Solicitar investigación</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Crear solicitud (RRHH, crédito o general) con enlace al candidato o carga directa.
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setIsWorkflowChoiceOpen(false)}
                className="w-full py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {isQuickCreditOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-labelledby="quick-credit-title"
          >
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 id="quick-credit-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Originación de crédito
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {canStartLoongOriginacion
                      ? 'Loong Motor: el tipo de línea es crédito motocicleta (fijo). Indica si el monto es precio de la unidad o monto a financiar manual; se genera expediente y se abre la pre-calificación.'
                      : 'Registra nombre y monto: se genera un ID de expediente, el antecedente queda en Firestore y se abre la primera parte del flujo (pre-calificación con cuestionario).'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !isQuickCreditSubmitting && setIsQuickCreditOpen(false)}
                  className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label htmlFor="quickCreditPersonName" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Nombre completo del solicitante
                </label>
                <input
                  id="quickCreditPersonName"
                  type="text"
                  value={quickCreditPersonName}
                  onChange={(e) => setQuickCreditPersonName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Ej. María López García"
                  autoFocus
                  autoComplete="name"
                />
              </div>
              {canStartLoongOriginacion ? (
                <div>
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    ¿Qué representa el monto?
                  </span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50 dark:has-[:checked]:bg-emerald-950/30">
                      <input
                        type="radio"
                        name="quickCreditLoongValorOrigen"
                        checked={quickCreditLoongValorOrigen === 'precio_moto'}
                        onChange={() => setQuickCreditLoongValorOrigen('precio_moto')}
                        className="text-emerald-600"
                      />
                      Precio de la motocicleta
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50 dark:has-[:checked]:bg-emerald-950/30">
                      <input
                        type="radio"
                        name="quickCreditLoongValorOrigen"
                        checked={quickCreditLoongValorOrigen === 'monto_manual'}
                        onChange={() => setQuickCreditLoongValorOrigen('monto_manual')}
                        className="text-emerald-600"
                      />
                      Monto a financiar (manual)
                    </label>
                  </div>
                </div>
              ) : null}
              <div>
                <label htmlFor="quickCreditAmount" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {canStartLoongOriginacion
                    ? quickCreditLoongValorOrigen === 'precio_moto'
                      ? 'Valor de la motocicleta (MXN)'
                      : 'Monto a financiar (MXN)'
                    : 'Cantidad solicitada (MXN)'}
                </label>
                <input
                  id="quickCreditAmount"
                  type="number"
                  min={1}
                  step="1"
                  value={quickCreditAmount}
                  onChange={(e) => setQuickCreditAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isQuickCreditSubmitting) {
                      e.preventDefault();
                      void submitQuickCreditLink();
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Ej. 45000"
                />
              </div>
              {canStartLoongOriginacion ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Línea fija: <strong className="font-medium text-slate-600 dark:text-slate-300">Crédito Motocicleta</strong>
                  . El segmento A/B/C y el cuestionario del candidato se definen automáticamente según el monto.
                </p>
              ) : (
                <div>
                  <label htmlFor="quickCreditTipo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Tipo de crédito
                  </label>
                  <select
                    id="quickCreditTipo"
                    value={quickCreditTipo}
                    onChange={(e) => setQuickCreditTipo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value={CREDIT_TYPE_PERSONAL}>Personal</option>
                    <option value={CREDIT_TYPE_MOTORCYCLE}>Crédito Motocicleta</option>
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Motocicleta: el segmento de riesgo (A/B/C) se asigna automáticamente según el monto y define un cuestionario adaptativo para el candidato.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isQuickCreditSubmitting}
                  onClick={() => setIsQuickCreditOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isQuickCreditSubmitting}
                  onClick={() => void submitQuickCreditLink()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  {isQuickCreditSubmitting ? 'Registrando…' : 'Crear expediente y abrir cuestionario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {canStartLoongOriginacion ? 'Loong Motor · investigación' : 'Solicitar investigación'}
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {canStartLoongOriginacion ? (
              <div className="space-y-4 p-6">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  En Loong Motor no se usan los tipos genéricos (RRHH, pre-cal suelta, etc.). La investigación se asocia a un
                  <strong> expediente de cliente</strong> ya registrado en el CRM (mesa / admin) o se da de alta ahí con la
                  captura de prospecto.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                      openLoongMotorInvestigationEntry();
                    }}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Ir a CRM Loong
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleRequest} className="p-6 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
                    Selecciona el Tipo de Servicio
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setInvestigationType('HR');
                        setInvestigationScope('INTEGRAL');
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${
                        investigationType === 'HR'
                          ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-blue-200 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className={`p-3 rounded-xl mr-4 ${investigationType === 'HR' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${investigationType === 'HR' ? 'text-blue-900' : 'text-slate-900 dark:text-slate-100'}`}>Recursos Humanos</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Validación de candidatos, CV y perfil laboral.</p>
                      </div>
                      {investigationType === 'HR' && <CheckCircle2 className="w-5 h-5 text-blue-600 ml-2" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInvestigationType('CREDIT');
                        setInvestigationScope('BASIC');
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${
                        investigationType === 'CREDIT' && investigationScope === 'BASIC'
                          ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-blue-200 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className={`p-3 rounded-xl mr-4 ${investigationType === 'CREDIT' && investigationScope === 'BASIC' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        <Calculator className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${investigationType === 'CREDIT' && investigationScope === 'BASIC' ? 'text-blue-900' : 'text-slate-900 dark:text-slate-100'}`}>Crédito: Pre-calificación</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Capacidad económica vs reglas y perfilado (Fase 1).</p>
                      </div>
                      {investigationType === 'CREDIT' && investigationScope === 'BASIC' && <CheckCircle2 className="w-5 h-5 text-blue-600 ml-2" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInvestigationType('CREDIT');
                        setInvestigationScope('INTERMEDIATE');
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${
                        investigationType === 'CREDIT' && investigationScope === 'INTERMEDIATE'
                          ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-blue-200 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className={`p-3 rounded-xl mr-4 ${investigationType === 'CREDIT' && investigationScope === 'INTERMEDIATE' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        <ClipboardCheck className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${investigationType === 'CREDIT' && investigationScope === 'INTERMEDIATE' ? 'text-blue-900' : 'text-slate-900 dark:text-slate-100'}`}>Crédito: Mesa de Control</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Análisis detallado de riesgos y validación interna.</p>
                      </div>
                      {investigationType === 'CREDIT' && investigationScope === 'INTERMEDIATE' && <CheckCircle2 className="w-5 h-5 text-blue-600 ml-2" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInvestigationType('CREDIT');
                        setInvestigationScope('ADVANCED');
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${
                        investigationType === 'CREDIT' && investigationScope === 'ADVANCED'
                          ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-blue-200 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className={`p-3 rounded-xl mr-4 ${investigationType === 'CREDIT' && investigationScope === 'ADVANCED' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${investigationType === 'CREDIT' && investigationScope === 'ADVANCED' ? 'text-blue-900' : 'text-slate-900 dark:text-slate-100'}`}>Crédito: Investigación Integral</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Proceso completo con verificación de campo (2 Fases).</p>
                      </div>
                      {investigationType === 'CREDIT' && investigationScope === 'ADVANCED' && <CheckCircle2 className="w-5 h-5 text-blue-600 ml-2" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInvestigationType('GENERAL');
                        setInvestigationScope('SIMPLE');
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left ${
                        investigationType === 'GENERAL'
                          ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-blue-200 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className={`p-3 rounded-xl mr-4 ${investigationType === 'GENERAL' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${investigationType === 'GENERAL' ? 'text-blue-900' : 'text-slate-900 dark:text-slate-100'}`}>Investigación General</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Cualquier otro tipo de validación o reporte.</p>
                      </div>
                      {investigationType === 'GENERAL' && <CheckCircle2 className="w-5 h-5 text-blue-600 ml-2" />}
                    </button>
                  </div>
                </div>

                {investigationType === 'CREDIT' && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="directMode"
                        checked={isDirectInvestigation}
                        onChange={(e) => setIsDirectInvestigation(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="directMode" className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                        Investigación Directa (Ingresar datos manualmente)
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    {investigationType === 'HR' ? 'Nombre del Candidato' : investigationType === 'CREDIT' ? 'Nombre del Solicitante de Crédito' : 'Título de la Investigación'}
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder={investigationType === 'HR' ? 'Ej. Juan Pérez' : investigationType === 'CREDIT' ? 'Ej. Empresa S.A. o Persona Física' : 'Ej. Verificación de Domicilio'}
                  />
                </div>

                {/* Direct Mode Fields for Credit */}
                {investigationType === 'CREDIT' && isDirectInvestigation && (
                  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Datos del Solicitante (Modo Directo)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Ocupación / Giro</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none"
                          placeholder="Ej. Comerciante"
                          name="direct_ocupacion"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Ingreso Mensual Declarado</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none"
                          placeholder="Ej. 25000"
                          name="direct_ingreso"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Domicilio Declarado</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none"
                          placeholder="Calle, Número, Colonia..."
                          name="direct_domicilio"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Candidate Link Options */}
                {(!isDirectInvestigation || investigationType === 'HR') && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="mb-4">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center">
                        <LinkIcon className="w-4 h-4 mr-1 text-blue-500" />
                        Enlace para el candidato (Generación Automática)
                      </span>
                    </div>
                    
                    <div className="pl-6 space-y-4 border-l-2 border-slate-200 dark:border-slate-700 ml-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Se generará un enlace único para que el candidato complete su información (ubicación, fotos, etc.) sin ver el dictamen final.
                      </p>
                      
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendViaSystem}
                          onChange={(e) => setSendViaSystem(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center">
                          <Send className="w-4 h-4 mr-1 text-slate-500 dark:text-slate-400" />
                          Enviar enlace automáticamente desde el sistema
                        </span>
                      </label>

                      {sendViaSystem && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Correo del Candidato</label>
                            <input
                              type="email"
                              required={sendViaSystem}
                              value={candidateEmail}
                              onChange={(e) => setCandidateEmail(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              placeholder="correo@ejemplo.com"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">Teléfono (WhatsApp)</label>
                            <input
                              type="tel"
                              required={sendViaSystem}
                              value={candidatePhone}
                              onChange={(e) => setCandidatePhone(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              placeholder="+52 123 456 7890"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* HR Specific Fields */}
                {investigationType === 'HR' && (
                  <>
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40">
                      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                        <Briefcase className="w-4 h-4 mr-2" />
                        Validación Inteligente de Perfil
                      </h4>
                      <p className="text-xs text-blue-800 dark:text-blue-200/90 mb-3">
                        El CV se sube de forma segura y se vincula al expediente. Con el enlace, el candidato completará evidencias; tú defines el perfil del puesto para orientar el análisis.
                      </p>
                      {bypassInvestigationProductGates(user?.email ?? null) && (
                        <p className="text-xs text-amber-800 dark:text-amber-200/90 mb-4 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
                          <strong>Modo especialista:</strong> puedes abrir el caso sin CV si describes el puesto (mín. 40 caracteres) o dejas instrucciones detalladas (mín. 80 caracteres) con expediente, RFC, trayectoria, etc. Si tienes el CV, adjuntarlo mejora el cruce automático.
                        </p>
                      )}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">Perfil del Puesto (Descripción)</label>
                          <textarea
                            required
                            value={jobProfile}
                            onChange={(e) => setJobProfile(e.target.value)}
                            className="w-full px-3 py-2 border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-slate-900 dark:text-slate-100"
                            placeholder="Describe responsabilidades, seniority, competencias técnicas y blandas, contexto del negocio..."
                            rows={4}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">
                            Cargar CV del Candidato (PDF/Word)
                            {!bypassInvestigationProductGates(user?.email ?? null) && (
                              <span className="text-red-600 dark:text-red-400 font-semibold"> — obligatorio</span>
                            )}
                          </label>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(e) => setCvFile(e.target.files ? e.target.files[0] : null)}
                            className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 dark:file:bg-blue-900/50 dark:file:text-blue-200"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Credit Specific Fields */}
                {investigationType === 'CREDIT' && (
                  <>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <h4 className="text-sm font-bold text-emerald-900 mb-2 flex items-center">
                        <Building2 className="w-4 h-4 mr-2" />
                        Datos de Verificación de Crédito
                      </h4>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-emerald-900 mb-1">Domicilio a Visitar (Si aplica)</label>
                          <input
                            type="text"
                            value={visitAddress}
                            onChange={(e) => setVisitAddress(e.target.value)}
                            className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white dark:bg-slate-900"
                            placeholder="Calle, Número, Colonia, Ciudad, CP"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-emerald-900 mb-1">Datos de Contacto</label>
                          <input
                            type="text"
                            value={contactInfo}
                            onChange={(e) => setContactInfo(e.target.value)}
                            className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white dark:bg-slate-900"
                            placeholder="Teléfono y/o correo del contacto principal"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-emerald-900 mb-1">Cargar Solicitud o Documento Base (PDF)</label>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setCreditApp(e.target.files ? e.target.files[0] : null)}
                            className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-100">
                          <div>
                            <label className="block text-xs font-medium text-emerald-900 mb-1">Monto Crédito (Capital)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-emerald-600 text-sm">$</span>
                              <input
                                type="number"
                                value={montoCreditoCapital}
                                onChange={(e) => setMontoCreditoCapital(e.target.value)}
                                className="w-full pl-7 pr-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white dark:bg-slate-900"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-emerald-900 mb-1">Monto con Intereses</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-emerald-600 text-sm">$</span>
                              <input
                                type="number"
                                value={montoCreditoIntereses}
                                onChange={(e) => setMontoCreditoIntereses(e.target.value)}
                                className="w-full pl-7 pr-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white dark:bg-slate-900"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-emerald-900 mb-1">Plazo de Financiamiento</label>
                            <input
                              type="text"
                              value={plazoFinanciamiento}
                              onChange={(e) => setPlazoFinanciamiento(e.target.value)}
                              className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white dark:bg-slate-900"
                              placeholder="Ej. 12 meses, 24 quincenas"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-emerald-900 mb-1">Tipo de Crédito</label>
                            <select
                              value={tipoCredito}
                              onChange={(e) => setTipoCredito(e.target.value)}
                              className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white dark:bg-slate-900"
                            >
                              <option value="Personal">Personal</option>
                              <option value="Automotriz">Automotriz</option>
                              <option value="Hipotecario">Hipotecario</option>
                              <option value="Negocio">Negocio / PYME</option>
                              <option value="Grupal">Grupal</option>
                              <option value="Otro">Otro</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                      <h4 className="text-sm font-bold text-purple-900 mb-2 flex items-center">
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        Análisis de Usurpación de Identidad (IA)
                      </h4>
                      <p className="text-xs text-purple-700 mb-4">
                        El sistema analizará la identificación oficial y comprobantes de domicilio para detectar alteraciones o inconsistencias.
                      </p>
                      <div>
                        <label className="block text-xs font-medium text-purple-900 mb-1">Cargar Identificación Oficial / Comprobantes (PDF/IMG)</label>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,image/*"
                          className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
                        />
                      </div>
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Instrucciones o Detalles Adicionales
                  </label>
                  <textarea
                    required={investigationType === 'GENERAL'}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[80px]"
                    placeholder="Proporciona RFC, CURP, o cualquier dato extra relevante..."
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar Solicitud'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Modal de Entrada Directa (Pre-calificación) */}
      {isDirectInputModalOpen && directInputInvestigation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <Calculator className="w-5 h-5 mr-2 text-emerald-600" />
                Pre-calificación Directa: {directInputInvestigation.title}
              </h3>
              <button 
                onClick={() => {
                  setIsDirectInputModalOpen(false);
                  setDirectInputInvestigation(null);
                }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleDirectSubmit} className="p-6 space-y-6">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-6">
                <p className="text-sm text-emerald-800">
                  Ingresa los datos del solicitante para obtener un dictamen inmediato de pre-calificación.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase mb-1">Monto Solicitado</label>
                  <input
                    type="number"
                    required
                    value={preQualQuestions.montoSolicitado}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, montoSolicitado: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase mb-1">Ingresos Mensuales</label>
                  <input
                    type="number"
                    required
                    value={preQualQuestions.ingresosMensuales}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, ingresosMensuales: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase mb-1">Gastos Mensuales</label>
                  <input
                    type="number"
                    required
                    value={preQualQuestions.gastosMensuales}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, gastosMensuales: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase mb-1">¿Tiene otras deudas?</label>
                  <select
                    value={preQualQuestions.tieneDeudas}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, tieneDeudas: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>
                {preQualQuestions.tieneDeudas === 'si' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase mb-1">Monto total de deudas</label>
                    <input
                      type="number"
                      value={preQualQuestions.montoDeudas}
                      onChange={(e) => setPreQualQuestions({...preQualQuestions, montoDeudas: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="0.00"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase mb-1">Antigüedad Laboral (Años)</label>
                  <input
                    type="number"
                    required
                    value={preQualQuestions.antiguedadLaboral}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, antiguedadLaboral: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase mb-1">Tipo de Contrato</label>
                  <select
                    value={preQualQuestions.tipoContrato}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, tipoContrato: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    <option value="Indefinido">Indefinido</option>
                    <option value="Temporal">Temporal</option>
                    <option value="Honorarios">Honorarios / Freelance</option>
                    <option value="Informal">Informal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase mb-1">Propiedad de Vivienda</label>
                  <select
                    value={preQualQuestions.propiedadVivienda}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, propiedadVivienda: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    <option value="Propia">Propia</option>
                    <option value="Rentada">Rentada</option>
                    <option value="Familiar">Familiar</option>
                    <option value="Hipotecada">Hipotecada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase mb-1">Buró de Crédito (Declarado)</label>
                  <select
                    value={preQualQuestions.buroCredito}
                    onChange={(e) => setPreQualQuestions({...preQualQuestions, buroCredito: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    <option value="Excelente">Excelente</option>
                    <option value="Bueno">Bueno</option>
                    <option value="Regular">Regular</option>
                    <option value="Malo">Malo</option>
                    <option value="Sin Historial">Sin Historial</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsDirectInputModalOpen(false);
                    setDirectInputInvestigation(null);
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      Generar Dictamen IA
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalles de Investigación */}
      {selectedInvestigation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Detalles de Investigación: {selectedInvestigation.title}
              </h3>
              <button 
                onClick={() => setSelectedInvestigation(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[min(82vh,920px)] overflow-y-auto space-y-8">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Tabs for Details */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 mb-6">
                <button
                  onClick={() => setDetailTab('info')}
                  className={`px-6 py-2 text-sm font-bold transition-colors border-b-2 ${
                    detailTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Información y calificación
                </button>
                {FEATURE_WORKSPACE_CHAT_TICKETS && (
                  <button
                    onClick={() => setDetailTab('chat')}
                    className={`px-6 py-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
                      detailTab === 'chat' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <Bot className="w-4 h-4" />
                    {selectedInvestigation.mesaPrecalStatus === 'approved' ||
                    selectedInvestigation.loongPhase2Unlocked === true ||
                    selectedInvestigation.originacionPhase2Unlocked === true
                      ? 'Chat IA · siguiente etapa'
                      : 'Chat con IA experta'}
                  </button>
                )}
              </div>

              {FEATURE_WORKSPACE_CHAT_TICKETS && detailTab === 'chat' ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                  {selectedInvestigation.mesaPrecalStatus === 'approved' ||
                  selectedInvestigation.loongPhase2Unlocked === true ||
                  selectedInvestigation.originacionPhase2Unlocked === true ? (
                    <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-100">
                      <p className="font-bold flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                        Siguiente proceso del cliente
                      </p>
                      <p className="mt-1 text-xs opacity-90">
                        Mesa autorizó continuar. Usa este chat como ventana de acompañamiento: documentación, visita,
                        dudas de política y siguiente pasos hacia el cierre de originación.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                      <strong className="text-slate-800 dark:text-slate-200">Chat orientativo.</strong> Cuando el
                      expediente avance y mesa libere la siguiente etapa, este espacio queda enfocado en acompañar al
                      candidato (trámites, evidencias y criterios).
                    </div>
                  )}
                  <JuxaVerifyChat investigation={selectedInvestigation} />
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in duration-300">
                  {/* Header Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">ID</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">INV-{selectedInvestigation.id.substring(0, 6)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">Estatus</p>
                  <p className={`text-sm font-bold ${
                    selectedInvestigation.status === 'COMPLETED' ? 'text-emerald-600' :
                    selectedInvestigation.status === 'PENDING' ? 'text-slate-600 dark:text-slate-300' :
                    selectedInvestigation.status === 'IN_PROGRESS' ? 'text-blue-600' :
                    'text-amber-600'
                  }`}>
                    {selectedInvestigation.status === 'COMPLETED' ? 'Completado' : 
                     selectedInvestigation.status === 'PENDING' ? 'Pendiente' : 
                     selectedInvestigation.status === 'IN_PROGRESS' ? 'En Progreso' : 'Requiere Atención'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">Perfil</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {selectedInvestigation.clientProfile === 'HR' ? 'Recursos Humanos' : 
                     selectedInvestigation.clientProfile === 'CREDIT' ? 'Crédito (General)' : 
                     selectedInvestigation.clientProfile === 'PROVIDER' ? 'Proveedor' : 'General'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">Fecha</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {new Date(selectedInvestigation.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {investigationShowsStage1Qualification(selectedInvestigation) ? (
                <InvestigationStage1QualificationPanel
                  inv={selectedInvestigation as Record<string, unknown>}
                  onGenerateDictamen={() => handleReanalyze(selectedInvestigation)}
                  isGenerating={isReanalyzing}
                />
              ) : null}

              {/* Trayecto integral de originación (crédito / Loong) */}
              {(() => {
                const traj = buildOriginationTrajectorySteps(selectedInvestigation as Record<string, unknown>);
                if (!traj || traj.length === 0) return null;
                const flowState = mesaPrecalFlowState(selectedInvestigation as MesaPrecalInvInput);
                const flowLabel = mesaPrecalFlowLabel(flowState);
                return (
                  <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/60 dark:border-indigo-900/45 dark:bg-indigo-950/25 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-100 flex items-center gap-2">
                        <Route className="w-4 h-4 shrink-0" aria-hidden />
                        Trayecto de originación
                      </h4>
                      {flowLabel ? (
                        <span
                          className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${mesaPrecalFlowBadgeClass(flowState)}`}
                        >
                          {flowLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-indigo-900/85 dark:text-indigo-200/80">
                      Vista del recorrido del cliente en el proceso. La etapa marcada como <strong>actual</strong> es la
                      siguiente pendiente según el estado del expediente.
                    </p>
                    <ul className="mt-4 space-y-3 border-l-2 border-indigo-200/70 dark:border-indigo-800/60 ml-2.5 pl-4">
                      {traj.map((step) => (
                        <li key={step.key} className="relative -ml-[calc(0.625rem+2px)] flex gap-3 pl-0">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-indigo-100 bg-white dark:border-indigo-900 dark:bg-slate-900">
                            {step.done ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            ) : step.current ? (
                              <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                            ) : (
                              <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" aria-hidden />
                            )}
                          </span>
                          <div className="min-w-0 pt-0.5">
                            <p
                              className={`text-sm font-semibold ${
                                step.current
                                  ? 'text-amber-900 dark:text-amber-100'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {step.label}
                              {step.current ? (
                                <span className="ml-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">· actual</span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{step.hint}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* Candidate Link Status */}
              {selectedInvestigation.candidateLink && (
                <div className="bg-blue-50 dark:bg-blue-950/25 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40">
                  <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Enlace del Candidato
                  </h4>
                  <p className="text-xs text-blue-800/90 dark:text-blue-200/85 mb-3">
                    Este enlace es para que lo abra <strong>solo el candidato</strong> en su dispositivo. Cópialo o compártelo; no lo abras aquí con tu usuario vendedor.
                  </p>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Estatus del Enlace:</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                        selectedInvestigation.linkStatus === 'COMPLETED' ? 'bg-emerald-200 text-emerald-800' :
                        selectedInvestigation.linkStatus === 'OPENED' ? 'bg-blue-200 text-blue-800' :
                        selectedInvestigation.linkStatus === 'IN_PROGRESS' ? 'bg-amber-200 text-amber-800' :
                        'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}>
                        {selectedInvestigation.linkStatus === 'COMPLETED' ? 'Información Enviada' :
                         selectedInvestigation.linkStatus === 'OPENED' ? 'Enlace Abierto' :
                         selectedInvestigation.linkStatus === 'IN_PROGRESS' ? 'En Progreso' : 'Pendiente de Abrir'}
                      </span>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(`${window.location.origin}/candidate/${selectedInvestigation.candidateLink}`)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors shadow-sm"
                    >
                      Copiar Enlace
                    </button>
                  </div>
                  <input
                    readOnly
                    value={`${window.location.origin}/candidate/${selectedInvestigation.candidateLink}`}
                    className="mt-3 w-full rounded-lg border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-slate-950 px-3 py-2 text-[11px] font-mono text-slate-800 dark:text-slate-200"
                    aria-label="URL del enlace del candidato"
                  />
                </div>
              )}

              {/* Otros resultados IA (identidad, proveedor). Dictamen crédito va en panel etapa 1. */}
              {!(
                investigationShowsStage1Qualification(selectedInvestigation) &&
                (isReanalyzing || !investigationHasAnyAiSurface(selectedInvestigation))
              ) ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
                    <Brain className="w-4 h-4 mr-2 text-purple-600" />
                    Otros análisis de IA
                  </h4>
                  {investigationHasAnyAiSurface(selectedInvestigation) && (
                    <button
                      type="button"
                      onClick={() => handleReanalyze(selectedInvestigation)}
                      disabled={isReanalyzing}
                      className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium flex items-center gap-1 disabled:opacity-50"
                    >
                      {isReanalyzing ? (
                        <Clock className="w-3 h-3 animate-spin" />
                      ) : (
                        <Bot className="w-3 h-3" />
                      )}
                      {isReanalyzing ? 'Analizando…' : 'Volver a generar con IA'}
                    </button>
                  )}
                </div>

                {isReanalyzing && !investigationShowsStage1Qualification(selectedInvestigation) ? (
                  <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <JuxaVerifyLoader text="Generando dictamen con IA…" />
                  </div>
                ) : !investigationHasAnyAiSurface(selectedInvestigation) &&
                  !investigationShowsStage1Qualification(selectedInvestigation) ? (
                  <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                      No hay resultados de IA disponibles para esta investigación.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
                      Puedes generar un dictamen ahora con el antecedente del expediente (y las fotos si el candidato ya las cargó). Sin evidencia visual el resultado es{' '}
                      <strong className="font-medium text-slate-600 dark:text-slate-300">orientativo</strong>.
                    </p>
                    {(selectedInvestigation.clientProfile === 'HR' ||
                      selectedInvestigation.clientProfile === 'CREDIT' ||
                      selectedInvestigation.clientProfile === 'PROVIDER' ||
                      selectedInvestigation.clientProfile === 'LOONG_MOTOR' ||
                      selectedInvestigation.investigationType === 'CREDIT' ||
                      selectedInvestigation.loongMotorPolicyApplies === true) && (
                      <button
                        type="button"
                        onClick={() => handleReanalyze(selectedInvestigation)}
                        disabled={isReanalyzing}
                        className="mt-4 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        <Brain className="w-4 h-4" />
                        Generar dictamen con IA
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedInvestigation.identityValidationResult && (
                      <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-xl border border-purple-100 dark:border-purple-900/40">
                        <h5 className="text-xs font-bold text-purple-900 dark:text-purple-200 mb-2 flex items-center uppercase tracking-wider">
                          <ShieldAlert className="w-3 h-3 mr-1" />
                          Validación de Identidad
                        </h5>
                        <AIResultRenderer resultString={selectedInvestigation.identityValidationResult} />
                      </div>
                    )}

                    {!investigationShowsStage1Qualification(selectedInvestigation) &&
                      (selectedInvestigation.creditAnalysisResult ||
                        (selectedInvestigation.socioeconomicDictamen &&
                          (selectedInvestigation.clientProfile === 'CREDIT' ||
                            selectedInvestigation.investigationType === 'CREDIT' ||
                            selectedInvestigation.clientProfile === 'LOONG_MOTOR' ||
                            selectedInvestigation.loongMotorPolicyApplies === true))) && (
                      <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                        <h5 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-2 flex items-center uppercase tracking-wider">
                          <Building2 className="w-3 h-3 mr-1" />
                          Análisis de Crédito / Dictamen
                        </h5>
                        <AIResultRenderer
                          resultString={
                            selectedInvestigation.creditAnalysisResult ||
                            String(selectedInvestigation.socioeconomicDictamen)
                          }
                        />
                      </div>
                    )}

                    {selectedInvestigation.providerAnalysisResult && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                        <h5 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-2 flex items-center uppercase tracking-wider">
                          <FileCheck className="w-3 h-3 mr-1" />
                          Análisis de Proveedor / Due Diligence
                        </h5>
                        <AIResultRenderer resultString={selectedInvestigation.providerAnalysisResult} />
                      </div>
                    )}
                  </div>
                )}
              </div>
              ) : null}

              {/* Traceability Evidence */}
              {selectedInvestigation.uploadedFileUrls && Object.keys(selectedInvestigation.uploadedFileUrls).length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center">
                    <ImageIcon className="w-4 h-4 mr-2 text-blue-600" />
                    Evidencia Cargada (Trazabilidad)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {Object.entries(selectedInvestigation.uploadedFileUrls).map(([key, url]: [string, any]) => (
                      <a 
                        key={key}
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="group relative aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-blue-400 transition-all shadow-sm"
                      >
                        <img 
                          src={url} 
                          alt={key} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ExternalLink className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-[10px] font-bold text-white truncate uppercase">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Score Display */}
              {selectedInvestigation.score !== undefined && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-sm mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Puntaje de Crédito IA</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">Basado en políticas personalizadas</p>
                    </div>
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          fill="transparent"
                          stroke="#f1f5f9"
                          strokeWidth="6"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          fill="transparent"
                          stroke={selectedInvestigation.score >= 70 ? "#10b981" : selectedInvestigation.score >= 40 ? "#f59e0b" : "#ef4444"}
                          strokeWidth="6"
                          strokeDasharray={226.2}
                          strokeDashoffset={226.2 - (226.2 * selectedInvestigation.score) / 100}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-xl font-black text-slate-900 dark:text-slate-100">{selectedInvestigation.score}</span>
                    </div>
                  </div>

                  {selectedInvestigation.scoreBreakdown && (
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(JSON.parse(selectedInvestigation.scoreBreakdown)).map(([key, val]: [string, any]) => (
                        <div key={key} className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">{key}</p>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-1">
                            <div 
                              className="h-full bg-blue-500 rounded-full" 
                              style={{ width: `${(val / 40) * 100}%` }} // Normalizing against max weight approx
                            />
                          </div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{val} pts</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Details */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">Detalles Proporcionados</h4>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {selectedInvestigation.details || 'Sin detalles adicionales.'}
                </div>
              </div>

              {/* Specific Details */}
              {(selectedInvestigation.investigationType === 'HR' || selectedInvestigation.investigationType === 'CREDIT') && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">Información Específica</h4>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200">
                    <ul className="space-y-2">
                      {selectedInvestigation.investigationType === 'HR' && (
                        <>
                          {selectedInvestigation.jobProfile && <li><strong>Perfil del Puesto:</strong> {selectedInvestigation.jobProfile}</li>}
                          {selectedInvestigation.cvFileName && <li><strong>Archivo CV:</strong> {selectedInvestigation.cvFileName}</li>}
                        </>
                      )}
                      {selectedInvestigation.investigationType === 'CREDIT' && (
                        <>
                          {selectedInvestigation.visitAddress && <li><strong>Domicilio a Visitar:</strong> {selectedInvestigation.visitAddress}</li>}
                          {selectedInvestigation.contactInfo && <li><strong>Datos de Contacto:</strong> {selectedInvestigation.contactInfo}</li>}
                          {selectedInvestigation.creditAppFileName && <li><strong>Solicitud de Crédito:</strong> {selectedInvestigation.creditAppFileName}</li>}
                          {selectedInvestigation.tipoCredito && <li><strong>Tipo de Crédito:</strong> {selectedInvestigation.tipoCredito}</li>}
                          {selectedInvestigation.montoCreditoCapital && <li><strong>Monto Capital:</strong> ${selectedInvestigation.montoCreditoCapital}</li>}
                          {selectedInvestigation.montoCreditoIntereses && <li><strong>Monto con Intereses:</strong> ${selectedInvestigation.montoCreditoIntereses}</li>}
                          {selectedInvestigation.plazoFinanciamiento && <li><strong>Plazo de Financiamiento:</strong> {selectedInvestigation.plazoFinanciamiento}</li>}
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Provider Specific Details */}
              {selectedInvestigation.clientProfile === 'PROVIDER' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">Archivos del Proveedor</h4>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-sm text-amber-900">
                      <ul className="space-y-2">
                        {selectedInvestigation.providerReferencesFileName && (
                          <li className="flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-amber-600" />
                            <strong>Referencias Comerciales:</strong> {selectedInvestigation.providerReferencesFileName}
                          </li>
                        )}
                        {selectedInvestigation.providerFilesFileName && (
                          <li className="flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-amber-600" />
                            <strong>Cuestionario/Docs:</strong> {selectedInvestigation.providerFilesFileName}
                          </li>
                        )}
                        {!selectedInvestigation.providerReferencesFileName && !selectedInvestigation.providerFilesFileName && (
                          <li className="text-amber-700 italic">No se proporcionaron archivos específicos de proveedor.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Candidate Submitted Data */}
              {selectedInvestigation.candidateData && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">Información del Candidato</h4>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200">
                    <pre className="whitespace-pre-wrap font-sans">
                      {(() => {
                        try {
                          const data = JSON.parse(selectedInvestigation.candidateData);
                          return (
                            <div className="space-y-2">
                              {data.preQualQuestions &&
                                !investigationShowsStage1Qualification(selectedInvestigation) && (
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
                                  <h5 className="text-xs font-bold text-emerald-900 mb-3 uppercase tracking-wider flex items-center">
                                    <Calculator className="w-3 h-3 mr-1" />
                                    Resultados de Pre-calificación
                                  </h5>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                    <p><strong>Monto Solicitado:</strong> ${data.preQualQuestions.montoSolicitado}</p>
                                    <p><strong>Ingresos Mensuales:</strong> ${data.preQualQuestions.ingresosMensuales}</p>
                                    <p><strong>Gastos Mensuales:</strong> ${data.preQualQuestions.gastosMensuales}</p>
                                    <p><strong>Deudas Activas:</strong> {data.preQualQuestions.tieneDeudas === 'si' ? `Sí ($${data.preQualQuestions.montoDeudas})` : 'No'}</p>
                                    <p><strong>Antigüedad Laboral:</strong> {data.preQualQuestions.antiguedadLaboral} años</p>
                                    <p><strong>Tipo de Contrato:</strong> {data.preQualQuestions.tipoContrato}</p>
                                    <p><strong>Vivienda:</strong> {data.preQualQuestions.propiedadVivienda}</p>
                                    <p><strong>Buró (Declarado):</strong> {data.preQualQuestions.buroCredito}</p>
                                  </div>
                                </div>
                              )}
                              {data.mapLocation && <p><strong>Ubicación en Mapa:</strong> {data.mapLocation}</p>}
                              {data.realTimeLocation && <p><strong>Ubicación GPS (Tiempo Real):</strong> {data.realTimeLocation}</p>}
                              {data.distanceMeters !== undefined && <p><strong>Diferencia:</strong> {data.distanceMeters} metros</p>}
                              {data.location && <p><strong>Ubicación:</strong> {data.location}</p>}
                              {data.idFrontName && <p><strong>INE Frente:</strong> {data.idFrontName}</p>}
                              {data.idBackName && <p><strong>INE Reverso:</strong> {data.idBackName}</p>}
                              {data.proofOfAddressName && <p><strong>Comprobante de Domicilio:</strong> {data.proofOfAddressName}</p>}
                              {data.incomeProofName && <p><strong>Comprobante de Ingresos:</strong> {data.incomeProofName}</p>}
                              {data.selfieName && <p><strong>Selfie:</strong> {data.selfieName}</p>}
                              {data.fotoFachadaName && <p><strong>Foto Fachada:</strong> {data.fotoFachadaName}</p>}
                              {data.fotoSalaName && <p><strong>Foto Sala:</strong> {data.fotoSalaName}</p>}
                              {data.fotoComedorName && <p><strong>Foto Comedor:</strong> {data.fotoComedorName}</p>}
                              {data.fotoCocinaName && <p><strong>Foto Cocina:</strong> {data.fotoCocinaName}</p>}
                              {data.fotoHabitacionName && <p><strong>Foto Habitación:</strong> {data.fotoHabitacionName}</p>}
                              {data.ingresoMensual && <p><strong>Ingreso Mensual:</strong> ${data.ingresoMensual} MXN</p>}
                              {data.direccionDeclarada && <p><strong>Dirección Declarada:</strong> {data.direccionDeclarada}</p>}
                              {data.tipoVivienda && <p><strong>Tipo de Vivienda:</strong> {data.tipoVivienda}</p>}
                              {data.antiguedadVivienda && <p><strong>Antigüedad Vivienda:</strong> {data.antiguedadVivienda} años</p>}
                              {data.submittedAt && <p><strong>Fecha de Envío:</strong> {new Date(data.submittedAt).toLocaleString()}</p>}
                              
                              {(data.realTimeLocation || data.mapLocation) && (
                                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">Verificación Geográfica</h4>
                                  <LocationViewer 
                                    lat={parseFloat((data.realTimeLocation || data.mapLocation).split(',')[0])} 
                                    lng={parseFloat((data.realTimeLocation || data.mapLocation).split(',')[1])} 
                                  />
                                </div>
                              )}
                            </div>
                          );
                        } catch (e) {
                          return selectedInvestigation.candidateData;
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950 gap-2">
              {/* {selectedInvestigation.investigationType === 'CREDIT' && selectedInvestigation.status === 'COMPLETED' && (
                <button
                  onClick={() => setIsPagareModalOpen(true)}
                  className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm flex items-center"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generar Pagaré
                </button>
              )} */}
              <button
                onClick={() => handleDownloadPDF(selectedInvestigation)}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                Descargar PDF
              </button>
              <button
                onClick={() => setSelectedInvestigation(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-300 transition-colors shadow-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagare Modal */}
      {isPagareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Generar Pagaré
              </h2>
              <button onClick={() => setIsPagareModalOpen(false)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="pagareForm" onSubmit={handleGeneratePagare} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Monto (Número)</label>
                    <input type="number" name="monto" required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. 50000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Monto (Letra)</label>
                    <input type="text" name="montoLetra" required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. Cincuenta mil pesos 00/100 M.N." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Lugar y Fecha de Expedición</label>
                    <input type="text" name="lugarFecha" required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. Ciudad de México a 24 de Marzo de 2026" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Lugar de Pago</label>
                    <input type="text" name="lugarPago" required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. Ciudad de México" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Fecha de Vencimiento</label>
                    <input type="text" name="fechaVencimiento" required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. 24 de Abril de 2026" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Beneficiario</label>
                    <input type="text" name="beneficiario" required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Nombre de tu empresa" />
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Datos del Deudor</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Nombre del Deudor</label>
                      <input type="text" name="deudorNombre" required defaultValue={selectedInvestigation ? selectedInvestigation.title : ''} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Dirección del Deudor</label>
                      <input type="text" name="deudorDireccion" required defaultValue={selectedInvestigation ? selectedInvestigation.visitAddress : ''} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Teléfono del Deudor</label>
                      <input type="text" name="deudorTelefono" required defaultValue={selectedInvestigation ? selectedInvestigation.contactInfo : ''} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950 gap-2">
              <button
                type="button"
                onClick={() => setIsPagareModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-300 transition-colors shadow-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="pagareForm"
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="p-4 sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Configuración</h1>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <p className="text-slate-600 dark:text-slate-300">Opciones de configuración de la cuenta.</p>
          </div>
        </div>
      )}
    </DashboardLayout>
    </>
  );
};
