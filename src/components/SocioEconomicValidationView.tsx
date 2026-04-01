import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, MapPin, DollarSign, FileText, Loader2 } from 'lucide-react';

export interface ValidationResult {
  congruenciaIngresos: {
    verificado: boolean;
    nivelSocioeconomicoInferido: string;
    detalles: string;
  };
  congruenciaDomicilio: {
    verificado: boolean;
    distanciaMetros: number;
    detalles: string;
  };
  dictamenFinal: {
    estado: 'Congruente' | 'Inconsistente' | 'Requiere Revisión Manual';
    resumen: string;
  };
}

interface Props {
  caseId?: string;
  onAuthorize?: () => void;
  data?: ValidationResult;
  readOnly?: boolean;
}

export const SocioEconomicValidationView: React.FC<Props> = ({ caseId, onAuthorize, data, readOnly }) => {
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(data || null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  useEffect(() => {
    if (data) {
      setResult(data);
      setLoading(false);
      return;
    }

    if (!caseId) return;

    const fetchValidation = async () => {
      try {
        setLoading(true);
        // Simulación de llamada a la API Route / Cloud Function
        // const response = await fetch('/api/validate-sse', {
        //   method: 'POST',
        //   body: JSON.stringify({ caseId })
        // });
        // const data = await response.json();
        
        // Mock data para demostración
        await new Promise(resolve => setTimeout(resolve, 2000));
        const mockData: ValidationResult = {
          congruenciaIngresos: {
            verificado: true,
            nivelSocioeconomicoInferido: 'Medio-Alto',
            detalles: 'Los ingresos declarados ($50,000 MXN) son congruentes con los recibos de nómina analizados por la IA.'
          },
          congruenciaDomicilio: {
            verificado: true,
            distanciaMetros: 15,
            detalles: 'Las coordenadas GPS de la visita coinciden con la dirección declarada. La fachada coincide con Street View.'
          },
          dictamenFinal: {
            estado: 'Congruente',
            resumen: 'No se detectaron inconsistencias entre las declaraciones del candidato y la evidencia documental/geográfica. Perfil apto.'
          }
        };
        
        setResult(mockData);
      } catch (err) {
        setError('Error al obtener el dictamen de validación.');
      } finally {
        setLoading(false);
      }
    };

    fetchValidation();
  }, [caseId, data]);

  const handleAuthorize = async () => {
    if (!onAuthorize) return;
    setIsAuthorizing(true);
    // Simular guardado
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsAuthorizing(false);
    onAuthorize();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-600 dark:text-slate-300 font-medium">Ejecutando validación cruzada con IA...</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2 text-center max-w-md">
          Analizando documentos, metadatos geográficos y congruencia socioeconómica.
        </p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-start">
        <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold">Error de Validación</h4>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const isCongruent = result.dictamenFinal.estado === 'Congruente';

  return (
    <div className="space-y-6">
      {/* Tarjeta 1: Verificación General */}
      <div className={`p-6 rounded-2xl border shadow-sm ${
        isCongruent ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${
            isCongruent ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
          }`}>
            {isCongruent ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-slate-400">Dictamen Final IA</h3>
            <h2 className={`text-2xl font-extrabold mb-2 ${
              isCongruent ? 'text-emerald-900' : 'text-amber-900'
            }`}>
              {result.dictamenFinal.estado}
            </h2>
            <p className={`text-sm ${
              isCongruent ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {result.dictamenFinal.resumen}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tarjeta 2: Cotejo de Ingresos */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${result.congruenciaIngresos.verificado ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Cotejo de Ingresos</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">Estatus de Verificación</span>
              <span className={`text-sm font-bold px-2 py-1 rounded-full ${
                result.congruenciaIngresos.verificado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}>
                {result.congruenciaIngresos.verificado ? 'Verificado' : 'Inconsistente'}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">Nivel Socioeconómico</span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{result.congruenciaIngresos.nivelSocioeconomicoInferido}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Análisis Detallado</span>
              <p className="text-sm text-slate-700 dark:text-slate-200">{result.congruenciaIngresos.detalles}</p>
            </div>
          </div>
        </div>

        {/* Tarjeta 3: Cotejo de Domicilio */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${result.congruenciaDomicilio.verificado ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Cotejo Geográfico</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">Estatus de Verificación</span>
              <span className={`text-sm font-bold px-2 py-1 rounded-full ${
                result.congruenciaDomicilio.verificado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}>
                {result.congruenciaDomicilio.verificado ? 'Verificado' : 'Inconsistente'}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">Desviación GPS</span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{result.congruenciaDomicilio.distanciaMetros} metros</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Análisis Detallado</span>
              <p className="text-sm text-slate-700 dark:text-slate-200">{result.congruenciaDomicilio.detalles}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones Finales */}
      {!readOnly && (
        <div className="pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={handleAuthorize}
            disabled={isAuthorizing}
            className="flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70"
          >
            {isAuthorizing ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <FileText className="w-5 h-5 mr-2" />
            )}
            {isAuthorizing ? 'Generando Reporte...' : 'Autorizar y Generar Reporte Final'}
          </button>
        </div>
      )}
    </div>
  );
};
