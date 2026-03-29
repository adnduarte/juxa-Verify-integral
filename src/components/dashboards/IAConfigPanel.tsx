import React, { useState, useEffect } from 'react';
import { Bot, ShieldCheck, CreditCard, Users, Save, AlertCircle, Building2 } from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuthStatus } from '../../contexts/AuthContext';

export const IAConfigPanel: React.FC = () => {
  const { user } = useAuthStatus();
  const [weights, setWeights] = useState({
    income: 30,
    location: 30,
    documents: 40
  });
  const [scoringConfig, setScoringConfig] = useState({
    minIncome: 5000,
    maxDistance: 150,
    requiredDocs: ['INE', 'Comprobante de Domicilio', 'Comprobante de Ingresos']
  });
  const [policies, setPolicies] = useState({
    politicasGenerales: '',
    creditPolicies: '',
    socioeconomicPolicies: '',
    hrPolicies: '',
    bankingPolicies: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const defaultPolicies = {
    politicasGenerales: '',
    creditPolicies: '1. No aprobar si el DTI es mayor al 40%.\n2. Requiere antigüedad laboral mínima de 1 año.\n3. Sin antecedentes negativos en buró de crédito.',
    socioeconomicPolicies: '1. Validar congruencia entre ingresos declarados y entorno físico.\n2. Verificar referencias vecinales y estabilidad de domicilio.',
    hrPolicies: '1. Priorizar honestidad en trayectoria laboral.\n2. Validar que no existan demandas laborales previas.\n3. Confirmar referencias de jefes directos.',
    bankingPolicies: '1. Score crediticio mínimo de 650 puntos.\n2. Verificación exhaustiva de capacidad de pago.\n3. Validación de garantías prendarias o hipotecarias si aplica.'
  };

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error.message || String(error),
      code: error.code,
      operation,
      path,
      userId: user?.uid,
      email: user?.email
    };
    console.error(`[IAConfigPanel] Firestore Error:`, JSON.stringify(errInfo, null, 2));
    return errInfo;
  };

  useEffect(() => {
    if (!user) return;
    const fetchConfig = async () => {
      try {
        // Try to fetch from clients collection first (for ClientDashboard)
        const clientRef = doc(db, 'clients', user.uid);
        const clientSnap = await getDoc(clientRef);
        
        if (clientSnap.exists()) {
          const data = clientSnap.data();
          if (data.scoringConfig?.weights) setWeights(data.scoringConfig.weights);
          if (data.scoringConfig) {
            setScoringConfig({
              minIncome: data.scoringConfig.minIncome || 5000,
              maxDistance: data.scoringConfig.maxDistance || 150,
              requiredDocs: data.scoringConfig.requiredDocs || ['INE', 'Comprobante de Domicilio', 'Comprobante de Ingresos']
            });
          }
          setPolicies({
            politicasGenerales: data.politicasGenerales || '',
            creditPolicies: data.creditPolicies || defaultPolicies.creditPolicies,
            socioeconomicPolicies: data.socioeconomicPolicies || defaultPolicies.socioeconomicPolicies,
            hrPolicies: data.hrPolicies || defaultPolicies.hrPolicies,
            bankingPolicies: data.bankingPolicies || defaultPolicies.bankingPolicies
          });
        } else {
          // Fallback to user_ia_configs
          const docRef = doc(db, 'user_ia_configs', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.weights) setWeights(data.weights);
            setPolicies({
              politicasGenerales: '',
              creditPolicies: data.creditPolicies || defaultPolicies.creditPolicies,
              socioeconomicPolicies: data.socioeconomicPolicies || defaultPolicies.socioeconomicPolicies,
              hrPolicies: data.hrPolicies || defaultPolicies.hrPolicies,
              bankingPolicies: data.bankingPolicies || defaultPolicies.bankingPolicies
            });
          } else {
            setPolicies(defaultPolicies);
          }
        }
      } catch (error) {
        handleFirestoreError(error, 'GET', `clients/${user.uid}`);
      }
    };
    fetchConfig();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const total = weights.income + weights.location + weights.documents;
    if (total !== 100) {
      setMessage(`El total de ponderaciones debe sumar 100%. Actual: ${total}%`);
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      // Save to clients collection (primary for ClientDashboard)
      const clientRef = doc(db, 'clients', user.uid);
      const clientSnap = await getDoc(clientRef);
      
      const configData = {
        scoringConfig: {
          weights,
          ...scoringConfig
        },
        ...policies,
        updatedAt: new Date().toISOString()
      };

      if (clientSnap.exists()) {
        await setDoc(clientRef, configData, { merge: true });
      }

      // Also save to user_ia_configs for backward compatibility/other dashboards
      const docRef = doc(db, 'user_ia_configs', user.uid);
      await setDoc(docRef, {
        weights,
        ...policies,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setMessage('Políticas y ponderaciones guardadas exitosamente.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Error saving user IA config:", error);
      setMessage('Error al guardar la configuración.');
    } finally {
      setIsSaving(false);
    }
  };

  const total = weights.income + weights.location + weights.documents;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Ponderaciones Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
          <Bot className="w-5 h-5 mr-2 text-blue-600" />
          Ponderaciones de Dictamen IA
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Define la importancia de cada módulo en el cálculo del score final de riesgo para tus solicitudes.
        </p>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Ingresos y Capacidad de Pago</label>
              <span className="text-sm font-bold text-slate-900">{weights.income}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="100" 
              value={weights.income} 
              onChange={(e) => setWeights({...weights, income: parseInt(e.target.value)})}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Ubicación y Arraigo (GPS/Fachada)</label>
              <span className="text-sm font-bold text-slate-900">{weights.location}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="100" 
              value={weights.location} 
              onChange={(e) => setWeights({...weights, location: parseInt(e.target.value)})}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Documentación y Autenticidad</label>
              <span className="text-sm font-bold text-slate-900">{weights.documents}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="100" 
              value={weights.documents} 
              onChange={(e) => setWeights({...weights, documents: parseInt(e.target.value)})}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Total:</span>
            <span className={`font-bold ${total === 100 ? 'text-emerald-600' : 'text-red-600'}`}>
              {total}%
            </span>
            {total !== 100 && (
              <span className="text-red-500 flex items-center gap-1 ml-2">
                <AlertCircle className="w-4 h-4" /> Debe sumar 100
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Scoring Configuration Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
          <CreditCard className="w-5 h-5 mr-2 text-emerald-600" />
          Configuración de Scoring Inteligente
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Ajusta los parámetros que la IA utilizará para calcular el puntaje de crédito de los candidatos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ingreso Mínimo Mensual ($)</label>
            <input 
              type="number" 
              value={scoringConfig.minIncome} 
              onChange={(e) => setScoringConfig({...scoringConfig, minIncome: parseInt(e.target.value)})}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            />
            <p className="text-[10px] text-slate-400 mt-1">Sugerencia: $5,000 - $15,000 según el tipo de crédito.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Distancia Máxima Permitida (m)</label>
            <input 
              type="number" 
              value={scoringConfig.maxDistance} 
              onChange={(e) => setScoringConfig({...scoringConfig, maxDistance: parseInt(e.target.value)})}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            />
            <p className="text-[10px] text-slate-400 mt-1">Sugerencia: 150m para alta precisión, 500m para zonas rurales.</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Documentos Obligatorios (Separados por coma)</label>
            <input 
              type="text" 
              value={scoringConfig.requiredDocs.join(', ')} 
              onChange={(e) => setScoringConfig({...scoringConfig, requiredDocs: e.target.value.split(',').map(s => s.trim())})}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            />
            <p className="text-[10px] text-slate-400 mt-1">Ej: INE, Comprobante de Domicilio, Comprobante de Ingresos, Referencias.</p>
          </div>
        </div>
      </div>

      {/* Business Rules Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
          <ShieldCheck className="w-5 h-5 mr-2 text-indigo-600" />
          Políticas y Reglas de Negocio
        </h3>
        
        <div className="space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Políticas Generales del Despacho / Empresa
            </label>
            <textarea
              value={policies.politicasGenerales}
              onChange={(e) => setPolicies({...policies, politicasGenerales: e.target.value})}
              placeholder="Ej: Duarte-Aupart Abogados prioriza la veracidad de la información y el arraigo domiciliario..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm min-h-[100px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
              <CreditCard className="w-4 h-4 text-slate-400" />
              Políticas para Originación de Crédito
            </label>
            <textarea
              value={policies.creditPolicies}
              onChange={(e) => setPolicies({...policies, creditPolicies: e.target.value})}
              placeholder="Ej: No aprobar si el DTI es mayor al 40%. Requiere antigüedad laboral mínima de 1 año..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm min-h-[100px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
              <Users className="w-4 h-4 text-slate-400" />
              Políticas para Estudio Socioeconómico (General)
            </label>
            <textarea
              value={policies.socioeconomicPolicies}
              onChange={(e) => setPolicies({...policies, socioeconomicPolicies: e.target.value})}
              placeholder="Ej: Validar congruencia entre ingresos declarados y entorno físico. Verificar referencias vecinales..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm min-h-[100px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
              <Users className="w-4 h-4 text-emerald-500" />
              Políticas para Estudio Socioeconómico (Recursos Humanos)
            </label>
            <textarea
              value={policies.hrPolicies}
              onChange={(e) => setPolicies({...policies, hrPolicies: e.target.value})}
              placeholder="Ej: Priorizar honestidad en trayectoria laboral. Validar que no existan demandas laborales previas..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm min-h-[100px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Políticas para Crédito Bancario / Financiero
            </label>
            <textarea
              value={policies.bankingPolicies}
              onChange={(e) => setPolicies({...policies, bankingPolicies: e.target.value})}
              placeholder="Ej: Score crediticio mínimo de 650 puntos. Verificación exhaustiva de capacidad de pago..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm min-h-[100px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving || total !== 100}
          className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <Bot className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Guardar Configuración de Políticas
        </button>
        {message && (
          <span className={`text-sm font-medium ${message.includes('Error') || message.includes('100%') ? 'text-red-600' : 'text-emerald-600'}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
};
