import { type Firestore, doc, getDoc } from 'firebase/firestore';
import { mergeLoongPolicy, mergeLoongPolicyOnto, type LoongMotorCreditPolicy } from './loongMotorCredit';
import {
  DEFAULT_LOONG_OPERATIONAL_RULES,
  mergeLoongOperationalOnto,
  mergeLoongOperationalRules,
  type LoongOperationalRules,
} from './loongOperationalRules';
import {
  DEFAULT_LOONG_ANALYSIS_NARRATIVE_MOTOS,
  buildLoongMotorOriginationPromptAppendix,
} from './loongMotorAnalysisPrompt';

/** Mismo documento que edita el admin global en Loong Motor (demo / fallback). */
export const LOONG_MOTOR_POLICY_CLIENT_ID = 'admin_simulator' as const;

/** Superadmin: defaults de plataforma y narrativa IA segmento motos. */
export const PLATFORM_LOONG_POLICY_COLLECTION = 'platform_policy' as const;
export const PLATFORM_LOONG_POLICY_DOC_ID = 'loong_motor' as const;

export type PlatformLoongPolicyDoc = {
  loongMotorCreditPolicy?: Partial<LoongMotorCreditPolicy>;
  loongOperationalRules?: Partial<LoongOperationalRules>;
  loongAnalysisNarrativeMotos?: string;
  updatedAt?: string;
};

export type PersonalLoongPolicyBundle = {
  loongMotorCreditPolicy?: Partial<LoongMotorCreditPolicy>;
  loongOperationalRules?: Partial<LoongOperationalRules>;
};

/** Campo en `users/{uid}` — JSON del bundle personal (solo afecta a quien lo edita). */
export const USER_PERSONAL_LOONG_POLICY_FIELD = 'personalLoongPolicyBundleJson' as const;

/** Documento en `clients/{id}`: para resolución por capas se usa org luego global. */
export function resolveLoongClientsDocIds(organizationId?: string | null): string[] {
  const ids: string[] = [];
  if (organizationId && String(organizationId).trim()) ids.push(String(organizationId).trim());
  if (!ids.includes(LOONG_MOTOR_POLICY_CLIENT_ID)) ids.push(LOONG_MOTOR_POLICY_CLIENT_ID);
  return ids;
}

async function readPlatformLoongLayer(db: Firestore): Promise<PlatformLoongPolicyDoc> {
  try {
    const snap = await getDoc(doc(db, PLATFORM_LOONG_POLICY_COLLECTION, PLATFORM_LOONG_POLICY_DOC_ID));
    if (!snap.exists()) return {};
    return snap.data() as PlatformLoongPolicyDoc;
  } catch {
    return {};
  }
}

async function readPersonalLoongBundle(
  db: Firestore,
  uid: string | null | undefined
): Promise<PersonalLoongPolicyBundle | null> {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const raw = snap.data()[USER_PERSONAL_LOONG_POLICY_FIELD];
    if (typeof raw !== 'string' || !raw.trim()) return null;
    return JSON.parse(raw) as PersonalLoongPolicyBundle;
  } catch {
    return null;
  }
}

/**
 * Resolución en capas:
 * 1) Defaults código
 * 2) `platform_policy/loong_motor` (superadmin — estructura / narrativa)
 * 3) `clients/admin_simulator` (plantilla global)
 * 4) `clients/{organizationId}` (admin organización — originación/cobranza oficiales)
 * 5) Opcional: bundle personal en `users/{uid}` (simuladores / vista del usuario, sin cambiar política org)
 */
