import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';

/** Campos mínimos de investigations LOONG_PRECAL del vendedor (clientId = uid vendedor). */
export type VendorPrecalInvRow = {
  id: string;
  investigationScope?: string;
  clientProfile?: string;
  investigationType?: string;
  status?: string;
  linkStatus?: string;
  mesaPrecalStatus?: string;
  mesaPrecalDecision?: string;
  contactInfo?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  title?: string;
  updatedAt?: string;
  loongPhase2Unlocked?: boolean;
  originacionPhase2Unlocked?: boolean;
  mesaPrecalAutoPassed?: boolean;
};

function readInvRow(id: string, x: Record<string, unknown>): VendorPrecalInvRow {
  return {
    id,
    investigationScope: typeof x.investigationScope === 'string' ? x.investigationScope : undefined,
    clientProfile: typeof x.clientProfile === 'string' ? x.clientProfile : undefined,
    investigationType: typeof x.investigationType === 'string' ? x.investigationType : undefined,
    status: typeof x.status === 'string' ? x.status : undefined,
    linkStatus: typeof x.linkStatus === 'string' ? x.linkStatus : undefined,
    mesaPrecalStatus: typeof x.mesaPrecalStatus === 'string' ? x.mesaPrecalStatus : undefined,
    mesaPrecalDecision: typeof x.mesaPrecalDecision === 'string' ? x.mesaPrecalDecision : undefined,
    contactInfo: typeof x.contactInfo === 'string' ? x.contactInfo : undefined,
    candidateEmail: typeof x.candidateEmail === 'string' ? x.candidateEmail : undefined,
    candidatePhone: typeof x.candidatePhone === 'string' ? x.candidatePhone : undefined,
    title: typeof x.title === 'string' ? x.title : undefined,
    updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : undefined,
    loongPhase2Unlocked: x.loongPhase2Unlocked === true,
    originacionPhase2Unlocked: x.originacionPhase2Unlocked === true,
    mesaPrecalAutoPassed:
      typeof x.mesaPrecalAutoPassed === 'boolean' ? (x.mesaPrecalAutoPassed as boolean) : undefined,
  };
}

/**
 * Mapa investigationId → datos en vivo para filas de precal del vendedor.
 * Una sola suscripción por uid (todas las investigaciones donde el vendedor es clientId).
 */
export function useVendorLoongPrecalInvestigations(clientId: string | undefined): Record<string, VendorPrecalInvRow> {
  const [map, setMap] = useState<Record<string, VendorPrecalInvRow>>({});

  useEffect(() => {
    if (!clientId) {
      setMap({});
      return;
    }
    /** Sin orderBy, `limit` devuelve un subconjunto arbitrario y expedientes nuevos pueden no cargarse → «Sincronizando expediente…» permanente. */
    const q = query(
      collection(db, 'investigations'),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const m: Record<string, VendorPrecalInvRow> = {};
        for (const d of snap.docs) {
          const x = d.data() as Record<string, unknown>;
          if (x.investigationScope !== 'LOONG_PRECAL') continue;
          m[d.id] = readInvRow(d.id, x);
        }
        setMap(m);
      },
      (e) => console.error('[useVendorLoongPrecalInvestigations]', e)
    );
    return () => unsub();
  }, [clientId]);

  return map;
}
