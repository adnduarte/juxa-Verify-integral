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
import { JuxaVerifyLoader } from '../components/JuxaVerifyLoader';

export const Dashboard: React.FC = () => {
  const { role, clientProfile } = useAuthStatus();

  if (role === 'ADMIN' || role === 'EJECUTIVO_VENTAS') {
    return <AdminDashboard />;
  }

  if (role === 'INVESTIGADOR') {
    return <InvestigatorDashboard />;
  }

  if (role === 'CLIENTE') {
    if (clientProfile === 'HR') return <HRDashboard />;
    if (clientProfile === 'CREDIT') return <ClientDashboard />;
    if (clientProfile === 'SME') return <SmeDashboard />;
    if (clientProfile === 'INVESTIGACION') return <ClientDashboard />;
    return <ClientDashboard />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <JuxaVerifyLoader text="Cargando panel..." />
    </div>
  );
};
