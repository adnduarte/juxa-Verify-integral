import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from '@/lib/localFirestore';
import {
  createFordAgencyOrganization,
  FORD_PROGRAM_ROOT_ORG_ID,
  normalizeFordAgencySlug,
} from './fordOrganizationProvisioning';
import type { FordAgencyOnboardingRequestDoc } from '../types/fordAgencyOnboarding';

export const FORD_AGENCY_ONBOARDING_COLLECTION = 'ford_agency_onboarding_requests';

export class FordAgencyOnboardingError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'FordAgencyOnboardingError';
  }
}

function onboardingRef(db: unknown, requestId: string) {
  return doc(db as never, FORD_AGENCY_ONBOARDING_COLLECTION, requestId);
}

export async function submitFordAgencyProposal(
  db: unknown,
  params: { slug: string; displayName: string; note?: string },
  proposer: { uid: string; email: string | null }
): Promise<{ requestId: string }> {
  const proposedOrganizationId = normalizeFordAgencySlug(params.slug);
  const proposedDisplayName = params.displayName.trim();
  if (!proposedOrganizationId || !proposedDisplayName) {
    throw new FordAgencyOnboardingError('Nombre y slug son obligatorios', 'INVALID_INPUT');
  }

  const orgRef = doc(db as never, 'organizations', proposedOrganizationId);
  const orgSnap = await getDoc(orgRef);
  if (orgSnap.exists()) {
    throw new FordAgencyOnboardingError('Ya existe una organización con ese identificador', 'ORG_EXISTS');
  }

  const dupQ = query(
    collection(db as never, FORD_AGENCY_ONBOARDING_COLLECTION),
    where('proposedOrganizationId', '==', proposedOrganizationId),
    where('status', '==', 'PENDING')
  );
  const dupSnap = await getDocs(dupQ);
  if (!dupSnap.empty) {
    throw new FordAgencyOnboardingError('Ya hay una solicitud pendiente con ese slug', 'DUPLICATE_PENDING');
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    programVertical: 'FORD_CREDIT_MX',
    programRootOrganizationId: FORD_PROGRAM_ROOT_ORG_ID,
    proposedOrganizationId,
    proposedDisplayName,
    status: 'PENDING',
    proposalNote: params.note?.trim() || null,
    createdAt: now,
    updatedAt: now,
    proposedByUid: proposer.uid,
    proposedByEmail: proposer.email,
  };

  const created = await addDoc(collection(db as never, FORD_AGENCY_ONBOARDING_COLLECTION), payload);
  const requestId = (created as { id: string }).id;
  return { requestId };
}

export async function approveFordAgencyProposal(
  db: unknown,
  requestId: string,
  reviewer: { uid: string; email: string | null }
): Promise<{ organizationId: string }> {
  const ref = onboardingRef(db, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new FordAgencyOnboardingError('Solicitud no encontrada', 'NOT_FOUND');
  }
  const data = snap.data() as FordAgencyOnboardingRequestDoc;
  if (data.status !== 'PENDING') {
    throw new FordAgencyOnboardingError('La solicitud ya fue resuelta', 'INVALID_STATE');
  }
  if (data.proposedByUid === reviewer.uid) {
    throw new FordAgencyOnboardingError(
      'No puede aprobar su propia solicitud (cuatro ojos / segregación de funciones)',
      'FOUR_EYES_SELF_APPROVAL'
    );
  }

  const orgRef = doc(db as never, 'organizations', data.proposedOrganizationId);
  const orgSnap = await getDoc(orgRef);
  if (orgSnap.exists()) {
    throw new FordAgencyOnboardingError(
      'La organización ya existe; rechace la solicitud como duplicada',
      'ORG_EXISTS'
    );
  }

  const { id } = await createFordAgencyOrganization(db, {
    slug: data.proposedOrganizationId,
    displayName: data.proposedDisplayName,
  });

  const now = new Date().toISOString();
  await updateDoc(ref, {
    status: 'APPROVED',
    updatedAt: now,
    reviewedAt: now,
    reviewedByUid: reviewer.uid,
    reviewedByEmail: reviewer.email,
    createdOrganizationId: id,
    rejectionReason: null,
  });

  return { organizationId: id };
}

export async function rejectFordAgencyProposal(
  db: unknown,
  requestId: string,
  reviewer: { uid: string; email: string | null },
  reason: string
): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new FordAgencyOnboardingError('Indique el motivo del rechazo', 'INVALID_INPUT');
  }

  const ref = onboardingRef(db, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new FordAgencyOnboardingError('Solicitud no encontrada', 'NOT_FOUND');
  }
  const data = snap.data() as FordAgencyOnboardingRequestDoc;
  if (data.status !== 'PENDING') {
    throw new FordAgencyOnboardingError('La solicitud ya fue resuelta', 'INVALID_STATE');
  }
  if (data.proposedByUid === reviewer.uid) {
    throw new FordAgencyOnboardingError(
      'Otro usuario con rol Dirección debe registrar el rechazo (cuatro ojos)',
      'FOUR_EYES_SELF_REVIEW'
    );
  }

  const now = new Date().toISOString();
  await updateDoc(ref, {
    status: 'REJECTED',
    updatedAt: now,
    reviewedAt: now,
    reviewedByUid: reviewer.uid,
    reviewedByEmail: reviewer.email,
    rejectionReason: trimmed,
    createdOrganizationId: null,
  });
}
