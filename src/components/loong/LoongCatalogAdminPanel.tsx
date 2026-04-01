import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { Upload, Trash2, Plus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { useAuthStatus } from '../../contexts/AuthContext';
import type { LoongCatalogItem } from '../../lib/loongCatalog';
import { normalizeCatalogPrice, parseCatalogCsv } from '../../lib/loongCatalog';

function rid() {
  return crypto.randomUUID();
}

export const LoongCatalogAdminPanel: React.FC = () => {
  const { organizationId, role } = useAuthStatus();
  const canEdit = role === 'ADMIN' || role === 'SUPERVISOR';

  const [rows, setRows] = useState<LoongCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newPrice, setNewPrice] = useState('45000');
  const [newActive, setNewActive] = useState(true);

  const orgId = organizationId?.trim() || '';

  const load = useCallback(async () => {
    if (!orgId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, 'loong_catalog_items'), where('organizationId', '==', orgId));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as LoongCatalogItem[];
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setRows(list);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo cargar el catálogo.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(() => rows.filter((r) => r.active !== false).length, [rows]);

  const upsertItem = async (partial: Partial<LoongCatalogItem> & { id?: string }) => {
    if (!canEdit) return toast.error('Sin permisos para editar catálogo.');
    if (!orgId) return toast.error('Falta organizationId en tu cuenta.');
    const now = new Date().toISOString();
    const id = partial.id || rid();
    const payload: Record<string, unknown> = {
      organizationId: orgId,
      name: String(partial.name || '').trim(),
      sku: String(partial.sku || '').trim() || null,
      price: normalizeCatalogPrice(partial.price),
      active: partial.active !== false,
      updatedAt: now,
      createdAt: now,
    };
    if (!payload.name) return toast.error('Nombre requerido.');
    if (typeof payload.price !== 'number' || payload.price <= 0) return toast.error('Precio inválido.');

    setBusy(true);
    try {
      await setDoc(doc(db, 'loong_catalog_items', id), payload, { merge: true });
      toast.success('Guardado.');
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (id: string) => {
    if (!canEdit) return toast.error('Sin permisos para editar catálogo.');
    if (!window.confirm('¿Eliminar este item del catálogo?')) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'loong_catalog_items', id));
      toast.success('Eliminado.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar.');
    } finally {
      setBusy(false);
    }
  };

  const onUploadCsv = async (file: File | null) => {
    if (!file) return;
    if (!canEdit) return toast.error('Sin permisos para editar catálogo.');
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = parseCatalogCsv(text);
      const forOrg = parsed.filter((r) => String(r.organizationId).trim() === orgId);
      if (forOrg.length === 0) {
        toast.error('El CSV no contiene filas para tu organizationId.');
        return;
      }
      const now = new Date().toISOString();
      for (const row of forOrg) {
        const id = row.sku?.trim() ? row.sku.trim() : rid();
        await setDoc(
          doc(db, 'loong_catalog_items', id),
          {
            organizationId: orgId,
            name: row.name.trim(),
            sku: row.sku?.trim() || null,
            price: normalizeCatalogPrice(row.price),
            active: row.active !== false,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        );
      }
      toast.success(`Catálogo cargado: ${forOrg.length} filas.`);
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'CSV inválido.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Catálogo Loong (motos / productos)</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Sirve para precargar modelo y precio en precalificador. Activos: <strong>{activeCount}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Recargar
        </button>
      </div>

      {!orgId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Tu cuenta no tiene <strong>organizationId</strong>. No se puede administrar catálogo sin tenant.
        </div>
      ) : null}

      {canEdit ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nombre</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              placeholder="Ej. Loong 150cc Premium"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">SKU (opcional)</label>
            <input
              value={newSku}
              onChange={(e) => setNewSku(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              placeholder="L150-PRE"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Precio</label>
            <input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex items-end gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} />
              Activo
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void upsertItem({ name: newName, sku: newSku, price: Number(newPrice), active: newActive })}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">Solo ADMIN/SUPERVISOR pueden editar catálogo.</p>
      )}

      {canEdit ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Subir CSV (encabezados: <code>organizationId,name,price</code> y opcionales <code>sku,active</code>)
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70">
              <Upload className="h-4 w-4" />
              Elegir CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void onUploadCsv(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aún no hay items.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Precio</th>
                <th className="p-3">Activo</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{r.name}</td>
                  <td className="p-3 text-xs font-mono text-slate-600 dark:text-slate-300">{r.sku || '—'}</td>
                  <td className="p-3">${Number(r.price || 0).toLocaleString('es-MX')}</td>
                  <td className="p-3">{r.active !== false ? 'Sí' : 'No'}</td>
                  <td className="p-3 text-right">
                    {canEdit ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeItem(r.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

