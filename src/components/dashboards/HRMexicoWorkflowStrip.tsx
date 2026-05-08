import React from 'react';
import { Briefcase, UserCheck, Shield, FileBadge, FolderOpen } from 'lucide-react';

const STEPS = [
  { id: 'VACANCY', label: 'Vacante', icon: Briefcase },
  { id: 'PROSPECT', label: 'Prospecto', icon: UserCheck },
  { id: 'VALIDATION', label: 'Validaciones', icon: Shield },
  { id: 'DICTUMEN', label: 'Dictamen', icon: FileBadge },
  { id: 'ONBOARDING_DOCS', label: 'Alta documental', icon: FolderOpen },
] as const;

/** Flujo RRHH México (control integral); etapa persistida opcional en `hrPipelineStage` del expediente. */
export const HRMexicoWorkflowStrip: React.FC<{ activeStage?: string }> = ({ activeStage = 'PROSPECT' }) => {
  const idx = Math.max(
    0,
    STEPS.findIndex((s) => s.id === activeStage)
  );
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-6">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Flujo integral México</p>
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < idx;
          const current = i === idx;
          return (
            <div
              key={s.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${
                done
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : current
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-slate-50 border-slate-100 text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {s.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};
