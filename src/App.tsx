/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { LogOut, LayoutDashboard } from 'lucide-react';
import { AuthProvider, useAuthStatus } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { ThemeToggle } from './components/ThemeToggle';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Unauthorized } from './pages/Unauthorized';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { Dashboard } from './pages/Dashboard';
import { CandidateFlow } from './pages/CandidateFlow';
import { LoongPreRegisterPage } from './pages/LoongPreRegisterPage';
import { LoongCrmModulePage, LoongOriginationCrmAdminPage } from './pages/LoongCrmModulePage';
import { OrgLoginPage } from './pages/OrgLoginPage';
import { brand, brandClasses, shellClasses } from './config/brand';
import { AccountSyncBanner } from './components/platform/AccountSyncBanner';
import { EnterpriseLoginPage } from './pages/EnterpriseLoginPage';
import { resolveLoongMobileSecondaryNav } from './lib/loongMobileNav';
import { useShellTenant } from './hooks/useShellTenant';

function Layout({ children }: { children: React.ReactNode }) {
  const { logout, role, clientProfile, organizationId } = useAuthStatus();
  useShellTenant(clientProfile ?? undefined);
  const loongMobile = resolveLoongMobileSecondaryNav({ role, clientProfile, organizationId });
  const LoongSecondaryIcon = loongMobile?.icon;

  return (
    <div className="juxa-selection flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AccountSyncBanner />
      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto pb-20 sm:pb-0">
        {/* Mobile Header */}
        <header className="sm:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 shadow-sm p-4 flex justify-between items-center gap-2 no-print">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${brandClasses.logoMark}`}
            >
              {brand.logoMark}
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-slate-100 truncate">{brand.productName}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle size="sm" />
            <button type="button" onClick={logout} className="text-slate-500 dark:text-slate-400 hover:text-red-600 p-1" aria-label="Cerrar sesión">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="h-full">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-around items-center h-16 pb-safe z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] no-print">
        <Link
          to="/dashboard"
          className={`flex h-full min-w-[70px] flex-col items-center justify-center space-y-1 ${shellClasses.linkAccent} font-medium`}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-medium">Inicio</span>
        </Link>
        {loongMobile && LoongSecondaryIcon && (
          <Link
            to={loongMobile.to}
            className="flex flex-col items-center justify-center min-w-[70px] h-full space-y-1 text-slate-600 dark:text-slate-300"
          >
            <LoongSecondaryIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{loongMobile.label}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      toastOptions={{
        className: isDark
          ? '!bg-slate-800 !text-slate-100 !border !border-slate-600 !shadow-lg'
          : '!bg-white !text-slate-900 !border !border-slate-200 !shadow-lg',
      }}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemedToaster />
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/loong/login" element={<Login mode="loong" />} />
          <Route path="/org/:orgId/login" element={<OrgLoginPage />} />
          <Route path="/login/empresa" element={<EnterpriseLoginPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/candidate/:linkId" element={<CandidateFlow />} />
          
          {/* Dashboard Route (Conditional rendering inside) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'ADMIN',
                  'SUPERVISOR',
                  'EJECUTIVO_VENTAS',
                  'ANALISTA_MESA_CONTROL',
                  'GERENTE_DIRECTIVO',
                  'ANALISTA_CREDITO',
                  'INVESTIGADOR_SOCIAL',
                  'REVISOR_RRHH',
                  'SOLICITANTE',
                  'INVESTIGADOR',
                  'CLIENTE',
                  'ATENCION_CLIENTE',
                  'ADMIN_COBRANZA',
                  'AGENTE_COBRANZA',
                  'CLIENTE_FINANCIERO',
                ]}
              >
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          {/* Admin Only Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'ANALISTA_MESA_CONTROL']}>
                <Layout>
                  <AdminDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/loong/pre-registro"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
                <LoongPreRegisterPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/loong/crm"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'ADMIN',
                  'SUPERVISOR',
                  'EJECUTIVO_VENTAS',
                  'ANALISTA_MESA_CONTROL',
                  'GERENTE_DIRECTIVO',
                  'ANALISTA_CREDITO',
                  'INVESTIGADOR_SOCIAL',
                  'REVISOR_RRHH',
                  'SOLICITANTE',
                  'INVESTIGADOR',
                  'CLIENTE',
                  'ATENCION_CLIENTE',
                  'ADMIN_COBRANZA',
                  'AGENTE_COBRANZA',
                  'CLIENTE_FINANCIERO',
                ]}
              >
                <Layout>
                  <LoongCrmModulePage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/loong/crm"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
                <Layout>
                  <LoongOriginationCrmAdminPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
