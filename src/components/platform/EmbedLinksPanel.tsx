import React, { useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import { issueStandaloneLoongPrecalLink } from '../../lib/loongFlowRequests';

type Props = {
  variant: 'platform' | 'loong';
};

const whatsAppUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export const EmbedLinksPanel: React.FC<Props> = ({ variant }) => {
  const { user, effectiveOrganizationId, role } = useAuthStatus();
  const [title, setTitle] = useState(variant === 'loong' ? 'Precalificación crédito moto' : 'Precalificación');
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');

  const canUse =
    role === 'ADMIN' || role === 'SUPERVISOR' || role === 'ATENCION_CLIENTE' || role === 'ANALISTA_MESA_CONTROL';

  const iframe = useMemo(() => {
    if (!url) return '';
    return `<iframe src="${url}" style="width:100%;height:780px;border:0;border-radius:16px;overflow:hidden" allow="geolocation *; camera *; microphone *"></iframe>`;
  }, [url]);

  const message = useMemo(() => {
    if (!url) return '';
    return (
      `Hola.\n` +
      `Para continuar, llena este formulario desde tu celular:\n\n` +
      `${url}\n\n` +
      `Tarda ~3-5 minutos.`
    );
  }, [url]);

  const generate = async () => {
    if (!user?.uid) return;
    if (!canUse) return toast.error('Sin permisos para generar enlaces.');
    if (variant === 'loong' && !effectiveOrganizationId) return toast.error('Falta organizationId para Loong.');
    const t = title.trim() || (variant === 'loong' ? 'Precalificación crédito moto' : 'Precalificación');
    setBusy(true);
    try {
      const res = await issueStandaloneLoongPrecalLink(db, {
        title: t,
        testMode: false,
        clientIdForInv: user.uid,
        organizationId: variant === 'loong' ? effectiveOrganizationId : null,
        requestedByUidForAudit: user.uid,
      });
      setUrl(res.url);
      try {
        await navigator.clipboard.writeText(res.url);
        toast.success('Enlace generado y copiado.');
      } catch {
        toast.success('Enlace generado.');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'No se pudo generar enlace.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-emerald-600" />
          Enlace embebible de precalificación
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Genera una URL pública para compartir (WhatsApp) o embeber en tu sitio (iframe).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-12">
        <div className="sm:col-span-9">
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Título / etiqueta</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            placeholder="Ej. Precalificación crédito moto"
          />
        </div>
        <div className="sm:col-span-3 flex items-end">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? 'Generando…' : 'Generar URL'}
          </button>
        </div>
      </div>

      {url ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">URL</label>
            <input
              readOnly
              value={url}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success('Copiado');
                } catch {
                  toast.success(url);
                }
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70"
            >
              Copiar URL
            </button>
            <button
              type="button"
              onClick={() => window.open(whatsAppUrl(message), '_blank', 'noopener,noreferrer')}
              className="rounded-lg border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            >
              WhatsApp
            </button>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Iframe (para embeber)</label>
            <textarea
              readOnly
              value={iframe}
              rows={4}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

