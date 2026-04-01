import React, { useState } from 'react';
import { Bike, ChevronDown, ChevronUp, LogIn, KeyRound } from 'lucide-react';
import { LOONG_QUICK_USERS, getLoongQuickPassword } from '../../config/loongQuickUsers';
import { brandClasses } from '../../config/brand';

type LoongQuickAccessPanelProps = {
  onQuickLogin: (email: string, password: string) => Promise<void>;
  disabled?: boolean;
};

export const LoongQuickAccessPanel: React.FC<LoongQuickAccessPanelProps> = ({
  onQuickLogin,
  disabled,
}) => {
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pass = getLoongQuickPassword();
  const missingPass = !pass;

  const handle = async (email: string, id: string) => {
    if (missingPass || disabled) return;
    setBusyId(id);
    try {
      await onQuickLogin(email, pass);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] shadow-lg shadow-black/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-emerald-100/95 transition hover:bg-white/[0.04]"
      >
        <span className="flex items-center gap-2">
          <Bike className="h-4 w-4 text-emerald-400" aria-hidden />
          Acceso rápido — perfiles Loong (pruebas)
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-emerald-400/80" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-emerald-400/80" aria-hidden />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/[0.06] px-4 py-4">
          {missingPass && (
            <p className="rounded-lg border border-emerald-500/20 bg-slate-950/50 px-3 py-2 text-xs leading-relaxed text-emerald-100/80">
              Define <code className="rounded bg-black/30 px-1 text-emerald-300">VITE_LOONG_QUICK_PASSWORD</code> en{' '}
              <code className="rounded bg-black/30 px-1 text-emerald-300">.env.local</code> (la misma que usaste al crear
              las cuentas desde el panel Loong). Reinicia <code className="rounded bg-black/30 px-1">npm run dev</code>.
            </p>
          )}
          <ul className="space-y-2">
            {LOONG_QUICK_USERS.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  disabled={disabled || missingPass || busyId !== null}
                  onClick={() => handle(u.email, u.id)}
                  className="group flex w-full items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-slate-950/40 px-3 py-2.5 text-left transition hover:border-emerald-500/30 hover:bg-slate-900/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{u.label}</p>
                    <p className={`truncate text-xs ${brandClasses.muted}`}>{u.email}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Rol {u.role} · perfil Loong Motor</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
                    {busyId === u.id ? (
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
                    ) : (
                      <>
                        Entrar
                        <LogIn className="h-3.5 w-3.5" aria-hidden />
                      </>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
            Crea las cuentas con <code className="rounded bg-black/30 px-1 text-emerald-300">npm run seed:demo</code> o desde
            Admin → Loong → Equipo (correo y contraseña).
          </p>
        </div>
      )}
    </div>
  );
};
