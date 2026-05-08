import React, { useState } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useAuthStatus } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { postJson } from '../services/platformApi';
import type { AntiUsurpationResult } from '../types/saas';

interface Props {
  /** Texto o JSON resumido del expediente (sin exponer prompts internos) */
  caseSummary: string;
  onResult?: (r: AntiUsurpationResult) => void;
  compact?: boolean;
}

export const IdentityAntiUsurpationPanel: React.FC<Props> = ({ caseSummary, onResult, compact }) => {
  const { organizationId } = useAuthStatus();
  const { hasProduct } = useTenant();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AntiUsurpationResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!caseSummary.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await postJson<{ result: AntiUsurpationResult }>('/api/identity/anti-usurpation', {
        summary: caseSummary.slice(0, 8000),
        organizationId: organizationId || 'default',
      });
      setResult(data.result);
      onResult?.(data.result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (!hasProduct('identityAntiUsurpation')) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white ${compact ? 'p-4' : 'p-6'} shadow-sm`}
    >
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-5 h-5 text-amber-600" />
        <h3 className="font-bold text-slate-900">Validador anti-usurpación</h3>
      </div>
      <p className="text-sm text-slate-600 mb-4">
        Cruce con IA en servidor (sin embeber reglas internas). Indicativo para originación y RRHH.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={loading || !caseSummary.trim()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Analizar riesgo
      </button>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {result && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 text-sm space-y-2">
          <p>
            <span className="font-semibold">Riesgo:</span> {result.riskScore}/100 —{' '}
            <span className="font-semibold">{result.recommendation}</span>
          </p>
          <ul className="list-disc pl-5 text-slate-700">
            {result.factors?.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">{result.checkedAt}</p>
        </div>
      )}
    </div>
  );
};
