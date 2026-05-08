import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { IdentityAntiUsurpationPanel } from '../IdentityAntiUsurpationPanel';
import { useTenant } from '../../contexts/TenantContext';

/**
 * Herramientas de identidad para superadmin: pega un resumen de expediente y ejecuta el validador anti-usurpación (API server-side).
 */
export const AdminIdentityTools: React.FC = () => {
  const { hasProduct } = useTenant();
  const [caseSummary, setCaseSummary] = useState(
    'Ej. Candidato: Juan Pérez; RFC similar a titular reportado; domicilio reciente; referencias laborales inconsistentes.'
  );

  if (!hasProduct('identityAntiUsurpation')) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Activa el producto <strong>identityAntiUsurpation</strong> en la organización (pestaña Onboarding / tenants) para usar esta herramienta.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Identidad y anti-usurpación</h2>
          <p className="text-sm text-slate-600 mt-1">
            Pega un resumen de caso (sin datos sensibles innecesarios). El análisis se ejecuta en servidor según el contrato de API de la plataforma.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Resumen del expediente
        </label>
        <textarea
          value={caseSummary}
          onChange={(e) => setCaseSummary(e.target.value)}
          rows={8}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 resize-y font-mono"
          placeholder="Texto libre o JSON resumido del expediente..."
        />
      </div>

      <IdentityAntiUsurpationPanel caseSummary={caseSummary} />
    </div>
  );
};
