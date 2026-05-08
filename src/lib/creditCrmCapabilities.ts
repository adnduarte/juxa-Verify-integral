import { normalizeClientAccountRole } from './clientAccountAccess';

/** Permisos granulares para la vista CRM de solicitudes de crédito (Ford y genérico). */
export interface CreditCrmCapabilities {
  canUseGenerativeFilter: boolean;
  canExportList: boolean;
  canViewDigidPlacement: boolean;
  canViewIdentityAntiUsurpation: boolean;
  canViewMesaReturnDetails: boolean;
  canEditContractFields: boolean;
}

/** Valores por defecto (mesa / admin / sin restricción). */
export const defaultCreditCrmCapabilities: CreditCrmCapabilities = {
  canUseGenerativeFilter: true,
  canExportList: true,
  canViewDigidPlacement: true,
  canViewIdentityAntiUsurpation: true,
  canViewMesaReturnDetails: true,
  canEditContractFields: true,
};

export function getCreditCrmCapabilities(input: {
  context: 'client' | 'financial' | 'ford_program';
  role: string | null;
  clientAccountRole: string | null;
}): CreditCrmCapabilities {
  const { context, role, clientAccountRole } = input;
  const seat = normalizeClientAccountRole(clientAccountRole);

  if (context === 'ford_program') {
    if (role === 'FORD_SUPERVISOR_DIRECCION') return { ...defaultCreditCrmCapabilities };
    if (role === 'FORD_SUPERVISOR_GERENCIA') {
      return {
        ...defaultCreditCrmCapabilities,
        canExportList: false,
      };
    }
    return defaultCreditCrmCapabilities;
  }

  if (context === 'financial') {
    return defaultCreditCrmCapabilities;
  }

  // client — agencia (asiento OPERATIVO = F&I operativo)
  if (seat === 'OPERATIVO') {
    return {
      canUseGenerativeFilter: true,
      canExportList: false,
      canViewDigidPlacement: false,
      canViewIdentityAntiUsurpation: true,
      canViewMesaReturnDetails: true,
      canEditContractFields: false,
    };
  }

  if (seat === 'GERENCIA' || seat === 'DIRECCION') {
    return {
      ...defaultCreditCrmCapabilities,
      canExportList: true,
    };
  }

  return defaultCreditCrmCapabilities;
}
