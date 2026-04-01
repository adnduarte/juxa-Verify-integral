import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { Card } from '../components/ui/Card';
import { shellClasses } from '../config/brand';

export const Unauthorized: React.FC = () => {
  return (
    <div className="juxa-selection relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle size="sm" />
      </div>
      <Card className="max-w-md w-full text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">Acceso denegado</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No tienes permisos para esta página. Si eres usuario Loong o concesionario, usa el panel principal (no enlaces de
          administración Juxa).
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link to="/dashboard" className={`${shellClasses.ctaPrimary} w-full justify-center py-3`}>
            Ir a mi panel
          </Link>
          <Link
            to="/"
            className="flex w-full justify-center rounded-xl border border-slate-200 py-3 px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/80"
          >
            Volver al inicio
          </Link>
        </div>
      </Card>
    </div>
  );
};
