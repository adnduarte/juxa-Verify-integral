import React, { useRef, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import type { LoongCollectionRules } from '../../lib/loongOperationalRules';
import { FileUp, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { PercentSliderField } from '../ui';
import { shellClasses } from '../../config/brand';

type Props = {
  value: LoongCollectionRules;
  onChange: (next: LoongCollectionRules) => void;
};

export const LoongOperationalCollectionEditor: React.FC<Props> = ({ value, onChange }) => {
  const { user } = useAuthStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const patch = (partial: Partial<LoongCollectionRules>) => {
    onChange({ ...value, ...partial });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) {
      if (!user?.uid) toast.error('Inicia sesión para subir archivos.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error('El archivo supera 12 MB.');
      return;
    }
    setUploading(true);
    try {
      const path = `loong_collection_policy/${user.uid}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' });
      const url = await getDownloadURL(storageRef);
      patch({ collectionPolicyDocumentUrl: url, collectionPolicyDocumentName: file.name });
      toast.success('Archivo cargado. Recuerda guardar políticas.');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Error al subir el archivo (revisa reglas de Storage en Firebase).');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className={`${shellClasses.surfaceCard} p-5 space-y-4`}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Política de cobranza</h3>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Texto <strong className="font-semibold text-slate-800 dark:text-slate-200">plano</strong> (sin markdown). Opcionalmente adjunta el documento oficial que deba regir moratorios, canales de contacto, etc.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          Días de gracia antes de moratorio
          <input
            type="number"
            min={0}
            className={`mt-1.5 w-full ${shellClasses.field}`}
            value={value.graceDaysBeforeLateFee}
            onChange={(e) => patch({ graceDaysBeforeLateFee: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-950/50 p-3">
          <PercentSliderField
            label="% moratorio sobre cuota vencida"
            value={value.lateFeePctOfInstallment}
            onChange={(next) => patch({ lateFeePctOfInstallment: Math.max(0, next || 0) })}
            min={0}
            max={25}
            step={0.1}
            precision={1}
            helpText="Se calcula como porcentaje de la cuota vencida (no del saldo)."
          />
        </div>
      </div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
        Texto de política (plano)
        <textarea
          className={`mt-1.5 min-h-[120px] w-full resize-y ${shellClasses.field}`}
          value={value.collectionPolicyNotes}
          onChange={(e) => patch({ collectionPolicyNotes: e.target.value })}
          placeholder="Ej. Plazos de pago, procedimiento ante atraso, datos de contacto de cobranza…"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.html" className="hidden" onChange={onFile} />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className={`${shellClasses.btnSecondary} disabled:opacity-50`}
        >
          <FileUp className="h-4 w-4" />
          {uploading ? 'Subiendo…' : 'Cargar documento'}
        </button>
        {value.collectionPolicyDocumentUrl ? (
          <a
            href={value.collectionPolicyDocumentUrl}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1 text-sm font-medium ${shellClasses.linkAccent} underline underline-offset-2`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {value.collectionPolicyDocumentName || 'Documento adjunto'}
          </a>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">Ningún archivo adjunto.</span>
        )}
        {(value.collectionPolicyDocumentUrl || value.collectionPolicyDocumentName) && (
          <button
            type="button"
            className="text-xs text-red-600 hover:underline"
            onClick={() => patch({ collectionPolicyDocumentUrl: undefined, collectionPolicyDocumentName: undefined })}
          >
            Quitar archivo
          </button>
        )}
      </div>
    </div>
  );
};
