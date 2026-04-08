import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, FileText, MapPin, Building2, ShieldAlert, Briefcase, ExternalLink, Video, Image as ImageIcon, RefreshCw } from 'lucide-react';

interface AIResultRendererProps {
  resultString: string;
  investigationData?: any;
  onRestart?: () => void;
  isRestarting?: boolean;
}

export function AIResultRenderer({ resultString, investigationData, onRestart, isRestarting }: AIResultRendererProps) {
  let data: any = null;
  
  try {
    const cleanJson = typeof resultString === 'string' 
      ? resultString.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim()
      : resultString;
    data = typeof cleanJson === 'string' ? JSON.parse(cleanJson) : cleanJson;
  } catch (e) {
    // Si falla el parseo, mostramos el texto crudo como fallback
    return (
      <div className="space-y-6">
        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed p-4 bg-slate-50 rounded-xl border border-slate-200">
          {resultString}
        </div>
        {investigationData && <DocumentComparison investigationData={investigationData} />}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed p-4 bg-slate-50 rounded-xl border border-slate-200">
          {resultString}
        </div>
        {investigationData && <DocumentComparison investigationData={investigationData} />}
      </div>
    );
  }

  const isViable = data?.dictamenFinal?.estado === 'VIABLE' || data?.dictamenFinal?.estado === 'CONGRUENTE' || data?.dictamenFinal?.estado === 'APROBADO' || data?.dictamenFinal?.estado === 'VIABLE CON CONDICIONES';
  const isWarning = data?.dictamenFinal?.estado === 'SUJETO A CONSIDERACIÓN DE SOLICITANTE POR INCONSISTENCIAS' || data?.dictamenFinal?.estado === 'REQUIERE_REVISION' || data?.dictamenFinal?.estado === 'CONDICIONADO' || data?.dictamenFinal?.estado === 'A CONSIDERACIÓN';
  const isNoViable = data?.dictamenFinal?.estado === 'NO VIABLE' || data?.dictamenFinal?.estado === 'RECHAZADO';
  const alertaVendedor = data?.dictamenFinal?.alertaVendedor || data?.alertaVendedor;
  const isLoongMotor = data?.perfil === 'LOONG_MOTOR';

  return (
    <div className="space-y-6">
      {/* Acciones Rápidas */}
      {onRestart && (
        <div className="flex justify-end">
          <button
            onClick={onRestart}
            disabled={isRestarting}
            className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 hover:bg-blue-100 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRestarting ? 'animate-spin' : ''}`} />
            {isRestarting ? 'Reiniciando Análisis...' : 'Reiniciar Análisis con Nuevas Reglas'}
          </button>
        </div>
      )}

      {/* Documentos y Cotejo - MOVED TO TOP */}
      {investigationData && <DocumentComparison investigationData={investigationData} />}

      {/* Alerta de Vendedor (Audit) */}
      {alertaVendedor && alertaVendedor.includes('ALERTA') && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-pulse">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-900">ALERTA DE SEGURIDAD (MESA DE CONTROL)</p>
            <p className="text-[10px] text-red-700">{alertaVendedor}</p>
          </div>
        </div>
      )}

      {/* Dictamen Final */}
      <div className={`p-4 rounded-xl border ${
        isViable ? 'bg-emerald-50 border-emerald-200' : 
        isWarning ? 'bg-amber-50 border-amber-200' : 
        'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            {isViable ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mr-2" /> : 
             isWarning ? <AlertTriangle className="w-5 h-5 text-amber-600 mr-2" /> : 
             <AlertCircle className="w-5 h-5 text-red-600 mr-2" />}
            <h4 className={`font-bold ${
              isViable ? 'text-emerald-900' : 
              isWarning ? 'text-amber-900' : 
              'text-red-900'
            }`}>
              Dictamen Final: {data.dictamenFinal?.estado || 'DESCONOCIDO'}
            </h4>
          </div>
          {isLoongMotor && (
            <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded uppercase tracking-widest">
              LOONG MOTOR
            </span>
          )}
        </div>
        <p className={`text-sm ${
          isViable ? 'text-emerald-800' : 
          isWarning ? 'text-amber-800' : 
          'text-red-800'
        }`}>
          {data.dictamenFinal?.resumen}
        </p>

        {data.dictamenFinal?.dictamenArraigo && (
          <div className={`mt-3 pt-3 border-t ${
            isViable ? 'border-emerald-200' : 
            isWarning ? 'border-amber-200' : 
            'border-red-200'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${
              isViable ? 'text-emerald-900' : 
              isWarning ? 'text-amber-900' : 
              'text-red-900'
            }`}>
              Dictamen de Arraigo:
            </p>
            <p className={`text-sm ${
              isViable ? 'text-emerald-800' : 
              isWarning ? 'text-amber-800' : 
              'text-red-800'
            }`}>
              {data.dictamenFinal?.dictamenArraigo}
            </p>
          </div>
        )}

        {data.dictamenFinal?.analisisForenseIdentidad && (
          <div className={`mt-3 pt-3 border-t ${
            isViable ? 'border-emerald-200' : 
            isWarning ? 'border-amber-200' : 
            'border-red-200'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${
              isViable ? 'text-emerald-900' : 
              isWarning ? 'text-amber-900' : 
              'text-red-900'
            }`}>
              Análisis Forense de Identidad:
            </p>
            <p className={`text-sm ${
              isViable ? 'text-emerald-800' : 
              isWarning ? 'text-amber-800' : 
              'text-red-800'
            }`}>
              {data.dictamenFinal?.analisisForenseIdentidad}
            </p>
          </div>
        )}

        {data.dictamenFinal?.sugerenciaAprobacion && (
          <div className={`mt-3 pt-3 border-t ${
            isViable ? 'border-emerald-200' : 
            isWarning ? 'border-amber-200' : 
            'border-red-200'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${
              isViable ? 'text-emerald-900' : 
              isWarning ? 'text-amber-900' : 
              'text-red-900'
            }`}>
              Sugerencia de Aprobación:
            </p>
            <p className={`text-sm italic ${
              isViable ? 'text-emerald-800' : 
              isWarning ? 'text-amber-800' : 
              'text-red-800'
            }`}>
              {data.dictamenFinal?.sugerenciaAprobacion}
            </p>
          </div>
        )}

        {data.dictamenFinal?.mitigacionSugerida && (
          <div className={`mt-3 pt-3 border-t ${
            isViable ? 'border-emerald-200' : 
            isWarning ? 'border-amber-200' : 
            'border-red-200'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${
              isViable ? 'text-emerald-900' : 
              isWarning ? 'text-amber-900' : 
              'text-red-900'
            }`}>
              Mitigación Sugerida (LOONG MOTOR):
            </p>
            <div className={`flex items-center gap-2 p-2 rounded-lg ${
              isViable ? 'bg-emerald-100/50' : 'bg-amber-100/50'
            }`}>
              <ShieldAlert className={`w-4 h-4 ${isViable ? 'text-emerald-600' : 'text-amber-600'}`} />
              <p className={`text-sm font-bold ${
                isViable ? 'text-emerald-800' : 'text-amber-800'
              }`}>
                {data.dictamenFinal?.mitigacionSugerida}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Detalles del Análisis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.score !== undefined && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm md:col-span-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score de Confianza</p>
              <p className="text-2xl font-black text-slate-900">{data.score}/100</p>
            </div>
            {data.scoreBreakdown && (
              <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 uppercase">
                {!isLoongMotor && <div>Capacidad: {data?.scoreBreakdown?.capacidadPago}%</div>}
                <div>Arraigo: {data?.scoreBreakdown?.arraigoDomiciliario}%</div>
                <div>Docs: {data?.scoreBreakdown?.confiabilidadDocumental}%</div>
                {data?.scoreBreakdown?.verificacionIdentidad !== undefined && (
                  <div>Identidad: {data?.scoreBreakdown?.verificacionIdentidad}%</div>
                )}
              </div>
            )}
          </div>
        )}

        {data.auditoriaGeografica && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
              <MapPin className="w-4 h-4 mr-1 text-blue-500" />
              Auditoría Geográfica
            </h5>
            <div className="space-y-1">
              <p className="text-sm text-slate-700 font-bold">{data?.auditoriaGeografica?.congruenciaGpsDomicilio} CONGRUENCIA</p>
              <p className="text-xs text-slate-500">Distancia: {data?.auditoriaGeografica?.distanciaEstimadaMetros}m</p>
              <p className="text-xs text-slate-600 italic">{data?.auditoriaGeografica?.detalles}</p>
            </div>
          </div>
        )}

        {data.analisisFachada && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
              <Building2 className="w-4 h-4 mr-1 text-indigo-500" />
              Análisis de Fachada
            </h5>
            <p className="text-sm text-slate-700">{data?.analisisFachada?.detalles}</p>
            {data?.analisisFachada?.validacionVideo && (
              <p className="text-xs text-blue-600 font-bold mt-2 border-t border-blue-100 pt-2">
                Video: {data?.analisisFachada?.validacionVideo}
              </p>
            )}
            {data?.analisisFachada?.comparativoStreetView && (
              <p className="text-[10px] text-slate-500 mt-2 border-t pt-2">{data?.analisisFachada?.comparativoStreetView}</p>
            )}
          </div>
        )}

        {!isLoongMotor && data.congruenciaIngresos && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
              <Building2 className="w-4 h-4 mr-1 text-emerald-500" />
              Congruencia de Ingresos / Entorno
            </h5>
            <p className="text-sm text-slate-700">{data?.congruenciaIngresos?.detalles}</p>
          </div>
        )}

        {data.analisisEstabilidad && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
              <Briefcase className="w-4 h-4 mr-1 text-amber-500" />
              Análisis de Estabilidad
            </h5>
            <div className="space-y-1">
              <p className="text-sm text-slate-700 font-bold">Laboral: {data?.analisisEstabilidad?.laboral}</p>
              <p className="text-sm text-slate-700 font-bold">Residencial: {data?.analisisEstabilidad?.residencial}</p>
              <p className="text-xs text-slate-600 mt-1">{data?.analisisEstabilidad?.detalles}</p>
            </div>
          </div>
        )}

        {data.analisisDocumental && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
              <FileText className="w-4 h-4 mr-1 text-purple-500" />
              Análisis Documental
            </h5>
            <p className="text-sm text-slate-700">{data?.analisisDocumental?.detalles}</p>
          </div>
        )}
      </div>

      {/* Banderas Rojas */}
      {data.banderasRojas && data.banderasRojas.length > 0 && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
          <h5 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2 flex items-center">
            <ShieldAlert className="w-4 h-4 mr-1" />
            Banderas Rojas Detectadas
          </h5>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {data.banderasRojas.map((bandera: string, index: number) => (
              <li key={index}>{bandera}</li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

export function DocumentComparison({ investigationData }: { investigationData: any }) {
  const urls = investigationData.uploadedFileUrls || {};
  const candidateData = investigationData.candidateData ? JSON.parse(investigationData.candidateData) : {};
  
  const documents = [
    { label: 'Fachada', url: urls.fotoFachadaUrl || candidateData.fotoFachadaUrl, type: 'image' },
    { label: 'Video Fachada', url: urls.videoFachadaUrl || candidateData.videoFachadaUrl, type: 'video' },
    { label: 'Sala', url: urls.fotoSalaUrl || candidateData.fotoSalaUrl, type: 'image' },
    { label: 'Comedor', url: urls.fotoComedorUrl || candidateData.fotoComedorUrl, type: 'image' },
    { label: 'Cocina', url: urls.fotoCocinaUrl || candidateData.fotoCocinaUrl, type: 'image' },
    { label: 'Habitación', url: urls.fotoHabitacionUrl || candidateData.fotoHabitacionUrl, type: 'image' },
    { label: 'INE Frente', url: urls.idFrontUrl || candidateData.idFrontUrl, type: 'image' },
    { label: 'INE Reverso', url: urls.idBackUrl || candidateData.idBackUrl, type: 'image' },
    { label: 'Prueba de Vida', url: urls.selfieUrl || candidateData.selfieUrl, type: 'image' },
    { label: 'Comprobante Domicilio', url: urls.proofOfAddressUrl || candidateData.proofOfAddressUrl, type: 'image' },
    { label: 'Comprobante Ingresos', url: urls.incomeProofUrl || candidateData.incomeProofUrl, type: 'image' },
  ].filter(d => d.url);

  if (documents.length === 0) return null;

  return (
    <div className="mt-8 pt-8 border-t border-slate-200">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-blue-600" />
        Documentos y Evidencia de Cotejo
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="p-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{doc.label}</span>
              <a 
                href={doc.url} 
                target="_blank" 
                rel="noreferrer" 
                className="text-[10px] text-blue-600 font-bold hover:underline"
              >
                Abrir Original
              </a>
            </div>
            <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
              {doc.type === 'video' ? (
                <video src={doc.url} controls className="w-full h-full object-contain" />
              ) : (
                <img 
                  src={doc.url} 
                  alt={doc.label} 
                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => window.open(doc.url, '_blank')}
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
