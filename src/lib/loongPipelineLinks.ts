import { doc, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import type { LoongOriginationCase, LoongOriginationHistoryEntry } from './loongOrigination';

function rid() {
  return crypto.randomUUID();
}

export function candidateUrlForLink(linkId: string): string {
  if (typeof window !== 'undefined') return `${window.location.origin}/candidate/${linkId}`;
  return `/candidate/${linkId}`;
}

/** Tras precal en CRM: crea investigación + enlace de calificación formal (política se aplica en CandidateFlow). */
export async function issueFormalQualificationLink(
  db: Firestore,
  c: LoongOriginationCase,
  vendorUid: string,
  organizationId: string | null | undefined
): Promise<{ linkId: string; investigationId: string }> {
  if (c.originationStage !== 'PRECUALIFICADO') {
    throw new Error('Solo se puede emitir el enlace en etapa Precalificado (CRM).');
  }
  const linkId = rid();
  const invId = rid();
  const secret = rid();
  const now = new Date().toISOString();
  const title = `Calificación formal Loong — ${c.clientName}`;

  const inv: Record<string, unknown> = {
    id: invId,
    clientId: c.vendedorUid,
    requestedBy: vendorUid,
    status: 'IN_PROGRESS',
    title,
    details: `Originación Loong · expediente ${c.id} · calificación formal (candidato).`,
    clientProfile: 'LOONG_MOTOR',
    investigationType: 'LOONG_MOTOR',
    investigationScope: 'LOONG_FORMAL_QUAL',
    candidateEmail: c.clientEmail,
    candidatePhone: c.clientPhone || '',
    createdAt: now,
    updatedAt: now,
    linkStatus: 'PENDING',
    loongOriginationCaseId: c.id,
  };
  if (organizationId) inv.organizationId = organizationId;
  await setDoc(doc(db, 'investigations', invId), inv);

  const link: Record<string, unknown> = {
    linkId,
    investigationId: invId,
    clientId: c.vendedorUid,
    clientProfile: 'LOONG_MOTOR',
    investigationType: 'LOONG_MOTOR',
    investigationScope: 'LOONG_FORMAL_QUAL',
    title,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
    loongOriginationCaseId: c.id,
    loongCaseAdvanceSecret: secret,
  };
  if (organizationId) link.organizationId = organizationId;
  await setDoc(doc(db, 'candidate_links', linkId), link);

  const hist: LoongOriginationHistoryEntry[] = [
    ...(c.history || []),
    { at: now, byUid: vendorUid, action: 'Enlace calificación formal emitido', note: linkId },
  ];
  await updateDoc(doc(db, 'loong_origination_cases', c.id), {
    originationStage: 'ENLACE_CALIFICACION',
    formalQualLinkId: linkId,
    formalQualInvestigationId: invId,
    formalQualAdvanceSecret: secret,
    updatedAt: now,
    history: hist,
  });

  return { linkId, investigationId: invId };
}

/** Tras calificación formal OK: investigación de arraigo (mismo flujo UI que RRHH en CandidateFlow). */
export async function issueArraigoInvestigationLink(
  db: Firestore,
  c: LoongOriginationCase,
  vendorUid: string,
  organizationId: string | null | undefined
): Promise<{ linkId: string; investigationId: string }> {
  const newFlowOk = c.originationStage === 'MESA_INTAKE_OK';
  const legacyAfterFormal =
    c.originationStage === 'CALIFICACION_FORMAL_OK' && c.formalQualPassed !== false;
  if (!newFlowOk && !legacyAfterFormal) {
    throw new Error(
      'Emite arraigo cuando mesa haya aprobado el intake, o (expediente antiguo) tras calificación formal aprobada.'
    );
  }
  const linkId = rid();
  const invId = rid();
  const now = new Date().toISOString();
  const title = `Investigación de arraigo — ${c.clientName} (Loong)`;

  const inv: Record<string, unknown> = {
    id: invId,
    clientId: c.vendedorUid,
    requestedBy: vendorUid,
    status: 'PENDING',
    title,
    details: `Arraigo vinculado a originación Loong ${c.id}. Visita y evidencias como investigación RRHH.`,
    clientProfile: 'HR',
    investigationType: 'HR',
    investigationScope: 'INTEGRAL',
    jobProfile: `Arraigo moto · ${c.modeloMoto || '—'} · ${c.clientEmail}`,
    candidateEmail: c.clientEmail,
    candidatePhone: c.clientPhone || '',
    smartValidationRequested: true,
    createdAt: now,
    updatedAt: now,
    linkStatus: 'PENDING',
    loongOriginationCaseId: c.id,
  };
  if (organizationId) inv.organizationId = organizationId;
  await setDoc(doc(db, 'investigations', invId), inv);

  const link: Record<string, unknown> = {
    linkId,
    investigationId: invId,
    clientId: c.vendedorUid,
    clientProfile: 'HR',
    investigationType: 'HR',
    investigationScope: 'INTEGRAL',
    title,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
    loongOriginationCaseId: c.id,
  };
  if (organizationId) link.organizationId = organizationId;
  await setDoc(doc(db, 'candidate_links', linkId), link);

  const hist: LoongOriginationHistoryEntry[] = [
    ...(c.history || []),
    { at: now, byUid: vendorUid, action: 'Enlace investigación arraigo (RRHH)', note: linkId },
  ];
  await updateDoc(doc(db, 'loong_origination_cases', c.id), {
    originationStage: 'INVESTIGACION_ARRAIGO',
    arraigoLinkId: linkId,
    arraigoInvestigationId: invId,
    linkedInvestigationId: invId,
    updatedAt: now,
    history: hist,
  });

  return { linkId, investigationId: invId };
}
