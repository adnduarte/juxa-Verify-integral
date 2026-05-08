/**
 * SaaS multi-tenant, marca blanca y flags de producto (plan maestro).
 */

export type SaaSProduct =
  | 'socioeconomic'
  | 'hr_mx'
  | 'credit_origination'
  | 'b2b_collections'
  | 'supplier_compliance'
  | 'field_network'
  | 'identity_antiusurp';

export interface TenantFeatureFlags {
  socioeconomicStudies: boolean;
  hrSuiteMexico: boolean;
  creditOrigination: boolean;
  b2bCollections: boolean;
  supplierCompliance: boolean;
  fieldNetwork: boolean;
  identityAntiUsurpation: boolean;
  digidSignatures: boolean;
}

export const defaultTenantFeatures: TenantFeatureFlags = {
  socioeconomicStudies: true,
  hrSuiteMexico: true,
  creditOrigination: true,
  b2bCollections: true,
  supplierCompliance: true,
  fieldNetwork: true,
  identityAntiUsurpation: true,
  digidSignatures: true,
};

export interface TenantBranding {
  appName: string;
  primaryColor: string;
  logoUrl?: string;
  legalFooter?: string;
}

/** Vertical comercial (partner); NONE = producto Juxa Verify general */
export type PartnerVertical = 'NONE' | 'FORD_CREDIT_MX';

/** Reglas de IA para originación (marco Juxa por organización; la agencia puede afinar vía `clients/{uid}`). */
export interface CreditAiRules {
  politicasGenerales?: string;
  /** Prompt específico del rubro inicial (usurpación, DTI, documental MX). */
  initialRubric?: string;
  /** Prompt para dictamen / estudio socioeconómico completo (fases avanzadas). */
  fullAnalysis?: string;
  creditPolicies?: string;
}

export interface OrganizationDoc {
  id: string;
  name: string;
  /** Revendedor marca blanca (null = tenant raíz) */
  parentOrganizationId?: string | null;
  branding: TenantBranding;
  features: TenantFeatureFlags;
  creditAiRules?: CreditAiRules;
  /** Red de agencias / programa OEM (ej. Ford Crédito México) */
  partnerVertical?: PartnerVertical;
  /** Mesa central del programa: ve todos los expedientes de la vertical */
  fordProgramRoot?: boolean;
  /** Límites soft para UI / enforcement futuro */
  limits?: {
    maxUsers?: number;
    investigationsPerMonth?: number;
    signaturesPerMonth?: number;
  };
  createdAt: string;
  updatedAt: string;
}

/** Expediente originación / investigación (subset documentado para queries) */
export interface InvestigationDocCore {
  clientId?: string;
  organizationId?: string;
  /** Vertical cuando aplica (ej. Ford Crédito MX); redundante con clientProfile para índices */
  vertical?: 'FORD_CREDIT_MX';
  clientProfile?: string;
  creditPipelineStage?: CreditPipelineStage;
  identityPreAnalysis?: AntiUsurpationResult;
  initialRubricAnalysis?: InitialRubricAnalysis;
  mesaReturnReason?: string;
  /** Requisitos estructurados devueltos por mesa (checklist F&amp;I). */
  mesaReturnItems?: string[];
  /** Cargas de la agencia ante devolución de mesa. */
  agencyFollowUps?: AgencyFollowUpEntry[];
  /** Referencia operativa / número de contrato (cuando exista en originación o colocación) */
  contractReference?: string;
  /** Entidad federativa (código recomendado: AGU, CMX, JAL, … ver `mexicoEntityStates`) */
  entityState?: string;
}

export type CreditPipelineStage =
  | 'PRE_QUALIFICATION'
  | 'MESA_CONTROL'
  | 'RETURN_TO_AGENCY'
  | 'ANALYSIS'
  | 'CONDITIONS'
  | 'PLACEMENT'
  | 'SIGNED_CLOSED';

export type SupplierVerificationStep =
  | 'INTAKE'
  | 'DOCUMENTS'
  | 'LIST_CHECKS'
  | 'FIELD_VISIT'
  | 'SCORING'
  | 'COMPLIANCE_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type FieldVisitPurpose = 'INVESTIGATION' | 'COLLECTION' | 'SUPPLIER_VERIFY' | 'ADDON_SERVICE';

export interface FieldVisitDoc {
  id: string;
  organizationId: string;
  investigationId?: string;
  portfolioId?: string;
  assignedToUid: string;
  purpose: FieldVisitPurpose;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISPUTED';
  scheduledAt?: string;
  completedAt?: string;
  geoCheckIn?: { lat: number; lng: number; at: string };
  evidenceUrls?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DigidSignatureRequestDoc {
  id: string;
  organizationId: string;
  /** investigation | credit_app | hr_contract | supplier */
  contextType: string;
  contextId: string;
  status: 'PENDING' | 'SENT' | 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'MOCK';
  digidEnvelopeId?: string;
  lastWebhookAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AntiUsurpationResult {
  riskScore: number;
  factors: string[];
  recommendation: 'PASS' | 'REVIEW' | 'BLOCK';
  checkedAt: string;
}

/** Indicios operativos sobre documentos digitales (México); no es dictamen pericial judicial. */
export interface DigitalDocumentForensicsMx {
  summary: string;
  indicativeFindings: string[];
  confidenceNotes: string;
}

export interface DtiInitialAnalysis {
  ingresoMensualDeclarado: number | null;
  gastosMensualesDeclarados: number | null;
  deudaMensualEstimada: number | null;
  dtiRatio: number | null;
  dtiFormulaNote: string;
  flags: string[];
}

/** Rubro inicial unificado al primer envío de originación automotriz. */
export interface InitialRubricAnalysis {
  identityUsurpation: AntiUsurpationResult;
  digitalDocumentForensicsMx: DigitalDocumentForensicsMx;
  dtiInitial: DtiInitialAnalysis;
  rubricGate: 'PASS' | 'REVIEW' | 'BLOCK';
  validationSummary: string;
  generatedAt: string;
  rulesFingerprint: string;
}

export interface AgencyFollowUpEntry {
  at: string;
  note?: string;
  fileUrls: string[];
  submittedByUid?: string;
}
