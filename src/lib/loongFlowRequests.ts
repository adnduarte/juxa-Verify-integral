/**
 * Flujo precal vendedor → candidato → mesa:
 * `issueStandaloneLoongPrecalLink` crea `investigations` + `candidate_links` con el mismo `investigationId`.
 * El candidato actualiza ambos al enviar; `mesaPrecalStatus: pending` pone el caso en cola de mesa (ver `LoongMesaPrecalQueuePanel`).
 */
import { collection, doc, getDocs, query, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';
import { DEFAULT_ORGANIZATION_ID_LOONG, normalizeOrganizationId } from './organizations';
import type { LoongOriginationCase } from './loongOrigination';
import {
  candidateUrlForLink,
  issueArraigoInvestigationLink,
  issueFormalQualificationLink,
} from './loongPipelineLinks';

export type LoongFlowIntent =
  | 'precal_completo'
  | 'calificacion_formal'
  | 'investigacion_arraigo'
  | 'flujo_prueba'
  | 'otro';

export type LoongFlowRequest = {
  id: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string | null;
  requestedByUid: string;
  requestedByEmail?: string;
  requesterRole: string;
  title: string;
  notes: string;
  intent: LoongFlowIntent;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  caseId?: string | null;
  clientName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateCurp?: string;
  candidateRfc?: string;
  resolvedInvestigationId?: string;
  resolvedLinkId?: string;
  resolvedAt?: string;
  resolvedByUid?: string;
};

function rid() {
  return crypto.randomUUID();
}

export async function submitLoongFlowRequest(
  db: Firestore,
  input: {
    organizationId: string | null;
    requestedByUid: string;
    requestedByEmail?: string | null;
    requesterRole: string;
    title: string;
    notes: string;
    intent: LoongFlowIntent;
    caseId?: string | null;
    clientName?: string;
    candidateEmail?: string;
    candidatePhone?: string;
  }
): Promise<string> {
  const id = rid();
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    id,
    createdAt: now,
    updatedAt: now,
    organizationId: normalizeOrganizationId(input.organizationId),
    requestedByUid: input.requestedByUid,
    requesterRole: input.requesterRole,
    title: input.title.trim(),
    notes: (input.notes || '').trim(),
    intent: input.intent,
    status: 'OPEN',
  };
  if (input.requestedByEmail) payload.requestedByEmail = input.requestedByEmail;
  if (input.caseId) payload.caseId = input.caseId;
  if (input.clientName) payload.clientName = input.clientName;
  if (input.candidateEmail) payload.candidateEmail = input.candidateEmail;
  if (input.candidatePhone) payload.candidatePhone = input.candidatePhone;
  await setDoc(doc(db, 'loong_flow_requests', id), payload);
  return id;
}

/**
 * Registro en historial del vendedor: cada «Generar enlace» debe crear un documento para «Mis solicitudes recientes».
 * (Antes solo se creaba la investigación y el candidate_link, sin fila en loong_flow_requests.)
 */
export async function recordVendorStandalonePrecalIssued(
  db: Firestore,
  input: {
    title: string;
    organizationId: string | null | undefined;
    requestedByUid: string;
    requesterRole: string;
    investigationId: string;
    linkId: string;
    clientName?: string | null;
    candidateEmail?: string | null;
    candidatePhone?: string | null;
    candidateCurp?: string | null;
    candidateRfc?: string | null;
    notes?: string | null;
  }
): Promise<string> {
  const id = rid();
  const now = new Date().toISOString();
  const org = normalizeOrganizationId(input.organizationId) ?? DEFAULT_ORGANIZATION_ID_LOONG;
  const payload: Record<string, unknown> = {
    id,
    createdAt: now,
    updatedAt: now,
    organizationId: org,
    requestedByUid: input.requestedByUid,
    requesterRole: input.requesterRole,
    title: input.title.trim(),
    notes: (input.notes || '').trim(),
    intent: 'precal_completo' as const,
    status: 'DONE',
    resolvedInvestigationId: input.investigationId,
    resolvedLinkId: input.linkId,
    resolvedAt: now,
    resolvedByUid: input.requestedByUid,
  };
  if (input.clientName?.trim()) payload.clientName = input.clientName.trim();
  if (input.candidateEmail?.trim()) payload.candidateEmail = String(input.candidateEmail).trim().toLowerCase();
  if (input.candidatePhone?.trim()) payload.candidatePhone = input.candidatePhone.trim();
  if (input.candidateCurp?.trim()) payload.candidateCurp = input.candidateCurp.trim().toUpperCase();
  if (input.candidateRfc?.trim()) payload.candidateRfc = input.candidateRfc.trim().toUpperCase();
  await setDoc(doc(db, 'loong_flow_requests', id), payload);
  return id;
}

