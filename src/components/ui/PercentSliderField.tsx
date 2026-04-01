import React, { useId, useMemo } from 'react';

type Props = {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Si true, guarda como ratio 0..1 pero muestra como % 0..100 */
  ratioValue?: boolean;
  precision?: number;
  helpText?: string;
  disabled?: boolean;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function toDisplay(value: number, ratioValue: boolean): number {
  return ratioValue ? value * 100 : value;
}

function fromDisplay(value: number, ratioValue: boolean): number {
  return ratioValue ? value / 100 : value;
}

export const PercentSliderField: React.FC<Props> = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  ratioValue = false,
  precision = 1,
  helpText,
  disabled,
}) => {
  const id = useId();
  const displayValue = toDisplay(value, ratioValue);
  const cfg = useMemo(() => {
    const defMin = ratioValue ? 0 : 0;
    const defMax = ratioValue ? 100 : 100;
    const defStep = ratioValue ? 0.5 : 0.5;
    return {
      min: min ?? defMin,
      max: max ?? defMax,
      step: step ?? defStep,
    };
  }, [min, max, step, ratioValue]);

  const commitDisplay = (raw: number) => {
    if (!Number.isFinite(raw)) return;
    const clamped = clamp(raw, cfg.min, cfg.max);
    const next = fromDisplay(clamped, ratioValue);
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-slate-700 dark:text-slate-200">
          {label}
        </label>
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          {displayValue.toFixed(precision)}%
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          value={Number.isFinite(displayValue) ? displayValue : cfg.min}
          onChange={(e) => commitDisplay(Number(e.target.value))}
          disabled={disabled}
          className="w-full accent-[var(--color-juxa-accent)]"
        />
        <input
          type="number"
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          value={Number.isFinite(displayValue) ? String(displayValue) : String(cfg.min)}
          onChange={(e) => commitDisplay(Number(e.target.value))}
          disabled={disabled}
          className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-juxa-accent)]"
        />
      </div>
      {helpText ? <p className="text-[11px] text-slate-500 dark:text-slate-400">{helpText}</p> : null}
    </div>
  );
};

