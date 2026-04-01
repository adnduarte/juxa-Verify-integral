import type { LucideIcon } from 'lucide-react';
import { Gavel, MessageCircle, Search, UserPlus, Wallet } from 'lucide-react';
import type { Role } from '../contexts/AuthContext';
import { DEFAULT_ORGANIZATION_ID_LOONG } from './organizations';

export type LoongMobileSecondaryNav = { to: string; label: string; icon: LucideIcon };

/**
 * Segundo acceso rápido en la barra inferior móvil para usuarios del workspace Loong Motor.
 */
export function resolveLoongMobileSecondaryNav(params: {
  role: Role;
  clientProfile: string;
  organizationId: string | null;
}): LoongMobileSecondaryNav | null {
  const { role, clientProfile, organizationId } = params;
  const isLoongWorkspaceUser =
    (clientProfile === 'LOONG_MOTOR' && role && role !== 'SOLICITANTE') ||
    (role === 'CLIENTE' && organizationId === DEFAULT_ORGANIZATION_ID_LOONG);
  if (!isLoongWorkspaceUser) return null;

  if (role === 'INVESTIGADOR') {
    return { to: '/dashboard?tab=investigaciones', label: 'Investigación', icon: Search };
  }
  if (role === 'ATENCION_CLIENTE') {
    return { to: '/dashboard?tab=tickets', label: 'Soporte', icon: MessageCircle };
  }
  if (role === 'ADMIN_COBRANZA' || role === 'AGENTE_COBRANZA') {
    return { to: '/dashboard?tab=cobranza-crm', label: 'Cobranza', icon: Wallet };
  }
  if (role === 'ANALISTA_MESA_CONTROL') {
    return { to: '/dashboard?tab=mesa-control', label: 'Mesa', icon: Gavel };
  }
  return { to: '/dashboard/loong/crm', label: 'CRM moto', icon: UserPlus };
}
