import React from 'react';

export type WorkflowStep = { id: string; label: string };

type StepStatus = 'pending' | 'current' | 'done';

function statusFor(i: number, currentIndex: number): StepStatus {
  if (i < currentIndex) return 'done';
  if (i === currentIndex) return 'current';
  return 'pending';
}

type Props = {
  steps: WorkflowStep[];
  /** Índice base 0 de la etapa activa. */
  currentIndex: number;
  className?: string;
};

export const WorkflowStepper: React.FC<Props> = ({ steps, currentIndex, className = '' }) => (
  <ol
    className={`mb-6 flex flex-wrap items-center gap-3 sm:gap-5 ${className}`.trim()}
    aria-label="Etapas del flujo"
  >
    {steps.map((s, i) => {
      const st = statusFor(i, currentIndex);
      return (
        <li key={s.id} className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              st === 'done'
                ? 'bg-[var(--color-juxa-accent)] text-[var(--color-juxa-accent-foreground)]'
                : st === 'current'
                  ? 'bg-[var(--color-juxa-accent-muted)] text-[var(--color-juxa-accent)] ring-2 ring-[var(--color-juxa-accent)]'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
            }`}
            aria-current={st === 'current' ? 'step' : undefined}
          >
            {i + 1}
          </span>
          <span
            className={`hidden text-sm font-medium sm:inline ${
              st === 'current' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {s.label}
          </span>
        </li>
      );
    })}
  </ol>
);
