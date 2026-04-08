import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { CheckCircle2, MapPin, Camera, Upload, ShieldCheck, AlertCircle, Home, DollarSign, Navigation, RefreshCw, FileText, Brain, Shield, Lock, Users, Video } from 'lucide-react';
import { useJsApiLoader, Autocomplete, GoogleMap, Marker } from '@react-google-maps/api';
import { JuxaVerifyLoader } from '../components/JuxaVerifyLoader';
import { toast } from 'react-hot-toast';
import { compressImage, trimVideo } from '../lib/imageUtils';

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
  const isLoongMotor = linkData?.clientProfile === 'LOONG_MOTOR' || linkData?.investigationType === 'LOONG_MOTOR';
  const isLoongPreQual = isLoongMotor && linkData?.isPreQual;

  const [step, setStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(2);

  // Form fields
  const [mapPosition, setMapPosition] = useState<{lat: number, lng: number} | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 19.4326, lng: -99.1332 });
  const [targetLocation, setTargetLocation] = useState<{lat: number, lng: number} | null>(null);
  const [targetAddress, setTargetAddress] = useState('');
  const [realTimeLocation, setRealTimeLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isWithinRange, setIsWithinRange] = useState<boolean | null>(null);
  const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);
  const [showStreetView, setShowStreetView] = useState(false);
  
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [proofOfAddress, setProofOfAddress] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [videoFachada, setVideoFachada] = useState<File | null>(null);
  const [videoDurationError, setVideoDurationError] = useState<string | null>(null);
  
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
  const [isInIframe, setIsInIframe] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("[CandidateFlow] Auth state changed:", user ? "User logged in: " + user.uid : "No user");
      if (user) {
        setIsAuthReady(true);
      } else {
        setIsAuthReady(false);
        signInAnonymously(auth)
          .then(() => {
            console.log("[CandidateFlow] Anonymous sign-in successful");
          })
          .catch(err => {
            console.error("[CandidateFlow] Anonymous sign-in failed:", err);
          });
      }
    });
    return () => unsubscribe();
  }, []);

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
    buroCredito: 'Excelente',
    // Loong Motor Specific
    ingresosFijos: '',
    ingresosExtras: '',
    gastosVivienda: '',
    gastosAlimentacion: '',
    gastosTransporte: '',
    otrasDeudas: '',
    usoMoto: 'Personal',
    // New fields for rigorous analysis (Arraigo focus)
    empresaLaboral: '',
    puestoLaboral: '',
    antiguedadLaboralAnios: '',
    tiempoResidenciaAnios: '',
    tipoZona: 'Residencial',
    personasViven: '1',
    referencia1Nombre: '',
    referencia1Parentesco: 'Familiar',
    referencia2Nombre: '',
    referencia2Parentesco: 'Amigo',
    referenciaVecinalNombre: '',
    justificacionDomicilio: '',
    tieneLicencia: 'Si'
  });

  // Address Search
  const autocompleteRef = useRef<any>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  useEffect(() => {
    // Check if we are in an iframe
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
  }, []);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng || targetLocation) return;
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
          console.error(`[CandidateFlow] Link document not found for ID: ${linkId}. Checked collection: candidate_links`);
          setError(`El enlace (${linkId}) no existe o ha expirado. Por favor solicita uno nuevo.`);
          setLoading(false);
          return;
        }

        const data = linkSnap.data();
        console.log("[CandidateFlow] Link data fetched:", data);
        
        if (data.targetLocation) {
          setTargetLocation(data.targetLocation);
          setTargetAddress(data.targetAddress || '');
          setMapPosition(data.targetLocation);
          setMapCenter(data.targetLocation);
          setDireccionDeclarada(data.targetAddress || '');
        }
        
        if (!data.investigationId) {
          console.error("[CandidateFlow] Missing investigationId in link data");
          setError('Error de configuración: No se encontró el ID de investigación.');
          setLoading(false);
          return;
        }
        
        setLinkData({ id: linkSnap.id, ...data });

        const currentIsHR = data.clientProfile === 'HR' || data.investigationType === 'HR';
        const currentIsCredit = data.clientProfile === 'CREDIT' || data.investigationType === 'CREDIT';
        const currentIsLoongMotor = data.clientProfile === 'LOONG_MOTOR' || data.investigationType === 'LOONG_MOTOR';

        // Fetch investigation data
        console.log(`[CandidateFlow] Fetching investigation data for: ${data.investigationId}`);
        const invRef = doc(db, 'investigations', data.investigationId);
        const invSnap = await getDoc(invRef);
        if (invSnap.exists()) {
          console.log("[CandidateFlow] Investigation data fetched:", invSnap.data());
          setInvestigationData({ id: invSnap.id, ...invSnap.data() });
        } else {
          console.warn("[CandidateFlow] Investigation document not found:", data.investigationId);
        }

        console.log(`[CandidateFlow] Client Profile: ${data.clientProfile}, isHR: ${currentIsHR}, isCredit: ${currentIsCredit}, isLoongMotor: ${currentIsLoongMotor}`);
        
        // Determine total steps and phase
        const currentPhase = searchParams.get('phase') || '1';
        setPhase(currentPhase);

        if (currentIsCredit) {
          if (data.investigationScope === 'BASIC') {
            setTotalSteps(2); // Step 1: Questions, Step 2: Location & ID
          } else if (data.investigationScope === 'INTEGRAL' && currentPhase === '2') {
            setTotalSteps(2);
          } else {
            setTotalSteps(3);
          }
        } else if (currentIsLoongMotor) {
          // Loong Motor is 2 steps (Step 1: Location, Step 2: Arraigo Form)
          setTotalSteps(2);
        } else if (currentIsHR) {
          // HR is 2 steps (Location + Documents)
          setTotalSteps(2);
        } else {
          // General investigations (2 phases)
          setTotalSteps(2);
        }

        if (data.status === 'COMPLETED') {
          console.log("[CandidateFlow] Status is COMPLETED, showing success");
          setSuccess(true);
          setLoading(false);
          return;
        }
        
        console.log(`[CandidateFlow] Current status: ${data.status}, Phase: ${phase}`);
        if (!currentIsHR && !currentIsCredit && phase === '2' && data.status !== 'PHASE_1_COMPLETED' && data.status !== 'COMPLETED') {
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
            handleFirestoreError(updateErr, OperationType.UPDATE, `candidate_links/${linkSnap.id}`);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `candidate_links/${linkId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchLinkData();
  }, [linkId, phase]);

  const handleNextStep = () => {
    if (step < totalSteps) {
      if (step === 1) {
        // Validación estricta SOLO para el Paso 1
        if (!mapPosition || !realTimeLocation) {
          toast.error("Debes seleccionar tu dirección en el mapa y capturar tu GPS para continuar.", { id: 'gps-error' });
          return;
        }
      } else if (step === 2 && isCredit) {
        // Validación para el Paso 2 en Crédito (Socioeconómico)
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

    console.log(`Submitting step ${step}/${totalSteps} (Phase ${phase}, HR: ${isHR}, Credit: ${isCredit})`);

    if (!isAuthReady || !auth.currentUser) {
      console.warn("[CandidateFlow] Auth not ready or no user:", { isAuthReady, user: auth.currentUser?.uid });
      toast.error("Validando sesión segura. Por favor espera un momento o recarga la página.");
      if (!auth.currentUser) {
        signInAnonymously(auth).catch(console.error);
      }
      return;
    }

    if (step < totalSteps) {
      handleNextStep();
      return;
    }

    // A partir de aquí es la validación del ÚLTIMO PASO
    if (!isHR && !isCredit && phase === '1') {
      // Validate Socioeconomic / Pre-calificación
      const isLoongPreQual = linkData?.clientProfile === 'LOONG_MOTOR' && linkData?.isPreQual;
      
      if (isLoongPreQual) {
        if (!preQualQuestions.tiempoResidenciaAnios || !preQualQuestions.referenciaVecinalNombre || !preQualQuestions.referencia1Nombre) {
          alert("Para Loong Motor, la validación de Arraigo es prioritaria. Por favor completa el tiempo en domicilio y todas las referencias.");
          return;
        }
        const missingPhotos = [];
        if (!fotoFachada) missingPhotos.push("Fachada");
        if (!videoFachada) missingPhotos.push("Video de Entrada");
        if (!proofOfAddress) missingPhotos.push("Comprobante de Domicilio");
        if (!fotoSala) missingPhotos.push("Sala");
        if (!fotoComedor) missingPhotos.push("Comedor");
        if (!fotoCocina) missingPhotos.push("Cocina");
        if (!fotoHabitacion) missingPhotos.push("Habitación");
        if (!idFront) missingPhotos.push("Identificación Oficial");

        if (missingPhotos.length > 0) {
          alert(`Es obligatorio subir todas las evidencias para validar tu arraigo y campo: ${missingPhotos.join(", ")}.`);
          return;
        }
      } else if (!ingresoMensual || !gastosMensuales || !ocupacion || !direccionDeclarada || !antiguedadVivienda || (isCredit && !comprobanteIngresos)) {
        alert("Por favor, completa todos los campos requeridos para tu pre-calificación.");
        return;
      }

      setIsSubmitting(true);
      setProgress(0);
      setProgressText('Iniciando subida de evidencias...');
      
      try {
        const uploadTasks = [
          { file: fotoFachada, name: 'fachada', type: 'image' },
          { file: videoFachada, name: 'video_entrada', type: 'video' },
          { file: proofOfAddress, name: 'comprobante_domicilio', type: 'image' },
          { file: fotoSala, name: 'sala', type: 'image' },
          { file: fotoComedor, name: 'comedor', type: 'image' },
          { file: fotoCocina, name: 'cocina', type: 'image' },
          { file: fotoHabitacion, name: 'habitacion', type: 'image' },
          { file: idFront, name: 'identificacion_oficial', type: 'image' }
        ].filter(t => t.file !== null);

        const evidenceUrls: Record<string, string> = {};
        const totalFiles = uploadTasks.length;
        
        for (let i = 0; i < totalFiles; i++) {
          const task = uploadTasks[i];
          if (task.file) {
            setProgressText(`Subiendo ${task.name}...`);
            
            let fileToUpload: File | Blob = task.file;
            if (task.type === 'image') {
              fileToUpload = await compressImage(task.file);
            } else if (task.type === 'video') {
              setProgressText(`Cortando video a 45s si es necesario...`);
              fileToUpload = await trimVideo(task.file);
            }
            
            const storageRef = ref(storage, `candidatos/${linkData.investigationId}/preQual_${task.name}_${Date.now()}`);
            const uploadTask = uploadBytesResumable(storageRef, fileToUpload);
            
            await new Promise<void>((resolve, reject) => {
              uploadTask.on('state_changed', 
                (snapshot) => {
                  const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                  const overallProgress = ((i / totalFiles) * 100) + (fileProgress / totalFiles);
                  setProgress(Math.round(overallProgress));
                }, 
                (error) => reject(error), 
                () => resolve()
              );
            });
            
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            evidenceUrls[task.name] = url;
          }
        }

        setProgress(100);
        setProgressText('Datos guardados. Iniciando análisis en segundo plano...');

        const candidateSubmittedData = {
          mapLocation: mapPosition ? `${mapPosition.lat.toFixed(6)}, ${mapPosition.lng.toFixed(6)}` : 'No proporcionada',
          realTimeLocation: realTimeLocation ? `${realTimeLocation.lat.toFixed(6)}, ${realTimeLocation.lng.toFixed(6)}` : 'No proporcionada',
          ingresoMensual: isLoongPreQual ? (Number(preQualQuestions.ingresosFijos) + Number(preQualQuestions.ingresosExtras || 0)).toString() : ingresoMensual,
          gastosMensuales: isLoongPreQual ? (Number(preQualQuestions.gastosVivienda) + Number(preQualQuestions.gastosAlimentacion) + Number(preQualQuestions.gastosTransporte || 0)).toString() : gastosMensuales,
          ocupacion: isLoongPreQual ? preQualQuestions.usoMoto : ocupacion,
          estadoCivil,
          dependientesEconomicos,
          direccionDeclarada,
          tipoVivienda,
          antiguedadVivienda,
          preQualQuestions,
          uploadedFileUrls: evidenceUrls,
          submittedAt: new Date().toISOString()
        };

        // Update Candidate Link immediately
      try {
        await updateDoc(doc(db, 'candidate_links', linkData.id), {
          status: 'COMPLETED',
          candidateData: JSON.stringify(candidateSubmittedData),
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `candidate_links/${linkData.id}`);
      }

      // Update Investigation immediately
      try {
        await updateDoc(doc(db, 'investigations', linkData.investigationId), {
          status: 'IN_PROGRESS',
          linkStatus: 'COMPLETED',
          candidateData: JSON.stringify(candidateSubmittedData),
          uploadedFileUrls: evidenceUrls,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `investigations/${linkData.investigationId}`);
      }

        // Show success screen immediately
        setSuccess(true);
        setIsSubmitting(false);

        // Run AI analysis in background
        (async () => {
          try {
            const { analyzeCandidateData } = await import('../lib/gemini');
            const candidateDataForAI = {
              perfil: 'LOONG_MOTOR',
              isPreQual: true,
              preQualQuestions,
              direccionDeclarada,
              realTimeLocation: realTimeLocation ? { lat: realTimeLocation.lat, lng: realTimeLocation.lng } : null,
              mapPosition: mapPosition ? { lat: mapPosition.lat, lng: mapPosition.lng } : null,
              targetLocation: targetLocation,
              targetAddress: targetAddress,
              loongMontoTotal: linkData.loongMontoTotal,
              loongEnganche: linkData.loongEnganche
            };

            const aiDictamenRaw = await analyzeCandidateData(
              candidateDataForAI,
              Object.values(evidenceUrls),
              linkData.clientRules,
              'none', 
              null,
              null
            );

            const aiDictamen = JSON.parse(aiDictamenRaw);
            const preQualResult = aiDictamen?.dictamenFinal?.estado === 'VIABLE' ? 'VIABLE' : aiDictamen?.dictamenFinal?.estado === 'SUJETO A CONSIDERACIÓN' ? 'REVIEW' : 'NOT_VIABLE';
            const preQualScore = aiDictamen?.score || 0;

            try {
              await updateDoc(doc(db, 'investigations', linkData.investigationId), {
                status: 'COMPLETED',
                socioeconomicDictamen: aiDictamenRaw,
                score: preQualScore,
                result: preQualResult,
                updatedAt: new Date().toISOString()
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `investigations/${linkData.investigationId}`);
            }
          } catch (aiErr: any) {
            console.error("AI Background Analysis failed:", aiErr);
            const errorDictamen = {
              dictamenFinal: {
                estado: 'ERROR_IA',
                resumen: `Error en análisis automático: ${aiErr.message || 'Error de configuración de API'}. Se requiere revisión manual.`
              }
            };
            try {
              await updateDoc(doc(db, 'investigations', linkData.investigationId), {
                status: 'COMPLETED',
                socioeconomicDictamen: JSON.stringify(errorDictamen),
                result: 'REVIEW',
                updatedAt: new Date().toISOString()
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `investigations/${linkData.investigationId}`);
            }
          }
        })();

      } catch (err: any) {
        console.error("Error submitting phase 1:", err);
        setError(`Error al guardar la información: ${err.message}. Por favor, intenta de nuevo.`);
        setIsSubmitting(false);
      }
      return;
    }

    if (isCredit || isLoongMotor) {
      if (!ingresoMensual || !gastosMensuales || !ocupacion || !direccionDeclarada || !antiguedadVivienda || (isCredit && !comprobanteIngresos)) {
        alert("Por favor, completa todos los campos de tu perfil socioeconómico antes de enviar.");
        return;
      }
    }

    const missingFiles = [];
    if (!idFront) missingFiles.push("INE Frente");
    if (!idBack) missingFiles.push("INE Reverso");
    if (!proofOfAddress) missingFiles.push("Comprobante de Domicilio");
    if (!selfie) missingFiles.push("Selfie");
    if (!fotoFachada) missingFiles.push("Foto de Fachada");
    if (!videoFachada) missingFiles.push("Video de Entrada");
    
    if (!isHR) {
      if (!fotoSala) missingFiles.push("Foto de la Sala");
      if (!fotoComedor) missingFiles.push("Foto del Comedor");
      if (!fotoCocina) missingFiles.push("Foto de la Cocina");
      if (!fotoHabitacion) missingFiles.push("Foto de la Habitación");
    }

    if (missingFiles.length > 0) {
      alert(`Inconsistencia detectada: Faltan archivos requeridos (${missingFiles.join(", ")}). Por favor, sube todos los documentos para permitir su cotejo.`);
      return;
    }

    setIsSubmitting(true);
    setProgress(0);
    setProgressText('Preparando archivos y validando ubicación...');
    setError('');

    try {
      let phase1Data: any = {};
      if (!isHR && !isCredit && !isLoongMotor) {
        try {
          if (linkData.candidateData) {
            phase1Data = JSON.parse(linkData.candidateData);
          }
        } catch (e) {}
      } else {
        phase1Data = {
          mapLocation: mapPosition ? `${mapPosition.lat.toFixed(6)}, ${mapPosition.lng.toFixed(6)}` : 'No proporcionada',
          realTimeLocation: realTimeLocation ? `${realTimeLocation.lat.toFixed(6)}, ${realTimeLocation.lng.toFixed(6)}` : 'No proporcionada',
          direccionDeclarada: direccionDeclarada || 'No especificada',
          ...(isCredit || isLoongMotor ? {
            ingresoMensual,
            gastosMensuales,
            ocupacion,
            estadoCivil,
            dependientesEconomicos,
            tipoVivienda,
            antiguedadVivienda,
            preQualQuestions
          } : {})
        };
      }

      let distance = 0;
      if (phase1Data.mapLocation && phase1Data.realTimeLocation) {
        const mapLat = parseFloat(phase1Data.mapLocation.split(',')[0]);
        const mapLng = parseFloat(phase1Data.mapLocation.split(',')[1]);
        const realLat = parseFloat(phase1Data.realTimeLocation.split(',')[0]);
        const realLng = parseFloat(phase1Data.realTimeLocation.split(',')[1]);

        const R = 6371e3; 
        const φ1 = mapLat * Math.PI/180;
        const φ2 = realLat * Math.PI/180;
        const Δφ = (realLat-mapLat) * Math.PI/180;
        const Δλ = (realLng-mapLng) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distance = R * c; 
      }

      setProgressText('Optimizando imágenes...');
      
      const safeCompress = async (file: File | null) => {
        if (!file) return null;
        try {
          return await compressImage(file, 1200);
        } catch (e) {
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

      let compVideoFachada = videoFachada;
      if (videoFachada) {
        setProgressText('Cortando video a 45s...');
        compVideoFachada = await trimVideo(videoFachada);
      }

      const filesToUpload = [
        { id: 'idFrontUrl', file: compIdFront, label: 'INE Frente', path: `candidatos/${linkData.investigationId}/idFront` },
        { id: 'idBackUrl', file: compIdBack, label: 'INE Reverso', path: `candidatos/${linkData.investigationId}/idBack` },
        { id: 'selfieUrl', file: compSelfie, label: 'Prueba de Vida', path: `candidatos/${linkData.investigationId}/selfie` },
        { id: 'proofOfAddressUrl', file: compProof, label: 'Comprobante', path: `candidatos/${linkData.investigationId}/proofOfAddress` },
        { id: 'incomeProofUrl', file: compIncome, label: 'Comprobante Ingresos', path: `candidatos/${linkData.investigationId}/incomeProof` },
        { id: 'fotoFachadaUrl', file: compFotoFachada, label: 'Fachada', path: `candidatos/${linkData.investigationId}/fotoFachada` },
        { id: 'videoFachadaUrl', file: compVideoFachada, label: 'Video de Entrada', path: `candidatos/${linkData.investigationId}/videoFachada` },
        { id: 'fotoSalaUrl', file: compFotoSala, label: 'Sala', path: `candidatos/${linkData.investigationId}/fotoSala` },
        { id: 'fotoComedorUrl', file: compFotoComedor, label: 'Comedor', path: `candidatos/${linkData.investigationId}/fotoComedor` },
        { id: 'fotoCocinaUrl', file: compFotoCocina, label: 'Cocina', path: `candidatos/${linkData.investigationId}/fotoCocina` },
        { id: 'fotoHabitacionUrl', file: compFotoHabitacion, label: 'Habitación', path: `candidatos/${linkData.investigationId}/fotoHabitacion` }
      ].filter(f => f.file !== null);

      const currentUrls: Record<string, string> = {};
      const totalFiles = filesToUpload.length;

      for (let i = 0; i < totalFiles; i++) {
        const item = filesToUpload[i];
        if (!item.file) continue;

        setProgressText(`Subiendo ${item.label}...`);
        
        const storageRef = ref(storage, `${item.path}_${Date.now()}_${item.file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, item.file);
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              const overallProgress = ((i / totalFiles) * 100) + (fileProgress / totalFiles);
              setProgress(Math.round(overallProgress));
            }, 
            (error) => reject(error), 
            () => resolve()
          );
        });
        
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        currentUrls[item.id] = url;
      }

      setUploadedFileUrls(currentUrls);
      setProgress(100);
      setProgressText("Guardando datos finales...");

      const candidateSubmittedData = {
        ...phase1Data,
        distanceMeters: Math.round(distance),
        idFrontUrl: currentUrls['idFrontUrl'] || null,
        idBackUrl: currentUrls['idBackUrl'] || null,
        proofOfAddressUrl: currentUrls['proofOfAddressUrl'] || null,
        incomeProofUrl: currentUrls['incomeProofUrl'] || null,
        idFrontName: idFront?.name || null,
        idBackName: idBack?.name || null,
        proofOfAddressName: proofOfAddress?.name || null,
        incomeProofName: comprobanteIngresos?.name || null,
        selfieUrl: currentUrls['selfieUrl'] || null,
        fotoFachadaUrl: currentUrls['fotoFachadaUrl'] || null,
        videoFachadaUrl: currentUrls['videoFachadaUrl'] || null,
        submittedAt: new Date().toISOString()
      };

      // Update Candidate Link immediately
      try {
        await updateDoc(doc(db, 'candidate_links', linkData.id), {
          status: 'COMPLETED',
          candidateData: JSON.stringify(candidateSubmittedData),
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `candidate_links/${linkData.id}`);
      }

      // Update Investigation immediately
      try {
        await updateDoc(doc(db, 'investigations', linkData.investigationId), {
          linkStatus: 'COMPLETED',
          status: 'IN_PROGRESS',
          candidateData: JSON.stringify(candidateSubmittedData),
          uploadedFileUrls: currentUrls,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `investigations/${linkData.investigationId}`);
      }

      // Show success screen immediately
      setSuccess(true);
      setIsSubmitting(false);

      // Run AI in background
      (async () => {
        try {
          const { analyzeCandidateData } = await import('../lib/gemini');
          
          let businessRules = '';
          let scoringConfig = null;
          try {
            if (investigationData?.clientId) {
              const clientDoc = await getDoc(doc(db, 'clients', investigationData.clientId));
              if (clientDoc.exists()) {
                const clientData = clientDoc.data();
                businessRules = clientData.politicasGenerales || '';
                scoringConfig = clientData.scoringConfig || null;
              }
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `clients/${investigationData?.clientId}`);
          }

          const imageParts = [
            currentUrls['fotoFachadaUrl'],
            currentUrls['videoFachadaUrl'],
            currentUrls['fotoSalaUrl'],
            currentUrls['fotoComedorUrl'],
            currentUrls['fotoCocinaUrl'],
            currentUrls['fotoHabitacionUrl'],
            currentUrls['idFrontUrl'],
            currentUrls['idBackUrl'],
            currentUrls['proofOfAddressUrl'],
            currentUrls['selfieUrl']
          ].filter(Boolean);

          const aiResult = await analyzeCandidateData(
            {
              perfil: linkData.clientProfile,
              puesto: investigationData?.jobProfile?.vacancy || 'No especificado',
              montoCreditoCapital: investigationData?.montoCreditoCapital,
              montoCreditoIntereses: investigationData?.montoCreditoIntereses,
              plazoFinanciamiento: investigationData?.plazoFinanciamiento,
              tipoCredito: investigationData?.tipoCredito,
              loongMontoTotal: linkData?.loongMontoTotal || investigationData?.loongMontoTotal,
              loongEnganche: linkData?.loongEnganche || investigationData?.loongEnganche,
              ...phase1Data
            },
            imageParts,
            businessRules,
            'none',
            scoringConfig
          );

          const aiParsed = JSON.parse(aiResult);
          const dictamen = {
            ...aiParsed,
            congruenciaDomicilio: {
              ...(aiParsed.congruenciaDomicilio || {}),
              distanciaMetros: Math.round(distance),
              verificado: distance < 150
            }
          };

          try {
            await updateDoc(doc(db, 'investigations', linkData.investigationId), {
              socioeconomicDictamen: JSON.stringify(dictamen),
              result: aiResult,
              status: 'COMPLETED',
              score: dictamen?.score || 0,
              scoreBreakdown: dictamen?.scoreBreakdown ? JSON.stringify(dictamen.scoreBreakdown) : null,
              updatedAt: new Date().toISOString()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `investigations/${linkData.investigationId}`);
          }
        } catch (aiErr: any) {
          console.error("AI Background Analysis failed:", aiErr);
          const errorDictamen = {
            dictamenFinal: {
              estado: 'REVIEW',
              resumen: `Error en análisis automático: ${aiErr.message || 'Error de configuración'}. Se requiere revisión manual.`
            }
          };
          try {
            await updateDoc(doc(db, 'investigations', linkData.investigationId), {
              status: 'COMPLETED',
              socioeconomicDictamen: JSON.stringify(errorDictamen),
              result: 'REVIEW',
              updatedAt: new Date().toISOString()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `investigations/${linkData.investigationId}`);
          }
        }
      })();

    } catch (err: any) {
      console.error("Error submitting data:", err);
      setError(`Error al guardar la información: ${err.message}. Por favor, intenta de nuevo.`);
      setIsSubmitting(false);
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLoc = {lat: position.coords.latitude, lng: position.coords.longitude};
          setRealTimeLocation(newLoc);
          setGpsAccuracy(position.coords.accuracy);
          
          const referencePoint = targetLocation || mapPosition;
          
          if (referencePoint) {
            const R = 6371e3; // metres
            const φ1 = referencePoint.lat * Math.PI/180;
            const φ2 = newLoc.lat * Math.PI/180;
            const Δφ = (newLoc.lat-referencePoint.lat) * Math.PI/180;
            const Δλ = (newLoc.lng-referencePoint.lng) * Math.PI/180;

            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const d = R * c;
            
            setDistanceToTarget(d);
            // 30 meter rule for Loong Motor, 50m for others
            const threshold = isLoongMotor ? 30 : 50;
            const withinRange = d <= threshold || linkData?.isTestMode;
            setIsWithinRange(withinRange);
            
            if (d > threshold && !linkData?.isTestMode) {
              toast.error(`Estás a ${Math.round(d)}m de la ubicación objetivo. Debes estar a menos de ${threshold}m para activar la cámara.`, { duration: 5000 });
            } else if (d > threshold && linkData?.isTestMode) {
              toast.success(`Modo Prueba: Estás a ${Math.round(d)}m, pero se permite el acceso a la cámara.`);
            } else {
              toast.success("Ubicación validada. Cámara activada.");
            }
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          toast.error("No se pudo obtener la ubicación. Por favor, permítelo en tu navegador.");
        },
        { enableHighAccuracy: true }
      );
    } else {
      toast.error("La geolocalización no es soportada por este navegador.");
    }
  };

  const renderLoongPreQualForm = () => {
    return (
      <div className="space-y-8">
        {/* Photos Section (MOVED TO TOP FOR PRIORITY) */}
        <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 space-y-6">
          <div className="border-b border-amber-200 pb-4 flex justify-between items-start">
            <div>
              <label className="block text-sm font-bold text-amber-900 mb-2 flex items-center">
                <Camera className="w-5 h-5 mr-2" />
                Evidencia Fotográfica de Arraigo (Campo)
              </label>
              <p className="text-xs text-amber-700">
                La toma de fotos es <strong>obligatoria</strong> para validar el arraigo. La fachada debe tomarse con la puerta abierta para confirmar habitabilidad.
              </p>
            </div>
            {mapPosition && (
              <div className="hidden sm:block text-right">
                <p className="text-[10px] font-bold text-amber-800 uppercase">Ubicación Validada</p>
                <p className="text-[9px] text-amber-600">{mapPosition.lat.toFixed(4)}, {mapPosition.lng.toFixed(4)}</p>
              </div>
            )}
          </div>
          
          {/* Map Cross-check Preview */}
          {mapPosition && isLoaded && (
            <div className="h-32 w-full rounded-xl overflow-hidden border border-amber-200 shadow-inner mb-4">
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapPosition}
                zoom={17}
                options={{
                  disableDefaultUI: true,
                  gestureHandling: 'none',
                  styles: [
                    {
                      featureType: "all",
                      elementType: "labels",
                      stylers: [{ visibility: "on" }]
                    }
                  ]
                }}
              >
                <Marker position={mapPosition} />
              </GoogleMap>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fachada */}
            <div className="relative group">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fachada (Puerta Abierta)</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={!isWithinRange}
                onChange={(e) => setFotoFachada(e.target.files ? e.target.files[0] : null)}
                className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isWithinRange ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              />
              <div className={`p-4 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                !isWithinRange ? 'bg-slate-100 border-slate-200 opacity-60' :
                fotoFachada ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-amber-200'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!isWithinRange ? 'bg-slate-200 text-slate-400' : fotoFachada ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {!isWithinRange ? <Lock className="w-5 h-5" /> : fotoFachada ? <CheckCircle2 className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                </div>
                <span className="text-[10px] font-bold text-center">Fachada</span>
              </div>
            </div>

            {/* Comprobante de Domicilio (INTEGRATED HERE) */}
            <div className="relative group">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Comprobante de Domicilio</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setProofOfAddress(e.target.files ? e.target.files[0] : null)}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
              />
              <div className={`p-4 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                proofOfAddress ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-amber-200'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${proofOfAddress ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {proofOfAddress ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <span className="text-[10px] font-bold text-center">Comprobante</span>
              </div>
            </div>

            {/* Sala */}
            <div className="relative group">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sala</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFotoSala(e.target.files ? e.target.files[0] : null)}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
              />
              <div className={`p-4 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                fotoSala ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-amber-200'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${fotoSala ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {fotoSala ? <CheckCircle2 className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                </div>
                <span className="text-[10px] font-bold text-center">Sala</span>
              </div>
            </div>

            {/* Comedor */}
            <div className="relative group">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Comedor</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFotoComedor(e.target.files ? e.target.files[0] : null)}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
              />
              <div className={`p-4 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                fotoComedor ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-amber-200'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${fotoComedor ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {fotoComedor ? <CheckCircle2 className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                </div>
                <span className="text-[10px] font-bold text-center">Comedor</span>
              </div>
            </div>

            {/* Cocina */}
            <div className="relative group">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cocina</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFotoCocina(e.target.files ? e.target.files[0] : null)}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
              />
              <div className={`p-4 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                fotoCocina ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-amber-200'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${fotoCocina ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {fotoCocina ? <CheckCircle2 className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                </div>
                <span className="text-[10px] font-bold text-center">Cocina</span>
              </div>
            </div>

            {/* Habitación */}
            <div className="relative group">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Habitación</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFotoHabitacion(e.target.files ? e.target.files[0] : null)}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
              />
              <div className={`p-4 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                fotoHabitacion ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-amber-200'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${fotoHabitacion ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {fotoHabitacion ? <CheckCircle2 className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                </div>
                <span className="text-[10px] font-bold text-center">Habitación</span>
              </div>
            </div>

            {/* Video Fachada (New) */}
            <div className="relative group sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Video de Entrada (45s máx)</label>
              <input
                type="file"
                accept="video/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files ? e.target.files[0] : null;
                  if (file) {
                    const video = document.createElement('video');
                    video.preload = 'metadata';
                    video.onloadedmetadata = () => {
                      window.URL.revokeObjectURL(video.src);
                      if (video.duration > 46) { // Allow a small buffer
                        setVideoDurationError(`El video dura ${Math.round(video.duration)}s. El máximo permitido es 45s para el dictamen de arraigo.`);
                        setVideoFachada(null);
                        toast.error("Video demasiado largo. Máximo 45 segundos.");
                      } else {
                        setVideoDurationError(null);
                        setVideoFachada(file);
                      }
                    };
                    video.src = URL.createObjectURL(file);
                  } else {
                    setVideoFachada(null);
                    setVideoDurationError(null);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
              />
              <div className={`p-4 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                videoFachada ? 'bg-emerald-50 border-emerald-200' : videoDurationError ? 'bg-red-50 border-red-200' : 'bg-white border-blue-200'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${videoFachada ? 'bg-emerald-100 text-emerald-600' : videoDurationError ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                  {videoFachada ? <CheckCircle2 className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </div>
                <span className="text-[10px] font-bold text-center">Video de Validación</span>
              </div>
              {videoDurationError && <p className="text-[9px] text-red-500 mt-1 font-bold">{videoDurationError}</p>}
              <p className="text-[9px] text-slate-400 mt-1 italic">Grabe desde la calle entrando a su domicilio para validar fachada e ingreso. Máximo 45 segundos.</p>
            </div>

            {/* ID Front (New) */}
            <div className="relative group sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Identificación Oficial (Frente)</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setIdFront(e.target.files ? e.target.files[0] : null)}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
              />
              <div className={`p-4 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                idFront ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-amber-200'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${idFront ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {idFront ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <span className="text-[10px] font-bold text-center">Subir Identificación</span>
              </div>
            </div>
          </div>

          {!isWithinRange && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
              <p className="text-[10px] text-red-700">
                <strong>Cámara de Fachada Bloqueada:</strong> Debes estar físicamente en el domicilio declarado para capturar la fachada. Valida tu ubicación GPS arriba.
              </p>
            </div>
          )}
        </div>

        {/* Arraigo Section */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center">
            <MapPin className="w-3 h-3 mr-2" />
            Información de Arraigo y Domicilio
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiempo en domicilio actual (Años)</label>
              <input
                type="number"
                required
                value={preQualQuestions.tiempoResidenciaAnios}
                onChange={(e) => setPreQualQuestions({...preQualQuestions, tiempoResidenciaAnios: e.target.value})}
                placeholder="Ej. 5"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Vivienda</label>
              <select
                value={preQualQuestions.propiedadVivienda}
                onChange={(e) => setPreQualQuestions({...preQualQuestions, propiedadVivienda: e.target.value})}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all bg-white"
              >
                <option value="Propia">Propia</option>
                <option value="Rentada">Rentada</option>
                <option value="Familiar">Familiar / Con Padres</option>
                <option value="Pagando">Pagando (Hipoteca)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Zona / Entorno</label>
              <select
                value={preQualQuestions.tipoZona}
                onChange={(e) => setPreQualQuestions({...preQualQuestions, tipoZona: e.target.value})}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all bg-white"
              >
                <option value="Residencial">Residencial</option>
                <option value="Comercial">Comercial</option>
                <option value="Popular">Popular / Urbana</option>
                <option value="Industrial">Industrial</option>
                <option value="Rural">Rural</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Personas que viven con usted</label>
              <input
                type="number"
                required
                value={preQualQuestions.personasViven}
                onChange={(e) => setPreQualQuestions({...preQualQuestions, personasViven: e.target.value})}
                placeholder="Ej. 3"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* References Section */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center">
            <Users className="w-3 h-3 mr-2" />
            Referencias de Arraigo (Familiares y Vecinos)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Referencia 1 (Familiar)</label>
              <input
                type="text"
                required
                value={preQualQuestions.referencia1Nombre}
                onChange={(e) => setPreQualQuestions({...preQualQuestions, referencia1Nombre: e.target.value})}
                placeholder="Nombre"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              />
              <select
                value={preQualQuestions.referencia1Parentesco}
                onChange={(e) => setPreQualQuestions({...preQualQuestions, referencia1Parentesco: e.target.value})}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white"
              >
                <option value="Padre/Madre">Padre/Madre</option>
                <option value="Hermano(a)">Hermano(a)</option>
                <option value="Hijo(a)">Hijo(a)</option>
                <option value="Tío(a)">Tío(a)</option>
                <option value="Otro">Otro Familiar</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Referencia 2 (Amigo/Trabajo)</label>
              <input
                type="text"
                required
                value={preQualQuestions.referencia2Nombre}
                onChange={(e) => setPreQualQuestions({...preQualQuestions, referencia2Nombre: e.target.value})}
                placeholder="Nombre"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              />
              <select
                value={preQualQuestions.referencia2Parentesco}
                onChange={(e) => setPreQualQuestions({...preQualQuestions, referencia2Parentesco: e.target.value})}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white"
              >
                <option value="Amigo(a)">Amigo(a)</option>
                <option value="Compañero Trabajo">Compañero Trabajo</option>
                <option value="Conocido">Conocido</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Referencia Vecinal (Indispensable)</label>
              <input
                type="text"
                required
                value={preQualQuestions.referenciaVecinalNombre}
                onChange={(e) => setPreQualQuestions({...preQualQuestions, referenciaVecinalNombre: e.target.value})}
                placeholder="Nombre del Vecino"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              />
              <p className="text-[9px] text-slate-400 italic">Esta referencia es clave para validar el arraigo en campo.</p>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Justificación de Domicilio (Opcional)</label>
            <textarea
              value={preQualQuestions.justificacionDomicilio}
              onChange={(e) => setPreQualQuestions({...preQualQuestions, justificacionDomicilio: e.target.value})}
              placeholder="Ej. La manzana (mz) corresponde al número oficial, o no hay número interior pero se manifestó por..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all h-24 resize-none text-sm"
            />
            <p className="text-[10px] text-slate-400 mt-1 italic">Use este espacio para aclarar discrepancias menores entre su identificación y comprobante.</p>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Error en el Proceso</h2>
          <p className="text-slate-600 mb-6">{error}</p>
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

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 max-w-xl w-full">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            ¡Información Recibida!
          </h2>
          
          <p className="text-lg text-slate-600 mb-8 leading-relaxed">
            Hemos recibido tus documentos y ubicación correctamente. Tu proceso de validación ha comenzado y serás notificado por el equipo de Loong Motor una vez que el análisis sea completado.
          </p>

          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-700 text-sm font-medium mb-6">
            Gracias por confiar en Loong Motor.
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
          >
            Cerrar y Finalizar
          </button>
          
          <p className="text-xs text-slate-400 mt-6">
            ID de Referencia: <span className="font-mono">{linkId}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Iframe Cookie Warning Banner */}
      {isInIframe && (
        <div className="bg-amber-50 border-b border-amber-200 p-4 flex flex-col sm:flex-row items-center justify-center gap-4 shadow-sm no-print">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-bold text-amber-900">¿Ves el error "Action required" o "Security Cookie"?</p>
              <p className="text-xs text-amber-700">Estás usando un enlace de desarrollo. Si eres el cliente, haz clic en el botón para continuar.</p>
            </div>
          </div>
          <a 
            href={window.location.href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-black rounded-xl flex items-center gap-2 transition-all shadow-md whitespace-nowrap"
          >
            ABRIR EN VENTANA NUEVA
          </a>
        </div>
      )}

      {/* Header Fijo y Corporativo */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 ${isLoongMotor ? 'bg-red-600' : 'bg-blue-600'} text-white flex items-center justify-center rounded-xl font-bold shadow-lg shadow-blue-200`}>
            {isLoongMotor ? 'LM' : 'JV'}
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">
            {isLoongMotor ? 'LOONG ' : 'JUXA '}
            <span className={isLoongMotor ? 'text-red-600' : 'text-blue-600'}>
              {isLoongMotor ? 'MOTOR' : 'VERIFY'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span className="text-[10px] sm:text-xs font-semibold text-emerald-700 uppercase tracking-wider whitespace-nowrap">
            Verificación Encriptada de 256-bits
          </span>
        </div>
      </header>

      {/* Hero Section (Bienvenida) */}
      <section className={`bg-gradient-to-b ${isLoongMotor ? 'from-red-50' : 'from-blue-50'} to-white py-12 px-4 text-center`}>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
            {(isLoongMotor && !investigationData?.isTest && !investigationData?.isPreQual) ? 'Solicitud de Crédito de Motocicletas' : 'Proceso de Verificación Segura'}
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed mb-8">
            {(isLoongMotor && !investigationData?.isTest && !investigationData?.isPreQual)
              ? 'Bienvenido a Loong Motor. Por favor, completa tu solicitud para que nuestro motor de IA analice tu perfil y te ofrezca la mejor opción de financiamiento.' 
              : 'Por favor, completa los siguientes pasos. Este proceso es rápido, seguro y cumple con las normativas de privacidad más estrictas.'}
          </p>

          {((isCredit || isLoongMotor) && investigationData && (investigationData.loongMontoTotal || investigationData.loongEnganche) && !investigationData.isTest && !investigationData.isPreQual) && (
            <div className={`bg-white p-6 rounded-2xl shadow-sm border ${isLoongMotor ? 'border-red-100' : 'border-emerald-100'} text-left max-w-lg mx-auto animate-in fade-in slide-in-from-top-4 duration-500`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 ${isLoongMotor ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'} rounded-lg`}>
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900">
                  {isLoongMotor ? 'Resumen de Financiamiento Loong Motor' : 'Resumen de Solicitud de Crédito'}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {isLoongMotor ? (
                  <>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto Total a Financiar (C+I)</p>
                      <p className="text-xl font-bold text-red-600">${linkData?.loongMontoTotal || investigationData?.loongMontoTotal || '0.00'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enganche Aportado</p>
                      <p className="text-sm font-bold text-slate-700">{linkData?.loongEnganche || investigationData?.loongEnganche || '0'}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estatus</p>
                      <p className="text-sm font-bold text-emerald-600">Validando Arraigo</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Crédito</p>
                      <p className="text-sm font-bold text-slate-700">{investigationData.tipoCredito || 'Personal'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plazo</p>
                      <p className="text-sm font-bold text-slate-700">{investigationData.plazoFinanciamiento || 'No especificado'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto Capital</p>
                      <p className="text-sm font-bold text-emerald-600">${investigationData.montoCreditoCapital || '0.00'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto con Intereses</p>
                      <p className="text-sm font-bold text-slate-700">${investigationData.montoCreditoIntereses || '0.00'}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white p-6 sm:p-10 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
            {/* Stepper Visual Moderno */}
            <div className="mb-12 relative">
              <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-100 -z-0"></div>
              <div 
                className="absolute top-5 left-0 h-0.5 bg-blue-600 transition-all duration-500 -z-0" 
                style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
              ></div>
              
              <div className="flex justify-between relative z-10">
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                  <div key={s} className="flex flex-col items-center group">
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 border-2 ${
                        step === s 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 scale-110' 
                          : step > s 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      {step > s ? <CheckCircle2 className="w-6 h-6" /> : s}
                    </div>
                    <span className={`text-[10px] sm:text-xs font-bold mt-3 uppercase tracking-widest transition-colors duration-300 ${
                      step >= s ? 'text-blue-600' : 'text-slate-400'
                    }`}>
                      {isCredit 
                        ? (s === 1 ? 'Ubicación' : s === 2 ? 'Perfil' : 'Documentos')
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
            {phase === '1' && (
              (step === 1 && (linkData?.investigationScope !== 'BASIC' || isLoongMotor)) ||
              (step === 2 && linkData?.investigationScope === 'BASIC' && !isLoongMotor)
            ) && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                Ubicación y Validación
              </h3>
              <p className="text-sm text-slate-500">
                Selecciona tu dirección en el mapa y luego obtén tu ubicación en tiempo real para validar.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">1. Selecciona tu dirección en el mapa</label>
                  
                               <div className="flex gap-2 mb-4">
                    {isLoaded && (
                      <Autocomplete
                        onLoad={(autocomplete) => { autocompleteRef.current = autocomplete; }}
                        onPlaceChanged={handlePlaceChanged}
                        className="flex-1"
                      >
                        <input
                          type="text"
                          placeholder={targetLocation ? "Dirección pre-cargada" : "Busca tu dirección o mueve el pin en el mapa..."}
                          value={direccionDeclarada}
                          onChange={e => !targetLocation && setDireccionDeclarada(e.target.value)}
                          disabled={!!targetLocation}
                          className={`w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${targetLocation ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                        />
                      </Autocomplete>
                    )}
                  </div>

                  <div className="h-80 w-full rounded-xl overflow-hidden border border-slate-300 z-0 relative">
                    {isLoaded ? (
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={mapCenter}
                        zoom={17}
                        onClick={handleMapClick}
                        options={{
                          disableDefaultUI: false,
                          zoomControl: true,
                          streetViewControl: true,
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
                            }
                          ]
                        }}
                      >
                        {mapPosition && <Marker position={mapPosition} label="D" />}
                        {realTimeLocation && (
                          <Marker 
                            position={realTimeLocation} 
                            icon={{
                              path: google.maps.SymbolPath.CIRCLE,
                              scale: 8,
                              fillColor: "#3b82f6",
                              fillOpacity: 1,
                              strokeWeight: 2,
                              strokeColor: "#ffffff",
                            }}
                            label="T"
                          />
                        )}
                        {targetLocation && (
                          <Marker 
                            position={targetLocation} 
                            icon={{
                              url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                            }}
                            label="OBJETIVO"
                          />
                        )}
                      </GoogleMap>
                    ) : (
                      <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center">
                        <p className="text-slate-400 text-sm">Cargando mapa...</p>
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">2. Valida tu ubicación en tiempo real</label>
                  <div className="flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={getLocation}
                      className="px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-xl hover:bg-blue-600 hover:text-white hover:shadow-md transition-all text-sm flex items-center active:scale-95"
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Obtener Ubicación GPS
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

            {/* Pre-qualification Section (Credit BASIC Step 1) */}
            {phase === '1' && step === 1 && linkData?.investigationScope === 'BASIC' && !isLoongMotor && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Pre-calificación de Crédito
              </h3>
              <p className="text-sm text-slate-500">
                Por favor, responde estas preguntas para perfilar tu solicitud de crédito.
              </p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto Solicitado ($)</label>
                    <input 
                      type="number" 
                      required 
                      value={preQualQuestions.montoSolicitado} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, montoSolicitado: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 50000" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ingresos Mensuales Netos ($)</label>
                    <input 
                      type="number" 
                      required 
                      value={preQualQuestions.ingresosMensuales} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, ingresosMensuales: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 25000" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gastos Mensuales Estimados ($)</label>
                    <input 
                      type="number" 
                      required 
                      value={preQualQuestions.gastosMensuales} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, gastosMensuales: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 12000" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">¿Tienes deudas activas?</label>
                    <select 
                      value={preQualQuestions.tieneDeudas} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, tieneDeudas: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                    >
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </select>
                  </div>
                </div>

                {preQualQuestions.tieneDeudas === 'si' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto total de deudas ($)</label>
                    <input 
                      type="number" 
                      required 
                      value={preQualQuestions.montoDeudas} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, montoDeudas: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 15000" 
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Antigüedad Laboral (Años)</label>
                    <input 
                      type="number" 
                      required 
                      value={preQualQuestions.antiguedadLaboral} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, antiguedadLaboral: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 3" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Contrato</label>
                    <select 
                      value={preQualQuestions.tipoContrato} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, tipoContrato: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vivienda</label>
                    <select 
                      value={preQualQuestions.propiedadVivienda} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, propiedadVivienda: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                    >
                      <option value="Propia">Propia</option>
                      <option value="Rentada">Rentada</option>
                      <option value="Familiar">Familiar / Con Padres</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Estado en Buró (Declarado)</label>
                    <select 
                      value={preQualQuestions.buroCredito} 
                      onChange={e => setPreQualQuestions({...preQualQuestions, buroCredito: e.target.value})} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                    >
                      <option value="Excelente">Excelente (Sin atrasos)</option>
                      <option value="Bueno">Bueno (Atrasos menores)</option>
                      <option value="Regular">Regular (Atrasos frecuentes)</option>
                      <option value="Malo">Malo (En jurídico / Quita)</option>
                      <option value="Sin Historial">Sin Historial</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 mb-3">Información Económica Base</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Ingreso Mensual Base (MXN)</label>
                      <input 
                        type="number" 
                        required 
                        value={ingresoMensual} 
                        onChange={e => setIngresoMensual(e.target.value)} 
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                        placeholder="Ej. 15000" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Gastos Mensuales Base (MXN)</label>
                      <input 
                        type="number" 
                        required 
                        value={gastosMensuales} 
                        onChange={e => setGastosMensuales(e.target.value)} 
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                        placeholder="Ej. 10000" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Socioeconomic Section */}
            {phase === '1' && (
              (step === 2 && linkData?.clientProfile !== 'HR' && linkData?.investigationScope !== 'BASIC') ||
              (step === 2 && isLoongMotor && linkData?.isPreQual)
            ) && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <Home className="w-5 h-5 mr-2 text-blue-600" />
                {isLoongMotor ? 'Estudio de Arraigo y Campo' : (linkData?.isPreQual ? 'Precalificación de Capacidad de Pago' : 'Estudio Socioeconómico')}
              </h3>
              <p className="text-sm text-slate-500">
                {isLoongMotor ? 'Completa la información de arraigo y sube las fotos de tu domicilio para el dictamen.' : (linkData?.isPreQual ? 'Ayúdanos a entender tu perfil financiero para tu nueva moto.' : 'Por favor, proporciona la siguiente información sobre tu domicilio e ingresos.')}
              </p>
              
              {linkData?.clientProfile === 'LOONG_MOTOR' && linkData?.isPreQual ? (
                renderLoongPreQualForm()
              ) : (
                <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ingreso Mensual (MXN)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-5 w-5 text-slate-400" />
                      </div>
                      <input 
                        type="number" 
                        required 
                        value={ingresoMensual} 
                        onChange={e => setIngresoMensual(e.target.value)} 
                        className="pl-10 w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                        placeholder="Ej. 15000" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gastos Mensuales (MXN)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-5 w-5 text-slate-400" />
                      </div>
                      <input 
                        type="number" 
                        required 
                        value={gastosMensuales} 
                        onChange={e => setGastosMensuales(e.target.value)} 
                        className="pl-10 w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                        placeholder="Ej. 10000" 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ocupación</label>
                    <input 
                      type="text" 
                      required 
                      value={ocupacion} 
                      onChange={e => setOcupacion(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. Empleado" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Estado Civil</label>
                    <select 
                      value={estadoCivil} 
                      onChange={e => setEstadoCivil(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                    >
                      <option value="Soltero(a)">Soltero(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viudo(a)">Viudo(a)</option>
                      <option value="Unión Libre">Unión Libre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dependientes</label>
                    <input 
                      type="number" 
                      required 
                      value={dependientesEconomicos} 
                      onChange={e => setDependientesEconomicos(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ej. 2" 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dirección Declarada</label>
                  <input 
                    type="text" 
                    required 
                    value={direccionDeclarada} 
                    onChange={e => setDireccionDeclarada(e.target.value)} 
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                    placeholder="Calle, Número, Colonia, Ciudad, Estado, CP" 
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Vivienda</label>
                    <select 
                      value={tipoVivienda} 
                      onChange={e => setTipoVivienda(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                    >
                      <option value="Propia">Propia</option>
                      <option value="Rentada">Rentada</option>
                      <option value="Familiar">Familiar</option>
                      <option value="Pagando">Pagando (Hipoteca)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Antigüedad (Años)</label>
                    <input 
                      type="number" 
                      required 
                      value={antiguedadVivienda} 
                      onChange={e => setAntiguedadVivienda(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
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
                    <div className="flex items-center p-2 bg-white rounded-lg border border-blue-100 text-[10px] text-blue-800 font-medium">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Estados de Cuenta
                    </div>
                    <div className="flex items-center p-2 bg-white rounded-lg border border-blue-100 text-[10px] text-blue-800 font-medium">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Facturas de Negocio
                    </div>
                    <div className="flex items-center p-2 bg-white rounded-lg border border-blue-100 text-[10px] text-blue-800 font-medium">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Fotos de Actividad
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      disabled={!isWithinRange}
                      onChange={(e) => setComprobanteIngresos(e.target.files ? e.target.files[0] : null)}
                      className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isWithinRange ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    />
                    <div className={`p-6 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                      !isWithinRange ? 'bg-slate-100 border-slate-200 opacity-60' :
                      comprobanteIngresos ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${!isWithinRange ? 'bg-slate-200 text-slate-400' : comprobanteIngresos ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                        {!isWithinRange ? <Lock className="w-6 h-6" /> : comprobanteIngresos ? <CheckCircle2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <div className="text-center">
                        <span className={`block text-sm font-bold ${!isWithinRange ? 'text-slate-400' : comprobanteIngresos ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {!isWithinRange ? 'Cámara Bloqueada (Valida GPS)' : comprobanteIngresos ? comprobanteIngresos.name : 'Seleccionar Comprobante'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {isWithinRange ? 'PDF o Imagen (Estados de cuenta, facturas, fotos de negocio)' : 'Debes estar en el domicilio declarado'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
            )}

            {/* Documents Section */}
            {((phase === '1' && step === 3 && linkData?.clientProfile === 'CREDIT') || 
              (linkData?.clientProfile === 'HR' && step === 2) || 
              (phase === '1' && step === 2 && linkData?.investigationScope === 'BASIC' && !isLoongMotor) ||
              (phase === '2' && step === 1)) && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <Upload className="w-5 h-5 mr-2 text-blue-600" />
                {linkData?.clientProfile === 'CREDIT' ? 'Documentación y Arraigo de Domicilio' : 'Documentos Oficiales'}
              </h3>
              <p className="text-sm text-slate-500">
                {linkData?.clientProfile === 'CREDIT' 
                  ? 'Sube fotos claras de tus documentos para validar tu identidad y arraigo.' 
                  : 'Sube fotos claras de tus documentos.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">INE/Pasaporte (Frente)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!isWithinRange}
                      onChange={(e) => setIdFront(e.target.files ? e.target.files[0] : null)}
                      className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isWithinRange ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    />
                    <div className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                      !isWithinRange ? 'bg-slate-100 border-slate-200 opacity-60' :
                      idFront ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!isWithinRange ? 'bg-slate-200 text-slate-400' : idFront ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                        {!isWithinRange ? <Lock className="w-5 h-5" /> : idFront ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-5 h-5" />}
                      </div>
                      <span className={`text-xs font-bold ${!isWithinRange ? 'text-slate-400' : idFront ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {!isWithinRange ? 'Bloqueado' : idFront ? idFront.name : 'Subir Frente'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">INE/Pasaporte (Reverso)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!isWithinRange}
                      onChange={(e) => setIdBack(e.target.files ? e.target.files[0] : null)}
                      className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isWithinRange ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    />
                    <div className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                      !isWithinRange ? 'bg-slate-100 border-slate-200 opacity-60' :
                      idBack ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!isWithinRange ? 'bg-slate-200 text-slate-400' : idBack ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                        {!isWithinRange ? <Lock className="w-5 h-5" /> : idBack ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-5 h-5" />}
                      </div>
                      <span className={`text-xs font-bold ${!isWithinRange ? 'text-slate-400' : idBack ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {!isWithinRange ? 'Bloqueado' : idBack ? idBack.name : 'Subir Reverso'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Comprobante de Domicilio (No mayor a 3 meses)</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    disabled={!isWithinRange}
                    onChange={(e) => setProofOfAddress(e.target.files ? e.target.files[0] : null)}
                    className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isWithinRange ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  />
                  <div className={`p-6 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                    !isWithinRange ? 'bg-slate-100 border-slate-200 opacity-60' :
                    proofOfAddress ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                  }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${!isWithinRange ? 'bg-slate-200 text-slate-400' : proofOfAddress ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                      {!isWithinRange ? <Lock className="w-6 h-6" /> : proofOfAddress ? <CheckCircle2 className="w-7 h-7" /> : <FileText className="w-6 h-6" />}
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-bold ${!isWithinRange ? 'text-slate-400' : proofOfAddress ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {!isWithinRange ? 'Cámara Bloqueada' : proofOfAddress ? proofOfAddress.name : 'Seleccionar Comprobante'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-semibold">
                        {isWithinRange ? 'PDF, JPG o PNG' : 'Valida tu ubicación GPS primero'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Selfie Section */}
            {((phase === '1' && step === 3 && linkData?.clientProfile === 'CREDIT') || (linkData?.clientProfile === 'HR' && step === 2) || (phase === '2' && step === 2)) && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center">
                    <Camera className="w-5 h-5 mr-2 text-blue-600" />
                    Prueba de Vida
                  </h3>
                  <p className="text-sm text-slate-500">
                    Tómate una selfie sosteniendo tu identificación oficial cerca de tu rostro.
                  </p>
                  <div className="group relative">
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      disabled={!isWithinRange}
                      onChange={(e) => setSelfie(e.target.files ? e.target.files[0] : null)}
                      className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isWithinRange ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    />
                    <div className={`p-6 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                      !isWithinRange ? 'bg-slate-100 border-slate-200 opacity-60' :
                      selfie ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${!isWithinRange ? 'bg-slate-200 text-slate-400' : selfie ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                        {!isWithinRange ? <Lock className="w-7 h-7" /> : selfie ? <CheckCircle2 className="w-7 h-7" /> : <Camera className="w-6 h-6" />}
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-bold ${!isWithinRange ? 'text-slate-400' : selfie ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {!isWithinRange ? 'Cámara Bloqueada' : selfie ? selfie.name : 'Capturar Selfie'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center">
                    <Home className="w-5 h-5 mr-2 text-blue-600" />
                    Foto de la Fachada
                  </h3>
                  <p className="text-sm text-slate-500">
                    Sube una foto clara de la fachada exterior de tu domicilio. <strong className="text-amber-600">IMPORTANTE: La foto debe tomarse con la puerta abierta</strong> para validar que es tu domicilio y coincidir con el comprobante.
                  </p>
                  <div className="group relative">
                    <input 
                      type="file" 
                      disabled={!isWithinRange}
                      className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isWithinRange ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      accept="image/*" 
                      onChange={(e) => setFotoFachada(e.target.files ? e.target.files[0] : null)}
                    />
                    <div className={`p-8 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                      !isWithinRange ? 'bg-slate-100 border-slate-200 opacity-60' :
                      fotoFachada ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${!isWithinRange ? 'bg-slate-200 text-slate-400' : fotoFachada ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                        {!isWithinRange ? <Lock className="w-8 h-8" /> : fotoFachada ? <CheckCircle2 className="w-8 h-8" /> : <Home className="w-7 h-7" />}
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-bold ${!isWithinRange ? 'text-slate-400' : fotoFachada ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {!isWithinRange ? 'Cámara Bloqueada' : fotoFachada ? fotoFachada.name : 'Subir Foto de Fachada'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-semibold">
                          {isWithinRange ? 'Puerta abierta obligatoria' : 'Debes estar en el domicilio'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              {linkData?.clientProfile !== 'HR' && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center">
                    <Home className="w-5 h-5 mr-2 text-blue-600" />
                    Fotografías del Interior (Estudio Socioeconómico)
                  </h3>
                  <p className="text-sm text-slate-500">
                    Para completar tu estudio socioeconómico, por favor sube una fotografía clara de las siguientes áreas de tu domicilio.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Sala */}
                    <div className="group relative">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">1. Sala</label>
                      <div className="relative">
                        <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="image/*" onChange={(e) => setFotoSala(e.target.files ? e.target.files[0] : null)} />
                        <div className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                          fotoSala ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                        }`}>
                          <Camera className={`w-6 h-6 ${fotoSala ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className={`text-xs font-bold ${fotoSala ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {fotoSala ? fotoSala.name : 'Subir Sala'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Comedor */}
                    <div className="group relative">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">2. Comedor</label>
                      <div className="relative">
                        <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="image/*" onChange={(e) => setFotoComedor(e.target.files ? e.target.files[0] : null)} />
                        <div className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                          fotoComedor ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                        }`}>
                          <Camera className={`w-6 h-6 ${fotoComedor ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className={`text-xs font-bold ${fotoComedor ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {fotoComedor ? fotoComedor.name : 'Subir Comedor'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cocina */}
                    <div className="group relative">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">3. Cocina</label>
                      <div className="relative">
                        <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="image/*" onChange={(e) => setFotoCocina(e.target.files ? e.target.files[0] : null)} />
                        <div className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                          fotoCocina ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                        }`}>
                          <Camera className={`w-6 h-6 ${fotoCocina ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className={`text-xs font-bold ${fotoCocina ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {fotoCocina ? fotoCocina.name : 'Subir Cocina'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Habitación */}
                    <div className="group relative">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">4. Habitación Principal</label>
                      <div className="relative">
                        <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="image/*" onChange={(e) => setFotoHabitacion(e.target.files ? e.target.files[0] : null)} />
                        <div className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                          fotoHabitacion ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                        }`}>
                          <Camera className={`w-6 h-6 ${fotoHabitacion ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className={`text-xs font-bold ${fotoHabitacion ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {fotoHabitacion ? fotoHabitacion.name : 'Subir Habitación'}
                          </span>
                        </div>
                      </div>
                    </div>
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
                <div className="flex justify-between border-t border-slate-100 pt-8">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-8 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                    >
                      Atrás
                    </button>
                  ) : (
                    <div></div>
                  )}
                  
                  {step < totalSteps ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-8 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-95"
                    >
                      {isLoongMotor && step === 1 ? 'Validar Ubicación y Continuar' : 'Siguiente'}
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
            
            <div className="mt-8 flex items-center justify-center text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">
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
