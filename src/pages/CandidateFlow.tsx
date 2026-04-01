import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CheckCircle2, MapPin, Camera, Upload, ShieldCheck, AlertCircle, Home, DollarSign, Navigation, RefreshCw, FileText, Brain, Shield, Lock, Clock, Loader2 } from 'lucide-react';
import { useJsApiLoader, Autocomplete, GoogleMap, Marker } from '@react-google-maps/api';
import heic2any from 'heic2any';
import { JuxaVerifyLoader } from '../components/JuxaVerifyLoader';
import { toast } from 'react-hot-toast';
import { computeLoongPrecalScore, evaluateFormalQual, type LoongPrecalInputs } from '../lib/loongMotorCredit';
import {
  buildLoongMotorOfficialAnalysisInjection,
  getLoongMotorCreditPolicyFromFirestore,
} from '../lib/loongMotorPolicyFirestore';
import { getAdaptiveCreditQuestionnaire } from '../lib/creditProductQuestionnaire';
import { evaluateJuxaBasicPrecal } from '../lib/juxaBasicPrecal';

// Utility to compress images
const compressImage = async (file: File, maxWidth = 1024): Promise<File> => {
  if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.heic') && !file.name.toLowerCase().endsWith('.heif')) {
    return file;
  }
  
  let processFile = file;
  if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8
      });
      const blobArray = Array.isArray(convertedBlob) ? convertedBlob : [convertedBlob];
      processFile = new File(blobArray, file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
    } catch (err) {
      console.warn("HEIC conversion failed", err);
      return file; // Fallback
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(processFile);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        const width = img.width * (ratio < 1 ? ratio : 1);
        const height = img.height * (ratio < 1 ? ratio : 1);
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(processFile);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(processFile);
            return;
          }
          const compressedFile = new File([blob], processFile.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        }, 'image/jpeg', 0.7); // 70% quality JPEG
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Unifica captura vendedor (expediente / enlace) + precal del candidato en un solo JSON para mesa y trazabilidad.
 * Los campos del vendedor siguen también en `investigations` (details, contactInfo, etc.); esto evita perder contexto al leer solo `candidateData`.
 */
function buildLoongPrecalPayloadWithVendorContext(
  investigation: Record<string, unknown> | null | undefined,
  linkRow: Record<string, unknown> | null | undefined,
  precalCore: Record<string, unknown>
): Record<string, unknown> {
  const inv = investigation || {};
  const link = linkRow || {};
  const g = (o: Record<string, unknown>, k: string) => (o[k] != null ? o[k] : null);
  return {
    capturaVendedorYEnlace: {
      contactInfo: typeof inv.contactInfo === 'string' ? inv.contactInfo : null,
      detailsNotas: typeof inv.details === 'string' ? inv.details : null,
      title: typeof inv.title === 'string' ? inv.title : null,
      candidateEmail: (g(inv, 'candidateEmail') ?? g(link, 'candidateEmail')) as string | null,
      candidatePhone: (g(inv, 'candidatePhone') ?? g(link, 'candidatePhone')) as string | null,
      candidateCurp: (g(inv, 'candidateCurp') ?? g(link, 'candidateCurp')) as string | null,
      candidateRfc: (g(inv, 'candidateRfc') ?? g(link, 'candidateRfc')) as string | null,
      prefillModeloMoto: typeof link.prefillModeloMoto === 'string' ? link.prefillModeloMoto : null,
      prefillPrecioMoto: typeof link.prefillPrecioMoto === 'number' ? link.prefillPrecioMoto : null,
    },
    flujoOperativo: {
      etapa: 'precal_candidato_completada',
      destino: 'mesa_control',
      descripcion:
        'El candidato envió el cuestionario por el enlace; mesa de control dictamina sobre el mismo expediente.',
    },
    ...precalCore,
  };
}

/** Evita storage/unauthorized: reglas y navegadores no siempre envían image/* en el metadata. */
function storageContentTypeForFile(file: File): string {
  if (file.type && file.type.length > 0) return file.type;
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.heic') || n.endsWith('.heif')) return 'image/jpeg';
  return 'image/jpeg';
}

/** Firestore / integraciones a veces guardan variantes de string; evita flujo con totalSteps mal calculado. */
function mesaPrecalApproved(status: unknown): boolean {
  return typeof status === 'string' && status.trim().toLowerCase() === 'approved';
}

const libraries: ("places")[] = ["places"];