export async function fetchOpenLoongFlowRequests(db: Firestore): Promise<LoongFlowRequest[]> {
  const q = query(collection(db, 'loong_flow_requests'), where('status', '==', 'OPEN'));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as LoongFlowRequest[];
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list;
}

export async function fetchMyLoongFlowRequests(db: Firestore, uid: string): Promise<LoongFlowRequest[]> {
  const q = query(collection(db, 'loong_flow_requests'), where('requestedByUid', '==', uid));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as LoongFlowRequest[];
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list.slice(0, 200);
}

export async function markLoongFlowRequestDone(
  db: Firestore,
  requestId: string,
  resolvedByUid: string,
  resolution: {
    investigationId?: string;
    linkId?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'loong_flow_requests', requestId), {
    status: 'DONE',
    updatedAt: now,
    resolvedAt: now,
    resolvedByUid,
    ...(resolution.investigationId ? { resolvedInvestigationId: resolution.investigationId } : {}),
    ...(resolution.linkId ? { resolvedLinkId: resolution.linkId } : {}),
  });
}

/**
 * Crea investigación + candidate_link tipo precal Loong (mismo shape que el simulador admin).
 * testMode: clientId admin_simulator (solo pruebas). Si false, clientId = clientIdForInv (p. ej. quien solicitó).
 */
