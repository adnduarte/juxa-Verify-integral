export type FordAgencyOnboardingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Documento en `ford_agency_onboarding_requests/{id}` — alta de agencia con doble autorización. */
export interface FordAgencyOnboardingRequestDoc {
  programVertical: 'FORD_CREDIT_MX';
  programRootOrganizationId: 'ford-credit-mx';
  /** Slug / id Firestore propuesto para `organizations/{proposedOrganizationId}` */
  proposedOrganizationId: string;
  proposedDisplayName: string;
  status: FordAgencyOnboardingStatus;
  proposalNote?: string | null;
  createdAt: string;
  updatedAt: string;
  proposedByUid: string;
  proposedByEmail: string | null;
  reviewedByUid?: string | null;
  reviewedByEmail?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdOrganizationId?: string | null;
}
