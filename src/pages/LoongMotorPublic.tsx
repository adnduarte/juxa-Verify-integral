import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, query, where, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { Calculator, Send, Copy, Check, Bike, Clock, Eye, RefreshCw, X, Download, FileText, AlertCircle, Globe, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AIResultRenderer } from '../components/AIResultRenderer';
import { analyzeCandidateData } from '../lib/gemini';
import { getDoc } from 'firebase/firestore';

export function LoongMotorPublic() {
  const [directTitle, setDirectTitle] = useState('');
  const [directMonto, setDirectMonto] = useState('');
  const [directEnganche, setDirectEnganche] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedInv, setSelectedInv] = useState<any>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  
  const isDevUrl = window.location.origin.includes('ais-dev-');

  useEffect(() => {
    // Check if we are in an iframe
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }

    const q = query(
      collection(db, 'investigations'),
      where('clientId', '==', 'admin_direct'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(docs);
      setLoadingHistory(false);
    }, (error) => {
      console.error("Error fetching public history:", error);
      setLoadingHistory(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGenerateDirectLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTitle || !directMonto || !directEnganche) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setIsGenerating(true);
    try {
      const invId = `inv_${Date.now()}`;
      const linkId = `link_${Math.random().toString(36).substring(2, 15)}`;
      
      const investigationData = {
        id: invId,
        clientId: 'admin_direct',
        requestedBy: 'admin_public',
        status: 'PENDING',
        title: directTitle,
        clientProfile: 'LOONG_MOTOR',
        investigationType: 'LOONG_MOTOR',
        investigationScope: 'SIMPLE',
        loongMontoTotal: directMonto,
        loongEnganche: directEnganche,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByAdmin: true,
        tipoCredito: 'Motocicletas',
        isTestMode: isTestMode,
        candidateLink: linkId // Store the linkId for easy access
      };

      await setDoc(doc(db, 'investigations', invId), investigationData);

      await setDoc(doc(db, 'candidate_links', linkId), {
        linkId,
        investigationId: invId,
        clientId: 'admin_direct',
        clientProfile: 'LOONG_MOTOR',
        investigationType: 'LOONG_MOTOR',
        investigationScope: 'SIMPLE',
        loongMontoTotal: directMonto,
        loongEnganche: directEnganche,
        title: directTitle,
        status: 'PENDING',
        isTestMode: isTestMode,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const url = `${window.location.origin}/candidate/${linkId}`;
      setGeneratedUrl(url);
      toast.success("¡Enlace de Motocicleta generado con éxito!");
      
      setDirectTitle('');
      setDirectMonto('');
      setDirectEnganche('');
    } catch (error) {
      console.error("Error generating direct link:", error);
      toast.error("Error al generar el enlace.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
  };

  const handleReopen = async (inv: any) => {
    if (!window.confirm('¿Estás seguro de que deseas re-abrir este enlace?')) return;
    try {
      await updateDoc(doc(db, 'investigations', inv.id), {
        status: 'OPENED',
        linkStatus: 'OPENED',
        updatedAt: new Date().toISOString()
      });
      if (inv.candidateLink) {
        await updateDoc(doc(db, 'candidate_links', inv.candidateLink), {
          status: 'OPENED',
          updatedAt: new Date().toISOString()
        });
      }
      toast.success('Enlace re-abierto con éxito');
    } catch (error) {
      console.error("Error re-opening link:", error);
      toast.error("Error al re-abrir enlace.");
    }
  };

  const handleRestartAI = async (inv: any) => {
    if (!inv.candidateData) {
      toast.error('No hay datos del candidato para analizar.');
      return;
    }
    
    setIsRestarting(true);
    try {
      const candidateData = JSON.parse(inv.candidateData);
      const urls = inv.uploadedFileUrls || {};
      
      const imageParts = [
        urls.fotoFachadaUrl || candidateData.fotoFachadaUrl,
        urls.videoFachadaUrl || candidateData.videoFachadaUrl,
        urls.fotoSalaUrl || candidateData.fotoSalaUrl,
        urls.fotoComedorUrl || candidateData.fotoComedorUrl,
        urls.fotoCocinaUrl || candidateData.fotoCocinaUrl,
        urls.fotoHabitacionUrl || candidateData.fotoHabitacionUrl,
        urls.idFrontUrl || candidateData.idFrontUrl,
        urls.idBackUrl || candidateData.idBackUrl,
        urls.proofOfAddressUrl || candidateData.proofOfAddressUrl,
        urls.selfieUrl || candidateData.selfieUrl
      ].filter(Boolean);

      // Fetch client rules if possible
      let businessRules = '';
      let scoringConfig = null;
      if (inv.clientId) {
        const clientDoc = await getDoc(doc(db, 'clients', inv.clientId));
        if (clientDoc.exists()) {
          const clientData = clientDoc.data();
          businessRules = clientData.politicasGenerales || '';
          scoringConfig = clientData.scoringConfig || null;
        }
      }

      const aiResult = await analyzeCandidateData(
        {
          perfil: inv.clientProfile || 'LOONG_MOTOR',
          puesto: inv.jobProfile?.vacancy || 'No especificado',
          montoCreditoCapital: inv.montoCreditoCapital,
          montoCreditoIntereses: inv.montoCreditoIntereses,
          plazoFinanciamiento: inv.plazoFinanciamiento,
          tipoCredito: inv.tipoCredito,
          loongMontoTotal: inv.loongMontoTotal,
          loongEnganche: inv.loongEnganche,
          ...candidateData
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
          distanciaMetros: inv.distanceMeters || candidateData.distanceMeters || 0,
          verificado: (inv.distanceMeters || candidateData.distanceMeters || 0) < 150
        }
      };

      const updateData = {
        socioeconomicDictamen: JSON.stringify(dictamen),
        result: aiResult.includes('"estado":"VIABLE"') ? 'VIABLE' : (aiResult.includes('"estado":"REVIEW"') ? 'REVIEW' : 'NO_VIABLE'),
        status: 'COMPLETED',
        score: dictamen?.score || 0,
        scoreBreakdown: dictamen?.scoreBreakdown ? JSON.stringify(dictamen.scoreBreakdown) : null,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'investigations', inv.id), updateData);
      
      // Update selectedInv to reflect changes in modal
      setSelectedInv({ ...inv, ...updateData });
      toast.success('Análisis reiniciado con éxito');
    } catch (error: any) {
      console.error("Error restarting AI:", error);
      toast.error(`Error al reiniciar análisis: ${error.message}`);
    } finally {
      setIsRestarting(false);
    }
  };

  const getFullUrl = (linkId: string) => {
    return `${window.location.origin}/candidate/${linkId}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      {/* Dev URL Warning - CRITICAL */}
      {isDevUrl && (
        <div className="max-w-6xl mx-auto mb-8 bg-red-50 border-2 border-red-200 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-red-900 mb-2 uppercase tracking-tight">⚠️ ¡ATENCIÓN! ESTÁS EN MODO DESARROLLO</h3>
              <p className="text-red-800 font-medium mb-4 leading-relaxed">
                Los enlaces generados en esta página (ais-dev-...) <b>NO FUNCIONARÁN</b> para tus clientes. Les pedirá una contraseña o dará error de cookies.
              </p>
              <div className="bg-white/50 p-4 rounded-xl border border-red-100">
                <p className="text-sm font-bold text-red-900 mb-2">Para que funcione correctamente:</p>
                <ol className="text-sm text-red-800 space-y-2 list-decimal ml-4 font-medium">
                  <li>Haz clic en el botón azul <b>"COMPARTIR" (Share)</b> que está arriba a la derecha en AI Studio.</li>
                  <li>Copia el enlace que empieza con <b>ais-pre-...</b></li>
                  <li>Abre ese enlace en una pestaña nueva y genera los enlaces desde ahí.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Iframe Cookie Warning Banner - Enhanced */}
      {isInIframe && !isDevUrl && (
        <div className="max-w-6xl mx-auto mb-6 bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-base font-bold text-amber-900">¿Ves el error "Action required" o "Security Cookie"?</p>
              <p className="text-sm text-amber-700">Tu navegador está bloqueando las cookies de seguridad. Haz clic a la derecha para solucionarlo.</p>
            </div>
          </div>
          <a 
            href={window.location.href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full md:w-auto px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-105 shadow-lg whitespace-nowrap"
          >
            SOLUCIONAR ERROR DE NAVEGADOR
          </a>
        </div>
      )}

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Generator Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden sticky top-8">
            <div className="bg-red-600 p-6 text-white text-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bike className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-xl font-bold">LOONG MOTOR</h1>
              <p className="text-red-100 text-sm">Generador de Solicitud</p>
            </div>

            <div className="p-6 space-y-6">
              <form onSubmit={handleGenerateDirectLink} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del Sujeto</label>
                  <input
                    type="text"
                    value={directTitle}
                    onChange={(e) => setDirectTitle(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto ($)</label>
                    <input
                      type="number"
                      value={directMonto}
                      onChange={(e) => setDirectMonto(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Enganche (%)</label>
                    <input
                      type="number"
                      value={directEnganche}
                      onChange={(e) => setDirectEnganche(e.target.value)}
                      placeholder="Ej. 30"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Test Mode Toggle */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-amber-900 uppercase tracking-tight">Modo de Prueba</p>
                    <p className="text-[9px] text-amber-700 leading-tight">Permite abrir cámara aunque esté lejos del domicilio.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsTestMode(!isTestMode)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${isTestMode ? 'bg-amber-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isTestMode ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-red-200"
                >
                  {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Generar Enlace
                </button>
              </form>

              {generatedUrl && (
                <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100 animate-in fade-in zoom-in">
                  <p className="text-xs font-bold text-emerald-800 mb-2 uppercase">¡Enlace Listo!</p>
                  <div className="flex gap-2">
                    <input type="text" readOnly value={generatedUrl} className="flex-1 px-2 py-1.5 bg-white border border-emerald-200 rounded text-[10px] font-mono outline-none" />
                    <button onClick={() => copyToClipboard(generatedUrl)} className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">JUXA VERIFY - MOTOS</p>
            </div>
          </div>
        </div>

        {/* History Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                Historial de Enlaces Generados
              </h2>
              <span className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded uppercase tracking-widest">
                {history.length} Solicitudes
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {loadingHistory ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                  <p className="text-slate-500 text-sm font-medium">Cargando historial...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 text-sm">No has generado enlaces aún.</p>
                </div>
              ) : (
                history.map((inv) => (
                  <div key={inv.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        inv.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        <Bike className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-slate-900">{inv.title}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            inv.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                            inv.status === 'PENDING' ? 'bg-slate-200 text-slate-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {inv.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="font-bold text-red-600">${Number(inv.loongMontoTotal).toLocaleString()}</span>
                          <span>Enganche: {inv.loongEnganche}%</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {inv.status === 'COMPLETED' ? (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setSelectedInv(inv)}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all"
                          >
                            <Eye className="w-4 h-4" />
                            Ver Dictamen
                          </button>
                          <button 
                            onClick={() => handleReopen(inv)}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                            title="Re-abrir Enlace"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-2">
                          <div className="px-2 py-1 bg-slate-100 rounded border border-slate-200 text-[10px] font-mono text-slate-500 max-w-[150px] truncate">
                            {inv.candidateLink ? getFullUrl(inv.candidateLink) : 'Link no disponible'}
                          </div>
                          <button 
                            onClick={() => {
                              if (inv.candidateLink) {
                                copyToClipboard(getFullUrl(inv.candidateLink));
                              } else {
                                toast.error("ID de enlace no encontrado");
                              }
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 flex items-center gap-2 shadow-sm transition-all"
                          >
                            <Copy className="w-4 h-4" />
                            Copiar Enlace
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dictamen Modal */}
      {selectedInv && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <Bike className="w-5 h-5 text-red-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Dictamen de Crédito</h3>
                  <p className="text-xs text-slate-500">{selectedInv.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleRestartAI(selectedInv)}
                  disabled={isRestarting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRestarting ? 'animate-spin' : ''}`} />
                  {isRestarting ? 'Reiniciando...' : 'Reiniciar'}
                </button>
                <button onClick={() => setSelectedInv(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <AIResultRenderer 
                resultString={selectedInv.socioeconomicDictamen} 
                investigationData={selectedInv}
                onRestart={() => handleRestartAI(selectedInv)}
                isRestarting={isRestarting}
              />
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                <Download className="w-4 h-4" />
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
