import React from 'react';
import { brand, brandClasses } from '../../config/brand';
import { FlaskConical } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';

type AuthChromeProps = {
  children: React.ReactNode;
  showStagingBadge?: boolean;
};

export const AuthChrome: React.FC<AuthChromeProps> = ({ children, showStagingBadge }) => {
  return (
    <div
      className={`min-h-screen ${brandClasses.pageGradient} text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased`}
    >
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.4] dark:opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 20%, rgba(79, 70, 229, 0.1), transparent 45%),
            radial-gradient(circle at 80% 0%, rgba(245, 158, 11, 0.08), transparent 40%),
            linear-gradient(180deg, transparent 0%, rgba(15, 23, 42, 0.06) 100%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 hidden dark:block opacity-50"
        style={{
          backgroundImage: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.28) 100%)',
        }}
        aria-hidden
      />

      <header className="relative z-10 border-b border-slate-200/80 bg-white/75 backdrop-blur-md dark:border-white/[0.06] dark:bg-[#070b14]/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold tracking-tight text-slate-950 shadow-lg shadow-amber-500/20">
              {brand.logoMark}
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white truncate">
                {brand.productName}
              </p>
              <p className={`text-xs ${brandClasses.muted}`}>{brand.footerCredit}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle size="sm" />
            {showStagingBadge && (
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                <FlaskConical className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                Entorno pruebas
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">{children}</main>

      <footer className="relative z-10 border-t border-slate-200/80 py-4 text-center text-xs text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
        © {new Date().getFullYear()} {brand.company}. {brand.subtitle}
      </footer>
    </div>
  );
};
