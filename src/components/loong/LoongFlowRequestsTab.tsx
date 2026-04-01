import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Copy, ExternalLink, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuthStatus } from '../../contexts/AuthContext';
import type { Role } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import type { LoongOriginationCase } from '../../lib/loongOrigination';
import {
  issueStandaloneLoongPrecalLink,
  recordVendorStandalonePrecalIssued,
  submitLoongFlowRequest,
  type LoongFlowIntent,
  type LoongFlowRequest,
} from '../../lib/loongFlowRequests';
import { useVendorLoongPrecalInvestigations } from '../../hooks/useVendorLoongPrecalInvestigations';
import { LoongFlowRequestTrackingModal } from './LoongFlowRequestTrackingModal';
import { LoongVendorFlowRequestList } from './LoongVendorFlowRequestList';

function newPrecalReferenceLabel(): string {
  const u = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 10) : `${Date.now()}`;
  return `PCL-${u.toUpperCase()}`;
}

function normalizeTaxId(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '');
}

const INTENT_OPTIONS: { value: LoongFlowIntent; label: string }[] = [
  { value: 'precal_completo', label: 'Precalificación candidato (enlace)' },
  { value: 'calificacion_formal', label: 'Calificación formal (con expediente en etapa correcta)' },
  { value: 'investigacion_arraigo', label: 'Investigación / arraigo (con expediente)' },
  { value: 'flujo_prueba', label: 'Solo prueba interna' },
  { value: 'otro', label: 'Otro (notas)' },
];

type Props = {
  role: Role;
  cases: LoongOriginationCase[];
  showMesaQueue: boolean;
};

