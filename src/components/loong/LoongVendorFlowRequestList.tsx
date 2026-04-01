import React from 'react';
import { Copy, ExternalLink, Route } from 'lucide-react';
import toast from 'react-hot-toast';
import type { LoongFlowRequest } from '../../lib/loongFlowRequests';
import {
  mesaPrecalFlowBadgeClass,
  mesaPrecalFlowLabel,
  mesaPrecalFlowState,
} from '../../lib/mesaCreditDictamen';
import type { VendorPrecalInvRow } from '../../hooks/useVendorLoongPrecalInvestigations';

function historialLabel(status: LoongFlowRequest['status']): string {
  switch (status) {
    case 'DONE':
      return 'Enlace generado';
    case 'OPEN':
      return 'Pendiente central';
    case 'CANCELLED':
      return 'Cancelada';
    default:
      return status;
  }
}

function historialBadgeClass(status: LoongFlowRequest['status']): string {
  switch (status) {
    case 'DONE':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200';
    case 'OPEN':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
    case 'CANCELLED':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  }
}

type Props = {
  rows: LoongFlowRequest[];
  invById: Record<string, VendorPrecalInvRow>;
  onOpenTracking: (r: LoongFlowRequest) => void;
  /** Opcional: abre wa.me con texto prearmado (solo si el usuario pulsa). */
  onShareWhatsApp?: (candidateUrl: string, title: string) => void;
  /** Borde/ fondo de cada fila: misma pestaña vs Mis expedientes */
  variant?: 'default' | 'emerald';
};

export const LoongVendorFlowRequestList: React.FC<Props> = ({
  rows,
  invById,
  onOpenTracking,
  onShareWhatsApp,
  variant = 'default',
}) => {
  const liBase =
    variant === 'emerald'
      ? 'rounded-xl border border-emerald-200/80 bg-white/95 dark:border-emerald-900/45 dark:bg-slate-900/85 px-4 py-3 text-slate-800 dark:text-slate-200 shadow-sm'
      : 'rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 px-4 py-3 text-slate-800 dark:text-slate-200';

  return (
    <ul className="mt-3 space-y-3 text-sm">
      {rows.map((r) => {
        const invId = r.resolvedInvestigationId;
        const inv = invId ? invById[invId] : undefined;
        const mesaState = inv ? mesaPrecalFlowState(inv) : 'no_aplica';
        const mesaLabel = mesaPrecalFlowLabel(mesaState);
        const candidateUrl =
          r.resolvedLinkId && typeof window !== 'undefined'
            ? `${window.location.origin}/candidate/${r.resolvedLinkId}`
            : '';

        const prospect =
          (r.clientName && r.clientName.trim()) ||
          (inv?.contactInfo && inv.contactInfo.trim()) ||
          null;
        const phone = (r.candidatePhone && r.candidatePhone.trim()) || inv?.candidatePhone || null;
        const email = (r.candidateEmail && r.candidateEmail.trim()) || inv?.candidateEmail || null;
        const notes = (r.notes && r.notes.trim()) || null;

        return (
          <li key={r.id} className={liBase}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  {prospect ? (
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{prospect}</p>
                  ) : null}
                  <p
                    className={
                      prospect
                        ? 'mt-0.5 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200'
                        : 'text-base font-semibold text-slate-900 dark:text-slate-100'
                    }
                  >
                    Ref. {r.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Creado {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${historialBadgeClass(r.status)}`}
                  >
                    {historialLabel(r.status)}
                  </span>
                  {inv ? (
                    <span className="inline-flex rounded-full bg-slate-200/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                      Expediente: {inv.status ?? '—'}
                    </span>
                  ) : invId ? (
                    <span
                      className="text-[11px] text-amber-700 dark:text-amber-300"
                      title="Si no desaparece: despliega índices Firestore (clientId + createdAt) o confirma que el expediente siga siendo LOONG_PRECAL y clientId = tu usuario."
                    >
                      Sincronizando expediente…
                    </span>
                  ) : r.status === 'OPEN' ? (
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      Sin enlace todavía (solicitud a central)
                    </span>
                  ) : null}
                  {mesaLabel ? (
                    <span
                      className={`inline-flex max-w-full rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${mesaPrecalFlowBadgeClass(mesaState)}`}
                      title={mesaLabel}
                    >
                      {mesaLabel}
                    </span>
                  ) : null}
                </div>

                {invId ? (
                  <div className="rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-950/40">
                    <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      INV-{invId.slice(0, 8)}…
                      <span className="ml-2 font-sans font-normal text-slate-500 dark:text-slate-400">(mismo ID que mesa)</span>
                    </p>
                    {r.resolvedLinkId ? (
                      <p className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        Enlace candidato: {r.resolvedLinkId.slice(0, 10)}…
                      </p>
                    ) : null}
                    {inv?.linkStatus ? (
                      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Estado enlace: {inv.linkStatus}</p>
                    ) : null}
                    {inv?.updatedAt ? (
                      <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                        Expediente actualizado {new Date(inv.updatedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {(prospect || phone || email || r.candidateCurp || r.candidateRfc) && (
                  <div className="text-xs text-slate-700 dark:text-slate-200">
                    {prospect ? (
                      <p>
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Prospecto:</span> {prospect}
                      </p>
                    ) : null}
                    {r.candidateCurp ? (
                      <p>
                        <span className="font-semibold text-slate-500 dark:text-slate-400">CURP:</span>{' '}
                        <span className="font-mono">{r.candidateCurp}</span>
                      </p>
                    ) : null}
                    {r.candidateRfc ? (
                      <p>
                        <span className="font-semibold text-slate-500 dark:text-slate-400">RFC:</span>{' '}
                        <span className="font-mono">{r.candidateRfc}</span>
                      </p>
                    ) : null}
                    {phone ? (
                      <p>
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Tel.:</span> {phone}
                      </p>
                    ) : null}
                    {email ? (
                      <p>
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Correo:</span> {email}
                      </p>
                    ) : null}
                  </div>
                )}

                {notes ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-white/50 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-950/30 dark:text-slate-300">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Notas / contexto:</span> {notes}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <button
                  type="button"
                  onClick={() => onOpenTracking(r)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <Route className="h-3.5 w-3.5" aria-hidden />
                  Ver seguimiento
                </button>
              </div>
            </div>

            {r.status === 'DONE' && r.resolvedLinkId && candidateUrl ? (
              <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-600/80">
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Enlace para el candidato (él debe abrirlo en su celular; no uses tu sesión de vendedor).
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    readOnly
                    value={candidateUrl}
                    className="min-w-[240px] flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-[11px] font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(candidateUrl);
                        toast.success('Enlace copiado');
                      } catch {
                        toast.error('No se pudo copiar');
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                  {onShareWhatsApp ? (
                    <button
                      type="button"
                      onClick={() => onShareWhatsApp(candidateUrl, r.title)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-600/40 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/35 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      WhatsApp
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};
