import React, { useState } from 'react';
import { PenLine, Loader2 } from 'lucide-react';
import { useAuthStatus } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { createDigidSignatureRequest } from '../services/digidClient';
import { addDoc, collection } from '@/lib/localFirestore';
import { db } from '../firebase';

interface Props {
  contextType: 'investigation' | 'credit_app' | 'hr_contract' | 'supplier';
  contextId: string;
  title?: string;
}

export const DigidSignatureCard: React.FC<Props> = ({
  contextType,
  contextId,
  title = 'Firma electrónica (DIGID)',
}) => {
  const { organizationId, user } = useAuthStatus();
  const { hasProduct } = useTenant();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [envelopeId, setEnvelopeId] = useState<string | null>(null);

  if (!hasProduct('digidSignatures')) {
    return null;
  }

  const start = async () => {
    const org = organizationId || 'default';
    setLoading(true);
    setMsg(null);
    try {
      const res = await createDigidSignatureRequest({
        organizationId: org,
        contextType,
        contextId,
      });
      setEnvelopeId(res.envelopeId);
      setMsg(res.message || `Estado: ${res.status}`);
      if (user) {
        await addDoc(collection(db, 'signature_requests'), {
          organizationId: org,
          contextType,
          contextId,
          status: res.status || 'MOCK',
          digidEnvelopeId: res.envelopeId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al solicitar firma');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <PenLine className="w-5 h-5 text-indigo-700" />
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      <p className="text-sm text-slate-600 mb-4">
        Flujo MVP: solicitud vía API local; sustituir por SDK DIGID y webhooks en producción.
      </p>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Iniciar firma
      </button>
      {msg && <p className="text-sm text-slate-700 mt-3">{msg}</p>}
      {envelopeId && (
        <p className="text-xs text-slate-500 mt-2 font-mono break-all">Envelope: {envelopeId}</p>
      )}
    </div>
  );
};
