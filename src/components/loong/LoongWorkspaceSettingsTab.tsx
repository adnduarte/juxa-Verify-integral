import React, { useEffect, useState } from 'react';
import { deleteField, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { USER_PERSONAL_LOONG_POLICY_FIELD } from '../../lib/loongMotorPolicyFirestore';
import { LoongCatalogAdminPanel } from './LoongCatalogAdminPanel';
import { EmbedLinksPanel } from '../platform/EmbedLinksPanel';
import {
  PERSONAL_LOONG_POLICY_EXAMPLE_JSON,
  parsePersonalLoongPolicyBundle,
} from '../../lib/personalLoongPolicyBundle';

export const LoongWorkspaceSettingsTab: React.FC = () => {
  const { user, resetPassword, organizationName, role } = useAuthStatus();
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [personalLoongJson, setPersonalLoongJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.phone === 'string') setPhone(d.phone);
          if (typeof d.displayName === 'string') setDisplayName(d.displayName);
          const raw = d[USER_PERSONAL_LOONG_POLICY_FIELD];
          if (typeof raw === 'string' && raw.trim()) setPersonalLoongJson(raw);
          else setPersonalLoongJson('');
        }
      } catch (e) {
        console.error(e);
        toast.error('No se pudo cargar el perfil.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const saveProfile = async () => {
    if (!user?.uid) return;
    if (personalLoongJson.trim() && !parsePersonalLoongPolicyBundle(personalLoongJson)) {
      toast.error('El JSON de políticas personales Loong no es válido.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        phone: phone.trim(),
        displayName: displayName.trim(),
        ...(personalLoongJson.trim()
          ? { [USER_PERSONAL_LOONG_POLICY_FIELD]: personalLoongJson.trim() }
          : { [USER_PERSONAL_LOONG_POLICY_FIELD]: deleteField() }),
        updatedAt: new Date().toISOString(),
      });
      toast.success('Perfil actualizado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const onResetPassword = async () => {
    const email = user?.email;
    if (!email || !resetPassword) {
      toast.error('No hay correo para enviar el enlace.');
      return;
    }
    try {
      await resetPassword(email);
      toast.success('Revisa tu correo para restablecer la contraseña.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar correo.');
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando configuración…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Configuración de cuenta</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Datos de contacto en la plataforma. El correo de acceso no se puede cambiar aquí.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Correo</label>
          <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{user?.email ?? '—'}</p>
        </div>
        {organizationName ? (
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Organización</label>
            <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{organizationName}</p>
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nombre para mostrar</label>
          <input
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ej. Juan Pérez"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Teléfono</label>
          <input
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10 dígitos"
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={saveProfile}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-6 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Políticas Loong (solo tu cuenta)</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Ajustes opcionales que se fusionan encima de la política de tu organización y de la plantilla global. No modifican el documento de la
          empresa ni afectan a otros usuarios. Úsalos para simulaciones y tu forma de ver umbrales; expedientes oficiales y enlaces candidato
          siguen la política del admin.
        </p>
        <textarea
          value={personalLoongJson}
          onChange={(e) => setPersonalLoongJson(e.target.value)}
          rows={12}
          placeholder={PERSONAL_LOONG_POLICY_EXAMPLE_JSON}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-200"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setPersonalLoongJson(PERSONAL_LOONG_POLICY_EXAMPLE_JSON)}
          className="text-xs font-medium text-amber-800 dark:text-amber-300 hover:underline"
        >
          Insertar ejemplo JSON
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Seguridad</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Te enviaremos un enlace al correo de tu cuenta para elegir una nueva contraseña.
        </p>
        <button
          type="button"
          onClick={onResetPassword}
          className="mt-3 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
        >
          Enviar correo para cambiar contraseña
        </button>
      </div>

      {(role === 'ADMIN' || role === 'SUPERVISOR') ? <LoongCatalogAdminPanel /> : null}

      {(role === 'ADMIN' || role === 'SUPERVISOR' || role === 'ATENCION_CLIENTE') ? (
        <EmbedLinksPanel variant="loong" />
      ) : null}
    </div>
  );
};