export async function resolveLoongMotorPolicies(
  db: Firestore,
  opts: {
    organizationId?: string | null;
    actingUserId?: string | null;
    applyPersonalOverrides?: boolean;
  }
): Promise<{
  creditPolicy: LoongMotorCreditPolicy;
  operationalRules: LoongOperationalRules;
  platformNarrative: string;
}> {
  const platform = await readPlatformLoongLayer(db);

  let creditPolicy = mergeLoongPolicy(null);
  creditPolicy = mergeLoongPolicyOnto(creditPolicy, platform.loongMotorCreditPolicy);

  let operationalRules = mergeLoongOperationalRules(null);
  operationalRules = mergeLoongOperationalOnto(operationalRules, platform.loongOperationalRules);

  const orgId = opts.organizationId && String(opts.organizationId).trim() ? String(opts.organizationId).trim() : null;

  try {
    const globalSnap = await getDoc(doc(db, 'clients', LOONG_MOTOR_POLICY_CLIENT_ID));
    if (globalSnap.exists()) {
      const gd = globalSnap.data();
      if (gd.loongMotorCreditPolicy) creditPolicy = mergeLoongPolicyOnto(creditPolicy, gd.loongMotorCreditPolicy);
      if (gd.loongOperationalRules) operationalRules = mergeLoongOperationalOnto(operationalRules, gd.loongOperationalRules);
    }
  } catch {
    /* Sin permisos / otro proyecto: el enlace candidato sigue con defaults + capa platform. */
  }

  if (orgId && orgId !== LOONG_MOTOR_POLICY_CLIENT_ID) {
    try {
      const orgSnap = await getDoc(doc(db, 'clients', orgId));
      if (orgSnap.exists()) {
        const od = orgSnap.data();
        if (od.loongMotorCreditPolicy) creditPolicy = mergeLoongPolicyOnto(creditPolicy, od.loongMotorCreditPolicy);
        if (od.loongOperationalRules) operationalRules = mergeLoongOperationalOnto(operationalRules, od.loongOperationalRules);
      }
    } catch {
      /* Igual que arriba: no bloquear precalificación pública. */
    }
  }

  if (opts.applyPersonalOverrides) {
    const personal = await readPersonalLoongBundle(db, opts.actingUserId ?? null);
    if (personal?.loongMotorCreditPolicy) {
      creditPolicy = mergeLoongPolicyOnto(creditPolicy, personal.loongMotorCreditPolicy);
    }
    if (personal?.loongOperationalRules) {
      operationalRules = mergeLoongOperationalOnto(operationalRules, personal.loongOperationalRules);
    }
  }

  const platformNarrative =
    typeof platform.loongAnalysisNarrativeMotos === 'string' && platform.loongAnalysisNarrativeMotos.trim()
      ? platform.loongAnalysisNarrativeMotos.trim()
      : DEFAULT_LOONG_ANALYSIS_NARRATIVE_MOTOS;

  return { creditPolicy, operationalRules, platformNarrative };
}

/** Política oficial para precalificación / enlaces candidato (sin overrides personales). */
export async function getLoongMotorCreditPolicyFromFirestore(
  db: Firestore,
  organizationId?: string | null
): Promise<LoongMotorCreditPolicy> {
  const { creditPolicy } = await resolveLoongMotorPolicies(db, {
    organizationId,
    applyPersonalOverrides: false,
  });
  return creditPolicy;
}

export async function getLoongOperationalRulesFromFirestore(
  db: Firestore,
  organizationId?: string | null
): Promise<LoongOperationalRules> {
  const { operationalRules } = await resolveLoongMotorPolicies(db, {
    organizationId,
    applyPersonalOverrides: false,
  });
  return operationalRules;
}

/** Precal / CRM con ajustes del usuario en su perfil (no altera política de la organización en Firestore). */
export async function getLoongMotorCreditPolicyForActingUser(
  db: Firestore,
  organizationId: string | null | undefined,
  actingUserId: string | null | undefined
): Promise<LoongMotorCreditPolicy> {
  const { creditPolicy } = await resolveLoongMotorPolicies(db, {
    organizationId,
    actingUserId,
    applyPersonalOverrides: true,
  });
  return creditPolicy;
}

export async function getLoongOperationalRulesForActingUser(
  db: Firestore,
  organizationId: string | null | undefined,
  actingUserId: string | null | undefined
): Promise<LoongOperationalRules> {
  const { operationalRules } = await resolveLoongMotorPolicies(db, {
    organizationId,
    actingUserId,
    applyPersonalOverrides: true,
  });
  return operationalRules;
}

export async function buildLoongMotorOfficialAnalysisInjection(
  db: Firestore,
  organizationId?: string | null
): Promise<string> {
  const { creditPolicy, operationalRules, platformNarrative } = await resolveLoongMotorPolicies(db, {
    organizationId,
    applyPersonalOverrides: false,
  });
  return buildLoongMotorOriginationPromptAppendix(creditPolicy, operationalRules, platformNarrative);
}
