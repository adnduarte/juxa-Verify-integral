import React from 'react';

type Variant = 'neutral' | 'accent' | 'success' | 'warning';

const map: Record<Variant, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  accent: 'bg-[var(--color-juxa-accent-muted)] text-[var(--color-juxa-accent)]',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
};

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
};

export const Badge: React.FC<Props> = ({ children, variant = 'neutral', className = '' }) => (
  <span
    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${map[variant]} ${className}`.trim()}
  >
    {children}
  </span>
);
