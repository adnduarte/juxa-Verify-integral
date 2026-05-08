import { doc, getDoc } from '@/lib/localFirestore';
import type { Firestore } from 'firebase/firestore';
import type { CreditAiRules } from '../types/saas';

function simpleFingerprint(parts: string[]): string {
  const s = parts.filter(Boolean).join('||');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `fp_${Math.abs(h).toString(36)}_${parts.filter((p) => p && p.trim()).length}`;
}

export interface MergedCreditAiRules {
  /** Texto listo para el motor de rubro inicial (org + agencia). */
  mergedTextForInitialRubric: string;
  /** Texto listo para análisis completo (estudio integral). */
  mergedTextForFullAnalysis: string;
  /** Compatibilidad con prompts que usan solo `politicasGenerales`. */
  mergedPoliticasGenerales: string;
  fingerprint: string;
  orgRules?: CreditAiRules;
}

/**
 * Orden: marco organización (Juxa) primero; luego políticas de la cuenta agencia (`clients`).
 */
export function mergeCreditAiRules(
  orgRules: CreditAiRules | undefined,
  politicasGenerales?: string,
  creditPolicies?: string
): MergedCreditAiRules {
  const o = orgRules || {};
  const agencyPoliticas = politicasGenerales?.trim() || '';
  const agencyCredit = creditPolicies?.trim() || '';

  const mergedPoliticasGenerales = [
    '--- MARCO ORGANIZACIÓN (Juxa / programa) ---',
    o.politicasGenerales?.trim() || '',
    '',
    '--- POLÍTICAS CUENTA AGENCIA ---',
    agencyPoliticas,
    agencyCredit ? `\nDetalle producto crédito agencia:\n${agencyCredit}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const mergedTextForInitialRubric = [
    '### Rubro inicial (originación)\n',
    o.initialRubric?.trim() || '',
    '\n### Marco y políticas aplicables\n',
    mergedPoliticasGenerales,
  ].join('\n');

  const mergedTextForFullAnalysis = [
    '### Análisis integral / dictamen\n',
    o.fullAnalysis?.trim() || '',
    '\n### Marco completo\n',
    mergedPoliticasGenerales,
  ].join('\n');

  const fingerprint = simpleFingerprint([
    o.initialRubric || '',
    o.fullAnalysis || '',
    o.politicasGenerales || '',
    o.creditPolicies || '',
    agencyPoliticas,
    agencyCredit,
  ]);

  return {
    mergedTextForInitialRubric,
    mergedTextForFullAnalysis,
    mergedPoliticasGenerales,
    fingerprint,
    orgRules: o,
  };
}

export async function loadMergedCreditAiRules(
  db: Firestore,
  organizationId: string | null | undefined,
  clientId: string | null | undefined
): Promise<MergedCreditAiRules> {
  const oid = organizationId?.trim() || 'default';
  let orgRules: CreditAiRules | undefined;
  try {
    const orgSnap = await getDoc(doc(db, 'organizations', oid));
    if (orgSnap.exists()) {
      const d = orgSnap.data() as { creditAiRules?: CreditAiRules };
      orgRules = d.creditAiRules;
    }
  } catch {
    orgRules = undefined;
  }

  let politicasGenerales = '';
  let creditPolicies = '';
  if (clientId) {
    try {
      const clientSnap = await getDoc(doc(db, 'clients', clientId));
      if (clientSnap.exists()) {
        const cd = clientSnap.data() as { politicasGenerales?: string; creditPolicies?: string };
        politicasGenerales = cd.politicasGenerales || '';
        creditPolicies = cd.creditPolicies || '';
      }
    } catch {
      /* ignore */
    }
  }

  return mergeCreditAiRules(orgRules, politicasGenerales, creditPolicies);
}
