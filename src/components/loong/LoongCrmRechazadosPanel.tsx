import React, { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import type { LoongOriginationCase } from '../../lib/loongOrigination';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';

export const LoongCrmRechazadosPanel: React.FC<{
  cases: LoongOriginationCase[];
  onRefresh: () => void;
}> = ({ cases, onRefresh }) => {
  const { user } = useAuthStatus();
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      cases.filter(
        (c) =>
          (c.originationStage === 'RECHAZADO' || c.availableForCrm) &&
          !c.registeredInCrm &&
          c.vendedorUid === user?.uid
      ),
    [cases, user?.uid]
  );

  const registerInCrm = async (c: LoongOriginationCase) => {
    setBusyId(c.id);
    try {
      await updateDoc(doc(db, 'loong_origination_cases', c.id), {
        registeredInCrm: true,
        updatedAt: new Date().toISOString(),
      });
      toast.success('Marcado para seguimiento CRM / marketing.');
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar.');
    } finally {
      setBusyId(null);
    }
  };

  if (rows.length === 0) return null;

  return (
    <div className="mt-10 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-6">
      <h3 className="text-lg font-semibold text-slate-900">Prospectos rechazados — recuperación</h3>
      <p className="mt-1 text-sm text-slate-600">
        Teléfono, correo y entidad quedaron guardados para cruce de marketing. Registra en CRM cuando retomes el contacto.
        El flujo completo y cobranza siguen en{' '}
        <Link to="/dashboard?tab=pipeline" className="font-medium text-emerald-800 underline">
          Originación
        </Link>{' '}
        y{' '}
        <Link to="/dashboard?tab=cobranza-crm" className="font-medium text-emerald-800 underline">
          CRM cobranza
        </Link>
        .
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Contacto</th>
              <th className="px-3 py-2">Entidad</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-medium">{c.clientName}</td>
                <td className="px-3 py-2 text-xs">
                  {c.clientEmail}
                  <br />
                  {c.clientPhone || '—'}
                </td>
                <td className="px-3 py-2 text-xs">{c.entidadFederativa || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{c.rejectionReason || '—'}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => registerInCrm(c)}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {busyId === c.id ? '…' : 'Registrar en CRM'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
