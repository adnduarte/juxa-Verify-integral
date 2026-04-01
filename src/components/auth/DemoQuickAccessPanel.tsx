import React, { useState } from 'react';
import { ChevronDown, ChevronUp, LogIn, KeyRound } from 'lucide-react';
import { DEMO_ACCOUNTS, getDemoSharedPassword } from '../../config/staging';
import { brandClasses } from '../../config/brand';

type DemoQuickAccessPanelProps = {
  onQuickLogin: (email: string, password: string) => Promise<void>;
  disabled?: boolean;
};

export const DemoQuickAccessPanel: React.FC<DemoQuickAccessPanelProps> = ({
  onQuickLogin,
  disabled,
}) => {
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pass = getDemoSharedPassword();
  const missingPass = !pass;

  const handleDemo = async (email: string, id: string) => {
    if (missingPass || disabled) return;
    setBusyId(id);
    try {
      await onQuickLogin(email, pass);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/[0.06] shadow-lg shadow-black/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-amber-100/95 transition hover:bg-white/[0.04]"
      >
        <span className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-amber-400" aria-hidden />
          Acceso rápido — cuentas demo
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-amber-400/80" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-amber-400/80" aria-hidden />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/[0.06] px-4 py-4">
          {missingPass && (
            <p className="rounded-lg border border-amber-500/20 bg-slate-950/50 px-3 py-2 text-xs leading-relaxed text-amber-100/80">
              Define <code className="rounded bg-black/30 px-1 text-amber-300">VITE_DEMO_SHARED_PASSWORD</code> en{' '}
              <code className="rounded bg-black/30 px-1 text-amber-300">.env.local</code> y crea los usuarios demo en
              Firebase con los correos indicados.
            </p>
          )}
          <ul className="space-y-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <li key={acc.id}>
                <button
                  type="button"
                  disabled={disabled || missingPass || busyId !== null}
                  onClick={() => handleDemo(acc.email, acc.id)}
                  className="group flex w-full items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-slate-950/40 px-3 py-2.5 text-left transition hover:border-amber-500/30 hover:bg-slate-900/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{acc.label}</p>
                    <p className={`truncate text-xs ${brandClasses.muted}`}>{acc.email}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{acc.description}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-400 group-hover:text-amber-300">
                    {busyId === acc.id ? (
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
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
        </div>
      )}
    </div>
  );
};
