import React from 'react';
import type { Role } from '../contexts/AuthContext';
import { AdminDashboard } from '../components/dashboards/AdminDashboard';
import { InvestigatorDashboard } from '../components/dashboards/InvestigatorDashboard';
import { ClientDashboard } from '../components/dashboards/ClientDashboard';
import { SolicitanteDashboard } from '../components/dashboards/SolicitanteDashboard';
import { FinancialDashboard } from '../components/dashboards/FinancialDashboard';
import { HRDashboard } from '../components/dashboards/HRDashboard';
import { SmeDashboard } from '../components/dashboards/SmeDashboard';
import { JuxaVerifyLoader } from '../components/JuxaVerifyLoader';
import { LoongMotorWorkspaceDashboard } from '../components/loong/LoongMotorWorkspaceDashboard';
import {
  DEFAULT_ORGANIZATION_ID_LOONG,
  defaultOrganizationIdFromEmail,
  resolveEffectiveOrganizationId,
} from '../lib/organizations';
import { isSuperAdminEmail } from '../config/superadmins';

const FINANCIAL_INTERNAL_ROLES: Role[] = [
  'EJECUTIVO_VENTAS',
  'ANALISTA_MESA_CONTROL',
  'GERENTE_DIRECTIVO',
  'ANALISTA_CREDITO',
  'INVESTIGADOR_SOCIAL',
  'REVISOR_RRHH',
  'CLIENTE_FINANCIERO',
];

export type DashboardRouteContext = {
  role: Role;
  clientProfile: string;
  organizationId: string | null;
  /** Correo de la sesión: fallback tenant Loong si `users` aún no tiene organizationId / LOONG_MOTOR. */
  userEmail?: string | null;
};

/**
 * Resuelve el panel principal según perfil de producto y rol (Fase 3 — registry).
 * Loong Motor tiene prioridad cuando el perfil es LOONG_MOTOR o el usuario es vendedor de la org Loong.
 */
/** Roles operativos del workspace dedicado Loong (vendedor, mesa, comercial, etc.). */
const LOONG_MOTOR_WORKSPACE_ROLES: readonly Role[] = [
  'CLIENTE',
  'ANALISTA_MESA_CONTROL',
  'EJECUTIVO_VENTAS',
  'SUPERVISOR',
  'ADMIN',
  'ATENCION_CLIENTE',
  'ADMIN_COBRANZA',
  'AGENTE_COBRANZA',
  'GERENTE_DIRECTIVO',
  'ANALISTA_CREDITO',
  'INVESTIGADOR',
];

export function resolveMainDashboard(ctx: DashboardRouteContext): React.ReactNode {
  const { role, clientProfile, organizationId, userEmail } = ctx;
  const emailTenant = userEmail ? defaultOrganizationIdFromEmail(userEmail) : null;
  const effectiveOrg =
    resolveEffectiveOrganizationId(organizationId, clientProfile) || emailTenant;

  /** Plataforma / demo: no forzar workspace Loong aunque el correo sea @loong.mx. */
  const platformSuperSession = Boolean(userEmail && isSuperAdminEmail(userEmail));

  const isLoongWorkspaceUser =
    !platformSuperSession &&
    effectiveOrg === DEFAULT_ORGANIZATION_ID_LOONG &&
    role != null &&
    role !== 'SOLICITANTE' &&
    (clientProfile === 'LOONG_MOTOR' || (role && LOONG_MOTOR_WORKSPACE_ROLES.includes(role)));

  if (isLoongWorkspaceUser) {
    return <LoongMotorWorkspaceDashboard />;
  }

  if (role === 'ADMIN' || role === 'SUPERVISOR') {
    return <AdminDashboard />;
  }

  if (role === 'INVESTIGADOR') {
    return <InvestigatorDashboard />;
  }

  if (role && FINANCIAL_INTERNAL_ROLES.includes(role)) {
    return <FinancialDashboard />;
  }

  if (role === 'SOLICITANTE') {
    return <SolicitanteDashboard />;
  }

  if (role === 'CLIENTE') {
    if (clientProfile === 'HR') return <HRDashboard />;
    if (clientProfile === 'CREDIT') return <ClientDashboard />;
    if (clientProfile === 'SME') return <SmeDashboard />;
    if (clientProfile === 'INVESTIGACION') return <ClientDashboard />;
    return <ClientDashboard />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <JuxaVerifyLoader text="Cargando panel..." />
    </div>
  );
}
