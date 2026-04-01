import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, FileText, MapPin, Building2, ShieldAlert } from 'lucide-react';

interface AIResultRendererProps {
  resultString: string;
}

export function AIResultRenderer({ resultString }: AIResultRendererProps) {
  let data: any = null;
  
  try {
    const cleanJson = typeof resultString === 'string' 
      ? resultString.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim()
      : resultString;
    data = typeof cleanJson === 'string' ? JSON.parse(cleanJson) : cleanJson;
  } catch (e) {
    // Si falla el parseo, mostramos el texto crudo como fallback
    return (
      <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
        {typeof resultString === 'string' ? resultString : JSON.stringify(resultString)}
      </div>
    );
  }

  const isViable = data.dictamenFinal?.estado === 'VIABLE' || data.dictamenFinal?.estado === 'CONGRUENTE' || data.dictamenFinal?.estado === 'APROBADO';
  const isWarning = data.dictamenFinal?.estado === 'SUJETO A CONSIDERACIÓN DE SOLICITANTE POR INCONSISTENCIAS' || data.dictamenFinal?.estado === 'REQUIERE_REVISION';
  const isNoViable = data.dictamenFinal?.estado === 'NO VIABLE';

  return (
    <div className="space-y-4">
      {/* Dictamen Final */}
      <div className={`p-4 rounded-xl border ${
        isViable ? 'bg-emerald-50 border-emerald-200' : 
        isWarning ? 'bg-amber-50 border-amber-200' : 
        'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center mb-2">
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
        <p className={`text-sm ${
          isViable ? 'text-emerald-800' : 
          isWarning ? 'text-amber-800' : 
          'text-red-800'
        }`}>
          {data.dictamenFinal?.resumen}
        </p>

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
              {data.dictamenFinal.sugerenciaAprobacion}
            </p>
          </div>
        )}
      </div>

      {/* Detalles del Análisis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.congruenciaDomicilio && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center">
              <MapPin className="w-4 h-4 mr-1 text-blue-500" />
              Congruencia de Domicilio
            </h5>
            <p className="text-sm text-slate-700 dark:text-slate-200">{data.congruenciaDomicilio.detalles}</p>
          </div>
        )}

        {data.congruenciaFachadaEntorno && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center">
              <MapPin className="w-4 h-4 mr-1 text-indigo-500" />
              Análisis Fachada vs Entorno
            </h5>
            <p className="text-sm text-slate-700 dark:text-slate-200">{data.congruenciaFachadaEntorno.detalles}</p>
          </div>
        )}

        {data.congruenciaIngresos && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center">
              <Building2 className="w-4 h-4 mr-1 text-emerald-500" />
              Congruencia de Ingresos / Entorno
            </h5>
            <p className="text-sm text-slate-700 dark:text-slate-200">{data.congruenciaIngresos.detalles}</p>
          </div>
        )}

        {data.analisisDocumental && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm md:col-span-2">
            <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center">
              <FileText className="w-4 h-4 mr-1 text-purple-500" />
              Análisis Documental
            </h5>
            <p className="text-sm text-slate-700 dark:text-slate-200">{data.analisisDocumental.detalles}</p>
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
