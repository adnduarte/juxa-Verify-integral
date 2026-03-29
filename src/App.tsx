/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { ShieldCheck, LogOut, Settings, Users, FileText, LayoutDashboard, Search } from 'lucide-react';
import { AuthProvider, useAuthStatus } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Unauthorized } from './pages/Unauthorized';
import { Landing } from './pages/Landing';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { Dashboard } from './pages/Dashboard';
import { CandidateFlow } from './pages/CandidateFlow';

function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuthStatus();

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto pb-20 sm:pb-0">
        {/* Mobile Header */}
        <header className="sm:hidden bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm p-4 flex justify-between items-center no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-lg font-bold shadow-sm">
              JV
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">JUXA VERIFY</span>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-red-600">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <div className="h-full">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around items-center h-16 pb-safe z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] no-print">
        <Link
          to="/dashboard"
          className="flex flex-col items-center justify-center min-w-[70px] h-full space-y-1 text-blue-600"
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-medium">Dashboard</span>
        </Link>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" reverseOrder={false} />
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/candidate/:linkId" element={<CandidateFlow />} />
          
          {/* Dashboard Route (Conditional rendering inside) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'EJECUTIVO_VENTAS', 'ANALISTA_MESA_CONTROL', 'GERENTE_DIRECTIVO', 'ANALISTA_CREDITO', 'INVESTIGADOR_SOCIAL', 'REVISOR_RRHH', 'SOLICITANTE', 'INVESTIGADOR', 'CLIENTE']}>
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
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <Layout>
                  <AdminDashboard />
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
