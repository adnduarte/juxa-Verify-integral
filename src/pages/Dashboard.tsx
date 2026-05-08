import React from 'react';
import { useAuthStatus } from '../contexts/AuthContext';
import { AdminDashboard } from '../components/dashboards/AdminDashboard';
import { InvestigatorDashboard } from '../components/dashboards/InvestigatorDashboard';
import { ClientDashboard } from '../components/dashboards/ClientDashboard';
import { SolicitanteDashboard } from '../components/dashboards/SolicitanteDashboard';
import { FinancialDashboard } from '../components/dashboards/FinancialDashboard';
import { HRDashboard } from '../components/dashboards/HRDashboard';
import { SmeDashboard } from '../components/dashboards/SmeDashboard';
import { IntegralDashboard } from '../components/dashboards/IntegralDashboard';
import { B2BWorkspaceDashboard } from '../components/dashboards/B2BWorkspaceDashboard';
import { SupplierComplianceDashboard } from '../components/dashboards/SupplierComplianceDashboard';
import { FieldNetworkDashboard } from '../components/dashboards/FieldNetworkDashboard';
import { FordProgramOperationsDashboard } from '../components/dashboards/FordProgramOperationsDashboard';
import { JuxaVerifyLoader } from '../components/JuxaVerifyLoader';

const MESA_ROLES = [
  'ANALISTA_MESA_CONTROL',
  'GERENTE_DIRECTIVO',
  'ANALISTA_CREDITO',
  'INVESTIGADOR_SOCIAL',
  'REVISOR_RRHH',
] as const;

export const Dashboard: React.FC = () => {
  const { role, clientProfile } = useAuthStatus();

  if (role === 'ADMIN' || role === 'EJECUTIVO_VENTAS') {
    return <AdminDashboard />;
  }

  if (role === 'FORD_SUPERVISOR_GERENCIA' || role === 'FORD_SUPERVISOR_DIRECCION') {
    return <FordProgramOperationsDashboard />;
  }

  if (role === 'INVESTIGADOR') {
    return <InvestigatorDashboard />;
  }

  if (role === 'SOLICITANTE') {
    return <SolicitanteDashboard />;
  }

  if (role === 'CLIENTE_FINANCIERO' || (role && MESA_ROLES.includes(role as (typeof MESA_ROLES)[number]))) {
    return <FinancialDashboard />;
  }

  if (role === 'OPERADOR_CAMPO' || role === 'OPERADOR_RED_VISITAS') {
    return <FieldNetworkDashboard role={role} />;
  }

  if (role === 'CLIENTE') {
    if (clientProfile === 'HR') return <HRDashboard />;
    if (clientProfile === 'CREDIT') return <ClientDashboard />;
    if (clientProfile === 'SME') return <SmeDashboard />;
    if (clientProfile === 'INVESTIGACION') return <ClientDashboard />;
    if (clientProfile === 'INTEGRAL') return <IntegralDashboard />;
    if (clientProfile === 'B2B') return <B2BWorkspaceDashboard />;
    if (clientProfile === 'SUPPLIER_VALIDATION') return <SupplierComplianceDashboard />;
    // Vertical Ford Crédito MX: el panel agencia/F&I es el ClientDashboard genérico,
    // pero detecta `partnerVertical` desde el tenant para pintar branding y filtros.
    if (clientProfile === 'FORD_CREDIT_MX') return <ClientDashboard />;
    return <ClientDashboard />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <JuxaVerifyLoader text="Cargando panel..." />
    </div>
  );
};
