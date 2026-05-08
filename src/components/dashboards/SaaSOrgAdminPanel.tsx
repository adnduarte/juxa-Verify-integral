import React, { useEffect, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { collection, doc, getDocs, setDoc, updateDoc } from '@/lib/localFirestore';
import { db } from '../../firebase';
import { defaultTenantFeatures, type OrganizationDoc, type TenantBranding, type TenantFeatureFlags } from '../../types/saas';
import { toast } from 'react-hot-toast';
import {
  createFordAgencyOrganization,
  FORD_PROGRAM_ROOT_ORG_ID,
} from '../../lib/fordOrganizationProvisioning';

const defaultBranding: TenantBranding = {
  appName: 'Juxa Verify',
  primaryColor: '#2563eb',
};

const FEATURE_LABELS: Record<keyof TenantFeatureFlags, string> = {
  socioeconomicStudies: 'Estudios socioeconómicos',
  hrSuiteMexico: 'RRHH México',
  creditOrigination: 'Originación / crédito',
  b2bCollections: 'B2B / cobranza',
  supplierCompliance: 'Proveedores / compliance',
  fieldNetwork: 'Red y campo',
  identityAntiUsurpation: 'Identidad / anti-usurpación',
  digidSignatures: 'Firmas DIGID',
};

export const SaaSOrgAdminPanel: React.FC = () => {
  const [orgs, setOrgs] = useState<OrganizationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editParent, setEditParent] = useState('');
  const [editAppName, setEditAppName] = useState('');
  const [editPrimary, setEditPrimary] = useState('');
  const [editFeatures, setEditFeatures] = useState<TenantFeatureFlags>({ ...defaultTenantFeatures });
  const [editCreditInitial, setEditCreditInitial] = useState('');
  const [editCreditFull, setEditCreditFull] = useState('');
  const [editCreditPoliticas, setEditCreditPoliticas] = useState('');
  const [editCreditPoliciesOrg, setEditCreditPoliciesOrg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await (getDocs as (q: unknown) => Promise<{ docs: { id: string; data: () => object }[] }>)(
        collection(db as never, 'organizations')
      );
      setOrgs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrganizationDoc, 'id'>) })));
    } catch {
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEditor = (o: OrganizationDoc) => {
    if (expandedId === o.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(o.id);
    setEditName(o.name || '');
    setEditParent(o.parentOrganizationId ?? '');
    setEditAppName(o.branding?.appName || defaultBranding.appName);
    setEditPrimary(o.branding?.primaryColor || defaultBranding.primaryColor);
    setEditFeatures({ ...defaultTenantFeatures, ...(o.features ?? {}) });
    setEditCreditInitial(o.creditAiRules?.initialRubric || '');
    setEditCreditFull(o.creditAiRules?.fullAnalysis || '');
    setEditCreditPoliticas(o.creditAiRules?.politicasGenerales || '');
    setEditCreditPoliciesOrg(o.creditAiRules?.creditPolicies || '');
  };

  const saveOrg = async (id: string) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const branding: TenantBranding = {
        appName: editAppName.trim() || defaultBranding.appName,
        primaryColor: editPrimary.trim() || defaultBranding.primaryColor,
      };
      await (updateDoc as (ref: unknown, data: object) => Promise<void>)(doc(db as never, 'organizations', id), {
        name: editName.trim() || id,
        parentOrganizationId: editParent.trim() || null,
        branding,
        features: editFeatures,
        creditAiRules: {
          initialRubric: editCreditInitial.trim(),
          fullAnalysis: editCreditFull.trim(),
          politicasGenerales: editCreditPoliticas.trim(),
          creditPolicies: editCreditPoliciesOrg.trim(),
        },
        updatedAt: now,
      });
      toast.success('Organización actualizada');
      setExpandedId(null);
      load();
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const bootstrapDefault = async () => {
    try {
      const now = new Date().toISOString();
      const features: TenantFeatureFlags = { ...defaultTenantFeatures };
      await (setDoc as (ref: unknown, data: object) => Promise<void>)(doc(db as never, 'organizations', 'default'), {
        name: 'Organización principal',
        parentOrganizationId: null,
        branding: defaultBranding,
        features,
        limits: { maxUsers: 500, investigationsPerMonth: 5000, signaturesPerMonth: 2000 },
        createdAt: now,
        updatedAt: now,
      });
      toast.success('organizations/default creado');
      load();
    } catch (e) {
      toast.error('No se pudo crear default');
    }
  };

  const createOrg = async () => {
    if (!slug.trim() || !name.trim()) {
      toast.error('Slug y nombre requeridos');
      return;
    }
    const id = slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    try {
      const now = new Date().toISOString();
      await (setDoc as (ref: unknown, data: object) => Promise<void>)(doc(db as never, 'organizations', id), {
        name: name.trim(),
        parentOrganizationId: null,
        branding: { ...defaultBranding, appName: name.trim() },
        features: { ...defaultTenantFeatures },
        limits: {},
        createdAt: now,
        updatedAt: now,
      });
      toast.success('Organización creada');
      setName('');
      setSlug('');
      load();
    } catch {
      toast.error('Error al crear');
    }
  };

  const createFordAgency = async () => {
    if (!slug.trim() || !name.trim()) {
      toast.error('Slug y nombre requeridos para la agencia');
      return;
    }
    try {
      await createFordAgencyOrganization(db, { slug: slug.trim(), displayName: name.trim() });
      toast.success(`Agencia Ford "${name.trim()}" creada`);
      setName('');
      setSlug('');
      load();
    } catch (e) {
      console.error(e);
      toast.error('No se pudo crear agencia Ford');
    }
  };

  const toggleFeature = (key: keyof TenantFeatureFlags) => {
    setEditFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-6 h-6" />
          SaaS y marca blanca
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Revendedores: use <code>parentOrganizationId</code> en el documento hijo. Asigne{' '}
          <code>organizationId</code> a usuarios desde la pestaña de usuarios.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" /> Refrescar
        </button>
        <button
          type="button"
          onClick={bootstrapDefault}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium"
        >
          Bootstrap default
        </button>
      </div>
      <div className="p-6 rounded-2xl border border-slate-200 bg-white space-y-4">
        <h3 className="font-bold text-slate-800">Nueva organización / revendedor</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="border rounded-xl px-3 py-2 text-sm"
            placeholder="Nombre visible"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="border rounded-xl px-3 py-2 text-sm font-mono"
            placeholder="slug-id (Firestore doc id)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={createOrg}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Crear (genérica)
          </button>
          <button
            type="button"
            onClick={createFordAgency}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
            style={{ backgroundColor: '#003478' }}
            title="Crea (o garantiza) la organización raíz ford-credit-mx y registra la agencia bajo ella"
          >
            <Plus className="w-4 h-4" /> Crear agencia Ford Crédito MX
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-2 leading-relaxed">
          <p className="font-semibold text-slate-800">Perfiles autorizados para alta de agencias (segregación de funciones)</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong>ADMIN</strong> de plataforma (este panel): alta y mantenimiento de organizaciones del programa.
            </li>
            <li>
              <strong>FORD_SUPERVISOR_DIRECCION</strong>: aprueba solicitudes de alta (cuatro ojos) y puede alta directa desde el panel Ford “Red y altas de
              agencias”.
            </li>
            <li>
              <strong>FORD_SUPERVISOR_GERENCIA</strong>: envía <strong>solicitudes</strong> de nueva agencia; Dirección las aprueba — no crea la organización
              hasta la aprobación.
            </li>
            <li>
              Mesa/agencia, F&amp;I y usuarios <strong>OPERATIVO</strong> en cuenta cliente no incorporan agencias a la red.
            </li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">
          “Agencia Ford” crea la org bajo <code>{FORD_PROGRAM_ROOT_ORG_ID}</code> con <code>partnerVertical: &apos;FORD_CREDIT_MX&apos;</code>. Los usuarios
          mesa y F&amp;I se asignan a esa org y verán únicamente la línea Ford.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="p-3 w-10" />
              <th className="p-3">ID</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Padre</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">
                  Sin organizaciones. Ejecute bootstrap default.
                </td>
              </tr>
            ) : (
              orgs.map((o) => (
                <React.Fragment key={o.id}>
                  <tr className="border-t border-slate-100 hover:bg-slate-50/80">
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => openEditor(o)}
                        className="p-1 rounded-lg text-slate-500 hover:bg-slate-200"
                        aria-expanded={expandedId === o.id}
                        title="Editar productos y marca"
                      >
                        {expandedId === o.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="p-3 font-mono text-xs">{o.id}</td>
                    <td className="p-3 font-medium">{o.name}</td>
                    <td className="p-3 text-xs text-slate-500">{o.parentOrganizationId || '—'}</td>
                  </tr>
                  {expandedId === o.id && (
                    <tr className="bg-slate-50/90 border-t border-slate-100">
                      <td colSpan={4} className="p-4 space-y-4">
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Nombre</label>
                            <input
                              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">parentOrganizationId</label>
                            <input
                              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-mono"
                              value={editParent}
                              onChange={(e) => setEditParent(e.target.value)}
                              placeholder="vacío = raíz"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Marca · appName</label>
                            <input
                              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                              value={editAppName}
                              onChange={(e) => setEditAppName(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Marca · primaryColor</label>
                            <input
                              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-mono"
                              value={editPrimary}
                              onChange={(e) => setEditPrimary(e.target.value)}
                              placeholder="#2563eb"
                            />
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                          <p className="text-xs font-semibold text-slate-600 uppercase">
                            Reglas IA · Originación automotriz (marco organización)
                          </p>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            Se combinan con las políticas de cada cuenta agencia (<code>clients</code>). El análisis de rubro
                            inicial y el dictamen integral consumen estos textos según la fase del expediente.
                          </p>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase">Rubro inicial</label>
                            <textarea
                              className="mt-1 w-full border rounded-xl px-3 py-2 text-xs font-mono min-h-[72px]"
                              placeholder="DTI máximo, documentación mínima, señales de fraude…"
                              value={editCreditInitial}
                              onChange={(e) => setEditCreditInitial(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase">
                              Análisis integral / dictamen
                            </label>
                            <textarea
                              className="mt-1 w-full border rounded-xl px-3 py-2 text-xs font-mono min-h-[72px]"
                              placeholder="Ponderaciones cualitativas, validaciones de campo…"
                              value={editCreditFull}
                              onChange={(e) => setEditCreditFull(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase">
                              Políticas generales (org)
                            </label>
                            <textarea
                              className="mt-1 w-full border rounded-xl px-3 py-2 text-xs font-mono min-h-[56px]"
                              value={editCreditPoliticas}
                              onChange={(e) => setEditCreditPoliticas(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase">
                              Políticas producto crédito (org)
                            </label>
                            <textarea
                              className="mt-1 w-full border rounded-xl px-3 py-2 text-xs font-mono min-h-[56px]"
                              value={editCreditPoliciesOrg}
                              onChange={(e) => setEditCreditPoliciesOrg(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Productos contratados</p>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {(Object.keys(FEATURE_LABELS) as (keyof TenantFeatureFlags)[]).map((key) => (
                              <label
                                key={key}
                                className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none"
                              >
                                <input type="checkbox" checked={Boolean(editFeatures[key])} onChange={() => toggleFeature(key)} />
                                {FEATURE_LABELS[key]}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => saveOrg(o.id)}
                            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium disabled:opacity-50"
                          >
                            {saving ? 'Guardando…' : 'Guardar cambios'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedId(null)}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
                          >
                            Cerrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