export const CandidateFlow: React.FC = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [linkData, setLinkData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [success, setSuccess] = useState(false);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const searchParams = new URLSearchParams(window.location.search);
  const [phase, setPhase] = useState(searchParams.get('phase') || '1');
  
  const isHR = linkData?.clientProfile === 'HR' || linkData?.investigationType === 'HR';
  const isCredit = linkData?.clientProfile === 'CREDIT' || linkData?.investigationType === 'CREDIT';

  const [step, setStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(2);

  // Form fields
  const [mapPosition, setMapPosition] = useState<{lat: number, lng: number} | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 19.4326, lng: -99.1332 });
  const [realTimeLocation, setRealTimeLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [proofOfAddress, setProofOfAddress] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  
  // Socioeconomic fields
  const [ingresoMensual, setIngresoMensual] = useState('');
  const [gastosMensuales, setGastosMensuales] = useState('');
  const [ocupacion, setOcupacion] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('Soltero(a)');
  const [dependientesEconomicos, setDependientesEconomicos] = useState('0');
  const [direccionDeclarada, setDireccionDeclarada] = useState('');
  const [tipoVivienda, setTipoVivienda] = useState('Propia');
  const [antiguedadVivienda, setAntiguedadVivienda] = useState('');
  const [comprobanteIngresos, setComprobanteIngresos] = useState<File | null>(null);
  const [fotoFachada, setFotoFachada] = useState<File | null>(null);
  const [fotoSala, setFotoSala] = useState<File | null>(null);
  const [fotoComedor, setFotoComedor] = useState<File | null>(null);
  const [fotoCocina, setFotoCocina] = useState<File | null>(null);
  const [fotoHabitacion, setFotoHabitacion] = useState<File | null>(null);
  const [uploadedFileUrls, setUploadedFileUrls] = useState<{ [key: string]: string }>({});

  // Pre-qualification questions (Phase 1 Credit Basic)
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

  // Address Search
  const autocompleteRef = useRef<any>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMapPosition({ lat, lng });
    setMapCenter({ lat, lng });
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        setDireccionDeclarada(results[0].formatted_address);
      }
    });
  };

  const handlePlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setMapPosition({ lat, lng });
        setMapCenter({ lat, lng });
        if (place.formatted_address) {
          setDireccionDeclarada(place.formatted_address);
        }
      }
    }
  };

  const [investigationData, setInvestigationData] = useState<any>(null);

  const [modeloMoto, setModeloMoto] = useState('');
  const [precioMoto, setPrecioMoto] = useState('');
  const [modeloMotocicletaCuestionario, setModeloMotocicletaCuestionario] = useState('');
  const [valorMotocicletaEstimado, setValorMotocicletaEstimado] = useState('');
  const [referenciaTelefonoCredito, setReferenciaTelefonoCredito] = useState('');
  const [telefonoSolicitante, setTelefonoSolicitante] = useState('');
  const [intakeTerminal, setIntakeTerminal] = useState<
    null | 'mesa_pending' | 'precal_fail' | 'mesa_rejected'
  >(null);
  const [engancheMoto, setEngancheMoto] = useState('');
  const [plazoMesesLoong, setPlazoMesesLoong] = useState('24');
  const [antiguedadLaboralMeses, setAntiguedadLaboralMeses] = useState('');
  const [montoDeudasLoong, setMontoDeudasLoong] = useState('0');

  const isLoongMotor = linkData?.clientProfile === 'LOONG_MOTOR' || linkData?.investigationType === 'LOONG_MOTOR';
  const loongPhase2Unlocked =
    investigationData?.loongPhase2Unlocked === true ||
    linkData?.investigationScope === 'INTEGRAL' ||
    investigationData?.investigationScope === 'INTEGRAL';
  const isLoongPrecalOnly = Boolean(
    isLoongMotor && linkData?.investigationScope === 'LOONG_PRECAL' && !loongPhase2Unlocked
  );
  const isLoongFormalQualOnly = Boolean(isLoongMotor && linkData?.investigationScope === 'LOONG_FORMAL_QUAL');
  const isLoongFullCredit = Boolean(isLoongMotor && loongPhase2Unlocked);
  const isCreditFlow = isCredit || isLoongFullCredit;

  const creditAmountForRules = useMemo(() => {
    const fromInv =
      typeof investigationData?.montoCreditoCapital === 'number'
        ? investigationData.montoCreditoCapital
        : Number(investigationData?.montoCreditoCapital) || 0;
    const fromPre = Number(preQualQuestions.montoSolicitado) || 0;
    return fromInv > 0 ? fromInv : fromPre;
  }, [investigationData?.montoCreditoCapital, preQualQuestions.montoSolicitado]);

  const adaptiveCreditQ = useMemo(
    () =>
      getAdaptiveCreditQuestionnaire(
        linkData?.tipoCredito ?? investigationData?.tipoCredito,
        linkData?.riskSegment ?? investigationData?.riskSegment,
        creditAmountForRules
      ),
    [
      linkData?.tipoCredito,
      linkData?.riskSegment,
      investigationData?.tipoCredito,
      investigationData?.riskSegment,
      creditAmountForRules,
    ]
  );

  const basicJuxaOriginacion =
    !!linkData &&
    linkData.investigationScope === 'BASIC' &&
    (linkData.clientProfile === 'CREDIT' || linkData.investigationType === 'CREDIT');
  /** Fase 2 (ubicación + documentos): explícita o implícita si mesa ya dictaminó aprobado. */
  const originacionPhase2Ok =
    investigationData?.originacionPhase2Unlocked === true ||
    mesaPrecalApproved(investigationData?.mesaPrecalStatus);
  const mesaPrecalPending = investigationData?.mesaPrecalStatus === 'pending';
  const mesaPrecalFailOrReject =
    investigationData?.mesaPrecalStatus === 'rejected' ||
    investigationData?.mesaPrecalStatus === 'precal_failed';

  /** Si mesa ya aprobó BASIC, el flujo es siempre 3 pasos; evita totalSteps=2 y envío final en paso 2 (socio). */
  const effectiveTotalSteps = useMemo(() => {
    if (!linkData || phase !== '1') return totalSteps;
    const isCred = linkData.clientProfile === 'CREDIT' || linkData.investigationType === 'CREDIT';
    const p2 =
      investigationData?.originacionPhase2Unlocked === true ||
      mesaPrecalApproved(investigationData?.mesaPrecalStatus);
    if (isCred && linkData.investigationScope === 'BASIC' && p2) {
      return Math.max(totalSteps, 3);
    }
    return totalSteps;
  }, [linkData, investigationData, phase, totalSteps]);

  useEffect(() => {
    if (!linkData || phase !== '1') return;
    const isCred = linkData.clientProfile === 'CREDIT' || linkData.investigationType === 'CREDIT';
    const p2 =
      investigationData?.originacionPhase2Unlocked === true ||
      mesaPrecalApproved(investigationData?.mesaPrecalStatus);
    if (isCred && linkData.investigationScope === 'BASIC' && p2 && totalSteps < 3) {
      setTotalSteps(3);
    }
  }, [linkData, investigationData, phase, totalSteps]);

  useEffect(() => {
    const fetchLinkData = async () => {
      if (!linkId) {
        setError('Enlace inválido.');
        setLoading(false);
        return;
      }

      try {
        console.log(`[CandidateFlow] Fetching link data for linkId: ${linkId}, phase: ${phase}`);
        const linkRef = doc(db, 'candidate_links', linkId);
        const linkSnap = await getDoc(linkRef);

        if (!linkSnap.exists()) {
          console.error("[CandidateFlow] Link document not found");
          setError('El enlace no existe o ha expirado.');
          setLoading(false);
          return;
        }

        const data = linkSnap.data();
        console.log("[CandidateFlow] Link data fetched:", data);
        
        if (!data.investigationId) {
          console.error("[CandidateFlow] Missing investigationId in link data");
          setError('Error de configuración: No se encontró el ID de investigación.');
          setLoading(false);
          return;
        }
        
        const linkRow = { id: linkSnap.id, ...data } as any;
        setLinkData(linkRow);

        // Prefill Loong precal links (vendor/admin can seed model & price).
        if (
          (linkRow?.clientProfile === 'LOONG_MOTOR' || linkRow?.investigationType === 'LOONG_MOTOR') &&
          linkRow?.investigationScope === 'LOONG_PRECAL'
        ) {
          if (!modeloMoto.trim() && typeof linkRow.prefillModeloMoto === 'string') {
            setModeloMoto(linkRow.prefillModeloMoto);
          }
          if (!precioMoto && (typeof linkRow.prefillPrecioMoto === 'number' || typeof linkRow.prefillPrecioMoto === 'string')) {
            const n = Number(linkRow.prefillPrecioMoto);
            if (Number.isFinite(n) && n > 0) setPrecioMoto(String(n));
          }
        }

        const currentIsHR = data.clientProfile === 'HR' || data.investigationType === 'HR';
        const currentIsCredit = data.clientProfile === 'CREDIT' || data.investigationType === 'CREDIT';

        // Fetch investigation data
        console.log(`[CandidateFlow] Fetching investigation data for: ${data.investigationId}`);
        const invRef = doc(db, 'investigations', data.investigationId);
        const invSnap = await getDoc(invRef);
        const invData = invSnap.exists() ? invSnap.data() : null;
        if (invSnap.exists()) {
          console.log("[CandidateFlow] Investigation data fetched:", invData);
          setInvestigationData({ id: invSnap.id, ...invData });
          if (
            currentIsCredit &&
            data.investigationScope === 'BASIC' &&
            typeof invData?.montoCreditoCapital === 'number' &&
            invData.montoCreditoCapital > 0
          ) {
            setPreQualQuestions((prev) => ({
              ...prev,
              montoSolicitado: String(invData.montoCreditoCapital),
            }));
          }
          if (currentIsCredit && data.investigationScope === 'BASIC' && typeof invData?.candidateData === 'string') {
            try {
              const cd = JSON.parse(invData.candidateData);
              if (cd.telefonoSolicitante && typeof cd.telefonoSolicitante === 'string') {
                setTelefonoSolicitante(cd.telefonoSolicitante);
              }
              if (cd.preQualQuestions && typeof cd.preQualQuestions === 'object') {
                setPreQualQuestions((prev) => ({ ...prev, ...cd.preQualQuestions }));
              }
              if (typeof cd.modeloMotocicletaCuestionario === 'string') {
                setModeloMotocicletaCuestionario(cd.modeloMotocicletaCuestionario);
              }
              if (typeof cd.valorMotocicletaEstimado === 'string') {
                setValorMotocicletaEstimado(cd.valorMotocicletaEstimado);
              }
              if (typeof cd.referenciaTelefonoCredito === 'string') {
                setReferenciaTelefonoCredito(cd.referenciaTelefonoCredito);
              }
            } catch {
              /* ignore */
            }
          }
        } else {
          console.warn("[CandidateFlow] Investigation document not found:", data.investigationId);
        }

        const curIsLoong = data.clientProfile === 'LOONG_MOTOR' || data.investigationType === 'LOONG_MOTOR';
        const invUnlocked =
          invData?.loongPhase2Unlocked === true ||
          data.investigationScope === 'INTEGRAL' ||
          invData?.investigationScope === 'INTEGRAL';
        const curIsLoongFull = curIsLoong && invUnlocked;

        console.log(
          `[CandidateFlow] Client Profile: ${data.clientProfile}, isHR: ${currentIsHR}, isCredit: ${currentIsCredit}, loongFull: ${curIsLoongFull}`
        );

        const currentPhase = searchParams.get('phase') || '1';
        setPhase(currentPhase);

        if (curIsLoong && data.investigationScope === 'LOONG_PRECAL' && !invUnlocked) {
          setTotalSteps(1);
        } else if (curIsLoong && data.investigationScope === 'LOONG_FORMAL_QUAL') {
          setTotalSteps(1);
        } else if (curIsLoongFull) {
          if (data.investigationScope === 'BASIC') {
            setTotalSteps(2);
          } else if (data.investigationScope === 'INTEGRAL' && currentPhase === '2') {
            setTotalSteps(2);
          } else {
            setTotalSteps(3);
          }
        } else if (currentIsCredit) {
          if (data.investigationScope === 'BASIC') {
            const ms = invData?.mesaPrecalStatus as string | undefined;
            const p2 =
              invData?.originacionPhase2Unlocked === true || mesaPrecalApproved(ms);
            if (p2) {
              setTotalSteps(3);
              setStep(1);
            } else if (ms === 'pending' || ms === 'rejected' || ms === 'precal_failed') {
              setTotalSteps(1);
            } else {
              setTotalSteps(1);
            }
          } else if (data.investigationScope === 'INTEGRAL' && currentPhase === '2') {
            setTotalSteps(2);
          } else {
            setTotalSteps(3);
          }
        } else if (currentIsHR) {
          setTotalSteps(2);
        } else {
          setTotalSteps(2);
        }

        if (curIsLoong && data.investigationScope === 'LOONG_PRECAL' && !invUnlocked && data.status === 'PHASE_1_COMPLETED') {
          const ms = invData?.mesaPrecalStatus as string | undefined;
          if (ms === 'pending') {
            setSuccess(false);
          } else if ((ms == null || ms === '') && typeof invData?.score === 'number') {
            setSuccess(true);
          } else if (ms === 'rejected' || ms === 'precal_failed') {
            setIntakeTerminal(ms === 'precal_failed' ? 'precal_fail' : 'mesa_rejected');
          }
        }

        if (curIsLoong && currentPhase === '2' && data.investigationScope === 'LOONG_PRECAL' && !invUnlocked) {
          setError(
            'Tu asesor Loong Motor aún no habilita la documentación y la visita. Vuelve a abrir este enlace cuando te avisen.'
          );
          setLoading(false);
          return;
        }

        if (data.status === 'COMPLETED') {
          const msEarly = invData?.mesaPrecalStatus as string | undefined;
          if (
            curIsLoong &&
            data.investigationScope === 'LOONG_PRECAL' &&
            (msEarly === 'rejected' || msEarly === 'precal_failed')
          ) {
            setIntakeTerminal(msEarly === 'precal_failed' ? 'precal_fail' : 'mesa_rejected');
            setLoading(false);
            return;
          }
          if (
            currentIsCredit &&
            data.investigationScope === 'BASIC' &&
            (msEarly === 'precal_failed' || msEarly === 'rejected')
          ) {
            setIntakeTerminal(msEarly === 'precal_failed' ? 'precal_fail' : 'mesa_rejected');
            setLoading(false);
            return;
          }
          console.log("[CandidateFlow] Status is COMPLETED, showing success");
          setSuccess(true);
          setLoading(false);
          return;
        }

        console.log(`[CandidateFlow] Current status: ${data.status}, Phase: ${phase}`);
        if (
          !currentIsHR &&
          !currentIsCredit &&
          !curIsLoongFull &&
          data.investigationScope !== 'LOONG_FORMAL_QUAL' &&
          currentPhase === '2' &&
          data.status !== 'PHASE_1_COMPLETED' &&
          data.status !== 'COMPLETED'
        ) {
          console.warn("[CandidateFlow] Phase 2 requested but Phase 1 not completed. Redirecting to Phase 1.");
          setPhase('1');
          setStep(1);
        }

        // Update status to OPENED if it was PENDING
        if (data.status === 'PENDING') {
          console.log("[CandidateFlow] Updating status to OPENED");
          try {
            await updateDoc(doc(db, 'candidate_links', linkSnap.id), {
              status: 'OPENED',
              updatedAt: new Date().toISOString()
            });
            // Also update the investigation document
            await updateDoc(doc(db, 'investigations', data.investigationId), {
              linkStatus: 'OPENED',
              updatedAt: new Date().toISOString()
            });
          } catch (updateErr) {
            console.warn("[CandidateFlow] Failed to update status to OPENED (non-critical):", updateErr);
          }
        }

      } catch (err) {
        console.error("Error fetching link data:", err);
        setError('Ocurrió un error al cargar la información. Por favor, intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    fetchLinkData();
  }, [linkId, phase]);

  const handleNextStep = () => {
    if (step < effectiveTotalSteps) {
      if (step === 1) {
        if (isLoongPrecalOnly || isLoongFormalQualOnly) {
          /* precal / calificación formal: solo formulario, sin mapa */
        } else if (linkData?.investigationScope === 'BASIC') {
          const aq = getAdaptiveCreditQuestionnaire(
            linkData?.tipoCredito ?? investigationData?.tipoCredito,
            linkData?.riskSegment ?? investigationData?.riskSegment,
            creditAmountForRules
          );
          if (aq.showMotorcycleFields) {
            if (!modeloMotocicletaCuestionario.trim() || !valorMotocicletaEstimado.trim()) {
              toast.error('Indica modelo y valor estimado de la motocicleta.', { id: 'moto-prequal' });
              return;
            }
          }
          if (aq.requirePersonalReferencePhone && referenciaTelefonoCredito.replace(/\D/g, '').length < 10) {
            toast.error('Indica un teléfono de referencia válido (mín. 10 dígitos).', { id: 'ref-phone' });
            return;
          }
          if (
            phase === '1' &&
            originacionPhase2Ok &&
            (!mapPosition || !realTimeLocation)
          ) {
            toast.error("Debes seleccionar tu dirección en el mapa y capturar tu GPS para continuar.", { id: 'gps-error' });
            return;
          }
        } else if (
          phase === '1' &&
          (!mapPosition || !realTimeLocation)
        ) {
          toast.error("Debes seleccionar tu dirección en el mapa y capturar tu GPS para continuar.", { id: 'gps-error' });
          return;
        }
      } else if (
        step === 2 &&
        phase === '1' &&
        isCreditFlow &&
        (linkData?.investigationScope !== 'BASIC' || originacionPhase2Ok)
      ) {
        if (!ingresoMensual || !gastosMensuales || !ocupacion || !direccionDeclarada || !antiguedadVivienda || !comprobanteIngresos) {
          toast.error("Por favor, completa todos los campos y sube tu comprobante de ingresos para continuar.", { id: 'socio-error' });
          return;
        }
      }
      setStep(s => s + 1);
    }
  };

  const handlePrevStep = () => {
    setStep(s => Math.max(s - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkData) {
      console.error("Submit attempted without linkData");
      return;
    }

    const onCreditPhase1SocioStep =
      isCreditFlow &&
      phase === '1' &&
      step === 2 &&
      (linkData?.investigationScope !== 'BASIC' || originacionPhase2Ok) &&
      linkData?.investigationScope !== 'LOONG_PRECAL' &&
      linkData?.investigationScope !== 'LOONG_FORMAL_QUAL';

    console.log(
      `Submitting step ${step}/${effectiveTotalSteps} (totalSteps state ${totalSteps}) (Phase ${phase}, HR: ${isHR}, CreditFlow: ${isCreditFlow})`
    );

    const invUnlockedSubmit =
      investigationData?.loongPhase2Unlocked === true ||
      linkData?.investigationScope === 'INTEGRAL' ||
      investigationData?.investigationScope === 'INTEGRAL';
    const isLoongPrecalSubmit =
      linkData.clientProfile === 'LOONG_MOTOR' &&
      linkData.investigationScope === 'LOONG_PRECAL' &&
      !invUnlockedSubmit;

    if (isLoongPrecalSubmit && phase === '1' && step >= totalSteps) {
      if (!modeloMoto.trim() || !precioMoto || !engancheMoto || !plazoMesesLoong || !ingresoMensual || !gastosMensuales || !antiguedadLaboralMeses) {
        toast.error('Completa todos los campos de la precalificación Loong Motor.');
        return;
      }
      setIsSubmitting(true);
      setProgressText('Calculando precalificación…');
      try {
        const policy = await getLoongMotorCreditPolicyFromFirestore(db, linkData.organizationId ?? null);
        const inputs: LoongPrecalInputs = {
          precioMoto: Number(precioMoto),
          enganche: Number(engancheMoto),
          plazoMeses: Number(plazoMesesLoong),
          ingresoMensual: Number(ingresoMensual),
          gastosMensuales: Number(gastosMensuales),
          antiguedadLaboralMeses: Number(antiguedadLaboralMeses),
          montoDeudas: Number(montoDeudasLoong) || 0,
          buroNivel: 'sin_historial',
        };
        const result = computeLoongPrecalScore(inputs, policy);
        const precalCore = {
          loongPrecal: true,
          modeloMoto,
          policySnapshot: policy,
          ...inputs,
          score: result.score,
          passed: result.passed,
          breakdown: result.breakdown,
          reasons: result.reasons,
          estimatedPayment: result.estimatedPayment,
          submittedAt: new Date().toISOString(),
        };
        const payload = buildLoongPrecalPayloadWithVendorContext(
          investigationData,
          linkData,
          precalCore
        );
        await updateDoc(doc(db, 'candidate_links', linkData.id), {
          status: 'PHASE_1_COMPLETED',
          candidateData: JSON.stringify(payload),
          updatedAt: new Date().toISOString(),
        });
        const nowIso = new Date().toISOString();
        await updateDoc(doc(db, 'investigations', linkData.investigationId), {
          linkStatus: 'PHASE_1_COMPLETED',
          candidateData: JSON.stringify(payload),
          creditStage: 'PRE_QUALIFICATION',
          score: result.score,
          scoreBreakdown: JSON.stringify(result.breakdown),
          montoCreditoCapital: inputs.precioMoto - inputs.enganche,
          plazoFinanciamiento: `${inputs.plazoMeses} meses`,
          tipoCredito: 'Crédito moto Loong Motor',
          status: 'REQUIRES_ATTENTION',
          mesaPrecalStatus: 'pending',
          mesaPrecalAutoPassed: result.passed,
          mesaPrecalAutoReasons: JSON.stringify(result.reasons),
          mesaAutomatedDictamen:
            `Precal Loong Motor: score ${result.score} · ${result.passed ? 'referencia favorable' : 'requiere criterio de mesa'}`,
          updatedAt: nowIso,
        });
        setInvestigationData((prev) =>
          prev && prev.id === linkData.investigationId
            ? {
                ...prev,
                linkStatus: 'PHASE_1_COMPLETED',
                candidateData: JSON.stringify(payload),
                creditStage: 'PRE_QUALIFICATION',
                score: result.score,
                status: 'REQUIRES_ATTENTION',
                mesaPrecalStatus: 'pending',
                mesaPrecalAutoPassed: result.passed,
                mesaPrecalAutoReasons: JSON.stringify(result.reasons),
                mesaAutomatedDictamen: `Precal Loong Motor: score ${result.score} · ${result.passed ? 'referencia favorable' : 'requiere criterio de mesa'}`,
                updatedAt: nowIso,
              }
            : prev
        );
        setSuccess(false);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Error al guardar precalificación.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const isLoongFormalQualSubmit =
      linkData.clientProfile === 'LOONG_MOTOR' && linkData.investigationScope === 'LOONG_FORMAL_QUAL';

    if (isLoongFormalQualSubmit && phase === '1' && step >= totalSteps) {
      if (
        !modeloMoto.trim() ||
        !precioMoto ||
        !engancheMoto ||
        !plazoMesesLoong ||
        !ingresoMensual ||
        !gastosMensuales ||
        !antiguedadLaboralMeses
      ) {
        toast.error('Completa todos los campos de la calificación formal Loong Motor.');
        return;
      }
      if (!linkData.loongOriginationCaseId || typeof linkData.loongCaseAdvanceSecret !== 'string') {
        toast.error('Enlace incompleto: falta expediente de originación. Solicita un nuevo enlace a tu asesor.');
        return;
      }
      setIsSubmitting(true);
      setProgressText('Evaluando calificación formal…');
      try {
        const policy = await getLoongMotorCreditPolicyFromFirestore(db, linkData.organizationId ?? null);
        const inputs: LoongPrecalInputs = {
          precioMoto: Number(precioMoto),
          enganche: Number(engancheMoto),
          plazoMeses: Number(plazoMesesLoong),
          ingresoMensual: Number(ingresoMensual),
          gastosMensuales: Number(gastosMensuales),
          antiguedadLaboralMeses: Number(antiguedadLaboralMeses),
          montoDeudas: Number(montoDeudasLoong) || 0,
          buroNivel: 'sin_historial',
        };
        const result = computeLoongPrecalScore(inputs, policy);
        const formal = evaluateFormalQual(result, policy);
        const now = new Date().toISOString();
        const payload = {
          loongFormalQual: true,
          modeloMoto,
          policySnapshot: policy,
          formalMinRequired: formal.minRequired,
          formalPassed: formal.passed,
          ...inputs,
          score: result.score,
          passed: result.passed,
          breakdown: result.breakdown,
          reasons: result.reasons,
          estimatedPayment: result.estimatedPayment,
          submittedAt: now,
        };
        await updateDoc(doc(db, 'candidate_links', linkData.id), {
          status: 'COMPLETED',
          candidateData: JSON.stringify(payload),
          updatedAt: now,
        });
        await updateDoc(doc(db, 'investigations', linkData.investigationId), {
          linkStatus: 'COMPLETED',
          candidateData: JSON.stringify(payload),
          creditStage: 'QUALIFICATION',
          score: result.score,
          scoreBreakdown: JSON.stringify(result.breakdown),
          montoCreditoCapital: inputs.precioMoto - inputs.enganche,
          plazoFinanciamiento: `${inputs.plazoMeses} meses`,
          tipoCredito: 'Calificación formal moto Loong',
          status: 'COMPLETED',
          updatedAt: now,
        });
        const caseRef = doc(db, 'loong_origination_cases', linkData.loongOriginationCaseId);
        const secret = linkData.loongCaseAdvanceSecret;
        if (formal.passed) {
          await updateDoc(caseRef, {
            originationStage: 'CALIFICACION_FORMAL_OK',
            updatedAt: now,
            formalQualScore: result.score,
            formalQualPassed: true,
            formalQualAdvanceSecret: secret,
          });
        } else {
          await updateDoc(caseRef, {
            updatedAt: now,
            formalQualScore: result.score,
            formalQualPassed: false,
          });
        }
        setLinkData((prev) =>
          prev
            ? {
                ...prev,
                status: 'COMPLETED',
                candidateData: JSON.stringify(payload),
                updatedAt: now,
              }
            : null
        );
        setSuccess(true);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Error al guardar calificación formal.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (step < effectiveTotalSteps) {
      handleNextStep();
      return;
    }

    // Envío del formulario (p. ej. Enter en Safari) con totalSteps desincronizado: paso 2 socio tratado como final.
    if (onCreditPhase1SocioStep) {
      setTotalSteps((t) => Math.max(t, 3));
      setStep(3);
      return;
    }

    const basicOrigSubmit =
      linkData.investigationScope === 'BASIC' &&
      (linkData.clientProfile === 'CREDIT' || linkData.investigationType === 'CREDIT');
    const p2Unlock =
      investigationData?.originacionPhase2Unlocked === true ||
      mesaPrecalApproved(investigationData?.mesaPrecalStatus);
    const mesaSt = investigationData?.mesaPrecalStatus as string | undefined;

    if (
      basicOrigSubmit &&
      !p2Unlock &&
      mesaSt !== 'pending' &&
      mesaSt !== 'approved' &&
      step >= totalSteps
    ) {
      const telDigits = telefonoSolicitante.replace(/\D/g, '');
      if (telDigits.length < 10) {
        toast.error('Indica un teléfono de contacto válido (10 dígitos mínimo).', { id: 'tel-req' });
        return;
      }
      const pq = preQualQuestions;
      if (!pq.montoSolicitado || !pq.ingresosMensuales || !pq.gastosMensuales) {
        toast.error('Completa el cuestionario (monto, ingresos y gastos).', { id: 'pq-req' });
        return;
      }
      const aq = getAdaptiveCreditQuestionnaire(
        linkData?.tipoCredito ?? investigationData?.tipoCredito,
        linkData?.riskSegment ?? investigationData?.riskSegment,
        creditAmountForRules
      );
      if (aq.showMotorcycleFields && (!modeloMotocicletaCuestionario.trim() || !valorMotocicletaEstimado.trim())) {
        toast.error('Indica modelo y valor estimado de la motocicleta (solicitante).', { id: 'moto-req' });
        return;
      }
      if (aq.requirePersonalReferencePhone && referenciaTelefonoCredito.replace(/\D/g, '').length < 10) {
        toast.error('Indica teléfono de referencia (segmento de riesgo).', { id: 'ref-req' });
        return;
      }

      const monto = Number(pq.montoSolicitado) || 0;
      const precal = evaluateJuxaBasicPrecal({
        montoSolicitado: monto,
        ingresosMensuales: Number(pq.ingresosMensuales) || 0,
        gastosMensuales: Number(pq.gastosMensuales) || 0,
        tieneDeudas: pq.tieneDeudas,
        montoDeudas: Number(pq.montoDeudas) || 0,
      });

      const now = new Date().toISOString();
      const intakePayload = {
        intakePhase: 'questionnaire_phone_precal',
        telefonoSolicitante,
        preQualQuestions: pq,
        adaptiveCreditQuestionnaire: aq,
        modeloMotocicletaCuestionario: modeloMotocicletaCuestionario.trim() || null,
        valorMotocicletaEstimado: valorMotocicletaEstimado.trim() || null,
        referenciaTelefonoCredito: referenciaTelefonoCredito.trim() || null,
        juxaPrecalAutomatico: precal,
        submittedAt: now,
      };

      setIsSubmitting(true);
      try {
        if (!precal.autoPassed) {
          await updateDoc(doc(db, 'investigations', linkData.investigationId), {
            candidateData: JSON.stringify({
              ...intakePayload,
              terminal: 'precal_automatico',
            }),
            mesaPrecalStatus: 'precal_failed',
            mesaPrecalAutoPassed: false,
            mesaPrecalAutoReasons: JSON.stringify(precal.reasons),
            mesaAutomatedDictamen: precal.summaryLine,
            status: 'REQUIRES_ATTENTION',
            linkStatus: 'COMPLETED',
            creditStage: 'MESA_CONTROL',
            updatedAt: now,
          });
          await updateDoc(doc(db, 'candidate_links', linkData.id), {
            status: 'COMPLETED',
            candidateData: JSON.stringify({
              ...intakePayload,
              terminal: 'precal_automatico',
            }),
            updatedAt: now,
          });
          setIntakeTerminal('precal_fail');
          setInvestigationData((prev: any) =>
            prev
              ? {
                  ...prev,
                  mesaPrecalStatus: 'precal_failed',
                  candidateData: JSON.stringify(intakePayload),
                  status: 'REQUIRES_ATTENTION',
                  linkStatus: 'COMPLETED',
                }
              : prev
          );
        } else {
          await updateDoc(doc(db, 'investigations', linkData.investigationId), {
            candidateData: JSON.stringify(intakePayload),
            mesaPrecalStatus: 'pending',
            mesaPrecalAutoPassed: true,
            mesaPrecalAutoReasons: JSON.stringify(precal.reasons),
            mesaAutomatedDictamen: precal.summaryLine,
            status: 'IN_PROGRESS',
            linkStatus: 'AWAITING_MESA',
            creditStage: 'MESA_CONTROL',
            updatedAt: now,
          });
          await updateDoc(doc(db, 'candidate_links', linkData.id), {
            status: 'IN_PROGRESS',
            candidateData: JSON.stringify(intakePayload),
            updatedAt: now,
          });
          setIntakeTerminal('mesa_pending');
          setInvestigationData((prev: any) =>
            prev
              ? {
                  ...prev,
                  mesaPrecalStatus: 'pending',
                  candidateData: JSON.stringify(intakePayload),
                  status: 'IN_PROGRESS',
                  linkStatus: 'AWAITING_MESA',
                }
              : prev
          );
          setSuccess(true);
        }
      } catch (err: unknown) {
        console.error('[CandidateFlow intake]', err);
        const code =
          err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
        const msg =
          code === 'permission-denied'
            ? 'No se pudo guardar (permisos del servidor). Actualiza la página o contacta soporte.'
            : 'No se pudo enviar tu información. Intenta de nuevo.';
        toast.error(msg, { id: 'intake-err' });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!isHR && !isCreditFlow && phase === '1') {
      // Validate step 2 (Socioeconomic / Pre-calificación)
      if (!ingresoMensual || !gastosMensuales || !ocupacion || !direccionDeclarada || !antiguedadVivienda || (isCreditFlow && !comprobanteIngresos)) {
        alert("Por favor, completa todos los campos requeridos para tu pre-calificación.");
        return;
      }

      setIsSubmitting(true);
      setProgress(50);
      setProgressText('Guardando información de pre-calificación...');
      
      try {
        const candidateSubmittedData = {
          mapLocation: mapPosition ? `${mapPosition.lat.toFixed(6)}, ${mapPosition.lng.toFixed(6)}` : 'No proporcionada',
          realTimeLocation: realTimeLocation ? `${realTimeLocation.lat.toFixed(6)}, ${realTimeLocation.lng.toFixed(6)}` : 'No proporcionada',
          ingresoMensual,
          gastosMensuales,
          ocupacion,
          estadoCivil,
          dependientesEconomicos,
          direccionDeclarada,
          tipoVivienda,
          antiguedadVivienda
        };

        try {
          await updateDoc(doc(db, 'candidate_links', linkData.id), {
            status: 'PHASE_1_COMPLETED',
            candidateData: JSON.stringify(candidateSubmittedData),
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Error updating candidate_link:", err);
          throw err;
        }

        try {
          await updateDoc(doc(db, 'investigations', linkData.investigationId), {
            linkStatus: 'PHASE_1_COMPLETED',
            candidateData: JSON.stringify(candidateSubmittedData),
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Error updating investigation:", err);
          throw err;
        }

        setLinkData(prev => prev ? {
          ...prev,
          status: 'PHASE_1_COMPLETED',
          candidateData: JSON.stringify(candidateSubmittedData)
        } : null);

        setSuccess(true);
        setIsSubmitting(false);
      } catch (err: any) {
        console.error("Error submitting phase 1:", err);
        setError(`Error al guardar la información: ${err.message || 'Error desconocido'}. Por favor, intenta de nuevo.`);
        setIsSubmitting(false);
      }
      return;
    }

    // Solo en fase 1: el perfil socioeconómico y comprobante se capturan en el paso 2 del flujo.
    // En fase 2 (documentación adicional) o tras recargar, esos datos ya pueden estar en Firestore — no bloquear aquí.
    if (
      phase === '1' &&
      isCreditFlow &&
      (!basicJuxaOriginacion || originacionPhase2Ok)
    ) {
      if (!ingresoMensual || !gastosMensuales || !ocupacion || !direccionDeclarada || !antiguedadVivienda || !comprobanteIngresos) {
        alert("Por favor, completa todos los campos de tu perfil socioeconómico y sube tu comprobante de ingresos antes de enviar.");
        return;
      }
    }

    const amountRules =
      Number(investigationData?.montoCreditoCapital) ||
      Number(preQualQuestions.montoSolicitado) ||
      0;
    const adaptiveSubmit = getAdaptiveCreditQuestionnaire(
      linkData?.tipoCredito ?? investigationData?.tipoCredito,
      linkData?.riskSegment ?? investigationData?.riskSegment,
      amountRules
    );

    let priorCd: Record<string, any> = {};
    try {
      if (linkData.candidateData) priorCd = JSON.parse(linkData.candidateData);
    } catch {
      priorCd = {};
    }
    const hasIdFromIntake =
      !!basicJuxaOriginacion &&
      originacionPhase2Ok &&
      typeof priorCd.idFrontUrl === 'string' &&
      typeof priorCd.idBackUrl === 'string';

    const missingFiles = [];
    if (!idFront && !hasIdFromIntake) missingFiles.push("INE Frente");
    if (!idBack && !hasIdFromIntake) missingFiles.push("INE Reverso");
    if (!proofOfAddress) missingFiles.push("Comprobante de Domicilio");
    if (!selfie) missingFiles.push("Selfie");
    if (!fotoFachada) missingFiles.push("Foto de Fachada");

    if (!isHR) {
      if (adaptiveSubmit.requireSala && !fotoSala) missingFiles.push("Foto de la Sala");
      if (adaptiveSubmit.requireComedor && !fotoComedor) missingFiles.push("Foto del Comedor");
      if (adaptiveSubmit.requireCocina && !fotoCocina) missingFiles.push("Foto de la Cocina");
      if (adaptiveSubmit.requireHabitacion && !fotoHabitacion) missingFiles.push("Foto de la Habitación");
    }

    if (missingFiles.length > 0) {
      if (onCreditPhase1SocioStep) {
        setTotalSteps((t) => Math.max(t, 3));
        setStep(3);
        return;
      }
      alert(`Inconsistencia detectada: Faltan archivos requeridos (${missingFiles.join(", ")}). Por favor, sube todos los documentos para permitir su cotejo.`);
      return;
    }

    setIsSubmitting(true);
    setProgress(10);
    setProgressText('Preparando archivos y validando ubicación...');
    setError('');

    try {
      let phase1Data: any = {};
      if (!isHR && !isCreditFlow) {
        try {
          if (linkData.candidateData) {
            phase1Data = JSON.parse(linkData.candidateData);
          }
        } catch (e) {}
      } else {
        phase1Data = {
          ...priorCd,
          mapLocation: mapPosition ? `${mapPosition.lat.toFixed(6)}, ${mapPosition.lng.toFixed(6)}` : 'No proporcionada',
          realTimeLocation: realTimeLocation ? `${realTimeLocation.lat.toFixed(6)}, ${realTimeLocation.lng.toFixed(6)}` : 'No proporcionada',
          direccionDeclarada: direccionDeclarada || 'No especificada',
          ...(isCreditFlow ? {
            ingresoMensual,
            gastosMensuales,
            ocupacion,
            estadoCivil,
            dependientesEconomicos,
            tipoVivienda,
            antiguedadVivienda,
            preQualQuestions,
            adaptiveCreditQuestionnaire: adaptiveCreditQ,
            modeloMotocicletaCuestionario: modeloMotocicletaCuestionario.trim() || null,
            valorMotocicletaEstimado: valorMotocicletaEstimado.trim() || null,
            referenciaTelefonoCredito: referenciaTelefonoCredito.trim() || null,
          } : {})
        };
      }

      // Calculate distance between map selection and real-time location using Haversine formula
      let distance = 0;
      if (phase1Data.mapLocation && phase1Data.realTimeLocation) {
        const mapLat = parseFloat(phase1Data.mapLocation.split(',')[0]);
        const mapLng = parseFloat(phase1Data.mapLocation.split(',')[1]);
        const realLat = parseFloat(phase1Data.realTimeLocation.split(',')[0]);
        const realLng = parseFloat(phase1Data.realTimeLocation.split(',')[1]);

        const R = 6371e3; // metres
        const φ1 = mapLat * Math.PI/180; // φ, λ in radians
        const φ2 = realLat * Math.PI/180;
        const Δφ = (realLat-mapLat) * Math.PI/180;
        const Δλ = (realLng-mapLng) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distance = R * c; // in metres
      }

      // REACTIVADO: Compresión de imágenes para evitar errores de payload y mejorar velocidad
      setProgressText('Optimizando imágenes para un envío más rápido...');
      setProgress(5);
      
      const safeCompress = async (file: File | null) => {
        if (!file) return null;
        try {
          return await compressImage(file, 1200); // Reducimos a 1200px max
        } catch (e) {
          console.warn("Error comprimiendo archivo, usando original", e);
          return file;
        }
      };
      
      const compFotoFachada = await safeCompress(fotoFachada);
      const compFotoSala = await safeCompress(fotoSala);
      const compFotoComedor = await safeCompress(fotoComedor);
      const compFotoCocina = await safeCompress(fotoCocina);
      const compFotoHabitacion = await safeCompress(fotoHabitacion);
      const compIdFront = await safeCompress(idFront);
      const compIdBack = await safeCompress(idBack);
      const compProof = await safeCompress(proofOfAddress);
      const compSelfie = await safeCompress(selfie);
      const compIncome = await safeCompress(comprobanteIngresos);

      setProgress(5);
      setProgressText('Iniciando subida de documentos...');

      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (anonErr) {
        console.warn('[CandidateFlow] signInAnonymously omitido (habilita Anonymous en Firebase Auth si falla Storage):', anonErr);
      }

      // 1. Función aislada para subir un archivo
      const uploadSingleFile = async (file: File, storagePath: string, label: string) => {
        try {
          const storageRef = ref(storage, storagePath);
          const snapshot = await uploadBytes(storageRef, file, {
            contentType: storageContentTypeForFile(file),
          });
          const downloadURL = await getDownloadURL(snapshot.ref);
          return downloadURL;
        } catch (error: any) {
          console.error(`Fallo crítico al subir ${label} (${file.name}):`, error);
          throw new Error(`Fallo al subir ${label}: ${error.message || 'Error desconocido'}`);
        }
      };

      const linkDocId = linkData.id;
      if (!linkDocId || typeof linkDocId !== 'string') {
        setError('Error de configuración del enlace. Recarga la página o solicita un nuevo enlace.');
        setIsSubmitting(false);
        return;
      }
      const uploadBase = `candidate_link_files/${linkDocId}`;

      // Definir el array de archivos a subir explícitamente (ruta acoplada a candidate_links en storage.rules)
      const filesToUpload = [
        { id: 'idFrontUrl', file: compIdFront, label: 'INE Frente', percent: 10, path: `${uploadBase}/idFront` },
        { id: 'idBackUrl', file: compIdBack, label: 'INE Reverso', percent: 20, path: `${uploadBase}/idBack` },
        { id: 'selfieUrl', file: compSelfie, label: 'Prueba de Vida', percent: 30, path: `${uploadBase}/selfie` },
        { id: 'proofOfAddressUrl', file: compProof, label: 'Comprobante', percent: 40, path: `${uploadBase}/proofOfAddress` },
        { id: 'incomeProofUrl', file: compIncome, label: 'Comprobante Ingresos', percent: 45, path: `${uploadBase}/incomeProof` },
        { id: 'fotoFachadaUrl', file: compFotoFachada, label: 'Fachada', percent: 50, path: `${uploadBase}/fotoFachada` },
        { id: 'fotoSalaUrl', file: compFotoSala, label: 'Sala', percent: 60, path: `${uploadBase}/fotoSala` },
        { id: 'fotoComedorUrl', file: compFotoComedor, label: 'Comedor', percent: 70, path: `${uploadBase}/fotoComedor` },
        { id: 'fotoCocinaUrl', file: compFotoCocina, label: 'Cocina', percent: 80, path: `${uploadBase}/fotoCocina` },
        { id: 'fotoHabitacionUrl', file: compFotoHabitacion, label: 'Habitación', percent: 90, path: `${uploadBase}/fotoHabitacion` }
      ];

      const currentUrls: Record<string, string> = {};
      if (hasIdFromIntake) {
        currentUrls.idFrontUrl = priorCd.idFrontUrl;
        currentUrls.idBackUrl = priorCd.idBackUrl;
      }

      try {
        for (const item of filesToUpload) {
          if (!item.file) continue; // Si no hay archivo, saltar

          setProgressText(`Subiendo ${item.label}...`);
          
          // AQUÍ SE QUEDABA COLGADO. SI FALLA, SALTARÁ AL CATCH.
          const url = await uploadSingleFile(
            item.file, 
            `${item.path}_${Date.now()}_${item.file.name}`,
            item.label
          );
          
          currentUrls[item.id] = url;
          setProgress(item.percent);
        }
        setUploadedFileUrls(currentUrls);
      } catch (uploadError: any) {
        // ESTO ES LO MÁS IMPORTANTE. SI SE ROMPE, DEBE MOSTRARSE EN PANTALLA.
        console.error("Proceso detenido por error:", uploadError);
        setError(`El proceso se detuvo: ${uploadError.message}. Por favor revisa tu conexión e inténtalo de nuevo.`);
        setIsSubmitting(false); // Liberar la pantalla de carga para que no se quede en 20%
        return; // Detener la ejecución aquí para no guardar datos incompletos
      }

      setProgressText("Guardando datos finales...");

      const candidateSubmittedData = {
        ...phase1Data,
        distanceMeters: Math.round(distance),
        idFrontUrl: currentUrls['idFrontUrl'] || null,
        idBackUrl: currentUrls['idBackUrl'] || null,
        proofOfAddressUrl: currentUrls['proofOfAddressUrl'] || null,
        incomeProofUrl: currentUrls['incomeProofUrl'] || null,
        idFrontName: idFront?.name || priorCd.idFrontName || null,
        idBackName: idBack?.name || priorCd.idBackName || null,
        proofOfAddressName: proofOfAddress?.name || null,
        incomeProofName: comprobanteIngresos?.name || null,
        selfieUrl: currentUrls['selfieUrl'] || null,
        fotoFachadaUrl: currentUrls['fotoFachadaUrl'] || null,
        submittedAt: new Date().toISOString()
      };

      // Update Candidate Link immediately
      await updateDoc(doc(db, 'candidate_links', linkData.id), {
        status: 'COMPLETED',
        candidateData: JSON.stringify(candidateSubmittedData),
        updatedAt: new Date().toISOString()
      });

      // Update Investigation immediately with processing state
      await updateDoc(doc(db, 'investigations', linkData.investigationId), {
        linkStatus: 'COMPLETED',
        status: 'IN_PROGRESS', // Move to in progress while AI runs
        candidateData: JSON.stringify(candidateSubmittedData),
        uploadedFileUrls: currentUrls, // Save for traceability in dashboard
        updatedAt: new Date().toISOString()
      });

      // 2. Start AI Promise in background
      const locData = {
        lat: phase1Data.realTimeLocation ? parseFloat(phase1Data.realTimeLocation.split(',')[0]) : 0,
        lng: phase1Data.realTimeLocation ? parseFloat(phase1Data.realTimeLocation.split(',')[1]) : 0,
        accuracy: 10,
        timestamp: new Date().toISOString()
      };

      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error("AI Timeout")), 300000); // 300 seconds timeout (5 minutes)
      });

      let aiPromise = Promise.resolve('');

      if (currentUrls['fotoFachadaUrl']) {
        const { analyzeCandidateData } = await import('../lib/gemini');
        
        // Fetch business rules and scoring config
        let businessRules = '';
        let scoringConfig = null;
        let loongOriginationInjection = '';
        try {
          if (investigationData?.clientId) {
            const clientDoc = await getDoc(doc(db, 'clients', investigationData.clientId));
            if (clientDoc.exists()) {
              const clientData = clientDoc.data();
              businessRules = clientData.politicasGenerales || '';
              scoringConfig = clientData.scoringConfig || null;
            }
          }
          const invRow = investigationData as { loongMotorPolicyApplies?: boolean; organizationId?: string } | null;
          const useLoongMotorPolicyInjection =
            linkData.clientProfile === 'LOONG_MOTOR' ||
            linkData.loongMotorPolicyApplies === true ||
            invRow?.loongMotorPolicyApplies === true;
          if (useLoongMotorPolicyInjection) {
            const orgForPolicy =
              invRow?.organizationId ?? linkData.organizationId ?? null;
            loongOriginationInjection = await buildLoongMotorOfficialAnalysisInjection(db, orgForPolicy);
          }
        } catch (err) {
          console.warn("Could not fetch business rules or scoring config:", err);
        }

        const imageParts = [
          currentUrls['fotoFachadaUrl'],
          currentUrls['fotoSalaUrl'],
          currentUrls['fotoComedorUrl'],
          currentUrls['fotoCocinaUrl'],
          currentUrls['fotoHabitacionUrl'],
          currentUrls['idFrontUrl'],
          currentUrls['idBackUrl'],
          currentUrls['proofOfAddressUrl'],
          currentUrls['selfieUrl']
        ].filter(Boolean);

        aiPromise = Promise.race([
          analyzeCandidateData(
            {
              perfil: linkData.clientProfile,
              puesto: investigationData?.jobProfile?.vacancy || 'No especificado',
              montoCreditoCapital: investigationData?.montoCreditoCapital,
              montoCreditoIntereses: investigationData?.montoCreditoIntereses,
              plazoFinanciamiento: investigationData?.plazoFinanciamiento,
              tipoCredito: investigationData?.tipoCredito,
              ...phase1Data
            },
            imageParts,
            businessRules,
            'none',
            scoringConfig,
            loongOriginationInjection || undefined
          ),
          timeoutPromise
        ]).catch(err => {
          console.error("AI Error or Timeout:", err);
          return "Error al generar el dictamen con IA. Se requiere revisión manual.";
        });
      }

      setProgressText("Analizando con IA (esto puede tardar unos minutos)...");

      // Run AI and wait for result BEFORE showing success screen
      try {
        const aiResult = await aiPromise;
        
        let dictamen: any = null;
        let isAIError = aiResult.includes("Error al generar el dictamen");

        try {
          if (!isAIError) {
            const aiParsed = JSON.parse(aiResult);
            dictamen = {
              ...aiParsed,
              // Enriquecer con datos de GPS que la IA no tiene exactos
              congruenciaDomicilio: {
                ...(aiParsed.congruenciaDomicilio || {}),
                distanciaMetros: Math.round(distance),
                verificado: distance < 150
              }
            };
          }
        } catch (e) {
          console.error("Failed to parse AI result, using fallback:", e);
          isAIError = true;
        }

        if (!dictamen) {
          // Generate Manual Dictamen as Fallback
          const isIncomeValid = isHR ? true : Number(phase1Data.ingresoMensual || 0) >= 5000;
          const isExpensesValid = isHR ? true : Number(phase1Data.gastosMensuales || 0) <= Number(phase1Data.ingresoMensual || 0);
          const isAddressValid = distance < 150;
          
          let dictamenFinalEstado = 'SUJETO A CONSIDERACIÓN DE SOLICITANTE POR INCONSISTENCIAS';
          let dictamenFinalResumen = 'El análisis automático requiere intervención humana.';

          if (isAIError) {
            dictamenFinalEstado = 'SUJETO A CONSIDERACIÓN DE SOLICITANTE POR INCONSISTENCIAS';
            dictamenFinalResumen = 'Hubo un problema técnico al procesar el análisis de IA. Se requiere revisión manual obligatoria.';
          } else if (isIncomeValid && isAddressValid) {
            dictamenFinalEstado = 'VIABLE';
            dictamenFinalResumen = 'No se detectaron inconsistencias críticas en el análisis manual básico.';
          } else {
            dictamenFinalEstado = 'NO VIABLE';
            dictamenFinalResumen = 'El perfil presenta inconsistencias significativas en el análisis manual básico.';
          }

          const manualScore = (isIncomeValid ? 30 : 0) + (isAddressValid ? 30 : 0);
          
          dictamen = {
            score: manualScore,
            scoreBreakdown: {
              ingresos: isIncomeValid ? 30 : 0,
              ubicacion: isAddressValid ? 30 : 0,
              documentacion: 0
            },
            congruenciaIngresos: {
              verificado: isIncomeValid && isExpensesValid,
              detalles: isAIError ? "Error en análisis de IA" : "Validación manual básica realizada."
            },
            congruenciaDomicilio: {
              verificado: isAddressValid,
              distanciaMetros: Math.round(distance),
              detalles: `Distancia calculada: ${Math.round(distance)}m.`
            },
            analisisDocumental: {
              verificado: false,
              detalles: "Pendiente de revisión manual."
            },
            dictamenFinal: {
              estado: dictamenFinalEstado,
              resumen: dictamenFinalResumen
            }
          };
        }

        const updateData: any = {
          socioeconomicDictamen: JSON.stringify(dictamen),
          result: aiResult,
          status: 'COMPLETED',
          score: dictamen?.score || 0,
          scoreBreakdown: dictamen?.scoreBreakdown ? JSON.stringify(dictamen.scoreBreakdown) : null,
          updatedAt: new Date().toISOString()
        };

        // Also save to specific fields for the dashboard's organized view
        if (linkData.clientProfile === 'HR') {
          updateData.identityValidationResult = aiResult;
        } else if (linkData.clientProfile === 'CREDIT' || linkData.clientProfile === 'LOONG_MOTOR') {
          updateData.creditAnalysisResult = aiResult;
        }
        if (linkData.clientProfile === 'LOONG_MOTOR') {
          updateData.creditStage = 'MESA_CONTROL';
        }

        await updateDoc(doc(db, 'investigations', linkData.investigationId), updateData);
        
        setFinalResult(aiResult);
        setSuccess(true);
        setIsSubmitting(false);
      } catch (aiErr: any) {
        console.error("AI processing failed:", aiErr);
        
        // Even if AI fails, we mark as success but with error state in dictamen
        // and we MUST update the investigation document so it's not stuck in IN_PROGRESS
        const errorDictamen = {
          dictamenFinal: {
            estado: 'Error en Análisis Automático',
            resumen: `Hubo un problema técnico al procesar el análisis de IA: ${aiErr.message || 'Error desconocido'}. Se requiere revisión manual obligatoria.`
          }
        };
        
        try {
          await updateDoc(doc(db, 'investigations', linkData.investigationId), {
            status: 'COMPLETED',
            socioeconomicDictamen: JSON.stringify(errorDictamen),
            result: `ERROR DE IA: ${aiErr.message || 'Error desconocido'}. Se requiere revisión manual.`,
            updatedAt: new Date().toISOString()
          });
        } catch (updateErr) {
          console.error("Failed to update investigation after AI failure:", updateErr);
        }

        setFinalResult(JSON.stringify(errorDictamen));
        setSuccess(true);
        setIsSubmitting(false);
      }

    } catch (err) {
      console.error("Error submitting data:", err);
      setError(err instanceof Error ? err.message : 'Error al enviar la información. Por favor, intenta de nuevo.');
      setIsSubmitting(false);
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no admite geolocalización.', { id: 'gps-unsupported' });
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      toast.error('Usa HTTPS o localhost para que el navegador permita el GPS.', { id: 'gps-insecure' });
      return;
    }

    setLocatingGps(true);

    const onSuccess = (position: GeolocationPosition) => {
      setRealTimeLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setLocatingGps(false);
      toast.success('Ubicación GPS capturada.', { id: 'gps-ok' });
    };

    const onError = (err: GeolocationPositionError, triedLowAccuracy: boolean) => {
      if (err.code === err.TIMEOUT && !triedLowAccuracy) {
        navigator.geolocation.getCurrentPosition(onSuccess, (e) => onError(e, true), {
          enableHighAccuracy: false,
          timeout: 30000,
          maximumAge: 120000,
        });
        return;
      }
      setLocatingGps(false);
      console.error('Error getting location:', err);
      const msg =
        err.code === err.PERMISSION_DENIED
          ? 'Ubicación bloqueada: permite el permiso en el navegador (ícono del candado o ajustes del sitio).'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'No se pudo obtener la posición. Activa ubicación/GPS o prueba con otra red.'
            : 'Tiempo agotado al leer el GPS. Intenta de nuevo; en escritorio suele ayudar una segunda lectura.';
      toast.error(msg, { id: 'gps-err' });
    };

    navigator.geolocation.getCurrentPosition(onSuccess, (e) => onError(e, false), {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Error en el Proceso</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  const showLoongMesaWait =
    !!linkData &&
    isLoongMotor &&
    linkData.investigationScope === 'LOONG_PRECAL' &&
    !loongPhase2Unlocked &&
    investigationData?.mesaPrecalStatus === 'pending' &&
    !success;

  if (showLoongMesaWait) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">En revisión — mesa de control Loong</h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
            Tu precalificación de crédito moto ya fue recibida. La decisión final la confirma mesa de control. Cuando te autoricen, podrás
            continuar con documentación y visita desde el mismo enlace.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-blue-600 font-semibold text-sm hover:underline"
          >
            Actualizar estado
          </button>
        </div>
      </div>
    );
  }

  const loongMesaDeclined =
    !!linkData &&
    isLoongMotor &&
    linkData.investigationScope === 'LOONG_PRECAL' &&
    !success &&
    (investigationData?.mesaPrecalStatus === 'rejected' || investigationData?.mesaPrecalStatus === 'precal_failed');

  if (loongMesaDeclined) {
    const precal = investigationData?.mesaPrecalStatus === 'precal_failed';
    const mesaNote =
      typeof investigationData?.mesaPrecalNote === 'string' ? investigationData.mesaPrecalNote.trim() : '';
    const mesaDecidedAt =
      typeof investigationData?.mesaPrecalDecidedAt === 'string' ? investigationData.mesaPrecalDecidedAt : '';
    const mesaDecidedAtLabel = (() => {
      if (!mesaDecidedAt) return '';
      const d = new Date(mesaDecidedAt);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('es-MX');
    })();

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            {precal ? 'Precalificación no favorable' : 'Solicitud no autorizada por mesa'}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
            {precal
              ? 'En esta ocasión no podemos continuar con la solicitud con la información proporcionada. Tu asesor puede orientarte sobre los siguientes pasos.'
              : 'Mesa de control no autorizó continuar el proceso Loong Motor.'}
          </p>
          {(mesaDecidedAtLabel || mesaNote) && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/90 dark:bg-slate-800/60 dark:border-slate-700 p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2">Dictamen</p>
              {mesaDecidedAtLabel ? <p className="text-xs text-slate-500 dark:text-slate-300 mb-2">{mesaDecidedAtLabel}</p> : null}
              {mesaNote ? <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{mesaNote}</p> : null}
            </div>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-sm font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const showBasicMesaWait =
    !!linkData &&
    basicJuxaOriginacion &&
    investigationData?.mesaPrecalStatus === 'pending' &&
    !originacionPhase2Ok &&
    !success;

  if (showBasicMesaWait) {
    const mesaNote =
      typeof investigationData?.mesaPrecalNote === 'string' ? investigationData.mesaPrecalNote.trim() : '';
    const mesaDecidedAt =
      typeof investigationData?.mesaPrecalDecidedAt === 'string' ? investigationData.mesaPrecalDecidedAt : '';
    const mesaDecision =
      typeof investigationData?.mesaPrecalDecision === 'string' ? investigationData.mesaPrecalDecision : '';

    const mesaDecidedAtLabel = (() => {
      if (!mesaDecidedAt) return '';
      const d = new Date(mesaDecidedAt);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('es-MX');
    })();

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">En revisión — mesa de control</h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
            Tu precalificación ya fue recibida (cuestionario y teléfono). La <strong>decisión final</strong> la confirma
            mesa de control. Vuelve a abrir este enlace cuando te autoricen para continuar con ubicación, INE,
            comprobantes y evidencias.
          </p>
          {(mesaDecision || mesaDecidedAtLabel || mesaNote) && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/90 dark:bg-slate-800/60 dark:border-slate-700 p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2">
                Mesa de control
              </p>
              {(mesaDecision || mesaDecidedAtLabel) && (
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  {mesaDecision ? (
                    <span className="font-semibold">
                      {mesaDecision === 'approved' ? 'Autorizado' : mesaDecision === 'rejected' ? 'No autorizado' : mesaDecision}
                    </span>
                  ) : null}
                  {mesaDecision && mesaDecidedAtLabel ? <span className="text-slate-500 dark:text-slate-300"> · </span> : null}
                  {mesaDecidedAtLabel ? <span className="text-slate-600 dark:text-slate-300">{mesaDecidedAtLabel}</span> : null}
                </p>
              )}
              {mesaNote ? (
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{mesaNote}</p>
              ) : null}
            </div>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-blue-600 font-semibold text-sm hover:underline"
          >
            Actualizar estado
          </button>
        </div>
      </div>
    );
  }

  const basicDeclined =
    !!linkData &&
    basicJuxaOriginacion &&
    !success &&
    (intakeTerminal === 'precal_fail' ||
      intakeTerminal === 'mesa_rejected' ||
      investigationData?.mesaPrecalStatus === 'precal_failed' ||
      investigationData?.mesaPrecalStatus === 'rejected');

  if (basicDeclined) {
    const precal =
      investigationData?.mesaPrecalStatus === 'precal_failed' || intakeTerminal === 'precal_fail';
    const mesaNote =
      typeof investigationData?.mesaPrecalNote === 'string' ? investigationData.mesaPrecalNote.trim() : '';
    const mesaDecidedAt =
      typeof investigationData?.mesaPrecalDecidedAt === 'string' ? investigationData.mesaPrecalDecidedAt : '';

    const mesaDecidedAtLabel = (() => {
      if (!mesaDecidedAt) return '';
      const d = new Date(mesaDecidedAt);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('es-MX');
    })();

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            {precal ? 'Precalificación no favorable' : 'Solicitud no autorizada por mesa'}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
            {precal
              ? 'En esta ocasión no podemos continuar con la solicitud. Tu asesor puede orientarte sobre los siguientes pasos.'
              : 'Mesa de control no autorizó continuar el proceso. Quien originó la solicitud será notificado en plataforma.'}
          </p>
          {(mesaDecidedAtLabel || mesaNote) && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/90 dark:bg-slate-800/60 dark:border-slate-700 p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2">
                Dictamen de mesa
              </p>
              {mesaDecidedAtLabel ? (
                <p className="text-xs text-slate-500 dark:text-slate-300 mb-2">{mesaDecidedAtLabel}</p>
              ) : null}
              {mesaNote ? (
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{mesaNote}</p>
              ) : null}
            </div>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-sm font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    const dictamen = finalResult ? (function() {
      try {
        return JSON.parse(finalResult);
      } catch (e) {
        return null;
      }
    })() : null;

    const dictamenFinal = dictamen?.dictamenFinal;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-xl w-full">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4 text-center">
            {intakeTerminal === 'mesa_pending' ? 'Solicitud enviada' : '¡Información Recibida!'}
          </h2>

          {intakeTerminal === 'mesa_pending' && (
            <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50/90 dark:bg-blue-950/40 dark:border-blue-900 p-5 text-left">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Recibimos tu <strong>precalificación</strong> (cuestionario y teléfono). La decisión final la confirma{' '}
                <strong>mesa de control</strong>. Cuando mesa autorice, en este mismo enlace cargarás INE, ubicación,
                comprobantes y evidencias.
              </p>
            </div>
          )}

          {linkData?.investigationScope === 'LOONG_PRECAL' &&
            linkData?.status === 'PHASE_1_COMPLETED' &&
            !dictamenFinal && (
              <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed text-center">
                Tu solicitud fue enviada. Mesa de control revisará tu caso; tu asesor te avisará cuando haya una resolución
                o cuando debas continuar en este mismo enlace.
              </p>
            )}

          {linkData?.investigationScope === 'LOONG_FORMAL_QUAL' && linkData?.status === 'COMPLETED' && !dictamenFinal && (
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed text-center">
              Tu información fue registrada. Tu asesor te indicará los siguientes pasos del proceso.
            </p>
          )}

          {dictamenFinal && (
            <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Resultado del Análisis</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  dictamenFinal.estado === 'VIABLE' ? 'bg-emerald-100 text-emerald-700' :
                  dictamenFinal.estado === 'NO VIABLE' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {dictamenFinal.estado}
                </span>
              </div>
              
              {dictamen.score !== undefined && (
                <div className="mb-4 flex items-center gap-4">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="transparent"
                        stroke="#e2e8f0"
                        strokeWidth="4"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="transparent"
                        stroke={dictamen.score >= 70 ? "#10b981" : dictamen.score >= 40 ? "#f59e0b" : "#ef4444"}
                        strokeWidth="4"
                        strokeDasharray={175.9}
                        strokeDashoffset={175.9 - (175.9 * dictamen.score) / 100}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-sm font-bold text-slate-900 dark:text-slate-100">{dictamen.score}</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Puntaje de Crédito</p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">Basado en políticas de riesgo y evidencia.</p>
                  </div>
                </div>
              )}

              <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">
                {dictamenFinal.resumen}
              </p>
            </div>
          )}

          {!dictamenFinal &&
            !(
              linkData?.investigationScope === 'LOONG_PRECAL' &&
              linkData?.status === 'PHASE_1_COMPLETED'
            ) &&
            !(
              linkData?.investigationScope === 'LOONG_FORMAL_QUAL' && linkData?.status === 'COMPLETED'
            ) && (
              <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed text-center">
                Hemos recibido tus documentos y ubicación correctamente. Tu proceso de validación ha comenzado y serás
                notificado por el equipo de JUXA una vez que el dictamen sea emitido.
              </p>
            )}

          <div className="flex flex-col gap-4">
            {linkData?.investigationScope === 'LOONG_FORMAL_QUAL' && linkData?.status === 'COMPLETED' ? (
              <button
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg active:scale-95"
              >
                Cerrar
              </button>
            ) : linkData?.investigationScope === 'LOONG_PRECAL' && linkData?.status === 'PHASE_1_COMPLETED' ? (
              <button
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg active:scale-95"
              >
                Cerrar
              </button>
            ) : (!isHR && !isCreditFlow && phase === '1') ||
              (isCredit && linkData?.investigationScope === 'INTEGRAL' && dictamenFinal?.estado === 'VIABLE' && phase === '1') ? (
              <button
                onClick={() => {
                  setPhase('2');
                  setStep(1);
                  setSuccess(false);
                  window.history.pushState({}, '', `?id=${linkId}&phase=2`);
                }}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
              >
                Continuar a Fase 2 (Documentación Adicional)
              </button>
            ) : (
              <button
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 dark:shadow-black/40 active:scale-95"
              >
                Cerrar y Finalizar
              </button>
            )}
            
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 text-center">
              ID de Referencia: <span className="font-mono">{linkId}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header Fijo y Corporativo */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 text-white flex items-center justify-center rounded-xl font-bold shadow-lg shadow-blue-200">
            JV
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            JUXA <span className="text-blue-600 dark:text-blue-400">VERIFY</span>
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 dark:border-emerald-800/80 dark:bg-emerald-950/55">
          <Shield className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-200 sm:text-xs">
            Verificación Encriptada de 256-bits
          </span>
        </div>
      </header>

      {/* Hero: en dark el fondo debe acompañar al texto (antes quedaba banda clara + texto claro). */}
      <section className="border-b border-slate-200/90 bg-gradient-to-b from-slate-50 via-white to-slate-50/80 px-4 py-10 text-center dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shadow-sm ring-1 ring-blue-200/80 dark:bg-blue-950/80 dark:text-blue-300 dark:ring-blue-800/60">
            <Shield className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
            Proceso de Verificación Segura
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
            Por favor, completa los siguientes pasos. Este proceso es rápido, seguro y cumple con las normativas de privacidad más estrictas.
          </p>

          {isCreditFlow && investigationData && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-emerald-100 text-left max-w-lg mx-auto animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Resumen de Solicitud de Crédito</h3>
              </div>
              {investigationData.antecedenteId && (
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2.5 dark:border-blue-900/50 dark:bg-blue-950/40">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Expediente de originación</p>
                  <p className="font-mono text-sm font-semibold text-blue-900 dark:text-blue-100">{investigationData.antecedenteId}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Solicitante: <span className="font-medium text-slate-800 dark:text-slate-200">{linkData?.title || investigationData.title}</span>
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tipo de Crédito</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{investigationData.tipoCredito || 'Personal'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Plazo</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{investigationData.plazoFinanciamiento || 'No especificado'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Monto Capital</p>
                  <p className="text-sm font-bold text-emerald-600">${investigationData.montoCreditoCapital || '0.00'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Monto con Intereses</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">${investigationData.montoCreditoIntereses || '0.00'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-10 rounded-[2rem] shadow-xl shadow-slate-200 dark:shadow-black/40/50 border border-slate-100 dark:border-slate-800">
            {basicJuxaOriginacion && originacionPhase2Ok && phase === '1' && step === 1 && (
              <div
                role="status"
                className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
              >
                <strong>Mesa autorizó tu precalificación.</strong> Sigue con <strong>ubicación en el mapa</strong> (paso 1),
                luego perfil socioeconómico e <strong>INE / comprobantes / evidencias</strong> (pasos 2 y 3). Si aún ves el
                cuestionario inicial, recarga la página.
              </div>
            )}
            {/* Stepper Visual Moderno */}
            <div className="mb-12 relative">
              <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -z-0"></div>
              <div
                className="absolute top-5 left-0 -z-0 h-0.5 bg-[var(--color-juxa-accent)] transition-all duration-500"
                style={{
                  width: effectiveTotalSteps <= 1 ? '100%' : `${((step - 1) / (effectiveTotalSteps - 1)) * 100}%`,
                }}
              ></div>
              
              <div className="flex justify-between relative z-10">
                {Array.from({ length: effectiveTotalSteps }, (_, i) => i + 1).map((s) => (
                  <div key={s} className="flex flex-col items-center group">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 ${
                        step === s
                          ? 'scale-110 border-[var(--color-juxa-accent)] bg-[var(--color-juxa-accent)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--color-juxa-accent)_25%,transparent)]'
                          : step > s
                            ? 'border-[var(--color-juxa-accent)] bg-[var(--color-juxa-accent)] text-white'
                            : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500'
                      }`}
                    >
                      {step > s ? <CheckCircle2 className="w-6 h-6" /> : s}
                    </div>
                    <span
                      className={`mt-3 text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 sm:text-xs ${
                        step >= s ? 'text-[var(--color-juxa-accent)]' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {isLoongFormalQualOnly
                        ? 'Calificación formal'
                        : isLoongPrecalOnly
                        ? 'Precalificación'
                        : isCreditFlow
                        ? basicJuxaOriginacion && !originacionPhase2Ok && totalSteps === 1
                          ? 'Precalificación'
                          : s === 1
                            ? 'Ubicación'
                            : s === 2
                              ? 'Perfil'
                              : 'Documentos'
                        : (isHR
                            ? (s === 1 ? 'Ubicación' : s === 2 ? 'Documentos' : 'Selfie')
                            : (phase === '1' 
                                ? (s === 1 ? 'Ubicación' : 'Perfil') 
                                : (s === 1 ? 'Documentos' : 'Selfie')))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Location Section */}
            {phase === '1' && step === 1 && (isLoongPrecalOnly || isLoongFormalQualOnly) && (
              <div className="space-y-6">
                <h3 className="flex items-center text-lg font-bold text-slate-900 dark:text-slate-100">
                  <span className="mr-2 rounded-lg bg-amber-100 px-2 py-0.5 text-sm font-bold text-amber-800">
                    Loong Motor
                  </span>
                  {isLoongFormalQualOnly ? 'Calificación formal de crédito (moto)' : 'Precalificación de crédito (moto)'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isLoongFormalQualOnly
                    ? 'Esta etapa aplica la política de crédito configurada por tu distribuidor. Si resultas favorable, tu asesor te enviará el enlace para la investigación de arraigo (visita y evidencias).'
                    : 'El vendedor recibe tu solicitud en esta etapa. Solo con una precalificación favorable se habilitará la siguiente fase para documentación y visita de crédito.'}
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Modelo / versión moto</label>
                    <input
                      value={modeloMoto}
                      onChange={(e) => setModeloMoto(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                      placeholder="Ej. Loong 150 cc"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Precio lista (MXN)</label>
                    <input
                      type="number"
                      value={precioMoto}
                      onChange={(e) => setPrecioMoto(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Enganche (MXN)</label>
                    <input
                      type="number"
                      value={engancheMoto}
                      onChange={(e) => setEngancheMoto(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Plazo (meses)</label>
                    <input
                      type="number"
                      value={plazoMesesLoong}
                      onChange={(e) => setPlazoMesesLoong(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Ingreso mensual neto</label>
                    <input
                      type="number"
                      value={ingresoMensual}
                      onChange={(e) => setIngresoMensual(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Gastos mensuales</label>
                    <input
                      type="number"
                      value={gastosMensuales}
                      onChange={(e) => setGastosMensuales(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Antigüedad laboral (meses)</label>
                    <input
                      type="number"
                      value={antiguedadLaboralMeses}
                      onChange={(e) => setAntiguedadLaboralMeses(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Deudas actuales (MXN)</label>
                    <input
                      type="number"
                      value={montoDeudasLoong}
                      onChange={(e) => setMontoDeudasLoong(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                  <p className="sm:col-span-2 text-sm text-slate-500 dark:text-slate-400">
                    La evaluación crediticia en este paso no incluye captura de buró; el motor aplica el perfil estándar acordado con tu distribuidor.
                  </p>
                </div>
              </div>
            )}

            {phase === '1' && (
              (step === 1 &&
                linkData?.investigationScope !== 'BASIC' &&
                linkData?.investigationScope !== 'LOONG_PRECAL' &&
                linkData?.investigationScope !== 'LOONG_FORMAL_QUAL') ||
              (step === 1 && linkData?.investigationScope === 'BASIC' && originacionPhase2Ok)
            ) && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                Ubicación y Validación
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Selecciona tu dirección en el mapa y luego obtén tu ubicación en tiempo real para validar.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">1. Selecciona tu dirección en el mapa</label>
                  
                               <div className="flex gap-2 mb-4">
                    {isLoaded && (
                      <Autocomplete
                        onLoad={(autocomplete) => { autocompleteRef.current = autocomplete; }}
                        onPlaceChanged={handlePlaceChanged}
                        className="flex-1"
                      >
                        <input
                          type="text"
                          placeholder="Busca tu dirección o mueve el pin en el mapa..."
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                      </Autocomplete>
                    )}
                  </div>

                  <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-300 dark:border-slate-600 z-0 relative">
                    {isLoaded ? (
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={mapCenter}
                        zoom={15}
                        onClick={handleMapClick}
                        options={{
                          disableDefaultUI: false,
                          zoomControl: true,
                          streetViewControl: false,
                          mapTypeControl: false,
                          styles: [
                            {
                              "featureType": "all",
                              "elementType": "geometry.fill",
                              "stylers": [{"weight": "2.00"}]
                            },
                            {
                              "featureType": "all",
                              "elementType": "geometry.stroke",
                              "stylers": [{"color": "#9c9c9c"}]
                            },
                            {
                              "featureType": "all",
                              "elementType": "labels.text",
                              "stylers": [{"visibility": "on"}]
                            },
                            {
                              "featureType": "landscape",
                              "elementType": "all",
                              "stylers": [{"color": "#f2f2f2"}]
                            },
                            {
                              "featureType": "landscape",
                              "elementType": "geometry.fill",
                              "stylers": [{"color": "#ffffff"}]
                            },
                            {
                              "featureType": "landscape.man_made",
                              "elementType": "geometry.fill",
                              "stylers": [{"color": "#ffffff"}]
                            },
                            {
                              "featureType": "poi",
                              "elementType": "all",
                              "stylers": [{"visibility": "off"}]
                            },
                            {
                              "featureType": "road",
                              "elementType": "all",
                              "stylers": [{"saturation": -100},{"lightness": 45}]
                            },
                            {
                              "featureType": "road",
                              "elementType": "geometry.fill",
                              "stylers": [{"color": "#eeeeee"}]
                            },
                            {
                              "featureType": "road",
                              "elementType": "labels.text.fill",
                              "stylers": [{"color": "#7b7b7b"}]
                            },
                            {
                              "featureType": "road",
                              "elementType": "labels.text.stroke",
                              "stylers": [{"color": "#ffffff"}]
                            },
                            {
                              "featureType": "road.highway",
                              "elementType": "all",
                              "stylers": [{"visibility": "simplified"}]
                            },
                            {
                              "featureType": "road.arterial",
                              "elementType": "labels.icon",
                              "stylers": [{"visibility": "off"}]
                            },
                            {
                              "featureType": "transit",
                              "elementType": "all",
                              "stylers": [{"visibility": "off"}]
                            },
                            {
                              "featureType": "water",
                              "elementType": "all",
                              "stylers": [{"color": "#46bcec"},{"visibility": "on"}]
                            },
                            {
                              "featureType": "water",
                              "elementType": "geometry.fill",
                              "stylers": [{"color": "#c8d7d4"}]
                            },
                            {
                              "featureType": "water",
                              "elementType": "labels.text.fill",
                              "stylers": [{"color": "#070707"}]
                            },
                            {
                              "featureType": "water",
                              "elementType": "labels.text.stroke",
                              "stylers": [{"color": "#ffffff"}]
                            }
                          ]
                        }}
                      >
                        {mapPosition && <Marker position={mapPosition} />}
                      </GoogleMap>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        Cargando mapa...
                      </div>
                    )}
                  </div>
                  {mapPosition && (
                    <p className="text-sm text-emerald-600 mt-2 flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Ubicación seleccionada en el mapa
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">2. Valida tu ubicación en tiempo real</label>
                  <div className="flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={getLocation}
                      disabled={locatingGps}
                      className="px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-xl hover:bg-blue-600 hover:text-white hover:shadow-md transition-all text-sm flex items-center active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {locatingGps ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Navigation className="w-4 h-4 mr-2" />
                      )}
                      {locatingGps ? 'Obteniendo ubicación…' : 'Obtener Ubicación GPS'}
                    </button>
                    {realTimeLocation && (
                      <span className="text-sm text-emerald-600 flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        GPS capturado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Pre-qualification Section (Credit BASIC Step 1) — oculto cuando mesa ya habilitó fase 2 */}
            {phase === '1' && step === 1 && linkData?.investigationScope === 'BASIC' && !originacionPhase2Ok && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Pre-calificación de Crédito
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {investigationData?.antecedenteId ? (
                  <>
                    Expediente <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{investigationData.antecedenteId}</span>
                    {' · '}
                    <span className="font-medium text-slate-700 dark:text-slate-200">{linkData?.title || investigationData?.title}</span>
                    . Esta es solo <strong>precalificación</strong>: cuestionario, teléfono y datos de moto (si aplica). No subimos identificación ni fotos hasta que mesa autorice la siguiente etapa.
                    El monto solicitado ya viene del registro inicial y puedes ajustarlo si aplica.
                  </>
                ) : (
                  'Precalificación: cuestionario y teléfono. El INE y las evidencias se cargan después, cuando autorice mesa de control.'
                )}
              </p>
              <div className="rounded-xl border border-blue-200/80 bg-blue-50/90 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100">
                <strong className="font-semibold">Cuestionario adaptativo:</strong>{' '}
                {adaptiveCreditQ.label}
                {linkData?.riskSegment || investigationData?.riskSegment
                  ? ` · Regla aplicada: ${linkData?.riskSegment ?? investigationData?.riskSegment}`
                  : null}
              </div>
              {adaptiveCreditQ.showMotorcycleFields ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Modelo / versión motocicleta
                    </label>
                    <input
                      type="text"
                      value={modeloMotocicletaCuestionario}
                      onChange={(e) => setModeloMotocicletaCuestionario(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Ej. Italika FT150"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Valor estimado moto (MXN)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={valorMotocicletaEstimado}
                      onChange={(e) => setValorMotocicletaEstimado(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Ej. 42000"
                    />
                  </div>
                </div>
              ) : null}
              {adaptiveCreditQ.requirePersonalReferencePhone ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Teléfono de referencia personal (segmento de mayor riesgo)
                  </label>
                  <input
                    type="tel"
                    value={referenciaTelefonoCredito}
                    onChange={(e) => setReferenciaTelefonoCredito(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="10 dígitos mínimo"
                  />
                </div>
              ) : null}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Monto Solicitado ($)</label>
                    <input 
                      type="number" 
                      required 
                      value={preQualQuestions.montoSolicitado} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, montoSolicitado: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 50000" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Ingresos Mensuales Netos ($)</label>
                    <input 
                      type="number" 
                      required 
                      value={preQualQuestions.ingresosMensuales} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, ingresosMensuales: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 25000" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Gastos Mensuales Estimados ($)</label>
                    <input 
                      type="number" 
                      required 
                      value={preQualQuestions.gastosMensuales} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, gastosMensuales: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 12000" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">¿Tienes deudas activas?</label>
                    <select 
                      value={preQualQuestions.tieneDeudas} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, tieneDeudas: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white dark:bg-slate-900"
                    >
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </select>
                  </div>
                </div>

                {preQualQuestions.tieneDeudas === 'si' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Monto total de deudas ($)</label>
                    <input 
                      type="number" 
                      required 
                      value={preQualQuestions.montoDeudas} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, montoDeudas: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 15000" 
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Antigüedad Laboral (Años)</label>
                    <input 
                      type="number" 
                      required 
                      value={preQualQuestions.antiguedadLaboral} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, antiguedadLaboral: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 3" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Tipo de Contrato</label>
                    <select 
                      value={preQualQuestions.tipoContrato} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, tipoContrato: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white dark:bg-slate-900"
                    >
                      <option value="Indefinido">Indefinido / Planta</option>
                      <option value="Temporal">Temporal / Por Proyecto</option>
                      <option value="Honorarios">Honorarios / Freelance</option>
                      <option value="Informal">Informal / Negocio Propio</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Vivienda</label>
                    <select 
                      value={preQualQuestions.propiedadVivienda} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, propiedadVivienda: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white dark:bg-slate-900"
                    >
                      <option value="Propia">Propia</option>
                      <option value="Rentada">Rentada</option>
                      <option value="Familiar">Familiar / Con Padres</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Estado en Buró (Declarado)</label>
                    <select 
                      value={preQualQuestions.buroCredito} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, buroCredito: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white dark:bg-slate-900"
                    >
                      <option value="Excelente">Excelente (Sin atrasos)</option>
                      <option value="Bueno">Bueno (Atrasos menores)</option>
                      <option value="Regular">Regular (Atrasos frecuentes)</option>
                      <option value="Malo">Malo (En jurídico / Quita)</option>
                      <option value="Sin Historial">Sin Historial</option>
                    </select>
                  </div>
                </div>

                {(!basicJuxaOriginacion || originacionPhase2Ok) && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Información Económica Base</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Ingreso Mensual Base (MXN)</label>
                      <input 
                        type="number" 
                        required 
                        value={ingresoMensual} 
                        onChange={e => setIngresoMensual(e.target.value)} 
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                        placeholder="Ej. 15000" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Gastos Mensuales Base (MXN)</label>
                      <input 
                        type="number" 
                        required 
                        value={gastosMensuales} 
                        onChange={e => setGastosMensuales(e.target.value)} 
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                        placeholder="Ej. 10000" 
                      />
                    </div>
                  </div>
                </div>
                )}
                {basicJuxaOriginacion && !originacionPhase2Ok && (
                  <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                        Teléfono celular del solicitante
                      </label>
                      <input
                        type="tel"
                        required
                        value={telefonoSolicitante}
                        onChange={(e) => setTelefonoSolicitante(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="10 dígitos, con lada si aplica"
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 rounded-lg bg-slate-50 dark:bg-slate-800/80 px-3 py-2 border border-slate-100 dark:border-slate-700">
                      <strong className="text-slate-700 dark:text-slate-200">INE y fotos:</strong> no se cargan en esta
                      precalificación. Cuando mesa autorice, en este mismo enlace podrás subir INE, comprobantes y
                      evidencias de arraigo.
                    </p>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Socioeconomic Section */}
            {phase === '1' &&
              step === 2 &&
              linkData?.clientProfile !== 'HR' &&
              (linkData?.investigationScope !== 'BASIC' || originacionPhase2Ok) &&
              linkData?.investigationScope !== 'LOONG_PRECAL' &&
              linkData?.investigationScope !== 'LOONG_FORMAL_QUAL' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <Home className="w-5 h-5 mr-2 text-blue-600" />
                Estudio Socioeconómico
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Por favor, proporciona la siguiente información sobre tu domicilio e ingresos.
              </p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Ingreso Mensual (MXN)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                      </div>
                      <input 
                        type="number" 
                        required 
                        value={ingresoMensual} 
                        onChange={e => setIngresoMensual(e.target.value)} 
                        className="pl-10 w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                        placeholder="Ej. 15000" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Gastos Mensuales (MXN)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                      </div>
                      <input 
                        type="number" 
                        required 
                        value={gastosMensuales} 
                        onChange={e => setGastosMensuales(e.target.value)} 
                        className="pl-10 w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                        placeholder="Ej. 10000" 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Ocupación</label>
                    <input 
                      type="text" 
                      required 
                      value={ocupacion} 
                      onChange={e => setOcupacion(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. Empleado" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Estado Civil</label>
                    <select 
                      value={estadoCivil} 
                      onChange={e => setEstadoCivil(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white dark:bg-slate-900"
                    >
                      <option value="Soltero(a)">Soltero(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viudo(a)">Viudo(a)</option>
                      <option value="Unión Libre">Unión Libre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Dependientes</label>
                    <input 
                      type="number" 
                      required 
                      value={dependientesEconomicos} 
                      onChange={e => setDependientesEconomicos(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 2" 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Dirección Declarada</label>
                  <input 
                    type="text" 
                    required 
                    value={direccionDeclarada} 
                    onChange={e => setDireccionDeclarada(e.target.value)} 
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                    placeholder="Calle, Número, Colonia, Ciudad, Estado, CP" 
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Tipo de Vivienda</label>
                    <select 
                      value={tipoVivienda} 
                      onChange={e => setTipoVivienda(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white dark:bg-slate-900"
                    >
                      <option value="Propia">Propia</option>
                      <option value="Rentada">Rentada</option>
                      <option value="Familiar">Familiar</option>
                      <option value="Pagando">Pagando (Hipoteca)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Antigüedad (Años)</label>
                    <input 
                      type="number" 
                      required 
                      value={antiguedadVivienda} 
                      onChange={e => setAntiguedadVivienda(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 5" 
                    />
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center">
                    <Upload className="w-4 h-4 mr-2" />
                    Acreditación de Ingresos
                  </label>
                  <p className="text-xs text-blue-700 mb-4">
                    Para fortalecer tu solicitud, sube evidencia de tus ingresos. 
                    <strong> Los estados de cuenta bancarios son la mejor opción</strong>, pero también aceptamos otras formas de comprobación:
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                    <div className="flex items-center p-2 bg-white dark:bg-slate-900 rounded-lg border border-blue-100 text-[10px] text-blue-800 font-medium">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Estados de Cuenta
                    </div>
                    <div className="flex items-center p-2 bg-white dark:bg-slate-900 rounded-lg border border-blue-100 text-[10px] text-blue-800 font-medium">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Facturas de Negocio
                    </div>
                    <div className="flex items-center p-2 bg-white dark:bg-slate-900 rounded-lg border border-blue-100 text-[10px] text-blue-800 font-medium">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Fotos de Actividad
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setComprobanteIngresos(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-6 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                      comprobanteIngresos ? 'bg-emerald-50 border-emerald-200' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${comprobanteIngresos ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500'}`}>
                        {comprobanteIngresos ? <CheckCircle2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <div className="text-center">
                        <span className={`block text-sm font-bold ${comprobanteIngresos ? 'text-emerald-700' : 'text-slate-700 dark:text-slate-200'}`}>
                          {comprobanteIngresos ? comprobanteIngresos.name : 'Seleccionar Comprobante'}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          PDF o Imagen (Estados de cuenta, facturas, fotos de negocio)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Documents Section */}
            {((phase === '1' &&
              step === 3 &&
              (linkData?.clientProfile === 'CREDIT' || isLoongFullCredit) &&
              (linkData?.investigationScope !== 'BASIC' || originacionPhase2Ok)) ||
              (linkData?.clientProfile === 'HR' && step === 2) ||
              (phase === '2' && step === 1)) && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <Upload className="w-5 h-5 mr-2 text-blue-600" />
                {linkData?.clientProfile === 'CREDIT' || isLoongFullCredit
                  ? 'Documentación y Arraigo de Domicilio'
                  : 'Documentos Oficiales'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {linkData?.clientProfile === 'CREDIT' || isLoongFullCredit
                  ? 'Sube fotos claras de tus documentos para validar tu identidad y arraigo.'
                  : 'Sube fotos claras de tus documentos.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">INE/Pasaporte (Frente)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setIdFront(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                      idFront ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${idFront ? 'bg-emerald-100 text-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 shadow-sm'}`}>
                        {idFront ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-5 h-5" />}
                      </div>
                      <span className={`text-xs font-bold ${idFront ? 'text-emerald-700' : 'text-slate-500 dark:text-slate-400'}`}>
                        {idFront ? idFront.name : 'Subir Frente'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">INE/Pasaporte (Reverso)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setIdBack(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                      idBack ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${idBack ? 'bg-emerald-100 text-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 shadow-sm'}`}>
                        {idBack ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-5 h-5" />}
                      </div>
                      <span className={`text-xs font-bold ${idBack ? 'text-emerald-700' : 'text-slate-500 dark:text-slate-400'}`}>
                        {idBack ? idBack.name : 'Subir Reverso'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">Comprobante de Domicilio (No mayor a 3 meses)</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setProofOfAddress(e.target.files ? e.target.files[0] : null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={`p-6 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                    proofOfAddress ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                  }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${proofOfAddress ? 'bg-emerald-100 text-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 shadow-sm'}`}>
                      {proofOfAddress ? <CheckCircle2 className="w-7 h-7" /> : <FileText className="w-6 h-6" />}
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-bold ${proofOfAddress ? 'text-emerald-700' : 'text-slate-700 dark:text-slate-200'}`}>
                        {proofOfAddress ? proofOfAddress.name : 'Seleccionar Comprobante'}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest font-semibold">PDF, JPG o PNG</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Selfie Section */}
            {((phase === '1' &&
              step === 3 &&
              (linkData?.clientProfile === 'CREDIT' || isLoongFullCredit) &&
              (linkData?.investigationScope !== 'BASIC' || originacionPhase2Ok)) ||
              (linkData?.clientProfile === 'HR' && step === 2) ||
              (phase === '2' && step === 2)) && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
                    <Camera className="w-5 h-5 mr-2 text-blue-600" />
                    Prueba de Vida
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Tómate una selfie sosteniendo tu identificación oficial cerca de tu rostro.
                  </p>
                  <div className="group relative">
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => setSelfie(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-6 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                      selfie ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selfie ? 'bg-emerald-100 text-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 shadow-sm'}`}>
                        {selfie ? <CheckCircle2 className="w-7 h-7" /> : <Camera className="w-6 h-6" />}
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-bold ${selfie ? 'text-emerald-700' : 'text-slate-700 dark:text-slate-200'}`}>
                          {selfie ? selfie.name : 'Capturar Selfie'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
                    <Home className="w-5 h-5 mr-2 text-blue-600" />
                    Foto de la Fachada
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Sube una foto clara de la fachada exterior de tu domicilio. <strong className="text-amber-600">IMPORTANTE: La foto debe tomarse con la puerta abierta</strong> para validar que es tu domicilio y coincidir con el comprobante.
                  </p>
                  <div className="group relative">
                    <input 
                      type="file" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      accept="image/*" 
                      onChange={(e) => setFotoFachada(e.target.files ? e.target.files[0] : null)}
                    />
                    <div className={`p-8 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                      fotoFachada ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${fotoFachada ? 'bg-emerald-100 text-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 shadow-sm'}`}>
                        {fotoFachada ? <CheckCircle2 className="w-8 h-8" /> : <Home className="w-7 h-7" />}
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-bold ${fotoFachada ? 'text-emerald-700' : 'text-slate-700 dark:text-slate-200'}`}>
                          {fotoFachada ? fotoFachada.name : 'Subir Foto de Fachada'}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest font-semibold">Puerta abierta obligatoria</p>
                      </div>
                    </div>
                  </div>
                </div>

              {linkData?.clientProfile !== 'HR' && (
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
                    <Home className="w-5 h-5 mr-2 text-blue-600" />
                    Fotografías del Interior (Estudio Socioeconómico)
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Según el tipo de crédito y el segmento de riesgo, solo se solicitan las áreas necesarias de tu domicilio.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {adaptiveCreditQ.requireSala ? (
                      <div className="group relative">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
                          1. Sala
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            accept="image/*"
                            onChange={(e) => setFotoSala(e.target.files ? e.target.files[0] : null)}
                          />
                          <div
                            className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                              fotoSala
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                            }`}
                          >
                            <Camera
                              className={`w-6 h-6 ${fotoSala ? 'text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`}
                            />
                            <span
                              className={`text-xs font-bold ${fotoSala ? 'text-emerald-700' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                              {fotoSala ? fotoSala.name : 'Subir Sala'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {adaptiveCreditQ.requireComedor ? (
                      <div className="group relative">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
                          2. Comedor
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            accept="image/*"
                            onChange={(e) => setFotoComedor(e.target.files ? e.target.files[0] : null)}
                          />
                          <div
                            className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                              fotoComedor
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                            }`}
                          >
                            <Camera
                              className={`w-6 h-6 ${fotoComedor ? 'text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`}
                            />
                            <span
                              className={`text-xs font-bold ${fotoComedor ? 'text-emerald-700' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                              {fotoComedor ? fotoComedor.name : 'Subir Comedor'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {adaptiveCreditQ.requireCocina ? (
                      <div className="group relative">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
                          3. Cocina
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            accept="image/*"
                            onChange={(e) => setFotoCocina(e.target.files ? e.target.files[0] : null)}
                          />
                          <div
                            className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                              fotoCocina
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                            }`}
                          >
                            <Camera
                              className={`w-6 h-6 ${fotoCocina ? 'text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`}
                            />
                            <span
                              className={`text-xs font-bold ${fotoCocina ? 'text-emerald-700' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                              {fotoCocina ? fotoCocina.name : 'Subir Cocina'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {adaptiveCreditQ.requireHabitacion ? (
                      <div className="group relative">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
                          4. Habitación principal
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            accept="image/*"
                            onChange={(e) => setFotoHabitacion(e.target.files ? e.target.files[0] : null)}
                          />
                          <div
                            className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                              fotoHabitacion
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                            }`}
                          >
                            <Camera
                              className={`w-6 h-6 ${fotoHabitacion ? 'text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`}
                            />
                            <span
                              className={`text-xs font-bold ${fotoHabitacion ? 'text-emerald-700' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                              {fotoHabitacion ? fotoHabitacion.name : 'Subir Habitación'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
            )}

            <div className="pt-6">
              {isSubmitting ? (
                <div className="space-y-4">
                  <JuxaVerifyLoader text={progressText} progress={progress} />
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start">
                    <AlertCircle className="w-5 h-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 font-medium">
                      Por favor, no cierres ni recargues esta ventana hasta que el proceso termine por completo.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-8">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-8 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                    >
                      Atrás
                    </button>
                  ) : (
                    <div></div>
                  )}
                  
                  {step < effectiveTotalSteps ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-8 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-95"
                    >
                      Siguiente
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-10 py-3.5 flex justify-center border border-transparent text-base font-bold rounded-2xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      Finalizar Verificación
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="mt-8 flex items-center justify-center text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 dark:text-slate-500">
              <Lock className="w-3 h-3 mr-2 text-emerald-500" />
              Verificación Segura JUXA • 2026
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
);
};
