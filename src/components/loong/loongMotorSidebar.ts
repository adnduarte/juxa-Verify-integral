import type { LucideIcon } from 'lucide-react';
import {
  Calculator,
  ClipboardList,
  Gavel,
  Kanban,
  LayoutDashboard,
  MessageCircle,
  Search,
  Send,
  Settings,
  Settings2,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { DashboardSidebarItem } from '../dashboards/DashboardLayout';
import type { Role } from '../../contexts/AuthContext';
import { FEATURE_WORKSPACE_CHAT_TICKETS } from '../../config/features';
import { loongUserHasMesaDeskVisibility } from '../../lib/loongMesaDeskAccess';

export type LoongWorkspaceTabId =
  | 'pipeline'
  | 'mesa-control'
  | 'precal'
  | 'investigaciones'
  | 'politicas'
  | 'entrega'
  | 'equipo'
  | 'cobranza-crm'
  | 'tickets'
  | 'chat'
  | 'mis-expedientes'
  | 'configuracion'
  | 'flow-requests'
  | 'flow-requests-superadmin';

function tabTo(to: LoongWorkspaceTabId): string {
  if (to === 'flow-requests-superadmin') return '/dashboard?tab=flow-requests';
  return `/dashboard?tab=${to}`;
}

export function buildLoongMotorSidebarItems(opts: {
  investigatorOnly: boolean;
  atencionOnly: boolean;
  cobranzaOnly: boolean;
  canManageTeam: boolean;
  role: Role;
  userEmail?: string | null;
  loongTeamTier?: string | null;
}): DashboardSidebarItem[] {
  const { investigatorOnly, atencionOnly, cobranzaOnly, canManageTeam, role, userEmail, loongTeamTier } = opts;

  const mesaDesk = loongUserHasMesaDeskVisibility({
    role: role ?? '',
    userEmail,
    loongTeamTier: loongTeamTier ?? null,
  });

  // Comunicaciones/tickets deben permear a toda la org (si hay organizationId).
  const supportVisible = true;

  if (investigatorOnly) {
    return [{ id: 'investigaciones', label: 'Investigación crédito', icon: Search, to: tabTo('investigaciones') }];
  }
  if (atencionOnly) {
    if (!FEATURE_WORKSPACE_CHAT_TICKETS) {
      return [{ id: 'configuracion', label: 'Embeds / marketing', icon: Settings, to: tabTo('configuracion') }];
    }
    return [
      { id: 'tickets', label: 'Tickets de soporte', icon: MessageCircle, to: tabTo('tickets') },
      { id: 'configuracion', label: 'Embeds / marketing', icon: Settings, to: tabTo('configuracion') },
      { id: 'chat', label: 'Chat', icon: MessageCircle, to: tabTo('chat') },
    ];
  }
  if (cobranzaOnly) {
    const cobItems: DashboardSidebarItem[] = [
      { id: 'cobranza-crm', label: 'CRM cobranza', icon: Wallet, to: tabTo('cobranza-crm') },
    ];
    if (FEATURE_WORKSPACE_CHAT_TICKETS) {
      cobItems.push({ id: 'chat', label: 'Chat', icon: MessageCircle, to: tabTo('chat') });
    }
    return cobItems;
  }

  /** Vendedor concesionario: solo alta crédito moto + seguimiento de expedientes (sin RRHH ni otros productos). */
  const vendorSalesOnly =
    role === 'CLIENTE' &&
    !canManageTeam &&
    !investigatorOnly &&
    !atencionOnly &&
    !cobranzaOnly &&
    !mesaDesk;
  if (vendorSalesOnly) {
    const v: DashboardSidebarItem[] = [
      {
        id: 'flow-requests',
        label: 'Iniciar precalificación',
        icon: Send,
        to: tabTo('flow-requests'),
      },
      { id: 'mis-expedientes', label: 'Mis solicitudes', icon: ClipboardList, to: tabTo('mis-expedientes') },
    ];
    if (FEATURE_WORKSPACE_CHAT_TICKETS) {
      v.push(
        { id: 'chat', label: 'Chat', icon: MessageCircle, to: tabTo('chat') },
        { id: 'tickets', label: 'Soporte / tickets', icon: MessageCircle, to: tabTo('tickets') }
      );
    }
    return v;
  }

  const showMesaControlTab =
    role === 'ANALISTA_MESA_CONTROL' || role === 'SUPERVISOR' || role === 'ADMIN' || mesaDesk;
  const comercialLoong = role === 'EJECUTIVO_VENTAS';

  const items: { id: LoongWorkspaceTabId | 'crm-module'; label: string; icon: LucideIcon; to: string }[] = [];

  if (showMesaControlTab) {
    items.push({
      id: 'mesa-control',
      label: 'Mesa de control',
      icon: Gavel,
      to: tabTo('mesa-control'),
    });
  }
  if (comercialLoong) {
    items.push({
      id: 'flow-requests',
      label: 'Comercial Loong',
      icon: LayoutDashboard,
      to: tabTo('flow-requests'),
    });
  }
  if (role === 'ANALISTA_MESA_CONTROL') {
    items.push({
      id: 'flow-requests-superadmin',
      label: 'Solicitud a superadmin',
      icon: Send,
      to: tabTo('flow-requests'),
    });
  }

  items.push(
    { id: 'pipeline', label: 'Originación', icon: Kanban, to: tabTo('pipeline') },
    { id: 'crm-module', label: 'CRM colocación', icon: UserPlus, to: '/dashboard/loong/crm' },
    { id: 'precal', label: 'Precalificador', icon: Calculator, to: tabTo('precal') },
    { id: 'investigaciones', label: 'Investigaciones', icon: Search, to: tabTo('investigaciones') },
    { id: 'entrega', label: 'Contrato y entrega', icon: Truck, to: tabTo('entrega') }
  );

  if (canManageTeam) {
    items.splice(1, 0, { id: 'equipo', label: 'Equipo', icon: Users, to: tabTo('equipo') });
  }

  if (
    role === 'ADMIN' ||
    role === 'SUPERVISOR' ||
    role === 'ADMIN_COBRANZA' ||
    role === 'AGENTE_COBRANZA'
  ) {
    const entregaIdx = items.findIndex((i) => i.id === 'entrega');
    const insertAt = entregaIdx >= 0 ? entregaIdx + 1 : items.length;
    items.splice(insertAt, 0, { id: 'cobranza-crm', label: 'CRM cobranza', icon: Wallet, to: tabTo('cobranza-crm') });
  }

  if (FEATURE_WORKSPACE_CHAT_TICKETS) {
    items.push({ id: 'chat', label: 'Chat', icon: MessageCircle, to: tabTo('chat') });
    if (supportVisible) items.push({ id: 'tickets', label: 'Soporte / tickets', icon: MessageCircle, to: tabTo('tickets') });
  }
  items.push({ id: 'configuracion', label: 'Configuración', icon: Settings, to: tabTo('configuracion') });

  if (role === 'ADMIN' || role === 'SUPERVISOR') {
    items.push({ id: 'politicas', label: 'Políticas y reglas', icon: Settings2, to: tabTo('politicas') });
  }

  return items;
}

export function resolveLoongWorkspaceActiveTab(
  pathname: string,
  search: string,
  opts: {
    investigatorOnly: boolean;
    atencionOnly: boolean;
    cobranzaOnly: boolean;
    role: Role;
    canManageTeam: boolean;
    userEmail?: string | null;
    loongTeamTier?: string | null;
  }
): string {
  const { investigatorOnly, atencionOnly, cobranzaOnly, role, canManageTeam, userEmail, loongTeamTier } = opts;

  const mesaDesk = loongUserHasMesaDeskVisibility({
    role: role ?? '',
    userEmail,
    loongTeamTier: loongTeamTier ?? null,
  });
  if (pathname === '/dashboard/loong/crm') return 'crm-module';

  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const t = sp.get('tab');

  if (investigatorOnly) return 'investigaciones';
  if (atencionOnly) {
    return FEATURE_WORKSPACE_CHAT_TICKETS ? 'tickets' : 'configuracion';
  }
  if (cobranzaOnly) {
    if (FEATURE_WORKSPACE_CHAT_TICKETS) {
      if (t === 'tickets') return 'tickets';
      if (t === 'chat') return 'chat';
    }
    return 'cobranza-crm';
  }

  const vendorSalesOnly =
    role === 'CLIENTE' &&
    !canManageTeam &&
    !investigatorOnly &&
    !atencionOnly &&
    !cobranzaOnly &&
    !mesaDesk;
  if (vendorSalesOnly) {
    const vendorAllowed = new Set<string>(['flow-requests', 'mis-expedientes']);
    if (FEATURE_WORKSPACE_CHAT_TICKETS) {
      vendorAllowed.add('chat');
      vendorAllowed.add('tickets');
    }
    if (t && vendorAllowed.has(t)) return t;
    return 'flow-requests';
  }

  const showMesaControlTab =
    role === 'ANALISTA_MESA_CONTROL' || role === 'SUPERVISOR' || role === 'ADMIN' || mesaDesk;
  const comercialLoong = role === 'EJECUTIVO_VENTAS';

  const allowed = new Set<string>([
    'pipeline',
    'precal',
    'investigaciones',
    'entrega',
    'cobranza-crm',
    'mis-expedientes',
    'configuracion',
  ]);
  if (FEATURE_WORKSPACE_CHAT_TICKETS) {
    allowed.add('chat');
    allowed.add('tickets');
  }
  if (canManageTeam) allowed.add('equipo');
  if (role === 'ADMIN' || role === 'SUPERVISOR') allowed.add('politicas');
  if (showMesaControlTab) allowed.add('mesa-control');
  if (comercialLoong || role === 'ANALISTA_MESA_CONTROL') allowed.add('flow-requests');

  if (t && allowed.has(t)) return t;
  if (role === 'ANALISTA_MESA_CONTROL' || mesaDesk) return 'mesa-control';
  if (comercialLoong) return 'flow-requests';
  return 'pipeline';
}