export const LoongFlowRequestsTab: React.FC<Props> = ({ role, cases, showMesaQueue }) => {
  const { user, effectiveOrganizationId } = useAuthStatus();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [intent, setIntent] = useState<LoongFlowIntent>('precal_completo');
  const [caseId, setCaseId] = useState('');
  const [sending, setSending] = useState(false);
  const [mine, setMine] = useState<LoongFlowRequest[]>([]);
  const [tracking, setTracking] = useState<LoongFlowRequest | null>(null);
  const [prospectName, setProspectName] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectCurp, setProspectCurp] = useState('');
  const [prospectRfc, setProspectRfc] = useState('');
  const [vendorNotes, setVendorNotes] = useState('');
  const [lastCreated, setLastCreated] = useState<{
    url: string;
    investigationId: string;
    linkId: string;
    title: string;
  } | null>(null);

  const mesaQueue = cases.filter((c) => c.originationStage === 'MESA_REVISION');

  const isVendor = role === 'CLIENTE';
  const vendorPrecalInvById = useVendorLoongPrecalInvestigations(isVendor ? user?.uid : undefined);
  const fixedIntent: LoongFlowIntent = 'precal_completo';

  const waMessageForVendor = useMemo(() => {
    return 'El enlace queda en la plataforma: cópialo o compártelo por WhatsApp cuando quieras. Tu captura y lo que el candidato envíe se unen en el mismo expediente y pasan a mesa de control para dictamen (mismo ID en cola de mesa).';
  }, []);

  const messageForCandidate = (url: string, refTitle: string) => {
    return (
      `Hola.\n` +
      `Para continuar con tu precalificación de crédito moto, llena este formulario desde tu celular:\n\n` +
      `${url}\n\n` +
      `Referencia: ${refTitle || 'Precalificación'}\n` +
      `Tarda ~3-5 minutos.`
    );
  };

  const openWhatsAppShare = (url: string, refTitle: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(messageForCandidate(url, refTitle))}`, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!user?.uid) {
      setMine([]);
      return;
    }
    const q = query(collection(db, 'loong_flow_requests'), where('requestedByUid', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as LoongFlowRequest[];
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMine(list.slice(0, 200));
      },
      (e) => console.error('[LoongFlowRequestsTab] flow requests', e)
    );
    return () => unsub();
  }, [user?.uid]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !role) return;
    const t = title.trim();
    if (!isVendor && !t) {
      toast.error('Describe la solicitud (título).');
      return;
    }
    setSending(true);
    try {
      // Vendedor: genera el enlace directo (precalificación inmediata).
      if (isVendor) {
        const nameOk = prospectName.trim();
        const phoneOk = prospectPhone.trim();
        const emailOk = prospectEmail.trim();
        const curpOk = normalizeTaxId(prospectCurp);
        const rfcOk = normalizeTaxId(prospectRfc);
        if (!nameOk) {
          toast.error('Indica el nombre del prospecto.');
          setSending(false);
          return;
        }
        if (!phoneOk || phoneOk.replace(/\D/g, '').length < 10) {
          toast.error('Indica un teléfono válido (mín. 10 dígitos).');
          setSending(false);
          return;
        }
        if (!emailOk || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOk)) {
          toast.error('Indica un correo electrónico válido.');
          setSending(false);
          return;
        }
        if (!curpOk && !rfcOk) {
          toast.error('Indica CURP o RFC (uno de los dos).');
          setSending(false);
          return;
        }
        if (curpOk && rfcOk) {
          toast.error('Indica solo CURP o solo RFC, no ambos.');
          setSending(false);
          return;
        }
        if (curpOk && curpOk.length !== 18) {
          toast.error('CURP debe tener 18 caracteres.');
          setSending(false);
          return;
        }
        if (rfcOk && (rfcOk.length < 12 || rfcOk.length > 13)) {
          toast.error('RFC debe tener 12 o 13 caracteres.');
          setSending(false);
          return;
        }

        const refTitle = newPrecalReferenceLabel();
        const { url, investigationId, linkId } = await issueStandaloneLoongPrecalLink(db, {
          title: refTitle,
          testMode: false,
          clientIdForInv: user.uid,
          organizationId: effectiveOrganizationId,
          requestedByUidForAudit: user.uid,
          candidateEmail: emailOk,
          candidatePhone: phoneOk,
          prospectDisplayName: nameOk,
          vendorNotes: vendorNotes.trim() || null,
          candidateCurp: curpOk || null,
          candidateRfc: rfcOk || null,
        });
        try {
          await recordVendorStandalonePrecalIssued(db, {
            title: refTitle,
            organizationId: effectiveOrganizationId,
            requestedByUid: user.uid,
            requesterRole: role,
            investigationId,
            linkId,
            clientName: nameOk,
            candidateEmail: emailOk,
            candidatePhone: phoneOk,
            candidateCurp: curpOk || null,
            candidateRfc: rfcOk || null,
            notes: vendorNotes.trim() || null,
          });
        } catch (recErr) {
          console.error('[LoongFlowRequestsTab] recordVendorStandalonePrecalIssued', recErr);
          toast.error(
            'El enlace se generó pero no se guardó el historial. Revisa reglas Firestore (loong_flow_requests) o vuelve a intentar.'
          );
        }
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Enlace generado y copiado. Mismo expediente para ti, mesa y candidato.');
        } catch {
          toast.success('Enlace generado. Usa el recuadro de abajo para copiarlo.');
        }
        setLastCreated({ url, investigationId, linkId, title: refTitle });
        setProspectName('');
        setProspectPhone('');
        setProspectEmail('');
        setProspectCurp('');
        setProspectRfc('');
        setVendorNotes('');
        setNotes('');
        setCaseId('');
        return;
      }
      const selectedCase = caseId ? cases.find((c) => c.id === caseId) : undefined;
      await submitLoongFlowRequest(db, {
        organizationId: effectiveOrganizationId,
        requestedByUid: user.uid,
        requestedByEmail: user.email,
        requesterRole: role,
        title: t,
        notes: notes.trim(),
        intent: isVendor ? fixedIntent : intent,
        caseId: caseId || null,
        clientName: selectedCase?.clientName,
        candidateEmail: selectedCase?.clientEmail,
        candidatePhone: selectedCase?.clientPhone,
      });
      toast.success('Solicitud enviada a central (superadmin).');
      setTitle('');
      setNotes('');
      setCaseId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar.');
    } finally {
      setSending(false);
    }
  };

  const card =
    'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm';

  return (
    <div className="space-y-8">
      {tracking && user?.uid ? (
        <LoongFlowRequestTrackingModal
          flowRequest={tracking}
          userUid={user.uid}
          userEmail={user.email}
          onClose={() => setTracking(null)}
        />
      ) : null}
      <div className={card}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Send className="h-5 w-5 text-emerald-600" aria-hidden />
          {isVendor ? 'Precalificación directa (enlace al candidato)' : 'Solicitud a central (investigación / enlaces)'}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {isVendor
            ? 'Un solo expediente: lo que registres del prospecto y lo que el candidato llene en el enlace se guardan en el mismo ID y, al enviar el candidato, el caso queda en cola de mesa de control para dictaminar. La referencia PCL se genera sola. La INE u otros archivos puedes subirlos después en «Ver seguimiento».'
            : 'Mesa, comercial Loong o vendedor: envía aquí lo que debe arrancar el superadmin. El administrador Loong verá la cola en Admin → Loong Motor y generará el enlace o flujo.'}
        </p>
        {isVendor ? (
          <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-100">
            {waMessageForVendor}
          </div>
        ) : null}

        {showMesaQueue && mesaQueue.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 dark:border-amber-800/50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
            <p className="font-medium">Expedientes en revisión de mesa ({mesaQueue.length})</p>
            <ul className="mt-2 space-y-1 text-xs opacity-90">
              {mesaQueue.slice(0, 8).map((c) => (
                <li key={c.id}>
                  {c.clientName} · {c.clientEmail} · {c.id.slice(0, 8)}…
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {!isVendor ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Título breve</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                placeholder="Ej. Arranque precal — Juan Pérez"
              />
            </div>
          ) : null}
          {isVendor ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-950/80">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Datos del prospecto</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  La referencia del expediente (código <span className="font-mono">PCL-…</span>) se genera sola al crear
                  el enlace; mesa y listados usan ese mismo título más el nombre de abajo.
                </p>
                <label className="mb-1 mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Nombre completo del prospecto <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Nombre y apellidos (obligatorio)"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    CURP <span className="text-slate-500">(o RFC a la derecha)</span>
                  </label>
                  <input
                    value={prospectCurp}
                    onChange={(e) => setProspectCurp(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                    placeholder="18 caracteres"
                    maxLength={18}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    RFC <span className="text-slate-500">(si no hay CURP)</span>
                  </label>
                  <input
                    value={prospectRfc}
                    onChange={(e) => setProspectRfc(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                    placeholder="12–13 caracteres"
                    maxLength={13}
                    autoComplete="off"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Debes capturar <strong>CURP o RFC</strong> (al menos uno).</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Teléfono candidato <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    value={prospectPhone}
                    onChange={(e) => setProspectPhone(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    placeholder="10 dígitos o más"
                    inputMode="tel"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Correo candidato <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={prospectEmail}
                    onChange={(e) => setProspectEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Notas para mesa (opcional)</label>
                <textarea
                  value={vendorNotes}
                  onChange={(e) => setVendorNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Contexto, sucursal, producto de interés…"
                />
              </div>
            </>
          ) : null}
          {!isVendor ? (
            <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Tipo de arranque</label>
            <select
              value={isVendor ? fixedIntent : intent}
              onChange={(e) => setIntent(e.target.value as LoongFlowIntent)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              disabled={isVendor}
            >
              {INTENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            </div>
          ) : null}
          {!isVendor && cases.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Expediente Loong (opcional)
              </label>
              <select
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="">— Ninguno —</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.clientName} · {c.originationStage} · {c.id.slice(0, 8)}…
                  </option>
                ))}
              </select>
            </div>
          )}
          {!isVendor ? (
            <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Notas para central</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              placeholder="Contexto, teléfono del candidato, urgencia…"
            />
            </div>
          ) : null}
          {isVendor ? (
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              El enlace se crea y se muestra en esta pantalla. <strong>No</strong> se abre WhatsApp automáticamente; solo si pulsas «Compartir por WhatsApp» después.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={sending}
            className="inline-flex w-full flex-col items-center justify-center gap-0.5 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:py-2.5"
          >
            <span>{sending ? 'Generando…' : isVendor ? 'Crear expediente y enlace' : 'Enviar a superadmin Loong'}</span>
            {!sending && isVendor ? (
              <span className="text-[11px] font-normal opacity-90">Enlace en la plataforma · WhatsApp opcional</span>
            ) : null}
          </button>
        </form>

        {isVendor && lastCreated ? (
          <div className="mt-6 space-y-3 rounded-2xl border border-emerald-200/90 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">Último enlace generado</p>
            <p className="text-xs text-emerald-900/90 dark:text-emerald-200/85">
              Referencia <span className="font-mono font-semibold">{lastCreated.title}</span>
              {' · '}
              Expediente <span className="font-mono font-semibold">INV-{lastCreated.investigationId.slice(0, 6)}</span>
              {' · '}
              <span className="font-mono text-[11px]">enlace {lastCreated.linkId.slice(0, 8)}…</span>
            </p>
            <input
              readOnly
              value={lastCreated.url}
              className="w-full rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(lastCreated.url);
                    toast.success('Enlace copiado');
                  } catch {
                    toast.error('No se pudo copiar');
                  }
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar enlace
              </button>
              <button
                type="button"
                onClick={() => openWhatsAppShare(lastCreated.url, lastCreated.title)}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-600/50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Compartir por WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setLastCreated(null)}
                className="rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-800/60"
              >
                Ocultar
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ClipboardList className="h-4 w-4" aria-hidden />
          Mis solicitudes recientes
          {isVendor ? (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(mismo listado que la pestaña Mis solicitudes)</span>
          ) : null}
        </h3>
        {mine.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aún no hay registros.</p>
        ) : (
          <LoongVendorFlowRequestList
            rows={mine}
            invById={isVendor ? vendorPrecalInvById : {}}
            onOpenTracking={(r) => setTracking(r)}
            onShareWhatsApp={isVendor ? (url, refTitle) => openWhatsAppShare(url, refTitle) : undefined}
          />
        )}
      </div>
    </div>
  );
};
