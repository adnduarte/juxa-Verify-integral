import React, { useState } from 'react';
import { ShieldCheck, FileText, Settings, Zap, Edit3, CheckCircle2, FileSignature, Plus, ArrowRight, SkipForward, Bot, Search, RefreshCw } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { IAConfigPanel } from './IAConfigPanel';

export const IntegralDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('origination');
  const [currentStep, setCurrentStep] = useState(1);

  const sidebarItems = [
    { id: 'origination', label: 'Originación de Crédito', icon: Zap },
    { id: 'investigations', label: 'Investigaciones', icon: Search },
    { id: 'analysis', label: 'Motor de Análisis', icon: ShieldCheck },
    { id: 'validation', label: 'Validación Electrónica', icon: CheckCircle2 },
    { id: 'pagare', label: 'Originación de Pagaré', icon: FileSignature },
    { id: 'rules', label: 'Reglas Adaptables', icon: Settings },
    { id: 'ia-config', label: 'Configuración IA', icon: Bot },
  ];

  const handleNextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleSkipValidation = () => {
    setCurrentStep(3); // Skip to Pagaré
  };

  return (
    <DashboardLayout
      title="Servicio Integral"
      subtitle="Flujo completo de originación y validación"
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={
        <button 
          onClick={() => { setActiveTab('origination'); setCurrentStep(1); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva Originación
        </button>
      }
    >
      {activeTab === 'origination' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Originación de Crédito</h2>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">Servicio Integral</span>
            </div>
          </div>
          
          {/* Stepper */}
          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 z-0"></div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 z-0 transition-all duration-500" style={{ width: `${(currentStep - 1) * 50}%` }}></div>
            
            {[
              { step: 1, label: 'Análisis', icon: ShieldCheck },
              { step: 2, label: 'Validación', icon: CheckCircle2 },
              { step: 3, label: 'Pagaré', icon: FileSignature }
            ].map((s) => (
              <div key={s.step} className="relative z-10 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  currentStep >= s.step ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-400'
                }`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <span className={`mt-2 text-xs font-medium ${currentStep >= s.step ? 'text-blue-600' : 'text-slate-500'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            {currentStep === 1 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Motor de Análisis de Crédito</h3>
                </div>
                <p className="text-slate-600 mb-6">El motor está evaluando el perfil del solicitante basado en las reglas adaptables configuradas.</p>
                
                <div className="space-y-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">Score Crediticio</span>
                    <span className="text-lg font-bold text-emerald-600">750 (Aprobado)</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">Capacidad de Pago</span>
                    <span className="text-lg font-bold text-emerald-600">Suficiente</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={handleNextStep} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                    Continuar a Validación
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Solicitud de Validación Electrónica</h3>
                </div>
                <p className="text-slate-600 mb-6">Se enviará una solicitud al cliente para validar su identidad electrónicamente.</p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-end mt-8">
                  <button onClick={handleSkipValidation} className="flex items-center justify-center gap-2 px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors">
                    <SkipForward className="w-4 h-4" />
                    Saltar este paso
                  </button>
                  <button onClick={handleNextStep} className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                    Enviar Solicitud
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <FileSignature className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Originación del Pagaré</h3>
                </div>
                <p className="text-slate-600 mb-6">El crédito ha sido aprobado y validado. Procede a generar el pagaré electrónico.</p>
                
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl mb-6 text-center">
                  <FileSignature className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h4 className="font-medium text-slate-900 mb-1">Pagaré Listo para Generar</h4>
                  <p className="text-sm text-slate-500">Monto: $50,000 MXN | Plazo: 12 meses</p>
                </div>

                <div className="flex justify-end">
                  <button onClick={() => { alert('Pagaré generado exitosamente'); setCurrentStep(1); }} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
                    <CheckCircle2 className="w-4 h-4" />
                    Generar y Firmar Pagaré
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {activeTab === 'investigations' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Panel de Investigaciones</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>
          
          <div className="grid gap-4">
            {[
              { id: 'INV-001', candidate: 'Roberto Gómez', type: 'Socioeconómico', status: 'COMPLETED', date: '2026-03-20' },
              { id: 'INV-002', candidate: 'Lucía Fernández', type: 'Laboral', status: 'IN_PROGRESS', date: '2026-03-22' },
              { id: 'INV-003', candidate: 'Marcos Rivas', type: 'Integral', status: 'PENDING', date: '2026-03-24' },
            ].map((inv) => (
              <div key={inv.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-300 transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    inv.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' :
                    inv.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600' :
                    'bg-slate-50 text-slate-400'
                  }`}>
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900">{inv.candidate}</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{inv.id}</span>
                    </div>
                    <p className="text-xs text-slate-500">{inv.type} • Solicitado el {inv.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    inv.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    inv.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {inv.status === 'COMPLETED' ? 'Completado' :
                     inv.status === 'IN_PROGRESS' ? 'En Progreso' : 'Pendiente'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-600 text-white rounded-xl">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">¿Listo para originar?</h3>
                <p className="text-sm text-slate-600 mb-4">Una vez completada la investigación, puedes iniciar el flujo de originación de crédito con un solo clic.</p>
                <button 
                  onClick={() => setActiveTab('origination')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Iniciar Originación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'analysis' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Motor de Análisis de Crédito</h2>
          <p className="text-slate-600">Resultados del análisis en tiempo real basados en las reglas adaptables.</p>
        </div>
      )}

      {activeTab === 'validation' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Validación Electrónica</h2>
          <p className="text-slate-600 mb-4">Solicitudes enviadas para validación de identidad y firma electrónica.</p>
        </div>
      )}

      {activeTab === 'pagare' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Originación de Pagaré</h2>
          <p className="text-slate-600">Generación y firma de pagarés electrónicos vinculados a las originaciones aprobadas.</p>
        </div>
      )}

      {activeTab === 'rules' && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Reglas Adaptables</h2>
          <p className="text-slate-600">Configura los parámetros de riesgo, montos máximos, y flujos de aprobación.</p>
        </div>
      )}

      {activeTab === 'ia-config' && (
        <IAConfigPanel />
      )}
    </DashboardLayout>
  );
};
