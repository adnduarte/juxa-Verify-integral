import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuthStatus } from '../contexts/AuthContext';
import { brand } from '../config/brand';
import { LOGIN_LOONG_MOTOR_URL, LOONG_PRE_REGISTER_PATH } from '../config/loongLinks';
import { LoongTeamUsersPanel } from '../components/loong/LoongTeamUsersPanel';
import { ThemeToggle } from '../components/ThemeToggle';

/**
 * Alta de usuarios Loong (ADMIN/SUPERVISOR): creación con contraseña.
 * Misma lógica que la pestaña Equipo del workspace Loong.
 */
export const LoongPreRegisterPage: React.FC = () => {
  const { logout, organizationId, effectiveOrganizationId } = useAuthStatus();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:max-w-3xl sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-slate-950">
              {brand.logoMark}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Equipo Loong Motor</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Correo y contraseña definidos por el admin</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <ThemeToggle size="sm" />
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Mi panel
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
            >
              Admin Juxa
            </Link>
            <Link
              to={LOGIN_LOONG_MOTOR_URL}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800 hover:bg-emerald-100"
            >
              Acceso al panel
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:max-w-3xl sm:px-6 sm:py-10">
        <LoongTeamUsersPanel organizationId={effectiveOrganizationId ?? organizationId} />
        <p className="mt-8 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Ruta: <code>{LOONG_PRE_REGISTER_PATH}</code>
        </p>
      </main>
    </div>
  );
};
