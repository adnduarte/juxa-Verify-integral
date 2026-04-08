import React, { useState } from 'react';
import { FileText, Building2, Calculator, ClipboardCheck, ShieldAlert, CheckCircle2, Clock, AlertCircle, Search, Filter, ArrowRight, Download, Brain, User, MapPin } from 'lucide-react';
import { AIResultRenderer } from '../AIResultRenderer';

interface CreditApplicationsModuleProps {
  investigations: any[];
}

export const CreditApplicationsModule: React.FC<CreditApplicationsModuleProps> = ({ investigations }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterScope, setFilterScope] = useState<'ALL' | 'BASIC' | 'INTERMEDIATE' | 'ADVANCED'>('ALL');
  const [selectedApp, setSelectedApp] = useState<any>(null);

  const creditApps = investigations.filter(inv => 
    inv.clientProfile === 'CREDIT' && 
    (searchTerm === '' || inv.title.toLowerCase().includes(searchTerm.toLowerCase()) || inv.id.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterScope === 'ALL' || inv.investigationScope === filterScope)
  );

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case 'BASIC':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">Pre-calificación</span>;
      case 'INTERMEDIATE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">Mesa de Control</span>;
      case 'ADVANCED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-700">Integral</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">{scope}</span>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* List Section */}
      <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Solicitudes de Crédito</h2>
          
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(['ALL', 'BASIC', 'INTERMEDIATE', 'ADVANCED'] as const).map((scope) => (
              <button
                key={scope}
                onClick={() => setFilterScope(scope)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                  filterScope === scope
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {scope === 'ALL' ? 'Todos' : scope === 'BASIC' ? 'Pre-cal' : scope === 'INTERMEDIATE' ? 'Mesa' : 'Integral'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {creditApps.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No se encontraron solicitudes.
            </div>
          ) : (
            creditApps.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className={`w-full p-4 text-left transition-all hover:bg-slate-50 flex flex-col gap-2 ${
                  selectedApp?.id === app.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">INV-{app.id.substring(0, 6)}</span>
                  {getScopeBadge(app.investigationScope)}
                </div>
                <h3 className="font-bold text-slate-900 line-clamp-1">{app.title}</h3>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    {new Date(app.createdAt).toLocaleDateString()}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    app.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    app.status === 'PENDING' ? 'bg-slate-200 text-slate-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {app.status === 'COMPLETED' ? 'Completado' : app.status === 'PENDING' ? 'Pendiente' : 'En Proceso'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail Section */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[700px] flex flex-col">
        {selectedApp ? (
          <>
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detalle de Solicitud</span>
                  {getScopeBadge(selectedApp.investigationScope)}
                </div>
                <h2 className="text-xl font-bold text-slate-900">{selectedApp.title}</h2>
              </div>
              <div className="flex gap-2">
                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Calculator className="w-4 h-4" /> Parámetros del Crédito
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Monto Capital:</span>
                      <span className="font-bold text-slate-900">${selectedApp.montoCreditoCapital || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Monto c/Intereses:</span>
                      <span className="font-bold text-slate-900">${selectedApp.montoCreditoIntereses || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Plazo:</span>
                      <span className="font-bold text-slate-900">{selectedApp.plazoFinanciamiento || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Tipo:</span>
                      <span className="font-bold text-slate-900">{selectedApp.tipoCredito || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {selectedApp.candidateData && (
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Perfilado de Pre-calificación
                    </h4>
                    {(() => {
                      try {
                        const data = JSON.parse(selectedApp.candidateData);
                        const pq = data.preQualQuestions;
                        if (!pq) return <p className="text-xs text-blue-400 italic">No hay datos de pre-calificación.</p>;
                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-600">Propósito:</span>
                              <span className="font-bold text-blue-900">{pq.propositoCredito || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-600">Antigüedad:</span>
                              <span className="font-bold text-blue-900">{pq.antiguedadEmpleo || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-600">Deudas:</span>
                              <span className="font-bold text-blue-900">{pq.tieneDeudasVigentes === 'Si' ? `$${pq.montoDeudasMensual}` : 'No'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-600">Garantía:</span>
                              <span className="font-bold text-blue-900">{pq.cuentaConGarantia === 'Si' ? pq.descripcionGarantia : 'No'}</span>
                            </div>
                          </div>
                        );
                      } catch (e) {
                        return <p className="text-xs text-red-400 italic">Error al cargar datos.</p>;
                      }
                    })()}
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" /> Datos del Solicitante
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Estatus:</span>
                      <span className="font-bold text-slate-900">{selectedApp.status}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Fecha Solicitud:</span>
                      <span className="font-bold text-slate-900">{new Date(selectedApp.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">ID Investigación:</span>
                      <span className="font-mono text-[10px] text-slate-900">{selectedApp.id}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedApp.socioeconomicDictamen ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-slate-900">Análisis de Inteligencia Artificial</h3>
                  </div>
                  <AIResultRenderer resultString={selectedApp.socioeconomicDictamen} />
                </div>
              ) : (
                <div className="p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  <Brain className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="font-bold text-slate-900 mb-2">Análisis Pendiente</h3>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    Aún no se ha generado el dictamen de IA para esta solicitud.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Building2 className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Selecciona una solicitud</h3>
            <p className="text-slate-500 max-w-md">
              Elige una solicitud de crédito de la lista de la izquierda para ver su análisis detallado, parámetros y dictamen final.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