export async function issueStandaloneLoongPrecalLink(
  db: Firestore,
  opts: {
    title: string;
    testMode: boolean;
    clientIdForInv: string;
    organizationId: string | null | undefined;
    requestedByUidForAudit: string;
    candidateEmail?: string | null;
    candidatePhone?: string | null;
    /** Nombre del prospecto (vendedor); va a contactInfo para lectura rápida en mesa. */
    prospectDisplayName?: string | null;
    /** Notas internas del vendedor (contexto para mesa). */
    vendorNotes?: string | null;
    candidateCurp?: string | null;
    candidateRfc?: string | null;
    prefill?: {
      modeloMoto?: string;
      precioMoto?: number;
    };
  }
): Promise<{ linkId: string; investigationId: string; url: string }> {
  const invId = rid();
  const linkId = rid();
  const now = new Date().toISOString();
  const clientId = opts.testMode ? 'admin_simulator' : opts.clientIdForInv;
  /** Siempre persistir tenant Loong en precal; si no, admin/mesa filtran por org y no ven al vendedor. */
  const orgNorm = normalizeOrganizationId(opts.organizationId) ?? DEFAULT_ORGANIZATION_ID_LOONG;

  const detailLines: string[] = ['=== Captura inicial (vendedor) ==='];
  if (opts.prospectDisplayName?.trim()) {
    detailLines.push(`Prospecto: ${opts.prospectDisplayName.trim()}`);
  }
  if (opts.candidatePhone?.trim()) {
    detailLines.push(`Tel. indicado: ${opts.candidatePhone.trim()}`);
  }
  if (opts.candidateEmail?.trim()) {
    detailLines.push(`Correo indicado: ${String(opts.candidateEmail).trim()}`);
  }
  if (opts.vendorNotes?.trim()) {
    detailLines.push(`Notas: ${opts.vendorNotes.trim()}`);
  }
  const curpNorm = opts.candidateCurp?.trim() ? opts.candidateCurp.trim().toUpperCase() : '';
  const rfcNorm = opts.candidateRfc?.trim() ? opts.candidateRfc.trim().toUpperCase() : '';
  if (curpNorm) {
    detailLines.push(`CURP: ${curpNorm}`);
  }
  if (rfcNorm) {
    detailLines.push(`RFC: ${rfcNorm}`);
  }
  const detailsBlock = detailLines.length > 1 ? detailLines.join('\n') : '';

  const inv: Record<string, unknown> = {
    id: invId,
    clientId,
    requestedBy: opts.requestedByUidForAudit,
    status: 'PENDING',
    title: opts.title,
    clientProfile: 'LOONG_MOTOR',
    investigationType: 'LOONG_MOTOR',
    investigationScope: 'LOONG_PRECAL',
    candidateLink: linkId,
    tipoCredito: 'Crédito moto Loong Motor',
    montoCreditoCapital: 0,
    montoCreditoIntereses: 0,
    plazoFinanciamiento: 'Por definir',
    createdAt: now,
    updatedAt: now,
  };
  inv.organizationId = orgNorm;
  if (opts.candidateEmail) inv.candidateEmail = String(opts.candidateEmail).toLowerCase();
  if (opts.candidatePhone) inv.candidatePhone = String(opts.candidatePhone);
  if (curpNorm) inv.candidateCurp = curpNorm;
  if (rfcNorm) inv.candidateRfc = rfcNorm;
  if (opts.prospectDisplayName?.trim()) inv.contactInfo = opts.prospectDisplayName.trim();
  if (detailsBlock) inv.details = detailsBlock;

  const link: Record<string, unknown> = {
    linkId,
    investigationId: invId,
    clientId,
    clientProfile: 'LOONG_MOTOR',
    investigationType: 'LOONG_MOTOR',
    investigationScope: 'LOONG_PRECAL',
    title: opts.title,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };
  link.organizationId = orgNorm;
  if (opts.candidateEmail) link.candidateEmail = String(opts.candidateEmail).toLowerCase();
  if (opts.candidatePhone) link.candidatePhone = String(opts.candidatePhone);
  if (opts.prefill?.modeloMoto) link.prefillModeloMoto = String(opts.prefill.modeloMoto).trim();
  if (typeof opts.prefill?.precioMoto === 'number' && Number.isFinite(opts.prefill.precioMoto) && opts.prefill.precioMoto > 0) {
    link.prefillPrecioMoto = opts.prefill.precioMoto;
  }

  await setDoc(doc(db, 'investigations', invId), inv);
  await setDoc(doc(db, 'candidate_links', linkId), link);

  return {
    investigationId: invId,
    linkId,
    url: candidateUrlForLink(linkId),
  };
}

export async function resolveLoongFlowRequestWithCase(
  db: Firestore,
  req: LoongFlowRequest,
  loongCase: LoongOriginationCase,
  actingUid: string,
  organizationId: string | null | undefined
): Promise<{ linkId: string; investigationId: string; kind: 'formal' | 'arraigo' }> {
  if (req.intent === 'calificacion_formal') {
    const { linkId, investigationId } = await issueFormalQualificationLink(db, loongCase, actingUid, organizationId);
    return { linkId, investigationId, kind: 'formal' };
  }
  if (req.intent === 'investigacion_arraigo') {
    const { linkId, investigationId } = await issueArraigoInvestigationLink(db, loongCase, actingUid, organizationId);
    return { linkId, investigationId, kind: 'arraigo' };
  }
  throw new Error('Este tipo de solicitud necesita un expediente en la etapa correcta o usa «enlace precal».');
}
