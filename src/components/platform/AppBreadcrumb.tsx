import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export type BreadcrumbItem = { label: string; to?: string };

type Props = {
  items: BreadcrumbItem[];
  className?: string;
};

export const AppBreadcrumb: React.FC<Props> = ({ items, className = '' }) => (
  <nav
    className={`mb-4 flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400 ${className}`}
    aria-label="Ruta"
  >
    {items.map((item, i) => (
      <React.Fragment key={`${item.label}-${i}`}>
        {i > 0 ? <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden /> : null}
        {item.to ? (
          <Link
            to={item.to}
            className="font-medium text-slate-600 transition-colors hover:text-[var(--color-juxa-accent)] dark:text-slate-300"
          >
            {item.label}
          </Link>
        ) : (
          <span className="font-semibold text-slate-800 dark:text-slate-100">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);
