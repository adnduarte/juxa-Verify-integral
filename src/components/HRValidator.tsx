import React, { useState, useRef } from 'react';
import { ShieldCheck, Loader2, AlertCircle, MapPin, CheckCircle2, FileText, Map as MapIcon, ChevronRight, ChevronLeft, Image as ImageIcon, Briefcase, Download, PlayCircle } from 'lucide-react';
import { analyzeCandidateData } from '../lib/gemini';
import { AIResultRenderer } from './AIResultRenderer';
import { useJsApiLoader, Autocomplete, GoogleMap, StreetViewPanorama, Marker } from '@react-google-maps/api';

const MAX_ACCURACY_METERS = 50;
const libraries: ("places")[] = ["places"];

export function HRValidator() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulationType, setSimulationType] = useState<'none' | 'positive' | 'negative'>('none');

  // Step 1: Expediente
  const [candidateName, setCandidateName] = useState('');
  const [vacancy, setVacancy] = useState('');
  const [nivelJerarquico, setNivelJerarquico] = useState('');
  const [rangoSalarial, setRangoSalarial] = useState('');
  const [tipoContrato, setTipoContrato] = useState('');
  const [declaredAddress, setDeclaredAddress] = useState('');
  const [mapCenter, setMapCenter] = useState({ lat: 19.4326, lng: -99.1332 });
  const [mapMarker, setMapMarker] = useState<{lat: number, lng: number} | null>(null);

  // Step 2: Evidencia
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [proofOfAddress, setProofOfAddress] = useState<File | null>(null);
  const [birthCertificate, setBirthCertificate] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [facadePhoto, setFacadePhoto] = useState<File | null>(null);
  const [facadePreview, setFacadePreview] = useState<string | null>(null);
  const [videoDomicilio, setVideoDomicilio] = useState<File | null>(null);

  // Step 3: Auditoría (GPS)
  const [location, setLocation] = useState<{lat: number, lng: number, accuracy: number, timestamp: string} | null>(null);
  const [locating, setLocating] = useState(false);

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
    setMapMarker({ lat, lng });
    setMapCenter({ lat, lng });
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        setDeclaredAddress(results[0].formatted_address);
      }
    });
  };

  const getLocation = () => {
    setLocating(true);
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada por el navegador.');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: new Date(pos.timestamp).toISOString()
        });
        setLocating(false);
      },
      (err) => {
        setError(`Error de GPS: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const createValidDummyImage = (filename: string) => {
    const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const byteCharacters = atob(b64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {type: 'image/png'});
    return new File([blob], filename, { type: 'image/png' });
  };

  const loadSimulation = (type: 'positive' | 'negative') => {
    setSimulationType(type);
    
    const dummyPdfBlob = new Blob(['dummy pdf content'], { type: 'application/pdf' });

    if (type === 'positive') {
      setCandidateName('Carlos Ruiz');
      setVacancy('Gerente de Operaciones');
      setNivelJerarquico('Gerencial');
      setRangoSalarial('$40,000 - $50,000 MXN');
      setTipoContrato('Indefinido');
      setDeclaredAddress('Calle de la Paz 45, Col. Centro, 06000 CDMX');
      setMapMarker({ lat: 19.4326, lng: -99.1332 });
      setMapCenter({ lat: 19.4326, lng: -99.1332 });
      
      setFacadePhoto(createValidDummyImage('Casa_Carlos.png'));
      setFacadePreview('https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1000');
      setIdDocument(new File([dummyPdfBlob], 'INE_Carlos_Ruiz.pdf', { type: 'application/pdf' }));
      setProofOfAddress(new File([dummyPdfBlob], 'CFE_Carlos_Ruiz.pdf', { type: 'application/pdf' }));
      setBirthCertificate(new File([dummyPdfBlob], 'Acta_Carlos_Ruiz.pdf', { type: 'application/pdf' }));
      setSelfie(createValidDummyImage('Selfie_Carlos.png'));
    } else {
      setCandidateName('Ana López');
      setVacancy('Cajera');
      setNivelJerarquico('Operativo');
      setRangoSalarial('$8,000 - $10,000 MXN');
      setTipoContrato('Temporal');
      setDeclaredAddress('Av. Falsa 123, Colonia Inexistente');
      setMapMarker({ lat: 19.4450, lng: -99.1200 });
      setMapCenter({ lat: 19.4450, lng: -99.1200 });
      
      setFacadePhoto(createValidDummyImage('Lote_Vacio.png'));
      setFacadePreview('https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&q=80&w=1000');
      setIdDocument(new File([dummyPdfBlob], 'Comprobante_Falso.pdf', { type: 'application/pdf' }));
      setProofOfAddress(new File([dummyPdfBlob], 'Agua_Falso.pdf', { type: 'application/pdf' }));
      setBirthCertificate(new File([dummyPdfBlob], 'Acta_Falsa.pdf', { type: 'application/pdf' }));
      setSelfie(createValidDummyImage('Selfie_Ana.png'));
    }
    
    setLocation({
      lat: type === 'positive' ? 19.4326 : 19.4450,
      lng: type === 'positive' ? -99.1332 : -99.1200,
      accuracy: 10,
      timestamp: new Date().toISOString()
    });

    setStep(2);
  };

  const handleAnalyze = async () => {
    if (!facadePhoto || !location || !declaredAddress) return;
    
    setLoading(true);
    setError(null);
    try {
      let streetViewBlob: Blob | null = null;
      if ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY) {
        try {
          const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${location.lat},${location.lng}&key=${(import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY}`;
          const svRes = await fetch(svUrl);
          if (svRes.ok) {
            streetViewBlob = await svRes.blob();
          }
        } catch (e) {
          console.error("Failed to fetch street view image for AI", e);
        }
      }

      const res = await analyzeCandidateData(
        {
          perfil: 'Recursos Humanos',
          puesto: vacancy,
          candidateName,
          nivelJerarquico,
          rangoSalarial,
          tipoContrato,
          declaredAddress,
          realTimeLocation: `${location.lat},${location.lng}`
        },
        [facadePhoto, idDocument, proofOfAddress, selfie, streetViewBlob].filter(Boolean),
        '', // businessRules
        simulationType
      );
      setResult(res);
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Error al validar el estudio socioeconómico');
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setResult(null);
    setFacadePhoto(null);
    setFacadePreview(null);
    setLocation(null);
    setDeclaredAddress('');
    setCandidateName('');
    setVacancy('');
    setNivelJerarquico('');
    setRangoSalarial('');
    setTipoContrato('');
    setIdDocument(null);
    setProofOfAddress(null);
    setBirthCertificate(null);
    setSelfie(null);
    setMapMarker(null);
    setError(null);
    setSimulationType('none');
    setStep(1);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFacadePhoto(file);
      setFacadePreview(URL.createObjectURL(file));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-neutral-950 flex flex-col font-sans text-neutral-200">
      <div className="bg-neutral-900 border-b border-neutral-800 p-4 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-900/30 text-purple-500 rounded-xl flex items-center justify-center border border-purple-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Estudio Socioeconómico</h2>
              <p className="text-xs text-neutral-400">Validación RRHH</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === s ? 'bg-purple-600 text-white' : step > s ? 'bg-purple-900/30 text-purple-500 border border-purple-500/30' : 'bg-neutral-800 text-neutral-500'}`}>
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-24">
        
        {/* STEP 1: Expediente */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-2xl font-bold text-white">1. Datos del Candidato</h3>
                <p className="text-neutral-400 text-sm">Ingresa la información del candidato y ubica el domicilio.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => loadSimulation('positive')} className="text-xs bg-green-900/20 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg hover:bg-green-900/40 transition-colors">
                  Simular Apto
                </button>
                <button onClick={() => loadSimulation('negative')} className="text-xs bg-red-900/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-900/40 transition-colors">
                  Simular Inconsistencia
                </button>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Nombre del Candidato</label>
                  <input 
                    type="text" 
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Ej: Ana López"
                    className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Vacante Solicitada</label>
                  <input 
                    type="text" 
                    value={vacancy}
                    onChange={(e) => setVacancy(e.target.value)}
                    placeholder="Ej: Gerente de Ventas"
                    className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Nivel Jerárquico</label>
                  <select 
                    value={nivelJerarquico}
                    onChange={(e) => setNivelJerarquico(e.target.value)}
                    className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium text-white text-sm appearance-none"
                  >
                    <option value="">Selecciona nivel...</option>
                    <option value="Operativo">Operativo</option>
                    <option value="Técnico">Técnico</option>
                    <option value="Gerencial">Gerencial</option>
                    <option value="Directivo">Directivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Rango Salarial Ofrecido</label>
                  <input 
                    type="text" 
                    value={rangoSalarial}
                    onChange={(e) => setRangoSalarial(e.target.value)}
                    placeholder="Ej: $15,000 - $20,000 MXN"
                    className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Tipo de Contrato</label>
                  <select 
                    value={tipoContrato}
                    onChange={(e) => setTipoContrato(e.target.value)}
                    className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium text-white text-sm appearance-none"
                  >
                    <option value="">Selecciona tipo...</option>
                    <option value="Indefinido">Indefinido</option>
                    <option value="Temporal">Temporal</option>
                    <option value="Prestación de servicios">Prestación de servicios</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Dirección Declarada</label>
                {isLoaded ? (
                  <Autocomplete
                    onLoad={(autocomplete) => { autocompleteRef.current = autocomplete; }}
                    onPlaceChanged={() => {
                      if (autocompleteRef.current) {
                        const place = autocompleteRef.current.getPlace();
                        setDeclaredAddress(place.formatted_address || place.name || '');
                        if (place.geometry?.location) {
                          const lat = place.geometry.location.lat();
                          const lng = place.geometry.location.lng();
                          setMapCenter({ lat, lng });
                          setMapMarker({ lat, lng });
                        }
                      }
                    }}
                  >
                    <input 
                      type="text" 
                      value={declaredAddress}
                      onChange={(e) => setDeclaredAddress(e.target.value)}
                      placeholder="Busca la dirección..."
                      className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium text-white text-sm"
                    />
                  </Autocomplete>
                ) : (
                  <input 
                    type="text" 
                    value={declaredAddress}
                    onChange={(e) => setDeclaredAddress(e.target.value)}
                    placeholder="Ej: Av. Reforma 222, CDMX"
                    className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium text-white text-sm"
                  />
                )}
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <MapIcon className="w-4 h-4" /> 
                  Ajuste Fino en Mapa (Opcional)
                </label>
                <p className="text-xs text-neutral-400 mb-3">Si la dirección no aparece exacta, haz clic en el mapa para fijar el punto.</p>
                <div className="w-full h-64 rounded-xl overflow-hidden border border-neutral-800">
                  {isLoaded ? (
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={mapCenter}
                      zoom={15}
                      onClick={handleMapClick}
                      options={{ 
                        disableDefaultUI: true, 
                        zoomControl: true,
                        styles: [
                          { "featureType": "all", "elementType": "geometry.fill", "stylers": [{"weight": "2.00"}] },
                          { "featureType": "all", "elementType": "geometry.stroke", "stylers": [{"color": "#9c9c9c"}] },
                          { "featureType": "all", "elementType": "labels.text", "stylers": [{"visibility": "on"}] },
                          { "featureType": "landscape", "elementType": "all", "stylers": [{"color": "#f2f2f2"}] },
                          { "featureType": "landscape", "elementType": "geometry.fill", "stylers": [{"color": "#ffffff"}] },
                          { "featureType": "landscape.man_made", "elementType": "geometry.fill", "stylers": [{"color": "#ffffff"}] },
                          { "featureType": "poi", "elementType": "all", "stylers": [{"visibility": "off"}] },
                          { "featureType": "road", "elementType": "all", "stylers": [{"saturation": -100},{"lightness": 45}] },
                          { "featureType": "road", "elementType": "geometry.fill", "stylers": [{"color": "#eeeeee"}] },
                          { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{"color": "#7b7b7b"}] },
                          { "featureType": "road", "elementType": "labels.text.stroke", "stylers": [{"color": "#ffffff"}] },
                          { "featureType": "road.highway", "elementType": "all", "stylers": [{"visibility": "simplified"}] },
                          { "featureType": "road.arterial", "elementType": "labels.icon", "stylers": [{"visibility": "off"}] },
                          { "featureType": "transit", "elementType": "all", "stylers": [{"visibility": "off"}] },
                          { "featureType": "water", "elementType": "all", "stylers": [{"color": "#46bcec"},{"visibility": "on"}] },
                          { "featureType": "water", "elementType": "geometry.fill", "stylers": [{"color": "#c8d7d4"}] },
                          { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{"color": "#070707"}] },
                          { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{"color": "#ffffff"}] }
                        ]
                      }}
                    >
                      {mapMarker && <Marker position={mapMarker} />}
                    </GoogleMap>
                  ) : (
                    <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-neutral-500">Cargando mapa...</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={() => setStep(2)}
                disabled={!candidateName.trim() || !declaredAddress.trim() || !vacancy.trim()}
                className="bg-purple-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Siguiente Paso <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Evidencia */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(1)} className="p-2 bg-neutral-900 rounded-full hover:bg-neutral-800 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-2xl font-bold text-white">2. Evidencia Documental y Visual</h3>
                <p className="text-neutral-400 text-sm">Sube la identificación y la foto de la fachada del domicilio.</p>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
              
              {/* ID Document */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    INE/Identificación (Frente)
                  </label>
                  <div className="relative">
                    <input 
                      type="file" 
                      id="id-upload"
                      accept="image/*,.pdf"
                      onChange={(e) => setIdDocument(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label 
                      htmlFor="id-upload"
                      className={`flex items-center justify-center gap-3 w-full p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${idDocument ? 'border-green-500/50 bg-green-500/5' : 'border-neutral-700 hover:border-purple-500/50 hover:bg-purple-500/5'}`}
                    >
                      {idDocument ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="text-green-400 font-medium text-sm truncate">{idDocument.name}</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-5 h-5 text-neutral-400" />
                          <span className="text-neutral-400 font-medium text-sm">Subir INE</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Comprobante de Domicilio
                  </label>
                  <div className="relative">
                    <input 
                      type="file" 
                      id="proof-upload"
                      accept="image/*,.pdf"
                      onChange={(e) => setProofOfAddress(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label 
                      htmlFor="proof-upload"
                      className={`flex items-center justify-center gap-3 w-full p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${proofOfAddress ? 'border-green-500/50 bg-green-500/5' : 'border-neutral-700 hover:border-purple-500/50 hover:bg-purple-500/5'}`}
                    >
                      {proofOfAddress ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="text-green-400 font-medium text-sm truncate">{proofOfAddress.name}</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-5 h-5 text-neutral-400" />
                          <span className="text-neutral-400 font-medium text-sm">Subir Comprobante</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Acta de Nacimiento
                  </label>
                  <div className="relative">
                    <input 
                      type="file" 
                      id="birth-upload"
                      accept="image/*,.pdf"
                      onChange={(e) => setBirthCertificate(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label 
                      htmlFor="birth-upload"
                      className={`flex items-center justify-center gap-3 w-full p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${birthCertificate ? 'border-green-500/50 bg-green-500/5' : 'border-neutral-700 hover:border-purple-500/50 hover:bg-purple-500/5'}`}
                    >
                      {birthCertificate ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="text-green-400 font-medium text-sm truncate">{birthCertificate.name}</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-5 h-5 text-neutral-400" />
                          <span className="text-neutral-400 font-medium text-sm">Subir Acta</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Selfie (Face Matching)
                  </label>
                  <div className="relative">
                    <input 
                      type="file" 
                      id="selfie-upload"
                      accept="image/*"
                      onChange={(e) => setSelfie(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label 
                      htmlFor="selfie-upload"
                      className={`flex items-center justify-center gap-3 w-full p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${selfie ? 'border-green-500/50 bg-green-500/5' : 'border-neutral-700 hover:border-purple-500/50 hover:bg-purple-500/5'}`}
                    >
                      {selfie ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="text-green-400 font-medium text-sm truncate">{selfie.name}</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-5 h-5 text-neutral-400" />
                          <span className="text-neutral-400 font-medium text-sm">Subir Selfie</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Facade Photo */}
              <div className="space-y-3 pt-4 border-t border-neutral-800">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Foto de la Fachada (Obligatorio)
                </label>
                <p className="text-xs text-neutral-400">Sube una foto clara del exterior de la vivienda del candidato.</p>
                
                {facadePreview ? (
                  <div className="relative w-full h-48 rounded-xl overflow-hidden border border-neutral-700 group">
                    <img src={facadePreview} alt="Fachada" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={() => { setFacadePhoto(null); setFacadePreview(null); }} className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium text-sm">
                        Eliminar Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <input 
                      type="file" 
                      id="facade-upload"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <label 
                      htmlFor="facade-upload"
                      className="flex flex-col items-center justify-center gap-3 w-full p-8 border-2 border-dashed border-neutral-700 rounded-xl cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
                    >
                      <ImageIcon className="w-8 h-8 text-neutral-400" />
                      <span className="text-neutral-400 font-medium">Subir foto de la fachada</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Video Domicilio */}
              <div className="space-y-3 pt-4 border-t border-neutral-800">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Video del Domicilio (Obligatorio)
                </label>
                <p className="text-xs text-neutral-400">Sube el video del candidato mostrando fachada, selfie y propiedad.</p>
                
                <div className="relative">
                  <input 
                    type="file" 
                    id="video-upload"
                    accept="video/*"
                    onChange={(e) => setVideoDomicilio(e.target.files ? e.target.files[0] : null)}
                    className="hidden"
                  />
                  <label 
                    htmlFor="video-upload"
                    className="flex flex-col items-center justify-center gap-3 w-full p-8 border-2 border-dashed border-neutral-700 rounded-xl cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
                  >
                    <PlayCircle className="w-8 h-8 text-neutral-400" />
                    <span className="text-neutral-400 font-medium">
                      {videoDomicilio ? videoDomicilio.name : 'Subir video del domicilio'}
                    </span>
                  </label>
                </div>
              </div>

            </div>

            <div className="flex justify-end">
              <button 
                onClick={() => setStep(3)}
                disabled={!facadePhoto || !videoDomicilio}
                className="bg-purple-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Siguiente Paso <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Análisis y GPS */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(2)} className="p-2 bg-neutral-900 rounded-full hover:bg-neutral-800 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-2xl font-bold text-white">3. Auditoría y GPS</h3>
                <p className="text-neutral-400 text-sm">Confirma tu ubicación actual y genera el dictamen socioeconómico.</p>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
              
              <div className="bg-black/50 p-5 rounded-xl border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-500" /> GPS del Auditor (Req. &lt; {MAX_ACCURACY_METERS}m)
                  </span>
                  {locating ? (
                    <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                  ) : location && location.accuracy <= MAX_ACCURACY_METERS ? (
                    <span className="text-sm font-mono text-green-400 flex items-center gap-1 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20"><CheckCircle2 className="w-4 h-4"/> Verificado</span>
                  ) : (
                    <button onClick={getLocation} className="text-sm text-purple-500 font-bold bg-purple-500/10 px-4 py-2 rounded-xl hover:bg-purple-500/20 transition-colors border border-purple-500/20">
                      {location ? 'Reintentar GPS' : 'Obtener GPS Actual'}
                    </button>
                  )}
                </div>
                
                {location && (
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                    <div>
                      <div className="text-neutral-500 mb-1">LATITUD</div>
                      <div className="text-white text-sm">{location.lat.toFixed(6)}</div>
                    </div>
                    <div>
                      <div className="text-neutral-500 mb-1">LONGITUD</div>
                      <div className="text-white text-sm">{location.lng.toFixed(6)}</div>
                    </div>
                    <div className="col-span-2 mt-2 pt-3 border-t border-neutral-800 flex justify-between items-center">
                      <div>
                        <div className="text-neutral-500 mb-1">PRECISIÓN</div>
                        <div className={`font-bold text-sm ${location.accuracy <= MAX_ACCURACY_METERS ? 'text-green-400' : 'text-red-400'}`}>
                          ±{Math.round(location.accuracy)} metros
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-900/20 border border-red-500/30 text-red-400 rounded-xl flex items-start gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <button 
                onClick={handleAnalyze}
                disabled={!location || location.accuracy > MAX_ACCURACY_METERS || loading}
                className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-purple-700 transition-colors shadow-[0_0_20px_rgba(147,51,234,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Analizando con IA...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    Generar Estudio Socioeconómico
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Dictamen */}
        {step === 4 && result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                Estudio Completado
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={handlePrint}
                  className="text-purple-400 text-sm font-bold bg-purple-900/30 px-4 py-2 rounded-xl border border-purple-500/20 hover:bg-purple-900/50 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </button>
                <button 
                  onClick={resetFlow}
                  className="text-purple-400 text-sm font-bold bg-purple-900/30 px-4 py-2 rounded-xl border border-purple-500/20 hover:bg-purple-900/50 transition-colors"
                >
                  Nuevo Estudio
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Foto de Fachada</h4>
                <div className="w-full h-48 rounded-xl overflow-hidden border border-neutral-800">
                  <img src={facadePreview!} alt="Fachada" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Street View (GPS)</h4>
                <div className="w-full h-48 rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900">
                  {isLoaded && location ? (
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={{ lat: location.lat, lng: location.lng }}
                      zoom={14}
                    >
                      <StreetViewPanorama
                        options={{
                          position: { lat: location.lat, lng: location.lng },
                          visible: true,
                          disableDefaultUI: true,
                          enableCloseButton: false,
                          showRoadLabels: false,
                        }}
                      />
                    </GoogleMap>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-500 text-sm">
                      Street View no disponible
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 p-6 sm:p-8 rounded-2xl border border-neutral-800 shadow-xl">
              <AIResultRenderer resultString={result} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
