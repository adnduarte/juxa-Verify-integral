import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CheckCircle2, MapPin, Camera, Upload, ShieldCheck, AlertCircle, Home, DollarSign, Navigation, RefreshCw, FileText, Brain, Shield, Lock } from 'lucide-react';
import { useJsApiLoader, Autocomplete, GoogleMap, Marker } from '@react-google-maps/api';
import heic2any from 'heic2any';
import { JuxaVerifyLoader } from '../components/JuxaVerifyLoader';
import { toast } from 'react-hot-toast';

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
        
        setLinkData({ id: linkSnap.id, ...data });

        const currentIsHR = data.clientProfile === 'HR' || data.investigationType === 'HR';
        const currentIsCredit = data.clientProfile === 'CREDIT' || data.investigationType === 'CREDIT';

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

        console.log(`[CandidateFlow] Client Profile: ${data.clientProfile}, isHR: ${currentIsHR}, isCredit: ${currentIsCredit}`);
        
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
        } else if (currentIsHR) {
          // HR is always 2 steps (Location + Documents)
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

    // CRITICAL: Si no estamos en el último paso, solo avanzamos.
    // Esto evita que el botón "Siguiente" o presionar Enter dispare la validación final.
    if (step < totalSteps) {
      handleNextStep();
      return;
    }

    // A partir de aquí es la validación del ÚLTIMO PASO
    if (!isHR && !isCredit && phase === '1') {
      // Validate step 2 (Socioeconomic / Pre-calificación)
      if (!ingresoMensual || !gastosMensuales || !ocupacion || !direccionDeclarada || !antiguedadVivienda || (isCredit && !comprobanteIngresos)) {
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

    if (isCredit) {
      if (!ingresoMensual || !gastosMensuales || !ocupacion || !direccionDeclarada || !antiguedadVivienda || !comprobanteIngresos) {
        alert("Por favor, completa todos los campos de tu perfil socioeconómico y sube tu comprobante de ingresos antes de enviar.");
        return;
      }
    }

    const missingFiles = [];
    if (!idFront) missingFiles.push("INE Frente");
    if (!idBack) missingFiles.push("INE Reverso");
    if (!proofOfAddress) missingFiles.push("Comprobante de Domicilio");
    if (!selfie) missingFiles.push("Selfie");
    if (!fotoFachada) missingFiles.push("Foto de Fachada");
    
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
    setProgress(10);
    setProgressText('Preparando archivos y validando ubicación...');
    setError('');

    try {
      let phase1Data: any = {};
      if (!isHR && !isCredit) {
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
          ...(isCredit ? {
            ingresoMensual,
            gastosMensuales,
            ocupacion,
            estadoCivil,
            dependientesEconomicos,
            tipoVivienda,
            antiguedadVivienda,
            preQualQuestions // Added pre-qualification questions
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

      // 1. Función aislada para subir un archivo
      const uploadSingleFile = async (file: File, storagePath: string, label: string) => {
        try {
          const storageRef = ref(storage, storagePath);
          // Usamos uploadBytes normal, es el más estable
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          return downloadURL;
        } catch (error: any) {
          console.error(`Fallo crítico al subir ${label} (${file.name}):`, error);
          throw new Error(`Fallo al subir ${label}: ${error.message || 'Error desconocido'}`);
        }
      };

      // Definir el array de archivos a subir explícitamente
      const filesToUpload = [
        { id: 'idFrontUrl', file: compIdFront, label: 'INE Frente', percent: 10, path: `candidatos/${linkData.investigationId}/idFront` },
        { id: 'idBackUrl', file: compIdBack, label: 'INE Reverso', percent: 20, path: `candidatos/${linkData.investigationId}/idBack` },
        { id: 'selfieUrl', file: compSelfie, label: 'Prueba de Vida', percent: 30, path: `candidatos/${linkData.investigationId}/selfie` },
        { id: 'proofOfAddressUrl', file: compProof, label: 'Comprobante', percent: 40, path: `candidatos/${linkData.investigationId}/proofOfAddress` },
        { id: 'incomeProofUrl', file: compIncome, label: 'Comprobante Ingresos', percent: 45, path: `candidatos/${linkData.investigationId}/incomeProof` },
        { id: 'fotoFachadaUrl', file: compFotoFachada, label: 'Fachada', percent: 50, path: `candidatos/${linkData.investigationId}/fotoFachada` },
        { id: 'fotoSalaUrl', file: compFotoSala, label: 'Sala', percent: 60, path: `candidatos/${linkData.investigationId}/fotoSala` },
        { id: 'fotoComedorUrl', file: compFotoComedor, label: 'Comedor', percent: 70, path: `candidatos/${linkData.investigationId}/fotoComedor` },
        { id: 'fotoCocinaUrl', file: compFotoCocina, label: 'Cocina', percent: 80, path: `candidatos/${linkData.investigationId}/fotoCocina` },
        { id: 'fotoHabitacionUrl', file: compFotoHabitacion, label: 'Habitación', percent: 90, path: `candidatos/${linkData.investigationId}/fotoHabitacion` }
      ];

      const currentUrls: Record<string, string> = {};

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
        idFrontName: idFront?.name || null,
        idBackName: idBack?.name || null,
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
            scoringConfig
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
        } else if (linkData.clientProfile === 'CREDIT') {
          updateData.creditAnalysisResult = aiResult;
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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setRealTimeLocation({lat: position.coords.latitude, lng: position.coords.longitude});
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("No se pudo obtener la ubicación. Por favor, permítelo en tu navegador.");
        }
      );
    } else {
      alert("La geolocalización no es soportada por este navegador.");
    }
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
    const dictamen = finalResult ? (function() {
      try {
        return JSON.parse(finalResult);
      } catch (e) {
        return null;
      }
    })() : null;

    const dictamenFinal = dictamen?.dictamenFinal;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 max-w-xl w-full">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">
            ¡Información Recibida!
          </h2>
          
          {dictamenFinal && (
            <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Resultado del Análisis</h3>
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
                    <span className="absolute text-sm font-bold text-slate-900">{dictamen.score}</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Puntaje de Crédito</p>
                    <p className="text-sm text-slate-700">Basado en políticas de riesgo y evidencia.</p>
                  </div>
                </div>
              )}

              <p className="text-slate-700 text-sm leading-relaxed">
                {dictamenFinal.resumen}
              </p>
            </div>
          )}

          {!dictamenFinal && (
            <p className="text-lg text-slate-600 mb-8 leading-relaxed text-center">
              Hemos recibido tus documentos y ubicación correctamente. Tu proceso de validación ha comenzado y serás notificado por el equipo de JUXA una vez que el dictamen sea emitido.
            </p>
          )}

          <div className="flex flex-col gap-4">
            {/* 
              Lógica de Fase 2:
              1. Si es HR, normalmente es una sola fase.
              2. Si es CREDIT y el alcance es INTEGRAL y el resultado es VIABLE, permitimos continuar a Fase 2.
              3. Si es SIMPLE, termina aquí.
            */}
            {(!isHR && !isCredit && phase === '1') || (isCredit && linkData?.investigationScope === 'INTEGRAL' && dictamenFinal?.estado === 'VIABLE' && phase === '1') ? (
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
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
              >
                Cerrar y Finalizar
              </button>
            )}
            
            <p className="text-xs text-slate-400 mt-4 text-center">
              ID de Referencia: <span className="font-mono">{linkId}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Fijo y Corporativo */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 text-white flex items-center justify-center rounded-xl font-bold shadow-lg shadow-blue-200">
            JV
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">JUXA <span className="text-blue-600">VERIFY</span></span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span className="text-[10px] sm:text-xs font-semibold text-emerald-700 uppercase tracking-wider whitespace-nowrap">
            Verificación Encriptada de 256-bits
          </span>
        </div>
      </header>

      {/* Hero Section (Bienvenida) */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-12 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Proceso de Verificación Segura
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed mb-8">
            Por favor, completa los siguientes pasos. Este proceso es rápido, seguro y cumple con las normativas de privacidad más estrictas.
          </p>

          {isCredit && investigationData && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 text-left max-w-lg mx-auto animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900">Resumen de Solicitud de Crédito</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              (step === 1 && linkData?.investigationScope !== 'BASIC') ||
              (step === 2 && linkData?.investigationScope === 'BASIC')
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
                          placeholder="Busca tu dirección o mueve el pin en el mapa..."
                          className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                      </Autocomplete>
                    )}
                  </div>

                  <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-300 z-0 relative">
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
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500">
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
            {phase === '1' && step === 1 && linkData?.investigationScope === 'BASIC' && (
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
            {phase === '1' && step === 2 && linkData?.clientProfile !== 'HR' && linkData?.investigationScope !== 'BASIC' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <Home className="w-5 h-5 mr-2 text-blue-600" />
                Estudio Socioeconómico
              </h3>
              <p className="text-sm text-slate-500">
                Por favor, proporciona la siguiente información sobre tu domicilio e ingresos.
              </p>
              
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
                      onChange={(e) => setComprobanteIngresos(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-6 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                      comprobanteIngresos ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${comprobanteIngresos ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                        {comprobanteIngresos ? <CheckCircle2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <div className="text-center">
                        <span className={`block text-sm font-bold ${comprobanteIngresos ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {comprobanteIngresos ? comprobanteIngresos.name : 'Seleccionar Comprobante'}
                        </span>
                        <span className="text-xs text-slate-500">
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
            {((phase === '1' && step === 3 && linkData?.clientProfile === 'CREDIT') || 
              (linkData?.clientProfile === 'HR' && step === 2) || 
              (phase === '1' && step === 2 && linkData?.investigationScope === 'BASIC') ||
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
                      onChange={(e) => setIdFront(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                      idFront ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${idFront ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                        {idFront ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-5 h-5" />}
                      </div>
                      <span className={`text-xs font-bold ${idFront ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {idFront ? idFront.name : 'Subir Frente'}
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
                      onChange={(e) => setIdBack(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-4 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                      idBack ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${idBack ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                        {idBack ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-5 h-5" />}
                      </div>
                      <span className={`text-xs font-bold ${idBack ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {idBack ? idBack.name : 'Subir Reverso'}
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
                    onChange={(e) => setProofOfAddress(e.target.files ? e.target.files[0] : null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={`p-6 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                    proofOfAddress ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                  }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${proofOfAddress ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                      {proofOfAddress ? <CheckCircle2 className="w-7 h-7" /> : <FileText className="w-6 h-6" />}
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-bold ${proofOfAddress ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {proofOfAddress ? proofOfAddress.name : 'Seleccionar Comprobante'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-semibold">PDF, JPG o PNG</p>
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
                      onChange={(e) => setSelfie(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-6 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                      selfie ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selfie ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                        {selfie ? <CheckCircle2 className="w-7 h-7" /> : <Camera className="w-6 h-6" />}
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-bold ${selfie ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {selfie ? selfie.name : 'Capturar Selfie'}
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
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      accept="image/*" 
                      onChange={(e) => setFotoFachada(e.target.files ? e.target.files[0] : null)}
                    />
                    <div className={`p-8 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                      fotoFachada ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/30'
                    }`}>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${fotoFachada ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                        {fotoFachada ? <CheckCircle2 className="w-8 h-8" /> : <Home className="w-7 h-7" />}
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-bold ${fotoFachada ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {fotoFachada ? fotoFachada.name : 'Subir Foto de Fachada'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-semibold">Puerta abierta obligatoria</p>
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
