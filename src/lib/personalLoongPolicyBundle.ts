import type { PersonalLoongPolicyBundle } from './loongMotorPolicyFirestore';

const EXAMPLE: PersonalLoongPolicyBundle = {
  loongMotorCreditPolicy: {
    minPassingScore: 60,
  },
};

export const PERSONAL_LOONG_POLICY_EXAMPLE_JSON = JSON.stringify(EXAMPLE, null, 2);

export function parsePersonalLoongPolicyBundle(raw: string): PersonalLoongPolicyBundle | null {
  try {
    const j = JSON.parse(raw) as PersonalLoongPolicyBundle;
    if (!j || typeof j !== 'object') return null;
    return j;
  } catch {
    return null;
  }
}
