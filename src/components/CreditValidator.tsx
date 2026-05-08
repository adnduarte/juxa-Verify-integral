import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle, MapPin, CheckCircle2, UploadCloud, FileText, Map as MapIcon, ChevronRight, ChevronLeft, Building, Image as ImageIcon, PlayCircle, Download } from 'lucide-react';
import { analyzeCandidateData } from '../lib/gemini';
import { AIResultRenderer } from './AIResultRenderer';
import { IdentityAntiUsurpationPanel } from './IdentityAntiUsurpationPanel';
import { useJsApiLoader, Autocomplete, GoogleMap, StreetViewPanorama, Marker } from '@react-google-maps/api';

const MAX_ACCURACY_METERS = 50;
const libraries: ("places")[] = ["places"];

export function CreditValidator() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulationType, setSimulationType] = useState<'none' | 'positive' | 'negative'>('none');

  // Step 1: Expediente
  const [clientName, setClientName] = useState('');
  const [applicationId, setApplicationId] = useState(`FOLIO-${Math.floor(Math.random() * 100000)}`);
  const [locationType, setLocationType] = useState('Domicilio Particular');
  const [declaredAddress, setDeclaredAddress] = useState('');
  const [mapCenter, setMapCenter] = useState({ lat: 19.4326, lng: -99.1332 });
  const [mapMarker, setMapMarker] = useState<{lat: number, lng: number} | null>(null);

  // Step 2: Evidencia
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [facadePhoto, setFacadePhoto] = useState<File | null>(null);
  const [facadePreview, setFacadePreview] = useState<string | null>(null);
  const [videoDomicilio, setVideoDomicilio] = useState<File | null>(null);
  const [validateWorkAddress, setValidateWorkAddress] = useState(false);
  const [workAddress, setWorkAddress] = useState('');

  // Step 3: Auditoría (GPS)
  const [location, setLocation] = useState<{lat: number, lng: number, accuracy: number, timestamp: string} | null>(null);
  const [locating, setLocating] = useState(false);

  const autocompleteRef = useRef<any>(null);
  const workAutocompleteRef = useRef<any>(null);

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
    // 1x1 transparent PNG base64
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
      setClientName('María González Pérez');
      setDeclaredAddress('Av. Paseo de la Reforma 222, Juárez, Cuauhtémoc, 06600 Ciudad de México, CDMX');
      setLocationType('Oficinas Corporativas');
      setMapMarker({ lat: 19.428470, lng: -99.162260 });
      setMapCenter({ lat: 19.428470, lng: -99.162260 });
      
      setFacadePhoto(createValidDummyImage('Fachada_Corporativo.png'));
      setFacadePreview('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=1000');
      setIdDocument(new File([dummyPdfBlob], 'INE_Maria_Gonzalez.pdf', { type: 'application/pdf' }));
    } else {
      setClientName('Empresa Fantasma S.A. de C.V.');
      setDeclaredAddress('Callejón sin salida 123, Colonia Peligrosa');
      setLocationType('Local Comercial');
      setMapMarker({ lat: 19.4450, lng: -99.1200 });
      setMapCenter({ lat: 19.4450, lng: -99.1200 });
      
      setFacadePhoto(createValidDummyImage('Lote_Baldio.png'));
      setFacadePreview('https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&q=80&w=1000');
      setIdDocument(new File([dummyPdfBlob], 'Identificacion_Alterada.pdf', { type: 'application/pdf' }));
    }
    
    // Mock GPS location for simulation
    setLocation({
      lat: type === 'positive' ? 19.428470 : 19.4450,
      lng: type === 'positive' ? -99.162260 : -99.1200,
      accuracy: 10,
      timestamp: new Date().toISOString()
    });

    setStep(2); // Show Step 2 so the user sees the preloaded files
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
          perfil: 'Crédito',
          puesto: 'No especificado',
          clientName,
          applicationId,
          locationType,
          declaredAddress,
          workAddress: validateWorkAddress ? workAddress : null,
          realTimeLocation: `${location.lat},${location.lng}`
        },
        [facadePhoto, idDocument, streetViewBlob].filter(Boolean),
        '', // businessRules
        simulationType
      );
      setResult(res);
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Error al validar el activo');
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
    setClientName('');
    setApplicationId(`FOLIO-${Math.floor(Math.random() * 100000)}`);
    setLocationType('Domicilio Particular');
    setIdDocument(null);
    setValidateWorkAddress(false);
    setWorkAddress('');
    setMapMarker(null);
    setError(null);
    setSimulationType('none');
    setStep(1);
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
      {/* Header / Progress */}
      <div className="bg-neutral-900 border-b border-neutral-800 p-4 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-900/30 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">JUXA Validator</h2>
              <p className="text-xs text-neutral-400">Auditoría de Riesgo</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-blue-900/30 text-blue-500 border border-blue-500/30' : 'bg-neutral-800 text-neutral-500'}`}>
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
                <h3 className="text-2xl font-bold text-white">1. Datos del Expediente</h3>
                <p className="text-neutral-400 text-sm">Ingresa la información del solicitante y ubica el domicilio.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => loadSimulation('positive')} className="text-xs bg-green-900/20 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg hover:bg-green-900/40 transition-colors">
                  Simular Éxito
                </button>
                <button onClick={() => loadSimulation('negative')} className="text-xs bg-red-900/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-900/40 transition-colors">
                  Simular Fraude
                </button>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Nombre del Solicitante</label>
                  <input 
                    type="text" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Folio de Operación</label>
                  <input 
                    type="text" 
                    value={applicationId}
                    onChange={(e) => setApplicationId(e.target.value)}
                    className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl font-medium text-neutral-500 text-sm"
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Tipo de Inmueble</label>
                <select 
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value)}
                  className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-white text-sm appearance-none"
                >
                  <option value="Domicilio Particular">Domicilio Particular</option>
                  <option value="Local Comercial">Local Comercial</option>
                  <option value="Oficinas Corporativas">Oficinas Corporativas</option>
                  <option value="Bodega / Nave Industrial">Bodega / Nave Industrial</option>
                  <option value="Terreno">Terreno</option>
                </select>
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
                      className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-white text-sm"
                    />
                  </Autocomplete>
                ) : (
                  <input 
                    type="text" 
                    value={declaredAddress}
                    onChange={(e) => setDeclaredAddress(e.target.value)}
                    placeholder="Ej: Av. Reforma 222, CDMX"
                    className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-white text-sm"
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
                disabled={!clientName.trim() || !declaredAddress.trim()}
                className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                <p className="text-neutral-400 text-sm">Sube la identificación y la foto de la fachada.</p>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
              
              {/* ID Document */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Identificación Oficial o Comprobante (PDF/Imagen)
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
                    className={`flex items-center justify-center gap-3 w-full p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${idDocument ? 'border-green-500/50 bg-green-500/5' : 'border-neutral-700 hover:border-blue-500/50 hover:bg-blue-500/5'}`}
                  >
                    {idDocument ? (
                      <>
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                        <span className="text-green-400 font-medium">{idDocument.name}</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-6 h-6 text-neutral-400" />
                        <span className="text-neutral-400 font-medium">Clic para subir documento</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Facade Photo */}
              <div className="space-y-3 pt-4 border-t border-neutral-800">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Foto de la Fachada (Obligatorio)
                </label>
                <p className="text-xs text-neutral-400">
                  Sube una foto clara del exterior del inmueble. <strong className="text-amber-500">IMPORTANTE: La foto debe tomarse con la puerta abierta</strong> para validar que es tu domicilio y coincidir con el comprobante. No uses fotos de Google Maps.
                </p>
                
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
                      className="flex flex-col items-center justify-center gap-3 w-full p-8 border-2 border-dashed border-neutral-700 rounded-xl cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
                    >
                      <ImageIcon className="w-8 h-8 text-neutral-400" />
                      <span className="text-neutral-400 font-medium">Subir foto de la fachada</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Work Address */}
              <div className="pt-4 border-t border-neutral-800 space-y-4">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="workAddressToggle"
                    checked={validateWorkAddress}
                    onChange={(e) => setValidateWorkAddress(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-800 bg-black text-blue-600 focus:ring-blue-500 focus:ring-offset-neutral-900"
                  />
                  <label htmlFor="workAddressToggle" className="text-sm font-medium text-neutral-300 cursor-pointer">
                    Validar Domicilio Laboral (Opcional)
                  </label>
                </div>

                {validateWorkAddress && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Dirección Laboral Declarada</label>
                    {isLoaded ? (
                      <Autocomplete
                        onLoad={(autocomplete) => { workAutocompleteRef.current = autocomplete; }}
                        onPlaceChanged={() => {
                          if (workAutocompleteRef.current) {
                            const place = workAutocompleteRef.current.getPlace();
                            setWorkAddress(place.formatted_address || place.name || '');
                          }
                        }}
                      >
                        <input 
                          type="text" 
                          value={workAddress}
                          onChange={(e) => setWorkAddress(e.target.value)}
                          placeholder="Ej: Av. Insurgentes Sur 105, CDMX"
                          className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-white text-sm"
                        />
                      </Autocomplete>
                    ) : (
                      <input 
                        type="text" 
                        value={workAddress}
                        onChange={(e) => setWorkAddress(e.target.value)}
                        placeholder="Ej: Av. Insurgentes Sur 105, CDMX"
                        className="w-full px-4 py-3 bg-black border border-neutral-800 rounded-xl focus:bg-neutral-950 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-white text-sm"
                      />
                    )}
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
                    className="flex flex-col items-center justify-center gap-3 w-full p-8 border-2 border-dashed border-neutral-700 rounded-xl cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
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
                className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                <p className="text-neutral-400 text-sm">Confirma tu ubicación actual y genera el dictamen.</p>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
              
              <div className="bg-black/50 p-5 rounded-xl border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-500" /> GPS del Auditor (Req. &lt; {MAX_ACCURACY_METERS}m)
                  </span>
                  {locating ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  ) : location && location.accuracy <= MAX_ACCURACY_METERS ? (
                    <span className="text-sm font-mono text-green-400 flex items-center gap-1 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20"><CheckCircle2 className="w-4 h-4"/> Verificado</span>
                  ) : (
                    <button onClick={getLocation} className="text-sm text-blue-500 font-bold bg-blue-500/10 px-4 py-2 rounded-xl hover:bg-blue-500/20 transition-colors border border-blue-500/20">
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
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Analizando con IA...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-6 h-6" />
                    Generar Dictamen de Riesgo
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
                Dictamen Completado
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={handlePrint}
                  className="text-blue-400 text-sm font-bold bg-blue-900/30 px-4 py-2 rounded-xl border border-blue-500/20 hover:bg-blue-900/50 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </button>
                <button 
                  onClick={resetFlow}
                  className="text-blue-400 text-sm font-bold bg-blue-900/30 px-4 py-2 rounded-xl border border-blue-500/20 hover:bg-blue-900/50 transition-colors"
                >
                  Nueva Validación
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
            <IdentityAntiUsurpationPanel
              compact
              caseSummary={`Originación crédito. Cliente: ${clientName}. Folio: ${applicationId}. Extracto dictamen: ${result.slice(0, 4000)}`}
            />
          </div>
        )}

      </div>
    </div>
  );
}
